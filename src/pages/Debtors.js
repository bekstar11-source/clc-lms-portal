import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { 
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, 
  AlertTriangle, BookOpen, Calendar, RefreshCw,
  AlertOctagon, XCircle, ArrowRight, Search, Timer, Flame // 🔥 Flame ikonkasini qo'shdik
} from 'lucide-react';

// --- HELPER: COUNTDOWN TIMER ---
const CountdownTimer = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!deadline) return;
    const calculateTime = () => {
      const now = new Date();
      const target = new Date(deadline); 
      const diff = target - now;
      
      if (diff <= 0) { 
          setTimeLeft("TUGADI"); 
          setIsExpired(true);
          return; 
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (days === 0) {
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeLeft(`${hours}h ${minutes}m`);
      } else {
          setTimeLeft(`${days}d ${hours}h`);
      }
    };
    calculateTime(); 
    const timer = setInterval(calculateTime, 60000); 
    return () => clearInterval(timer);
  }, [deadline]);

  return (
    <span className={`flex items-center gap-1 font-mono font-bold text-[9px] px-1.5 py-0.5 rounded ml-1 whitespace-nowrap tracking-tight border ${isExpired ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-amber-600 bg-amber-50 border-amber-100'}`}>
       <Timer size={10} /> {timeLeft}
    </span>
  );
};

const Debtors = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState([]);
  const [filteredData, setFilteredData] = useState([]); 
  const [searchQuery, setSearchQuery] = useState(''); 
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // 🔥🔥🔥 YANGI STATE: Shoshilinch qarzdorlar ro'yxati
  const [urgentList, setUrgentList] = useState([]);

  useEffect(() => {
    const loadDebtors = async (forceRefresh = false) => {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;

      if (!forceRefresh) {
        const cachedData = localStorage.getItem('debtorsCachev2'); 
        const cachedTime = localStorage.getItem('debtorsTimev2');
        if (cachedData && cachedTime && (new Date().getTime() - parseInt(cachedTime) < 10 * 60 * 1000)) {
            const parsed = JSON.parse(cachedData);
            setReportData(parsed);
            setFilteredData(parsed);
            processUrgentDebts(parsed); // 🔥 Keshdan olinganda ham hisoblash
            setLastUpdated(new Date(parseInt(cachedTime)).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
            setLoading(false);
            return;
        }
      }

      try {
        const qMainGroups = query(collection(db, "groups"), where("teacherId", "==", user.uid));
        const qAssistGroups = query(collection(db, "groups"), where("assistantTeacherId", "==", user.uid));
        
        const [mainSnap, assistSnap] = await Promise.all([
            getDocs(qMainGroups),
            getDocs(qAssistGroups)
        ]);

        const mainGroups = mainSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const assistGroups = assistSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const allRawGroups = [...mainGroups, ...assistGroups];
        const groups = allRawGroups.filter((group, index, self) =>
            index === self.findIndex((t) => t.id === group.id)
        );

        const today = new Date().toISOString().split('T')[0];

        const groupsPromises = groups.map(async (group) => {
            const [studSnap, lessonSnap, gradeSnap] = await Promise.all([
                getDocs(query(collection(db, "students"), where("groupId", "==", group.id))),
                getDocs(query(collection(db, "lessons"), where("groupId", "==", group.id), orderBy("date", "asc"))),
                getDocs(query(collection(db, "grades"), where("groupId", "==", group.id)))
            ]);

            const students = studSnap.docs.map(d => ({ id: d.id, name: d.data().name, avatar: d.data().avatarSeed }));
            const pastLessons = lessonSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.date <= today && !l.isDelayed); 
            const grades = gradeSnap.docs.map(d => d.data());

            const groupDebtors = [];
            
            students.forEach(student => {
                const problematicLessons = [];

                pastLessons.forEach(lesson => {
                    const tasksToCheck = lesson.tasks && lesson.tasks.length > 0 ? lesson.tasks : [{ text: 'Homework' }];
                    
                    const failedTasks = [];
                    let hasMissing = false;
                    let hasLow = false;
                    let lessonDeadline = null; 

                    tasksToCheck.forEach(task => {
                        const taskName = typeof task === 'object' ? task.text : task;
                        
                        const grade = grades.find(g => 
                            g.studentId === student.id && 
                            g.lessonId === lesson.id && 
                            g.taskType === taskName
                        );

                        let deadlineStr = null;
                        if (grade?.retakeDeadline) {
                             const d = grade.retakeDeadline.toDate ? grade.retakeDeadline.toDate() : new Date(grade.retakeDeadline);
                             deadlineStr = d.toISOString();
                             // Eng yaqin muddatni olish
                             if (!lessonDeadline || d < new Date(lessonDeadline)) lessonDeadline = deadlineStr;
                        }

                        if (!grade) {
                            hasMissing = true;
                            failedTasks.push({ name: taskName, status: 'missing', score: 0 });
                        } else if (grade.score < 60) {
                            hasLow = true;
                            failedTasks.push({ name: taskName, status: 'low', score: grade.score, deadline: deadlineStr });
                        }
                    });

                    if (failedTasks.length > 0) {
                        problematicLessons.push({
                            lessonId: lesson.id,
                            topic: lesson.topic || "Untitled Lesson",
                            date: lesson.date,
                            type: hasMissing && !hasLow ? 'missing' : hasLow && !hasMissing ? 'low' : 'mixed',
                            tasks: failedTasks, 
                            deadline: lessonDeadline 
                        });
                    }
                });

                if (problematicLessons.length > 0) {
                    groupDebtors.push({ 
                        studentId: student.id, 
                        studentName: student.name, 
                        debts: problematicLessons 
                    });
                }
            });

            if (groupDebtors.length > 0) return { groupName: group.name, groupId: group.id, debtors: groupDebtors };
            return null;
        });

        const results = await Promise.all(groupsPromises);
        const finalData = results.filter(g => g !== null);

        setReportData(finalData);
        setFilteredData(finalData);
        processUrgentDebts(finalData); // 🔥 Urgentlarni hisoblash

        localStorage.setItem('debtorsCachev2', JSON.stringify(finalData));
        localStorage.setItem('debtorsTimev2', new Date().getTime().toString());
        setLastUpdated(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));

      } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    loadDebtors();
  }, []);

  // 🔥🔥🔥 YANGI FUNKSIYA: 2 kun qolganlarni ajratib olish 🔥🔥🔥
  const processUrgentDebts = (data) => {
      const urgent = [];
      const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
      const now = new Date();

      data.forEach(group => {
          group.debtors.forEach(student => {
              student.debts.forEach(debt => {
                  debt.tasks.forEach(task => {
                      // Faqat deadline bor va (score < 60) bo'lganlar
                      if (task.deadline && task.status === 'low') {
                          const deadlineDate = new Date(task.deadline);
                          const diff = deadlineDate - now;

                          // Agar 2 kundan kam qolgan bo'lsa yoki vaqt o'tib ketgan bo'lsa
                          if (diff <= twoDaysInMs) {
                              urgent.push({
                                  studentName: student.studentName,
                                  studentId: student.studentId,
                                  groupName: group.groupName,
                                  groupId: group.groupId,
                                  lessonId: debt.lessonId,
                                  taskName: task.name,
                                  deadline: task.deadline,
                                  score: task.score,
                                  diff: diff // Saralash uchun kerak bo'ladi
                              });
                          }
                      }
                  });
              });
          });
      });

      // Eng oz vaqt qolganlarni yuqoriga chiqaramiz
      urgent.sort((a, b) => a.diff - b.diff);
      setUrgentList(urgent);
  };

  useEffect(() => {
      if (!searchQuery.trim()) {
          setFilteredData(reportData);
          setExpandedGroup(null); 
      } else {
          const lowerQ = searchQuery.toLowerCase();
          const filtered = reportData.map(group => {
              if (group.groupName.toLowerCase().includes(lowerQ)) return group;
              
              const matchingDebtors = group.debtors.filter(d => d.studentName.toLowerCase().includes(lowerQ));
              
              if (matchingDebtors.length > 0) {
                  return { ...group, debtors: matchingDebtors };
              }
              return null;
          }).filter(g => g !== null);
          
          setFilteredData(filtered);
          if (filtered.length > 0) setExpandedGroup(filtered[0].groupId);
      }
  }, [searchQuery, reportData]);

  const refreshData = () => {
    localStorage.removeItem('debtorsCachev2'); 
    window.location.reload(); 
  };

  const toggleGroup = (groupId) => {
    if (navigator.vibrate) navigator.vibrate(10);
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
  };

  const navigateToStudent = (groupId, studentId, lessonId) => {
      navigate(`/group/${groupId}`, { state: { openStudentId: studentId, highlightLessonId: lessonId } });
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 pb-28 md:pb-24 font-sans touch-manipulation">
       
       {/* HEADER & SEARCH */}
       <div className="mb-6 space-y-4">
         <div className="flex justify-between items-end">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <div className="bg-rose-100 p-2 rounded-xl text-rose-600"><AlertTriangle size={20} /></div>
                    <h1 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Debtors List</h1>
                </div>
                <p className="text-slate-400 font-bold text-[10px] flex items-center gap-1">
                    {lastUpdated ? `Updated: ${lastUpdated}` : 'Syncing...'}
                </p>
            </div>
            <button onClick={refreshData} className="p-3 bg-white text-indigo-600 rounded-xl shadow-sm border border-indigo-100 active:scale-95 transition-transform"><RefreshCw size={18} /></button>
         </div>

         {/* QIDIRUV MAYDONI */}
         <div className="relative group">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18}/>
             <input 
                type="text" 
                placeholder="Search student or group..." 
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
             />
         </div>
       </div>

       {/* 🔥🔥🔥 SHOSHILINCH (URGENT) QATORI 🔥🔥🔥 */}
       {urgentList.length > 0 && (
           <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
               <div className="flex items-center gap-2 mb-3">
                   <Flame size={18} className="text-orange-500 animate-pulse" />
                   <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Critical Retakes (&lt; 48h)</h2>
                   <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{urgentList.length}</span>
               </div>
               
               {/* Gorizontal scroll bo'ladigan ro'yxat */}
               <div className="flex overflow-x-auto gap-3 pb-4 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide snap-x">
                   {urgentList.map((item, index) => (
                       <div 
                           key={index}
                           onClick={() => navigateToStudent(item.groupId, item.studentId, item.lessonId)}
                           className="snap-center min-w-[260px] bg-white p-4 rounded-2xl border-l-4 border-l-orange-500 border-y border-r border-slate-100 shadow-lg shadow-orange-100/50 active:scale-95 transition-transform cursor-pointer relative overflow-hidden"
                       >
                           {/* Background effect */}
                           <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>

                           <div className="flex justify-between items-start mb-2 relative z-10">
                               <div>
                                   <h4 className="font-black text-slate-800 text-sm truncate w-40">{item.studentName}</h4>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase">{item.groupName}</p>
                               </div>
                               <div className="bg-orange-50 px-2 py-1 rounded-lg border border-orange-100 flex flex-col items-center">
                                   <span className="text-xs font-black text-orange-600">{item.score}%</span>
                               </div>
                           </div>

                           <div className="flex items-center justify-between relative z-10">
                               <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                   <AlertCircle size={12} className="text-orange-500 shrink-0"/>
                                   <span className="text-[10px] font-medium text-slate-600 truncate">{item.taskName}</span>
                               </div>
                               <CountdownTimer deadline={item.deadline} />
                           </div>
                       </div>
                   ))}
               </div>
           </div>
       )}

       {/* ASOSIY CONTENT (Guruhlar ro'yxati) */}
       <div className="space-y-4">
         {filteredData.length === 0 ? (
           <div className="bg-white p-10 rounded-[2rem] border border-slate-100 text-center shadow-sm flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-black text-slate-700">All Clear!</h3>
              <p className="text-xs text-slate-400 mt-1">No outstanding debts found.</p>
           </div>
         ) : (
           filteredData.map((group) => (
             <div key={group.groupId} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden transition-all duration-300">
                <div onClick={() => toggleGroup(group.groupId)} className={`p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100 ${expandedGroup === group.groupId ? 'bg-slate-50/80 border-b border-slate-100' : ''}`}>
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-sm shadow-sm border border-indigo-100">{group.groupName.charAt(0)}</div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800">{group.groupName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                             <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 flex items-center gap-1">
                                <AlertCircle size={10}/> {group.debtors.length} Students
                             </span>
                        </div>
                      </div>
                   </div>
                   <div className={`p-2 rounded-full transition-transform duration-300 ${expandedGroup === group.groupId ? 'bg-slate-200 rotate-180' : 'bg-slate-50'}`}>
                        <ChevronDown size={16} className="text-slate-500"/>
                   </div>
                </div>

                {/* ACCORDION CONTENT */}
                <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${expandedGroup === group.groupId ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <div className="overflow-hidden">
                      <div className="p-2 md:p-4 space-y-3 bg-slate-50/30">
                         {group.debtors.map((record, idx) => (
                           <div key={idx} className="p-4 rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                              <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
                                  <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs border border-slate-200">{record.studentName.charAt(0)}</div>
                                      <span className="font-black text-slate-800 text-sm">{record.studentName}</span>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                      {record.debts.length} Issues
                                  </span>
                              </div>

                              <div className="grid grid-cols-1 gap-2">
                                 {record.debts.map((debt, i) => {
                                    const isMissing = debt.type === 'missing';
                                    const isLow = debt.type === 'low';
                                    
                                    const styles = isMissing 
                                        ? { border: 'border-l-rose-500', bg: 'bg-rose-50/30', icon: 'text-rose-500', btn: 'text-rose-600 hover:bg-rose-50' }
                                        : (isLow ? { border: 'border-l-amber-500', bg: 'bg-amber-50/30', icon: 'text-amber-500', btn: 'text-amber-600 hover:bg-amber-50' } 
                                        : { border: 'border-l-orange-500', bg: 'bg-orange-50/30', icon: 'text-orange-500', btn: 'text-orange-600 hover:bg-orange-50' });

                                    return (
                                       <div 
                                         key={i} 
                                         onClick={() => navigateToStudent(group.groupId, record.studentId, debt.lessonId)}
                                         className={`relative rounded-xl border border-slate-100 border-l-4 ${styles.border} ${styles.bg} p-3 cursor-pointer group active:scale-[0.98] transition-all`}
                                       >
                                          <div className="flex justify-between items-start">
                                              <div className="min-w-0 pr-4">
                                                  <div className="flex items-center gap-2 mb-1">
                                                      <BookOpen size={14} className={styles.icon} />
                                                      <h4 className="font-black text-slate-700 text-xs leading-tight truncate">{debt.topic}</h4>
                                                  </div>
                                                  <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><Calendar size={10}/> {debt.date}</span>
                                              </div>
                                              <div className="p-1.5 rounded-lg bg-white border border-slate-100 text-slate-300 group-hover:text-indigo-500 group-hover:border-indigo-200 transition-colors">
                                                  <ArrowRight size={14} />
                                              </div>
                                          </div>

                                          <div className="mt-2.5 space-y-1.5">
                                              {debt.tasks.map((task, tIdx) => (
                                                  <div key={tIdx} className="flex items-center justify-between bg-white/60 p-1.5 rounded-lg border border-slate-100/50">
                                                      <div className="flex items-center gap-2 min-w-0">
                                                          {task.status === 'missing' ? 
                                                              <XCircle size={14} className="text-rose-500 shrink-0"/> : 
                                                              <AlertOctagon size={14} className="text-amber-500 shrink-0"/>
                                                          }
                                                          <span className="text-[10px] font-bold text-slate-600 truncate">{task.name}</span>
                                                      </div>
                                                      
                                                      <div className="flex items-center gap-2 shrink-0">
                                                          {task.status === 'low' ? (
                                                              <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                                                  <span className="text-[9px] font-black text-amber-600">{task.score}%</span>
                                                              </div>
                                                          ) : (
                                                              <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">Missing</span>
                                                          )}
                                                          {/* TIMER */}
                                                          {task.status === 'low' && task.deadline && <CountdownTimer deadline={task.deadline} />}
                                                      </div>
                                                  </div>
                                              ))}
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                           </div>
                         ))}
                      </div>
                  </div>
                </div>
             </div>
           ))
         )}
       </div>
    </div>
  );
};

export default Debtors;