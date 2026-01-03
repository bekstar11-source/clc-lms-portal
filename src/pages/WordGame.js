import React, { useState, useEffect, useCallback } from 'react';
import { 
  Trophy, Zap, Gamepad2, Heart, Crown, Rocket, 
  Timer, Star, Award, BookOpen, RefreshCcw, Loader2 
} from 'lucide-react';

// --- IMPORTLAR ---
import { db } from '../firebase'; 
import { doc, updateDoc, increment, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { WORD_BANK } from '../data/wordBank'; 

const WordGame = ({ student }) => {
  // --- STATE ---
  const [gameState, setGameState] = useState('START'); 
  const [currentQuestion, setCurrentQuestion] = useState(null);
  
  const [gameScore, setGameScore] = useState(0);
  const [gameXp, setGameXp] = useState(0);
  const [gameStreak, setGameStreak] = useState(0);
  const [gameLives, setGameLives] = useState(3);
  const [gameTimeLeft, setGameTimeLeft] = useState(10);
  
  const [gameFeedback, setGameFeedback] = useState(null); 
  const [selectedDifficulty, setSelectedDifficulty] = useState('elementary');
  
  const [leaders, setLeaders] = useState([]);
  const [loadingLeaders, setLoadingLeaders] = useState(true);

  // --- GLOBAL REYTINGNI YUKLASH (TOP 5) ---
  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        // Hamma o'quvchilarni XP bo'yicha saralab, birinchi 5 tasini olamiz
        const q = query(
          collection(db, "students"), 
          orderBy("gameXp", "desc"), 
          limit(5)
        );
        
        const querySnapshot = await getDocs(q);
        
        const globalLeaders = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          gameXp: doc.data().gameXp || 0
        }));

        setLeaders(globalLeaders);

      } catch (error) {
        console.error("Reyting xatolik:", error);
      } finally {
        setLoadingLeaders(false);
      }
    };
    
    if (gameState === 'START' || gameState === 'GAMEOVER') {
      fetchLeaders();
    }
  }, [gameState]); 

  // --- SAVOL GENERATSIYA ---
  const generateGameQuestion = useCallback(() => {
    const pool = WORD_BANK[selectedDifficulty];
    let randomIndex = Math.floor(Math.random() * pool.length);
    
    if (currentQuestion && pool.length > 1) {
      while (pool[randomIndex].word === currentQuestion.word) {
        randomIndex = Math.floor(Math.random() * pool.length);
      }
    }
    
    const question = pool[randomIndex];
    const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
    
    setCurrentQuestion({ ...question, options: shuffledOptions });
    setGameTimeLeft(10); 
    setGameFeedback(null);
  }, [selectedDifficulty, currentQuestion]);

  // --- O'YINNI BOSHLASH ---
  const startWordGame = (diff) => {
    setSelectedDifficulty(diff);
    setGameScore(0);
    setGameXp(0);
    setGameStreak(0);
    setGameLives(3);
    setGameState('PLAYING');
    
    const pool = WORD_BANK[diff];
    const question = pool[Math.floor(Math.random() * pool.length)];
    const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
    setCurrentQuestion({ ...question, options: shuffledOptions });
    setGameTimeLeft(10);
    setGameFeedback(null);
  };

  // --- TIMER ---
  useEffect(() => {
    let timer;
    if (gameState === 'PLAYING' && gameTimeLeft > 0 && !gameFeedback) {
      timer = setInterval(() => {
        setGameTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (gameTimeLeft === 0 && gameState === 'PLAYING') {
      handleGameAnswer(null);
    }
    return () => clearInterval(timer);
  }, [gameTimeLeft, gameState, gameFeedback]);

  // --- XP HISOBLASH LOGIKASI ---
  const handleGameAnswer = (selectedOption) => {
    if (gameFeedback) return;

    const isCorrect = selectedOption === currentQuestion.correct;
    
    if (isCorrect) {
      let basePoints = 0;
      if (selectedDifficulty === 'elementary') basePoints = 10;       
      else if (selectedDifficulty === 'preIntermediate') basePoints = 30; 
      else if (selectedDifficulty === 'advanced') basePoints = 60;    

      const bonusMultiplier = selectedDifficulty === 'advanced' ? 3 : (selectedDifficulty === 'preIntermediate' ? 2 : 1);
      const timeBonus = gameTimeLeft * bonusMultiplier; 
      const streakBonus = gameStreak * bonusMultiplier;
      const earnedXp = basePoints + timeBonus + streakBonus;
      
      setGameFeedback('correct');
      setGameScore(prev => prev + 1);
      setGameXp(prev => prev + earnedXp);
      setGameStreak(prev => prev + 1);
      
      setTimeout(() => generateGameQuestion(), 800);
    } else {
      setGameFeedback('wrong');
      setGameLives(prev => prev - 1);
      setGameStreak(0);
      
      if (gameLives <= 1) {
        setTimeout(() => handleGameOver(), 1000);
      } else {
        setTimeout(() => generateGameQuestion(), 1000);
      }
    }
  };

  const handleGameOver = async () => {
    setGameState('GAMEOVER');
    if (student && student.id && gameXp > 0) {
      try {
        const studentRef = doc(db, "students", student.id);
        await updateDoc(studentRef, {
          gameXp: increment(gameXp)
        });
      } catch (error) {
        console.error("XP saqlashda xatolik:", error);
      }
    }
  };

  const getDifficultyStyles = (diff) => {
    switch(diff) {
      case 'advanced': return { label: 'IELTS Expert (60 XP)', color: 'text-purple-600 bg-purple-100', icon: <Crown size={20} /> };
      case 'preIntermediate': return { label: 'Intermediate (30 XP)', color: 'text-blue-600 bg-blue-100', icon: <Rocket size={20} /> };
      default: return { label: 'Elementary (10 XP)', color: 'text-emerald-600 bg-emerald-100', icon: <BookOpen size={20} /> };
    }
  };

  const getAvatarUrl = (seed) => {
     const cleanSeed = seed ? seed.replace('bot_', '') : 'User';
     return `https://api.dicebear.com/7.x/notionists/svg?seed=${cleanSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
      <div className="max-w-md mx-auto w-full bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-200 h-full flex flex-col">
        
        {/* SCORE BOARD */}
        {gameState === 'PLAYING' && (
          <div className="bg-indigo-600 p-4 md:p-6 text-white animate-in slide-in-from-top duration-500 shrink-0">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <div className="flex flex-col">
                <span className="text-[9px] md:text-[10px] text-indigo-200 font-black uppercase tracking-widest text-center">Natija</span>
                <div className="flex items-center gap-2">
                  <Trophy size={18} className="text-yellow-400 md:w-5 md:h-5" />
                  <span className="text-xl md:text-2xl font-black">{gameScore}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] md:text-[10px] text-indigo-200 font-black uppercase tracking-widest text-center">Jonlar</span>
                <div className="flex items-center gap-1 mt-1">
                  {[...Array(3)].map((_, i) => (
                    <Heart 
                      key={i} 
                      size={18} 
                      fill={i < gameLives ? "#fb7185" : "transparent"} 
                      className={`md:w-6 md:h-6 ${i < gameLives ? "text-rose-400" : "text-indigo-400 transition-all"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-2 text-[9px] md:text-[10px] font-black uppercase tracking-tighter">
              <div className="flex items-center gap-1">
                <Timer size={12} className="text-indigo-200 md:w-4 md:h-4" />
                <span>Vaqt qoldi</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap size={12} className="text-orange-400 animate-pulse md:w-4 md:h-4" />
                <span>Streak: {gameStreak}</span>
              </div>
            </div>
            <div className="relative h-2 md:h-3 bg-indigo-900/40 rounded-full overflow-hidden border border-indigo-500/30">
              <div 
                className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-linear ${
                  gameTimeLeft < 4 ? 'bg-rose-500' : 'bg-emerald-400'
                }`}
                style={{ width: `${(gameTimeLeft / 10) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* START SCREEN */}
        {gameState === 'START' && (
        <div className="p-4 md:p-8 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
            <div className="text-center py-2 md:py-6 animate-in fade-in zoom-in duration-500 flex-1 flex flex-col justify-center">
            
            <div className="w-14 h-14 md:w-20 md:h-20 bg-indigo-50 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-2 md:mb-4 transform rotate-6 border border-indigo-100 shrink-0">
                <Gamepad2 className="text-indigo-600 w-7 h-7 md:w-10 md:h-10" />
            </div>
            
            <h1 className="text-xl md:text-2xl font-black text-slate-800 mb-1 tracking-tight shrink-0">LexiQuest</h1>
            <p className="text-slate-500 mb-4 leading-relaxed font-medium text-xs shrink-0">
                Darajani tanlang va XP yig'ing!
            </p>
            
            <div className="space-y-2 shrink-0">
                <button onClick={() => startWordGame('elementary')} className="w-full flex items-center justify-between bg-emerald-50 hover:bg-emerald-100 p-3 rounded-2xl border-2 border-emerald-100 transition-all group active:scale-95">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl text-emerald-600 shadow-sm"><BookOpen size={18} /></div>
                    <div className="text-left"><h3 className="font-black text-emerald-900 leading-none text-xs">Elementary</h3><p className="text-[9px] text-emerald-700 mt-0.5">10 XP har bir so'zga</p></div>
                </div>
                </button>

                <button onClick={() => startWordGame('preIntermediate')} className="w-full flex items-center justify-between bg-blue-50 hover:bg-blue-100 p-3 rounded-2xl border-2 border-blue-100 transition-all group active:scale-95">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl text-blue-600 shadow-sm"><Rocket size={18} /></div>
                    <div className="text-left"><h3 className="font-black text-blue-900 leading-none text-xs">Intermediate</h3><p className="text-[9px] text-blue-700 mt-0.5">30 XP har bir so'zga</p></div>
                </div>
                </button>

                <button onClick={() => startWordGame('advanced')} className="w-full flex items-center justify-between bg-purple-50 hover:bg-purple-100 p-3 rounded-2xl border-2 border-purple-100 transition-all group active:scale-95">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl text-purple-600 shadow-sm"><Crown size={18} /></div>
                    <div className="text-left"><h3 className="font-black text-purple-900 leading-none text-xs">IELTS Expert</h3><p className="text-[9px] text-purple-700 mt-0.5">60 XP har bir so'zga</p></div>
                </div>
                </button>
            </div>

            {/* LEADERBOARD - TOP 5 */}
            <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Global Leaderboard (Top 5)</h4>
                
                {loadingLeaders ? (
                    <div className="flex justify-center"><Loader2 className="animate-spin text-indigo-400 w-5 h-5" /></div>
                ) : (
                    <div className="flex justify-center gap-2 md:gap-3 flex-wrap">
                        {leaders.length > 0 ? leaders.map((leader, i) => (
                        <div key={leader.id} className="flex flex-col items-center">
                            <div className="relative">
                            <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full border-2 overflow-hidden ${i===0 ? 'border-amber-400' : i===1 ? 'border-slate-300' : i===2 ? 'border-orange-400' : 'border-slate-100'}`}>
                                <img src={getAvatarUrl(leader.avatarSeed || leader.name)} alt="av" className="w-full h-full object-cover"/>
                            </div>
                            <div className={`absolute -bottom-1 -right-1 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white ${i===0 ? 'bg-amber-400' : i===1 ? 'bg-slate-400' : i===2 ? 'bg-orange-400' : 'bg-slate-300'}`}>{i+1}</div>
                            </div>
                            <span className="text-[7px] md:text-[8px] font-black text-slate-600 mt-1 max-w-[35px] truncate">{leader.name.split(' ')[0]}</span>
                            <span className="text-[7px] font-bold text-indigo-500">{leader.gameXp || 0} XP</span>
                        </div>
                        )) : (
                        <p className="text-xs text-slate-400 italic">Hali hech kim o'ynamadi</p>
                        )}
                    </div>
                )}
            </div>
            </div>
        </div>
        )}

        {/* GAME SCREEN */}
        {gameState === 'PLAYING' && currentQuestion && (
          <div className="p-4 md:p-8 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
            <div className="animate-in fade-in zoom-in duration-300 flex-1 flex flex-col justify-center">
              <div className="flex justify-center mb-4 shrink-0">
                <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getDifficultyStyles(selectedDifficulty).color}`}>
                  {React.cloneElement(getDifficultyStyles(selectedDifficulty).icon, { className: "w-4 h-4" })}
                  {getDifficultyStyles(selectedDifficulty).label}
                </span>
              </div>

              <div className="text-center mb-6 shrink-0">
                <h2 className="text-2xl font-black text-slate-800 mb-1 tracking-tight break-words">{currentQuestion.word}</h2>
                <p className="text-slate-400 text-xs font-medium">To'g'ri tarjimani tanlang:</p>
              </div>

              <div className="grid grid-cols-1 gap-2 shrink-0">
                {currentQuestion.options.map((option, index) => {
                  let buttonClass = "group relative w-full py-3 px-4 rounded-xl border-2 font-bold transition-all flex justify-between items-center text-xs select-none active:scale-[0.98] ";
                  if (gameFeedback) {
                    if (option === currentQuestion.correct) buttonClass += "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm ";
                    else buttonClass += "border-slate-100 bg-white text-slate-300 opacity-50 ";
                  } else {
                    buttonClass += "border-slate-100 bg-white hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 hover:shadow-md ";
                  }
                  return (
                    <button key={index} disabled={!!gameFeedback} onClick={() => handleGameAnswer(option)} className={buttonClass}>
                      <span className="truncate">{option}</span>
                      {gameFeedback && option === currentQuestion.correct && (
                        <div className="bg-emerald-500 text-white p-1 rounded-full animate-bounce shrink-0"><Star size={10} fill="currentColor" /></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* GAMEOVER SCREEN */}
        {gameState === 'GAMEOVER' && (
          <div className="p-4 md:p-8 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
              <div className="text-center py-4 animate-in slide-in-from-bottom duration-500 flex-1 flex flex-col justify-center">
              <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 border-4 border-white shadow-lg shrink-0">
                  <Award size={28} className="text-orange-600" />
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-1 text-center shrink-0">O'yin tugadi!</h2>
              <p className="text-slate-500 mb-4 text-center text-xs shrink-0">Sizning natijangiz:</p>
              
              <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  <p className="text-[8px] text-slate-400 uppercase font-bold mb-1 tracking-widest text-center">To'g'ri</p>
                  <p className="text-xl font-black text-indigo-600 text-center">{gameScore}</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  <p className="text-[8px] text-slate-400 uppercase font-bold mb-1 tracking-widest text-center">Jami XP</p>
                  <p className="text-xl font-black text-emerald-600 text-center">{gameXp}</p>
                  </div>
              </div>
              
              <div className="bg-green-50 p-2 rounded-xl mb-4 text-green-700 text-xs font-bold border border-green-100 flex items-center justify-center gap-2 shrink-0">
                  <RefreshCcw size={10}/> Natijangiz saqlandi!
              </div>

              <div className="grid grid-cols-2 gap-2 shrink-0">
                  <button onClick={() => setGameState('START')} className="bg-white border-2 border-slate-100 text-slate-600 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 text-[9px] px-2 uppercase tracking-widest">
                  <BookOpen size={14} /> Bosh menyu
                  </button>
                  <button onClick={() => startWordGame(selectedDifficulty)} className="bg-indigo-600 text-white font-bold py-3 rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-95 text-[9px] px-2 uppercase tracking-widest">
                  <RefreshCcw size={14} /> Qayta
                  </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WordGame;