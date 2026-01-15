import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { 
  AlertCircle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Loader2, 
  AlertTriangle, BookOpen, Calendar, Calculator, ListChecks, CheckSquare, Timer, RefreshCw 
} from 'lucide-react';

// 🔥 1. COUNTDOWN TIMER (Bu qism tushib qolgan edi)
const CountdownTimer = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!deadline) return;
    
    const calculateTime = () => {
      const now = new Date();
      // Deadline string (localStorage) yoki Timestamp (Firebase) bo'lishi mumkin
      // new Date() ikkalasini ham o'qiy oladi
      const target = new Date(deadline); 
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft("VAQT TUGADI");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      // Agar kun 0 bo'lsa, faqat soat va minutni ko'rsatamiz
      if (days === 0) {
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeLeft(`${hours}s ${minutes}m qoldi`);
      } else {
          setTimeLeft(`${days}k ${hours}s qoldi`);
      }
    };

    calculateTime(); 
    const timer = setInterval(calculateTime, 60000); 

    return () => clearInterval(timer);
  }, [deadline]);

  return <span className="font-mono font-bold text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded ml-2">{timeLeft}</span>;
};

// 🔥 2. ASOSIY KOMPONENT
const Debtors = () => {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState([]);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const loadDebtors = async (forceRefresh = false) => {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;

      // 1. Keshni tekshiramiz
      if (!forceRefresh) {
        const cachedData = localStorage.getItem('debtorsCache');
        const cachedTime = localStorage.getItem('debtorsTime');
        
        if (cachedData && cachedTime) {
          const now = new Date().getTime();
          // Kesh 10 daqiqa davomida yaroqli
          if (now - parseInt(cachedTime) < 10 * 60 * 1000) { 
            setReportData(JSON.parse(cachedData));
            setLastUpdated(new Date(parseInt(cachedTime)).toLocaleTimeString());
            setLoading(false);
            return; 
          }
        }
      }

      try {
        // 2. Firebase'dan yangi ma'lumot olish (Parallel)
        const qGroups = query(collection(db, "groups"), where("teacherId", "==", user.uid));
        const groupSnap = await getDocs(qGroups);
        const groups = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const today = new Date().toISOString().split('T')[0];

        const groupsPromises = groups.map(async (group) => {
            const qStudents = query(collection(db, "students"), where("groupId", "==", group.id));
            const qLessons = query(collection(db, "lessons"), where("groupId", "==", group.id), orderBy("date", "asc"));
            const qGrades = query(collection(db, "grades"), where("groupId", "==", group.id));

            const [studSnap, lessonSnap, gradeSnap] = await Promise.all([
                getDocs(qStudents), getDocs(qLessons), getDocs(qGrades)
            ]);

            const students = studSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
            const pastLessons = lessonSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.date <= today);
            const grades = gradeSnap.docs.map(d => d.data());

            const groupDebtors = [];
            students.forEach(student => {
                const studentDebts = [];
                pastLessons.forEach(lesson => {
                    const grade = grades.find(g => g.studentId === student.id && g.lessonId === lesson.id);
                    const lessonTasks = lesson.tasks || [];
                    
                    // Deadline'ni stringga o'tkazib olamiz (JSON.stringify buzmasligi uchun)
                    let deadlineStr = null;
                    if (grade?.retakeDeadline) {
                        const dateObj = grade.retakeDeadline.toDate ? grade.retakeDeadline.toDate() : new Date(grade.retakeDeadline);
                        deadlineStr = dateObj.toISOString();
                    }

                    if (!grade) {
                        studentDebts.push({ type: 'missing', topic: lesson.topic || "Mavzu yo'q", date: lesson.date, score: 0, tasks: lessonTasks });
                    } else if (grade.score < 60) {
                        studentDebts.push({ type: 'low', topic: lesson.topic || "Mavzu yo'q", date: lesson.date, score: grade.score, tasks: lessonTasks, deadline: deadlineStr });
                    }
                });
                if (studentDebts.length > 0) groupDebtors.push({ studentName: student.name, debts: studentDebts });
            });

            if (groupDebtors.length > 0) return { groupName: group.name, groupId: group.id, debtors: groupDebtors };
            return null;
        });

        const results = await Promise.all(groupsPromises);
        const finalData = results.filter(g => g !== null);

        // KESHGA SAQLASH
        setReportData(finalData);
        localStorage.setItem('debtorsCache', JSON.stringify(finalData));
        localStorage.setItem('debtorsTime', new Date().getTime().toString());
        setLastUpdated(new Date().toLocaleTimeString());

      } catch (error) {
        console.error("Xatolik:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDebtors();
  }, []);

  const refreshData = () => {
    localStorage.removeItem('debtorsCache'); 
    window.location.reload(); 
  };

  const toggleGroup = (groupId) => {
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 pb-28 md:pb-24">
       {/* HEADER */}
       <div className="mb-8 flex justify-between items-end">
         <div>
            <div className="flex items-center gap-3 mb-2">
                <div className="bg-rose-100 p-2.5 rounded-2xl text-rose-600 shadow-sm shadow-rose-200"><AlertTriangle size={28} /></div>
                <h1 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">Qarzdorlar Nazorati</h1>
            </div>
            <p className="text-slate-400 font-bold text-xs">Oxirgi yangilanish: {lastUpdated}</p>
         </div>
         <button onClick={refreshData} className="p-3 bg-white text-indigo-600 rounded-xl shadow-sm border border-indigo-100 hover:bg-indigo-50 active:scale-95 transition-all">
            <RefreshCw size={20} />
         </button>
       </div>

       <div className="space-y-6">
         {reportData.length === 0 ? (
           <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 text-center shadow-sm">
              <CheckCircle2 size={64} className="mx-auto text-emerald-400 mb-4" />
              <h3 className="text-lg font-black text-slate-700">Ajoyib! Qarzdorlar yo'q.</h3>
           </div>
         ) : (
           reportData.map((group) => (
             <div key={group.groupId} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                {/* GROUP HEADER */}
                <div onClick={() => toggleGroup(group.groupId)} className={`p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${expandedGroup === group.groupId ? 'bg-slate-50 border-b border-slate-100' : ''}`}>
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black shadow-sm">{group.groupName.charAt(0)}</div>
                      <div>
                        <h3 className="text-lg font-black text-slate-800">{group.groupName}</h3>
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-lg w-fit mt-1"><AlertCircle size={10}/> {group.debtors.length} ta o'quvchi</p>
                      </div>
                   </div>
                   {expandedGroup === group.groupId ? <ChevronUp className="text-slate-400"/> : <ChevronDown className="text-slate-400"/>}
                </div>

                {/* STUDENT LIST */}
                {expandedGroup === group.groupId && (
                  <div className="bg-white p-2 md:p-6 space-y-4">
                     {group.debtors.map((record, idx) => (
                       <div key={idx} className="p-4 md:p-6 rounded-[1.5rem] border border-slate-100 bg-slate-50/30">
                          <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">{record.studentName.charAt(0)}</div>
                              <span className="font-black text-slate-700 text-sm md:text-base">{record.studentName}</span>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                             {record.debts.map((debt, i) => (
                               <div key={i} className={`relative p-4 rounded-2xl border ${debt.type === 'missing' ? 'bg-white border-rose-100 shadow-sm shadow-rose-50' : 'bg-white border-amber-100 shadow-sm shadow-amber-50'}`}>
                                  <div className="flex items-start gap-3">
                                      <div className={`shrink-0 p-2 rounded-xl ${debt.type === 'missing' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}>{debt.type === 'missing' ? <XCircle size={20} /> : <Calculator size={20} />}</div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${debt.type === 'missing' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>{debt.type === 'missing' ? 'Topshirilmagan' : 'Past Baho'}</span>
                                          <div className="flex items-center gap-2">
                                            {/* 🔥 COUNTDOWN TIMER QO'SHILDI */}
                                            {debt.type === 'low' && debt.deadline && (<div className="flex items-center gap-1"><Timer size={10} className="text-amber-500"/><CountdownTimer deadline={debt.deadline} /></div>)}
                                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Calendar size={10}/> {debt.date}</span>
                                          </div>
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 leading-tight my-2"><BookOpen size={16} className="text-indigo-400 shrink-0"/> {debt.topic}</h4>
                                        {debt.type === 'low' && (<div className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg w-fit mb-3">Joriy baho: <span className="text-lg">{debt.score}%</span></div>)}
                                        {debt.tasks && debt.tasks.length > 0 ? (<div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><ListChecks size={12}/> Bajarilishi kerak bo'lgan vazifalar:</p><ul className="space-y-1.5">{debt.tasks.map((task, tIdx) => (<li key={tIdx} className="text-xs font-medium text-slate-600 flex items-start gap-2"><CheckSquare size={14} className="text-slate-300 shrink-0 mt-0.5" /><span className={debt.type === 'missing' ? 'text-rose-800' : 'text-slate-600'}>{typeof task === 'object' ? task.text : task}</span></li>))}</ul></div>) : (<p className="text-[10px] italic text-slate-400 mt-2">Qo'shimcha vazifalar kiritilmagan.</p>)}
                                      </div>
                                  </div>
                               </div>
                             ))}
                          </div>
                       </div>
                     ))}
                  </div>
                )}
             </div>
           ))
         )}
       </div>
    </div>
  );
};

export default Debtors;