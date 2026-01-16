import React, { useState, useEffect } from 'react';
import { 
  Home, CheckCircle2, XCircle, RotateCcw, 
  AlignLeft, ArrowRight, Loader2, Trophy 
} from 'lucide-react';
import { doc, getDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase'; // Make sure this path is correct for your project
import { useNavigate } from 'react-router-dom';

const SentenceGame = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState(null);
  const [totalXp, setTotalXp] = useState(0);

  const [gameState, setGameState] = useState('level_select');
  const [selectedLevel, setSelectedLevel] = useState(null);
  
  const [shuffledSentences, setShuffledSentences] = useState([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);

  const [availableParts, setAvailableParts] = useState([]);
  const [selectedParts, setSelectedParts] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [streak, setStreak] = useState(0);

  // --- HAPTIC FEEDBACK HELPER ---
  const triggerHaptic = (type) => {
    if (navigator.vibrate) {
      if (type === 'success') navigator.vibrate([10, 50, 10]); // Success double tap
      if (type === 'error') navigator.vibrate([50, 100, 50]);  // Heavy error vibration
      if (type === 'tap') navigator.vibrate(10);               // Light tap
    }
  };

  useEffect(() => {
    const initGame = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const gameRef = doc(db, "games", "sentence_builder");
        const gameSnap = await getDoc(gameRef);
        if (gameSnap.exists()) setGameData(gameSnap.data());
        const studentRef = doc(db, "students", user.uid);
        onSnapshot(studentRef, (docSnap) => { if(docSnap.exists()) setTotalXp(docSnap.data().gameXp || 0); });
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    initGame();
  }, []);

  // Shuffle Function
  const shuffleArray = (array) => {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const shuffleParts = (parts) => {
    const items = parts.map((text, i) => ({ id: i, text: text, status: 'available' }));
    return items.sort(() => Math.random() - 0.5);
  };

  const handleLevelSelect = (key) => { 
      triggerHaptic('tap');
      setSelectedLevel(key);
      
      const sentences = gameData.levels[key].sentences;
      if (!sentences || sentences.length === 0) return alert("Gaplar yo'q");
      const shuffled = shuffleArray(sentences);
      
      setShuffledSentences(shuffled);
      setCurrentSentenceIndex(0); 
      setStreak(0); 
      setGameState('playing'); 
      
      loadSentence(shuffled[0]);
  };

  const loadSentence = (sentenceObj) => {
      setAvailableParts(shuffleParts(sentenceObj.parts)); 
      setSelectedParts([]); 
      setFeedback(null);
  };

  const handlePartClick = (p) => { 
      if(feedback) return; 
      triggerHaptic('tap');
      setAvailableParts(prev=>prev.map(item=>item.id===p.id?{...item,status:'used'}:item)); 
      setSelectedParts([...selectedParts, p]); 
  };

  const handleSelectedPartClick = (p, idx) => { 
      if(feedback) return; 
      triggerHaptic('tap');
      setSelectedParts(selectedParts.filter((_,i)=>i!==idx)); 
      setAvailableParts(prev=>prev.map(item=>item.id===p.id?{...item,status:'available'}:item)); 
  };
  
  const checkAnswer = async () => {
      const currentSentence = shuffledSentences[currentSentenceIndex];
      const correct = currentSentence.parts.join(' ');
      const userS = selectedParts.map(p=>p.text).join(' ');
      
      if(userS === correct) {
          triggerHaptic('success');
          setFeedback('correct'); 
          setStreak(s=>s+1);
          const user = auth.currentUser;
          const reward = gameData.levels[selectedLevel].xpReward || 15;
          if(user) updateDoc(doc(db, "students", user.uid), { gameXp: increment(reward) });
      } else { 
          triggerHaptic('error');
          setFeedback('wrong'); 
          setStreak(0); 
      }
  };

  const nextSentence = () => {
      triggerHaptic('tap');
      const nextIdx = currentSentenceIndex + 1;
      if (nextIdx < shuffledSentences.length) {
          setCurrentSentenceIndex(nextIdx); 
          loadSentence(shuffledSentences[nextIdx]);
      } else {
          setGameState('result');
      }
  };

  const retrySentence = () => { 
      triggerHaptic('tap');
      setFeedback(null); 
      setSelectedParts([]); 
      setAvailableParts(prev=>prev.map(p=>({...p,status:'available'}))); 
  };

  if(loading) return <div className="h-[100dvh] flex items-center justify-center bg-slate-900"><Loader2 className="animate-spin text-white"/></div>;

  // --- MENU (LEVEL SELECT) ---
  if(gameState === 'level_select') {
      return (
          <div className="min-h-[100dvh] bg-slate-900 text-white font-sans overflow-y-auto overscroll-none">
              <div className="p-4 pb-safe-bottom pt-[calc(1rem+env(safe-area-inset-top))]">
                <div className="flex justify-between items-center mb-8">
                    <button onClick={()=>navigate('/games')} className="p-3 -m-3 bg-slate-800 rounded-full active:scale-95 transition-transform"><Home size={20}/></button>
                    <div className="text-yellow-400 font-bold text-sm bg-slate-800 px-3 py-1 rounded-full border border-slate-700">{totalXp} XP</div>
                </div>
                <h1 className="text-3xl font-black text-center mb-2 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-500">SENTENCE MASTER</h1>
                <p className="text-center text-slate-500 text-sm mb-8">Grammatikani mustahkamlang</p>
                
                <div className="space-y-4 max-w-md mx-auto pb-8">
                    {gameData && gameData.levels && Object.keys(gameData.levels).sort((a,b)=>gameData.levels[a].order-gameData.levels[b].order).map(key => (
                        <button key={key} onClick={()=>handleLevelSelect(key)} className={`w-full p-6 rounded-3xl text-left bg-gradient-to-br ${gameData.levels[key].color} relative overflow-hidden group shadow-lg active:scale-95 transition-transform touch-manipulation`}>
                            <div className="relative z-10">
                                <h3 className="text-xl font-black text-white mb-1">{gameData.levels[key].title}</h3>
                                <p className="text-white/80 text-xs font-medium">{gameData.levels[key].description}</p>
                                <div className="mt-4 flex items-center justify-between">
                                   <div className="inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-lg text-xs font-bold backdrop-blur-sm">Start <ArrowRight size={12}/></div>
                                   <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded text-white/90 font-bold">+{gameData.levels[key].xpReward} XP</span>
                                </div>
                            </div>
                            <AlignLeft size={80} className="absolute -right-4 -bottom-4 opacity-20 rotate-12"/>
                        </button>
                    ))}
                </div>
              </div>
          </div>
      )
  }

  // --- RESULT ---
  if(gameState === 'result') {
      return (
          <div className="h-[100dvh] flex flex-col items-center justify-center bg-slate-900 p-6 text-center text-white pb-safe-bottom">
              <div className="w-24 h-24 bg-yellow-400/20 rounded-full flex items-center justify-center mb-6 animate-bounce">
                 <Trophy className="w-12 h-12 text-yellow-400" />
              </div>
              <h2 className="text-3xl font-black mb-2">Level Complete!</h2>
              <p className="text-slate-400 mb-8">Barcha gaplar muvaffaqiyatli tuzildi.</p>
              <button onClick={()=>setGameState('level_select')} className="w-full max-w-xs py-4 bg-indigo-600 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"><Home size={20}/> Menu</button>
          </div>
      )
  }

  // --- PLAYING ---
  const currentSentence = shuffledSentences[currentSentenceIndex];

  return (
      <div className="flex flex-col h-[100dvh] bg-slate-900 text-white font-sans overflow-hidden">
          
          {/* HEADER (Fixed & Safe) */}
          <div className="flex-none p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex justify-between items-center bg-slate-800 z-10 shadow-md">
              <button onClick={()=>setGameState('level_select')} className="text-slate-400 p-2 -m-2 active:text-white"><Home size={22}/></button>
              <div className="flex flex-col items-center w-1/2">
                  <div className="w-full h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-500 ease-out" style={{width: `${((currentSentenceIndex)/shuffledSentences.length)*100}%`}}></div>
                  </div>
              </div>
              <div className="font-bold text-yellow-400 text-sm">{totalXp}</div>
          </div>

          {/* MIDDLE (Scrollable) */}
          <div className="flex-1 overflow-y-auto overscroll-none p-4 pb-32 max-w-md mx-auto w-full scroll-smooth">
              <div className="mb-6 mt-2 text-center">
                  <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Translate</span>
                  <h2 className="text-xl font-bold mt-2 leading-relaxed select-none">{currentSentence?.translation}</h2>
              </div>

              {/* Construction Zone */}
              <div className={`min-h-[140px] bg-slate-800 rounded-2xl p-4 mb-6 flex flex-wrap content-start gap-2 border-2 transition-all duration-300
                  ${feedback==='correct'?'border-emerald-500 bg-emerald-500/10':feedback==='wrong'?'border-rose-500 bg-rose-500/10':'border-dashed border-slate-700'}`}>
                  {selectedParts.length === 0 && <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs font-bold uppercase tracking-widest pointer-events-none select-none">So'zlarni tanlang</div>}
                  {selectedParts.map((p,i)=>(
                      <button key={i} onClick={()=>handleSelectedPartClick(p,i)} className="px-3 py-2 bg-white text-slate-900 rounded-lg font-bold text-sm shadow-[0_2px_0_rgb(203,213,225)] active:translate-y-[2px] active:shadow-none transition-all animate-in zoom-in-50 duration-200">
                        {p.text}
                      </button>
                  ))}
              </div>

              {/* Word Bank */}
              <div className="flex flex-wrap justify-center gap-3">
                  {availableParts.map(p => (
                      <div key={p.id} className={`${p.status==='used'?'opacity-0 pointer-events-none w-0 h-0 overflow-hidden':'opacity-100'} transition-all duration-300`}>
                          <button onClick={()=>handlePartClick(p)} className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-[0_4px_0_0_rgb(55,48,163)] active:shadow-none active:translate-y-[4px] transition-all touch-manipulation">
                              {p.text}
                          </button>
                      </div>
                  ))}
              </div>
          </div>

          {/* FOOTER (Fixed & Safe) */}
          <div className="flex-none bg-slate-900 border-t border-slate-800 z-50">
              <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-w-md mx-auto">
                  {!feedback ? (
                      <button onClick={checkAnswer} disabled={selectedParts.length===0} className={`w-full py-4 rounded-xl font-black uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all ${selectedParts.length>0?'bg-emerald-500 text-white shadow-emerald-500/20':'bg-slate-800 text-slate-600 cursor-not-allowed'}`}>
                          Tekshirish
                      </button>
                  ) : (
                      <div className="flex gap-3 animate-in slide-in-from-bottom-4 duration-300">
                          <div className={`flex-1 flex items-center gap-3 px-4 rounded-xl ${feedback==='correct'?'bg-emerald-500/20 text-emerald-400':'bg-rose-500/20 text-rose-400'}`}>
                              {feedback==='correct'?<CheckCircle2/>:<XCircle/>}
                              <span className="font-bold text-sm">{feedback==='correct'?"To'g'ri!":"Xato!"}</span>
                          </div>
                          {feedback==='correct' ? (
                              <button onClick={nextSentence} className="px-6 py-4 bg-emerald-500 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform flex items-center gap-2">Davom etish <ArrowRight size={18}/></button>
                          ) : (
                              <button onClick={retrySentence} className="px-6 py-4 bg-slate-700 text-white rounded-xl font-bold active:scale-95 transition-transform flex items-center gap-2"><RotateCcw size={18}/> Qayta</button>
                          )}
                      </div>
                  )}
              </div>
          </div>
      </div>
  );
};

export default SentenceGame;