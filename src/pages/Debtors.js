import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { 
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, 
  AlertTriangle, BookOpen, Calendar, RefreshCw,
  AlertOctagon, XCircle, ArrowRight
} from 'lucide-react';

// --- HELPER: COUNTDOWN TIMER ---
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
          setTimeLeft(`${hours}h ${minutes}m`);
      } else {
          setTimeLeft(`${days}d ${hours}h`);
      }
    };
    calculateTime(); 
    const timer = setInterval(calculateTime, 60000); 
    return () => clearInterval(timer);
  }, [deadline]);
  return <span className="font-mono font-bold text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-1 whitespace-nowrap tracking-tight">{timeLeft}</span>;
};

const Debtors = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState([]);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const loadDebtors = async (forceRefresh = false) => {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;

      // 1. CACHE CHECK
      if (!forceRefresh) {
        const cachedData = localStorage.getItem('debtorsCachev2'); 
        const cachedTime = localStorage.getItem('debtorsTimev2');
        if (cachedData && cachedTime && (new Date().getTime() - parseInt(cachedTime) < 10 * 60 * 1000)) {
            setReportData(JSON.parse(cachedData));
            setLastUpdated(new Date(parseInt(cachedTime)).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
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
                    groupDebtors.push({ studentId: student.id, studentName: student.name, debts: problematicLessons });
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
        setLastUpdated(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));

      } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    loadDebtors();
  }, []);

  const refreshData = () => {
    localStorage.removeItem('debtorsCachev2'); 
    window.location.reload(); 
  };

  const toggleGroup = (groupId) => {
    if (navigator.vibrate) navigator.vibrate(10);
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
  };

  const navigateToStudent = (groupId, studentId, lessonId) => {
      // Navigate to Group Details, open Grading Modal for specific student & Highlight the lesson
      navigate(`/group/${groupId}`, { state: { openStudentId: studentId, highlightLessonId: lessonId } });
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 pb-28 md:pb-24 font-sans touch-manipulation">
       {/* HEADER */}
       <div className="mb-6 flex justify-between items-end">
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

       {/* CONTENT */}
       <div className="space-y-4">
         {reportData.length === 0 ? (
           <div className="bg-white p-10 rounded-[2rem] border border-slate-100 text-center shadow-sm flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-black text-slate-700">All Clear!</h3>
              <p className="text-xs text-slate-400 mt-1">No outstanding debts found.</p>
           </div>
         ) : (
           reportData.map((group) => (
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
                                    
                                    // Visual Styles
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