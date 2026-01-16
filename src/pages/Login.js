import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, 
  CheckCircle2, TrendingUp, ShieldCheck 
} from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // New feature
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

      // 2. Firestore Update (Preserved your logic)
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
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#EEF2FF] p-0 sm:p-4 font-sans">
      <div className="w-full max-w-[1100px] bg-white sm:rounded-[2.5rem] shadow-2xl shadow-indigo-200/50 overflow-hidden flex flex-col md:flex-row min-h-[100dvh] sm:min-h-[650px]">
        
        {/* --- LEFT SIDE (Visual & Informative) --- */}
        <div className="hidden md:flex md:w-5/12 bg-gradient-to-br from-indigo-600 to-violet-700 relative overflow-hidden p-12 flex-col justify-between text-white">
          
          {/* Background Decor */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-500/30 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>

          {/* Top Content */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
                    <ShieldCheck size={24} className="text-white" />
                </div>
                <span className="font-bold tracking-widest text-xs uppercase opacity-80">Secure Portal</span>
            </div>
            
            <h2 className="text-5xl font-black leading-[1.1] mb-6 tracking-tight">
              Master English <br/>
              <span className="text-indigo-200">Like a Pro.</span>
            </h2>
            <p className="text-indigo-100/80 text-lg font-medium leading-relaxed max-w-sm">
              Your gateway to advanced learning, real-time analytics, and premium resources.
            </p>
          </div>

          {/* Floating Stat Card (Visual Interest) */}
          <div className="relative z-10 bg-white/10 backdrop-blur-xl p-5 rounded-3xl border border-white/10 shadow-xl mt-8 transform hover:scale-105 transition-transform duration-500 cursor-default">
             <div className="flex items-center gap-4 mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-400/20 flex items-center justify-center text-emerald-300">
                    <TrendingUp size={20} />
                </div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider opacity-70">Weekly Activity</p>
                    <p className="text-xl font-black">+24% Growth</p>
                </div>
             </div>
             <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full w-3/4 rounded-full"></div>
             </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 mt-12 flex justify-between items-end">
             <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                CLC Academy © 2026
             </div>
             <div className="w-16 h-1 bg-white/20 rounded-full"></div>
          </div>
        </div>

        {/* --- RIGHT SIDE (Form) --- */}
        <div className="w-full md:w-7/12 p-6 sm:p-12 lg:p-16 flex flex-col justify-center bg-white relative">
          
          {/* Mobile Header Logo */}
          <div className="md:hidden absolute top-6 left-6">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black italic">C</div>
          </div>

          <div className="max-w-sm mx-auto w-full">
            <div className="mb-10">
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2">Hello Again! 👋</h1>
                <p className="text-slate-400 font-medium">Welcome back, you've been missed.</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
                 <div className="bg-rose-100 p-1 rounded-full shrink-0 text-rose-500 mt-0.5"><CheckCircle2 size={14} className="rotate-45"/></div>
                 <div>
                    <h4 className="text-xs font-black text-rose-600 uppercase tracking-wide">Error</h4>
                    <p className="text-xs text-rose-500 font-medium mt-0.5 leading-snug">{error}</p>
                 </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              
              {/* Email Input */}
              <div className="space-y-1.5 group">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1 group-focus-within:text-indigo-600 transition-colors">Email</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                     <Mail size={20} strokeWidth={2}/>
                  </div>
                  <input 
                    type="email" 
                    required 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 placeholder:text-slate-300 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm" 
                    placeholder="student@clc.uz" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 group">
                <div className="flex justify-between items-center ml-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider group-focus-within:text-indigo-600 transition-colors">Password</label>
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                     <Lock size={20} strokeWidth={2}/>
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 placeholder:text-slate-300 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                    <Link to="/forgot-password" className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 transition-colors">Forgot Password?</Link>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-300 hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (<>Sign In <ArrowRight size={18}/></>)}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-10 text-center">
              <p className="text-xs font-bold text-slate-400">
                Don't have an account?{' '}
                <Link to="/register" className="text-indigo-600 hover:text-indigo-700 underline decoration-2 underline-offset-4 decoration-indigo-200 hover:decoration-indigo-500 transition-all">Register Now</Link>
              </p>
            </div>
          </div>
          
          {/* Mobile Footer Decor */}
          <div className="md:hidden mt-auto pt-8 flex justify-center opacity-30">
             <div className="h-1 w-20 bg-slate-300 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;