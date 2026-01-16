import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, query, where, getDocs, doc, getDoc, 
  addDoc, serverTimestamp, onSnapshot, orderBy, setDoc, updateDoc, increment 
} from 'firebase/firestore';
import { 
  Send, Search, ArrowLeft, MoreVertical, 
  Phone, Paperclip, Smile, CheckCheck, Loader2 
} from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  
  const scrollRef = useRef();

  // 1. FOYDALANUVCHILARNI YUKLASH (ROLE BO'YICHA FILTRLASH)
  useEffect(() => {
    let unsubscribe = null;

    const init = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        // 1. Hozirgi foydalanuvchi ma'lumotlarini olish
        const userDoc = await getDoc(doc(db, "students", user.uid));
        
        // Agar user bazada bo'lmasa, default rol beramiz
        const userData = userDoc.exists() 
            ? { ...userDoc.data(), uid: user.uid } 
            : { uid: user.uid, role: 'student' }; // Default student deb faraz qilamiz
        
        setCurrentUser(userData);

        let qUsers;

        // 🔥 LOGIKA O'ZGARDI: KIM KIMNI KO'RADI?
        if (userData.role === 'student') {
            // ✅ O'QUVCHI: Faqat Teacher va Adminlarni ko'radi
            qUsers = query(
                collection(db, "students"), 
                where("role", "in", ["teacher", "admin"])
            );
        } else {
            // ✅ TEACHER/ADMIN: Faqat O'quvchilarni ko'radi
            qUsers = query(
                collection(db, "students"), 
                where("role", "==", "student")
            );
        }

        const snapUsers = await getDocs(qUsers);
        
        // Ro'yxatni shakllantiramiz (O'zini chiqarib tashlash shart emas, chunki rollar har xil)
        const contactList = snapUsers.docs.map(d => ({ uid: d.id, ...d.data() }));

        if (contactList.length === 0) {
            setUsers([]);
            setFilteredUsers([]);
            setLoading(false);
            return;
        }

        // 2. Real vaqtda chatlarni tinglash (Last Message & Unread uchun)
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
                    // Agar ismi bo'lmasa Email yoki Rolini chiqarish
                    name: contact.name || contact.email || (contact.role === 'teacher' ? "O'qituvchi" : "Admin"),
                    lastMessage: chat?.lastMessage || "",
                    lastUpdated: chat?.lastUpdated?.seconds || 0,
                    unread: chat?.unreadCounts?.[user.uid] || 0
                };
            });

            // Chatlashganlar (yangi xabar borlar) eng tepada turadi
            detailedUsers.sort((a, b) => b.lastUpdated - a.lastUpdated);
            
            setUsers(detailedUsers);
            setFilteredUsers(detailedUsers);
            setLoading(false);
        });

      } catch (err) {
          console.error("Xatolik:", err);
          setLoading(false);
      }
    };

    init();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // 2. Qidiruv
  useEffect(() => {
    if (searchQuery.trim() === "") {
        setFilteredUsers(users);
    } else {
        const lower = searchQuery.toLowerCase();
        setFilteredUsers(users.filter(u => u.name?.toLowerCase().includes(lower)));
    }
  }, [searchQuery, users]);

  // 3. Chat tanlanganda (Read qilish va Xabarlarni yuklash)
  useEffect(() => {
    if (!selectedUser || !currentUser) return;

    const chatId = currentUser.uid > selectedUser.uid 
      ? `${currentUser.uid}_${selectedUser.uid}` 
      : `${selectedUser.uid}_${currentUser.uid}`;

    // O'qilgan deb belgilash
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

    // Xabarlarni tinglash
    const qMessages = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(qMessages, (snap) => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMessages(msgs);
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsub();
  }, [selectedUser, currentUser]);

  // 4. Xabar yuborish
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    const chatId = currentUser.uid > selectedUser.uid 
      ? `${currentUser.uid}_${selectedUser.uid}` 
      : `${selectedUser.uid}_${currentUser.uid}`;

    try {
        const chatRef = doc(db, "chats", chatId);
        const chatSnap = await getDoc(chatRef);

        if (chatSnap.exists()) {
            await updateDoc(chatRef, {
                lastMessage: newMessage,
                lastUpdated: serverTimestamp(),
                [`unreadCounts.${selectedUser.uid}`]: increment(1)
            });
        } else {
            await setDoc(chatRef, {
                participants: [currentUser.uid, selectedUser.uid],
                lastMessage: newMessage,
                lastUpdated: serverTimestamp(),
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

  const getAvatarColor = (name) => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  if (loading) return <div className="h-[100dvh] flex items-center justify-center bg-[#ffffff]"><Loader2 className="animate-spin text-blue-500" size={40}/></div>;

  return (
    <div className="flex h-[100dvh] bg-white overflow-hidden fixed inset-0 font-sans">
      
      {/* --- SIDEBAR (CHATLAR RO'YXATI) --- */}
      <div className={`w-full md:w-80 lg:w-96 flex flex-col bg-white border-r border-gray-200 transition-transform duration-300 z-20 ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Header */}
        <div className="px-4 py-3 bg-white pt-[calc(1rem+env(safe-area-inset-top))]">
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
             <input 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder="Qidirish..." 
               className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-xl text-sm outline-none focus:bg-gray-50 focus:ring-2 focus:ring-blue-500/20 transition-all"
             />
           </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
           {filteredUsers.length === 0 ? (
             <div className="text-center mt-10 text-gray-400 text-sm">Foydalanuvchilar topilmadi</div>
           ) : (
             filteredUsers.map(user => (
               <div 
                 key={user.uid} 
                 onClick={() => setSelectedUser(user)}
                 className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedUser?.uid === user.uid ? 'bg-blue-50' : ''}`}
               >
                 <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 ${getAvatarColor(user.name)}`}>
                    {user.name?.charAt(0)}
                 </div>
                 <div className="flex-1 min-w-0 border-b border-gray-50 pb-3">
                    <div className="flex justify-between items-center mb-1">
                       <h4 className="font-semibold text-gray-900 truncate">{user.name}</h4>
                       {user.lastUpdated > 0 && <span className="text-xs text-gray-400 font-medium">{new Date(user.lastUpdated * 1000).getHours()}:{String(new Date(user.lastUpdated * 1000).getMinutes()).padStart(2, '0')}</span>}
                    </div>
                    <div className="flex justify-between items-center">
                       <p className="text-sm text-gray-500 truncate pr-2">{user.lastMessage || <span className="text-blue-500">Yangi suhbat</span>}</p>
                       {user.unread > 0 && (
                         <div className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm">
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
      <div className={`flex-1 flex flex-col bg-[#8EBCDC] relative ${!selectedUser ? 'hidden md:flex' : 'flex'} h-full`}>
        
        {/* TELEGRAM BACKGROUND PATTERN */}
        <div className="absolute inset-0 opacity-40 pointer-events-none" 
             style={{ backgroundImage: "url('https://web.telegram.org/img/bg_0.png')", backgroundSize: "cover" }}>
        </div>

        {selectedUser ? (
          <>
            {/* Header */}
            <div className="bg-white px-4 py-2 flex items-center justify-between shadow-sm z-10 pt-[calc(0.5rem+env(safe-area-inset-top))]">
               <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedUser(null)}>
                  <ArrowLeft className="text-gray-500 md:hidden" size={24} />
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${getAvatarColor(selectedUser.name)}`}>
                    {selectedUser.name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 leading-tight">{selectedUser.name}</h3>
                    <p className="text-xs text-blue-500 font-medium">online</p>
                  </div>
               </div>
               <div className="flex gap-4 text-gray-400">
                  <Phone className="hover:text-blue-500 cursor-pointer transition-colors" size={22}/>
                  <MoreVertical className="hover:text-blue-500 cursor-pointer transition-colors" size={22}/>
               </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 z-10 custom-scrollbar pb-24">
               {messages.map((msg, index) => {
                 const isMe = msg.senderId === currentUser.uid;
                 const showDate = index === 0 || getDateLabel(messages[index-1].createdAt) !== getDateLabel(msg.createdAt);
                 
                 return (
                   <div key={msg.id}>
                      {/* Date Divider */}
                      {showDate && (
                        <div className="flex justify-center my-4 sticky top-2 z-20">
                           <span className="bg-black/20 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm shadow-sm">
                             {getDateLabel(msg.createdAt)}
                           </span>
                        </div>
                      )}

                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1 group`}>
                         <div className={`relative max-w-[80%] sm:max-w-[70%] px-3 py-1.5 rounded-2xl text-[15px] shadow-sm
                            ${isMe 
                              ? 'bg-[#EEFFDE] text-black rounded-tr-none' 
                              : 'bg-white text-black rounded-tl-none'
                            }`}
                         >
                            <p className="break-words leading-snug whitespace-pre-wrap pr-8 pb-1">{msg.text}</p>
                            
                            {/* Time & Status */}
                            <div className="float-right flex items-center gap-1 ml-2 -mt-1 opacity-70 select-none">
                               <span className="text-[10px] font-medium text-gray-500">{formatTime(msg.createdAt)}</span>
                               {isMe && (
                                 <div className="text-blue-500">
                                   <CheckCheck size={14} strokeWidth={2.5}/>
                                 </div>
                               )}
                            </div>
                         </div>
                      </div>
                   </div>
                 );
               })}
               <div ref={scrollRef}></div>
            </div>

            {/* Input Area */}
            <div className="absolute bottom-0 left-0 w-full bg-white p-2 sm:p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] z-20">
               <form onSubmit={handleSendMessage} className="flex items-end gap-2 max-w-4xl mx-auto">
                  <button type="button" className="p-3 text-gray-400 hover:text-gray-600 transition-colors">
                      <Paperclip size={24}/>
                  </button>
                  
                  <div className="flex-1 bg-gray-100 rounded-2xl flex items-center px-3 py-1 border border-transparent focus-within:border-blue-400 focus-within:bg-white transition-all">
                      <input 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 bg-transparent py-3 text-base outline-none placeholder:text-gray-400"
                        placeholder="Xabar yozing..."
                      />
                      <button type="button" className="text-gray-400 hover:text-yellow-500 p-2">
                          <Smile size={24}/>
                      </button>
                  </div>

                  <button 
                    type="submit" 
                    disabled={!newMessage.trim()} 
                    className={`p-3 rounded-full transition-all duration-300 shadow-md flex items-center justify-center
                      ${newMessage.trim() 
                        ? 'bg-blue-500 text-white hover:bg-blue-600 scale-100 rotate-0' 
                        : 'bg-gray-100 text-blue-500 scale-90'}`}
                  >
                      <Send size={24} className={newMessage.trim() ? "ml-1" : ""}/>
                  </button>
               </form>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 z-10 select-none">
             <div className="bg-black/10 p-4 rounded-full mb-4">
                <span className="text-4xl">💬</span>
             </div>
             <p className="bg-black/20 text-white px-4 py-1 rounded-full text-sm backdrop-blur-sm">Chatni tanlang</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;