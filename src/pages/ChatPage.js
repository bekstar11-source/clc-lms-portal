import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, query, where, getDocs, doc, getDoc, 
  addDoc, serverTimestamp, onSnapshot, orderBy, setDoc, updateDoc, increment 
} from 'firebase/firestore';
import { 
  Send, Search, ArrowLeft, MoreVertical, 
  Phone, Paperclip, Smile, CheckCheck, Check 
} from 'lucide-react';

// --- STYLES (Custom Scrollbar & Background) ---
const styles = `
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(0, 0, 0, 0.1); border-radius: 20px; }
  .chat-background { background-color: #f0f2f5; background-image: radial-gradient(#e5e7eb 1px, transparent 1px); background-size: 20px 20px; }
  .glass-header { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); }
  @keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
  }
  .animate-shimmer {
    animation: shimmer 2s infinite linear;
    background: linear-gradient(to right, #f3f4f6 4%, #e5e7eb 25%, #f3f4f6 36%);
    background-size: 1000px 100%;
  }
`;

// --- SKELETON LOADER COMPONENT ---
const ChatListSkeleton = () => (
  <div className="space-y-4 p-4 animate-in fade-in duration-500">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full animate-shimmer shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded animate-shimmer"></div>
          <div className="h-3 w-1/2 rounded animate-shimmer"></div>
        </div>
      </div>
    ))}
  </div>
);

// --- YORDAMCHI FUNKSIYALAR ---
const formatTime = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return "";
  return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getDateLabel = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return "Yangi";
  const date = timestamp.toDate();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return "Bugun";
  if (date.toDateString() === yesterday.toDateString()) return "Kecha";
  
  return date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long' });
};

const ChatPage = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]); 
  const [filteredUsers, setFilteredUsers] = useState([]); 
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]); 
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true); // Loading State
  
  const scrollRef = useRef();

  // 1. INIT & USERS LOADING
  useEffect(() => {
    let unsubscribe = null;

    const init = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, "students", user.uid));
        const userData = userDoc.exists() 
            ? { ...userDoc.data(), uid: user.uid } 
            : { uid: user.uid, role: 'student' };
        
        setCurrentUser(userData);

        let qUsers;
        if (userData.role === 'student') {
            qUsers = query(collection(db, "students"), where("role", "in", ["teacher", "admin"]));
        } else {
            qUsers = query(collection(db, "students"), where("role", "==", "student"));
        }

        const snapUsers = await getDocs(qUsers);
        const contactList = snapUsers.docs.map(d => ({ uid: d.id, ...d.data() }));

        if (contactList.length === 0) {
            setUsers([]);
            setFilteredUsers([]);
            setLoading(false);
            return;
        }

        const qChats = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
        
        unsubscribe = onSnapshot(qChats, (snapshot) => {
            const chatsData = {};
            snapshot.docs.forEach(doc => chatsData[doc.id] = doc.data());

            const detailedUsers = contactList.map(contact => {
                const chatId = user.uid > contact.uid 
                    ? `${user.uid}_${contact.uid}` 
                    : `${contact.uid}_${user.uid}`;
                
                const chat = chatsData[chatId];
                return {
                    ...contact,
                    name: contact.name || contact.email || (contact.role === 'teacher' ? "O'qituvchi" : "Admin"),
                    lastMessage: chat?.lastMessage || "",
                    lastUpdated: chat?.lastUpdated?.seconds || 0,
                    unread: chat?.unreadCounts?.[user.uid] || 0
                };
            });

            detailedUsers.sort((a, b) => b.lastUpdated - a.lastUpdated);
            setUsers(detailedUsers);
            setFilteredUsers(detailedUsers);
            // Biroz sun'iy kechikish qo'shamiz (skeleton chiroyli ko'rinishi uchun)
            setTimeout(() => setLoading(false), 800);
        });

      } catch (err) {
          console.error("Xatolik:", err);
          setLoading(false);
      }
    };

    init();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // 2. SEARCH
  useEffect(() => {
    if (searchQuery.trim() === "") {
        setFilteredUsers(users);
    } else {
        const lower = searchQuery.toLowerCase();
        setFilteredUsers(users.filter(u => u.name?.toLowerCase().includes(lower)));
    }
  }, [searchQuery, users]);

  // 3. LOAD CHAT
  useEffect(() => {
    if (!selectedUser || !currentUser) return;

    const chatId = currentUser.uid > selectedUser.uid 
      ? `${currentUser.uid}_${selectedUser.uid}` 
      : `${selectedUser.uid}_${currentUser.uid}`;

    const markRead = async () => {
        try {
            const chatRef = doc(db, "chats", chatId);
            const snap = await getDoc(chatRef);
            if(snap.exists()) {
                await updateDoc(chatRef, { [`unreadCounts.${currentUser.uid}`]: 0 });
            }
        } catch(e) {}
    };
    markRead();

    const qMessages = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(qMessages, (snap) => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMessages(msgs);
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsub();
  }, [selectedUser, currentUser]);

  // 4. SEND MESSAGE
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    const chatId = currentUser.uid > selectedUser.uid 
      ? `${currentUser.uid}_${selectedUser.uid}` 
      : `${selectedUser.uid}_${currentUser.uid}`;

    try {
        const chatRef = doc(db, "chats", chatId);
        const chatSnap = await getDoc(chatRef);

        const msgData = {
            lastMessage: newMessage,
            lastUpdated: serverTimestamp(),
            [`unreadCounts.${selectedUser.uid}`]: increment(1)
        };

        if (chatSnap.exists()) {
            await updateDoc(chatRef, msgData);
        } else {
            await setDoc(chatRef, {
                participants: [currentUser.uid, selectedUser.uid],
                ...msgData,
                unreadCounts: { [selectedUser.uid]: 1, [currentUser.uid]: 0 }
            });
        }

        await addDoc(collection(db, "chats", chatId, "messages"), {
            text: newMessage,
            senderId: currentUser.uid,
            createdAt: serverTimestamp(),
        });
        setNewMessage("");
    } catch (err) { console.error(err); }
  };

  // UI HELPERS
  const getAvatarGradient = (name) => {
    const gradients = [
      'from-blue-400 to-blue-600',
      'from-emerald-400 to-emerald-600',
      'from-orange-400 to-orange-600',
      'from-purple-400 to-purple-600',
      'from-pink-400 to-pink-600',
    ];
    const index = name ? name.charCodeAt(0) % gradients.length : 0;
    return `bg-gradient-to-br ${gradients[index]}`;
  };

  return (
    <>
      <style>{styles}</style>
      <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
        
        {/* --- SIDEBAR --- */}
        <div className={`
          w-full md:w-[350px] lg:w-[400px] flex flex-col bg-white border-r border-gray-200 
          transition-transform duration-300 z-30
          ${selectedUser ? 'hidden md:flex' : 'flex'}
        `}>
          
          {/* Sidebar Header */}
          <div className="px-4 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
             <h1 className="text-2xl font-bold text-gray-800 mb-4 px-1">Xabarlar</h1>
             <div className="relative group">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20}/>
               <input 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="Qidirish..." 
                 className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-transparent rounded-xl text-sm outline-none 
                 focus:bg-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all"
               />
             </div>
          </div>

          {/* User List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
             {loading ? (
               <ChatListSkeleton /> // 🔥 SKELETON LOADER
             ) : filteredUsers.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm animate-in fade-in zoom-in-95 duration-300">
                 <Search size={40} className="mb-2 opacity-20"/>
                 Foydalanuvchilar topilmadi
               </div>
             ) : (
               filteredUsers.map(user => (
                 <div 
                   key={user.uid} 
                   onClick={() => setSelectedUser(user)}
                   className={`
                     group flex items-center gap-3 px-3 py-3 mb-1 rounded-xl cursor-pointer transition-all duration-200 animate-in fade-in slide-in-from-left-4
                     ${selectedUser?.uid === user.uid ? 'bg-blue-600 shadow-md transform scale-[1.02]' : 'hover:bg-gray-100'}
                   `}
                 >
                   {/* Avatar */}
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0 ${getAvatarGradient(user.name)}`}>
                      {user.name?.charAt(0)}
                   </div>
                   
                   {/* Info */}
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                         <h4 className={`font-semibold truncate text-base ${selectedUser?.uid === user.uid ? 'text-white' : 'text-gray-900'}`}>
                           {user.name}
                         </h4>
                         {user.lastUpdated > 0 && (
                           <span className={`text-xs font-medium ${selectedUser?.uid === user.uid ? 'text-blue-200' : 'text-gray-400'}`}>
                             {new Date(user.lastUpdated * 1000).getHours()}:{String(new Date(user.lastUpdated * 1000).getMinutes()).padStart(2, '0')}
                           </span>
                         )}
                      </div>
                      <div className="flex justify-between items-center">
                         <p className={`text-sm truncate pr-2 ${selectedUser?.uid === user.uid ? 'text-blue-100' : 'text-gray-500'}`}>
                           {user.lastMessage || "Yangi suhbat boshlash"}
                         </p>
                         {user.unread > 0 && (
                           <div className={`
                             text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-sm
                             ${selectedUser?.uid === user.uid ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}
                           `}>
                             {user.unread}
                           </div>
                         )}
                      </div>
                   </div>
                 </div>
               ))
             )}
          </div>
        </div>

        {/* --- MAIN CHAT WINDOW --- */}
        <div className={`flex-1 flex flex-col relative ${!selectedUser ? 'hidden md:flex' : 'flex'} h-full bg-[#f8fafc]`}>
          
          {selectedUser ? (
            <>
              {/* Chat Background Layer */}
              <div className="absolute inset-0 chat-background opacity-60 pointer-events-none"></div>

              {/* Chat Header */}
              <div className="glass-header px-4 py-3 flex items-center justify-between shadow-sm z-20 border-b border-gray-200/50">
                 <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedUser(null)}>
                    <button className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
                      <ArrowLeft size={20} />
                    </button>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${getAvatarGradient(selectedUser.name)}`}>
                      {selectedUser.name?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 leading-none mb-1 text-base">{selectedUser.name}</h3>
                      <p className="text-xs text-green-500 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>Online</p>
                    </div>
                 </div>
                 <div className="flex gap-2 text-gray-500">
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-colors"><Phone size={20}/></button>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-colors"><MoreVertical size={20}/></button>
                 </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 z-10 custom-scrollbar scroll-smooth">
                 {messages.map((msg, index) => {
                   const isMe = msg.senderId === currentUser.uid;
                   const showDate = index === 0 || getDateLabel(messages[index-1].createdAt) !== getDateLabel(msg.createdAt);
                   
                   return (
                     <div key={msg.id} className="w-full">
                        {/* Date Divider */}
                        {showDate && (
                          <div className="flex justify-center my-6 sticky top-2 z-30 opacity-90">
                             <span className="bg-gray-200/80 backdrop-blur text-gray-600 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                               {getDateLabel(msg.createdAt)}
                             </span>
                          </div>
                        )}

                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2 group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                           <div className={`
                              relative max-w-[85%] sm:max-w-[65%] px-4 py-2 text-[15px] shadow-sm transition-all
                              ${isMe 
                                ? 'bg-blue-600 text-white rounded-[20px] rounded-tr-[4px]' 
                                : 'bg-white text-gray-900 rounded-[20px] rounded-tl-[4px]'}
                           `}>
                              <p className="break-words leading-relaxed whitespace-pre-wrap pr-6">{msg.text}</p>
                              
                              {/* Time & Status */}
                              <div className={`float-right flex items-center gap-1 ml-3 mt-1 text-[10px] font-medium select-none ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                                 <span>{formatTime(msg.createdAt)}</span>
                                 {isMe && (
                                   msg.read ? <CheckCheck size={14} className="text-white"/> : <Check size={14} className="text-blue-200"/>
                                 )}
                              </div>
                           </div>
                        </div>
                     </div>
                   );
                 })}
                 <div ref={scrollRef} className="h-4"></div>
              </div>

              {/* Input Area */}
              <div className="p-3 z-20 bg-transparent">
                 <form onSubmit={handleSendMessage} className="flex items-end gap-2 max-w-4xl mx-auto bg-white p-2 rounded-[24px] shadow-lg border border-gray-200/50 transition-all focus-within:shadow-xl focus-within:border-blue-200">
                    <button type="button" className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
                        <Paperclip size={22}/>
                    </button>
                    
                    <input 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 bg-transparent py-3 max-h-32 text-gray-800 outline-none placeholder:text-gray-400 font-medium"
                      placeholder="Xabar yozing..."
                    />
                    
                    <button type="button" className="p-3 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-full transition-all">
                        <Smile size={22}/>
                    </button>

                    {newMessage.trim() && (
                      <button 
                        type="submit" 
                        className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-md hover:shadow-lg transform transition-all active:scale-95 animate-in zoom-in duration-200"
                      >
                        <Send size={20} className="ml-0.5"/>
                      </button>
                    )}
                 </form>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center z-10 select-none text-center p-6 bg-slate-50">
               <div className="bg-white p-8 rounded-full mb-6 shadow-sm border border-slate-100 animate-bounce-slow">
                  <div className="bg-blue-50 p-6 rounded-full">
                    <Send size={64} className="text-blue-500 ml-2"/>
                  </div>
               </div>
               <h3 className="text-2xl font-black text-slate-800 mb-2">Suhbatni tanlang</h3>
               <p className="text-slate-400 max-w-xs text-sm font-medium">
                 Chap tomondan foydalanuvchini tanlang va yozishmalarni boshlang.
               </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ChatPage;