import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { 
  Users, ChevronRight, LayoutGrid, Loader2, 
  Megaphone, Bell, Calendar, Sparkles, BookOpen, Layers
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
        // Ismni olish
        const userDoc = await getDoc(doc(db, "students", currentUser.uid));
        if (userDoc.exists()) setTeacherName(userDoc.data().name);

        // E'lonlar
        const annQuery = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
        const annSnap = await getDocs(annQuery);
        setAnnouncements(annSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Guruhlar
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
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      
      {/* HEADER: SALOM USTOZ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
        <div>
           <div className="flex items-center gap-2 mb-1">
              <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                 <Sparkles size={10}/> Teacher Panel
              </span>
           </div>
           <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
              Xush kelibsiz, <span className="text-indigo-600">{teacherName.split(' ')[0]}</span>!
           </h1>
           <p className="text-slate-400 font-bold text-xs mt-1">Bugun qaysi guruh bilan ishlashni xohlaysiz?</p>
        </div>
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

      {/* --- E'LONLAR (MOBILE UCHUN IXCHAM) --- */}
      {announcements.length > 0 && (
        <div className="mb-10 animate-in slide-in-from-top-6 duration-700 delay-100">
          <div className="flex items-center gap-2 mb-4 px-1">
             <div className="bg-amber-500 p-1.5 rounded-lg text-white shadow-lg shadow-amber-200"><Megaphone size={14}/></div>
             <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Admin E'lonlari</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {announcements.map((ann) => (
              <div key={ann.id} className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-lg shadow-slate-100 relative overflow-hidden group hover:border-amber-200 transition-colors">
                 {/* Bezak */}
                 <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-100 to-orange-50 rounded-bl-[3rem] -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                 
                 <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                       <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${ann.targetType === 'teachers' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                           {ann.targetName || 'Admin'}
                       </span>
                       <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <Calendar size={10}/>
                          {ann.createdAt?.seconds ? new Date(ann.createdAt.seconds * 1000).toLocaleDateString() : 'Hozirgina'}
                       </span>
                    </div>
                    <p className="font-bold text-slate-700 text-sm leading-relaxed">{ann.text}</p>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- GURUHLAR (ASOSIY KREATIV QISM) --- */}
      <div>
        <div className="flex items-center gap-2 mb-5 px-1">
             <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-lg shadow-indigo-200"><LayoutGrid size={14}/></div>
             <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Sizning Guruhlaringiz</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 pb-20">
            {groups.length === 0 ? (
                <div className="col-span-full text-center py-24 bg-white rounded-[2.5rem] border border-dashed border-slate-300">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LayoutGrid className="text-slate-300" size={32} />
                    </div>
                    <p className="font-bold text-slate-400">Hozircha guruhlar yo'q.</p>
                </div>
            ) : (
                groups.map((group, index) => {
                  // Har xil ranglar uchun (Zerikarli bo'lmasligi uchun)
                  const variants = [
                     { from: 'from-blue-500', to: 'to-indigo-600', shadow: 'shadow-indigo-200', bg: 'bg-indigo-50' },
                     { from: 'from-emerald-400', to: 'to-teal-600', shadow: 'shadow-emerald-200', bg: 'bg-emerald-50' },
                     { from: 'from-rose-400', to: 'to-pink-600', shadow: 'shadow-rose-200', bg: 'bg-rose-50' },
                     { from: 'from-amber-400', to: 'to-orange-600', shadow: 'shadow-orange-200', bg: 'bg-orange-50' },
                  ];
                  const style = variants[index % variants.length];

                  return (
                    <div 
                        key={group.id} 
                        onClick={() => navigate(`/group/${group.id}`)}
                        className={`group relative bg-white rounded-[2.5rem] p-8 shadow-xl ${style.shadow} border border-white cursor-pointer hover:-translate-y-2 hover:shadow-2xl transition-all duration-300 overflow-hidden`}
                    >
                        {/* Orqa fon bezagi (Abstract Blob) */}
                        <div className={`absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br ${style.from} ${style.to} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`}></div>

                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div>
                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${style.from} ${style.to} flex items-center justify-center text-white shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                    <BookOpen size={24} strokeWidth={2.5} />
                                </div>
                                
                                <h3 className="text-xl font-black text-slate-800 mb-2 leading-tight group-hover:text-indigo-600 transition-colors">
                                    {group.name}
                                </h3>
                                
                                <div className="flex items-center gap-2">
                                   <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${style.bg} text-slate-500`}>
                                      Active Class
                                   </span>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center">
                                <div className="flex -space-x-2">
                                   {/* Dummy Avatars effect */}
                                   {[1,2,3].map(i => (
                                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-400">
                                         <Users size={12}/>
                                      </div>
                                   ))}
                                </div>
                                <button className={`w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300`}>
                                    <ChevronRight size={20} />
                                </button>
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