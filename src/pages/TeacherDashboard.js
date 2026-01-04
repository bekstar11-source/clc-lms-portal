import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { 
  Users, ChevronRight, LayoutGrid, Loader2, 
  Megaphone, Calendar, Sparkles, BookOpen, Layers
} from 'lucide-react';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState('');
  const [groups, setGroups] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      
      try {
        const userDoc = await getDoc(doc(db, "students", currentUser.uid));
        if (userDoc.exists()) setTeacherName(userDoc.data().name);

        const annQuery = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
        const annSnap = await getDocs(annQuery);
        setAnnouncements(annSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const groupsQuery = query(collection(db, "groups"), where("teacherId", "==", currentUser.uid));
        const groupsSnap = await getDocs(groupsQuery);
        setGroups(groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto min-h-screen bg-slate-50/50 pb-24 md:pb-10">
      
      {/* HEADER: Mobil uchun ixcham */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-3 animate-in fade-in slide-in-from-top-4 duration-700">
        <div>
           <div className="flex items-center gap-2 mb-1">
              <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                 <Sparkles size={10}/> Teacher Panel
              </span>
           </div>
           <h1 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight leading-tight">
              Salom, <span className="text-indigo-600">{teacherName.split(' ')[0]}</span>!
           </h1>
           <p className="text-slate-400 font-bold text-[10px] md:text-xs mt-0.5">Bugun darslar qanday?</p>
        </div>
        
        {/* Guruh soni (Faqat Tablet/PC da ko'rinadi) */}
        <div className="hidden md:flex bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm items-center gap-3">
            <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jami Guruhlar</p>
                <p className="text-xl font-black text-indigo-600 leading-none">{groups.length}</p>
            </div>
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <Layers size={20}/>
            </div>
        </div>
      </div>

      {/* --- E'LONLAR (MOBILE SCROLL) --- */}
      {announcements.length > 0 && (
        <div className="mb-6 md:mb-10 animate-in slide-in-from-top-6 duration-700 delay-100">
          <div className="flex items-center gap-2 mb-3 px-1">
             <div className="bg-amber-500 p-1 rounded-md text-white shadow-lg shadow-amber-200"><Megaphone size={12}/></div>
             <h2 className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Admin E'lonlari</h2>
          </div>
          
          {/* Mobileda Horizontal Scroll, PCda Grid */}
          <div className="flex overflow-x-auto pb-4 md:pb-0 md:grid md:grid-cols-2 gap-3 md:gap-4 snap-x custom-scrollbar">
            {announcements.map((ann) => (
              <div key={ann.id} className="min-w-[85%] md:min-w-0 snap-center bg-white p-4 md:p-5 rounded-2xl md:rounded-[1.5rem] border border-slate-100 shadow-sm md:shadow-lg relative overflow-hidden group hover:border-amber-200 transition-colors">
                 <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                       <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${ann.targetType === 'teachers' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                           {ann.targetName || 'Admin'}
                       </span>
                       <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                          <Calendar size={10}/>
                          {ann.createdAt?.seconds ? new Date(ann.createdAt.seconds * 1000).toLocaleDateString() : 'Hozirgina'}
                       </span>
                    </div>
                    <p className="font-bold text-slate-700 text-xs md:text-sm leading-relaxed line-clamp-2 md:line-clamp-none">{ann.text}</p>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- GURUHLAR (COMPACT GRID) --- */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-1">
             <div className="bg-indigo-600 p-1 rounded-md text-white shadow-lg shadow-indigo-200"><LayoutGrid size={12}/></div>
             <h2 className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Guruhlarim ({groups.length})</h2>
        </div>

        {/* MOBILE: grid-cols-2 (2 ta ustun), kichik gap (gap-3)
            PC: grid-cols-3, katta gap (gap-6)
        */}
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            {groups.length === 0 ? (
                <div className="col-span-full text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-300">
                    <LayoutGrid className="mx-auto text-slate-300 mb-3" size={32} />
                    <p className="font-bold text-slate-400 text-xs">Guruhlar mavjud emas.</p>
                </div>
            ) : (
                groups.map((group, index) => {
                  const variants = [
                     { from: 'from-blue-500', to: 'to-indigo-600', shadow: 'shadow-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-600' },
                     { from: 'from-emerald-400', to: 'to-teal-600', shadow: 'shadow-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-600' },
                     { from: 'from-rose-400', to: 'to-pink-600', shadow: 'shadow-rose-200', bg: 'bg-rose-50', text: 'text-rose-600' },
                     { from: 'from-amber-400', to: 'to-orange-600', shadow: 'shadow-orange-200', bg: 'bg-orange-50', text: 'text-orange-600' },
                  ];
                  const style = variants[index % variants.length];

                  return (
                    <div 
                        key={group.id} 
                        onClick={() => navigate(`/group/${group.id}`)}
                        className={`group relative bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-4 md:p-8 shadow-md md:shadow-xl ${style.shadow} border border-slate-50 cursor-pointer active:scale-95 md:hover:-translate-y-2 transition-all duration-300 overflow-hidden flex flex-col justify-between h-[160px] md:h-auto`}
                    >
                        {/* Desktop uchun Orqa fon bezagi (Mobilda yashiramiz) */}
                        <div className={`hidden md:block absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br ${style.from} ${style.to} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`}></div>

                        <div className="relative z-10">
                            {/* Ikonka: Mobilda kichikroq */}
                            <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br ${style.from} ${style.to} flex items-center justify-center text-white shadow-md mb-3 md:mb-6`}>
                                <BookOpen className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
                            </div>
                            
                            {/* Guruh Nomi */}
                            <h3 className="text-sm md:text-xl font-black text-slate-800 mb-1 leading-tight line-clamp-2 md:group-hover:text-indigo-600 transition-colors">
                                {group.name}
                            </h3>
                            
                            <p className={`text-[8px] md:text-[10px] font-black uppercase tracking-wider ${style.text} opacity-80`}>
                                Active Class
                            </p>
                        </div>

                        {/* Footer: Faqat PC da to'liq ko'rinadi */}
                        <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                            <div className="hidden md:flex -space-x-2">
                               {[1,2,3].map(i => (
                                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-400"><Users size={12}/></div>
                               ))}
                            </div>
                            {/* Mobilda faqat strelka yoki "Kirish" yozuvi qolishi mumkin */}
                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${style.bg} flex items-center justify-center ${style.text} md:bg-slate-50 md:text-slate-400 md:group-hover:bg-indigo-600 md:group-hover:text-white transition-all ml-auto`}>
                                <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                            </div>
                        </div>
                    </div>
                  );
                })
            )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;