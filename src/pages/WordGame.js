import React, { useState, useEffect } from 'react';
import { 
  Trophy, RefreshCw, ArrowRight, Home, 
  BrainCircuit, Shuffle, Loader2 
} from 'lucide-react';
import { doc, getDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';

const WordGame = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState(null);
  const [totalXp, setTotalXp] = useState(0);

  // Game State
  const [gameState, setGameState] = useState('menu');
  const [level, setLevel] = useState(null);
  const [category, setCategory] = useState(null);
  
  // 🔥 YANGI STATE: Aralashtirilgan so'zlar ro'yxati
  const [wordQueue, setWordQueue] = useState([]); 
  const [currentIndex, setCurrentIndex] = useState(0);

  const [currentWordObj, setCurrentWordObj] = useState(null);
  const [scrambledLetters, setScrambledLetters] = useState([]);
  const [userGuess, setUserGuess] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [streak, setStreak] = useState(0);

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

  // 🔥 SHUFFLE ALGORITMI
  const shuffleArray = (array) => {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const startGame = (lvlKey, catKey) => {
      setLevel(lvlKey);
      setCategory(catKey);
      
      // 1. So'zlarni olamiz
      const originalWords = gameData.levels[lvlKey].categories[catKey].words;
      if (!originalWords || originalWords.length === 0) return alert("So'zlar yo'q!");

      // 2. Ularni aralashtiramiz
      const shuffled = shuffleArray(originalWords);
      
      // 3. Queue ga joylaymiz va o'yinni boshlaymiz
      setWordQueue(shuffled);
      setCurrentIndex(0);
      setGameState('playing');
      
      // Birinchi so'zni yuklash
      loadWord(shuffled[0]);
  };

  const loadWord = (wordObj) => {
      setCurrentWordObj(wordObj);
      
      const letters = wordObj.word.split('').map((l, i) => ({ id: i, char: l, status: 'available' }));
      // Harflarni aralashtirish
      for (let i = letters.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [letters[i], letters[j]] = [letters[j], letters[i]];
      }
      setScrambledLetters(letters);
      setUserGuess([]);
      setFeedback(null);
  };

  const nextWord = () => {
      const nextIdx = currentIndex + 1;
      if (nextIdx < wordQueue.length) {
          setCurrentIndex(nextIdx);
          loadWord(wordQueue[nextIdx]);
      } else {
          // O'yin tugadi (Barcha so'zlar topildi)
          setGameState('menu'); 
          alert("Ajoyib! Barcha so'zlarni topdingiz.");
      }
  };

  const handleLetterClick = (letter) => {
      if(feedback) return;
      setScrambledLetters(prev => prev.map(l => l.id === letter.id ? {...l, status: 'used'} : l));
      setUserGuess(prev => [...prev, letter]);
  };

  const handleGuessClick = (letter, index) => {
      if(feedback) return;
      const newGuess = userGuess.filter((_, i) => i !== index);
      setUserGuess(newGuess);
      setScrambledLetters(prev => prev.map(l => l.id === letter.id ? {...l, status: 'available'} : l));
  };

  const checkAnswer = async () => {
      const word = userGuess.map(l => l.char).join('');
      if(word === currentWordObj.word) {
          setFeedback('correct');
          setStreak(s => s + 1);
          
          const user = auth.currentUser;
          const reward = gameData.levels[level].xpReward || 10;
          if(user) await updateDoc(doc(db, "students", user.uid), { gameXp: increment(reward) });
          
          setTimeout(nextWord, 1000); // 🔥 Keyingi so'zga o'tish
      } else {
          setFeedback('wrong');
          setStreak(0);
          setTimeout(() => {
              setFeedback(null);
              setUserGuess([]);
              setScrambledLetters(prev => prev.map(l => ({...l, status: 'available'})));
          }, 800);
      }
  };

  const shuffleCurrent = () => {
      const unused = scrambledLetters.filter(l => l.status === 'available');
      for (let i = unused.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [unused[i], unused[j]] = [unused[j], unused[i]];
      }
      const newLetters = scrambledLetters.map(l => l.status === 'used' ? l : unused.shift());
      setScrambledLetters(newLetters);
  };

  if(loading) return <div className="h-screen flex items-center justify-center bg-slate-900"><Loader2 className="animate-spin text-indigo-500"/></div>;

  // --- MENU UI ---
  if(gameState === 'menu') {
      return (
        <div className="min-h-screen bg-slate-900 p-4 pb-24 text-white font-sans">
           <div className="flex justify-between items-center mb-6">
               <button onClick={()=>navigate('/games')} className="p-2 bg-slate-800 rounded-full text-slate-400"><Home size={20}/></button>
               <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
                   <Trophy className="text-yellow-400" size={16}/><span className="font-bold text-yellow-400">{totalXp}</span>
               </div>
           </div>
           
           <div className="text-center mb-10">
               <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                   <BrainCircuit size={40} className="text-indigo-400"/>
               </div>
               <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">WORD SCRAMBLE</h1>
           </div>

           <div className="space-y-8">
               {gameData && gameData.levels && Object.keys(gameData.levels).map(lvlKey => (
                   <div key={lvlKey}>
                       <div className="flex items-center justify-between mb-3 ml-2">
                           <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs">{gameData.levels[lvlKey].title}</h3>
                           <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-yellow-400 font-bold border border-slate-700">+{gameData.levels[lvlKey].xpReward} XP</span>
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                           {gameData.levels[lvlKey].categories && Object.keys(gameData.levels[lvlKey].categories).map(catKey => (
                               <button key={catKey} onClick={()=>startGame(lvlKey, catKey)} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 hover:border-indigo-500 transition-all text-left group active:scale-95 shadow-lg">
                                   <div className="font-bold text-white mb-1 truncate">{gameData.levels[lvlKey].categories[catKey].title}</div>
                                   <div className="text-xs text-slate-500 group-hover:text-indigo-400 flex items-center gap-1">Boshlash <ArrowRight size={10}/></div>
                               </button>
                           ))}
                       </div>
                   </div>
               ))}
           </div>
        </div>
      )
  }

  // --- PLAYING UI ---
  return (
      <div className="flex flex-col min-h-screen bg-slate-900 text-white font-sans touch-manipulation">
          <div className="flex justify-between items-center p-4">
              <button onClick={()=>setGameState('menu')} className="p-2 bg-slate-800 rounded-full text-slate-400"><Home size={20}/></button>
              <div className="flex items-center gap-1">
                 {/* Progress indicator */}
                 <span className="text-xs font-bold text-slate-500 mr-2">{currentIndex + 1} / {wordQueue.length}</span>
                 <span className={`font-black text-xl ${streak > 0 ? 'text-orange-400' : 'text-slate-600'}`}>{streak}🔥</span>
              </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-4 pb-32 max-w-md mx-auto w-full">
              <div className="mb-12 text-center w-full animate-in fade-in slide-in-from-bottom-4">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-1 rounded mb-2 inline-block">Translate</span>
                  <h2 className="text-3xl font-bold text-white leading-tight">{currentWordObj?.translation}</h2>
              </div>

              <div className="flex flex-wrap justify-center gap-2 mb-12 min-h-[60px]">
                  {Array.from({length: currentWordObj?.word.length}).map((_, i) => {
                      const letter = userGuess[i];
                      return (
                          <button 
                            key={i}
                            onClick={() => letter && handleGuessClick(letter, i)}
                            className={`w-12 h-14 rounded-xl border-b-4 text-2xl font-black flex items-center justify-center transition-all duration-200 shadow-md
                                ${letter 
                                    ? (feedback === 'correct' ? 'bg-emerald-500 border-emerald-700 text-white' : feedback === 'wrong' ? 'bg-rose-500 border-rose-700 text-white' : 'bg-white text-slate-900 border-slate-300') 
                                    : 'bg-slate-800 border-slate-700'
                                }`}
                          >
                              {letter?.char}
                          </button>
                      )
                  })}
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                  {scrambledLetters.map((l) => (
                      <div key={l.id} className={`${l.status === 'used' ? 'opacity-0 pointer-events-none scale-75' : 'scale-100'} transition-all duration-300`}>
                          <button 
                            onClick={() => handleLetterClick(l)}
                            className="w-14 h-14 bg-indigo-600 rounded-2xl border-b-4 border-indigo-800 text-white text-2xl font-bold active:border-b-0 active:translate-y-1 transition-all shadow-lg shadow-indigo-900/50"
                          >
                              {l.char}
                          </button>
                      </div>
                  ))}
              </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 pb-safe z-10">
              <div className="flex gap-4 max-w-md mx-auto">
                  <button onClick={shuffleCurrent} className="p-4 bg-slate-800 rounded-2xl text-slate-400 hover:text-white active:scale-95 transition-transform"><Shuffle size={24}/></button>
                  <button 
                    onClick={checkAnswer}
                    disabled={userGuess.length !== currentWordObj?.word.length}
                    className={`flex-1 py-4 rounded-2xl font-black text-lg uppercase tracking-wider transition-all shadow-lg active:scale-95
                        ${userGuess.length === currentWordObj?.word.length 
                            ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                  >
                      Tekshirish
                  </button>
              </div>
          </div>
      </div>
  );
};
export default WordGame;