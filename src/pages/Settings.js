import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { updatePassword, updateProfile, signOut } from 'firebase/auth';
import { 
  User, Lock, Save, ShieldCheck, Mail, Settings as SettingsIcon, 
  Loader2, LogOut, ArrowLeft, Camera, CheckCircle2 
} from 'lucide-react';

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  
  const [name, setName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 1. Auth Listener (Safer than just checking auth.currentUser once)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setName(currentUser.displayName || '');
        setLoading(false);
      } else {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const getAvatarUrl = (seed) => {
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${seed || 'user'}&backgroundColor=e0e7ff,d1fae5,ffedd5`;
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Name Update
      if (name && name !== user.displayName) {
        await updateProfile(user, { displayName: name });
      }
      
      // Password Update 
      if (newPass) {
        if (newPass.length < 6) throw new Error("Parol juda qisqa (min 6 ta).");
        await updatePassword(user, newPass);
      }

      setMessage({ type: 'success', text: "Profil muvaffaqiyatli yangilandi!" });
      setNewPass('');
      // Hide message after 3 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      
    } catch (error) {
      console.error(error);
      let msg = "Xatolik yuz berdi.";
      if (error.code === 'auth/requires-recent-login') msg = "Xavfsizlik uchun: Iltimos, qayta tizimga kiring va urinib ko'ring.";
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleLogout = async () => {
    if(window.confirm("Tizimdan chiqmoqchimisiz?")) {
        await signOut(auth);
        navigate('/');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600"/></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans">
      
      {/* --- HEADER --- */}
      <div className="bg-white pt-6 pb-6 px-6 sticky top-0 z-40 border-b border-slate-200 shadow-sm flex items-center justify-between">
         <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-500 transition-colors md:hidden">
                <ArrowLeft size={20}/>
            </button>
            <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Sozlamalar</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account & Security</p>
            </div>
         </div>
         <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600 hidden md:block">
            <SettingsIcon size={24}/>
         </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* --- LEFT COLUMN (Profile Card) --- */}
        <div className="md:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm text-center relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-10"></div>
                
                <div className="relative inline-block mt-4 mb-4">
                    <div className="w-28 h-28 rounded-[2rem] bg-white p-1 shadow-xl border-4 border-white overflow-hidden mx-auto">
                        <img src={getAvatarUrl(name)} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2 rounded-xl shadow-lg border-4 border-white">
                        <Camera size={16} />
                    </div>
                </div>
                
                <h2 className="text-xl font-black text-slate-800">{name || "Foydalanuvchi"}</h2>
                <p className="text-xs font-bold text-slate-400 mb-6">{user.email}</p>
                
                <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2">
                    <ShieldCheck size={14}/> Verified Account
                </div>
            </div>

            {/* Logout Button (Mobile & Desktop) */}
            <button onClick={handleLogout} className="w-full bg-white border border-red-100 p-5 rounded-[2rem] flex items-center justify-between group hover:bg-red-50 transition-colors shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-red-50 text-red-500 p-2 rounded-full group-hover:bg-red-100 transition-colors">
                        <LogOut size={20} />
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold text-slate-700 group-hover:text-red-600 transition-colors">Tizimdan Chiqish</h4>
                        <p className="text-[10px] text-slate-400">Sessiyani yakunlash</p>
                    </div>
                </div>
            </button>
        </div>

        {/* --- RIGHT COLUMN (Form) --- */}
        <div className="md:col-span-2">
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                    <User size={20} className="text-indigo-500"/> Profil Ma'lumotlari
                </h3>
                
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To'liq Ism</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                <input 
                                    type="text" 
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 transition-all"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email (O'zgarmas)</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input 
                                    type="email" 
                                    disabled
                                    className="w-full pl-12 pr-4 py-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-500 cursor-not-allowed select-none"
                                    value={user.email}
                                />
                                <Lock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 opacity-50"/>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 mt-2 border-t border-slate-100">
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                            <ShieldCheck size={20} className="text-indigo-500"/> Xavfsizlik
                        </h3>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Yangi Parol</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                <input 
                                    type="password" 
                                    placeholder="O'zgartirish uchun yozing..."
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 transition-all"
                                    value={newPass}
                                    onChange={(e) => setNewPass(e.target.value)}
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 ml-1 font-medium">Bo'sh qoldirsangiz, parol o'zgarmaydi.</p>
                        </div>
                    </div>

                    {/* Feedback Message */}
                    {message.text && (
                        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center animate-in zoom-in-95 ${
                            message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                        }`}>
                            {message.type === 'success' ? <CheckCircle2 className="mr-2" size={16} /> : <ShieldCheck className="mr-2" size={16} />} 
                            {message.text}
                        </div>
                    )}

                    <div className="pt-2">
                        <button 
                            type="submit" 
                            disabled={saveLoading}
                            className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:transform-none"
                        >
                            {saveLoading ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Saqlash</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;