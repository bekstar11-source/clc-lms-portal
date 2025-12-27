import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, ArrowRight, GraduationCap } from 'lucide-react';

const GroupList = () => {
  const [groups, setGroups] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, "groups"), where("teacherId", "==", user.uid));
    const snap = await getDocs(q);
    setGroups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  const handleAddGroup = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    try {
      await addDoc(collection(db, "groups"), {
        name: newGroupName,
        teacherId: user.uid,
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setNewGroupName('');
      fetchGroups();
    } catch (e) { alert(e.message); }
  };

  if (loading) return <div className="p-10 text-center text-indigo-600 font-black">Yuklanmoqda...</div>;

  return (
    <div className="p-4 sm:p-12 max-w-7xl mx-auto font-sans bg-slate-50 min-h-screen pb-24">
      {/* TOP HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter italic">Mening Guruhlarim</h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] mt-2">
            Sizda {groups.length} ta faol guruh mavjud
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center"
        >
          <Plus size={18} className="mr-2" /> Yangi Guruh
        </button>
      </div>

      {/* GROUPS GRID */}
      {groups.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {groups.map((group) => (
            <div 
              key={group.id} 
              onClick={() => navigate(`/group/${group.id}`)}
              className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-100 hover:-translate-y-2 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-6">
                 <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl font-black border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Users size={24} />
                 </div>
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{group.name}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Group</p>
              
              <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between text-slate-400 group-hover:text-indigo-600 transition-colors">
                <span className="text-[10px] font-black uppercase tracking-widest">Guruhni ko'rish</span>
                <ArrowRight size={16} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-[3rem] border border-slate-100">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <GraduationCap size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-800">Guruhlar yo'q</h3>
          <p className="text-slate-400 mt-2">Darslarni boshlash uchun yangi guruh yarating.</p>
        </div>
      )}

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-md relative z-10 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-800 mb-6 uppercase italic">Yangi Guruh Nomi</h3>
            <form onSubmit={handleAddGroup} className="space-y-4">
              <input 
                type="text" required placeholder="Masalan: IELTS Foundation"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              />
              <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all">
                Guruhni Yaratish
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupList;