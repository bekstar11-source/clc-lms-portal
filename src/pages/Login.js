import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Loader2, GraduationCap, Mail, Lock, CheckSquare, Square } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false); // 🔥 Yangi state
  const [loading, setLoading] = useState(false);

  // 1. 🔥 Sahifa yuklanganda saqlangan Emailni tekshirish
  useEffect(() => {
    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true); // Checkboxni ham belgilab qo'yamiz
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 2. 🔥 Login qilish
      await signInWithEmailAndPassword(auth, email, password);

      // 3. 🔥 Agar "Eslab qolish" bosilgan bo'lsa, Emailni xotiraga yozamiz
      if (rememberMe) {
        localStorage.setItem('savedEmail', email);
      } else {
        localStorage.removeItem('savedEmail'); // Agar bosilmasa, o'chirib tashlaymiz
      }

      // Muvaffaqiyatli bo'lsa App.js dagi listener avtomatik yo'naltiradi
      // Lekin tezroq ishlashi uchun qo'lda ham yozib qo'yamiz:
      // navigate('/student-dashboard'); 

    } catch (error) {
      console.error("Login xatosi:", error);
      alert("Login yoki parol xato!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden font-sans py-10">
      
      {/* Orqa fon rasmi */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transform scale-105"
        style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=2073&auto=format&fit=crop')",
        }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm mx-4 p-8 rounded-2xl border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] bg-white/10 backdrop-blur-md">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4 shadow-lg border border-white/30">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-md">Xush Kelibsiz</h2>
          <p className="text-gray-200 text-sm font-medium">Tizimga kirish uchun ma'lumotlarni kiriting.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          
          {/* Email Input */}
          <div className="relative group">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300 group-focus-within:text-white transition-colors">
                <Mail className="w-5 h-5" />
            </div>
            <input 
              type="email" 
              name="email" // 🔥 Browser tushunishi uchun name
              autoComplete="email" // 🔥 Autofill ishlashi uchun
              required
              placeholder="Email manzil" 
              className="w-full py-3.5 pl-10 pr-4 bg-white/20 border border-white/20 rounded-xl text-sm text-white placeholder-gray-300 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password Input */}
          <div className="relative group">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300 group-focus-within:text-white transition-colors">
                <Lock className="w-5 h-5" />
            </div>
            <input 
              type="password" 
              name="password" // 🔥 Browser tushunishi uchun name
              autoComplete="current-password" // 🔥 Parolni browserdan olish uchun
              required
              placeholder="Parol" 
              className="w-full py-3.5 pl-10 pr-4 bg-white/20 border border-white/20 rounded-xl text-sm text-white placeholder-gray-300 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* 🔥 "Eslab qolish" Checkboxi */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
              {rememberMe ? (
                  <CheckSquare size={18} className="text-white fill-white/20"/>
              ) : (
                  <Square size={18} className="text-gray-300"/>
              )}
              <span className="text-sm text-gray-200 font-medium select-none">Meni eslab qol</span>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-600 hover:to-purple-600 text-white font-bold shadow-lg transform hover:-translate-y-0.5 transition-all border border-white/20 active:scale-95 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Kirish"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-200 font-medium">
            Hisobingiz yo'qmi? 
            <Link to="/register" className="font-bold text-white hover:underline ml-1">
               Ro'yxatdan o'tish
            </Link>
        </div>

      </div>
    </div>
  );
};

export default Login;