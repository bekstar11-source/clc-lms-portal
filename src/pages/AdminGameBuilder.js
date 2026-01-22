import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { 
  Save, Plus, Layers, Grid, Type, ArrowLeft, Loader2, 
  Gamepad2, Zap, Trash2, CheckCircle2, FileJson, Copy, AlignLeft 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ArchivedStudents from '../components/ArchivedStudents';

const AdminGameBuilder = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('scramble'); // 'scramble' | 'sprint' | 'sentence'

  // --- XP SETTING ---
  const [xpReward, setXpReward] = useState(10); // Default XP

  // --- BULK IMPORT STATES ---
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonHelp, setShowJsonHelp] = useState(false);

  // --- 1. SCRAMBLE DATA ---
  const [scrambleData, setScrambleData] = useState({ levels: {} });
  const [scrLevelName, setScrLevelName] = useState('');
  const [scrLevelDesc, setScrLevelDesc] = useState('');
  const [scrSelectedLevel, setScrSelectedLevel] = useState('');
  const [scrSelectedCat, setScrSelectedCat] = useState('');
  const [scrCatName, setScrCatName] = useState('');
  const [scrCatTitle, setScrCatTitle] = useState('');
  const [scrCatIcon, setScrCatIcon] = useState('BookOpen');
  const [scrWord, setScrWord] = useState('');
  const [scrTrans, setScrTrans] = useState('');

  // --- 2. SPRINT DATA ---
  const [sprintData, setSprintData] = useState({ levels: {} });
  const [sprLevelName, setSprLevelName] = useState('');
  const [sprBaseTime, setSprBaseTime] = useState(10);
  const [sprSelectedLevel, setSprSelectedLevel] = useState('');
  const [sprQuestion, setSprQuestion] = useState('');
  const [sprCorrect, setSprCorrect] = useState('');
  const [sprWrong1, setSprWrong1] = useState('');
  const [sprWrong2, setSprWrong2] = useState('');
  const [sprWrong3, setSprWrong3] = useState('');

  // --- 3. SENTENCE MASTER DATA ---
  const [sentenceData, setSentenceData] = useState({ levels: {} });
  const [sentLevelName, setSentLevelName] = useState('');
  const [sentLevelDesc, setSentLevelDesc] = useState('');
  const [sentSelectedLevel, setSentSelectedLevel] = useState('');
  const [sentTranslation, setSentTranslation] = useState('');
  const [sentPartsInput, setSentPartsInput] = useState('');

  // DATA FETCHING
  useEffect(() => {
    fetchAllGames();
  }, []);

  const fetchAllGames = async () => {
    setLoading(true);
    try {
      // Scramble
      const scrRef = doc(db, "games", "scramble");
      const scrSnap = await getDoc(scrRef);
      if (scrSnap.exists()) setScrambleData(scrSnap.data());
      else await setDoc(scrRef, { levels: {} });

      // Sprint
      const sprRef = doc(db, "games", "sprint");
      const sprSnap = await getDoc(sprRef);
      if (sprSnap.exists()) setSprintData(sprSnap.data());
      else await setDoc(sprRef, { levels: {} });

      // Sentence Master
      const sentRef = doc(db, "games", "sentence_builder");
      const sentSnap = await getDoc(sentRef);
      if (sentSnap.exists()) setSentenceData(sentSnap.data());
      else await setDoc(sentRef, { levels: {} });

    } catch (error) {
      console.error("Error:", error);
      alert("Xatolik: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ================= 🔥 TUZATILGAN BULK IMPORT LOGIC 🔥 =================
  const handleBulkImport = async () => {
    if (!jsonInput) return alert("Iltimos, JSON kodni kiriting!");
    setActionLoading(true);

    try {
        let parsedData = JSON.parse(jsonInput);

        // Agar user array (ro'yxat) tashlasa ham, bitta obyekt tashlasa ham ishlaydigan qilamiz
        if (!Array.isArray(parsedData)) {
            parsedData = [parsedData];
        }

        const updates = {};
        
        parsedData.forEach(item => {
            if (!item.id) return; // ID bo'lmasa o'tkazib yuboramiz

            if (activeTab === 'scramble') {
                if (!item.title || !item.categories) return;
                updates[`levels.${item.id}`] = {
                    title: item.title,
                    description: item.description || "",
                    xpReward: item.xpReward || 10,
                    order: Date.now(),
                    categories: item.categories
                };
            } else if (activeTab === 'sprint') {
                if (!item.title || !item.questions) return;
                updates[`levels.${item.id}`] = {
                    title: item.title,
                    baseTime: item.baseTime || 10,
                    xpReward: item.xpReward || 10,
                    color: "from-indigo-500 to-purple-600",
                    order: Date.now(),
                    questions: item.questions
                };
            } else if (activeTab === 'sentence') {
                if (!item.title || !item.sentences) return;
                updates[`levels.${item.id}`] = {
                    title: item.title,
                    description: item.description || "",
                    xpReward: item.xpReward || 15,
                    color: "from-emerald-400 to-teal-600",
                    order: Date.now(),
                    sentences: item.sentences
                };
            }
        });

        if (Object.keys(updates).length === 0) {
            throw new Error("JSON ichida to'g'ri ma'lumot topilmadi (id, title bo'lishi shart).");
        }

        const collectionMap = { 'scramble': 'scramble', 'sprint': 'sprint', 'sentence': 'sentence_builder' };
        const gameRef = doc(db, "games", collectionMap[activeTab]);

        // Avval hujjat borligini tekshiramiz
        const docSnap = await getDoc(gameRef);
        if (!docSnap.exists()) {
            await setDoc(gameRef, { levels: {} });
        }

        // updateDoc ishlatamiz, bu eski levelarga tegmaydi, faqat yangisini qo'shadi
        await updateDoc(gameRef, updates);

        alert("Muvaffaqiyatli yuklandi! Eski o'yinlar saqlab qolindi.");
        setJsonInput('');
        fetchAllGames();

    } catch (error) {
        alert("Xatolik: " + error.message);
    } finally {
        setActionLoading(false);
    }
  };

  const getExampleJson = () => {
      if (activeTab === 'scramble') {
          return JSON.stringify([{
            "id": "beginner_level", "title": "Beginner", "description": "Start here", "xpReward": 15,
            "categories": { "animals": { "title": "Hayvonlar", "icon": "Brain", "words": [{ "word": "CAT", "translation": "Mushuk" }] } }
          }], null, 2);
      } else if (activeTab === 'sprint') {
          return JSON.stringify([{
            "id": "ielts_expert", "title": "Expert", "baseTime": 8, "xpReward": 20,
            "questions": [{ "q": "Synonym of 'Happy'?", "a": "Joyful", "options": ["Sad", "Joyful"] }]
          }], null, 2);
      } else {
          return JSON.stringify([{
            "id": "intermediate_b1", "title": "Intermediate B1", "description": "Zamonlar", "xpReward": 30,
            "sentences": [
                { "id": "s1", "parts": ["I", "have", "been", "waiting"], "translation": "Men kutayotgan edim" }
            ]
          }], null, 2);
      }
  }

  // ================= 1. SCRAMBLE LOGIC =================
  const addScrambleLevel = async () => {
    if (!scrLevelName) return;
    setActionLoading(true);
    const key = scrLevelName.toLowerCase().replace(/\s+/g, '_');
    try {
      await updateDoc(doc(db, "games", "scramble"), {
        [`levels.${key}`]: { 
            title: scrLevelName, 
            description: scrLevelDesc, 
            xpReward: parseInt(xpReward) || 10,
            order: Date.now(), 
            categories: {} 
        }
      });
      setScrLevelName(''); setScrLevelDesc(''); setXpReward(10); fetchAllGames();
    } catch(e){alert(e.message)} finally{setActionLoading(false)}
  };

  const addScrambleCategory = async () => {
    if (!scrSelectedLevel || !scrCatName) return;
    setActionLoading(true);
    const key = scrCatName.toLowerCase().replace(/\s+/g, '_');
    try {
      await updateDoc(doc(db, "games", "scramble"), {
        [`levels.${scrSelectedLevel}.categories.${key}`]: { title: scrCatTitle, icon: scrCatIcon, words: [] }
      });
      setScrCatName(''); setScrCatTitle(''); fetchAllGames();
    } catch(e){alert(e.message)} finally{setActionLoading(false)}
  };

  const addScrambleWord = async () => {
    if (!scrSelectedLevel || !scrSelectedCat || !scrWord) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "games", "scramble"), {
        [`levels.${scrSelectedLevel}.categories.${scrSelectedCat}.words`]: arrayUnion({ word: scrWord.toUpperCase(), translation: scrTrans })
      });
      setScrWord(''); setScrTrans(''); fetchAllGames();
    } catch(e){alert(e.message)} finally{setActionLoading(false)}
  };

  // ================= 2. SPRINT LOGIC =================
  const addSprintLevel = async () => {
    if (!sprLevelName) return;
    setActionLoading(true);
    const key = sprLevelName.toLowerCase().replace(/\s+/g, '_');
    try {
      await updateDoc(doc(db, "games", "sprint"), {
        [`levels.${key}`]: { 
            title: sprLevelName, 
            baseTime: parseInt(sprBaseTime),
            xpReward: parseInt(xpReward) || 10,
            color: "from-amber-400 to-orange-500", // Default rang
            order: Date.now(), 
            questions: [] 
        }
      });
      setSprLevelName(''); setSprBaseTime(10); setXpReward(10); fetchAllGames();
    } catch(e){alert(e.message)} finally{setActionLoading(false)}
  };

  const addSprintQuestion = async () => {
    if (!sprSelectedLevel || !sprQuestion || !sprCorrect || !sprWrong1) return alert("Ma'lumotlar to'liq emas!");
    setActionLoading(true);
    const newQ = { q: sprQuestion, a: sprCorrect, options: [sprCorrect, sprWrong1, sprWrong2, sprWrong3].filter(o => o !== '') };
    try {
      await updateDoc(doc(db, "games", "sprint"), {
        [`levels.${sprSelectedLevel}.questions`]: arrayUnion(newQ)
      });
      setSprQuestion(''); setSprCorrect(''); setSprWrong1(''); setSprWrong2(''); setSprWrong3('');
      fetchAllGames();
    } catch(e) { alert(e.message); } finally { setActionLoading(false); }
  };

  // ================= 3. SENTENCE MASTER LOGIC =================
  const addSentenceLevel = async () => {
    if (!sentLevelName) return alert("Nomi kerak!");
    setActionLoading(true);
    const key = sentLevelName.toLowerCase().replace(/\s+/g, '_');
    const colors = ["from-emerald-400 to-teal-600", "from-blue-500 to-indigo-600", "from-orange-500 to-red-600"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    try {
      await updateDoc(doc(db, "games", "sentence_builder"), {
        [`levels.${key}`]: {
          title: sentLevelName,
          description: sentLevelDesc,
          xpReward: parseInt(xpReward) || 15,
          color: randomColor,
          order: Date.now(),
          sentences: []
        }
      });
      setSentLevelName(''); setSentLevelDesc(''); setXpReward(15); fetchAllGames();
    } catch(e) { alert(e.message); } finally { setActionLoading(false); }
  };

  const addSentence = async () => {
    if (!sentSelectedLevel || !sentTranslation || !sentPartsInput) return alert("Ma'lumotlar to'liq emas!");
    setActionLoading(true);
    
    // "I | love | you" -> ["I", "love", "you"]
    const partsArray = sentPartsInput.split('|').map(s => s.trim()).filter(s => s !== '');
    if (partsArray.length < 2) return alert("Gap kamida 2 qismdan iborat bo'lishi kerak!");

    const newSentence = {
      id: Date.now().toString(),
      translation: sentTranslation,
      parts: partsArray
    };

    try {
      await updateDoc(doc(db, "games", "sentence_builder"), {
        [`levels.${sentSelectedLevel}.sentences`]: arrayUnion(newSentence)
      });
      setSentTranslation(''); setSentPartsInput(''); fetchAllGames();
    } catch(e) { alert(e.message); } finally { setActionLoading(false); }
  };

  const deleteLevel = async (gameType, levelKey) => {
      if(!window.confirm("O'chirilsinmi?")) return;
      try {
          const collectionMap = { 'scramble': 'scramble', 'sprint': 'sprint', 'sentence': 'sentence_builder' };
          const dataMap = { 'scramble': scrambleData, 'sprint': sprintData, 'sentence': sentenceData };
          
          const newData = {...dataMap[activeTab]};
          delete newData.levels[levelKey];
          
          await setDoc(doc(db, "games", collectionMap[activeTab]), newData);
          fetchAllGames();
      } catch (e) { alert(e.message); }
  }

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 pb-32">
      
      {/* HEADER & TABS */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin')} className="p-2 bg-white rounded-xl border hover:bg-slate-100"><ArrowLeft size={20}/></button>
            <h1 className="text-2xl font-black text-slate-800 uppercase italic">Game Builder</h1>
        </div>
        
        <div className="bg-white p-1 rounded-xl border shadow-sm flex flex-wrap justify-center gap-1">
            <button onClick={() => {setActiveTab('scramble'); setJsonInput(''); setXpReward(10);}} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2 transition-all ${activeTab === 'scramble' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
                <Gamepad2 size={16}/> Scramble
            </button>
            <button onClick={() => {setActiveTab('sprint'); setJsonInput(''); setXpReward(10);}} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2 transition-all ${activeTab === 'sprint' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
                <Zap size={16}/> Sprint
            </button>
            <button onClick={() => {setActiveTab('sentence'); setJsonInput(''); setXpReward(15);}} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2 transition-all ${activeTab === 'sentence' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
                <AlignLeft size={16}/> Sentence
            </button>
        </div>
      </div>

      {/* 🔥 BULK IMPORT SECTION */}
      <div className="bg-slate-800 p-6 rounded-[2rem] text-white mb-8 shadow-xl shadow-slate-300">
         <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold flex items-center gap-2"><FileJson className="text-emerald-400"/> JSON Orqali Yuklash (Bulk)</h3>
             <button onClick={() => setShowJsonHelp(!showJsonHelp)} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg font-bold text-slate-300 flex items-center gap-2">
                 {showJsonHelp ? "Yashirish" : "Namuna ko'rish"}
             </button>
         </div>
         
         {showJsonHelp && (
             <div className="mb-4 bg-slate-900 p-4 rounded-xl border border-slate-700 relative group">
                 <pre className="text-[10px] md:text-xs font-mono text-emerald-400 overflow-x-auto custom-scrollbar">
                     {getExampleJson()}
                 </pre>
                 <button onClick={() => {navigator.clipboard.writeText(getExampleJson()); alert("Nusxalandi!");}} className="absolute top-2 right-2 p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                     <Copy size={14}/>
                 </button>
             </div>
         )}

         <textarea 
            className="w-full h-32 bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
            placeholder={`${activeTab.toUpperCase()} uchun JSON kodni shu yerga tashlang...`}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
         ></textarea>
         
         <div className="flex justify-end mt-3">
             <button onClick={handleBulkImport} disabled={actionLoading} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase flex items-center gap-2">
                 {actionLoading ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>} Tasdiqlash va Yuklash
             </button>
         </div>
      </div>

      {/* ======================= SCRAMBLE TAB ======================= */}
      {activeTab === 'scramble' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-1 space-y-6">
              {/* Level Form */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h3 className="font-black text-sm uppercase mb-4 text-indigo-600 flex gap-2"><Layers size={18}/> Level Yaratish</h3>
                 <div className="space-y-3">
                    <input className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold" placeholder="Level Nomi" value={scrLevelName} onChange={e=>setScrLevelName(e.target.value)}/>
                    <div className="flex gap-2">
                         <input className="flex-1 p-3 bg-slate-50 rounded-xl text-sm font-bold" placeholder="Tavsif (A1)" value={scrLevelDesc} onChange={e=>setScrLevelDesc(e.target.value)}/>
                         <div className="flex items-center gap-1 bg-slate-50 px-2 rounded-xl border border-slate-200">
                             <span className="text-[10px] font-black text-slate-400">XP:</span>
                             <input type="number" className="w-12 bg-transparent font-bold text-sm" value={xpReward} onChange={e=>setXpReward(e.target.value)}/>
                         </div>
                    </div>
                    <button onClick={addScrambleLevel} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase hover:bg-indigo-700">Level Qo'shish</button>
                 </div>
              </div>

              {/* Category Form */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h3 className="font-black text-sm uppercase mb-4 text-indigo-600 flex gap-2"><Grid size={18}/> Mavzu</h3>
                 <div className="space-y-3">
                    <select className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm" value={scrSelectedLevel} onChange={e=>setScrSelectedLevel(e.target.value)}>
                        <option value="">Levelni tanlang...</option>
                        {Object.keys(scrambleData.levels).map(k=><option key={k} value={k}>{scrambleData.levels[k].title}</option>)}
                    </select>
                    <input className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm" placeholder="ID (animals)" value={scrCatName} onChange={e=>setScrCatName(e.target.value)}/>
                    <input className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm" placeholder="Nom (Hayvonlar)" value={scrCatTitle} onChange={e=>setScrCatTitle(e.target.value)}/>
                    <div className="flex gap-2">
                        {['BookOpen','Plane','Brain','Globe','Briefcase','Zap'].map(i=>(<button key={i} onClick={()=>setScrCatIcon(i)} className={`p-2 rounded border ${scrCatIcon===i?'bg-emerald-100 border-emerald-500':''}`}>{i.substring(0,2)}</button>))}
                    </div>
                    <button onClick={addScrambleCategory} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase hover:bg-indigo-700">Mavzu Qo'shish</button>
                 </div>
              </div>

              {/* Word Form */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h3 className="font-black text-sm uppercase mb-4 text-indigo-600 flex gap-2"><Type size={18}/> So'z</h3>
                 <div className="space-y-3">
                    <select className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm" value={scrSelectedLevel} onChange={e=>setScrSelectedLevel(e.target.value)}>
                        <option value="">Levelni tanlang...</option>
                        {Object.keys(scrambleData.levels).map(k=><option key={k} value={k}>{scrambleData.levels[k].title}</option>)}
                    </select>
                    <select className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm" value={scrSelectedCat} onChange={e=>setScrSelectedCat(e.target.value)}>
                        <option value="">Mavzuni tanlang...</option>
                        {scrSelectedLevel && scrambleData.levels[scrSelectedLevel]?.categories && Object.keys(scrambleData.levels[scrSelectedLevel].categories).map(k=><option key={k} value={k}>{scrambleData.levels[scrSelectedLevel].categories[k].title}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                        <input className="p-3 bg-slate-50 rounded-xl font-bold text-sm uppercase" placeholder="APPLE" value={scrWord} onChange={e=>setScrWord(e.target.value)}/>
                        <input className="p-3 bg-slate-50 rounded-xl font-bold text-sm" placeholder="Olma" value={scrTrans} onChange={e=>setScrTrans(e.target.value)}/>
                    </div>
                    <button onClick={addScrambleWord} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase hover:bg-indigo-700">So'z Qo'shish</button>
                 </div>
              </div>
           </div>
           
           <div className="lg:col-span-2 space-y-4">
              {Object.keys(scrambleData.levels).map(k => {
                  const level = scrambleData.levels[k];
                  return (
                      <div key={k} className="bg-white p-5 rounded-2xl border flex flex-col gap-2 relative group">
                          <div className="flex justify-between items-center">
                              <div>
                                  <h4 className="font-bold text-lg">{level.title}</h4>
                                  <p className="text-xs text-slate-400">{level.description} • XP: {level.xpReward}</p>
                              </div>
                              <button onClick={()=>deleteLevel('scramble', k)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={18}/></button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                              {level.categories && Object.keys(level.categories).map(ck => (
                                  <div key={ck} className="bg-slate-50 p-2 rounded border text-xs">
                                      <span className="font-bold">{level.categories[ck].title}</span> ({level.categories[ck].words?.length})
                                  </div>
                              ))}
                          </div>
                      </div>
                  )
              })}
           </div>
        </div>
      )}

      {/* ======================= SPRINT TAB ======================= */}
      {activeTab === 'sprint' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h3 className="font-black text-sm uppercase mb-4 text-amber-600 flex gap-2"><Layers size={18}/> Level Yaratish</h3>
                    <div className="space-y-3">
                        <input className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold" placeholder="Nomi" value={sprLevelName} onChange={e=>setSprLevelName(e.target.value)}/>
                        <div className="flex gap-2">
                             <div className="flex items-center gap-1 bg-slate-50 px-2 rounded-xl border border-slate-200 flex-1">
                                 <span className="text-[10px] font-black text-slate-400">Vaqt:</span>
                                 <input type="number" className="w-full bg-transparent font-bold text-sm" value={sprBaseTime} onChange={e=>setSprBaseTime(e.target.value)}/>
                             </div>
                             <div className="flex items-center gap-1 bg-slate-50 px-2 rounded-xl border border-slate-200 flex-1">
                                 <span className="text-[10px] font-black text-slate-400">XP:</span>
                                 <input type="number" className="w-full bg-transparent font-bold text-sm" value={xpReward} onChange={e=>setXpReward(e.target.value)}/>
                             </div>
                        </div>
                        <button onClick={addSprintLevel} className="w-full py-3 bg-amber-500 text-white rounded-xl text-xs font-bold uppercase hover:bg-amber-600">Qo'shish</button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h3 className="font-black text-sm uppercase mb-4 text-amber-600 flex gap-2"><CheckCircle2 size={18}/> Savol</h3>
                    <div className="space-y-3">
                        <select className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm" value={sprSelectedLevel} onChange={e=>setSprSelectedLevel(e.target.value)}>
                            <option value="">Levelni tanlang...</option>
                            {Object.keys(sprintData.levels).map(k=><option key={k} value={k}>{sprintData.levels[k].title}</option>)}
                        </select>
                        <input className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm" placeholder="Savol?" value={sprQuestion} onChange={e=>setSprQuestion(e.target.value)}/>
                        <input className="w-full p-3 bg-emerald-50 border-emerald-100 border rounded-xl font-bold text-sm text-emerald-700" placeholder="To'g'ri javob" value={sprCorrect} onChange={e=>setSprCorrect(e.target.value)}/>
                        <div className="space-y-1">
                            <input className="w-full p-2 bg-rose-50 border-rose-100 border rounded-lg font-bold text-xs" placeholder="Xato 1" value={sprWrong1} onChange={e=>setSprWrong1(e.target.value)}/>
                            <input className="w-full p-2 bg-rose-50 border-rose-100 border rounded-lg font-bold text-xs" placeholder="Xato 2" value={sprWrong2} onChange={e=>setSprWrong2(e.target.value)}/>
                            <input className="w-full p-2 bg-rose-50 border-rose-100 border rounded-lg font-bold text-xs" placeholder="Xato 3" value={sprWrong3} onChange={e=>setSprWrong3(e.target.value)}/>
                        </div>
                        <button onClick={addSprintQuestion} className="w-full py-3 bg-amber-500 text-white rounded-xl text-xs font-bold uppercase hover:bg-amber-600">Savol Qo'shish</button>
                    </div>
                </div>
             </div>

             <div className="lg:col-span-2 space-y-4">
                {Object.keys(sprintData.levels).map(k => {
                    const level = sprintData.levels[k];
                    return (
                        <div key={k} className="bg-white p-5 rounded-2xl border flex flex-col gap-2 relative group">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-lg">{level.title}</h4>
                                    <p className="text-xs text-slate-400">Time: {level.baseTime}s • XP: {level.xpReward}</p>
                                </div>
                                <button onClick={()=>deleteLevel('sprint', k)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={18}/></button>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl max-h-40 overflow-y-auto custom-scrollbar">
                                {level.questions?.map((q,i) => (
                                    <div key={i} className="text-xs mb-1 border-b pb-1 last:border-0">
                                        <b>{q.q}</b> → <span className="text-emerald-600">{q.a}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
             </div>
         </div>
      )}

      {/* ======================= SENTENCE MASTER TAB ======================= */}
      {activeTab === 'sentence' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-100 rounded-bl-full -mr-10 -mt-10 opacity-50"></div>
                 <h3 className="font-black text-sm uppercase mb-4 flex gap-2 text-emerald-600 relative z-10"><Layers size={18}/> Level Yaratish</h3>
                 <div className="space-y-3 relative z-10">
                    <input className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm" placeholder="Nomi (Elementary A1)" value={sentLevelName} onChange={e=>setSentLevelName(e.target.value)}/>
                    <div className="flex gap-2">
                        <input className="flex-1 p-3 bg-slate-50 rounded-xl font-bold text-sm" placeholder="Tavsif" value={sentLevelDesc} onChange={e=>setSentLevelDesc(e.target.value)}/>
                        <div className="flex items-center gap-1 bg-slate-50 px-2 rounded-xl border border-slate-200">
                             <span className="text-[10px] font-black text-slate-400">XP:</span>
                             <input type="number" className="w-12 bg-transparent font-bold text-sm" value={xpReward} onChange={e=>setXpReward(e.target.value)}/>
                        </div>
                    </div>
                    <button onClick={addSentenceLevel} disabled={actionLoading} className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase hover:bg-emerald-600 shadow-lg shadow-emerald-200">{actionLoading?<Loader2 className="animate-spin mx-auto"/>:"Level Yaratish"}</button>
                 </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-20 h-20 bg-teal-100 rounded-bl-full -mr-10 -mt-10 opacity-50"></div>
                 <h3 className="font-black text-sm uppercase mb-4 flex gap-2 text-teal-600 relative z-10"><AlignLeft size={18}/> Gap Qo'shish</h3>
                 <div className="space-y-3 relative z-10">
                    <select className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm" value={sentSelectedLevel} onChange={e=>setSentSelectedLevel(e.target.value)}>
                        <option value="">Levelni tanlang...</option>
                        {Object.keys(sentenceData.levels).map(k=><option key={k} value={k}>{sentenceData.levels[k].title}</option>)}
                    </select>
                    <input className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm" placeholder="Tarjimasi (Men maktabga boraman)" value={sentTranslation} onChange={e=>setSentTranslation(e.target.value)}/>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Gap (Bo'laklarni | bilan ajrating)</label>
                        <input className="w-full p-2 bg-white rounded-lg font-bold text-sm border border-slate-200" placeholder="I | go | to | school" value={sentPartsInput} onChange={e=>setSentPartsInput(e.target.value)}/>
                        <p className="text-[10px] text-slate-400 mt-1 italic">Masalan: I | usually | drink | coffee</p>
                    </div>
                    <button onClick={addSentence} disabled={actionLoading} className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-teal-700 shadow-lg shadow-teal-200">{actionLoading?<Loader2 className="animate-spin mx-auto"/>:"Bazaga Qo'shish"}</button>
                 </div>
              </div>
           </div>

           <div className="lg:col-span-2 space-y-6">
              {Object.keys(sentenceData.levels).map(lvlKey => {
                  const level = sentenceData.levels[lvlKey];
                  return (
                      <div key={lvlKey} className="bg-white border border-slate-200 p-6 rounded-[2rem] relative overflow-hidden group">
                          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${level.color || 'from-slate-400 to-slate-500'}`}></div>
                          <button onClick={() => deleteLevel('sentence', lvlKey)} className="absolute top-2 right-2 p-2 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20"><Trash2 size={16}/></button>
                          
                          <div className="flex justify-between items-center mb-4">
                              <div>
                                  <h4 className="font-black text-xl text-slate-800">{level.title}</h4>
                                  <p className="text-xs font-bold text-slate-400">{level.description} • XP: {level.xpReward}</p>
                              </div>
                              <div className="bg-slate-100 p-2 rounded-lg"><AlignLeft className="text-teal-500" size={24}/></div>
                          </div>

                          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                              {level.sentences?.map((s, idx) => (
                                  <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                      <p className="text-xs text-slate-400 font-bold mb-1">{s.translation}</p>
                                      <div className="flex flex-wrap gap-1">
                                          {s.parts?.map((p, i) => (
                                              <span key={i} className="text-[10px] px-2 py-1 bg-white text-slate-700 font-bold rounded border border-slate-200 shadow-sm">{p}</span>
                                          ))}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )
              })}
           </div>
        </div>
      )}

    </div>
  );
};

export default AdminGameBuilder;