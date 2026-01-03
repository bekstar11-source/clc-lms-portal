import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore'; // O'ZGARDI
import { auth, db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 1. Tizimga kirish
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Bazadan shu email egasini topish va vaqtini yangilash
      if (user && user.email) {
        try {
          // Students kolleksiyasidan shu emailga ega hujjatni qidiramiz
          const q = query(collection(db, "students"), where("email", "==", user.email));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // O'quvchi topildi!
            const studentDoc = querySnapshot.docs[0]; // Birinchi topilgan hujjat
            
            await updateDoc(studentDoc.ref, {
              lastLogin: serverTimestamp()
            });
            console.log("Vaqt yangilandi:", studentDoc.id);
          } else {
            console.log("Bu email bilan students bazasida o'quvchi topilmadi (Balki u o'qituvchidir)");
          }
        } catch (dbError) {
          console.error("Vaqtni yangilashda xatolik:", dbError);
        }
      }

      navigate('/');
    } catch (err) {
      console.error(err);
      setError("Email yoki parol noto'g'ri!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-0 sm:p-4">
      <div className="w-full max-w-5xl bg-white sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-screen sm:min-h-[600px]">
        
        {/* CHAP TOMON (O'zgarmadi) */}
        <div className="hidden md:flex md:w-1/2 bg-indigo-600 relative overflow-hidden p-12 flex-col justify-between text-white">
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-white/20">
               <span className="text-3xl font-black italic">C</span>
            </div>
            <h2 className="text-4xl font-black leading-tight mb-4">Welcome back to <br/> CLC Academy</h2>
            <p className="text-indigo-100 font-medium text-lg opacity-80">Ingliz tilini professional darajada o'rganing va natijalaringizni kuzatib boring.</p>
          </div>
          <div className="relative z-10 mt-12">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-60">
              <span>Powered by</span>
              <div className="h-px w-8 bg-white/50"></div>
              <span>LMS Portal v2.0</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        </div>

        {/* O'NG TOMON (Forma) */}
        <div className="w-full md:w-1/2 p-6 sm:p-12 flex flex-col justify-center bg-white relative">
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center justify-center space-x-3 mb-4">
               <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xl font-black italic shadow-lg shadow-indigo-200">CLC</div>
               <div className="text-left">
                 <h1 className="text-xl font-black text-slate-800 leading-none">Academy</h1>
                 <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.25em]">Portal Login</p>
               </div>
            </div>
            <h3 className="text-2xl font-black text-slate-800">Tizimga kirish</h3>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 max-w-xs mx-auto w-full">
            {error && (
              <div className="p-4 bg-red-50 text-red-500 text-[10px] font-black rounded-2xl text-center border border-red-100 uppercase tracking-widest">{error}</div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input type="email" required className="w-full pl-11 pr-4 py-3 sm:py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all text-sm" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input type="password" required className="w-full pl-11 pr-4 py-3 sm:py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all text-sm" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center uppercase text-[10px] tracking-[0.2em] mt-2">
              {loading ? <Loader2 className="animate-spin" size={18} /> : (<>Kirish <ArrowRight size={16} className="ml-2" /></>)}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Hisobingiz yo'qmi?{' '}
              <Link to="/register" className="text-indigo-600 hover:text-indigo-700 underline decoration-2 underline-offset-4">Ro'yxatdan o'ting</Link>
            </p>
          </div>
          <div className="md:hidden mt-auto pt-10 text-center">
            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.3em]">CLC Academy LMS v2.0</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;