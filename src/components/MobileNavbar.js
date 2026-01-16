import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  AlertCircle, 
  LogOut, 
  Gamepad2, 
  User,
  MessageCircle 
} from 'lucide-react'; 
import { auth, db } from '../firebase'; 
import { signOut } from 'firebase/auth'; 
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const MobileNavbar = ({ role }) => {
  // 1. HOOKLAR TEPADA BO'LISHI SHART
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  // 2. useEffect ni tepaga oldik (shartdan oldin ishlashi kerak)
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
    if (window.confirm("Tizimdan chiqmoqchimisiz?")) {
      await signOut(auth);
      navigate('/login');
    }
  };

  // MENU ITEMS
  const teacherNavItems = [
    { path: '/', icon: <LayoutDashboard size={20} />, label: 'Guruhlar' }, 
    { path: '/chat', icon: <MessageCircle size={20} />, label: 'Xabarlar', isChat: true },
    { path: '/debtors', icon: <AlertCircle size={20} />, label: 'Qarzdorlar' },
  ];

  const studentNavItems = [
    { path: '/', icon: <LayoutDashboard size={20} />, label: 'Asosiy' },
    { path: '/chat', icon: <MessageCircle size={20} />, label: 'Chat', isChat: true },
    { path: '/games', icon: <Gamepad2 size={20} />, label: 'O\'yinlar' },
    { path: '/settings', icon: <User size={20} />, label: 'Profil' },
  ];

  const navItems = role === 'student' ? studentNavItems : teacherNavItems;

  // 🔥 MUHIM TUZATISH: Shartni HOOKLARDAN KEYINGA qo'ydik
  // Agar Chat sahifasida bo'lsak, Navbar ko'rinmaydi
  if (location.pathname === '/chat') {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 md:hidden z-[999] pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex justify-between items-center max-w-sm mx-auto">
        
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          let activeBg = 'bg-indigo-600 shadow-indigo-200';
          let activeText = 'text-indigo-600';

          if (item.path === '/debtors') {
            activeBg = 'bg-rose-500 shadow-rose-200';
            activeText = 'text-rose-500';
          } else if (item.path === '/games') {
            activeBg = 'bg-purple-600 shadow-purple-200';
            activeText = 'text-purple-600';
          }

          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className="flex flex-col items-center gap-1 p-2 min-w-[64px] relative group"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 relative ${isActive ? `${activeBg} text-white shadow-lg translate-y-[-4px]` : 'text-slate-400 group-hover:bg-slate-50'}`}>
                {item.icon}
                
                {/* Alert Badge */}
                {item.isChat && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white animate-pulse shadow-sm">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              
              <span className={`text-[9px] font-bold tracking-wide transition-colors ${isActive ? activeText : 'text-slate-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Logout */}
        <button 
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 p-2 min-w-[64px] group"
        >
          <div className="p-1.5 rounded-xl text-slate-400 group-hover:bg-red-50 group-hover:text-red-500 transition-all">
            <LogOut size={20} />
          </div>
          <span className="text-[9px] font-bold text-slate-400 group-hover:text-red-500 tracking-wide">
            Chiqish
          </span>
        </button>
      </div>
    </div>
  );
};

export default MobileNavbar;