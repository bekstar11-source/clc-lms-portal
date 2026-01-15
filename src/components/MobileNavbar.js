import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
// 🔥 BarChart3 ni olib tashlab, AlertCircle (Qarzdorlar uchun) qo'shdik
import { LayoutDashboard, BookOpen, AlertCircle, LogOut } from 'lucide-react'; 
import { auth } from '../firebase'; 
import { signOut } from 'firebase/auth'; 

const MobileNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (window.confirm("Tizimdan chiqmoqchimisiz?")) {
      await signOut(auth);
      navigate('/login');
    }
  };

  const navItems = [
    { 
      path: '/', 
      icon: <LayoutDashboard size={20} />, 
      label: 'Guruhlar' 
    }, 
    { 
      path: '/assignments', 
      icon: <BookOpen size={20} />, 
      label: 'Vazifalar' 
    },
    // 🔥 O'ZGARISH SHU YERDA: Jurnal -> Qarzdorlar
    { 
      path: '/debtors', 
      icon: <AlertCircle size={20} />, 
      label: 'Qarzdorlar' 
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 md:hidden z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex justify-between items-center max-w-sm mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          // 🔥 Qarzdorlar tugmasi aktiv bo'lganda qizilroq, boshqalari indigo bo'lishi uchun mantiq
          const isDebtorTab = item.path === '/debtors';
          const activeBg = isDebtorTab ? 'bg-red-500 shadow-red-200' : 'bg-indigo-600 shadow-indigo-200';
          const activeText = isDebtorTab ? 'text-red-500' : 'text-indigo-600';

          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className="flex flex-col items-center gap-1 p-2 min-w-[64px]"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? `${activeBg} text-white shadow-lg translate-y-[-4px]` : 'text-slate-400'}`}>
                {item.icon}
              </div>
              <span className={`text-[9px] font-bold tracking-wide ${isActive ? activeText : 'text-slate-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* LOGOUT TUGMASI */}
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