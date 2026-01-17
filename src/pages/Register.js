import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, GraduationCap, User, Mail, Lock } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      // 1. AUTHENTICATION
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. DATABASE
      await setDoc(doc(db, "students", user.uid), {
        name: fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email,
        role: 'student',
        groupId: null,
        status: 'active',
        gameXp: 0,
        joinedAt: serverTimestamp()
      });

      alert("Muvaffaqiyatli! Tizimga kirishingiz mumkin.");
      navigate('/login');
      
    } catch (error) {
      console.error("Xatolik:", error);
      alert("Xatolik: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden font-sans py-10">
      
      {/* 1. ORQA FON RASMI (Login.js bilan bir xil) */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transform scale-105"
        style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=2073&auto=format&fit=crop')",
        }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]"></div>
      </div>

      {/* 2. DEKORATIV DOIRALAR */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-32 h-32 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000"></div>

      {/* 3. GLASS CARD (IXCHAMLASHTIRILGAN) */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-[380px] mx-4 p-6 sm:p-8 rounded-2xl border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] bg-white/10 backdrop-blur-md">
        
        {/* Sarlavha */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 mb-4 shadow-lg border border-white/30 animate-bounce-slow">
            <GraduationCap className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 drop-shadow-md">Ro'yxatdan O'tish</h2>
          <p className="text-gray-200 text-xs sm:text-sm font-medium drop-shadow-sm">Yangi hisob yaratish uchun ma'lumotlarni to'ldiring.</p>
        </div>

        {/* Forma */}
        <form onSubmit={handleRegister} className="space-y-4">
          
          {/* Ism va Familiya (Yonma-yon) */}
          <div className="flex gap-3">
            <div className="relative group w-1/2">
               <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300 group-focus-within:text-white transition-colors">
                  <User className="w-4 h-4" />
               </div>
               <input 
                type="text" 
                required
                placeholder="Ism" 
                className="w-full py-3 pl-9 pr-2 bg-white/20 border border-white/20 rounded-xl text-sm text-white placeholder-gray-300 focus:outline-none focus:bg-white/30 focus:border-white/50 focus:shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all duration-300"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="relative group w-1/2">
               <input 
                type="text" 
                required
                placeholder="Familiya" 
                className="w-full py-3 px-4 bg-white/20 border border-white/20 rounded-xl text-sm text-white placeholder-gray-300 focus:outline-none focus:bg-white/30 focus:border-white/50 focus:shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all duration-300"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          {/* Email */}
          <div className="relative group">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300 group-focus-within:text-white transition-colors">
                <Mail className="w-5 h-5" />
            </div>
            <input 
              type="email" 
              required
              placeholder="Email manzil" 
              className="w-full py-3 pl-10 pr-4 bg-white/20 border border-white/20 rounded-xl text-sm text-white placeholder-gray-300 focus:outline-none focus:bg-white/30 focus:border-white/50 focus:shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all duration-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Parol */}
          <div className="relative group">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300 group-focus-within:text-white transition-colors">
                <Lock className="w-5 h-5" />
            </div>
            <input 
              type="password" 
              required
              placeholder="Parol (min 6 ta belgi)" 
              className="w-full py-3 pl-10 pr-4 bg-white/20 border border-white/20 rounded-xl text-sm text-white placeholder-gray-300 focus:outline-none focus:bg-white/30 focus:border-white/50 focus:shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all duration-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Tugma */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-600 hover:to-purple-600 text-white font-bold shadow-lg hover:shadow-xl hover:shadow-purple-500/20 transform hover:-translate-y-0.5 transition-all duration-300 border border-white/20 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2 text-sm sm:text-base mt-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Ro'yxatdan O'tish"}
          </button>
        </form>

        {/* Kirish Linki */}
        <div className="mt-6 text-center text-xs sm:text-sm text-gray-200 font-medium">
            Hisobingiz bormi? 
            <Link to="/login" className="font-bold text-white hover:underline ml-1 drop-shadow-sm decoration-2 underline-offset-4">
               Kirish
            </Link>
        </div>

      </div>
    </div>
  );
};

export default Register;