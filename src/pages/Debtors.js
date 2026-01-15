import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { 
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, 
  AlertTriangle, BookOpen, Calendar, Timer, RefreshCw,
  X, AlertOctagon, XCircle
} from 'lucide-react';

// ... (CountdownTimer komponenti o'zgarishsiz qoladi) ...
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
      if (days === 0) {
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeLeft(`${hours}s ${minutes}m`);
      } else {
          setTimeLeft(`${days}k ${hours}s`);
      }
    };
    calculateTime(); 
    const timer = setInterval(calculateTime, 60000); 
    return () => clearInterval(timer);
  }, [deadline]);
  return <span className="font-mono font-bold text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-1 whitespace-nowrap">{timeLeft}</span>;
};

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

      // 1. KESH LOGIKASI (O'zgarishsiz)
      if (!forceRefresh) {
        const cachedData = localStorage.getItem('debtorsCachev2'); // Versiya 2
        const cachedTime = localStorage.getItem('debtorsTimev2');
        if (cachedData && cachedTime && (new Date().getTime() - parseInt(cachedTime) < 10 * 60 * 1000)) {
            setReportData(JSON.parse(cachedData));
            setLastUpdated(new Date(parseInt(cachedTime)).toLocaleTimeString());
            setLoading(false);
            return;
        }
      }

      try {
        const qGroups = query(collection(db, "groups"), where("teacherId", "==", user.uid));
        const groupSnap = await getDocs(qGroups);
        const groups = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const today = new Date().toISOString().split('T')[0];

        const groupsPromises = groups.map(async (group) => {
            const [studSnap, lessonSnap, gradeSnap] = await Promise.all([
                getDocs(query(collection(db, "students"), where("groupId", "==", group.id))),
                getDocs(query(collection(db, "lessons"), where("groupId", "==", group.id), orderBy("date", "asc"))),
                getDocs(query(collection(db, "grades"), where("groupId", "==", group.id)))
            ]);

            const students = studSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
            const pastLessons = lessonSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.date <= today);
            const grades = gradeSnap.docs.map(d => d.data());

            const groupDebtors = [];
            
            students.forEach(student => {
                const problematicLessons = [];

                pastLessons.forEach(lesson => {
                    // 🔥 MUHIM O'ZGARISH: Har bir TASK ni alohida tekshiramiz
                    // Agar darsda tasklar bo'lmasa, default 'Homework' deb olamiz
                    const tasksToCheck = lesson.tasks && lesson.tasks.length > 0 ? lesson.tasks : [{ text: 'Homework' }];
                    
                    const failedTasks = [];
                    let hasMissing = false;
                    let hasLow = false;
                    let lessonDeadline = null; // Eng yaqin deadline

                    tasksToCheck.forEach(task => {
                        const taskName = typeof task === 'object' ? task.text : task;
                        
                        // Shu aniq task uchun bahoni qidiramiz
                        // GroupDetails.js da taskType taskName bilan bir xil saqlangan edi
                        const grade = grades.find(g => 
                            g.studentId === student.id && 
                            g.lessonId === lesson.id && 
                            g.taskType === taskName
                        );

                        let deadlineStr = null;
                        if (grade?.retakeDeadline) {
                             const d = grade.retakeDeadline.toDate ? grade.retakeDeadline.toDate() : new Date(grade.retakeDeadline);
                             deadlineStr = d.toISOString();
                             if (!lessonDeadline || d < new Date(lessonDeadline)) lessonDeadline = deadlineStr;
                        }

                        if (!grade) {
                            // Baho yo'q = Topshirilmagan
                            hasMissing = true;
                            failedTasks.push({ name: taskName, status: 'missing', score: 0 });
                        } else if (grade.score < 60) {
                            // Baho past
                            hasLow = true;
                            failedTasks.push({ name: taskName, status: 'low', score: grade.score, deadline: deadlineStr });
                        }
                    });

                    // Agar shu darsda kamida bitta muammoli task bo'lsa
                    if (failedTasks.length > 0) {
                        problematicLessons.push({
                            topic: lesson.topic || "Mavzu yo'q",
                            date: lesson.date,
                            // Agar hammasi missing bo'lsa missing, aralash bo'lsa mixed
                            type: hasMissing && !hasLow ? 'missing' : hasLow && !hasMissing ? 'low' : 'mixed',
                            tasks: failedTasks, // Faqat muammoli tasklar ro'yxati
                            deadline: lessonDeadline
                        });
                    }
                });

                if (problematicLessons.length > 0) {
                    groupDebtors.push({ studentName: student.name, debts: problematicLessons });
                }
            });

            if (groupDebtors.length > 0) return { groupName: group.name, groupId: group.id, debtors: groupDebtors };
            return null;
        });

        const results = await Promise.all(groupsPromises);
        const finalData = results.filter(g => g !== null);

        setReportData(finalData);
        localStorage.setItem('debtorsCachev2', JSON.stringify(finalData));
        localStorage.setItem('debtorsTimev2', new Date().getTime().toString());
        setLastUpdated(new Date().toLocaleTimeString());

      } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    loadDebtors();
  }, []);

  const refreshData = () => {
    localStorage.removeItem('debtorsCachev2'); 
    window.location.reload(); 
  };

  const toggleGroup = (groupId) => {
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 pb-28 md:pb-24">
       <div className="mb-6 flex justify-between items-end">
         <div>
            <div className="flex items-center gap-2 mb-1">
                <div className="bg-rose-100 p-2 rounded-xl text-rose-600"><AlertTriangle size={20} /></div>
                <h1 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Qarzdorlar</h1>
            </div>
            <p className="text-slate-400 font-bold text-[10px]">Yangilandi: {lastUpdated}</p>
         </div>
         <button onClick={refreshData} className="p-2.5 bg-white text-indigo-600 rounded-xl shadow-sm border border-indigo-100 active:scale-95"><RefreshCw size={18} /></button>
       </div>

       <div className="space-y-4">
         {reportData.length === 0 ? (
           <div className="bg-white p-8 rounded-[2rem] border border-slate-100 text-center shadow-sm">
              <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-3" />
              <h3 className="text-base font-black text-slate-700">Qarzdorlar yo'q!</h3>
           </div>
         ) : (
           reportData.map((group) => (
             <div key={group.groupId} className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div onClick={() => toggleGroup(group.groupId)} className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${expandedGroup === group.groupId ? 'bg-slate-50 border-b border-slate-100' : ''}`}>
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-black text-sm shadow-sm">{group.groupName.charAt(0)}</div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800">{group.groupName}</h3>
                        <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded-md w-fit mt-0.5"><AlertCircle size={8}/> {group.debtors.length} ta o'quvchi</p>
                      </div>
                   </div>
                   {expandedGroup === group.groupId ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                </div>

                {expandedGroup === group.groupId && (
                  <div className="bg-white p-2 md:p-4 space-y-3">
                     {group.debtors.map((record, idx) => (
                       <div key={idx} className="p-3 md:p-4 rounded-2xl border border-slate-100 bg-slate-50/30">
                          <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-[10px]">{record.studentName.charAt(0)}</div>
                              <span className="font-black text-slate-700 text-xs md:text-sm">{record.studentName}</span>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                             {record.debts.map((debt, i) => {
                                // Ranglarni aniqlash (Mixed holati uchun to'q sariq)
                                const isMissing = debt.type === 'missing';
                                const isLow = debt.type === 'low';
                                
                                let statusColor = isMissing ? 'rose' : (isLow ? 'amber' : 'orange');
                                let borderColor = isMissing ? 'border-rose-200' : (isLow ? 'border-amber-200' : 'border-orange-200');
                                let bgColor = isMissing ? 'bg-rose-50/50' : (isLow ? 'bg-amber-50/50' : 'bg-orange-50/50');

                                return (
                                   <div key={i} className={`relative rounded-xl border ${borderColor} ${bgColor} overflow-hidden p-3`}>
                                      {/* Yon chiziq */}
                                      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-${statusColor}-500`}></div>
                                      
                                      <div className="pl-3">
                                          {/* Dars Mavzusi */}
                                          <div className="flex justify-between items-start">
                                              <div className="flex items-center gap-2 mb-1">
                                                  <BookOpen size={14} className={`text-${statusColor}-500`} />
                                                  <h4 className="font-black text-slate-800 text-xs leading-tight">{debt.topic}</h4>
                                              </div>
                                              <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><Calendar size={10}/> {debt.date}</span>
                                          </div>

                                          {/* 🔥 MUAMMOLI VAZIFALAR RO'YXATI (KOMPAKT) */}
                                          <div className="mt-2 space-y-1.5">
                                              {debt.tasks.map((task, tIdx) => (
                                                  <div key={tIdx} className="flex items-center justify-between bg-white/80 p-1.5 rounded-lg border border-slate-100">
                                                      <div className="flex items-center gap-2 min-w-0">
                                                          {task.status === 'missing' ? 
                                                              <XCircle size={14} className="text-rose-500 shrink-0"/> : 
                                                              <AlertOctagon size={14} className="text-amber-500 shrink-0"/>
                                                          }
                                                          <span className="text-[10px] font-bold text-slate-600 truncate">{task.name}</span>
                                                      </div>
                                                      
                                                      {/* Baho yoki Status */}
                                                      <div className="flex items-center gap-2 shrink-0">
                                                          {task.status === 'low' ? (
                                                              <div className="flex items-center gap-1">
                                                                  <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                                      <div className="h-full bg-amber-500 rounded-full" style={{width: `${task.score}%`}}></div>
                                                                  </div>
                                                                  <span className="text-[10px] font-black text-amber-600">{task.score}%</span>
                                                              </div>
                                                          ) : (
                                                              <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">Yo'q</span>
                                                          )}
                                                          
                                                          {/* Countdown */}
                                                          {task.status === 'low' && task.deadline && <CountdownTimer deadline={task.deadline} />}
                                                      </div>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                   </div>
                                );
                             })}
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