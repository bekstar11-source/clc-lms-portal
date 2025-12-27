import React, { useState } from 'react';
import { auth } from '../firebase';
import { updatePassword, updateProfile } from 'firebase/auth';
import { User, Lock, Save, ShieldCheck, Mail, Settings as SettingsIcon } from 'lucide-react'; // Settings nomi SettingsIcon ga o'zgartirildi

const Settings = () => {
  const user = auth.currentUser;
  const [name, setName] = useState(user?.displayName || '');
  const [newPass, setNewPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' }); // Xabarni tozalash

    try {
      if (name && name !== user.displayName) {
        await updateProfile(user, { displayName: name });
      }
      if (newPass) {
        if (newPass.length < 6) {
          throw new Error("Parol kamida 6 ta belgidan iborat bo'lishi kerak!");
        }
        await updatePassword(user, newPass);
      }
      setMessage({ type: 'success', text: "Ma'lumotlar muvaffaqiyatli yangilandi!" });
      setNewPass('');
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 font-sans">
      <div className="flex items-center space-x-4 mb-10">
        <div className="p-4 bg-indigo-600 rounded-3xl text-white shadow-lg shadow-indigo-100">
          <SettingsIcon size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Sozlamalar</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Shaxsiy profil va xavfsizlik</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm col-span-2">
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">To'liq ismingiz</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                <input 
                  type="text" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Email manzilingiz</label>
              <div className="relative opacity-60">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="email" 
                  disabled
                  className="w-full pl-12 pr-4 py-4 bg-slate-100 border border-slate-200 rounded-2xl cursor-not-allowed font-bold text-slate-500"
                  value={user?.email || ''}
                />
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100">
              <label className="text-xs font-black text-indigo-600 uppercase ml-1">Yangi parol o'rnatish</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                <input 
                  type="password" 
                  placeholder="Kamida 6 ta belgi"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                />
              </div>
            </div>

            {message.text && (
              <div className={`p-4 rounded-2xl text-sm font-bold flex items-center animate-in fade-in slide-in-from-top-2 ${
                message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}>
                <ShieldCheck className="mr-2" size={18} /> {message.text}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
            >
              <Save size={20} />
              <span>{loading ? "Saqlanmoqda..." : "O'zgarishlarni saqlash"}</span>
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-50 p-10 rounded-[2.5rem] border border-indigo-100 text-center shadow-inner">
            <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-indigo-600 mx-auto mb-6 shadow-xl font-black text-4xl italic">
              {name ? name.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'U')}
            </div>
            <h3 className="font-black text-slate-800 text-xl">{name || "Ustoz"}</h3>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-2">Administrator</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;