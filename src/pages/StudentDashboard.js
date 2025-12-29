import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, Award, Loader2, Settings,
  Trophy, AlertCircle, ArrowRight, BookOpen,
  ChevronDown, ChevronUp, Calendar, Bell, RefreshCcw
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { 
  XAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [grades, setGrades] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [topStudents, setTopStudents] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [expandedMonths, setExpandedMonths] = useState({});

  // --- BILDIRISHNOMA STATE ---
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null); 

  useEffect(() => {
    const fetchStudentData = async () => {
      const user = auth.currentUser;
      if (!user) { navigate('/'); return; }

      try {
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
            const avg = sGrades.length > 0 ? sGrades.reduce((a, b) => a + b.score, 0) / sGrades.length : 0;
            return { name: s.name, avg: Math.round(avg), avatarSeed: s.avatarSeed };
          }).sort((a, b) => b.avg - a.avg).slice(0, 3);
          
          setTopStudents(leaderData);

          const lessonsQuery = query(collection(db, "lessons"), where("groupId", "==", studentData.groupId), orderBy("date", "desc"));
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      
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
          <div className="relative">
            <button onClick={toggleNotifications} className={`p-2 rounded-xl transition-all ${isNotifOpen ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 bg-slate-50'}`}>
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 animate-in fade-in slide-in-from-top-2 z-[60]">
                 <div className="flex justify-between items-center px-3 py-2 border-b border-slate-50">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Bildirishnoma</span>
                    <button onClick={() => {setNotifications([]); setUnreadCount(0); localStorage.setItem('lastNotificationCheck', new Date().toISOString());}} className="text-[9px] font-bold text-slate-400 hover:text-indigo-600 uppercase">Tozalash</button>
                 </div>
                 <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs italic flex flex-col items-center">
                        <Bell size={24} className="mb-2 opacity-20"/>
                        Yangiliklar yo'q
                      </div>
                    ) : (
                      <div className="space-y-1 mt-1">
                        {notifications.map(n => (
                          <div key={n.id} className={`p-3 rounded-xl flex items-start gap-3 ${n.type === 'grade' && n.score <= 20 ? 'bg-red-50' : 'bg-slate-50'}`}>
                             <div className={`mt-1 w-2 h-2 rounded-full ${n.type === 'grade' ? (n.score <= 20 ? 'bg-red-500' : 'bg-emerald-500') : 'bg-indigo-500'}`}></div>
                             <div>
                               <h4 className={`text-xs font-black uppercase ${n.type === 'grade' && n.score <= 20 ? 'text-red-600' : 'text-slate-700'}`}>{n.title}</h4>
                               <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">{n.text}</p>
                               <span className="text-[8px] text-slate-300 font-bold uppercase mt-1 block">{new Date(n.date).toLocaleDateString()}</span>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>
              </div>
            )}
          </div>

          <button onClick={() => navigate('/settings')} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-xl"><Settings size={20} /></button>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-xl"><LogOut size={20} /></button>
        </div>
      </nav>

      <div className="px-4 pt-4 pb-2 sticky top-[60px] z-40 bg-slate-50">
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
           {['dashboard', 'schedule', 'grades'].map(t => (
             <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>
               {t === 'dashboard' ? 'Asosiy' : t === 'schedule' ? 'Jadval' : 'Baholar'}
             </button>
           ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        
        {/* 1. DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* ALERT */}
            {totalDebts > 0 && (
              <div className="bg-red-50 border-2 border-red-100 p-4 rounded-3xl flex items-center gap-4 shadow-xl shadow-red-100/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-red-200/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center animate-pulse z-10 shadow-lg shadow-red-300">
                  <AlertCircle size={24} />
                </div>
                <div className="flex-1 z-10">
                  <h4 className="font-black text-red-600 text-sm uppercase tracking-tight">Diqqat: Qarzdorlik!</h4>
                  <div className="flex flex-col gap-0.5 mt-1">
                    {lowGrades.length > 0 && <span className="text-red-500 text-[10px] font-bold uppercase">• {lowGrades.length} ta past baho (Retake)</span>}
                    {missingAssignments.length > 0 && <span className="text-red-500 text-[10px] font-bold uppercase">• {missingAssignments.length} ta baholanmagan dars</span>}
                  </div>
                </div>
                <button onClick={() => setActiveTab(missingAssignments.length > 0 ? 'schedule' : 'grades')} className="p-2 bg-white text-red-500 rounded-xl shadow-sm z-10 hover:bg-red-50"><ArrowRight size={20} /></button>
              </div>
            )}

            <div className="bg-gradient-to-br from-indigo-600 to-violet-800 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-xl shadow-indigo-200">
               <div className="relative z-10">
                <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-4 inline-block">Student Portal</span>
                <h1 className="text-2xl font-black mb-2">Salom, {student?.name ? student.name.split(' ')[0] : 'O\'quvchi'}!</h1>
                <p className="text-indigo-100 text-xs font-medium opacity-80 mb-6">Sizning hozirgi o'rtacha ko'rsatkichingiz <b>{averageScore}%</b></p>
               </div>
               <Award className="absolute -right-4 -bottom-4 text-white/10 w-32 h-32" />
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="text-amber-500" size={20} />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Guruh Liderlari</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {topStudents.map((s, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-2xl border ${s.name === student?.name ? 'bg-indigo-50 border-indigo-100 ring-2 ring-indigo-100' : 'bg-slate-50/50 border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                           <img 
                             src={getAvatarUrl(s.avatarSeed || s.name)} 
                             alt={s.name} 
                             className="w-full h-full object-cover"
                           />
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] border border-white text-white font-black ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : 'bg-amber-700'}`}>
                          {i+1}
                        </div>
                      </div>
                      <span className="text-xs font-black text-slate-700">{s.name} {s.name === student?.name && "(Siz)"}</span>
                    </div>
                    <span className="text-xs font-black text-indigo-600">{s.avg}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PROGRESS CHART (TUZATILGAN) */}
            <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
               <h3 className="text-sm font-black text-slate-800 mb-4 px-2">Progress</h3>
               {/* minWidth={0} qo'shildi va debounce */}
               <div className="w-full h-[250px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={100}>
                    <AreaChart data={[...grades].reverse()}>
                      <defs><linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/><stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="dateStr" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '15px', border: 'none' }} />
                      <Area type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={3} fill="url(#scoreColor)" />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>
          </div>
        )}
        
        {/* 2. SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-lg font-black text-slate-800 px-2 uppercase italic">Dars Jadvali</h2>
            
            {Object.keys(groupedLessons).map((month, index) => {
              const monthLessons = groupedLessons[month];
              const isExpanded = expandedMonths[month] || index === 0;
              const hasTrouble = hasProblemInMonth(monthLessons);

              return (
                <div key={month} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                  <div onClick={() => toggleMonth(month)} className={`p-5 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600"><Calendar size={20} /></div>
                      <div>
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">{month}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{monthLessons.length} ta dars</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {hasTrouble && <div className="flex items-center gap-1 bg-red-100 text-red-500 px-2 py-1 rounded-lg"><AlertCircle size={12} /><span className="text-[9px] font-black uppercase">Alert</span></div>}
                      {isExpanded ? <ChevronUp className="text-slate-400" size={20}/> : <ChevronDown className="text-slate-400" size={20}/>}
                    </div>
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
                            <div className="flex justify-between items-start">
                              <div>
                                <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${isProblematic ? 'bg-red-500 text-white' : 'bg-indigo-50 text-indigo-600'}`}>{lesson.date}</span>
                                <h4 className="font-black text-slate-800 text-sm mt-3 uppercase">{lesson.topic}</h4>
                              </div>
                              {isProblematic ? <AlertCircle className="text-red-500 animate-pulse" size={22} /> : <BookOpen className="text-slate-200" size={22} />}
                            </div>
                            
                            {isProblematic && (
                              <div className="mt-4 pt-4 border-t border-red-100 flex items-center gap-2 text-red-600 font-black text-[9px] uppercase tracking-tighter">
                                <AlertCircle size={12} /> 
                                {isMissing ? "Topshirilmagan / Baholanmagan" : `Past Baho: ${lessonGrade.score}% (Retake)`}
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2 mt-3">
                              {lesson.tasks?.map((t, idx) => (
                                <span key={idx} className={`border px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-tighter ${isProblematic ? 'bg-white border-red-100 text-red-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>{typeof t === 'object' ? t.text : t}</span>
                              ))}
                            </div>
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
              {[...grades].map((g, i) => (
                <div key={i} className={`p-5 rounded-[2rem] border bg-white shadow-sm flex items-center justify-between ${g.score <= 20 ? 'border-red-200 bg-red-50/30' : 'border-slate-100'}`}>
                  <div className="flex-1 pr-4">
                    <p className="font-black text-slate-700 text-xs uppercase mb-2">{g.comment || 'Mavzu'}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-widest">{g.taskType}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase">{g.dateStr}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-black ${g.score >= 80 ? 'text-emerald-500' : g.score <= 20 ? 'text-red-500' : 'text-indigo-600'}`}>{g.score}%</div>
                    {g.score <= 20 && (
                      <div className="flex items-center justify-end gap-1 mt-1 text-red-500 font-black text-[7px] uppercase tracking-tighter animate-pulse">
                        <RefreshCcw size={8} /> Retake Required
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default StudentDashboard;