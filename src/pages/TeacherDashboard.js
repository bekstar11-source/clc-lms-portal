import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { 
  collection, getDocs, query, where, doc, getDoc, updateDoc, onSnapshot 
} from 'firebase/firestore';
import { 
  LayoutGrid, Sparkles, BookOpen, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, 
  Bell, Search, ArrowRight, MessageCircle 
} from 'lucide-react';

// --- SKELETON LOADER ---
const DashboardSkeleton = () => (
  <div className="p-4 space-y-6 max-w-7xl mx-auto pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="h-32 w-full bg-slate-200 rounded-[2rem] animate-pulse"></div>
      <div className="grid grid-cols-2 gap-4">
          <div className="h-40 bg-slate-200 rounded-[2rem] animate-pulse"></div>
          <div className="h-40 bg-slate-200 rounded-[2rem] animate-pulse"></div>
      </div>
  </div>
);

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation(); // 👈 Hozirgi manzilni olish uchun kerak
  const [teacherName, setTeacherName] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retakeAlerts, setRetakeAlerts] = useState([]);
  const [debtors, setDebtors] = useState([]);
  
  // 🔥 O'qilmagan xabarlar soni
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  const [activeTab, setActiveTab] = useState('groups');

  const triggerHaptic = (type = 'tap') => {
    if (navigator.vibrate) {
        if(type === 'tap') navigator.vibrate(10);
        if(type === 'success') navigator.vibrate([10, 50, 10]);
    }
  };

  useEffect(() => {
    if (location.pathname === '/debtors') setActiveTab('debtors');
    else setActiveTab('groups');
  }, [location.pathname]);

  // 1. MA'LUMOTLARNI YUKLASH
  useEffect(() => {
    const fetchData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      
      try {
        const userRef = doc(db, "students", currentUser.uid);
        const groupsQuery = query(collection(db, "groups"), where("teacherId", "==", currentUser.uid));
        
        const [userDoc, groupsSnap] = await Promise.all([
            getDoc(userRef),
            getDocs(groupsQuery)
        ]);

        if (userDoc.exists()) setTeacherName(userDoc.data().name);
        const fetchedGroups = groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGroups(fetchedGroups);

        const groupsDataPromises = fetchedGroups.map(async (grp) => {
            const qStudents = query(collection(db, "students"), where("groupId", "==", grp.id));
            const qGrades = query(collection(db, "grades"), where("groupId", "==", grp.id));
            const [studSnap, gradesSnap] = await Promise.all([getDocs(qStudents), getDocs(qGrades)]);
            return {
                groupName: grp.name,
                groupId: grp.id,
                students: studSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                grades: gradesSnap.docs.map(d => d.data()),
                gradeDocs: gradesSnap.docs
            };
        });

        const allGroupsData = await Promise.all(groupsDataPromises);

        let alerts = [];
        let allDebtors = [];

        allGroupsData.forEach(({ groupName, groupId, students, grades, gradeDocs }) => {
            const studentsMap = {};
            students.forEach(s => studentsMap[s.id] = s.name);

            // Retakes logic
            gradeDocs.forEach(d => {
                const g = d.data();
                if (g.status === 'retake_submitted') {
                    alerts.push({ 
                        id: d.id, 
                        studentName: studentsMap[g.studentId] || 'Unknown', 
                        groupName: groupName, 
                        topic: g.comment,
                        groupId: groupId, 
                        studentId: g.studentId,
                        highlightKey: `${g.lessonId}_${g.taskType}`,
                        date: g.date ? g.date.toDate() : new Date()
                    });
                }
            });

            // Debtors logic
            students.forEach(student => {
                const studentGrades = grades.filter(g => g.studentId === student.id);
                const validGrades = studentGrades.map(g => Number(g.score)).filter(s => !isNaN(s));
                let average = 0;
                if (validGrades.length > 0) average = Math.round(validGrades.reduce((a, b) => a + b, 0) / validGrades.length);

                if (average < 60 && validGrades.length > 0) {
                    allDebtors.push({
                        id: student.id,
                        name: student.name,
                        groupId: groupId,
                        groupName: groupName,
                        averageScore: average,
                        avatarSeed: student.avatarSeed
                    });
                }
            });
        });

        setRetakeAlerts(alerts.sort((a,b) => b.date - a.date));
        setDebtors(allDebtors.sort((a, b) => a.averageScore - b.averageScore));

      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  // 2. 🔥 REALTIME CHAT ALERTS
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "chats"), 
      where("participants", "array-contains", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalUnread = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.unreadCounts && data.unreadCounts[auth.currentUser.uid]) {
          totalUnread += data.unreadCounts[auth.currentUser.uid];
        }
      });
      setUnreadMessages(totalUnread);
    });

    return () => unsubscribe();
  }, []);

  const handleAlertClick = (alert) => {
      triggerHaptic();
      navigate(`/group/${alert.groupId}`, { state: { openStudentId: alert.studentId, highlightKey: alert.highlightKey } });
  };

  const handleRejectRetake = async (e, alertId) => {
      e.stopPropagation();
      triggerHaptic();
      if(!window.confirm("Rad etasizmi?")) return;
      try {
          await updateDoc(doc(db, "grades", alertId), { status: 'retake_needed' });
          setRetakeAlerts(prev => prev.filter(a => a.id !== alertId));
          triggerHaptic('success');
      } catch (error) { alert(error.message); }
  };

  const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/notionists/svg?seed=${seed || 'teacher'}&backgroundColor=e0e7ff,c7d2fe`;

  if (loading) return <div className="min-h-screen bg-slate-50"><DashboardSkeleton /></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-10 font-sans touch-manipulation">
      
      {/* --- HEADER --- */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4 pt-[calc(1rem+env(safe-area-inset-top))] flex justify-between items-center transition-all duration-300">
         <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-0.5">
               <Sparkles size={10} className="text-indigo-500"/> Teacher Portal
            </p>
            <h1 className="text-xl font-black text-slate-800">
                Hi, <span className="text-indigo-600">{teacherName.split(' ')[0]}</span>
            </h1>
         </div>

         <div className="flex items-center gap-3">
             {/* Desktop Chat Button */}
             <button 
                onClick={() => {triggerHaptic(); navigate('/chat');}} 
                className="hidden md:flex p-2.5 bg-white text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm border border-slate-100 active:scale-95 transition-all relative"
             >
                <MessageCircle size={20}/>
                {unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
             </button>

             <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 overflow-hidden shadow-sm">
                 <img src={getAvatarUrl(teacherName)} alt="me" className="w-full h-full object-cover"/>
             </div>
         </div>
      </div>

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        
        {/* GROUPS TAB */}
        {activeTab === 'groups' && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                {retakeAlerts.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-3 px-2">
                            <div className="flex items-center gap-2">
                                <div className="relative"><Bell size={18} className="text-indigo-600" /><span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span></div>
                                <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Tekshiruv ({retakeAlerts.length})</h2>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Swipe &rarr;</span>
                        </div>
                        <div className="flex overflow-x-auto gap-3 pb-4 -mx-4 px-6 scrollbar-hide snap-x">
                            {retakeAlerts.map((alert, idx) => (
                                <div key={idx} onClick={() => handleAlertClick(alert)} className="snap-center shrink-0 w-[260px] bg-white p-4 rounded-[1.5rem] border border-indigo-100 shadow-sm shadow-indigo-100/50 relative overflow-hidden active:scale-[0.98] transition-transform">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 truncate max-w-[120px]">{alert.groupName}</span>
                                        <button onClick={(e) => handleRejectRetake(e, alert.id)} className="w-6 h-6 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors"><XCircle size={14}/></button>
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-sm truncate">{alert.studentName}</h4>
                                    <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{alert.topic}</p>
                                    <div className="mt-3 flex items-center gap-1 text-[10px] font-black text-indigo-500 uppercase tracking-wide">Tekshirish <ArrowRight size={12}/></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {groups.map((group, index) => {
                        const style = index % 2 === 0 ? 'from-blue-500 to-indigo-600' : 'from-emerald-400 to-teal-600';
                        return (
                            <div key={group.id} onClick={() => { triggerHaptic(); navigate(`/group/${group.id}`); }} className="relative bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-50 cursor-pointer active:scale-[0.97] transition-all flex flex-col justify-between min-h-[150px]">
                                <div>
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style} flex items-center justify-center text-white shadow-md mb-3`}><BookOpen size={18} strokeWidth={2.5} /></div>
                                    <h3 className="text-sm font-black text-slate-800 leading-tight line-clamp-2">{group.name}</h3>
                                    <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-indigo-600 opacity-80">Active Class</p>
                                </div>
                                <div className="mt-3 flex justify-end"><div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600"><ChevronRight size={16} /></div></div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* DEBTORS TAB */}
        {activeTab === 'debtors' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    {debtors.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4"><Sparkles className="text-emerald-500" size={32}/></div>
                            <h3 className="text-sm font-black text-slate-800">Hammasi joyida!</h3>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {debtors.map((student, idx) => (
                                <div key={idx} onClick={() => { triggerHaptic(); navigate(`/group/${student.groupId}`, { state: { openStudentId: student.id }})}} className="p-4 hover:bg-red-50/20 transition-colors cursor-pointer flex items-center justify-between gap-3 active:bg-red-50">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="relative"><div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden"><img src={getAvatarUrl(student.avatarSeed || student.name)} className="w-full h-full object-cover" alt="s"/></div></div>
                                        <div className="min-w-0"><h4 className="font-bold text-slate-800 text-sm truncate">{student.name}</h4><span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded truncate max-w-[120px]">{student.groupName}</span></div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 shrink-0"><ChevronRight size={16}/></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* --- TEACHER BOTTOM NAVIGATION (MOBILE) --- */}
      {/* 🔥 TUZATILDI: Agar /chat sahifasida bo'lmasa, menyuni ko'rsat */}
      {location.pathname !== '/chat' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200 flex justify-around py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] z-[999] shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)]">
          
          {/* 1. Guruhlar */}
          <button onClick={() => {triggerHaptic(); setActiveTab('groups');}} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 ${activeTab === 'groups' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
              <LayoutGrid size={24} strokeWidth={2.5} />
              <span className="text-[10px] font-black">Guruhlar</span>
          </button>
          
          {/* 2. Chat Button (Alert bilan) */}
          <button onClick={() => {triggerHaptic(); navigate('/chat');}} className="flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 text-slate-400 hover:text-indigo-600 relative">
              <MessageCircle size={24} strokeWidth={2.5} />
              <span className="text-[10px] font-black">Xabarlar</span>
              {/* Alert */}
              {unreadMessages > 0 && (
                  <span className="absolute top-1 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
          </button>

          {/* 3. Qarzdorlar */}
          <button onClick={() => {triggerHaptic(); setActiveTab('debtors');}} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 ${activeTab === 'debtors' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
              <AlertTriangle size={24} strokeWidth={2.5} />
              <span className="text-[10px] font-black">Qarzdorlar</span>
          </button>
        </div>
      )}

    </div>
  );
};

export default TeacherDashboard;