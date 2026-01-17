import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  AlertCircle, 
  LogOut, 
  Gamepad2, 
  User,
  MessageCircle,
  Home,
  PieChart
} from 'lucide-react'; 
import { auth, db } from '../firebase'; 
import { signOut } from 'firebase/auth'; 
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const MobileNavbar = ({ role }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  // 1. O'qilmagan xabarlar
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "chats"), 
      where("participants", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let total = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.unreadCounts && data.unreadCounts[user.uid]) {
          total += data.unreadCounts[user.uid];
        }
      });
      setUnreadCount(total);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (navigator.vibrate) navigator.vibrate(10); // Haptic feedback
    if (window.confirm("Tizimdan chiqmoqchimisiz?")) {
      await signOut(auth);
      navigate('/login');
    }
  };

  // --- MENU ITEMS ---
  const teacherNavItems = [
    { path: '/', icon: LayoutDashboard, label: 'Guruhlar' }, 
    { path: '/assignments', icon: BookOpen, label: 'Vazifalar' },
    { path: '/chat', icon: MessageCircle, label: 'Chat', isChat: true },
    { path: '/debtors', icon: AlertCircle, label: 'Qarzdor' },
  ];

  const studentNavItems = [
    { path: '/', icon: Home, label: 'Asosiy' },
    { path: '/chat', icon: MessageCircle, label: 'Chat', isChat: true },
    { path: '/games', icon: Gamepad2, label: 'O\'yinlar' },
    { path: '/settings', icon: User, label: 'Profil' },
  ];

  // Role bo'yicha menyuni tanlash
  const baseItems = role === 'student' ? studentNavItems : teacherNavItems;

  // Logoutni ham menyu qatoriga qo'shamiz (Animatsiya uchun)
  const allItems = [
    ...baseItems,
    { path: 'logout', icon: LogOut, label: 'Chiqish', isAction: true }
  ];

  // Hozirgi aktiv tabni aniqlash
  const activeIndex = allItems.findIndex(item => item.path === location.pathname);
  
  // Agar sahifa topilmasa (masalan, ichki sahifalar), birinchi elementni aktiv qilmaslik uchun -1 yoki 0
  // Lekin vizual chiroyli bo'lishi uchun, agar topilmasa indikator ko'rinmasligi mumkin.
  // Hozircha oddiylik uchun: topilmasa default holatda qoladi.

  // Chat sahifasida navbar ko'rinmaydi
  if (location.pathname === '/chat') {
    return null;
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-[999] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
      
      <div className="relative flex justify-between items-center px-2 py-2">
          
          {/* 🔥 SUZUVCHI ORQA FON (INDICATOR) */}
          {/* Faqat activeIndex >= 0 bo'lsa ko'rinadi */}
          {activeIndex !== -1 && (
            <div 
              className="absolute top-0 h-full transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)"
              style={{ 
                width: `${100 / allItems.length}%`, // Elementlar soniga qarab bo'linadi (20%)
                left: `${activeIndex * (100 / allItems.length)}%` 
              }}
            >
               <div className="w-12 h-full mx-auto relative">
                  {/* Tepadagi chiziqcha */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 rounded-b-full shadow-[0_0_10px_rgba(79,70,229,0.6)]"></div>
                  {/* Rangli fon */}
                  <div className="w-full h-full bg-gradient-to-b from-indigo-50 to-transparent rounded-b-2xl opacity-80"></div>
               </div>
            </div>
          )}

          {/* --- TUGMALAR --- */}
          {allItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            // Agar bu Logout tugmasi bo'lsa
            if (item.isAction) {
                return (
                    <button 
                        key={index}
                        onClick={handleLogout}
                        className="relative flex-1 flex flex-col items-center justify-center py-2 z-10 group"
                    >
                        <div className="transition-all duration-300 ease-out text-slate-400 group-hover:text-red-500">
                            <Icon size={24} strokeWidth={2} />
                        </div>
                        <span className="text-[9px] font-bold transition-all duration-300 absolute bottom-1 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 text-red-500">
                            {item.label}
                        </span>
                    </button>
                );
            }

            return (
              <Link 
                key={index}
                to={item.path}
                className="relative flex-1 flex flex-col items-center justify-center py-2 z-10 group"
                onClick={() => { if(navigator.vibrate) navigator.vibrate(10); }}
              >
                <div className={`transition-all duration-300 ease-out ${isActive ? '-translate-y-1.5 scale-110 text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'drop-shadow-sm' : ''} />
                  
                  {/* Chat uchun qizil nuqta */}
                  {item.isChat && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse shadow-sm"></span>
                  )}
                </div>
                
                <span className={`text-[9px] font-bold transition-all duration-300 absolute bottom-1 ${isActive ? 'opacity-100 translate-y-0 text-indigo-600' : 'opacity-0 translate-y-2 text-slate-400'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
      </div>
    </div>
  );
};

export default MobileNavbar;