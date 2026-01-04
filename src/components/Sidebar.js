import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, LogOut, ShieldCheck, 
  Settings, ClipboardList, GraduationCap, Sparkles 
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const Sidebar = ({ role }) => {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState('O\'qituvchi');
  const [avatarSeed, setAvatarSeed] = useState('clc');

  // O'qituvchi ismini yuklash
  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const docRef = doc(db, "students", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setTeacherName(docSnap.data().name || 'Ustoz');
            setAvatarSeed(docSnap.data().name || 'clc');
          }
        } catch (e) { console.error(e); }
      }
    };
    fetchUserData();
  }, []);

  const handleLogout = async () => {
    if(window.confirm("Tizimdan chiqmoqchimisiz?")) {
      await signOut(auth);
      navigate('/login');
    }
  };

  // Avatar uchun URL
  const avatarUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${avatarSeed}&backgroundColor=c0aede,d1d4f9,b6e3f4`;

  // Link stillari (Zerikarli qoradan voz kechdik)
  const activeLink = "relative flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 transition-all scale-105";
  const normalLink = "flex items-center gap-3 px-4 py-3.5 rounded-2xl text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all font-medium";

  return (
    <div className="hidden md:flex w-72 bg-white border-r border-slate-100 flex-col fixed h-screen z-50 shadow-2xl shadow-slate-200/50">
      
      {/* 1. LOGO QISMI (CLC) */}
      <div className="h-28 flex flex-col justify-center px-8 border-b border-dashed border-slate-100">
        <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 rotate-3">
                <Sparkles size={20} fill="currentColor"/>
            </div>
            <span className="font-black text-3xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                CLC
            </span>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 pl-1">Learning Center</p>
      </div>

      {/* 2. MENU LINKLAR */}
      <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
        
        {role === 'admin' && (
          <div className="mb-6">
            <p className="px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Admin Zone</p>
            <NavLink to="/admin" className={({ isActive }) => isActive ? "flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-800 text-white shadow-xl" : normalLink}>
              <ShieldCheck size={20} />
              <span className="font-bold text-xs uppercase tracking-wide">Boshqaruv</span>
            </NavLink>
          </div>
        )}

        {(role === 'teacher' || role === 'admin') && (
          <div className="space-y-2">
            <p className="px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 mt-2">Menu</p>
            
            <NavLink to={role === 'admin' ? "/groups" : "/"} className={({ isActive }) => (isActive && role !== 'admin') ? activeLink : normalLink}>
              <LayoutDashboard size={20} />
              <span className="font-bold text-xs uppercase tracking-wide">Guruhlarim</span>
            </NavLink>

            <NavLink to="/assignments" className={({ isActive }) => isActive ? activeLink : normalLink}> 
              <ClipboardList size={20} />
              <span className="font-bold text-xs uppercase tracking-wide">Vazifalar</span>
            </NavLink>

            {role === 'teacher' && (
              <NavLink to="/grading" className={({ isActive }) => isActive ? activeLink : normalLink}>
                <GraduationCap size={20} />
                <span className="font-bold text-xs uppercase tracking-wide">Baholash</span>
              </NavLink>
            )}
          </div>
        )}

        <div className="pt-6 mt-6 border-t border-dashed border-slate-100 space-y-2">
            <NavLink to="/settings" className={({ isActive }) => isActive ? "flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-100 text-slate-800 font-bold" : normalLink}>
              <Settings size={20} />
              <span className="font-bold text-xs uppercase tracking-wide">Sozlamalar</span>
            </NavLink>
        </div>
      </nav>

      {/* 3. USER PROFILE (PASTDA) */}
      <div className="p-4 m-4 bg-slate-50 rounded-2xl border border-slate-100">
        <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 overflow-hidden shrink-0">
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover"/>
            </div>
            <div className="overflow-hidden">
                <p className="text-sm font-black text-slate-700 truncate">{teacherName}</p>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">O'qituvchi</p>
            </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 rounded-xl transition-all text-xs font-black uppercase tracking-wide">
          <LogOut size={14} /> Chiqish
        </button>
      </div>

    </div>
  );
};

export default Sidebar;