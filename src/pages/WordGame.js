import React, { useState, useEffect, useCallback } from 'react';
import { 
  Trophy, Zap, Gamepad2, Heart, Crown, Rocket, 
  Timer, Star, Award, BookOpen, RefreshCcw, Loader2 
} from 'lucide-react';

// --- IMPORTLAR ---
import { db } from '../firebase'; 
import { doc, updateDoc, increment, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
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

  // --- REYTINGNI YUKLASH ---
  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const q = query(collection(db, "students"), orderBy("gameXp", "desc"), limit(3));
        const querySnapshot = await getDocs(q);
        const leadersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setLeaders(leadersData);
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

  // --- XP HISOBLASH LOGIKASI (YANGILANGAN) ---
  const handleGameAnswer = (selectedOption) => {
    if (gameFeedback) return;

    const isCorrect = selectedOption === currentQuestion.correct;
    
    if (isCorrect) {
      // 1. DARAJA BO'YICHA BAZAVIY BALL (Bu yer o'zgartirildi)
      let basePoints = 0;
      if (selectedDifficulty === 'elementary') basePoints = 10;       // Kam
      else if (selectedDifficulty === 'preIntermediate') basePoints = 30; // O'rtacha
      else if (selectedDifficulty === 'advanced') basePoints = 60;    // Ko'p

      // 2. BONUSLAR (Vaqt va Streak uchun)
      // Qiyin darajada bonuslar ham kattaroq bo'ladi
      const bonusMultiplier = selectedDifficulty === 'advanced' ? 3 : (selectedDifficulty === 'preIntermediate' ? 2 : 1);
      
      const timeBonus = gameTimeLeft * bonusMultiplier; 
      const streakBonus = gameStreak * bonusMultiplier;

      // JAMI XP
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

  // --- O'YIN TUGASHI ---
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

  // --- RENDER ---
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-md mx-auto w-full bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-200">
        
        {/* SCORE BOARD */}
        {gameState === 'PLAYING' && (
          <div className="bg-indigo-600 p-6 text-white animate-in slide-in-from-top duration-500">
            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col">
                <span className="text-[10px] text-indigo-200 font-black uppercase tracking-widest text-center">Natija</span>
                <div className="flex items-center gap-2">
                  <Trophy size={20} className="text-yellow-400" />
                  <span className="text-2xl font-black">{gameScore}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-indigo-200 font-black uppercase tracking-widest text-center">Jonlar</span>
                <div className="flex items-center gap-1 mt-1">
                  {[...Array(3)].map((_, i) => (
                    <Heart 
                      key={i} 
                      size={22} 
                      fill={i < gameLives ? "#fb7185" : "transparent"} 
                      className={i < gameLives ? "text-rose-400" : "text-indigo-400 transition-all"}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-2 text-[10px] font-black uppercase tracking-tighter">
              <div className="flex items-center gap-1">
                <Timer size={14} className="text-indigo-200" />
                <span>Vaqt qoldi</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap size={14} className="text-orange-400 animate-pulse" />
                <span>Streak: {gameStreak}</span>
              </div>
            </div>
            <div className="relative h-3 bg-indigo-900/40 rounded-full overflow-hidden border border-indigo-500/30">
              <div 
                className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-linear ${
                  gameTimeLeft < 4 ? 'bg-rose-500' : 'bg-emerald-400'
                }`}
                style={{ width: `${(gameTimeLeft / 10) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="p-8">
          
          {/* START SCREEN */}
          {gameState === 'START' && (
            <div className="text-center py-6 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-6 border border-indigo-100">
                <Gamepad2 size={40} className="text-indigo-600" />
              </div>
              <h1 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">LexiQuest</h1>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium text-sm">
                Darajani tanlang va XP yig'ing!
              </p>
              
              <div className="space-y-3">
                <button onClick={() => startWordGame('elementary')} className="w-full flex items-center justify-between bg-emerald-50 hover:bg-emerald-100 p-4 rounded-2xl border-2 border-emerald-100 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-xl text-emerald-600 shadow-sm group-hover:scale-110 transition-transform"><BookOpen size={20} /></div>
                    <div className="text-left"><h3 className="font-black text-emerald-900 leading-none text-sm">Elementary</h3><p className="text-[10px] text-emerald-700 mt-1">10 XP har bir so'zga</p></div>
                  </div>
                </button>

                <button onClick={() => startWordGame('preIntermediate')} className="w-full flex items-center justify-between bg-blue-50 hover:bg-blue-100 p-4 rounded-2xl border-2 border-blue-100 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-xl text-blue-600 shadow-sm group-hover:scale-110 transition-transform"><Rocket size={20} /></div>
                    <div className="text-left"><h3 className="font-black text-blue-900 leading-none text-sm">Intermediate</h3><p className="text-[10px] text-blue-700 mt-1">30 XP har bir so'zga</p></div>
                  </div>
                </button>

                <button onClick={() => startWordGame('advanced')} className="w-full flex items-center justify-between bg-purple-50 hover:bg-purple-100 p-4 rounded-2xl border-2 border-purple-100 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-xl text-purple-600 shadow-sm group-hover:scale-110 transition-transform"><Crown size={20} /></div>
                    <div className="text-left"><h3 className="font-black text-purple-900 leading-none text-sm">IELTS Expert</h3><p className="text-[10px] text-purple-700 mt-1">60 XP har bir so'zga</p></div>
                  </div>
                </button>
              </div>

              {/* LEADERBOARD */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Top Players (XP)</h4>
                  
                  {loadingLeaders ? (
                    <div className="flex justify-center"><Loader2 className="animate-spin text-indigo-400" /></div>
                  ) : (
                    <div className="flex justify-center gap-4">
                        {leaders.length > 0 ? leaders.map((leader, i) => (
                          <div key={leader.id} className="flex flex-col items-center">
                             <div className="relative">
                               <div className={`w-10 h-10 rounded-full border-2 overflow-hidden ${i===0 ? 'border-amber-400' : i===1 ? 'border-slate-300' : 'border-orange-400'}`}>
                                  <img src={getAvatarUrl(leader.avatarSeed || leader.name)} alt="av" className="w-full h-full object-cover"/>
                               </div>
                               <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${i===0 ? 'bg-amber-400' : i===1 ? 'bg-slate-400' : 'bg-orange-400'}`}>{i+1}</div>
                             </div>
                             <span className="text-[9px] font-black text-slate-600 mt-1 max-w-[50px] truncate">{leader.name.split(' ')[0]}</span>
                             <span className="text-[8px] font-bold text-indigo-500">{leader.gameXp || 0} XP</span>
                          </div>
                        )) : (
                          <p className="text-xs text-slate-400 italic">Hali hech kim o'ynamadi</p>
                        )}
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* GAME SCREEN */}
          {gameState === 'PLAYING' && currentQuestion && (
            <div className="animate-in fade-in zoom-in duration-300">
              <div className="flex justify-center mb-6">
                <span className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${getDifficultyStyles(selectedDifficulty).color}`}>
                  {getDifficultyStyles(selectedDifficulty).icon}
                  {getDifficultyStyles(selectedDifficulty).label}
                </span>
              </div>

              <div className="text-center mb-10">
                <h2 className="text-4xl font-black text-slate-800 mb-2 tracking-tight break-words">{currentQuestion.word}</h2>
                <p className="text-slate-400 text-xs font-medium">To'g'ri tarjimani tanlang:</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {currentQuestion.options.map((option, index) => {
                  let buttonClass = "group relative w-full py-4 px-6 rounded-2xl border-2 font-bold transition-all flex justify-between items-center text-sm ";
                  
                  if (gameFeedback) {
                    if (option === currentQuestion.correct) {
                      buttonClass += "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm ";
                    } else if (gameFeedback === 'wrong' && option !== currentQuestion.correct) {
                      buttonClass += "border-slate-100 bg-white text-slate-300 ";
                    } else {
                      buttonClass += "border-slate-100 bg-white text-slate-300 ";
                    }
                  } else {
                    buttonClass += "border-slate-100 bg-white hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 active:scale-[0.98] hover:shadow-md ";
                  }

                  return (
                    <button 
                      key={index}
                      disabled={!!gameFeedback}
                      onClick={() => handleGameAnswer(option)}
                      className={buttonClass}
                    >
                      <span>{option}</span>
                      {gameFeedback && option === currentQuestion.correct && (
                        <div className="bg-emerald-500 text-white p-1 rounded-full animate-bounce">
                          <Star size={14} fill="currentColor" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {gameFeedback === 'correct' && (
                <div className="mt-8 text-center text-emerald-600 font-black animate-pulse text-lg">
                  {gameStreak > 2 ? 'DAHSHATLI STREAK!' : 'BARAKALLA!'}
                </div>
              )}
            </div>
          )}

          {/* GAMEOVER SCREEN */}
          {gameState === 'GAMEOVER' && (
            <div className="text-center py-4 animate-in slide-in-from-bottom duration-500">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg">
                <Award size={32} className="text-orange-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-1 text-center">O'yin tugadi!</h2>
              <p className="text-slate-500 mb-6 text-center text-sm">Sizning natijangiz:</p>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 rounded-3xl p-4 border border-slate-100">
                  <p className="text-[9px] text-slate-400 uppercase font-bold mb-1 tracking-widest text-center">To'g'ri</p>
                  <p className="text-2xl font-black text-indigo-600 text-center">{gameScore}</p>
                </div>
                <div className="bg-slate-50 rounded-3xl p-4 border border-slate-100">
                  <p className="text-[9px] text-slate-400 uppercase font-bold mb-1 tracking-widest text-center">Jami XP</p>
                  <p className="text-2xl font-black text-emerald-600 text-center">{gameXp}</p>
                </div>
              </div>
              
              <div className="bg-green-50 p-3 rounded-xl mb-4 text-green-700 text-xs font-bold border border-green-100 flex items-center justify-center gap-2">
                 <RefreshCcw size={12}/> Natijangiz saqlandi!
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <button 
                  onClick={() => setGameState('START')}
                  className="bg-white border-2 border-slate-100 hover:border-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 text-[10px] px-2"
                >
                  <BookOpen size={16} />
                  Darajani o'zgartirish
                </button>
                <button 
                  onClick={() => startWordGame(selectedDifficulty)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-95 text-[10px] px-2"
                >
                  <RefreshCcw size={16} />
                  Qayta o'ynash
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WordGame;