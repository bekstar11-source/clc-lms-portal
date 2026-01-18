import React, { useState, useEffect } from 'react';
import { 
  Trophy, ArrowRight, Home, 
  BrainCircuit, Shuffle, Loader2, Eraser, Zap 
} from 'lucide-react';
import { doc, getDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';

const WordGame = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState(null);
  const [totalXp, setTotalXp] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);

  // Game State
  const [gameState, setGameState] = useState('menu');
  const [level, setLevel] = useState(null);
  const [category, setCategory] = useState(null);
  
  const [wordQueue, setWordQueue] = useState([]); 
  const [currentIndex, setCurrentIndex] = useState(0);

  const [currentWordObj, setCurrentWordObj] = useState(null);
  const [scrambledLetters, setScrambledLetters] = useState([]);
  const [userGuess, setUserGuess] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [streak, setStreak] = useState(0);
  
  // 🔥 ANIMATSIYA VA XP OZGARISHLARI
  const [showXpAnim, setShowXpAnim] = useState(false);
  const [xpChange, setXpChange] = useState(0); // Qancha XP qo'shildi yoki ayrildi

  // --- HAPTIC FEEDBACK ---
  const triggerHaptic = (type) => {
    if (navigator.vibrate) {
        if (type === 'tap') navigator.vibrate(10);
        if (type === 'success') navigator.vibrate([10, 50, 10]);
        if (type === 'error') navigator.vibrate([50, 100, 50]);
    }
  };

  useEffect(() => {
    const initGame = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const gameRef = doc(db, "games", "scramble");
            const gameSnap = await getDoc(gameRef);
            if (gameSnap.exists()) setGameData(gameSnap.data());
            
            const studentRef = doc(db, "students", user.uid);
            onSnapshot(studentRef, (docSnap) => {
                if(docSnap.exists()) setTotalXp(docSnap.data().gameXp || 0);
            });
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    initGame();
  }, []);

  const shuffleArray = (array) => {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const startGame = (lvlKey, catKey) => {
      triggerHaptic('tap');
      setLevel(lvlKey);
      setCategory(catKey);
      setSessionXp(0);
      
      const originalWords = gameData.levels[lvlKey].categories[catKey].words;
      if (!originalWords || originalWords.length === 0) return alert("So'zlar yo'q!");

      const shuffled = shuffleArray(originalWords);
      setWordQueue(shuffled);
      setCurrentIndex(0);
      setGameState('playing');
      loadWord(shuffled[0]);
  };

  const loadWord = (wordObj) => {
      setCurrentWordObj(wordObj);
      const letters = wordObj.word.split('').map((l, i) => ({ id: i, char: l, status: 'available' }));
      setScrambledLetters(shuffleArray(letters)); 
      setUserGuess([]);
      setFeedback(null);
      setShowXpAnim(false);
  };

  const nextWord = () => {
      const nextIdx = currentIndex + 1;
      if (nextIdx < wordQueue.length) {
          setCurrentIndex(nextIdx);
          loadWord(wordQueue[nextIdx]);
      } else {
          setGameState('menu'); 
      }
  };

  const handleLetterClick = (letter) => {
      if(feedback) return;
      triggerHaptic('tap');
      setScrambledLetters(prev => prev.map(l => l.id === letter.id ? {...l, status: 'used'} : l));
      setUserGuess(prev => [...prev, letter]);
  };

  const handleGuessClick = (letter, index) => {
      if(feedback) return;
      triggerHaptic('tap');
      const newGuess = [...userGuess];
      newGuess.splice(index, 1);
      setUserGuess(newGuess);
      setScrambledLetters(prev => prev.map(l => l.id === letter.id ? {...l, status: 'available'} : l));
  };

  const clearAll = () => {
      if(userGuess.length === 0) return;
      triggerHaptic('tap');
      setUserGuess([]);
      setScrambledLetters(prev => prev.map(l => ({...l, status: 'available'})));
  };

  const checkAnswer = async () => {
      const word = userGuess.map(l => l.char).join('');
      const user = auth.currentUser;
      const baseReward = gameData.levels[level].xpReward || 10;

      if(word === currentWordObj.word) {
          // --- TOG'RI JAVOB ---
          triggerHaptic('success');
          setFeedback('correct');
          setStreak(s => s + 1);
          
          setXpChange(baseReward); // +XP
          setSessionXp(prev => prev + baseReward);
          setShowXpAnim(true);

          if(user) await updateDoc(doc(db, "students", user.uid), { gameXp: increment(baseReward) });
          
          setTimeout(nextWord, 1500); 
      } else {
          // --- XATO JAVOB (XP AYRISH) ---
          triggerHaptic('error');
          setFeedback('wrong');
          setStreak(0);
          
          // Jarima: Mukofotning yarmi (butun son qilib olinadi)
          const penalty = Math.floor(baseReward / 2); 
          
          setXpChange(-penalty); // -XP (Manfiy)
          setSessionXp(prev => prev - penalty);
          setShowXpAnim(true); // Animatsiyani ko'rsatish

          // Bazadan ayirish
          if(user) await updateDoc(doc(db, "students", user.uid), { gameXp: increment(-penalty) });

          setTimeout(() => {
              setFeedback(null);
              setUserGuess([]);
              setScrambledLetters(prev => prev.map(l => ({...l, status: 'available'})));
              setShowXpAnim(false); // Animatsiyani o'chirish
          }, 1200);
      }
  };

  const shuffleCurrent = () => {
      triggerHaptic('tap');
      const available = scrambledLetters.filter(l => l.status === 'available');
      const shuffledAvailable = shuffleArray(available);
      
      let availIndex = 0;
      const newLetters = scrambledLetters.map(l => {
          if(l.status === 'used') return l;
          return shuffledAvailable[availIndex++];
      });
      setScrambledLetters(newLetters);
  };

  if(loading) return <div className="h-[100dvh] flex items-center justify-center bg-slate-900"><Loader2 className="animate-spin text-indigo-500"/></div>;

  // --- MENU UI ---
  if(gameState === 'menu') {
      return (
        <div className="fixed inset-0 bg-slate-900 text-white font-sans overflow-y-auto overscroll-contain touch-manipulation">
           {/* Header */}
           <div className="flex justify-between items-center p-4 pt-[calc(1rem+env(safe-area-inset-top))] sticky top-0 z-20 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800/50">
               <button onClick={()=>navigate('/games')} className="p-3 -m-3 bg-slate-800 rounded-full text-slate-400 active:scale-95 transition-transform"><Home size={22}/></button>
               <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 shadow-lg shadow-indigo-500/10">
                   <Trophy className="text-yellow-400" size={16}/><span className="font-bold text-yellow-400 text-sm">{totalXp}</span>
               </div>
           </div>
           
           <div className="px-4 pb-24 pt-4">
               <div className="text-center mb-8">
                   <div className="w-20 h-20 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-indigo-500/20 shadow-[0_0_30px_-10px_rgba(99,102,241,0.5)] animate-pulse-slow">
                       <BrainCircuit size={40} className="text-indigo-400"/>
                   </div>
                   <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 uppercase tracking-tighter">Word Scramble</h1>
                   <p className="text-slate-500 text-sm mt-2">So'zlarni topib xotirani charxlang</p>
               </div>

               <div className="space-y-6">
                   {gameData && gameData.levels && Object.keys(gameData.levels).map(lvlKey => (
                       <div key={lvlKey} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                           <div className="flex items-center justify-between mb-3 px-1">
                               <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">{gameData.levels[lvlKey].title}</h3>
                               <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-bold border border-slate-700">+{gameData.levels[lvlKey].xpReward} XP</span>
                           </div>
                           <div className="grid grid-cols-2 gap-3">
                               {gameData.levels[lvlKey].categories && Object.keys(gameData.levels[lvlKey].categories).map(catKey => (
                                   <button key={catKey} onClick={()=>startGame(lvlKey, catKey)} className="bg-slate-800 p-4 rounded-2xl border border-slate-700/50 relative overflow-hidden group active:scale-[0.98] transition-all shadow-lg text-left hover:border-indigo-500/30">
                                       <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-indigo-500/0 group-hover:to-indigo-500/10 transition-all"></div>
                                       <div className="font-bold text-white mb-1 truncate text-sm relative z-10">{gameData.levels[lvlKey].categories[catKey].title}</div>
                                       <div className="text-[10px] text-slate-500 group-hover:text-indigo-400 flex items-center gap-1 font-bold relative z-10">Boshlash <ArrowRight size={10}/></div>
                                   </button>
                               ))}
                           </div>
                       </div>
                   ))}
               </div>
           </div>
        </div>
      )
  }

  // --- PLAYING UI ---
  const wordLength = currentWordObj?.word.length || 0;
  const isLongWord = wordLength > 7;

  return (
      <div className="fixed inset-0 flex flex-col bg-slate-900 text-white font-sans overflow-hidden overscroll-contain">
          
          {/* Header */}
          <div className="flex-none flex justify-between items-center p-4 pt-[calc(1rem+env(safe-area-inset-top))] bg-slate-900 z-10 border-b border-slate-800">
              <button onClick={()=>setGameState('menu')} className="p-2 -ml-2 bg-slate-800/50 rounded-xl text-slate-400 active:text-white transition-colors"><Home size={20}/></button>
              
              {/* Session XP Display */}
              <div className="flex items-center gap-4">
                 <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-colors ${sessionXp < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
                    <Zap size={14} className={sessionXp < 0 ? "text-red-400 fill-red-400" : "text-yellow-400 fill-yellow-400"} />
                    <span className={`text-xs font-black ${sessionXp < 0 ? 'text-red-300' : 'text-indigo-300'}`}>{sessionXp > 0 ? '+' : ''}{sessionXp}</span>
                 </div>
                 
                 <div className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded-lg">
                    {currentIndex + 1} / {wordQueue.length}
                 </div>
              </div>
          </div>

          {/* 🔥 XP Animation Overlay */}
          {showXpAnim && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <div className="animate-float-up flex flex-col items-center">
                      <span className={`text-4xl font-black drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] ${xpChange > 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                          {xpChange > 0 ? '+' : ''}{xpChange} XP
                      </span>
                      <span className={`text-sm font-bold text-white mt-2 px-3 py-1 rounded-full backdrop-blur-sm ${xpChange > 0 ? 'bg-emerald-500/80' : 'bg-red-500/80'}`}>
                          {xpChange > 0 ? 'Correct!' : 'Oops!'}
                      </span>
                  </div>
              </div>
          )}

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto flex flex-col items-center p-4 pb-4 overscroll-contain">
              
              <div className="mt-4 mb-8 text-center w-full animate-in zoom-in-50 duration-500">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-1 rounded mb-3 inline-block">Translate</span>
                  <h2 className="text-2xl font-bold text-white leading-relaxed">{currentWordObj?.translation}</h2>
              </div>

              {/* Input Slots */}
              <div className={`flex flex-wrap justify-center gap-2 mb-10 w-full transition-all duration-200 ${feedback === 'wrong' ? 'animate-shake' : ''}`}>
                  {Array.from({length: wordLength}).map((_, i) => {
                      const letter = userGuess[i];
                      return (
                          <button 
                            key={i}
                            onClick={() => letter && handleGuessClick(letter, i)}
                            className={`
                                rounded-xl border-b-4 font-black flex items-center justify-center transition-all duration-200 shadow-sm
                                ${isLongWord ? 'w-10 h-12 text-xl' : 'w-12 h-14 text-2xl'}
                                ${letter 
                                    ? (feedback === 'correct' ? 'bg-emerald-500 border-emerald-700 text-white' : feedback === 'wrong' ? 'bg-rose-500 border-rose-700 text-white' : 'bg-white text-slate-900 border-slate-300 active:translate-y-[2px] active:border-b-0') 
                                    : 'bg-slate-800 border-slate-700'
                                }
                            `}
                          >
                              {letter?.char}
                          </button>
                      )
                  })}
              </div>

              {/* Keyboard */}
              <div className="w-full max-w-sm">
                  <div className="flex flex-wrap justify-center gap-2">
                      {scrambledLetters.map((l) => (
                          <div key={l.id} className={`${l.status === 'used' ? 'opacity-0 pointer-events-none scale-75 w-0' : 'scale-100 w-auto'} transition-all duration-300`}>
                              <button 
                                onClick={() => handleLetterClick(l)}
                                className={`
                                    bg-indigo-600 rounded-xl border-b-4 border-indigo-800 text-white font-bold active:border-b-0 active:translate-y-1 transition-all shadow-lg
                                    ${isLongWord ? 'w-11 h-11 text-lg' : 'w-14 h-14 text-2xl'}
                                `}
                              >
                                  {l.char}
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>

          {/* Footer Actions */}
          <div className="flex-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-slate-900 border-t border-slate-800 z-20">
              <div className="flex gap-3 max-w-md mx-auto">
                  <button onClick={shuffleCurrent} className="h-14 w-14 flex items-center justify-center bg-slate-800 rounded-xl text-slate-400 hover:text-white active:scale-95 transition-transform border-b-4 border-slate-900 active:border-b-0 active:translate-y-1">
                      <Shuffle size={24}/>
                  </button>
                  <button onClick={clearAll} className="h-14 w-14 flex items-center justify-center bg-slate-800 rounded-xl text-rose-400 hover:text-rose-300 active:scale-95 transition-transform border-b-4 border-slate-900 active:border-b-0 active:translate-y-1">
                      <Eraser size={24}/>
                  </button>
                  <button 
                    onClick={checkAnswer}
                    disabled={userGuess.length !== wordLength}
                    className={`flex-1 h-14 rounded-xl font-black text-lg uppercase tracking-wider transition-all shadow-lg active:scale-95 border-b-4 active:border-b-0 active:translate-y-1
                        ${userGuess.length === wordLength 
                            ? 'bg-emerald-500 border-emerald-700 text-white shadow-emerald-500/20' 
                            : 'bg-slate-800 border-slate-900 text-slate-600 cursor-not-allowed'}`}
                  >
                      Check
                  </button>
              </div>
          </div>
          
          <style>{`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              25% { transform: translateX(-5px); }
              75% { transform: translateX(5px); }
            }
            .animate-shake {
              animation: shake 0.4s ease-in-out;
            }
            @keyframes float-up {
                0% { transform: translateY(0) scale(0.8); opacity: 0; }
                20% { transform: translateY(-20px) scale(1.1); opacity: 1; }
                80% { transform: translateY(-50px) scale(1); opacity: 1; }
                100% { transform: translateY(-70px) scale(0.9); opacity: 0; }
            }
            .animate-float-up {
                animation: float-up 1.2s ease-out forwards;
            }
          `}</style>
      </div>
  );
};
export default WordGame;