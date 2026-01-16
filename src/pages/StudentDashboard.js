import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, Loader2, Settings, Trophy, AlertCircle, ArrowRight, BookOpen,
  ChevronDown, ChevronUp, Calendar, Bell, RefreshCcw, LayoutDashboard, 
  ClipboardList, Star, Medal, Zap, Gamepad2, Megaphone, Timer, CheckCircle2, X,
  MessageCircle // Chat ikonkasi
} from 'lucide-react';
import { db, auth, messaging } from '../firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore'; 
import { signOut } from 'firebase/auth';
import { getToken } from "firebase/messaging";
import { 
  XAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

// --- CONFIG ---
const CACHE_KEY = 'student_dashboard_cache';
const CACHE_DURATION = 10 * 60 * 1000; // 10 daqiqa kesh

// --- HELPERS ---
const triggerHaptic = (type = 'tap') => {
  if (navigator.vibrate) {
     if (type === 'tap') navigator.vibrate(10); 
     if (type === 'success') navigator.vibrate([10, 50, 10]);
  }
};

const CountdownTimer = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!deadline) return;
    const calculateTime = () => {
      const now = new Date();
      const target = deadline.toDate ? deadline.toDate() : new Date(deadline);
      const diff = target - now;
      if (diff <= 0) { setTimeLeft("TUGADI"); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      setTimeLeft(`${days}k ${hours}s`);
    };
    calculateTime(); 
    const timer = setInterval(calculateTime, 60000); 
    return () => clearInterval(timer);
  }, [deadline]);
  return <span className="font-mono font-bold tracking-widest text-amber-600 tabular-nums">{timeLeft}</span>;
};

// --- SKELETON LOADER ---
const DashboardSkeleton = () => (
  <div className="p-4 space-y-6 max-w-7xl mx-auto pt-20 animate-pulse">
      <div className="h-32 bg-slate-200 rounded-[2rem] w-full"></div>
      <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-slate-200 rounded-2xl"></div>
          <div className="h-24 bg-slate-200 rounded-2xl"></div>
      </div>
      <div className="h-64 bg-slate-200 rounded-[2rem]"></div>
  </div>
);

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Data States
  const [student, setStudent] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [grades, setGrades] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [topStudents, setTopStudents] = useState([]);
  const [studentRank, setStudentRank] = useState(0);
  
  // UI States
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [expandedMonths, setExpandedMonths] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const hasNewHomework = notifications.some(n => n.type === 'lesson');

  // --- CACHING ---
  const loadFromCache = () => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return false;
    try {
      const { timestamp, data, uid } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_DURATION || uid !== auth.currentUser?.uid) return false;
      
      setStudent(data.student);
      setGroupName(data.groupName);
      setGrades(data.grades);
      setLessons(data.lessons);
      setAnnouncements(data.announcements);
      setTopStudents(data.topStudents);
      setStudentRank(data.studentRank);
      generateNotifications(data.grades, data.lessons);
      setLoading(false);
      return true;
    } catch (e) { return false; }
  };

  const saveToCache = (dataToSave) => {
    if (!auth.currentUser) return;
    const cacheObject = { timestamp: Date.now(), uid: auth.currentUser.uid, data: dataToSave };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObject));
  };

  // --- FETCH DATA ---
  const fetchStudentData = async (forceRefresh = false) => {
    const user = auth.currentUser;
    if (!user) { navigate('/'); return; }

    if (!forceRefresh) {
        const isLoaded = loadFromCache();
        if (isLoaded) return;
    }

    if(forceRefresh) setIsRefreshing(true);

    try {
      const annQuery = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
      const qS = query(collection(db, "students"), where("email", "==", user.email));
      
      const [annSnap, snapS] = await Promise.all([
          getDocs(annQuery),
          getDocs(qS)
      ]);

      const annData = annSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.seconds }));
      
      if (snapS.empty) { setLoading(false); return; }
      
      const studentDoc = snapS.docs[0];
      const studentData = { id: studentDoc.id, ...studentDoc.data() };

      let grName = '';
      let ldrBoard = [];
      let rank = 0;
      let lessonData = [];
      let gradesData = [];

      if (studentData.groupId) {
        const groupRef = doc(db, "groups", studentData.groupId);
        const qAllStudents = query(collection(db, "students"), where("groupId", "==", studentData.groupId));
        const qAllGrades = query(collection(db, "grades"), where("groupId", "==", studentData.groupId));
        const lessonsQuery = query(collection(db, "lessons"), where("groupId", "==", studentData.groupId), orderBy("date", "asc"));

        const [groupSnap, snapAllStudents, snapAllGrades, lessonsSnapshot] = await Promise.all([
            getDoc(groupRef),
            getDocs(qAllStudents),
            getDocs(qAllGrades),
            getDocs(lessonsQuery)
        ]);

        if (groupSnap.exists()) grName = groupSnap.data().name;
        
        const allGradesList = snapAllGrades.docs.map(d => d.data());
        const allStuds = snapAllStudents.docs.map(d => ({ id: d.id, name: d.data().name || "Unknown", avatarSeed: d.data().avatarSeed }));
        
        const leaderData = allStuds.map(s => {
          const sGrades = allGradesList.filter(g => g.studentId === s.id);
          const validGrades = sGrades.map(g => Number(g.score)).filter(score => !isNaN(score) && score <= 100);
          const avg = validGrades.length > 0 ? validGrades.reduce((a, b) => a + b, 0) / validGrades.length : 0;
          return { id: s.id, name: s.name, avg: Math.round(avg), avatarSeed: s.avatarSeed };
        }).sort((a, b) => b.avg - a.avg);
        
        ldrBoard = leaderData.slice(0, 3);
        rank = leaderData.findIndex(s => s.id === studentData.id) + 1;

        lessonData = lessonsSnapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data, rawDate: data.date ? data.date : new Date().toISOString().split('T')[0] };
        });
      }

      const gradesQuery = query(collection(db, "grades"), where("studentId", "==", studentData.id), orderBy("date", "desc"));
      const gradesSnapshot = await getDocs(gradesQuery);
      gradesData = gradesSnapshot.docs.map(doc => {
         const data = doc.data();
         let dateObj = new Date();
         if (data.date && data.date.toDate) dateObj = data.date.toDate();
         else if (data.date) dateObj = new Date(data.date);

         return {
           id: doc.id, ...data,
           rawDate: dateObj.toISOString(),
           dateStr: dateObj.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
           retakeDeadline: data.retakeDeadline ? (data.retakeDeadline.toDate ? data.retakeDeadline.toDate().toISOString() : data.retakeDeadline) : null
         };
      });

      setStudent(studentData); setGroupName(grName); setGrades(gradesData);
      setLessons(lessonData); setAnnouncements(annData); setTopStudents(ldrBoard);
      setStudentRank(rank);

      generateNotifications(gradesData, lessonData);
      saveToCache({ student: studentData, groupName: grName, grades: gradesData, lessons: lessonData, announcements: annData, topStudents: ldrBoard, studentRank: rank });

    } catch (error) { console.error("Xatolik:", error); } finally { setLoading(false); setIsRefreshing(false); }
  };

  useEffect(() => {
    fetchStudentData(); 
  }, []);

  const generateNotifications = (allGrades, allLessons) => {
    const lastCheck = localStorage.getItem('lastNotificationCheck');
    const lastCheckDate = lastCheck ? new Date(lastCheck) : new Date(0); 
    const newNotifs = [];

    allGrades.forEach(g => {
      const gDate = new Date(g.rawDate);
      if (gDate > lastCheckDate) newNotifs.push({ id: Math.random(), type: 'grade', title: "Yangi Baho!", text: `"${g.comment}" mavzusidan ${g.score}% oldingiz.`, date: g.rawDate, score: g.score });
    });

    allLessons.forEach(l => {
        const lDate = new Date(l.rawDate);
        if (lDate > lastCheckDate) newNotifs.push({ id: Math.random(), type: 'lesson', title: "Yangi Vazifa", text: `"${l.topic}" mavzusi qo'shildi.`, date: l.rawDate });
    });

    newNotifs.sort((a, b) => new Date(b.date) - new Date(a.date));
    setNotifications(newNotifs);
    setUnreadCount(newNotifs.length);
  };

  const handleRefresh = () => { 
      triggerHaptic();
      fetchStudentData(true); 
  };
  
  const toggleNotifications = () => {
    triggerHaptic();
    if (isNotifOpen) { localStorage.setItem('lastNotificationCheck', new Date().toISOString()); setUnreadCount(0); }
    setIsNotifOpen(!isNotifOpen);
  };
  
  const handleTabChange = (tab) => {
      triggerHaptic('tap');
      setActiveTab(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNotificationClick = (notification) => {
    triggerHaptic('tap');
    if (notification.type === 'grade') setActiveTab('grades');
    else if (notification.type === 'lesson') setActiveTab('schedule');
    setIsNotifOpen(false); 
  };

  const submitRetake = async (gradeId) => {
      triggerHaptic('tap');
      if(!window.confirm("Qayta topshirdingizmi?")) return;
      try {
          await updateDoc(doc(db, "grades", gradeId), { status: 'retake_submitted' });
          setGrades(prev => prev.map(g => g.id === gradeId ? { ...g, status: 'retake_submitted' } : g));
          triggerHaptic('success');
      } catch (error) { alert("Xato: " + error.message); }
  };

  const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/notionists/svg?seed=${seed || 'default'}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
  const today = new Date().toISOString().split('T')[0];
  const averageScore = grades.length > 0 ? Math.round(grades.reduce((acc, curr) => acc + curr.score, 0) / grades.length) : 0;

  const getMotivationMessage = (score) => {
    if (score >= 90) return { text: "AJOYIB! DAVOM ETING!", color: "text-emerald-300", iconColor: "text-emerald-400" };
    if (score >= 80) return { text: "YAXSHI KETYAPSIZ!", color: "text-indigo-200", iconColor: "text-yellow-400" };
    if (score >= 60) return { text: "HARAKAT QILING!", color: "text-yellow-300", iconColor: "text-yellow-500" };
    return { text: "KO'PROQ O'QING!", color: "text-red-300", iconColor: "text-red-500" };
  };
  const motivation = getMotivationMessage(averageScore);

  const groupLessonsByMonth = () => {
    const groups = {};
    lessons.forEach(lesson => {
      const date = new Date(lesson.rawDate);
      const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(lesson);
    });
    return groups;
  };
  const groupedLessons = groupLessonsByMonth();
  
  // Chart Math
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (averageScore / 100) * circumference;

  if (loading) return <div className="min-h-[100dvh] bg-slate-50"><DashboardSkeleton /></div>;

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans pb-28 md:pb-12 touch-manipulation">
      
      {/* --- NAVBAR --- */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 py-3 flex justify-between items-center shadow-sm pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shadow-sm">
             <img src={getAvatarUrl(student?.avatarSeed || student?.name)} alt="avatar" className="w-full h-full object-cover"/>
          </div>
          <div>
            <span className="font-black text-slate-800 text-sm block leading-none">{student?.name ? student.name.split(' ')[0] : 'Student'}</span>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">{groupName || '...'}</span>
          </div>
        </div>
        
        <div className="flex gap-2 items-center">
           {/* YANGILASH */}
           <button onClick={handleRefresh} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-xl active:bg-slate-200 transition-colors">
              <RefreshCcw size={20} className={isRefreshing ? "animate-spin text-indigo-500" : ""} />
           </button>
          
           {/* BILDIRISHNOMALAR */}
           <button onClick={toggleNotifications} className={`p-2 rounded-xl transition-all relative ${isNotifOpen ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 bg-slate-50'}`}>
            <Bell size={20} />
            {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
           </button>
          
           {/* SOZLAMALAR */}
           <button onClick={() => {triggerHaptic(); navigate('/settings');}} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-xl"><Settings size={20} /></button>
           
           {/* CHIQISH */}
           <button onClick={() => {triggerHaptic(); if(window.confirm('Chiqish?')){signOut(auth); navigate('/');}}} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-xl"><LogOut size={20} /></button>
        </div>
      </nav>

      {/* --- NOTIFICATION SHEET (Mobile Optimized) --- */}
      {isNotifOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-start sm:justify-end sm:p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full sm:w-80 h-[80vh] sm:h-auto sm:max-h-[80vh] rounded-t-[2rem] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-300">
             <div className="flex justify-between items-center p-4 border-b border-slate-50">
                <span className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Bell size={16}/> Bildirishnomalar</span>
                <button onClick={() => setIsNotifOpen(false)} className="p-1 bg-slate-100 rounded-full text-slate-500"><X size={18}/></button>
             </div>
             <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {notifications.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs italic">
                        <Bell size={32} className="mb-2 opacity-20"/>Yangiliklar yo'q
                    </div> 
                ) : (
                    notifications.map(n => (
                      <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-3 rounded-2xl flex items-start gap-3 cursor-pointer active:scale-98 transition-transform border ${n.type === 'grade' && n.score <= 20 ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                         <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.type === 'grade' ? (n.score <= 20 ? 'bg-red-500' : 'bg-emerald-500') : 'bg-indigo-500'}`}></div>
                         <div className="min-w-0">
                           <h4 className={`text-xs font-black uppercase ${n.type === 'grade' && n.score <= 20 ? 'text-red-600' : 'text-slate-700'}`}>{n.title}</h4>
                           <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">{n.text}</p>
                           <span className="text-[9px] text-slate-300 font-bold uppercase mt-1 block">{new Date(n.date).toLocaleDateString()}</span>
                         </div>
                      </div>
                    ))
                )}
             </div>
             {notifications.length > 0 && (
                <button onClick={() => {setNotifications([]); setUnreadCount(0); localStorage.setItem('lastNotificationCheck', new Date().toISOString()); triggerHaptic();}} className="p-3 m-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Hammasini tozalash
                </button>
             )}
          </div>
        </div>
      )}

      {/* --- CONTENT AREA --- */}
      <div className="max-w-7xl mx-auto space-y-6 p-4">
        
        {/* 1. DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Main Profile Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-800 rounded-[2.5rem] p-6 text-white relative overflow-hidden shadow-2xl shadow-indigo-200/50 flex flex-col sm:flex-row items-center gap-6">
               <div className="relative z-10 shrink-0">
                   <div className="relative w-28 h-28 flex items-center justify-center">
                       <svg className="w-full h-full transform -rotate-90">
                           <circle cx="50%" cy="50%" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-indigo-900/30" />
                           <circle cx="50%" cy="50%" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="text-white transition-all duration-1000 ease-out" />
                       </svg>
                       <div className="absolute inset-0 flex flex-col items-center justify-center pb-1">
                           <Zap size={24} className={`${motivation.iconColor} animate-pulse fill-current mb-0.5`} />
                           <div className="flex items-start leading-none"><span className="text-3xl font-black">{averageScore}</span><span className="text-xs font-bold mt-1">%</span></div>
                       </div>
                   </div>
               </div>
               <div className="relative z-10 flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 opacity-80 mb-2">
                      <Star size={12} className="text-yellow-300 fill-yellow-300" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Student Portal</span>
                  </div>
                  <h1 className="text-2xl font-black leading-tight mb-2">Salom, {student?.name ? student.name.split(' ')[0] : 'O\'quvchi'}!</h1>
                  <div className={`inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10`}>
                      <AlertCircle size={16} className={motivation.color} />
                      <p className={`text-xs font-black uppercase tracking-wide ${motivation.color}`}>{motivation.text}</p>
                  </div>
               </div>
               <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
            </div>

            {/* Announcements */}
            {announcements.length > 0 && (
              <div>
                 <div className="flex items-center gap-2 mb-3 px-2"><Megaphone className="text-amber-500" size={16}/><h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Yangiliklar</h2></div>
                 <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 scrollbar-hide snap-x">
                    {announcements.map(ann => (
                       <div key={ann.id} className="min-w-[85vw] sm:min-w-[300px] snap-center bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                          <p className="font-bold text-slate-700 text-sm leading-relaxed">{ann.text}</p>
                          <div className="flex items-center gap-2 mt-3">
                              <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">Admin</span>
                              <span className="text-[10px] text-slate-400 font-bold">{ann.createdAt ? new Date(ann.createdAt * 1000).toLocaleDateString() : '...'}</span>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
            )}

            {/* Chart Area */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
               <div className="flex items-center justify-between mb-4">
                   <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">O'zlashtirish</h3>
                   <span className="text-[10px] font-bold text-slate-400 uppercase">Oxirgi 10 dars</span>
               </div>
               <div className="w-full h-56"> 
                  {grades.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[...grades].reverse().slice(-10)} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dateStr" fontSize={9} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dy={10}/>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fill="url(#scoreColor)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (<div className="flex items-center justify-center h-full text-slate-400 text-xs italic">Ma'lumot yetarli emas</div>)}
               </div>
            </div>
            
            {/* Leaderboard */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 mb-20">
              <div className="flex items-center gap-2 mb-2"><Trophy className="text-yellow-500" size={18} /><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Top O'quvchilar</h3></div>
              <div className="space-y-3">
                  {topStudents.map((s, i) => (
                      <div key={i} className={`flex items-center justify-between p-3 rounded-2xl border ${s.name === student?.name ? 'bg-indigo-50 border-indigo-100 ring-2 ring-indigo-100/50' : 'bg-slate-50/50 border-slate-100'}`}>
                          <div className="flex items-center gap-3">
                              <div className="relative">
                                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden"><img src={getAvatarUrl(s.avatarSeed || s.name)} alt={s.name} className="w-full h-full object-cover"/></div>
                                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] border-2 border-white text-white font-black shadow-sm ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : 'bg-amber-700'}`}>{i+1}</div>
                              </div>
                              <span className="text-xs font-black text-slate-700 truncate">{s.name} {s.name === student?.name && "(Siz)"}</span>
                          </div>
                          <span className="text-xs font-black text-indigo-600 bg-indigo-100 px-2 py-1 rounded-lg">{s.avg}%</span>
                      </div>
                  ))}
              </div>
            </div>
          </div>
        )}
        
        {/* 2. SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <div className="space-y-6 animate-in fade-in pb-20">
            <h2 className="text-xl font-black text-slate-800 px-2 uppercase italic tracking-tighter">Uyga vazifalar</h2>
            {Object.keys(groupedLessons).map((month, index) => {
              const monthLessons = groupedLessons[month];
              const isExpanded = expandedMonths[month] || index === 0;
              return (
                <div key={month} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                  <div onClick={() => { triggerHaptic('tap'); setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] })); }} className={`p-5 flex justify-between items-center cursor-pointer transition-colors active:bg-slate-50`}>
                    <div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600"><Calendar size={20} /></div><div><h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">{month}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{monthLessons.length} ta dars</p></div></div>
                    {isExpanded ? <ChevronUp className="text-slate-400" size={20}/> : <ChevronDown className="text-slate-400" size={20}/>}
                  </div>
                  {isExpanded && (
                    <div className="p-4 space-y-4 border-t border-slate-100 bg-slate-50/50">
                      {monthLessons.map((lesson) => {
                        const lessonGrade = grades.find(g => g.lessonId === lesson.id);
                        const isMissing = lesson.rawDate < today && !lessonGrade;
                        const isRetake = lessonGrade && lessonGrade.score <= 20;
                        const isProblematic = isMissing || isRetake;
                        return (
                          <div key={lesson.id} className={`p-5 rounded-[1.5rem] border transition-all ${isProblematic ? 'bg-white border-red-200 shadow-md shadow-red-100/50' : 'bg-white border-slate-100 shadow-sm'}`}>
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1 min-w-0">
                                  <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest ${isProblematic ? 'bg-red-500 text-white' : 'bg-indigo-50 text-indigo-600'}`}>{lesson.rawDate}</span>
                                  <h4 className="font-black text-slate-800 text-sm mt-2 uppercase truncate">{lesson.topic}</h4>
                              </div>
                              {isProblematic ? <AlertCircle className="text-red-500 animate-pulse shrink-0" size={20} /> : <BookOpen className="text-slate-200 shrink-0" size={20} />}
                            </div>
                            {isProblematic && <div className="mt-3 pt-3 border-t border-red-100 flex items-center gap-2 text-red-500 font-bold text-[10px] uppercase"><AlertCircle size={12} /> {isMissing ? "Topshirilmagan" : "Qayta topshirish kerak"}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 3. GRADES TAB */}
        {activeTab === 'grades' && (
          <div className="space-y-4 animate-in fade-in pb-20">
            <h2 className="text-xl font-black text-slate-800 px-2 uppercase italic tracking-tighter">Barcha Baholar</h2>
            <div className="space-y-3">
              {[...grades].map((g, i) => {
                const isRetakeNeeded = g.status === 'retake_needed';
                let daysLeft = null;
                if (g.retakeDeadline) {
                    const deadline = g.retakeDeadline.toDate ? g.retakeDeadline.toDate() : new Date(g.retakeDeadline);
                    daysLeft = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
                }
                return (
                  <div key={i} className={`p-5 rounded-[2rem] border bg-white shadow-sm flex flex-col gap-3 ${isRetakeNeeded ? 'border-amber-400 ring-2 ring-amber-100' : g.score <= 20 ? 'border-red-200' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0 pr-2">
                            <p className="font-black text-slate-700 text-xs uppercase mb-2 truncate">{g.comment || 'Mavzu'}</p>
                            <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded-md">{g.dateStr}</span>
                        </div>
                        <div className={`text-2xl font-black ${g.score >= 80 ? 'text-emerald-500' : g.score <= 20 ? 'text-red-500' : 'text-indigo-600'}`}>{g.score}%</div>
                    </div>
                    {isRetakeNeeded && (
                        <div className="mt-2 pt-3 border-t border-amber-100 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 text-amber-600"><Timer size={14} /><span className="text-[10px] font-black uppercase">{g.retakeDeadline ? <CountdownTimer deadline={g.retakeDeadline} /> : "Vaqt bor"}</span></div>
                            <button onClick={() => submitRetake(g.id)} disabled={daysLeft !== null && daysLeft <= 0} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${(daysLeft !== null && daysLeft <= 0) ? 'bg-slate-200 text-slate-400' : 'bg-amber-500 text-white shadow-lg shadow-amber-200 active:scale-95'}`}>Qayta Topshirish</button>
                        </div>
                    )}
                    {g.status === 'retake_submitted' && <div className="mt-1 pt-2 border-t border-indigo-50 flex items-center gap-2 text-indigo-500"><CheckCircle2 size={14}/> <span className="text-[10px] font-black uppercase">Tekshirilmoqda</span></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* --- BOTTOM NAVIGATION (Fixed & Safe) --- */}
      {/* 🔥 YANGILANGAN PASTKI MENYU */}
      <div className="md:hidden fixed bottom-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200 flex justify-around py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-50 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)]">
        
        {/* Asosiy (Dashboard) */}
        <button onClick={() => handleTabChange('dashboard')} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 ${activeTab === 'dashboard' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
            <LayoutDashboard size={24} strokeWidth={2.5} />
            <span className="text-[9px] font-black">Asosiy</span>
        </button>

        {/* Vazifalar (Schedule) */}
        <button onClick={() => handleTabChange('schedule')} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 relative ${activeTab === 'schedule' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
            <ClipboardList size={24} strokeWidth={2.5} />
            <span className="text-[9px] font-black">Vazifalar</span>
            {hasNewHomework && <span className="absolute top-2 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
        </button>

        {/* 🔥 YANGI CHAT TUGMASI */}
        <button onClick={() => {triggerHaptic(); navigate('/chat');}} className="flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
            <MessageCircle size={24} strokeWidth={2.5} />
            <span className="text-[9px] font-black">Chat</span>
        </button>

        {/* Baholar (Grades) */}
        <button onClick={() => handleTabChange('grades')} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 ${activeTab === 'grades' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
            <Star size={24} strokeWidth={2.5} />
            <span className="text-[9px] font-black">Baholar</span>
        </button>

        {/* O'yinlar (Games) */}
        <button onClick={() => {triggerHaptic(); navigate('/games');}} className="flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
            <Gamepad2 size={24} strokeWidth={2.5} />
            <span className="text-[9px] font-black">O'yinlar</span>
        </button>

      </div>
    </div>
  );
};

export default StudentDashboard;