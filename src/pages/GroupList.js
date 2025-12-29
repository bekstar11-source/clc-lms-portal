import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, Users, ArrowRight, BookOpen, 
  MoreHorizontal, Calendar, Star 
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';

const GroupList = () => {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Ranglar palitrasi (Gradientlar)
  const cardGradients = [
    "from-violet-600 to-indigo-600 shadow-indigo-200",
    "from-emerald-500 to-teal-600 shadow-emerald-200",
    "from-amber-400 to-orange-500 shadow-orange-200",
    "from-pink-500 to-rose-600 shadow-rose-200",
    "from-blue-400 to-cyan-500 shadow-blue-200",
    "from-fuchsia-600 to-purple-600 shadow-fuchsia-200",
  ];

  const fetchGroups = async () => {
    const user = auth.currentUser;
    if (!user) { navigate('/login'); return; }

    try {
      // Guruhlar
      const q = query(collection(db, "groups"), where("teacherId", "==", user.uid), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      const groupsData = await Promise.all(querySnapshot.docs.map(async (doc) => {
        // Har bir guruh uchun o'quvchilar sonini hisoblash
        const qStudents = query(collection(db, "students"), where("groupId", "==", doc.id));
        const snapStudents = await getDocs(qStudents);
        return { 
          id: doc.id, 
          ...doc.data(),
          studentCount: snapStudents.size 
        };
      }));

      setGroups(groupsData);
    } catch (error) {
      console.error("Error fetching groups: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [navigate]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const user = auth.currentUser;
    try {
      await addDoc(collection(db, "groups"), {
        name: newGroupName,
        teacherId: user.uid,
        createdAt: serverTimestamp(),
      });
      setNewGroupName('');
      setIsModalOpen(false);
      fetchGroups();
    } catch (error) {
      console.error("Error creating group: ", error);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase italic">My Classes</h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Manage your students & curriculum</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl shadow-slate-200 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold animate-pulse">Yuklanmoqda...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
               <p className="text-slate-400 font-bold">Hozircha guruhlar yo'q</p>
               <button onClick={() => setIsModalOpen(true)} className="mt-4 text-indigo-600 font-black uppercase text-xs tracking-widest">Guruh yaratish</button>
            </div>
          ) : (
            groups.map((group, index) => {
              // Har bir kartaga tartib bo'yicha rang berish
              const gradientClass = cardGradients[index % cardGradients.length];

              return (
                <Link 
                  to={`/group/${group.id}`} 
                  key={group.id} 
                  className={`relative group overflow-hidden rounded-[2.5rem] p-8 min-h-[220px] flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 bg-gradient-to-br ${gradientClass} shadow-lg text-white`}
                >
                  {/* Orqa fondagi bezak ikonkasi */}
                  <BookOpen className="absolute -right-6 -bottom-6 w-40 h-40 text-white opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
                  
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                       <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                         Class {index + 1}
                       </span>
                       <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10">
                          <Star className="text-white w-5 h-5 fill-white/50" />
                       </div>
                    </div>
                    
                    <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-2 break-words">
                      {group.name}
                    </h2>
                  </div>

                  <div className="relative z-10 flex items-center justify-between mt-6 pt-6 border-t border-white/20">
                    <div className="flex items-center gap-2">
                       <Users size={18} className="text-white/80" />
                       <span className="font-bold text-sm">{group.studentCount} Students</span>
                    </div>
                    <div className="bg-white text-slate-900 w-10 h-10 rounded-full flex items-center justify-center shadow-lg group-hover:w-12 group-hover:h-12 transition-all">
                       <ArrowRight size={20} />
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-slate-800 mb-6 uppercase text-center italic">New Class</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <input 
                type="text" 
                autoFocus
                placeholder="Ex: IELTS Intensive" 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <button 
                type="submit" 
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-indigo-200 active:scale-95 transition-transform"
              >
                Create
              </button>
            </form>
            <button onClick={() => setIsModalOpen(false)} className="w-full mt-3 py-3 text-slate-400 font-bold text-xs uppercase hover:text-slate-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupList;