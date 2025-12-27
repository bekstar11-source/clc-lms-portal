import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { 
  LayoutDashboard, Users, BookOpen, 
  BarChart3, Settings, LogOut, Sparkles 
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (window.confirm("Tizimdan chiqmoqchimisiz?")) {
      await signOut(auth);
      navigate('/login');
    }
  };

  const menuItems = [
    { path: '/', icon: <LayoutDashboard size={20} />, label: 'Guruhlar' },
    { path: '/assignments', icon: <BookOpen size={20} />, label: 'Vazifalar' },
    { path: '/grading', icon: <BarChart3 size={20} />, label: 'Baholash' },
    { path: '/settings', icon: <Settings size={20} />, label: 'Sozlamalar' },
  ];

  return (
    <div className="w-72 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0 hidden md:flex">
      {/* CLC BRANDING LOGO */}
      <div className="p-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl font-black italic shadow-lg shadow-indigo-100">
            CLC
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 leading-none">Academy</h1>
            <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-1">LMS Portal</p>
          </div>
        </div>
      </div>

      {/* NAVIGATION MENU */}
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center space-x-3 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
              location.pathname === item.path
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100'
                : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* DEVELOPER SECTION */}
      <div className="p-6 mt-auto">
        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 relative overflow-hidden">
          <Sparkles className="absolute right-[-10px] top-[-10px] text-indigo-200 opacity-50" size={40} />
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">System Founder</p>
          <p className="text-sm font-black text-slate-800">Aslbek Juraboev</p>
          
          <button 
            onClick={handleLogout}
            className="w-full mt-6 flex items-center justify-center space-x-2 py-3 bg-white text-red-500 border border-red-50 rounded-xl font-black text-[10px] uppercase hover:bg-red-50 transition-all"
          >
            <LogOut size={14} />
            <span>Chiqish</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;