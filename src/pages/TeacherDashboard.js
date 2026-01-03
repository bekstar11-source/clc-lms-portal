import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, addDoc, getDocs, query, where, documentId } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { 
  Plus, Users, Settings, LogOut, ChevronRight, LayoutDashboard,
  ClipboardList, Gamepad2, Trophy, Crown, Zap, GraduationCap
} from 'lucide-react';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('groups'); // 'groups', 'leaderboard', 'settings'
  const [groups, setGroups] = useState([]);
  const [allStudents, setAllStudents] = useState([]); // Reyting uchun barcha o'quvchilar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);

  // 1. GURUHLARNI YUKLASH
  useEffect(() => {
    const fetchGroups = async () => {
      const user = auth.currentUser;
      if (!user) { navigate('/'); return; }
      
      try {
        // O'qituvchining guruhlarini olamiz
        const q = query(collection(db, "groups"), where("teacherId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const groupsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGroups(groupsData);
      } catch (error) {
        console.error("Guruhlarni yuklashda xatolik:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, [navigate]);

  // 2. REYTING UCHUN O'QUVCHILARNI YUKLASH
  useEffect(() => {
    const fetchAllStudents = async () => {
      if (activeTab !== 'leaderboard' || groups.length === 0) return;
      
      setLoadingStats(true);
      try {
        // Barcha guruh ID larini olamiz
        const groupIds = groups.map(g => g.id);
        
        // Firestore cheklovi: 'in' operatori max 10 ta element qabul qiladi.
        // Agar guruhlar ko'p bo'lsa, buni bo'lib so'rov yuborish kerak.
        // Hozircha oddiy yechim: Barcha studentlarni olib filterlaymiz (Kichik loyihalar uchun)
        // Yoki guruhma-guruh yuramiz:
        
        let allStudentsData = [];
        
        // Har bir guruh ichidagi o'quvchilarni olib kelamiz
        for (const groupId of groupIds) {
             const q = query(collection(db, "students"), where("groupId", "==", groupId));
             const snap = await getDocs(q);
             const studs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
             allStudentsData = [...allStudentsData, ...studs];
        }

        // Ularni XP bo'yicha saralaymiz
        allStudentsData.sort((a, b) => (b.gameXp || 0) - (a.gameXp || 0));
        setAllStudents(allStudentsData);
        
      } catch (error) {
        console.error("Statistika yuklashda xatolik:", error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchAllStudents();
  }, [activeTab, groups]);

  // YANGI GURUH QO'SHISH
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    try {
      const docRef = await addDoc(collection(db, "groups"), {
        name: newGroupName,
        teacherId: user.uid,
        createdAt: new Date()
      });
      setGroups([...groups, { id: docRef.id, name: newGroupName }]);
      setIsModalOpen(false);
      setNewGroupName('');
    } catch (error) {
      alert("Xatolik: " + error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      
      {/* SIDEBAR */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col p-6 sticky top-0 h-screen z-20">
        <div className="flex items-center space-x-3 mb-10 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg shadow-indigo-100">wp</div>
          <span className="font-black text-xl text-slate-800 tracking-tight">WebPro</span>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab('groups')}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl font-bold transition-all ${activeTab === 'groups' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
          >
            <LayoutDashboard size={20} />
            <span>Guruhlar</span>
          </button>

          <button 
            onClick={() => setActiveTab('leaderboard')}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl font-bold transition-all ${activeTab === 'leaderboard' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
          >
            <Gamepad2 size={20} />
            <span>O'yin Reytingi</span>
          </button>

          <button 
            onClick={() => setActiveTab('grading')}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl font-bold transition-all ${activeTab === 'grading' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
          >
            <GraduationCap size={20} />
            <span>Baholash</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl font-bold transition-all ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
          >
            <Settings size={20} />
            <span>Sozlamalar</span>
          </button>
        </nav>

        <button onClick={handleLogout} className="mt-auto flex items-center space-x-3 px-4 py-4 text-slate-400 hover:text-red-500 font-bold transition-colors">
          <LogOut size={20} />
          <span>Chiqish</span>
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 p-8 md:p-12 overflow-y-auto">
        
        {/* --- 1. GURUHLAR TABI --- */}
        {activeTab === 'groups' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Mening Guruhlarim</h1>
                <p className="text-slate-400 font-medium mt-1">Sizda {groups.length} ta faol guruh mavjud</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-2xl font-black shadow-lg shadow-indigo-100 transition-all active:scale-95"
              >
                <Plus size={20} className="mr-2" />
                Yangi Guruh
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {groups.map((group) => (
                  <div 
                    key={group.id} 
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group border-b-4 border-b-indigo-500"
                  >
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                      <Users size={28} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2 truncate">{group.name}</h3>
                    <p className="text-slate-400 text-sm font-bold mb-6 uppercase tracking-widest">Active Group</p>
                    
                    <button 
                      onClick={() => navigate(`/group/${group.id}`)}
                      className="w-full flex items-center justify-center space-x-2 py-3.5 bg-slate-50 text-slate-600 rounded-2xl font-black transition-all hover:bg-indigo-600 hover:text-white"
                    >
                      <span>Guruhni ko'rish</span>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                ))}
                {groups.length === 0 && (
                  <div className="col-span-full text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                    <Users size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold">Hozircha guruhlar yo'q. Birinchisini yarating!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- 2. O'YIN REYTINGI TABI --- */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-3xl font-black flex items-center gap-3">
                  <Trophy className="text-yellow-300" size={32} />
                  Guruhlar Reytingi
                </h2>
                <p className="text-indigo-100 mt-2 font-medium">
                  Barcha guruhlaringizdagi eng faol o'quvchilar ro'yxati (XP bo'yicha)
                </p>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            </div>

            {/* Reyting Jadvali */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
              {loadingStats ? (
                <div className="flex justify-center items-center h-full py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
              ) : (!allStudents || allStudents.length === 0) ? (
                <div className="p-20 text-center text-slate-400">
                  <Gamepad2 size={64} className="mx-auto mb-4 opacity-20" />
                  <p className="font-bold">Hozircha o'quvchilar yo'q yoki o'yin o'ynashmagan</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-4 p-5 bg-slate-50 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-5 md:col-span-6">O'quvchi</div>
                    <div className="col-span-3 md:col-span-3">Guruh</div>
                    <div className="col-span-3 md:col-span-2 text-right">To'plangan XP</div>
                  </div>

                  {/* Students List */}
                  {allStudents.map((student, index) => {
                    let rankStyle = "bg-slate-100 text-slate-500";
                    let rowStyle = "hover:bg-slate-50";
                    
                    if (index === 0) {
                      rankStyle = "bg-yellow-100 text-yellow-600 border border-yellow-200"; 
                      rowStyle = "bg-yellow-50/40 hover:bg-yellow-50/60";
                    } else if (index === 1) {
                      rankStyle = "bg-slate-200 text-slate-600 border border-slate-300";   
                    } else if (index === 2) {
                      rankStyle = "bg-orange-100 text-orange-600 border border-orange-200"; 
                    }

                    // Guruh nomini topish
                    const studentGroup = groups.find(g => g.id === student.groupId)?.name || "Noma'lum";

                    return (
                      <div key={student.id} className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors ${rowStyle}`}>
                        <div className="col-span-1 flex justify-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${rankStyle}`}>
                            {index + 1}
                          </div>
                        </div>
                        <div className="col-span-5 md:col-span-6 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                            <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${student.avatarSeed || student.name}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`} alt="av" className="w-full h-full object-cover"/>
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-700 text-sm truncate">{student.name}</h4>
                            {index === 0 && <span className="text-[9px] text-yellow-600 font-black uppercase tracking-widest flex items-center gap-1"><Crown size={10}/> Chempion</span>}
                          </div>
                        </div>
                        <div className="col-span-3 md:col-span-3">
                           <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider truncate block w-fit max-w-full">
                             {studentGroup}
                           </span>
                        </div>
                        <div className="col-span-3 md:col-span-2 text-right">
                          <div className="inline-flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                            <Zap size={14} className="text-indigo-500 fill-indigo-500" />
                            <span className="font-black text-indigo-700 text-sm">{(student.gameXp || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* GURUH YARATISH MODALI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md relative z-10 p-10 animate-in fade-in zoom-in duration-200">
            <h3 className="text-2xl font-black text-slate-800 mb-6">Yangi Guruh Qo'shish</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <input 
                type="text" placeholder="Guruh nomi (masalan: IELTS 7.0)" required
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
              />
              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-bold">Bekor</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100">Yaratish</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;