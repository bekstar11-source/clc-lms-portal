import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, Loader2, ArrowRight } from 'lucide-react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Firebase Auth orqali yangi akkaunt yaratamiz
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Profilga ismni qo'shamiz
      await updateProfile(user, { displayName: name });

      // 3. MUHIM QISM: Bu o'quvchi allaqachon o'qituvchi tomonidan qo'shilganmi?
      const studentsRef = collection(db, "students");
      const q = query(studentsRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // A) HA, O'QITUVCHI QO'SHGAN: Eski hujjatni yangilaymiz
        const studentDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, "students", studentDoc.id), {
          uid: user.uid, // Auth ID ni ulaymiz
          registeredAt: serverTimestamp(), // Ro'yxatdan o'tgan vaqt
          // Agar o'quvchi ismini boshqacha yozgan bo'lsa ham, o'qituvchi yozgani qolgani ma'qul, 
          // yoki yangilash mumkin: name: name 
        });
      } else {
        // B) YO'Q, BU YANGI O'QUVCHI (Guruhsiz)
        // Agar o'qituvchi bo'lsa 'groups' ochadi, student bo'lsa kutib turadi
        // Hozircha shunchaki student sifatida saqlaymiz (lekin guruhi yo'q)
        await setDoc(doc(db, "students", user.uid), {
          uid: user.uid,
          name: name,
          email: email,
          role: 'student', // Default role
          groupId: null, // Hozircha guruhi yo'q
          createdAt: serverTimestamp()
        });
      }

      navigate('/');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError("Bu email allaqachon ro'yxatdan o'tgan.");
      } else if (err.code === 'auth/weak-password') {
        setError("Parol juda oddiy. Kamida 6 ta belgi yozing.");
      } else {
        setError("Xatolik yuz berdi: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 sm:p-12 relative overflow-hidden">
        
        {/* Header */}
        <div className="text-center mb-10 relative z-10">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-black italic shadow-lg shadow-indigo-200">
            CLC
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-2">Yangi Hisob</h2>
          <p className="text-slate-400 font-medium text-sm">O'quv platformasiga xush kelibsiz</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-500 text-xs font-bold rounded-2xl text-center border border-red-100 animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4 relative z-10">
          
          <div className="relative">
            <User className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input 
              type="text" required 
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:font-medium"
              placeholder="Ism Familiya"
              value={name} onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input 
              type="email" required 
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:font-medium"
              placeholder="Email manzil"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input 
              type="password" required 
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:font-medium"
              placeholder="Parol yaratish"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center uppercase text-xs tracking-widest mt-4"
          >
            {loading ? <Loader2 className="animate-spin" /> : (
              <>Ro'yxatdan O'tish <ArrowRight size={16} className="ml-2" /></>
            )}
          </button>
        </form>

        <div className="mt-8 text-center relative z-10">
          <p className="text-xs font-bold text-slate-400">
            Allaqachon a'zomisiz?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 underline decoration-2 underline-offset-4">
              Kirish
            </Link>
          </p>
        </div>

        {/* Orqa fon bezagi */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 z-0"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-100 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 z-0"></div>

      </div>
    </div>
  );
};

export default Register;