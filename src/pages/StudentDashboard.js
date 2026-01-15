import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, Loader2, Settings,
  Trophy, AlertCircle, ArrowRight, BookOpen,
  ChevronDown, ChevronUp, Calendar, Bell, RefreshCcw,
  LayoutDashboard, ClipboardList, Star, Medal, Zap,
  Gamepad2, Megaphone, Timer, CheckCircle2 
} from 'lucide-react';
import { db, auth, messaging } from '../firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore'; 
import { signOut } from 'firebase/auth';
import { getToken } from "firebase/messaging";
import { 
  XAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

// O'YIN KOMPONENTI (Fayl bor deb hisoblaymiz)
import WordGame from './WordGame';

// 🔥 JONLI COUNTDOWN KOMPONENTI
const CountdownTimer = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!deadline) return;
    
    const calculateTime = () => {
      const now = new Date();
      const target = deadline.toDate ? deadline.toDate() : new Date(deadline);
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft("VAQT TUGADI");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${days}k ${hours}s ${minutes}m ${seconds}s`);
    };

    calculateTime(); 
    const timer = setInterval(calculateTime, 1000); 

    return () => clearInterval(timer);
  }, [deadline]);

  return <span className="font-mono font-bold tracking-widest text-amber-600">{timeLeft}</span>;
};

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [grades, setGrades] = useState([]);
  const [lessons, setLessons] = useState([]);
  
  const [announcements, setAnnouncements] = useState([]);
  const [topStudents, setTopStudents] = useState([]);
  const [studentRank, setStudentRank] = useState(0);
  
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [expandedMonths, setExpandedMonths] = useState({});

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null); 
  
  const hasNewHomework = notifications.some(n => n.type === 'lesson');

  // 🔥 1. NOTIFICATION RUXSATINI SO'RASH VA TOKENNI SAQLASH
  useEffect(() => {
    const requestPermissionAndSaveToken = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const currentToken = await getToken(messaging, {
            vapidKey: "BPOBx8d8TLzrkLjwRt5lwDCUepVal2HUYhCHzfnqo4TcN4RP0Q6XjMC7MO0zTr6Yt_Io0R77spPGGsIyd_0s9KU"
          });

          if (currentToken) {
            console.log("FCM Token olindi:", currentToken);
            await updateDoc(doc(db, "students", user.uid), {
              fcmToken: currentToken
            });
          }
        }
      } catch (error) {
        console.error("Token olishda xatolik:", error);
      }
    };

    requestPermissionAndSaveToken();
  }, []);

  useEffect(() => {
    const fetchStudentData = async () => {
      const user = auth.currentUser;
      if (!user) { navigate('/'); return; }

      try {
        const annQuery = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
        const annSnap = await getDocs(annQuery);
        setAnnouncements(annSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const qS = query(collection(db, "students"), where("email", "==", user.email));
        const snapS = await getDocs(qS);
        
        if (snapS.empty) { 
          setLoading(false); 
          return; 
        }
        
        const studentDoc = snapS.docs[0];
        const studentData = { id: studentDoc.id, ...studentDoc.data() };
        setStudent(studentData);

        if (studentData.groupId) {
          const groupSnap = await getDoc(doc(db, "groups", studentData.groupId));
          if (groupSnap.exists()) setGroupName(groupSnap.data().name);

          const qAllStudents = query(collection(db, "students"), where("groupId", "==", studentData.groupId));
          const snapAllStudents = await getDocs(qAllStudents);
          
          const allStuds = snapAllStudents.docs.map(d => ({ 
            id: d.id, 
            name: d.data().name || "Unknown", 
            avatarSeed: d.data().avatarSeed || d.data().name || "default"
          }));

          const qAllGrades = query(collection(db, "grades"), where("groupId", "==", studentData.groupId));
          const snapAllGrades = await getDocs(qAllGrades);
          const allGrades = snapAllGrades.docs.map(d => d.data());

          const leaderData = allStuds.map(s => {
            const sGrades = allGrades.filter(g => g.studentId === s.id);
            const validGrades = sGrades.map(g => Number(g.score)).filter(score => !isNaN(score) && score <= 100);
            const avg = validGrades.length > 0 ? validGrades.reduce((a, b) => a + b, 0) / validGrades.length : 0;
            return { id: s.id, name: s.name, avg: Math.round(avg), avatarSeed: s.avatarSeed };
          }).sort((a, b) => b.avg - a.avg);
          
          setTopStudents(leaderData.slice(0, 3));
          
          const myRankIndex = leaderData.findIndex(s => s.id === studentData.id);
          setStudentRank(myRankIndex + 1);

          const lessonsQuery = query(collection(db, "lessons"), where("groupId", "==", studentData.groupId), orderBy("date", "asc"));
          const lessonsSnapshot = await getDocs(lessonsQuery);
          
          const fetchedLessons = lessonsSnapshot.docs.map(doc => {
            const data = doc.data();
            return { 
              id: doc.id, 
              ...data,
              rawDate: data.createdAt ? data.createdAt.toDate() : (data.date ? new Date(data.date) : new Date())
            };
          });
          setLessons(fetchedLessons);
        }

        const gradesQuery = query(collection(db, "grades"), where("studentId", "==", studentData.id), orderBy("date", "desc"));
        const gradesSnapshot = await getDocs(gradesQuery);
        const fetchedGrades = gradesSnapshot.docs.map(doc => {
           const data = doc.data();
           return {
             id: doc.id, 
             ...data,
             rawDate: data.date ? data.date.toDate() : new Date(),
             dateStr: data.date ? data.date.toDate().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : ''
           };
        });
        
        setGrades(fetchedGrades); 

        if (studentData.groupId) {
             generateNotifications(fetchedGrades, []); 
        }

      } catch (error) { console.error("Xatolik:", error); } 
      finally { setLoading(false); }
    };
    fetchStudentData();
  }, [navigate]);

  useEffect(() => {
    if (grades.length > 0 || lessons.length > 0) {
      generateNotifications(grades, lessons);
    }
  }, [grades, lessons]);

  const generateNotifications = (allGrades, allLessons) => {
    const lastCheck = localStorage.getItem('lastNotificationCheck');
    const lastCheckDate = lastCheck ? new Date(lastCheck) : new Date(0); 
    
    const newNotifs = [];

    allGrades.forEach(g => {
      if (g.rawDate && g.rawDate > lastCheckDate) {
        newNotifs.push({
          id: Math.random(),
          type: 'grade',
          title: "Yangi Baho!",
          text: `"${g.comment}" mavzusidan ${g.score}% oldingiz.`,
          date: g.rawDate,
          score: g.score
        });
      }
    });

    if (allLessons) {
        allLessons.forEach(l => {
            if (l.rawDate && l.rawDate > lastCheckDate) {
                newNotifs.push({
                    id: Math.random(),
                    type: 'lesson',
                    title: "Yangi Vazifa",
                    text: `"${l.topic}" mavzusi qo'shildi.`,
                    date: l.rawDate
                });
            }
        });
    }

    newNotifs.sort((a, b) => b.date - a.date);
    setNotifications(newNotifs);
    setUnreadCount(newNotifs.length);
  };

  const toggleNotifications = () => {
    if (isNotifOpen) {
      localStorage.setItem('lastNotificationCheck', new Date().toISOString());
      setUnreadCount(0);
    }
    setIsNotifOpen(!isNotifOpen);
  };
  
  const handleNotificationClick = (notification) => {
    if (notification.type === 'grade') {
        setActiveTab('grades');
    } else if (notification.type === 'lesson') {
        setActiveTab('schedule');
    }
    setIsNotifOpen(false); 
  };

  const submitRetake = async (gradeId) => {
      if(!window.confirm("Vazifani qayta topshirdingizmi? Tasdiqlasangiz ustozga xabar boradi.")) return;
      try {
          await updateDoc(doc(db, "grades", gradeId), {
              status: 'retake_submitted'
          });
          setGrades(prev => prev.map(g => g.id === gradeId ? { ...g, status: 'retake_submitted' } : g));
          alert("Muvaffaqiyatli yuborildi! Tekshirilishini kuting.");
      } catch (error) {
          alert("Xatolik: " + error.message);
      }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        if (isNotifOpen) {
           localStorage.setItem('lastNotificationCheck', new Date().toISOString());
           setUnreadCount(0);
           setIsNotifOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNotifOpen]);

  const handleLogout = async () => {
    if(window.confirm("Chiqmoqchimisiz?")) { await signOut(auth); navigate('/'); }
  };
  
  const handleRefresh = () => { window.location.reload(); };

  const getAvatarUrl = (seed) => {
    const safeSeed = seed || "default";
    if (safeSeed.startsWith('bot_')) {
       const cleanSeed = safeSeed.replace('bot_', '');
       return `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;
    } else {
       const encodedSeed = encodeURIComponent(safeSeed);
       return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodedSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const lowGrades = grades.filter(g => g.score <= 20);
  const missingAssignments = lessons.filter(lesson => {
    if (lesson.date >= today) return false;
    const hasGrade = grades.some(g => g.lessonId === lesson.id);
    return !hasGrade;
  });

  const totalDebts = lowGrades.length + missingAssignments.length;
  const averageScore = grades.length > 0 ? Math.round(grades.reduce((acc, curr) => acc + curr.score, 0) / grades.length) : 0;

  const getMotivationMessage = (score) => {
    if (score >= 90) return { text: "AJOYIB NATIJA! O'SISHDA DAVOM ETING!", color: "text-emerald-300", iconColor: "text-emerald-400" };
    if (score >= 80) return { text: "YAXSHI KETYAPSIZ! CHO'QQI YAQIN!", color: "text-indigo-200", iconColor: "text-yellow-400" };
    if (score >= 60) return { text: "DIQQAT: NATIJANI YAXSHILASH KERAK.", color: "text-yellow-300", iconColor: "text-yellow-500" };
    return { text: "DIQQAT! O'ZLASHTIRISH PASAYMOQDA!", color: "text-red-300", iconColor: "text-red-500" };
  };
  
  const motivation = getMotivationMessage(averageScore);

  const groupLessonsByMonth = () => {
    const groups = {};
    lessons.forEach(lesson => {
      const date = new Date(lesson.date);
      const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(lesson);
    });
    return groups;
  };

  const groupedLessons = groupLessonsByMonth();
  const toggleMonth = (month) => setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));
  
  const hasProblemInMonth = (monthLessons) => monthLessons.some(lesson => {
    const lessonGrade = grades.find(g => g.lessonId === lesson.id);
    return (lesson.date < today && !lessonGrade) || (lessonGrade && lessonGrade.score <= 20);
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (averageScore / 100) * circumference;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-28 md:pb-12">
      
      {/* Navbar */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shadow-sm">
             <img 
               src={getAvatarUrl(student?.avatarSeed || student?.name || 'User')} 
               alt="avatar" 
               className="w-full h-full object-cover"
             />
          </div>
          <div>
            <span className="font-black text-slate-800 text-sm block leading-none">
                {student?.name ? student.name.split(' ')[0] : 'Student'}
            </span>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">{groupName || 'No Group'}</span>
          </div>
        </div>
        
        <div className="flex gap-2 items-center" ref={notifRef}>
           <button onClick={handleRefresh} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-xl active:bg-slate-200 transition-colors">
              <RefreshCcw size={20} />
           </button>
          
          <div className="relative">
            <button onClick={toggleNotifications} className={`p-2 rounded-xl transition-all ${isNotifOpen ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 bg-slate-50'}`}>
              <Bell size={20} />
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
            
            {isNotifOpen && (
              <div className="fixed top-16 right-4 left-4 md:absolute md:top-12 md:right-0 md:left-auto md:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 animate-in fade-in slide-in-from-top-2 z-[60]">
                 <div className="flex justify-between items-center px-3 py-2 border-b border-slate-50">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Bildirishnoma</span>
                    {/* 🔥 Touch target oshirildi (padding) */}
                    <button onClick={() => {setNotifications([]); setUnreadCount(0); localStorage.setItem('lastNotificationCheck', new Date().toISOString());}} className="px-2 py-1 rounded hover:bg-slate-50 text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase">Tozalash</button>
                 </div>
                 <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? <div className="p-6 text-center text-slate-400 text-xs italic flex flex-col items-center"><Bell size={24} className="mb-2 opacity-20"/>Yangiliklar yo'q</div> : 
                      <div className="space-y-1 mt-1">
                        {notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => handleNotificationClick(n)}
                            className={`p-3 rounded-xl flex items-start gap-3 cursor-pointer hover:opacity-80 transition-opacity ${n.type === 'grade' && n.score <= 20 ? 'bg-red-50' : 'bg-slate-50'}`}
                          >
                             <div className={`mt-1 w-2 h-2 rounded-full ${n.type === 'grade' ? (n.score <= 20 ? 'bg-red-500' : 'bg-emerald-500') : 'bg-indigo-500'}`}></div>
                             <div className="min-w-0">
                               <h4 className={`text-xs font-black uppercase ${n.type === 'grade' && n.score <= 20 ? 'text-red-600' : 'text-slate-700'}`}>{n.title}</h4>
                               {/* 🔥 Truncate qo'shildi */}
                               <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5 truncate">{n.text}</p>
                               {/* 🔥 Shrift kattalashtirildi */}
                               <span className="text-[9px] text-slate-300 font-bold uppercase mt-1 block">{new Date(n.date).toLocaleDateString()}</span>
                             </div>
                          </div>
                        ))}
                      </div>
                    }
                 </div>
              </div>
            )}
          </div>
          <button onClick={() => navigate('/settings')} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-xl"><Settings size={20} /></button>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-xl"><LogOut size={20} /></button>
        </div>
      </nav>

      {/* MENU TABS (DESKTOP) */}
      <div className="hidden md:flex px-4 pt-4 pb-2 sticky top-[60px] z-40 bg-slate-50">
        <div className="w-full flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
           {['dashboard', 'schedule', 'grades', 'wordgame'].map(t => (
             <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === t ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
               {t === 'dashboard' ? 'Asosiy' : t === 'schedule' ? 'Uyga vazifalar' : t === 'grades' ? 'Baholar' : 'O\'yin'}
               {t === 'schedule' && hasNewHomework && (
                   <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-sm shadow-red-500/50"></span>
               )}
             </button>
           ))}
        </div>
      </div>

      <div className={`max-w-7xl mx-auto space-y-6 ${activeTab === 'wordgame' ? 'p-0 md:p-4' : 'p-4'}`}>
        
        {/* 1. DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {announcements.length > 0 && (
              <div className="mb-2">
                 <div className="flex items-center gap-2 mb-3 px-1"><Megaphone className="text-amber-500" size={18}/><h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">E'lonlar</h2></div>
                 <div className="space-y-3">
                    {announcements.map(ann => (
                       <div key={ann.id} className="bg-white p-5 rounded-[1.5rem] border border-amber-100 shadow-sm relative overflow-hidden group">
                          <div className="relative z-10">
                              <p className="font-bold text-slate-700 text-sm leading-relaxed">{ann.text}</p>
                              <div className="flex items-center gap-2 mt-2">
                                  {/* 🔥 Shrift kattalashtirildi */}
                                  <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Admin</span>
                                  <span className="text-[10px] text-slate-400 font-bold">{ann.createdAt?.seconds ? new Date(ann.createdAt.seconds * 1000).toLocaleDateString() : 'Hozirgina'}</span>
                              </div>
                          </div>
                          <div className="absolute -right-4 -bottom-4 text-amber-50 opacity-40 rotate-12 group-hover:scale-110 transition-transform"><Bell size={64} /></div>
                       </div>
                    ))}
                 </div>
              </div>
            )}
            
            {totalDebts > 0 && (
              <div className="bg-red-50 border-2 border-red-100 p-4 rounded-3xl flex items-center gap-4 shadow-xl shadow-red-100/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-red-200/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center animate-pulse z-10 shadow-lg shadow-red-300 shrink-0"><AlertCircle size={24} /></div>
                <div className="flex-1 z-10 min-w-0">
                    <h4 className="font-black text-red-600 text-sm uppercase tracking-tight truncate">Diqqat: Qarzdorlik!</h4>
                    <div className="flex flex-col gap-0.5 mt-1">
                        {lowGrades.length > 0 && <span className="text-red-500 text-[10px] font-bold uppercase truncate">• {lowGrades.length} ta past baho (Retake)</span>}
                        {missingAssignments.length > 0 && <span className="text-red-500 text-[10px] font-bold uppercase truncate">• {missingAssignments.length} ta baholanmagan dars</span>}
                    </div>
                </div>
                <button onClick={() => setActiveTab('grades')} className="p-3 bg-white text-red-500 rounded-xl shadow-sm z-10 hover:bg-red-50"><ArrowRight size={20} /></button>
              </div>
            )}

            <div className="bg-gradient-to-br from-indigo-600 to-violet-800 rounded-[2rem] p-4 sm:p-5 text-white relative overflow-hidden shadow-2xl shadow-indigo-200/50 flex flex-row items-center gap-4">
               <div className="relative z-10 shrink-0 ml-2">
                   <div className="relative w-24 h-24 flex items-center justify-center">
                       <svg className="w-full h-full transform -rotate-90">
                           <circle cx="50%" cy="50%" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-indigo-900/30" />
                           <circle cx="50%" cy="50%" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="text-white transition-all duration-1000 ease-out" />
                       </svg>
                       <div className="absolute inset-0 flex flex-col items-center justify-center pb-1"><Zap size={20} className={`${motivation.iconColor} animate-pulse fill-current mb-0.5`} /><div className="flex items-start leading-none"><span className="text-2xl font-black">{averageScore}</span><span className="text-[10px] font-bold mt-0.5">%</span></div></div>
                   </div>
               </div>
               <div className="relative z-10 flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2 opacity-80 mb-1"><Star size={10} className="text-yellow-300 fill-yellow-300" /><span className="text-[10px] font-black uppercase tracking-widest">Student Portal</span></div>
                  <h1 className="text-lg font-bold leading-tight flex items-center gap-2 truncate">Salom, {student?.name ? student.name.split(' ')[0] : 'O\'quvchi'}!<span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shrink-0"><Medal size={10} className="text-yellow-300" /> #{studentRank > 0 ? studentRank : '-'}</span></h1>
                  <div className={`mt-2 ${motivation.color} animate-pulse flex items-center gap-2`}><AlertCircle size={18} className="shrink-0" /><p className="text-xs sm:text-sm font-black uppercase leading-tight tracking-tight truncate">{motivation.text}</p></div>
               </div>
               <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2 mb-2"><Trophy className="text-amber-500" size={20} /><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Guruh Liderlari</h3></div>
              <div className="grid grid-cols-1 gap-3">{topStudents.map((s, i) => (<div key={i} className={`flex items-center justify-between p-3 rounded-2xl border ${s.name === student?.name ? 'bg-indigo-50 border-indigo-100 ring-2 ring-indigo-100' : 'bg-slate-50/50 border-slate-100'}`}><div className="flex items-center gap-3"><div className="relative"><div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden"><img src={getAvatarUrl(s.avatarSeed || s.name)} alt={s.name} className="w-full h-full object-cover"/></div><div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] border border-white text-white font-black ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : 'bg-amber-700'}`}>{i+1}</div></div><span className="text-xs font-black text-slate-700 truncate">{s.name} {s.name === student?.name && "(Siz)"}</span></div><span className="text-xs font-black text-indigo-600">{s.avg}%</span></div>))}</div>
            </div>

            <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
               <h3 className="text-sm font-black text-slate-800 mb-4 px-2">Progress</h3>
               <div className="w-full h-[250px]" style={{ width: '100%', height: 250 }}>
                  {grades.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><AreaChart data={[...grades].reverse()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/><stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" /><XAxis dataKey="dateStr" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }}/><Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#4F46E5', fontWeight: 'bold' }}/><Area type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={3} fill="url(#scoreColor)" activeDot={{ r: 6, strokeWidth: 0 }}/></AreaChart></ResponsiveContainer>) : (<div className="flex items-center justify-center h-full text-slate-400 text-xs italic">Grafik uchun ma'lumot yetarli emas</div>)}
               </div>
            </div>
          </div>
        )}
        
        {/* 2. SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-lg font-black text-slate-800 px-2 uppercase italic">Uyga vazifalar</h2>
            {Object.keys(groupedLessons).map((month, index) => {
              const monthLessons = groupedLessons[month];
              const isExpanded = expandedMonths[month] || index === 0;
              const hasTrouble = hasProblemInMonth(monthLessons);
              return (
                <div key={month} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                  <div onClick={() => toggleMonth(month)} className={`p-5 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600"><Calendar size={20} /></div><div><h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">{month}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{monthLessons.length} ta dars</p></div></div>
                    <div className="flex items-center gap-3">{hasTrouble && <div className="flex items-center gap-1 bg-red-100 text-red-500 px-2 py-1 rounded-lg"><AlertCircle size={12} /><span className="text-[9px] font-black uppercase">Alert</span></div>}{isExpanded ? <ChevronUp className="text-slate-400" size={20}/> : <ChevronDown className="text-slate-400" size={20}/>}</div>
                  </div>
                  {isExpanded && (
                    <div className="p-4 space-y-4 border-t border-slate-100 bg-slate-50/30">
                      {monthLessons.map((lesson) => {
                        const lessonGrade = grades.find(g => g.lessonId === lesson.id);
                        const isMissing = lesson.date < today && !lessonGrade;
                        const isRetake = lessonGrade && lessonGrade.score <= 20;
                        const isProblematic = isMissing || isRetake;
                        return (
                          <div key={lesson.id} className={`p-5 rounded-[2rem] border transition-all ${isProblematic ? 'bg-white border-red-200 shadow-md shadow-red-50' : 'bg-white border-slate-100 shadow-sm'}`}>
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1 min-w-0">
                                  {/* 🔥 Shrift kattalashtirildi */}
                                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${isProblematic ? 'bg-red-500 text-white' : 'bg-indigo-50 text-indigo-600'}`}>{lesson.date}</span>
                                  {/* 🔥 Truncate qo'shildi */}
                                  <h4 className="font-black text-slate-800 text-sm mt-3 uppercase truncate">{lesson.topic}</h4>
                              </div>
                              {isProblematic ? <AlertCircle className="text-red-500 animate-pulse shrink-0" size={22} /> : <BookOpen className="text-slate-200 shrink-0" size={22} />}
                            </div>
                            {isProblematic && <div className="mt-4 pt-4 border-t border-red-100 flex items-center gap-2 text-red-600 font-black text-[10px] uppercase tracking-tighter"><AlertCircle size={12} /> {isMissing ? "Topshirilmagan / Baholanmagan" : `Past Baho: ${lessonGrade.score}% (Retake)`}</div>}
                            <div className="flex flex-wrap gap-2 mt-3">{lesson.tasks?.map((t, idx) => (<span key={idx} className={`border px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${isProblematic ? 'bg-white border-red-100 text-red-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>{idx + 1}. {typeof t === 'object' ? t.text : t}</span>))}</div>
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
            <h2 className="text-lg font-black text-slate-800 px-2 uppercase italic">Barcha Baholar</h2>
            <div className="space-y-3">
              {[...grades].map((g, i) => {
                const isRetakeNeeded = g.status === 'retake_needed';
                const isSubmitted = g.status === 'retake_submitted';
                const hasHistory = g.previousScore !== undefined && g.previousScore !== null;

                let daysLeft = null;
                if (g.retakeDeadline) {
                    const deadline = g.retakeDeadline.toDate ? g.retakeDeadline.toDate() : new Date(g.retakeDeadline);
                    daysLeft = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
                }

                return (
                  <div key={i} className={`p-5 rounded-[2rem] border bg-white shadow-sm flex flex-col gap-3 ${isRetakeNeeded ? 'border-amber-200 bg-amber-50/20' : g.score <= 20 ? 'border-red-200 bg-red-50/30' : 'border-slate-100'}`}>
                    
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0 pr-2">
                            {/* 🔥 Truncate */}
                            <p className="font-black text-slate-700 text-xs uppercase mb-2 truncate">{g.comment || 'Mavzu'}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* 🔥 Shriftlar kattalashtirildi */}
                                <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-widest">{g.taskType}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{g.dateStr}</span>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <div className={`text-xl font-black ${g.score >= 80 ? 'text-emerald-500' : g.score <= 20 ? 'text-red-500' : 'text-indigo-600'}`}>
                                {hasHistory && (
                                    <span className="text-slate-400 mr-2 text-sm font-bold line-through decoration-red-400 decoration-2">
                                        {g.previousScore}
                                    </span>
                                )}
                                {g.score}%
                            </div>
                        </div>
                    </div>

                    {isRetakeNeeded && (
                        <div className="mt-2 pt-3 border-t border-amber-100 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-amber-600 min-w-0">
                                <Timer size={16} className="shrink-0" />
                                <span className="text-[10px] font-black uppercase truncate">
                                    {g.retakeDeadline ? (
                                        <CountdownTimer deadline={g.retakeDeadline} />
                                    ) : (
                                        "Muddat belgilanmagan"
                                    )}
                                </span>
                            </div>
                            {/* 🔥 Bosish maydoni kattalashtirildi */}
                            <button 
                                onClick={() => submitRetake(g.id)}
                                disabled={daysLeft !== null && daysLeft <= 0}
                                className={`px-4 py-3 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${(daysLeft !== null && daysLeft <= 0) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-200 active:scale-95'}`}
                            >
                                Qayta Topshirish
                            </button>
                        </div>
                    )}

                    {isSubmitted && (
                         <div className="mt-2 pt-2 border-t border-indigo-50 flex items-center justify-center text-indigo-500 gap-1">
                             <CheckCircle2 size={16}/> <span className="text-[10px] font-black uppercase">Tekshirilmoqda...</span>
                         </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. WORD GAME TAB */}
        {activeTab === 'wordgame' && (
          <WordGame student={student} />
        )}

      </div>
      
      {/* MOBIL FOOTER (BOTTOM NAV) */}
      <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around py-2 z-50 pb-safe">
        {/* 🔥 Yozuvlar biroz kattalashtirildi (text-[10px]) va icon stroke width 2 ga tushirildi (yumshoqroq ko'rinish uchun) */}
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}>
            <LayoutDashboard size={24} strokeWidth={2} />
            <span className="text-[10px] font-black">Asosiy</span>
        </button>
        <button onClick={() => setActiveTab('schedule')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all relative ${activeTab === 'schedule' ? 'text-indigo-600' : 'text-slate-400'}`}>
            <ClipboardList size={24} strokeWidth={2} />
            <span className="text-[10px] font-black">Vazifalar</span>
            {hasNewHomework && <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-sm shadow-red-500/50"></span>}
        </button>
        <button onClick={() => setActiveTab('grades')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'grades' ? 'text-indigo-600' : 'text-slate-400'}`}>
            <Star size={24} strokeWidth={2} />
            <span className="text-[10px] font-black">Baholar</span>
        </button>
        <button onClick={() => setActiveTab('wordgame')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'wordgame' ? 'text-indigo-600' : 'text-slate-400'}`}>
            <Gamepad2 size={24} strokeWidth={2} />
            <span className="text-[10px] font-black">O'yin</span>
        </button>
      </div>
    </div>
  );
};

export default StudentDashboard;