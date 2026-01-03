import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, query, where, getDocs, doc, updateDoc, 
  serverTimestamp, orderBy, addDoc 
} from 'firebase/firestore';
import { 
  X, Trash2, Edit2, Plus, Star,
  Calendar as CalendarIcon, Users, Loader2, Save, Trophy, BarChart3,
  Target, BookOpen, Sparkles, Zap
} from 'lucide-react';

const Assignments = () => {
  // STATE
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [allGrades, setAllGrades] = useState([]); // Statistika uchun
  
  // EDIT LESSON STATE
  const [editingLesson, setEditingLesson] = useState(null);
  const [newTopic, setNewTopic] = useState('');
  const [newTasks, setNewTasks] = useState([]); 
  
  // GRADING STATE
  const [gradingLesson, setGradingLesson] = useState(null);
  const [lessonGrades, setLessonGrades] = useState({});
  const [savingStatus, setSavingStatus] = useState(null);

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // 1. GURUHLARNI YUKLASH
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(collection(db, "groups"), where("teacherId", "==", user.uid));
        const snap = await getDocs(q);
        const groupList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        setGroups(groupList);
        if (groupList.length > 0) {
          setSelectedGroupId(groupList[0].id);
        }
      } catch (e) {
        console.error("Guruhlarni yuklashda xato:", e);
      } finally {
        setPageLoading(false);
      }
    };
    fetchGroups();
  }, []);

  // 2. MA'LUMOTLARNI YUKLASH (Guruh o'zgarganda)
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedGroupId) return;
      
      setLoading(true);
      try {
        // A) Darslarni yuklash
        const qL = query(collection(db, "lessons"), where("groupId", "==", selectedGroupId), orderBy("date", "desc"));
        const snapL = await getDocs(qL);
        setLessons(snapL.docs.map(d => ({ id: d.id, ...d.data() })));

        // B) O'quvchilarni yuklash
        const qS = query(collection(db, "students"), where("groupId", "==", selectedGroupId));
        const snapS = await getDocs(qS);
        const studentList = snapS.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Alifbo tartibida saralash
        studentList.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(studentList);

        // C) Baholarni yuklash (Statistika uchun)
        const qG = query(collection(db, "grades"), where("groupId", "==", selectedGroupId));
        const snapG = await getDocs(qG);
        // Baholarni to'g'ridan-to'g'ri Number ga o'tkazib olamiz (xavfsizlik uchun)
        setAllGrades(snapG.docs.map(d => ({
            ...d.data(),
            score: Number(d.data().score) || 0 // Matn bo'lsa raqamga aylantirish
        })));

      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };

    fetchData();
  }, [selectedGroupId]);

  // --- STATISTIKA (TOP 3 - TUZATILGAN) ---
  const topStudents = useMemo(() => {
    if (students.length === 0 || allGrades.length === 0) return [];

    const stats = students.map(student => {
        // Shu o'quvchiga tegishli barcha baholar
        const studentGrades = allGrades.filter(g => g.studentId === student.id);
        
        if (studentGrades.length === 0) return { ...student, avg: 0 };
        
        // Jami ballni hisoblash (Faqat raqamlar)
        const total = studentGrades.reduce((sum, g) => {
            const val = Number(g.score); 
            // Agar 100 dan katta bo'lsa (eski xato), uni hisobga olmaymiz yoki 100 deb olamiz
            const cleanVal = val > 100 ? 100 : val; 
            return sum + (isNaN(cleanVal) ? 0 : cleanVal);
        }, 0);

        const avg = Math.round(total / studentGrades.length);
        return { ...student, avg };
    });

    return stats.sort((a, b) => b.avg - a.avg).slice(0, 3);
  }, [students, allGrades]);

  // --- GURUH DIZAYNI ---
  const getGroupStyle = (index) => {
    const styles = [
      { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-500', active: 'bg-blue-600 border-blue-600 shadow-blue-200', icon: Users },
      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-500', active: 'bg-emerald-600 border-emerald-600 shadow-emerald-200', icon: Target },
      { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-500', active: 'bg-amber-500 border-amber-500 shadow-amber-200', icon: Star },
      { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-500', active: 'bg-rose-500 border-rose-500 shadow-rose-200', icon: Sparkles },
      { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-500', active: 'bg-violet-600 border-violet-600 shadow-violet-200', icon: BookOpen },
      { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-500', active: 'bg-cyan-600 border-cyan-600 shadow-cyan-200', icon: Zap },
    ];
    return styles[index % styles.length];
  };

  // --- FUNKSIYALAR ---
  const openGradingModal = async (lesson) => {
    setGradingLesson(lesson);
    setLessonGrades({});
    
    // Shu darsga tegishli baholarni yuklash
    const q = query(collection(db, "grades"), where("lessonId", "==", lesson.id));
    const snap = await getDocs(q);
    
    const loadedGrades = {};
    snap.docs.forEach(doc => {
        const data = doc.data();
        const key = `${data.studentId}_${data.taskType}`; 
        // Load qilganda ham raqamga aylantiramiz
        loadedGrades[key] = { score: Number(data.score), docId: doc.id };
    });
    setLessonGrades(loadedGrades);
  };

  // --- INPUT O'ZGARISHI ---
  const handleGradeChange = (studentId, taskName, value) => {
    const key = `${studentId}_${taskName}`;
    
    if (value === '') {
        setLessonGrades(prev => ({ ...prev, [key]: { ...prev[key], score: '' } }));
        return;
    }

    let numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;
    
    // Cheklov
    if (numValue > 100) numValue = 100;
    if (numValue < 0) numValue = 0;

    setLessonGrades(prev => ({
        ...prev,
        [key]: { ...prev[key], score: numValue }
    }));
  };

  // --- SAQLASH (INTEGRATSIYA TUZATILDI) ---
  const saveGrade = async (studentId, studentName, taskName, value) => {
    const key = `${studentId}_${taskName}`;
    const currentEntry = lessonGrades[key];
    
    if ((value === '' || value === undefined) && !currentEntry?.docId) return;

    setSavingStatus('saving');
    
    // Matn kelib qolsa ham raqamga aylantiramiz
    const safeScore = value === '' ? 0 : Number(value);

    try {
        if (currentEntry?.docId) {
            // Update
            await updateDoc(doc(db, "grades", currentEntry.docId), { 
                score: safeScore, 
                date: serverTimestamp() 
            });
            
            // Statistikani lokal yangilash (sahifa yangilanmasligi uchun)
            setAllGrades(prev => prev.map(g => g.studentId === studentId && g.taskType === taskName && g.lessonId === gradingLesson.id ? { ...g, score: safeScore } : g));

        } else {
            // Create
            const newDoc = await addDoc(collection(db, "grades"), {
                studentId, 
                studentName, 
                groupId: selectedGroupId, 
                lessonId: gradingLesson.id,
                taskType: taskName, 
                comment: gradingLesson.topic, 
                score: safeScore, 
                date: serverTimestamp()
            });
            
            setLessonGrades(prev => ({ ...prev, [key]: { score: safeScore, docId: newDoc.id } }));
            
            // Statistikaga yangi bahoni qo'shish
            setAllGrades(prev => [...prev, { studentId, score: safeScore, groupId: selectedGroupId }]);
        }
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus(null), 1000);
    } catch (e) { console.error("Save error:", e); setSavingStatus('error'); }
  };

  // --- EDIT & DELETE LESSON ---
  const openEditModal = (lesson) => {
    setEditingLesson(lesson);
    setNewTopic(lesson.topic);
    setNewTasks((lesson.tasks || []).map(t => typeof t === 'string' ? { text: t, completed: false } : t));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const lessonRef = doc(db, "lessons", editingLesson.id);
      await updateDoc(lessonRef, { topic: newTopic, tasks: newTasks, updatedAt: serverTimestamp() });
      setLessons(prev => prev.map(l => l.id === editingLesson.id ? { ...l, topic: newTopic, tasks: newTasks } : l));
      setEditingLesson(null);
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  const deleteTaskFromLesson = async (lessonId, currentTasks, taskIndex) => {
    if(!window.confirm("Vazifani o'chirmoqchimisiz?")) return;
    const updatedTasks = currentTasks.filter((_, i) => i !== taskIndex);
    await updateDoc(doc(db, "lessons", lessonId), { tasks: updatedTasks });
    setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, tasks: updatedTasks } : l));
  };

  if (pageLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-indigo-600"/></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32">
      
      {/* 1. HEADER (Rangli Guruhlar) */}
      <div className="bg-white pt-6 pb-4 shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="px-4 mb-4 flex justify-between items-center">
          <h1 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Assignments</h1>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">
            Total: {lessons.length}
          </div>
        </div>

        <div className="flex overflow-x-auto px-4 gap-3 pb-2 no-scrollbar snap-x items-center">
          {groups.map((group, index) => {
            const isActive = selectedGroupId === group.id;
            const style = getGroupStyle(index);
            const Icon = style.icon;

            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className={`snap-center shrink-0 rounded-2xl border transition-all duration-300 ease-in-out flex flex-col justify-center relative overflow-hidden ${
                    isActive 
                    ? `w-48 h-20 px-5 items-start text-white shadow-lg ${style.active}`
                    : `w-16 h-16 items-center hover:bg-opacity-80 ${style.bg} ${style.border} ${style.text}`
                }`}
              >
                {isActive ? (
                   <>
                     <span className="text-[9px] font-black opacity-80 uppercase tracking-widest mb-1">Active</span>
                     <span className="text-sm font-black uppercase tracking-wide truncate w-full text-left">{group.name}</span>
                     <Icon size={80} className="absolute -right-4 -bottom-4 opacity-10 rotate-12"/>
                   </>
                ) : (
                   <Icon size={24} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* 2. TASKS LIST */}
         <div className="lg:col-span-2 space-y-3">
           {selectedGroupId && (
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1 lg:hidden">Tasks List</h3>
           )}

           {lessons.length === 0 ? (
             <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-[2rem]">
                <CalendarIcon className="mx-auto text-slate-300 mb-2" size={32}/>
                <p className="text-xs font-bold text-slate-400">Bu guruhda hali vazifalar yo'q</p>
             </div>
           ) : (
             lessons.map(l => (
               <div key={l.id} className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm relative group hover:border-indigo-200 transition-all">
                  <div className="absolute top-3 right-3 flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openGradingModal(l)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                      <Star size={14}/>
                    </button>
                    <button onClick={() => openEditModal(l)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                      <Edit2 size={14}/>
                    </button>
                  </div>
                  <div className="flex items-start gap-4">
                     <div className="flex flex-col items-center justify-center bg-indigo-50 rounded-2xl p-2 min-w-[3.5rem] h-14 border border-indigo-100">
                        <span className="text-[8px] font-black text-indigo-400 uppercase">{l.date.split('-')[1]}</span>
                        <span className="text-xl font-black text-indigo-600 leading-none">{l.date.split('-')[2]}</span>
                     </div>
                     <div className="flex-1 pt-1">
                        <h4 className="font-bold text-slate-700 text-sm uppercase leading-tight pr-16">{l.topic}</h4>
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {l.tasks?.map((t, i) => (
                            <div key={i} className="flex items-center bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-[9px] text-slate-600 uppercase font-black tracking-wide">
                              {typeof t === 'object' ? t.text : t}
                              <button onClick={() => deleteTaskFromLesson(l.id, l.tasks, i)} className="ml-1.5 text-slate-300 hover:text-red-500"><X size={10} strokeWidth={3} /></button>
                            </div>
                          ))}
                        </div>
                     </div>
                  </div>
               </div>
             ))
           )}
         </div>

         {/* 3. ANALYTICS (Desktop Only) */}
         <div className="hidden lg:block space-y-6">
            
            {/* TOP 3 STUDENTS */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm sticky top-40">
                <div className="flex items-center gap-2 mb-4">
                    <Trophy size={18} className="text-amber-500" />
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Top Performers</h3>
                </div>
                
                <div className="space-y-3">
                    {topStudents.length === 0 ? <p className="text-xs text-slate-400 italic">Ma'lumot yetarli emas</p> : 
                    topStudents.map((s, i) => (
                        <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${i===0 ? 'bg-amber-400' : i===1 ? 'bg-slate-400' : 'bg-orange-400'}`}>
                                    {i+1}
                                </div>
                                <span className="text-xs font-bold text-slate-700">{s.name}</span>
                            </div>
                            <span className="text-xs font-black text-indigo-600">{s.avg}%</span>
                        </div>
                    ))}
                </div>

                {/* COMPACT BAR CHART */}
                <div className="mt-8 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 size={18} className="text-indigo-500" />
                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Performance</h3>
                    </div>
                    
                    <div className="flex items-end justify-between h-24 gap-2 px-2">
                        {topStudents.map((s, i) => (
                            <div key={s.id} className="flex flex-col items-center gap-2 w-full group cursor-pointer">
                                <span className="text-[9px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">{s.avg}%</span>
                                <div 
                                    className={`w-full rounded-t-lg transition-all duration-500 ${i===0 ? 'bg-indigo-500' : 'bg-indigo-300'}`}
                                    style={{ height: `${s.avg}%` }}
                                ></div>
                                <span className="text-[9px] font-black text-slate-400 uppercase truncate w-12 text-center">{s.name.split(' ')[0]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
         </div>

      </div>

      {/* --- GRADING MODAL --- */}
      {gradingLesson && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setGradingLesson(null)}></div>
          <div className="bg-white rounded-[2rem] w-full max-w-4xl h-[90vh] flex flex-col relative z-10 shadow-2xl overflow-hidden border border-white">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase italic">Gradebook</h3>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{gradingLesson.topic}</p>
                </div>
                <div className="flex items-center gap-4">
                    {savingStatus === 'saving' && <span className="text-xs font-bold text-orange-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Saving...</span>}
                    {savingStatus === 'saved' && <span className="text-xs font-bold text-emerald-500 flex items-center gap-1"><Save size={12}/> Saved</span>}
                    <button onClick={() => setGradingLesson(null)} className="p-2 bg-slate-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><X size={20}/></button>
                </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar p-0 bg-white">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="p-4 w-40 min-w-[150px] text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-200">Student Name</th>
                            {gradingLesson.tasks?.map((task, idx) => (
                                <th key={idx} className="p-3 text-center min-w-[100px] text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50/30 border-b border-indigo-100 border-l border-slate-50">{typeof task === 'object' ? task.text : task}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {students.length === 0 ? (
                            <tr><td colSpan={10} className="p-10 text-center text-slate-400 text-xs italic">O'quvchilar yo'q</td></tr>
                        ) : (
                            students.map((student) => {
                                const nameParts = student.name.split(' ');
                                return (
                                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-3 border-r border-slate-50 bg-white sticky left-0 z-10 group-hover:bg-slate-50/50">
                                            <div className="flex flex-col leading-tight">
                                                <span className="font-bold text-slate-700 text-sm">{nameParts[0]}</span>
                                                <span className="text-xs text-slate-400 font-medium">{nameParts.slice(1).join(' ')}</span>
                                            </div>
                                        </td>
                                        {gradingLesson.tasks?.map((task, idx) => {
                                            const taskName = typeof task === 'object' ? task.text : task;
                                            const gradeData = lessonGrades[`${student.id}_${taskName}`] || { score: '' };
                                            return (
                                                <td key={idx} className="p-2 border-l border-slate-50 text-center">
                                                    <input 
                                                        type="number" 
                                                        className="w-16 h-10 text-center bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                                                        placeholder="-"
                                                        value={gradeData.score || ''}
                                                        onChange={(e) => handleGradeChange(student.id, taskName, e.target.value)}
                                                        onBlur={(e) => saveGrade(student.id, student.name, taskName, e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingLesson && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingLesson(null)}></div>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 mb-4 uppercase text-center italic">Edit Lesson</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Topic</label>
                   <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={newTopic} onChange={e => setNewTopic(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tasks</label>
                  <div className="max-h-40 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                    {newTasks.map((task, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input type="text" className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-indigo-400" value={task.text} onChange={(e) => { const u = [...newTasks]; u[idx].text = e.target.value; setNewTasks(u); }} />
                        <button type="button" onClick={() => setNewTasks(newTasks.filter((_, i) => i !== idx))} className="text-red-400 p-1 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setNewTasks([...newTasks, { text: '', completed: false }])} className="w-full py-2 border border-dashed border-slate-300 rounded-xl text-slate-400 font-bold text-[10px] hover:border-indigo-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1"><Plus size={14}/> Add Task</button>
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100">{loading ? "Saving..." : "Save Changes"}</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Assignments;