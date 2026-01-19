import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Home, Heart, Flame, Loader2, Clock, Zap, AlertCircle, RefreshCw 
} from 'lucide-react';
import { doc, getDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';

const SprintGame = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState(null);
  const [totalXp, setTotalXp] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);

  // Gameplay States
  const [gameState, setGameState] = useState('menu');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [questionQueue, setQuestionQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  
  // Timer & Logic
  const [timeLeft, setTimeLeft] = useState(10);
  const [baseTime, setBaseTime] = useState(10); // 🔥 Asosiy vaqtni saqlash uchun
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState(null);
  
  // Animatsiya
  const [showXpAnim, setShowXpAnim] = useState(false);
  
  // Refs (Performance uchun muhim)
  const timerRef = useRef(null);
  const answerTimeoutRef = useRef(null);

  // 1. Initial Data Fetch
  useEffect(() => {
    const initGame = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const gameRef = doc(db, "games", "sprint");
        const gameSnap = await getDoc(gameRef);
        if (gameSnap.exists()) setGameData(gameSnap.data());
        
        const studentRef = doc(db, "students", user.uid);
        const unsub = onSnapshot(studentRef, (docSnap) => {
          if (docSnap.exists()) setTotalXp(docSnap.data().gameXp || 0);
        });
        return () => unsub();
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    initGame();

    // Cleanup on unmount
    return () => {
        clearInterval(timerRef.current);
        clearTimeout(answerTimeoutRef.current);
    };
  }, []);

  // 2. Timer Logic (Optimized)
  useEffect(() => {
    if (gameState === 'playing' && !feedback) {
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 0.1) {
                    clearInterval(timerRef.current);
                    handleWrong(true); // Vaqt tugadi
                    return 0;
                }
                return prev - 0.1;
            });
        }, 100);
    } else {
        clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState, feedback]); // feedback o'zgarganda timer to'xtaydi

  const shuffleArray = (array) => {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const startChallenge = (levelKey) => {
      const level = gameData.levels[levelKey];
      if (!level.questions || level.questions.length === 0) return alert("Savollar yo'q");
      
      const shuffledQs = shuffleArray(level.questions);
      setQuestionQueue(shuffledQs);
      setCurrentIndex(0);
      setSelectedLevel(levelKey); 
      
      // Reset Stats
      setScore(0); 
      setLives(3); 
      setStreak(0); 
      setSessionXp(0); 
      
      // Set Time
      const time = level.baseTime || 10;
      setBaseTime(time);
      setTimeLeft(time);
      
      setGameState('playing');
      loadQuestion(shuffledQs[0]);
  };

  const loadQuestion = (q) => {
      if(!q) return; 
      const shuffledOptions = shuffleArray(q.options);
      setCurrentQuestion({ ...q, options: shuffledOptions });
      
      // 🔥 MUHIM: Har bir yangi savolda vaqtni to'liq qaytaramiz
      setTimeLeft(baseTime); 
      
      setFeedback(null);
      setShowXpAnim(false);
  };

  const nextQuestion = useCallback(() => {
      const nextIdx = currentIndex + 1;
      if (nextIdx < questionQueue.length) {
          setCurrentIndex(nextIdx);
          loadQuestion(questionQueue[nextIdx]);
      } else {
          setGameState('game_over'); 
      }
  }, [currentIndex, questionQueue, baseTime]);

  const handleAnswer = (option) => {
      if (feedback) return; // Spam click oldini olish

      if (option === currentQuestion.a) {
          // --- TO'G'RI JAVOB ---
          setFeedback('correct'); 
          setScore(s => s + 1); 
          setStreak(s => s + 1);
          
          // XP berish
          const user = auth.currentUser;
          const reward = gameData.levels[selectedLevel].xpReward || 5; 
          setSessionXp(prev => prev + reward);
          setShowXpAnim(true);

          if(user) updateDoc(doc(db, "students", user.uid), { gameXp: increment(reward) }).catch(console.error);
          
          // Keyingi savolga o'tish (600ms dan keyin)
          answerTimeoutRef.current = setTimeout(() => nextQuestion(), 600);
      } else {
          // --- XATO JAVOB ---
          handleWrong(false);
      }
  };

  const handleWrong = (isTimeOut = false) => {
      if(gameState !== 'playing') return; // Agar o'yin tugagan bo'lsa, qaytish

      setFeedback(isTimeOut ? 'timeout' : 'wrong'); 
      setLives(l => {
          const newLives = l - 1;
          if (newLives <= 0) {
              // Game Over
              answerTimeoutRef.current = setTimeout(() => setGameState('game_over'), 800);
              return 0;
          }
          return newLives;
      });
      setStreak(0);

      if (lives > 1) { // Agar jon qolgan bo'lsa
          answerTimeoutRef.current = setTimeout(() => {
              nextQuestion(); 
          }, 800);
      }
  };

  if (loading) return <div className="h-[100dvh] flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-indigo-500"/></div>;

  // --- MENU UI ---
  if(gameState === 'menu') {
      return (
          <div className="fixed inset-0 bg-slate-950 text-white font-sans overflow-y-auto overscroll-contain touch-manipulation">
              <div className="p-4 pb-20 pt-[calc(1rem+env(safe-area-inset-top))]">
                <div className="flex justify-between items-center mb-8">
                    <button onClick={()=>navigate('/games')} className="p-2 bg-slate-800 rounded-full"><Home size={20}/></button>
                    <div className="bg-slate-900 px-3 py-1 rounded-full border border-slate-800 text-yellow-400 font-bold text-sm">XP: {totalXp}</div>
                </div>
                <h1 className="text-4xl font-black text-center mb-2 italic bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500">SPRINT</h1>
                <p className="text-center text-slate-500 text-sm mb-8">Tezlik va aniqlik sinovi</p>
                
                <div className="space-y-4 max-w-md mx-auto">
                    {gameData && gameData.levels && Object.keys(gameData.levels).sort((a,b)=>gameData.levels[a].order-gameData.levels[b].order).map(key => {
                        const level = gameData.levels[key];
                        return (
                            <button key={key} onClick={()=>startChallenge(key)} className={`w-full p-5 rounded-3xl bg-gradient-to-r ${level.color || 'from-slate-800 to-slate-700'} relative overflow-hidden group text-left shadow-lg active:scale-95 transition-transform border border-white/5`}>
                                <div className="relative z-10">
                                    <h3 className="text-xl font-bold uppercase italic">{level.title}</h3>
                                    <div className="flex items-center gap-3 mt-1 text-xs font-medium opacity-80">
                                        <span className="flex items-center gap-1"><Clock size={12}/> {level.baseTime}s</span>
                                        <span className="flex items-center gap-1"><Zap size={12}/> +{level.xpReward} XP</span>
                                    </div>
                                </div>
                                <Clock size={80} className="absolute -right-4 -bottom-4 opacity-10 rotate-12"/>
                            </button>
                        )
                    })}
                </div>
              </div>
          </div>
      )
  }

  // --- GAME OVER UI ---
  if(gameState === 'game_over') {
      return (
          <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white animate-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-rose-500/20 rounded-full flex items-center justify-center mb-6 animate-bounce">
                  <AlertCircle size={48} className="text-rose-500"/>
              </div>
              <h2 className="text-4xl font-black mb-2">GAME OVER</h2>
              <div className="text-emerald-400 font-black text-xl mb-4">+{sessionXp} XP Earned</div>
              
              <div className="text-6xl font-black text-white mb-2">{score}</div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-12">Total Score</p>
              
              <div className="w-full max-w-xs space-y-3">
                  <button onClick={()=>startChallenge(selectedLevel)} className="w-full py-4 bg-indigo-600 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"><RefreshCw size={20}/> Qayta o'ynash</button>
                  <button onClick={()=>setGameState('menu')} className="w-full py-4 bg-slate-800 rounded-xl font-bold text-slate-400 active:scale-95 transition-transform">Menyu</button>
              </div>
          </div>
      )
  }

  // --- PLAYING UI ---
  return (
      <div className="fixed inset-0 flex flex-col bg-slate-950 text-white font-sans overflow-hidden touch-manipulation overscroll-contain">
          {/* Timer Bar */}
          <div className="h-2 w-full bg-slate-900 shrink-0">
             <div 
                className={`h-full transition-all duration-100 ease-linear ${timeLeft < 3 ? 'bg-rose-500' : 'bg-yellow-400'}`} 
                style={{ width: `${(timeLeft / baseTime) * 100}%` }} 
             />
          </div>

          <div className="flex justify-between items-center p-4 shrink-0">
              <div className="flex gap-1">{[...Array(3)].map((_,i)=><Heart key={i} size={24} className={i<lives?'text-rose-500 fill-rose-500':'text-slate-800 fill-slate-800'}/>)}</div>
              <div className="text-4xl font-black tabular-nums tracking-tighter">{score}</div>
              <div className="flex items-center gap-1 text-orange-500 font-bold"><Flame size={20} className={streak>5?'animate-bounce':''}/>{streak}</div>
          </div>

          {/* XP Animation Overlay */}
          {showXpAnim && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <div className="animate-float-up flex flex-col items-center">
                      <span className="text-5xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]">+{gameData.levels[selectedLevel].xpReward} XP</span>
                  </div>
              </div>
          )}

          <div className="flex-1 flex flex-col justify-center px-6 pb-10 max-w-md mx-auto w-full overflow-y-auto">
              <div className={`w-full bg-slate-900 p-8 rounded-[2rem] border-2 text-center mb-8 transition-colors duration-200 shadow-xl
                 ${feedback==='correct'?'border-emerald-500 bg-emerald-500/10':feedback==='wrong' || feedback==='timeout'?'border-rose-500 bg-rose-500/10':'border-slate-800'}`}>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">SAVOL ({currentIndex + 1}/{questionQueue.length})</p>
                  <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
                      {feedback === 'timeout' ? "VAQT TUGADI!" : currentQuestion?.q}
                  </h2>
              </div>

              <div className="flex flex-col gap-3 w-full">
                  {currentQuestion?.options.map((opt, i) => (
                      <button 
                        key={i} 
                        onClick={() => handleAnswer(opt)} 
                        disabled={feedback !== null} 
                        className={`w-full py-5 rounded-2xl text-xl font-bold shadow-lg transition-all active:scale-95 border-b-4 active:border-b-0 active:translate-y-1
                            ${feedback === null 
                                ? 'bg-slate-800 border-slate-950 hover:bg-slate-700' 
                                : opt === currentQuestion.a 
                                    ? 'bg-emerald-500 border-emerald-700 text-white' 
                                    : (feedback === 'wrong' && opt !== currentQuestion.a) || feedback === 'timeout'
                                        ? 'bg-slate-800 opacity-50 border-slate-900' 
                                        : 'bg-slate-800'}`}
                      >
                          {opt}
                      </button>
                  ))}
              </div>
          </div>

          <style>{`
            @keyframes float-up {
                0% { transform: translateY(0) scale(0.8); opacity: 0; }
                20% { transform: translateY(-20px) scale(1.1); opacity: 1; }
                80% { transform: translateY(-50px) scale(1); opacity: 1; }
                100% { transform: translateY(-70px) scale(0.9); opacity: 0; }
            }
            .animate-float-up {
                animation: float-up 0.8s ease-out forwards;
            }
          `}</style>
      </div>
  );
};
export default SprintGame;