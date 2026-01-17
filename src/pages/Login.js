import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Mail, Lock, Loader2, Eye, EyeOff, GraduationCap 
} from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 1. Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Firestore Update
      if (user) {
        try {
          const studentRef = doc(db, "students", user.uid);
          await updateDoc(studentRef, {
            lastLogin: serverTimestamp()
          });
        } catch (dbError) {
          console.log("Teacher login or doc missing");
        }
      }

      navigate('/');
    } catch (err) {
      console.error("Firebase error:", err.code);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        setError("Bu email tizimda mavjud emas.");
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Parol noto‘g‘ri kiritildi.");
      } else if (err.code === 'auth/network-request-failed') {
        setError("Internet aloqasi yo‘q.");
      } else {
        setError("Tizimga kirishda xatolik.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    // Asosiy konteyner
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden font-sans py-10">
      
      {/* 1. YANGI ORQA FON RASMI (Chiroyli Kutubxona) */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transform scale-105" // scale-105 ozgina yaqinlashtiradi
        style={{
            // Yangi, issiqroq va ta'limga oid rasm
            backgroundImage: "url('https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=2073&auto=format&fit=crop')",
        }}
      >
        {/* Qoraytiruvchi qatlam ( biroz kuchaytirildi ) */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]"></div>
      </div>

      {/* 2. DEKORATIV DOIRALAR */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-32 h-32 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000"></div>

      {/* 3. GLASS CARD (IXCHAMLASHTIRILGAN) */}
      {/* O'zgarish: max-w-md o'rniga max-w-sm va sm:max-w-[380px] ishlatildi. Padding p-8 dan p-6 sm:p-8 ga o'zgartirildi */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-[380px] mx-4 p-6 sm:p-8 rounded-2xl border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] bg-white/10 backdrop-blur-md">
        
        {/* Sarlavha Qismi */}
        <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 mb-4 shadow-lg border border-white/30 animate-bounce-slow">
                <GraduationCap className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 drop-shadow-md">Xush Kelibsiz!</h2>
            <p className="text-gray-200 text-xs sm:text-sm font-medium drop-shadow-sm">Platformaga kirish uchun ma'lumotlaringizni kiriting.</p>
        </div>

        {/* Xatolik Xabari */}
        {error && (
            <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-2 backdrop-blur-sm animate-in slide-in-from-top-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <p className="text-xs text-white font-medium">{error}</p>
            </div>
        )}

        {/* Forma - Inputlar kartochka toraygani uchun avtomatik qisqardi */}
        <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
            
            {/* Email Input */}
            <div className="relative group">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300 group-focus-within:text-white transition-colors">
                    <Mail className="w-5 h-5" />
                </div>
                <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full py-3 pl-10 pr-4 bg-white/20 border border-white/20 rounded-xl text-sm text-white placeholder-gray-300 focus:outline-none focus:bg-white/30 focus:border-white/50 focus:shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all duration-300"
                    placeholder="Email manzilingiz"
                />
            </div>

            {/* Parol Input */}
            <div className="relative group">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300 group-focus-within:text-white transition-colors">
                    <Lock className="w-5 h-5" />
                </div>
                <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full py-3 pl-10 pr-10 bg-white/20 border border-white/20 rounded-xl text-sm text-white placeholder-gray-300 focus:outline-none focus:bg-white/30 focus:border-white/50 focus:shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all duration-300"
                    placeholder="Parolingiz"
                />
                <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300 hover:text-white transition-colors focus:outline-none p-1"
                >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
            </div>

            {/* Qo'shimcha Linklar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm gap-2 sm:gap-0">
                <label className="flex items-center text-gray-200 cursor-pointer hover:text-white transition-colors font-medium select-none text-xs sm:text-sm">
                    <input type="checkbox" className="w-4 h-4 rounded bg-white/30 border-transparent focus:ring-0 text-blue-500 mr-2 accent-blue-500" />
                    Eslab qolish
                </label>
                <Link to="/forgot-password" className="text-white hover:underline font-medium drop-shadow-sm text-xs sm:text-sm ml-auto sm:ml-0">
                    Parolni unutdingizmi?
                </Link>
            </div>

            {/* Kirish Tugmasi */}
            <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-600 hover:to-purple-600 text-white font-bold shadow-lg hover:shadow-xl hover:shadow-purple-500/20 transform hover:-translate-y-0.5 transition-all duration-300 border border-white/20 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2 text-sm sm:text-base"
            >
                {loading ? <Loader2 className="animate-spin" size={20} /> : "Tizimga Kirish"}
            </button>
        </form>

        {/* Ro'yxatdan O'tish */}
        <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-200 font-medium">
            Hisobingiz yo'qmi? 
            <Link to="/register" className="font-bold text-white hover:underline ml-1 drop-shadow-sm decoration-2 underline-offset-4">
                Ro'yxatdan o'tish
            </Link>
        </div>

      </div>
    </div>
  );
};

export default Login;