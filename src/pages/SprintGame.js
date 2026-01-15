import React, { useState, useEffect, useRef } from 'react';
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

  // Gameplay
  const [gameState, setGameState] = useState('menu');
  const [selectedLevel, setSelectedLevel] = useState(null);
  
  // 🔥 YANGI STATES
  const [questionQueue, setQuestionQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const initGame = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const gameRef = doc(db, "games", "sprint");
        const gameSnap = await getDoc(gameRef);
        if (gameSnap.exists()) setGameData(gameSnap.data());
        const studentRef = doc(db, "students", user.uid);
        onSnapshot(studentRef, (docSnap) => {
          if (docSnap.exists()) setTotalXp(docSnap.data().gameXp || 0);
        });
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    initGame();
  }, []);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(prev => prev - 0.1), 100);
    } else if (timeLeft <= 0 && gameState === 'playing') {
      handleWrong();
    }
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, gameState]);

  // 🔥 SHUFFLE ALGORITMI
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
      
      // 1. Savollarni aralashtirib olamiz
      const shuffledQs = shuffleArray(level.questions);
      setQuestionQueue(shuffledQs);
      setCurrentIndex(0);

      setSelectedLevel(levelKey); 
      setScore(0); setLives(3); setStreak(0); setGameState('playing');
      setTimeLeft(level.baseTime || 10);
      
      // Birinchi savol
      loadQuestion(shuffledQs[0]);
  };

  const loadQuestion = (q) => {
      if(!q) return; // Agar savol qolmasa
      // Variantlarni aralashtiramiz
      const shuffledOptions = shuffleArray(q.options);
      setCurrentQuestion({ ...q, options: shuffledOptions });
      setFeedback(null);
  };

  const nextQuestion = () => {
      const nextIdx = currentIndex + 1;
      if (nextIdx < questionQueue.length) {
          setCurrentIndex(nextIdx);
          loadQuestion(questionQueue[nextIdx]);
      } else {
          setGameState('game_over'); // Savollar tugadi
      }
  }

  const handleAnswer = (option) => {
      if (feedback) return;
      if (option === currentQuestion.a) {
          setFeedback('correct'); setScore(s=>s+1); setStreak(s=>s+1);
          setTimeLeft(prev => Math.min(gameData.levels[selectedLevel].baseTime || 10, prev + 2));
          
          const user = auth.currentUser;
          const reward = gameData.levels[selectedLevel].xpReward || 5; 
          if(user) updateDoc(doc(db, "students", user.uid), { gameXp: increment(reward) });
          
          setTimeout(() => nextQuestion(), 400); // 🔥
      } else {
          handleWrong();
      }
  };

  const handleWrong = () => {
      setFeedback('wrong'); setLives(l=>l-1); setStreak(0);
      if (lives <= 1) setTimeout(() => setGameState('game_over'), 500);
      else setTimeout(() => {
          setTimeLeft(gameData.levels[selectedLevel].baseTime || 10);
          nextQuestion(); // 🔥 Xato bo'lsa ham keyingisiga o'tamiz
      }, 500);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-indigo-500"/></div>;

  // --- MENU UI ---
  if(gameState === 'menu') {
      return (
          <div className="min-h-screen bg-slate-950 p-4 pb-20 text-white font-sans">
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
      )
  }

  // --- GAME OVER UI ---
  if(gameState === 'game_over') {
      return (
          <div className="h-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white">
              <div className="w-24 h-24 bg-rose-500/20 rounded-full flex items-center justify-center mb-6 animate-bounce">
                  <AlertCircle size={48} className="text-rose-500"/>
              </div>
              <h2 className="text-4xl font-black mb-2">GAME OVER</h2>
              <p className="text-slate-400 mb-8">Yaxshi urinish!</p>
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
      <div className="flex flex-col h-screen bg-slate-950 text-white font-sans overflow-hidden touch-manipulation">
          {/* Timer Bar */}
          <div className="h-2 w-full bg-slate-900">
             <div className={`h-full transition-all duration-100 ease-linear ${timeLeft < 3 ? 'bg-rose-500' : 'bg-yellow-400'}`} style={{ width: `${(timeLeft / (gameData.levels[selectedLevel].baseTime || 10)) * 100}%` }} />
          </div>

          <div className="flex justify-between items-center p-4">
              <div className="flex gap-1">{[...Array(3)].map((_,i)=><Heart key={i} size={24} className={i<lives?'text-rose-500 fill-rose-500':'text-slate-800 fill-slate-800'}/>)}</div>
              <div className="text-4xl font-black tabular-nums tracking-tighter">{score}</div>
              <div className="flex items-center gap-1 text-orange-500 font-bold"><Flame size={20} className={streak>5?'animate-bounce':''}/>{streak}</div>
          </div>

          <div className="flex-1 flex flex-col justify-center px-6 pb-10 max-w-md mx-auto w-full">
              <div className={`w-full bg-slate-900 p-8 rounded-[2rem] border-2 text-center mb-8 transition-colors duration-200 shadow-xl
                 ${feedback==='correct'?'border-emerald-500 bg-emerald-500/10':feedback==='wrong'?'border-rose-500 bg-rose-500/10':'border-slate-800'}`}>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">SAVOL ({currentIndex + 1}/{questionQueue.length})</p>
                  <h2 className="text-2xl sm:text-3xl font-bold leading-tight">{currentQuestion?.q}</h2>
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
                                    : feedback === 'wrong' && opt !== currentQuestion.a 
                                        ? 'bg-slate-800 opacity-50 border-slate-900' 
                                        : 'bg-slate-800'}`}
                      >
                          {opt}
                      </button>
                  ))}
              </div>
          </div>
      </div>
  );
};
export default SprintGame;