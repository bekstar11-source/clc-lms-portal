import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, Users, ArrowRight, BookOpen, 
  Star 
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
      const q = query(collection(db, "groups"), where("teacherId", "==", user.uid), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      const groupsData = await Promise.all(querySnapshot.docs.map(async (doc) => {
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
      {/* Header - Mobil uchun kichraytirildi */}
      <div className="flex justify-between items-center mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight uppercase italic leading-none">My Classes</h1>
          <p className="text-slate-400 font-bold text-[10px] md:text-xs uppercase tracking-widest mt-1 md:mt-2">Manage curriculum</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-slate-900 text-white p-3 md:p-4 rounded-xl md:rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={20} className="md:w-6 md:h-6" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold animate-pulse text-xs uppercase tracking-widest">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {groups.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-white rounded-[2rem] md:rounded-[3rem] border border-dashed border-slate-200">
               <p className="text-slate-400 font-bold text-sm">Hozircha guruhlar yo'q</p>
               <button onClick={() => setIsModalOpen(true)} className="mt-4 text-indigo-600 font-black uppercase text-[10px] tracking-widest">Guruh yaratish</button>
            </div>
          ) : (
            groups.map((group, index) => {
              const gradientClass = cardGradients[index % cardGradients.length];

              return (
                <Link 
                  to={`/group/${group.id}`} 
                  key={group.id} 
                  className={`relative group overflow-hidden rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-8 min-h-[160px] md:min-h-[220px] flex flex-col justify-between transition-all duration-300 hover:scale-[1.01] bg-gradient-to-br ${gradientClass} shadow-lg text-white`}
                >
                  <BookOpen className="absolute -right-4 -bottom-4 md:-right-6 md:-bottom-6 w-32 h-32 md:w-40 md:h-40 text-white opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
                  
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3 md:mb-4">
                       <span className="bg-white/20 backdrop-blur-md px-2 md:px-3 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-white/10">
                         Class {index + 1}
                       </span>
                       <div className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10">
                          <Star className="text-white w-3 h-3 md:w-5 md:h-5 fill-white/50" />
                       </div>
                    </div>
                    
                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-tight mb-2 break-words max-w-[90%]">
                      {group.name}
                    </h2>
                  </div>

                  <div className="relative z-10 flex items-center justify-between mt-4 md:mt-6 pt-4 md:pt-6 border-t border-white/20">
                    <div className="flex items-center gap-2">
                       <Users size={16} className="md:w-[18px] md:h-[18px] text-white/80" />
                       <span className="font-bold text-xs md:text-sm">{group.studentCount} Students</span>
                    </div>
                    <div className="bg-white text-slate-900 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-all">
                       <ArrowRight size={18} className="md:w-5 md:h-5" />
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
          <div className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl md:text-2xl font-black text-slate-800 mb-6 uppercase text-center italic">New Class</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <input 
                type="text" 
                autoFocus
                placeholder="Ex: IELTS Intensive" 
                className="w-full px-5 py-3 md:px-6 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:text-base"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <button 
                type="submit" 
                className="w-full py-3 md:py-4 bg-indigo-600 text-white rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-[0.2em] shadow-lg shadow-indigo-200 active:scale-95 transition-transform"
              >
                Create
              </button>
            </form>
            <button onClick={() => setIsModalOpen(false)} className="w-full mt-3 py-2 text-slate-400 font-bold text-[10px] uppercase hover:text-slate-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupList;