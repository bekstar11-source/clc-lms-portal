import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, Gamepad2, Zap, ArrowRight, Sparkles, 
  BrainCircuit, AlignLeft, Crown, Rocket, ArrowLeft 
} from 'lucide-react';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

const GameHub = () => {
  const navigate = useNavigate();
  const [xp, setXp] = useState(0);
  const [leaders, setLeaders] = useState([]);
  const [loadingLeaders, setLoadingLeaders] = useState(true);

  // --- HAPTIC HELPER ---
  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(10); 
  };

  useEffect(() => {
    const fetchMyXp = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const docRef = doc(db, "students", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) setXp(docSnap.data().gameXp || 0);
        } catch (error) { console.error(error); }
      }
    };
    fetchMyXp();
  }, []);

  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const q = query(collection(db, "students"), orderBy("gameXp", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLeaders(users);
      } catch (error) {
        console.error("Leaderboard error:", error);
      } finally {
        setLoadingLeaders(false);
      }
    };
    fetchLeaders();
  }, []);

  const getTitle = (index) => {
    if (index === 0) return { title: "Galactic Master", color: "text-yellow-400" };
    if (index === 1) return { title: "Space Legend", color: "text-slate-300" };
    if (index === 2) return { title: "Star Commander", color: "text-orange-400" };
    if (index < 5) return { title: "Cosmic Explorer", color: "text-indigo-400" };
    return { title: "Space Cadet", color: "text-emerald-400" };
  };

  const getAvatar = (seed) => {
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
  };

  // Skeleton Loader
  const LeaderboardSkeleton = () => (
    <div className="flex gap-3 overflow-hidden pb-2">
      {[1,2,3,4].map(i => (
        <div key={i} className="min-w-[85px] h-[110px] bg-slate-800 rounded-2xl animate-pulse border border-slate-700/50 flex flex-col items-center justify-center p-2">
           <div className="w-10 h-10 bg-slate-700 rounded-full mb-2"></div>
           <div className="w-12 h-2 bg-slate-700 rounded mb-1"></div>
           <div className="w-8 h-2 bg-slate-700 rounded"></div>
        </div>
      ))}
    </div>
  );

  return (
    // 🔥 ASOSIY O'ZGARISH: fixed inset-0 va h-[100dvh]
    // Bu sahifani ekranga mixlaydi, faqat ichki qism scroll bo'ladi
    <div className="fixed inset-0 h-[100dvh] bg-slate-900 font-sans text-white overflow-hidden flex flex-col">
      
      {/* --- HEADER (Fixed & Safe) --- */}
      <div className="relative z-30 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/50 pt-[calc(0.5rem+env(safe-area-inset-top))] p-4 shadow-sm shrink-0">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { triggerHaptic(); navigate('/'); }} 
              className="p-2 bg-slate-800 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 uppercase italic tracking-tighter">
                Game Zone
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 shadow-lg shadow-indigo-500/10">
            <Trophy className="text-yellow-400 fill-yellow-400" size={16} />
            <span className="font-black text-white text-sm">{xp}</span>
          </div>
        </div>
      </div>

      {/* --- SCROLLABLE CONTENT --- */}
      {/* overscroll-contain rezina effektini yo'qotadi */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-8 overscroll-contain">
        
        {/* --- HALL OF FAME (Horizontal Scroll) --- */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-1">
                    <Rocket className="text-orange-500 animate-pulse" size={20} />
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Top Players</h2>
                </div>
                <span className="text-[10px] text-slate-600 font-bold uppercase mr-1">Swipe &rarr;</span>
            </div>
            
            
            {loadingLeaders ? (
                <LeaderboardSkeleton />
            ) : (
                <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
                    {leaders.map((student, index) => {
                        const { title, color } = getTitle(index);
                        const isTop3 = index < 3;
                        return (
                            <div key={student.id} className={`snap-center shrink-0 relative flex flex-col items-center justify-between min-w-[100px] bg-slate-800 p-3 rounded-2xl border transition-all active:scale-95
                               ${index === 0 ? 'border-yellow-400/50 bg-yellow-400/10 shadow-[0_0_15px_-3px_rgba(250,204,21,0.2)]' : 
                                 index === 1 ? 'border-slate-400/50' : 
                                 index === 2 ? 'border-orange-400/50' : 
                                 'border-slate-700 bg-slate-800/50'}`}>
                                
                                <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] border-2 border-slate-900 shadow-sm z-10
                                    ${index === 0 ? 'bg-yellow-400 text-slate-900' : 
                                      index === 1 ? 'bg-slate-300 text-slate-900' : 
                                      index === 2 ? 'bg-orange-400 text-slate-900' : 'bg-slate-700 text-white'}`}>
                                    {index + 1}
                                </div>

                                {index === 0 && <Crown size={20} className="absolute -top-6 text-yellow-400 fill-yellow-400 animate-bounce" />}

                                <div className={`w-12 h-12 rounded-full overflow-hidden border-2 mb-2 bg-slate-700 shadow-sm
                                    ${index === 0 ? 'border-yellow-400' : isTop3 ? 'border-slate-400' : 'border-slate-600'}`}>
                                    <img src={getAvatar(student.avatarSeed || student.name)} alt="av" className="w-full h-full object-cover" />
                                </div>

                                <div className="text-center w-full">
                                    <p className="text-[11px] font-black uppercase truncate text-slate-200">{student.name?.split(' ')[0]}</p>
                                    <p className={`text-[9px] font-bold uppercase tracking-wide ${color} mt-0.5 mb-2`}>{title}</p>
                                </div>
                                
                                <div className="bg-slate-900/80 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-300 flex items-center gap-1 w-full justify-center">
                                    <Zap size={10} className="text-yellow-400 fill-yellow-400"/> {student.gameXp || 0}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* --- O'YINLAR RO'YXATI --- */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
          <div className="flex items-center gap-2 mb-2 px-1">
              <Gamepad2 className="text-indigo-500" size={20} />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">O'yinlar</h2>
          </div>

          {/* 1. WORD SCRAMBLE */}
          <div 
            onClick={() => { triggerHaptic(); navigate('/word-game'); }}
            className="group relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-700 p-5 rounded-[2rem] text-white shadow-xl shadow-indigo-900/30 cursor-pointer active:scale-[0.98] transition-all border border-white/10"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <BrainCircuit size={80} />
            </div>
            <div className="relative z-10 flex justify-between items-center">
               <div className="flex-1 pr-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3 backdrop-blur-sm shadow-inner border border-white/10">
                      <Gamepad2 size={24} className="text-indigo-100" />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-wide mb-1">Word Scramble</h3>
                  <p className="text-indigo-200 text-xs font-medium leading-relaxed">So'z boyligini oshirish uchun harflarni joylashtiring.</p>
               </div>
               <div className="h-10 w-10 bg-white text-indigo-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                  <ArrowRight size={20} />
               </div>
            </div>
          </div>

          {/* 2. ENGLISH SPRINT */}
          <div 
            onClick={() => { triggerHaptic(); navigate('/sprint-game'); }}
            className="group relative overflow-hidden bg-gradient-to-r from-amber-500 to-orange-600 p-5 rounded-[2rem] text-white shadow-xl shadow-orange-900/30 cursor-pointer active:scale-[0.98] transition-all border border-white/10"
          >
            <div className="absolute -bottom-4 -right-4 opacity-10 group-hover:opacity-20 transition-opacity rotate-12">
               <Zap size={100} />
            </div>
            <div className="relative z-10 flex justify-between items-center">
               <div className="flex-1 pr-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3 backdrop-blur-sm shadow-inner border border-white/10">
                      <Zap size={24} className="text-orange-100" />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-wide mb-1">English Sprint</h3>
                  <p className="text-orange-100 text-xs font-medium leading-relaxed">Vaqtga qarshi poyga! 10 soniyada to'g'ri javobni toping.</p>
               </div>
               <div className="h-10 w-10 bg-white text-orange-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                  <ArrowRight size={20} />
               </div>
            </div>
          </div>

          {/* 3. SENTENCE MASTER */}
          <div 
            onClick={() => { triggerHaptic(); navigate('/sentence-game'); }}
            className="group relative overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-600 p-5 rounded-[2rem] text-white shadow-xl shadow-emerald-900/30 cursor-pointer active:scale-[0.98] transition-all border border-white/10"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <AlignLeft size={80} />
            </div>
            <div className="relative z-10 flex justify-between items-center">
               <div className="flex-1 pr-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3 backdrop-blur-sm shadow-inner border border-white/10">
                      <AlignLeft size={24} className="text-emerald-100" />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-wide mb-1">Sentence Master</h3>
                  <p className="text-emerald-100 text-xs font-medium leading-relaxed">Grammatika va gap tuzish ko'nikmalarini rivojlantiring.</p>
               </div>
               <div className="h-10 w-10 bg-white text-emerald-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                  <ArrowRight size={20} />
               </div>
            </div>
          </div>

          {/* COMING SOON */}
          <div className="relative overflow-hidden bg-slate-800/50 p-5 rounded-[2rem] text-slate-500 border border-slate-700 border-dashed flex items-center justify-center gap-3 mb-10">
              <Sparkles size={20} className="animate-pulse text-slate-600"/>
              <span className="font-bold text-xs uppercase tracking-widest">Tez kunda yangi o'yin...</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default GameHub;