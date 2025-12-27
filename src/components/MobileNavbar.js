import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, BarChart3, LogOut } from 'lucide-react'; // LogOut import qilindi
import { auth } from '../firebase'; // Auth kerak
import { signOut } from 'firebase/auth'; // signOut kerak

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
    { path: '/', icon: <LayoutDashboard size={20} />, label: 'Guruhlar' }, // Iconlar kichraytirildi (20px)
    { path: '/assignments', icon: <BookOpen size={20} />, label: 'Vazifalar' },
    { path: '/grading', icon: <BarChart3 size={20} />, label: 'Jurnal' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 md:hidden z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex justify-between items-center max-w-sm mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className="flex flex-col items-center gap-1 p-2 min-w-[64px]"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 translate-y-[-4px]' : 'text-slate-400'}`}>
                {item.icon}
              </div>
              <span className={`text-[9px] font-bold tracking-wide ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
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