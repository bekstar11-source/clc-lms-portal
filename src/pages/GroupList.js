import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { Users, ChevronRight, LayoutGrid, Loader2 } from 'lucide-react';

const GroupList = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      const user = auth.currentUser;
      if (!user) return;
      
      try {
        // 1. Foydalanuvchi rolini aniqlaymiz
        const userRef = doc(db, "students", user.uid);
        const userSnap = await getDoc(userRef);
        const role = userSnap.exists() ? userSnap.data().role : 'student';

        let q;
        
        // 2. LOGIKA: 
        // Agar ADMIN bo'lsa -> Hamma guruhlarni olib kelamiz.
        // Agar TEACHER bo'lsa -> Faqat o'ziga biriktirilganini.
        if (role === 'admin') {
            q = query(collection(db, "groups"));
        } else {
            q = query(collection(db, "groups"), where("teacherId", "==", user.uid));
        }

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
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase italic">Guruhlar</h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
             {/* Admin va Teacherni ajratib ko'rsatish shart emas, umumiy sarlavha */}
             Faol O'quv Guruhlari
          </p>
        </div>
      </div>

      {/* GURUHLAR RO'YXATI */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
          {groups.length === 0 ? (
              <div className="col-span-full text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-300">
                  <LayoutGrid className="mx-auto text-slate-300 mb-4" size={48} />
                  <p className="font-bold text-slate-400">Guruhlar mavjud emas.</p>
              </div>
          ) : (
              groups.map((group) => (
              <div key={group.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:translate-y-[-4px] transition-all group relative overflow-hidden">
                  <div className="relative z-10">
                  <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg">
                      <Users size={24} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-1 truncate">{group.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">Active Class</p>
                  
                  {/* KIRISH TUGMASI (GroupDetails ga olib boradi) */}
                  <button 
                      onClick={() => navigate(`/group/${group.id}`)}
                      className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                      Boshqarish <ChevronRight size={14} />
                  </button>
                  </div>
              </div>
              ))
          )}
      </div>
    </div>
  );
};

export default GroupList;