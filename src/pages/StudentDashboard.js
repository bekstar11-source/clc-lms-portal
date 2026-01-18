import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, Settings, Trophy, AlertCircle, BookOpen,
  ChevronDown, ChevronUp, Calendar, Bell, RefreshCcw, LayoutDashboard, 
  ClipboardList, Star, Zap, Gamepad2, Megaphone, Timer, CheckCircle2, X,
  MessageCircle, AlertTriangle, Medal, ChevronRight, TrendingUp, Home, PieChart
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore'; 
import { signOut } from 'firebase/auth';
import { 
  XAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

// --- CONFIG ---
const CACHE_KEY = 'student_dashboard_cache';
const CACHE_DURATION = 10 * 60 * 1000; 

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
      const target = new Date(deadline); 
      const diff = target - now;
      if (diff <= 0) { setTimeLeft("TUGADI"); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${days}k ${hours}s ${minutes}m`);
    };
    calculateTime(); 
    const timer = setInterval(calculateTime, 60000); 
    return () => clearInterval(timer);
  }, [deadline]);
  return <span className="font-mono font-bold tracking-widest tabular-nums">{timeLeft}</span>;
};

// --- SKELETON LOADER ---
const DashboardSkeleton = () => (
  <div className="p-4 space-y-6 w-full h-full">
      <div className="h-40 bg-slate-200 rounded-[2.5rem] w-full animate-pulse"></div>
      <div className="h-12 bg-slate-200 rounded-xl w-full animate-pulse"></div>
      <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-slate-200 rounded-2xl animate-pulse"></div>
          <div className="h-24 bg-slate-200 rounded-2xl animate-pulse"></div>
      </div>
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
  const [averageScore, setAverageScore] = useState(0);
  const [studentRank, setStudentRank] = useState(0);
  const [actionItems, setActionItems] = useState([]);

  // UI States
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [expandedMonths, setExpandedMonths] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0); 
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isAlertsExpanded, setIsAlertsExpanded] = useState(false);
  
  const hasNewHomework = notifications.some(n => n.type === 'lesson');

  // --- CACHING & FETCHING ---
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
      setAverageScore(data.averageScore || 0);
      setStudentRank(data.studentRank || 0);
      setActionItems(data.actionItems || []); 
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
      
      const [annSnap, snapS] = await Promise.all([ getDocs(annQuery), getDocs(qS) ]);
      const annData = annSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.seconds }));
      
      if (snapS.empty) { setLoading(false); return; }
      
      const studentDoc = snapS.docs[0];
      const studentData = { id: studentDoc.id, ...studentDoc.data() };

      let grName = '';
      let ldrBoard = [];
      let rank = 0;
      let lessonData = [];
      let gradesData = [];
      let calculatedAvg = 0;
      let actions = []; 

      if (studentData.groupId) {
        const groupRef = doc(db, "groups", studentData.groupId);
        const qAllStudents = query(collection(db, "students"), where("groupId", "==", studentData.groupId));
        const qAllGrades = query(collection(db, "grades"), where("groupId", "==", studentData.groupId));
        const lessonsQuery = query(collection(db, "lessons"), where("groupId", "==", studentData.groupId), orderBy("date", "asc"));

        const [groupSnap, snapAllStudents, snapAllGrades, lessonsSnapshot] = await Promise.all([
            getDoc(groupRef), getDocs(qAllStudents), getDocs(qAllGrades), getDocs(lessonsQuery)
        ]);

        if (groupSnap.exists()) grName = groupSnap.data().name;
        
        const allGradesList = snapAllGrades.docs.map(d => d.data());
        const allLessonsList = lessonsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const activeLessons = allLessonsList.filter(l => !l.isDelayed);

        const allStuds = snapAllStudents.docs.map(d => ({ id: d.id, name: d.data().name || "Unknown", avatarSeed: d.data().avatarSeed }));
        const leaderData = allStuds.map(s => {
          const sGrades = allGradesList.filter(g => g.studentId === s.id);
          let totalScore = 0;
          if (activeLessons.length === 0) return { id: s.id, name: s.name, avg: 0, avatarSeed: s.avatarSeed };
          activeLessons.forEach(lesson => {
              const grade = sGrades.find(g => g.lessonId === lesson.id);
              if (grade) totalScore += Number(grade.score) || 0;
          });
          const avg = Math.round(totalScore / activeLessons.length);
          return { id: s.id, name: s.name, avg: avg, avatarSeed: s.avatarSeed };
        }).sort((a, b) => b.avg - a.avg);
        
        ldrBoard = leaderData.slice(0, 3);
        rank = leaderData.findIndex(s => s.id === studentData.id) + 1;
        const currentUserStats = leaderData.find(s => s.id === studentData.id);
        calculatedAvg = currentUserStats ? currentUserStats.avg : 0;

        lessonData = allLessonsList.map(doc => {
            return { ...doc, rawDate: doc.date ? doc.date : new Date().toISOString().split('T')[0] };
        });
      }

      const gradesQuery = query(collection(db, "grades"), where("studentId", "==", studentData.id), orderBy("date", "desc"));
      const gradesSnapshot = await getDocs(gradesQuery);
      
      gradesData = gradesSnapshot.docs.map(doc => {
         const data = doc.data();
         let dateObj = new Date();
         if (data.date && data.date.toDate) dateObj = data.date.toDate();
         else if (data.date) dateObj = new Date(data.date);

         let retakeDeadlineStr = null;
         if (data.score < 60) {
             if (data.retakeDeadline) {
                 retakeDeadlineStr = data.retakeDeadline.toDate ? data.retakeDeadline.toDate().toISOString() : data.retakeDeadline;
             } else {
                 const deadlineDate = new Date(dateObj);
                 deadlineDate.setDate(deadlineDate.getDate() + 7);
                 retakeDeadlineStr = deadlineDate.toISOString();
             }
             if (new Date(retakeDeadlineStr) > new Date() && data.status !== 'retake_submitted') {
                 actions.push({ type: 'retake', id: doc.id, topic: data.comment, deadline: retakeDeadlineStr });
             }
         }
         return {
           id: doc.id, ...data,
           rawDate: dateObj.toISOString(),
           dateStr: dateObj.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
           retakeDeadline: retakeDeadlineStr
         };
      });

      const today = new Date().toISOString().split('T')[0];
      lessonData.forEach(l => {
          if (!l.isDelayed && l.rawDate < today) {
              const hasGrade = gradesData.find(g => g.lessonId === l.id);
              if (!hasGrade) {
                  const deadlineDate = new Date(l.rawDate);
                  deadlineDate.setDate(deadlineDate.getDate() + 3); 
                  actions.push({ type: 'missing', id: l.id, topic: l.topic, date: l.rawDate, deadline: deadlineDate.toISOString() });
              }
          }
      });

      setStudent(studentData); setGroupName(grName); setGrades(gradesData);
      setLessons(lessonData); setAnnouncements(annData); setTopStudents(ldrBoard);
      setAverageScore(calculatedAvg); setStudentRank(rank); setActionItems(actions); 

      generateNotifications(gradesData, lessonData);
      saveToCache({ 
          student: studentData, groupName: grName, grades: gradesData, 
          lessons: lessonData, announcements: annData, topStudents: ldrBoard, 
          averageScore: calculatedAvg, studentRank: rank, actionItems: actions 
      });

    } catch (error) { console.error("Xatolik:", error); } finally { setLoading(false); setIsRefreshing(false); }
  };

  useEffect(() => { fetchStudentData(); }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "chats"), where("participants", "array-contains", auth.currentUser.uid));
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

  const handleRefresh = () => { triggerHaptic(); fetchStudentData(true); };
  const toggleNotifications = () => { triggerHaptic(); if (isNotifOpen) { localStorage.setItem('lastNotificationCheck', new Date().toISOString()); setUnreadCount(0); } setIsNotifOpen(!isNotifOpen); };
  const handleTabChange = (tab) => { triggerHaptic('tap'); setActiveTab(tab); };
  const handleNotificationClick = (notification) => { triggerHaptic('tap'); if (notification.type === 'grade') setActiveTab('grades'); else if (notification.type === 'lesson') setActiveTab('schedule'); setIsNotifOpen(false); };

  const submitRetake = async (gradeId) => {
      triggerHaptic('tap');
      if(!window.confirm("Qayta topshirdingizmi?")) return;
      try {
          await updateDoc(doc(db, "grades", gradeId), { status: 'retake_submitted' });
          setGrades(prev => prev.map(g => g.id === gradeId ? { ...g, status: 'retake_submitted' } : g));
          fetchStudentData(true); 
          triggerHaptic('success');
      } catch (error) { alert("Xato: " + error.message); }
  };

  const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/notionists/svg?seed=${seed || 'default'}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
  const today = new Date().toISOString().split('T')[0];
  
  const getMotivationMessage = (score) => {
    if (score >= 90) return { text: "Ajoyib! Davom eting!", color: "text-emerald-200" };
    if (score >= 80) return { text: "Yaxshi ketyapsiz!", color: "text-indigo-100" };
    if (score >= 60) return { text: "Harakat qiling!", color: "text-yellow-200" };
    return { text: "Ko'proq o'qing!", color: "text-red-200" };
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

  // --- NAVIGATION CONFIG ---
  const navTabs = [
    { id: 'dashboard', label: 'Asosiy', icon: Home, color: 'text-purple-600', bg: 'bg-purple-100', glow: 'shadow-[0_0_15px_rgba(147,51,234,0.5)]', indicator: 'bg-purple-600' },
    { id: 'schedule', label: 'Vazifalar', icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-100', glow: 'shadow-[0_0_15px_rgba(37,99,235,0.5)]', indicator: 'bg-blue-600' },
    { id: 'chat', label: 'Chat', icon: MessageCircle, isChat: true, color: 'text-pink-600', bg: 'bg-pink-100', glow: 'shadow-[0_0_15px_rgba(219,39,119,0.5)]', indicator: 'bg-pink-600' },
    { id: 'grades', label: 'Baholar', icon: PieChart, color: 'text-emerald-600', bg: 'bg-emerald-100', glow: 'shadow-[0_0_15px_rgba(5,150,105,0.5)]', indicator: 'bg-emerald-600' },
    { id: 'games', label: 'O\'yinlar', icon: Gamepad2, color: 'text-amber-600', bg: 'bg-amber-100', glow: 'shadow-[0_0_15px_rgba(217,119,6,0.5)]', indicator: 'bg-amber-600' },
  ];

  const activeIndex = navTabs.findIndex(tab => tab.id === activeTab);
  const activeStyle = activeIndex !== -1 ? navTabs[activeIndex] : navTabs[0];

  if (loading) return <div className="h-screen bg-slate-50 flex items-center justify-center"><DashboardSkeleton /></div>;

  return (
    // 🔥 ASOSIY O'ZGARISH: fixed inset-0 va h-[100dvh]
    // Bu sahifani ekranga mixlaydi va faqat ichki qism scroll bo'ladi
    <div className="fixed inset-0 h-[100dvh] w-full flex flex-col bg-slate-50 font-sans touch-none overflow-hidden">
      
      {/* ORQA FON RASMI (ABSOLUTE) */}
      <div className="absolute inset-0 z-0">
         <div 
           className="absolute inset-0 bg-cover bg-center bg-no-repeat"
           style={{
             backgroundImage: "url('https://github.com/user-attachments/assets/1d6178e4-9b57-4c89-bd1d-ef7d30a62448')"
           }}
         ></div>
         <div className="absolute inset-0 bg-white/20 backdrop-blur-1xl"></div>
      </div>

      {/* --- HEADER (NAVBAR) - STATIC --- */}
      <nav className="relative z-50 shrink-0 bg-white/80 backdrop-blur-md border-b border-white/40 px-4 py-3 flex justify-between items-center shadow-sm">
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
            <button onClick={handleRefresh} className="p-2 text-slate-400 hover:text-indigo-600 bg-white/60 rounded-xl active:bg-slate-200 transition-colors">
                <RefreshCcw size={20} className={isRefreshing ? "animate-spin text-indigo-500" : ""} />
            </button>
            <button onClick={toggleNotifications} className={`p-2 rounded-xl transition-all relative ${isNotifOpen ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 bg-white/60'}`}>
                <Bell size={20} />
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
            <button onClick={() => {triggerHaptic(); navigate('/settings');}} className="p-2 text-slate-400 hover:text-indigo-600 bg-white/60 rounded-xl"><Settings size={20} /></button>
            <button onClick={() => {triggerHaptic(); if(window.confirm('Chiqish?')){signOut(auth); navigate('/');}}} className="p-2 text-slate-400 hover:text-red-500 bg-white/60 rounded-xl"><LogOut size={20} /></button>
            </div>
      </nav>

      {/* --- NOTIFICATION SHEET (MODAL) --- */}
      {isNotifOpen && (
            <div className="fixed inset-0 z-[1000] flex items-end sm:items-start sm:justify-end sm:p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full sm:w-80 h-[80vh] sm:h-auto sm:max-h-[80vh] rounded-t-[2rem] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-300">
                <div className="flex justify-between items-center p-4 border-b border-slate-50">
                    <span className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Bell size={16}/> Bildirishnomalar</span>
                    <button onClick={() => setIsNotifOpen(false)} className="p-1 bg-slate-100 rounded-full text-slate-500"><X size={18}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {notifications.length === 0 ? <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs italic"><Bell size={32} className="mb-2 opacity-20"/>Yangiliklar yo'q</div> : 
                        notifications.map(n => (
                        <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-3 rounded-2xl flex items-start gap-3 cursor-pointer active:scale-98 transition-transform border ${n.type === 'grade' && n.score <= 20 ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.type === 'grade' ? (n.score <= 20 ? 'bg-red-500' : 'bg-emerald-500') : 'bg-indigo-500'}`}></div>
                            <div className="min-w-0"><h4 className={`text-xs font-black uppercase ${n.type === 'grade' && n.score <= 20 ? 'text-red-600' : 'text-slate-700'}`}>{n.title}</h4><p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">{n.text}</p><span className="text-[9px] text-slate-300 font-bold uppercase mt-1 block">{new Date(n.date).toLocaleDateString()}</span></div>
                        </div>
                        ))
                    }
                </div>
                {notifications.length > 0 && <button onClick={() => {setNotifications([]); setUnreadCount(0); localStorage.setItem('lastNotificationCheck', new Date().toISOString()); triggerHaptic();}} className="p-3 m-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-500 uppercase tracking-wide">Hammasini tozalash</button>}
            </div>
            </div>
      )}

      {/* --- SCROLLABLE CONTENT AREA --- */}
      {/* 🔥 BU YERDA overscroll-contain QO'SHILDI */}
      <div className="flex-1 overflow-y-auto z-10 relative scrollbar-hide pb-28 p-4 overscroll-contain">
        <div className="max-w-7xl mx-auto space-y-6">
            
            {/* 1. DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* 1. COMPACT PROFILE CARD */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-800 rounded-3xl p-5 text-white shadow-xl shadow-indigo-200/50 relative overflow-hidden">
                    <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/20 p-0.5 shrink-0">
                                <img src={getAvatarUrl(student?.avatarSeed || student?.name)} alt="avatar" className="w-full h-full rounded-xl object-cover bg-slate-100" />
                            </div>
                            <div>
                                <h1 className="text-lg font-black leading-tight">{student?.name ? student.name.split(' ')[0] : 'O\'quvchi'}</h1>
                                <p className="text-xs font-medium opacity-80 uppercase tracking-wide">{groupName}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="flex flex-col items-end">
                                <span className="text-3xl font-black tracking-tighter leading-none">{averageScore}%</span>
                                {studentRank > 0 && (
                                    <div className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-lg border border-white/10 mt-1.5 backdrop-blur-sm">
                                        <Medal size={10} className="text-yellow-300 fill-yellow-300"/>
                                        <span className="text-[10px] font-bold">#{studentRank}-o'rin</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 relative z-10">
                        <div className="flex justify-between items-end mb-1.5">
                            <p className={`text-[10px] font-bold uppercase tracking-wide ${motivation.color} flex items-center gap-1.5`}>
                                <Zap size={12} className="fill-current"/> {motivation.text}
                            </p>
                        </div>
                        <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                            <div className="h-full bg-white/90 rounded-full transition-all duration-1000" style={{ width: `${averageScore}%` }}></div>
                        </div>
                    </div>
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                </div>

                {/* 2. ACTION ITEMS (ALERT) */}
                {actionItems.length > 0 && (
                    <div className="bg-red-500 rounded-2xl shadow-lg shadow-red-200 overflow-hidden transition-all duration-300 border border-red-400">
                        <button onClick={() => { triggerHaptic(); setIsAlertsExpanded(!isAlertsExpanded); }} className="w-full flex items-center justify-between p-4 text-white active:bg-red-600 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center animate-pulse"><AlertTriangle size={18} className="text-white fill-white" /></div>
                                <div className="text-left"><h3 className="text-sm font-black uppercase tracking-wide leading-none">Diqqat Talab!</h3><p className="text-[10px] font-medium opacity-90 mt-1">{actionItems.length} ta muammo mavjud</p></div>
                            </div>
                            {isAlertsExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                        </button>
                        {isAlertsExpanded && (
                            <div className="bg-white p-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                {actionItems.map((item, idx) => (
                                    <div key={idx} onClick={() => setActiveTab(item.type === 'retake' ? 'grades' : 'schedule')} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-xl active:scale-98 transition-transform cursor-pointer">
                                        <div className="flex-1 min-w-0 pr-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${item.type === 'retake' ? 'bg-red-200 text-red-700' : 'bg-orange-200 text-orange-700'}`}>{item.type === 'retake' ? "Retake" : "Missing"}</span>
                                                <span className="text-[10px] font-bold text-slate-400 truncate">{new Date(item.date || new Date()).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-700 truncate">{item.topic}</p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            {item.type === 'retake' ? (
                                                <div className="bg-red-100 text-red-600 px-2 py-1 rounded-lg text-[10px] font-mono font-bold flex flex-col items-center"><span className="text-[8px] opacity-70 uppercase mb-0.5">Qoldi</span><CountdownTimer deadline={item.deadline} /></div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-500"><ChevronRight size={16}/></div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 3. LEADERBOARD */}
                <div className="bg-white/80 backdrop-blur-sm p-5 rounded-[2rem] border border-white shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2"><Trophy className="text-yellow-500" size={18} /><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Top O'quvchilar</h3></div>
                <div className="space-y-3">
                    {topStudents.map((s, i) => (
                        <div key={i} className={`flex items-center justify-between p-3 rounded-2xl border ${s.name === student?.name ? 'bg-indigo-50 border-indigo-100 ring-2 ring-indigo-100/50' : 'bg-white/50 border-slate-100'}`}>
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

                {/* 4. ANNOUNCEMENTS */}
                {announcements.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3 px-2"><Megaphone className="text-amber-500" size={16}/><h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Yangiliklar</h2></div>
                    <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 scrollbar-hide snap-x">
                        {announcements.map(ann => (
                        <div key={ann.id} className="min-w-[85vw] sm:min-w-[300px] snap-center bg-white/90 backdrop-blur p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
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

                {/* 5. CHART AREA */}
                <div className="bg-white/80 backdrop-blur-sm p-5 rounded-[2rem] border border-white shadow-sm mb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                            <TrendingUp size={18} className="text-indigo-500"/>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Statistika</h3>
                    </div>
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
                
            </div>
            )}
            
            {/* 2. SCHEDULE TAB */}
            {activeTab === 'schedule' && (
            <div className="space-y-6 animate-in fade-in">
                <h2 className="text-xl font-black text-slate-800 px-2 uppercase italic tracking-tighter">Uyga vazifalar</h2>
                {Object.keys(groupedLessons).map((month, index) => {
                const monthLessons = groupedLessons[month];
                const isExpanded = expandedMonths[month] || index === 0;
                return (
                    <div key={month} className="bg-white/80 backdrop-blur-md rounded-[2rem] border border-white shadow-sm overflow-hidden">
                    <div onClick={() => { triggerHaptic('tap'); setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] })); }} className={`p-5 flex justify-between items-center cursor-pointer transition-colors active:bg-slate-50`}>
                        <div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600"><Calendar size={20} /></div><div><h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">{month}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{monthLessons.length} ta dars</p></div></div>
                        {isExpanded ? <ChevronUp className="text-slate-400" size={20}/> : <ChevronDown className="text-slate-400" size={20}/>}
                    </div>
                    {isExpanded && (
                        <div className="p-4 space-y-4 border-t border-slate-100 bg-slate-50/50">
                        {monthLessons.map((lesson) => {
                            const lessonGrade = grades.find(g => g.lessonId === lesson.id);
                            const isMissing = lesson.rawDate < today && !lessonGrade && !lesson.isDelayed;
                            const isRetake = lessonGrade && lessonGrade.score <= 20;
                            const isProblematic = isMissing || isRetake;
                            return (
                            <div key={lesson.id} className={`p-5 rounded-[1.5rem] border transition-all ${isProblematic ? 'bg-white border-red-200 shadow-md shadow-red-100/50' : 'bg-white border-slate-100 shadow-sm'} ${lesson.isDelayed ? 'opacity-60 grayscale' : ''}`}>
                                <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest ${isProblematic ? 'bg-red-500 text-white' : 'bg-indigo-50 text-indigo-600'}`}>{lesson.rawDate}</span>
                                        {lesson.isDelayed && <span className="text-[9px] font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-md">Delayed</span>}
                                    </div>
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
            <div className="space-y-4 animate-in fade-in">
                <h2 className="text-xl font-black text-slate-800 px-2 uppercase italic tracking-tighter">Barcha Baholar</h2>
                <div className="space-y-3">
                {[...grades].map((g, i) => {
                    const isRetakeNeeded = g.score < 60; 
                    let daysLeft = null;
                    if (g.retakeDeadline) {
                        const deadline = new Date(g.retakeDeadline);
                        daysLeft = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
                    }
                    return (
                    <div key={i} className={`p-5 rounded-[2rem] border bg-white/90 backdrop-blur-md shadow-sm flex flex-col gap-3 ${isRetakeNeeded ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-100'}`}>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0 pr-2">
                                <p className="font-black text-slate-700 text-xs uppercase mb-2 truncate">{g.comment || 'Mavzu'}</p>
                                <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded-md">{g.dateStr}</span>
                            </div>
                            <div className={`text-2xl font-black ${g.score >= 80 ? 'text-emerald-500' : g.score <= 60 ? 'text-red-500' : 'text-indigo-600'}`}>{g.score}%</div>
                        </div>
                        {isRetakeNeeded && g.retakeDeadline && g.status !== 'retake_submitted' && (
                            <div className="mt-2 pt-3 border-t border-amber-100 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1 text-amber-600"><Timer size={14} /><span className="text-[10px] font-black uppercase flex items-center gap-1">Qoldi: <CountdownTimer deadline={g.retakeDeadline} /></span></div>
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
      </div>
      
      {/* --- FLOATING BOTTOM NAVIGATION (FIXED) --- */}
      <div className="md:hidden fixed bottom-2 left-1/2 transform -translate-x-1/2 w-[95%] max-w-md z-[999]">
        <div className="relative bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] px-1 py-2">
          <div className="flex justify-between items-center relative">
            {/* Dynamic Slider */}
            {activeStyle && (
                <div className="absolute top-0 h-full transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)" style={{ width: '20%', left: `${activeIndex * 20}%` }}>
                <div className="w-14 h-full mx-auto relative flex flex-col items-center">
                    <div className={`absolute top-0 w-8 h-1 rounded-b-full transition-colors duration-300 ${activeStyle.indicator} shadow-sm`}></div>
                    <div className={`w-full h-full mt-1 rounded-2xl opacity-20 transition-colors duration-300 ${activeStyle.bg.replace('bg-', 'bg-gradient-to-b from-')}-100 to-transparent`}></div>
                </div>
                </div>
            )}
            {navTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <div key={tab.id} className="relative flex-1 h-16 flex items-center justify-center z-10">
                    <button onClick={() => {triggerHaptic(); if(tab.id === 'chat') navigate('/chat'); else if(tab.id === 'games') navigate('/games'); else setActiveTab(tab.id);}} className="w-full h-full flex flex-col items-center justify-center relative group focus:outline-none">
                        <div className={`relative flex items-center justify-center p-3 rounded-2xl transition-all duration-500 ease-out ${isActive ? `-translate-y-1 scale-90 ${tab.bg} ${tab.color} ${tab.glow} border-2 border-white` : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                            <Icon size={24} className="transition-colors duration-300" strokeWidth={isActive ? 2.5 : 2} />
                            {tab.isChat && unreadMessages > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white animate-pulse shadow-sm z-20">{unreadMessages > 9 ? '9+' : unreadMessages}</span>}
                            {tab.id === 'schedule' && hasNewHomework && !isActive && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                        </div>
                        <span className={`absolute bottom-1 text-[10px] font-bold tracking-wide transition-all duration-500 ${isActive ? `opacity-100 translate-y-0 ${tab.color}` : 'opacity-0 translate-y-4 pointer-events-none'}`}>{tab.label}</span>
                        {isActive && <span className={`absolute -bottom-1 w-1 h-1 rounded-full ${tab.bg.replace('bg-', 'bg-')}-500`}></span>}
                    </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
};

export default StudentDashboard;