import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, query, where, getDocs, doc, getDoc, 
  addDoc, serverTimestamp, onSnapshot, orderBy, setDoc, deleteDoc, updateDoc, increment 
} from 'firebase/firestore';
import { 
  Send, Search, User, MoreVertical, Phone, ArrowLeft, 
  Loader2, CheckCheck, Trash2, Paperclip, Smile 
} from 'lucide-react';

// --- YORDAMCHI FUNKSIYALAR ---
const formatDateGroup = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return "Yangi";
  const date = timestamp.toDate();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return "Bugun";
  if (date.toDateString() === yesterday.toDateString()) return "Kecha";
  
  return date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long' });
};

const formatTime = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return "";
  return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatPage = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]); 
  const [filteredUsers, setFilteredUsers] = useState([]); 
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]); 
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  
  const scrollRef = useRef();

  // 1. INIT
  useEffect(() => {
    let unsubscribeChats = null;

    const initData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, "students", user.uid));
        const userData = userDoc.exists() ? { ...userDoc.data(), uid: user.uid } : { uid: user.uid, role: 'unknown' };
        setCurrentUser(userData);

        let contactList = [];
        if (userData.role === 'teacher' || userData.role === 'admin') {
            const q = query(collection(db, "students"), where("role", "==", "student"));
            const snap = await getDocs(q);
            contactList = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        } else {
            if (userData.groupId) {
            const groupSnap = await getDoc(doc(db, "groups", userData.groupId));
            if (groupSnap.exists() && groupSnap.data().teacherId) {
                const tSnap = await getDoc(doc(db, "students", groupSnap.data().teacherId));
                if (tSnap.exists()) contactList.push({ uid: tSnap.id, ...tSnap.data() });
            }
            }
        }

        if (contactList.length === 0) {
            setUsers([]);
            setFilteredUsers([]);
            setLoading(false);
            return;
        }

        const chatsQuery = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
        
        unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
            const chatsMap = {};
            snapshot.docs.forEach(doc => {
                chatsMap[doc.id] = doc.data();
            });

            const mergedList = contactList.map(contact => {
                const chatId = user.uid > contact.uid 
                    ? `${user.uid}_${contact.uid}` 
                    : `${contact.uid}_${user.uid}`;
                
                const chatInfo = chatsMap[chatId];
                
                return {
                    ...contact,
                    lastMessage: chatInfo?.lastMessage || "",
                    lastUpdated: chatInfo?.lastUpdated?.seconds || 0, 
                    unread: chatInfo?.unreadCounts?.[user.uid] || 0
                };
            });

            mergedList.sort((a, b) => b.lastUpdated - a.lastUpdated);

            setUsers(mergedList);
            setFilteredUsers(mergedList);
            setLoading(false);
        });

      } catch (error) {
          console.error("Init Error:", error);
          setLoading(false);
      }
    };

    initData();

    return () => {
      if (unsubscribeChats) unsubscribeChats();
    };
  }, []);

  // 2. SEARCH
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users);
    } else {
      const lowerQ = searchQuery.toLowerCase();
      setFilteredUsers(users.filter(u => u.name?.toLowerCase().includes(lowerQ)));
    }
  }, [searchQuery, users]);

  // 3. CHAT LOAD & READ
  useEffect(() => {
    if (!selectedUser || !currentUser) return;
    
    const chatId = currentUser.uid > selectedUser.uid 
      ? `${currentUser.uid}_${selectedUser.uid}` 
      : `${selectedUser.uid}_${currentUser.uid}`;

    // 🔥 O'QILDI DEB BELGILASH (RESET UNREAD)
    // Bu yerda unreadCounts.MeningIDim ni 0 ga tushiramiz
    const resetUnread = async () => {
        try {
            const chatRef = doc(db, "chats", chatId);
            const chatSnap = await getDoc(chatRef);
            if (chatSnap.exists()) {
                await updateDoc(chatRef, {
                    [`unreadCounts.${currentUser.uid}`]: 0
                });
            }
        } catch (e) {
            console.log("Chat hali yaratilmagan, o'qish shart emas");
        }
    };
    resetUnread();

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsubscribe();
  }, [selectedUser, currentUser]);

  // 4. SEND MESSAGE (🔥 TUZATILGAN JOY)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    const chatId = currentUser.uid > selectedUser.uid 
      ? `${currentUser.uid}_${selectedUser.uid}` 
      : `${selectedUser.uid}_${currentUser.uid}`;

    try {
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);

      // Agar chat oldin bor bo'lsa -> UPDATE qilamiz
      if (chatSnap.exists()) {
          await updateDoc(chatRef, {
             lastMessage: newMessage,
             lastUpdated: serverTimestamp(),
             // Suhbatdoshga +1, Menga o'zgarishsiz (yoki 0)
             [`unreadCounts.${selectedUser.uid}`]: increment(1)
          });
      } 
      // Agar chat yangi bo'lsa -> SET qilamiz (Toza obyekt bilan)
      else {
          await setDoc(chatRef, {
             participants: [currentUser.uid, selectedUser.uid],
             lastMessage: newMessage,
             lastUpdated: serverTimestamp(),
             unreadCounts: {
                 [selectedUser.uid]: 1, // Suhbatdoshda 1 ta o'qilmagan
                 [currentUser.uid]: 0   // Menda 0 ta
             }
          });
      }

      // Xabarni qo'shish
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: newMessage,
        senderId: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      setNewMessage("");
    } catch (error) { 
        console.error("Send Error:", error); 
        alert("Xabar yuborishda xatolik: " + error.message);
    }
  };

  // 5. DELETE
  const handleDeleteMessage = async (messageId) => {
    if(!window.confirm("Xabarni o'chirasizmi?")) return;
    const chatId = currentUser.uid > selectedUser.uid 
      ? `${currentUser.uid}_${selectedUser.uid}` 
      : `${selectedUser.uid}_${currentUser.uid}`;
    try { await deleteDoc(doc(db, "chats", chatId, "messages", messageId)); } catch (error) {}
  };

  const groupedMessages = messages.reduce((groups, message) => {
    const dateKey = formatDateGroup(message.createdAt);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(message);
    return groups;
  }, {});

  if (loading) return <div className="h-[100dvh] flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600"/></div>;

  return (
    <div className="fixed inset-0 z-[100] bg-white md:static md:z-0 md:bg-transparent md:h-[calc(100vh-2rem)] md:p-4 font-sans">
      <div className="flex h-full w-full bg-slate-100 md:rounded-[2rem] md:overflow-hidden md:shadow-2xl md:border md:border-slate-200">
        
        {/* SIDEBAR */}
        <div className={`w-full md:w-80 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ${selectedUser ? '-translate-x-full md:translate-x-0 absolute md:relative w-full h-full z-10' : 'translate-x-0'}`}>
          <div className="p-4 bg-slate-50 border-b border-slate-100 pt-[calc(1rem+env(safe-area-inset-top))] md:pt-4">
             <div className="flex justify-between items-center mb-3">
                <h2 className="font-black text-xl text-slate-800 tracking-tight">Chatlar</h2>
                <button onClick={() => window.history.back()} className="md:hidden p-2 bg-slate-200 rounded-full text-slate-600"><ArrowLeft size={18}/></button>
             </div>
             <div className="relative group">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
               <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Qidirish..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all shadow-sm"/>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 md:pb-0">
            {filteredUsers.length === 0 ? <div className="p-10 text-center opacity-50"><User size={40} className="mb-2 text-slate-300 mx-auto"/><p className="text-sm font-bold text-slate-400">Bo'sh</p></div> : 
              filteredUsers.map(user => (
                <div key={user.uid} onClick={() => setSelectedUser(user)} className={`flex items-center gap-3 p-4 cursor-pointer transition-all border-b border-slate-50 hover:bg-slate-50 active:bg-slate-100 ${selectedUser?.uid === user.uid ? 'bg-indigo-50 border-indigo-100' : ''}`}>
                  <div className="relative">
                     <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold text-lg shadow-sm border border-white">{user.name?.charAt(0)}</div>
                     {user.unread > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white animate-pulse">{user.unread}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-center mb-0.5">
                        <h4 className={`font-bold text-sm truncate ${user.unread > 0 ? 'text-slate-900' : 'text-slate-700'}`}>{user.name}</h4>
                        <span className={`text-[10px] font-medium ${user.unread > 0 ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>{user.lastUpdated ? new Date(user.lastUpdated * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                     </div>
                     <p className={`text-xs truncate font-medium flex items-center gap-1 ${user.unread > 0 ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>
                        {user.lastMessage || <span className="italic opacity-50">Suhbatni boshlang...</span>}
                     </p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* CHAT AREA */}
        <div className={`flex-1 flex flex-col bg-[#eef2f6] relative transition-transform duration-300 w-full h-full ${selectedUser ? 'translate-x-0 absolute md:relative z-20' : 'translate-x-full md:translate-x-0 hidden md:flex'}`}>
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          {selectedUser ? (
            <>
              <div className="bg-white/80 backdrop-blur-md p-3 border-b border-slate-200 flex items-center justify-between shadow-sm z-30 pt-[calc(0.8rem+env(safe-area-inset-top))] md:pt-3">
                 <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedUser(null)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-full"><ArrowLeft size={22}/></button>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white">{selectedUser.name?.charAt(0)}</div>
                    <div><h3 className="font-black text-slate-800 text-sm leading-tight">{selectedUser.name}</h3><p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">Online</p></div>
                 </div>
                 <div className="flex gap-2 text-slate-400"><button className="p-2 hover:bg-slate-100 rounded-full"><Phone size={20}/></button><button className="p-2 hover:bg-slate-100 rounded-full"><MoreVertical size={20}/></button></div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6 z-10 custom-scrollbar pb-32">
                 {messages.length === 0 && <div className="text-center mt-20 opacity-50"><div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4"><Send size={40} className="text-indigo-300 ml-1"/></div><p className="text-sm font-bold text-slate-500">Suhbatni boshlang!</p></div>}
                 {Object.keys(groupedMessages).map((dateKey) => (
                   <div key={dateKey}>
                      <div className="flex justify-center mb-4 sticky top-0 z-10"><span className="bg-slate-200/80 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-slate-600 shadow-sm border border-white/50">{dateKey}</span></div>
                      <div className="space-y-1">
                        {groupedMessages[dateKey].map((msg) => {
                          const isMe = msg.senderId === currentUser.uid;
                          return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-1 relative`}>
                                {isMe && <button onClick={() => handleDeleteMessage(msg.id)} className="hidden group-hover:flex items-center justify-center p-1.5 mr-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full" title="O'chirish"><Trash2 size={14}/></button>}
                                <div className={`max-w-[75%] md:max-w-[60%] px-4 py-2 rounded-2xl text-sm shadow-sm relative transition-all ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 rounded-bl-none'}`}>
                                  <p className="leading-relaxed break-words whitespace-pre-wrap">{msg.text}</p>
                                  <div className={`flex items-center justify-end gap-1 mt-1 -mb-1 ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}><span className="text-[9px] font-medium">{formatTime(msg.createdAt)}</span>{isMe && <CheckCheck size={12} className="opacity-80"/>}</div>
                                </div>
                            </div>
                          )
                        })}
                      </div>
                   </div>
                 ))}
                 <div ref={scrollRef}></div>
              </div>

              <div className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-200 p-3 pb-[calc(2rem+env(safe-area-inset-bottom))] md:pb-3 z-20 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)]">
                 <form onSubmit={handleSendMessage} className="flex gap-2 items-end max-w-4xl mx-auto">
                    <button type="button" className="p-3 text-slate-400 hover:text-indigo-500 hover:bg-slate-50 rounded-full"><Paperclip size={20}/></button>
                    <div className="flex-1 bg-slate-100 rounded-2xl flex items-center border border-transparent focus-within:border-indigo-300 focus-within:bg-white transition-all px-2">
                        <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 bg-transparent px-2 py-3.5 text-sm outline-none placeholder:text-slate-400 font-medium" placeholder="Xabar yozing..."/>
                        <button type="button" className="p-2 text-slate-400 hover:text-amber-500"><Smile size={20}/></button>
                    </div>
                    <button type="submit" disabled={!newMessage.trim()} className="p-3.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 active:scale-95 shadow-lg shadow-indigo-200"><Send size={20} className={newMessage.trim() ? "ml-0.5" : ""}/></button>
                 </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 z-10 bg-[#F8FAFC]">
               <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-slate-100"><div className="bg-gradient-to-tr from-indigo-500 to-purple-600 w-24 h-24 rounded-full flex items-center justify-center"><User size={48} className="text-white"/></div></div>
               <h3 className="text-2xl font-black text-slate-700 mb-2">Xabarlar</h3>
               <p className="text-sm font-medium text-slate-400 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">Suhbatlashish uchun kishini tanlang</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;