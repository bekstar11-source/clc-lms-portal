import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, GraduationCap } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. AUTHENTICATION: Foydalanuvchi yaratish (Login/Parol)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. DATABASE: Ma'lumotlarni saqlash (ISM, ROLE, GROUP)
      // Bu qism juda muhim!
      await setDoc(doc(db, "students", user.uid), {
        name: name,
        email: email,
        role: 'student',       // Rol avtomatik student bo'ladi
        groupId: null,         // Hozircha guruhsiz (Admin biriktiradi)
        status: 'active',
        gameXp: 0,             // O'yin ochkosi
        joinedAt: serverTimestamp()
      });

      // 3. Muvaffaqiyatli bo'lsa kirish sahifasiga o'tish
      alert("Ro'yxatdan o'tdingiz! Tizimga kiring.");
      navigate('/login'); // Yoki to'g'ridan-to'g'ri '/' ga
      
    } catch (error) {
      console.error("Xatolik:", error);
      alert("Xatolik yuz berdi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl w-full max-w-md border border-slate-100">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-indigo-200">
            <GraduationCap size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic">Ro'yxatdan O'tish</h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Yangi hisob yarating</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <input 
              type="text" 
              required
              placeholder="Ism Familiya" 
              className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600 border border-transparent focus:border-transparent transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <input 
              type="email" 
              required
              placeholder="Email manzil" 
              className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600 border border-transparent focus:border-transparent transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <input 
              type="password" 
              required
              placeholder="Parol (kamida 6 ta belgi)" 
              className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600 border border-transparent focus:border-transparent transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Ro'yxatdan O'tish"}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link to="/login" className="text-xs font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-wide transition-colors">
            Hisobingiz bormi? Kirish
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Register;