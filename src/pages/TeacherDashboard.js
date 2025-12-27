import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { 
  Plus, Users, BookOpen, GraduationCap, 
  Settings, LogOut, ChevronRight, LayoutDashboard,
  ClipboardList
} from 'lucide-react';

const TeacherDashboard = () => {
  const [groups, setGroups] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Guruhlarni yuklash
  useEffect(() => {
    const fetchGroups = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate('/');
        return;
      }
      try {
        const q = query(collection(db, "groups"), where("teacherId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const groupsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGroups(groupsData);
      } catch (error) {
        console.error("Xatolik:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, [navigate]);

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
    <div className="flex min-h-screen bg-slate-50">
      
      {/* SIDEBAR - MENYU QISMI (ENG MUHIMI) */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col p-6 sticky top-0 h-screen">
        <div className="flex items-center space-x-3 mb-12 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg shadow-indigo-100">wp</div>
          <span className="font-black text-xl text-slate-800 tracking-tight">WebPro</span>
        </div>

        <nav className="flex-1 space-y-2">
          {/* Har bir tugmaga navigate qo'shildi */}
          <button 
            onClick={() => navigate('/teacher-dashboard')}
            className="w-full flex items-center space-x-3 px-4 py-3.5 bg-indigo-50 text-indigo-600 rounded-2xl font-bold transition-all"
          >
            <LayoutDashboard size={20} />
            <span>Guruhlar</span>
          </button>

          <button 
            onClick={() => navigate('/assignments')}
            className="w-full flex items-center space-x-3 px-4 py-3.5 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-2xl font-bold transition-all"
          >
            <ClipboardList size={20} />
            <span>Vazifalar</span>
          </button>

          <button 
            onClick={() => navigate('/grading')}
            className="w-full flex items-center space-x-3 px-4 py-3.5 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-2xl font-bold transition-all"
          >
            <GraduationCap size={20} />
            <span>Baholash</span>
          </button>

          <button 
            onClick={() => navigate('/settings')}
            className="w-full flex items-center space-x-3 px-4 py-3.5 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-2xl font-bold transition-all"
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

      {/* ASOSIY QISM */}
      <div className="flex-1 p-10 overflow-y-auto">
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
          <div className="flex justify-center items-center h-64">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
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
          </div>
        )}

        {groups.length === 0 && !loading && (
          <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
            <Users size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold">Hozircha guruhlar yo'q. Birinchisini yarating!</p>
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