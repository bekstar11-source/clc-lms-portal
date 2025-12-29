import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Save, Loader2, Dices, User, Bot, Sparkles } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

// 1. YIGITLAR UCHUN (Notionists style - Jiddiy)
const BOYS = [
  "Felix", "Josh", "Eden", "Leo", "Max", "Ryker", "Jude", "Gael",
  "Axel", "Ivan", "Emmett", "Arthur", "Tyler", "Eric", "Kyle",
  "Beau", "Jonah", "Abel", "Hulk", "Thor", "Loki", "Hawkeye", "Strange",
  "Panther", "Antman", "Vision", "Falcon", "Winter", "Bucky", "Rhodey"
];

// 2. QIZLAR UCHUN (Notionists style - Iboli va Zamonaviy)
const GIRLS = [
  "Mila", "Liliana", "Zoey", "Nora", "Hazel", "Aurora", "Savannah", 
  "Audrey", "Claire", "Skylar", "Bella", "Lucy", "Anna", "Maria",
  "Daisy", "Fiona", "Elsa", "Jasmine", "Ariel", "Cinderella", "Mulan",
  "Tiana", "Rapunzel", "Merida", "Moana", "Pocahontas", "Aurora", "Belle"
];

// 3. ROBOTLAR UCHUN (Bottts style - Qiziqarli va Neytral)
const ROBOTS = [
  "Gizmo", "Nano", "Pixel", "Byte", "Mega", "Tron", "Data", "Chip",
  "Spark", "Volt", "Zeta", "Omega", "Prime", "Echo", "Flux",
  "Cyber", "Droid", "Unit", "Vector", "Matrix", "Glitch", "Sonic",
  "Tails", "Knuckles", "Shadow", "Eggman", "Metal", "Amy", "Cream", "Big"
];

const StudentSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentId, setStudentId] = useState(null);
  
  // State
  const [selectedSeed, setSelectedSeed] = useState("Felix");
  const [activeTab, setActiveTab] = useState('boys'); // 'boys', 'girls', 'robots'

  useEffect(() => {
    const fetchStudent = async () => {
      const user = auth.currentUser;
      if (!user) { navigate('/'); return; }

      try {
        const q = query(collection(db, "students"), where("email", "==", user.email));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const docData = snap.docs[0];
          setStudentId(docData.id);
          // Avatarni tiklash
          if (docData.data().avatarSeed) {
            setSelectedSeed(docData.data().avatarSeed);
            // Agar avatar 'bot_' bilan boshlansa robot tabini ochamiz
            if (docData.data().avatarSeed.startsWith('bot_')) {
              setActiveTab('robots');
            }
          } else {
            setSelectedSeed(docData.data().name);
          }
        }
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    };
    fetchStudent();
  }, [navigate]);

  // --- LOGIKA: URL Yasash ---
  // Biz bazaga "bot_Gizmo" yoki shunchaki "Felix" deb saqlaymiz.
  // Agar boshida "bot_" bo'lsa -> Robot API ishlaydi.
  // Bo'lmasa -> Odam API ishlaydi.
  
  const getAvatarUrl = (seed) => {
    if (seed.startsWith('bot_')) {
      // Robot API
      const cleanSeed = seed.replace('bot_', '');
      return `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;
    } else {
      // Odam API (Notionists)
      const safeSeed = encodeURIComponent(seed);
      return `https://api.dicebear.com/7.x/notionists/svg?seed=${safeSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;
    }
  };

  const handleSelect = (seed, type) => {
    if (type === 'robot') {
      setSelectedSeed(`bot_${seed}`);
    } else {
      setSelectedSeed(seed);
    }
  };

  const generateRandom = () => {
    const randomStr = Math.random().toString(36).substring(7);
    if (activeTab === 'robots') {
      setSelectedSeed(`bot_${randomStr}`);
    } else {
      setSelectedSeed(randomStr);
    }
  };

  const handleSave = async () => {
    if (!studentId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "students", studentId), {
        avatarSeed: selectedSeed
      });
      navigate('/'); 
    } catch (e) { alert("Xatolik: " + e.message); } 
    finally { setSaving(false); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans flex flex-col h-screen">
      
      {/* Header */}
      <div className="flex-none flex items-center justify-between mb-2 z-10 py-2">
        <button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 active:scale-95 transition-transform">
          <ArrowLeft size={22} className="text-slate-700"/>
        </button>
        <h1 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Profilni Sozlash</h1>
        <div className="w-12"></div>
      </div>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full overflow-hidden">
        
        {/* Katta Preview */}
        <div className="flex-none text-center mb-6 relative">
          <div className="w-28 h-28 mx-auto rounded-full border-4 border-white shadow-xl overflow-hidden bg-white">
            <img 
              src={getAvatarUrl(selectedSeed)} 
              alt="Avatar" 
              className="w-full h-full object-cover"
            />
          </div>
          <button 
            onClick={generateRandom}
            className="absolute bottom-0 right-1/2 translate-x-12 bg-indigo-600 text-white p-2 rounded-full border-4 border-slate-50 shadow-lg active:scale-90 transition-transform"
            title="Tasodifiy"
          >
            <Dices size={18} />
          </button>
        </div>

        {/* --- TABS (Vkladkalar) --- */}
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 mb-4">
          <button 
            onClick={() => setActiveTab('boys')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'boys' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <User size={16} /> Yigitlar
          </button>
          <button 
            onClick={() => setActiveTab('girls')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'girls' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <Sparkles size={16} /> Qizlar
          </button>
          <button 
            onClick={() => setActiveTab('robots')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'robots' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <Bot size={16} /> Robotlar
          </button>
        </div>

        {/* Scrollable Grid Area */}
        <div className="flex-1 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col relative">
           <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none"></div>
           
           <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
              <div className="grid grid-cols-4 gap-3 pb-4">
                
                {/* 1. YIGITLAR */}
                {activeTab === 'boys' && BOYS.map((seed) => (
                  <button key={seed} onClick={() => handleSelect(seed, 'human')}
                    className={`aspect-square rounded-full flex items-center justify-center transition-all relative overflow-hidden bg-slate-50 border-2 ${selectedSeed === seed ? 'border-indigo-600 ring-2 ring-indigo-200 scale-105 z-10' : 'border-transparent hover:scale-105'}`}>
                    <img src={getAvatarUrl(seed)} alt={seed} className="w-full h-full" />
                    {selectedSeed === seed && <div className="absolute inset-0 bg-indigo-900/20 flex items-center justify-center"><Check size={20} className="text-white" strokeWidth={4} /></div>}
                  </button>
                ))}

                {/* 2. QIZLAR */}
                {activeTab === 'girls' && GIRLS.map((seed) => (
                  <button key={seed} onClick={() => handleSelect(seed, 'human')}
                    className={`aspect-square rounded-full flex items-center justify-center transition-all relative overflow-hidden bg-slate-50 border-2 ${selectedSeed === seed ? 'border-pink-500 ring-2 ring-pink-200 scale-105 z-10' : 'border-transparent hover:scale-105'}`}>
                    <img src={getAvatarUrl(seed)} alt={seed} className="w-full h-full" />
                    {selectedSeed === seed && <div className="absolute inset-0 bg-pink-900/20 flex items-center justify-center"><Check size={20} className="text-white" strokeWidth={4} /></div>}
                  </button>
                ))}

                {/* 3. ROBOTLAR */}
                {activeTab === 'robots' && ROBOTS.map((seed) => (
                  <button key={seed} onClick={() => handleSelect(seed, 'robot')}
                    className={`aspect-square rounded-2xl flex items-center justify-center transition-all relative overflow-hidden bg-slate-50 border-2 ${selectedSeed === `bot_${seed}` ? 'border-slate-700 ring-2 ring-slate-200 scale-105 z-10' : 'border-transparent hover:scale-105'}`}>
                    <img src={getAvatarUrl(`bot_${seed}`)} alt={seed} className="w-full h-full p-1" />
                    {selectedSeed === `bot_${seed}` && <div className="absolute inset-0 bg-slate-900/20 flex items-center justify-center"><Check size={20} className="text-white" strokeWidth={4} /></div>}
                  </button>
                ))}

              </div>
           </div>
           
           <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none"></div>
        </div>

        {/* Save Button */}
        <div className="flex-none mt-4 pb-2">
          <button 
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-4 text-white rounded-3xl font-black shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-[0.2em]
              ${activeTab === 'girls' ? 'bg-pink-500 shadow-pink-200' : activeTab === 'robots' ? 'bg-slate-700 shadow-slate-300' : 'bg-indigo-600 shadow-indigo-200'}
            `}
          >
            {saving ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Saqlash</>}
          </button>
        </div>

      </div>
    </div>
  );
};

export default StudentSettings;