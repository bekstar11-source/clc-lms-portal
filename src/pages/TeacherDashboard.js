import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // useLocation qo'shildi
import { auth, db } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  Users, ChevronRight, LayoutGrid, Loader2, 
  Sparkles, BookOpen, CheckCircle2, XCircle, 
  AlertTriangle, TrendingDown
} from 'lucide-react';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation(); // URL ni tekshirish uchun
  const [teacherName, setTeacherName] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retakeAlerts, setRetakeAlerts] = useState([]);
  const [debtors, setDebtors] = useState([]);
  
  // Agar URL /debtors bo'lsa, avtomatik 'debtors' tabini ochamiz
  const [activeTab, setActiveTab] = useState(location.pathname === '/debtors' ? 'debtors' : 'groups');

  // URL o'zgarganda tabni ham o'zgartirish (MobileNavbar uchun)
  useEffect(() => {
    if (location.pathname === '/debtors') {
      setActiveTab('debtors');
    } else {
      setActiveTab('groups');
    }
  }, [location.pathname]);

  useEffect(() => {
    const fetchData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      
      try {
        // 1. Teacher va Guruhlarni PARALLEL olish
        const userRef = doc(db, "students", currentUser.uid);
        const groupsQuery = query(collection(db, "groups"), where("teacherId", "==", currentUser.uid));
        
        // Ikkala so'rovni bir vaqtda yuboramiz (kutib turmasdan)
        const [userDoc, groupsSnap] = await Promise.all([
            getDoc(userRef),
            getDocs(groupsQuery)
        ]);

        if (userDoc.exists()) setTeacherName(userDoc.data().name);
        
        const fetchedGroups = groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGroups(fetchedGroups);

        // 2. Barcha guruhlar uchun O'quvchilar va Baholarni PARALLEL olish
        // Bu joy eng ko'p vaqtni tejaydi
        const groupsDataPromises = fetchedGroups.map(async (grp) => {
            const qStudents = query(collection(db, "students"), where("groupId", "==", grp.id));
            const qGrades = query(collection(db, "grades"), where("groupId", "==", grp.id));

            // Har bir guruh uchun student va baholarni birdaniga olamiz
            const [studSnap, gradesSnap] = await Promise.all([
                getDocs(qStudents),
                getDocs(qGrades)
            ]);

            return {
                groupName: grp.name,
                groupId: grp.id,
                students: studSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                grades: gradesSnap.docs.map(d => d.data()),
                gradeDocs: gradesSnap.docs // ID kerak bo'lsa
            };
        });

        // Barcha guruhlar ma'lumotlari kelishini kutamiz
        const allGroupsData = await Promise.all(groupsDataPromises);

        // 3. Ma'lumotlarni yig'ish (Lokal hisob-kitob)
        let alerts = [];
        let allDebtors = [];

        allGroupsData.forEach(({ groupName, groupId, students, grades, gradeDocs }) => {
            // Tezkor qidiruv uchun Map
            const studentsMap = {};
            students.forEach(s => studentsMap[s.id] = s.name);

            // A) RETAKE ALERTS
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
                        highlightKey: `${g.lessonId}_${g.taskType}`
                    });
                }
            });

            // B) DEBTORS (QARZDORLAR)
            students.forEach(student => {
                const studentGrades = grades.filter(g => g.studentId === student.id);
                const validGrades = studentGrades.map(g => Number(g.score)).filter(s => !isNaN(s));
                
                let average = 0;
                if (validGrades.length > 0) {
                    average = Math.round(validGrades.reduce((a, b) => a + b, 0) / validGrades.length);
                }

                if (average < 60 && validGrades.length > 0) {
                    allDebtors.push({
                        id: student.id,
                        name: student.name,
                        groupId: groupId,
                        groupName: groupName,
                        averageScore: average
                    });
                }
            });
        });

        setRetakeAlerts(alerts);
        setDebtors(allDebtors.sort((a, b) => a.averageScore - b.averageScore));

      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchData();
  }, []); // Faqat bir marta yuklanadi

  const handleAlertClick = (alert) => {
      navigate(`/group/${alert.groupId}`, { 
        state: { openStudentId: alert.studentId, highlightKey: alert.highlightKey } 
      });
  };

  const handleRejectRetake = async (e, alertId) => {
      e.stopPropagation();
      if(!window.confirm("Rad etasizmi?")) return;
      try {
          await updateDoc(doc(db, "grades", alertId), { status: 'retake_needed' });
          setRetakeAlerts(prev => prev.filter(a => a.id !== alertId));
      } catch (error) { alert(error.message); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-28 md:pb-10">
      
      {/* DESKTOP/TABLET CONTAINER */}
      <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-3 animate-in fade-in slide-in-from-top-4 duration-700">
            <div>
            <div className="flex items-center gap-2 mb-1">
                <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                    <Sparkles size={12}/> Teacher Panel
                </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight leading-tight">
                Salom, <span className="text-indigo-600">{teacherName.split(' ')[0]}</span>!
            </h1>
            </div>
        </div>

        {/* ----------------- 1. GURUHLAR TAB (ASOSIY) ----------------- */}
        {activeTab === 'groups' && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                {/* RETAKE ALERTS */}
                {retakeAlerts.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <CheckCircle2 size={20} className="text-indigo-600" />
                            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                Tekshiruv Kutayotgan ({retakeAlerts.length})
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {retakeAlerts.map((alert, idx) => (
                                <div key={idx} onClick={() => handleAlertClick(alert)} className="group p-4 rounded-2xl border border-indigo-100 bg-white shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98]">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 whitespace-nowrap">TEKSHIRISH</span>
                                            <span className="text-[10px] font-bold text-slate-500 truncate">{alert.groupName}</span>
                                        </div>
                                        <p className="font-bold text-slate-700 text-sm truncate">{alert.studentName}</p>
                                        <p className="text-[11px] text-slate-400 truncate w-full">{alert.topic}</p>
                                    </div>
                                    <div className="flex items-center gap-2 pl-2 border-l border-slate-100 shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center"><ChevronRight size={20} /></div>
                                        <button onClick={(e) => handleRejectRetake(e, alert.id)} className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center"><XCircle size={20} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* GURUHLAR GRID */}
                <div>
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-lg shadow-indigo-200"><LayoutGrid size={14}/></div>
                        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Guruhlarim ({groups.length})</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                        {groups.length === 0 ? (
                            <div className="col-span-full text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-300"><LayoutGrid className="mx-auto text-slate-300 mb-3" size={32} /><p className="font-bold text-slate-400 text-xs">Guruhlar mavjud emas.</p></div>
                        ) : (
                            groups.map((group, index) => {
                                const variants = [{ from: 'from-blue-500', to: 'to-indigo-600', shadow: 'shadow-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-600' }, { from: 'from-emerald-400', to: 'to-teal-600', shadow: 'shadow-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-600' }, { from: 'from-rose-400', to: 'to-pink-600', shadow: 'shadow-rose-200', bg: 'bg-rose-50', text: 'text-rose-600' }, { from: 'from-amber-400', to: 'to-orange-600', shadow: 'shadow-orange-200', bg: 'bg-orange-50', text: 'text-orange-600' }];
                                const style = variants[index % variants.length];
                                return (
                                    <div key={group.id} onClick={() => navigate(`/group/${group.id}`)} className={`relative bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-4 md:p-8 shadow-md md:shadow-xl ${style.shadow} border border-slate-50 cursor-pointer active:scale-95 overflow-hidden flex flex-col justify-between min-h-[160px] md:h-auto`}>
                                        <div className="relative z-10">
                                            <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br ${style.from} ${style.to} flex items-center justify-center text-white shadow-md mb-3 md:mb-6`}><BookOpen className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} /></div>
                                            <h3 className="text-sm md:text-xl font-black text-slate-800 mb-1 leading-tight line-clamp-2">{group.name}</h3>
                                            <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-wider ${style.text} opacity-80`}>Active Class</p>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                                            <div className="hidden md:flex -space-x-2">{[1,2,3].map(i => (<div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-400"><Users size={12}/></div>))}</div>
                                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${style.bg} flex items-center justify-center ${style.text} ml-auto`}><ChevronRight className="w-4 h-4 md:w-5 md:h-5" /></div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* ----------------- 2. QARZDORLAR TAB (DEBTORS) ----------------- */}
        {activeTab === 'debtors' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2 mb-4 px-1">
                    <div className="bg-red-500 p-1.5 rounded-lg text-white shadow-lg shadow-red-200"><AlertTriangle size={14}/></div>
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Qarzdorlar ({debtors.length})</h2>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    {debtors.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4"><Sparkles className="text-emerald-500" size={32}/></div>
                            <h3 className="text-sm font-black text-slate-800">Hammasi joyida!</h3>
                            <p className="text-xs text-slate-400 mt-1">Hozircha qarzdor o'quvchilar yo'q.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {debtors.map((student, idx) => (
                                <div key={idx} onClick={() => navigate(`/group/${student.groupId}`, { state: { openStudentId: student.id }})} className="p-4 hover:bg-red-50/30 transition-colors cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-black text-xs shrink-0 border border-red-200">
                                            {student.averageScore}%
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-slate-800 text-sm truncate">{student.name}</h4>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[100px]">{student.groupName}</span>
                                                <span className="text-[9px] font-black text-red-500 flex items-center gap-0.5"><TrendingDown size={10}/> Past o'zlashtirish</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 shrink-0">
                                        <ChevronRight size={16}/>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default TeacherDashboard;