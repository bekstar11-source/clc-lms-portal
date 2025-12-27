import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, BookOpen, BarChart3, User } from 'lucide-react';

const MobileNavbar = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: <LayoutDashboard size={24} />, label: 'Asosiy' },
    { path: '/assignments', icon: <BookOpen size={24} />, label: 'Vazifalar' },
    { path: '/grading', icon: <BarChart3 size={24} />, label: 'Jurnal' },
    // Agar o'quvchi bo'lsa, /profile yoki boshqa link bo'lishi mumkin
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 md:hidden z-50 pb-safe">
      <div className="flex justify-between items-center">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className="flex flex-col items-center gap-1 transition-all"
            >
              <div className={`p-2 rounded-2xl transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400'}`}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-bold ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
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