import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { 
  collection, getDocs, query, where, doc, getDoc, updateDoc, onSnapshot 
} from 'firebase/firestore';
import { 
  LayoutGrid, Sparkles, BookOpen, ChevronRight,
  XCircle, AlertTriangle, 
  Bell, ArrowRight, MessageCircle, RefreshCw, Users, UserCheck
} from 'lucide-react';

// --- SKELETON LOADER ---
const DashboardSkeleton = () => (
  <div className="min-h-screen relative bg-slate-50">
      <div className="p-4 space-y-6 max-w-7xl mx-auto pt-[calc(1rem+env(safe-area-inset-top))]">
          <div className="h-32 w-full bg-slate-200 rounded-[2rem] animate-pulse"></div>
          <div className="grid grid-cols-2 gap-4">
              <div className="h-40 bg-slate-200 rounded-[2rem] animate-pulse"></div>
              <div className="h-40 bg-slate-200 rounded-[2rem] animate-pulse"></div>
          </div>
      </div>
  </div>
);

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation(); 
  const [teacherName, setTeacherName] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [retakeAlerts, setRetakeAlerts] = useState([]);
  const [debtors, setDebtors] = useState([]);
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

  // 1. 🔥 MA'LUMOTLARNI YUKLASH (Asosiy va Assistent uchun)
  const fetchData = async (forceRefresh = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    if (forceRefresh) setRefreshing(true);

    try {
      const CACHE_KEY = `teacher_dash_${currentUser.uid}`;
      const cached = localStorage.getItem(CACHE_KEY);

      // Keshni tekshirish
      if (!forceRefresh && cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 10 * 60 * 1000) {
              setTeacherName(data.teacherName);
              setGroups(data.groups);
              setRetakeAlerts(data.retakeAlerts);
              setDebtors(data.debtors);
              setLoading(false);
              setRefreshing(false);
              return;
          }
      }

      const userRef = doc(db, "students", currentUser.uid);
      
      // 🔥 O'ZGARISH: Ikkita so'rov yuboramiz (Teacher VA Assistant uchun)
      const mainGroupsQuery = query(collection(db, "groups"), where("teacherId", "==", currentUser.uid));
      const assistGroupsQuery = query(collection(db, "groups"), where("assistantTeacherId", "==", currentUser.uid));
      
      const [userDoc, mainGroupsSnap, assistGroupsSnap] = await Promise.all([
          getDoc(userRef),
          getDocs(mainGroupsQuery),
          getDocs(assistGroupsQuery)
      ]);

      let tName = '';
      if (userDoc.exists()) {
          tName = userDoc.data().name;
          setTeacherName(tName);
      }
      
      // Guruhlarni formatlash va birlashtirish
      const mainGroups = mainGroupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'main' }));
      const assistGroups = assistGroupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'assistant' }));
      
      // Barcha guruhlar (Dublikatlarni olib tashlash shart emas, chunki ID lar takrorlanmaydi, lekin xavfsizlik uchun birlashtiramiz)
      const fetchedGroups = [...mainGroups, ...assistGroups];
      
      // Dublikatlarni tozalash (ehtimolga qarshi)
      const uniqueGroups = fetchedGroups.filter((group, index, self) =>
        index === self.findIndex((t) => t.id === group.id)
      );

      setGroups(uniqueGroups);

      // Har bir guruh uchun ma'lumotlarni yuklash (Parallel)
      const groupsDataPromises = uniqueGroups.map(async (grp) => {
          const qStudents = query(collection(db, "students"), where("groupId", "==", grp.id));
          const qGrades = query(collection(db, "grades"), where("groupId", "==", grp.id));
          const qLessons = query(collection(db, "lessons"), where("groupId", "==", grp.id));

          const [studSnap, gradesSnap, lessonsSnap] = await Promise.all([
              getDocs(qStudents), 
              getDocs(qGrades),
              getDocs(qLessons)
          ]);

          return {
              groupName: grp.name,
              groupId: grp.id,
              students: studSnap.docs.map(d => ({ id: d.id, ...d.data() })),
              grades: gradesSnap.docs.map(d => d.data()),
              gradeDocs: gradesSnap.docs,
              lessons: lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          };
      });

      const allGroupsData = await Promise.all(groupsDataPromises);

      let alerts = [];
      let allDebtors = [];

      allGroupsData.forEach(({ groupName, groupId, students, grades, gradeDocs, lessons }) => {
          const studentsMap = {};
          students.forEach(s => studentsMap[s.id] = s.name);

          // 1. RETAKES (Alerts)
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
                      date: g.date ? g.date.toDate().toISOString() : new Date().toISOString()
                  });
              }
          });

          // 2. DEBTORS (Qarzdorlar)
          const activeLessons = lessons.filter(l => !l.isDelayed);
          if (activeLessons.length > 0) {
              students.forEach(student => {
                  const studentGrades = grades.filter(g => g.studentId === student.id);
                  let totalScore = 0;

                  activeLessons.forEach(lesson => {
                      const grade = studentGrades.find(g => g.lessonId === lesson.id);
                      if (grade) {
                          totalScore += Number(grade.score) || 0;
                      } else {
                          totalScore += 0;
                      }
                  });

                  const average = Math.round(totalScore / activeLessons.length);

                  if (average < 60) {
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
          }
      });

      const sortedAlerts = alerts.sort((a,b) => new Date(b.date) - new Date(a.date));
      const sortedDebtors = allDebtors.sort((a, b) => a.averageScore - b.averageScore);

      setRetakeAlerts(sortedAlerts);
      setDebtors(sortedDebtors);

      const cacheData = {
          teacherName: tName,
          groups: uniqueGroups,
          retakeAlerts: sortedAlerts,
          debtors: sortedDebtors
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: cacheData, timestamp: Date.now() }));

    } catch (error) { console.error(error); } 
    finally { 
        setLoading(false); 
        setRefreshing(false);
    }
  };

  useEffect(() => {
      fetchData();
  }, []);

  // 2. REALTIME CHAT ALERTS
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

  const handleForceRefresh = () => {
      triggerHaptic();
      fetchData(true);
  };

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
          const newAlerts = retakeAlerts.filter(a => a.id !== alertId);
          setRetakeAlerts(newAlerts);
          
          const CACHE_KEY = `teacher_dash_${auth.currentUser.uid}`;
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
              const { data, timestamp } = JSON.parse(cached);
              data.retakeAlerts = newAlerts;
              localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp }));
          }

          triggerHaptic('success');
      } catch (error) { alert(error.message); }
  };

  const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/notionists/svg?seed=${seed || 'teacher'}&backgroundColor=e0e7ff,c7d2fe`;

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="min-h-screen relative font-sans touch-manipulation pb-28 md:pb-10">
      
      {/* 1. BACKGROUND IMAGE LAYER */}
      <div className="fixed inset-0 z-0">
         <div 
           className="absolute inset-0 bg-cover bg-center bg-no-repeat"
           style={{
             backgroundImage: "url('https://github.com/user-attachments/assets/3e4e49aa-ca3f-414f-8790-48ccb56b825b')"
           }}
         ></div>
         {/* Oq parda (Overlay) */}
         <div className="absolute inset-0 bg-slate-50/70 backdrop-blur-sm"></div>
      </div>

      {/* 2. CONTENT LAYER */}
      <div className="relative z-10">
          
          {/* --- HEADER --- */}
          <div className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl border-b border-white/40 px-6 py-4 pt-[calc(1rem+env(safe-area-inset-top))] flex justify-between items-center transition-all duration-300 shadow-sm">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1 mb-0.5">
                  <Sparkles size={10} className="text-indigo-600"/> Teacher Portal
                </p>
                <h1 className="text-xl font-black text-slate-800">
                    Hi, <span className="text-indigo-600">{teacherName.split(' ')[0]}</span>
                </h1>
            </div>

            <div className="flex items-center gap-3">
                <button 
                    onClick={handleForceRefresh} 
                    className={`p-2.5 bg-white/70 text-slate-500 hover:text-indigo-600 rounded-xl shadow-sm border border-white active:scale-95 transition-all ${refreshing ? 'animate-spin text-indigo-600' : ''}`}
                >
                    <RefreshCw size={20}/>
                </button>

                <button 
                    onClick={() => {triggerHaptic(); navigate('/chat');}} 
                    className="hidden md:flex p-2.5 bg-white/70 text-slate-500 hover:text-indigo-600 rounded-xl shadow-sm border border-white active:scale-95 transition-all relative"
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
                    
                    {/* Retake Alerts (Asosiy va Assistent guruhlari uchun) */}
                    {retakeAlerts.length > 0 && (
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-3 px-2">
                                <div className="flex items-center gap-2">
                                    <div className="relative"><Bell size={18} className="text-indigo-600" /><span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span></div>
                                    <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest">Tekshiruv ({retakeAlerts.length})</h2>
                                </div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase">Swipe &rarr;</span>
                            </div>
                            <div className="flex overflow-x-auto gap-3 pb-4 -mx-4 px-6 scrollbar-hide snap-x">
                                {retakeAlerts.map((alert, idx) => (
                                    <div key={idx} onClick={() => handleAlertClick(alert)} className="snap-center shrink-0 w-[260px] bg-white/80 backdrop-blur-md p-4 rounded-[1.5rem] border border-white/50 shadow-lg shadow-indigo-100/30 relative overflow-hidden active:scale-[0.98] transition-transform">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-600 truncate max-w-[120px]">{alert.groupName}</span>
                                            <button onClick={(e) => handleRejectRetake(e, alert.id)} className="w-6 h-6 rounded-full bg-slate-50/50 text-slate-400 flex items-center justify-center hover:bg-rose-100 hover:text-rose-500 transition-colors"><XCircle size={14}/></button>
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-sm truncate">{alert.studentName}</h4>
                                        <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{alert.topic}</p>
                                        <div className="mt-3 flex items-center gap-1 text-[10px] font-black text-indigo-500 uppercase tracking-wide">Tekshirish <ArrowRight size={12}/></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 🔥 GURUHLAR RO'YXATI */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {groups.map((group, index) => {
                            const isMain = group.role === 'main';
                            const style = isMain 
                                ? (index % 2 === 0 ? 'from-blue-500 to-indigo-600' : 'from-emerald-400 to-teal-600')
                                : 'from-amber-400 to-orange-500'; // Assistentlar uchun boshqa rang

                            return (
                                <div 
                                    key={group.id} 
                                    onClick={() => { triggerHaptic(); navigate(`/group/${group.id}`); }} 
                                    className="group relative bg-white/40 backdrop-blur-xl rounded-[2rem] p-5 border border-white/60 shadow-xl shadow-indigo-500/10 cursor-pointer active:scale-[0.97] transition-all flex flex-col justify-between min-h-[160px] hover:bg-white/50"
                                >
                                    <div>
                                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${style} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300 mb-3`}>
                                            {isMain ? <Users size={20} strokeWidth={2.5} /> : <UserCheck size={20} strokeWidth={2.5} />}
                                        </div>
                                        <h3 className="text-lg font-black text-slate-800 leading-tight line-clamp-2">{group.name}</h3>
                                        <p className={`mt-1 text-[9px] font-black uppercase tracking-wider ${isMain ? 'text-indigo-900/60' : 'text-amber-700/70'}`}>
                                            {isMain ? 'Main Teacher' : 'Assistant'}
                                        </p>
                                    </div>
                                    <div className="mt-3 flex justify-end">
                                        <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center text-indigo-600 shadow-sm border border-white/50 group-hover:scale-110 transition-transform">
                                            <ChevronRight size={20} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* DEBTORS TAB */}
            {activeTab === 'debtors' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-xl overflow-hidden">
                        {debtors.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center">
                                <div className="w-16 h-16 bg-emerald-100/50 rounded-full flex items-center justify-center mb-4"><Sparkles className="text-emerald-500" size={32}/></div>
                                <h3 className="text-sm font-black text-slate-800">Hammasi joyida!</h3>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100/50">
                                {debtors.map((student, idx) => (
                                    <div key={idx} onClick={() => { triggerHaptic(); navigate(`/group/${student.groupId}`, { state: { openStudentId: student.id }})}} className="p-4 hover:bg-white/40 transition-colors cursor-pointer flex items-center justify-between gap-3 active:bg-white/60">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="relative"><div className="w-10 h-10 rounded-full bg-white/80 overflow-hidden"><img src={getAvatarUrl(student.avatarSeed || student.name)} className="w-full h-full object-cover" alt="s"/></div></div>
                                            <div className="min-w-0"><h4 className="font-bold text-slate-800 text-sm truncate">{student.name}</h4><span className="text-[9px] font-bold text-slate-500 bg-white/50 px-1.5 py-0.5 rounded truncate max-w-[120px]">{student.groupName}</span></div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-red-500 bg-red-100/50 px-2 py-1 rounded-lg border border-red-100">{student.averageScore}%</span>
                                            <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-slate-400 shrink-0"><ChevronRight size={16}/></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
          </div>

          {/* --- TEACHER BOTTOM NAVIGATION (MOBILE) --- */}
          {location.pathname !== '/chat' && (
            <div className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white/70 backdrop-blur-xl border-t border-white/40 flex justify-around py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] z-[999] shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)]">
              
              <button onClick={() => {triggerHaptic(); setActiveTab('groups');}} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 ${activeTab === 'groups' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-500'}`}>
                  <LayoutGrid size={24} strokeWidth={2.5} />
                  <span className="text-[10px] font-black">Guruhlar</span>
              </button>
              
              <button onClick={() => {triggerHaptic(); navigate('/chat');}} className="flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 text-slate-500 hover:text-indigo-600 relative">
                  <MessageCircle size={24} strokeWidth={2.5} />
                  <span className="text-[10px] font-black">Xabarlar</span>
                  {unreadMessages > 0 && (
                      <span className="absolute top-1 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                  )}
              </button>

              <button onClick={() => {triggerHaptic(); setActiveTab('debtors');}} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 ${activeTab === 'debtors' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-500'}`}>
                  <AlertTriangle size={24} strokeWidth={2.5} />
                  <span className="text-[10px] font-black">Qarzdorlar</span>
              </button>
            </div>
          )}
      </div>
    </div>
  );
};

export default TeacherDashboard;