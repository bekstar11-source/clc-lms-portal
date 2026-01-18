import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, query, where, getDocs, doc, updateDoc, 
  serverTimestamp, orderBy, addDoc, getDoc, writeBatch
} from 'firebase/firestore';
import { 
  X, Trash2, Edit2, Plus, Star,
  Calendar as CalendarIcon, Users, Loader2, Save, Trophy, BarChart3,
  Target, BookOpen, Sparkles, Zap, RefreshCw, Search, CheckCircle2
} from 'lucide-react';

// --- HELPER: UUID FOR TASKS ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const Assignments = () => {
  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  
  // Cache Data
  const [cacheData, setCacheData] = useState({}); 
  const [groups, setGroups] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Current Group Data
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [allGrades, setAllGrades] = useState([]); 

  // Modals & UI State
  const [editingLesson, setEditingLesson] = useState(null);
  const [newTopic, setNewTopic] = useState('');
  const [newTasks, setNewTasks] = useState([]); 
  
  const [gradingLesson, setGradingLesson] = useState(null);
  const [lessonGrades, setLessonGrades] = useState({});
  const [savingStatus, setSavingStatus] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');

  // 1. DATA LOADING (WITH CACHE STRATEGY & NORMALIZATION)
  useEffect(() => {
    const loadAllData = async (forceRefresh = false) => {
      setPageLoading(true);
      const user = auth.currentUser;
      if (!user) return;

      // A) CHECK CACHE
      if (!forceRefresh) {
        const cached = localStorage.getItem('assignmentsCache');
        const cachedTime = localStorage.getItem('assignmentsTime');
        
        if (cached && cachedTime && (new Date().getTime() - parseInt(cachedTime) < 5 * 60 * 1000)) {
           const parsedData = JSON.parse(cached);
           setGroups(parsedData.groups);
           setCacheData(parsedData.details);
           setLastUpdated(new Date(parseInt(cachedTime)).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
           
           if (parsedData.groups.length > 0 && !selectedGroupId) {
             setSelectedGroupId(parsedData.groups[0].id);
           }
           setPageLoading(false);
           setLoading(false);
           return;
        }
      }

      // B) FETCH FROM FIREBASE
      try {
        const userRef = doc(db, "students", user.uid);
        const userSnap = await getDoc(userRef);
        const role = userSnap.exists() ? userSnap.data().role : 'student';

        let fetchedGroups = [];

        if (role === 'admin') {
            const qGroups = query(collection(db, "groups"));
            const groupSnap = await getDocs(qGroups);
            fetchedGroups = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
            // 🔥 ASSISTANT FIX: 2 ta Query (Teacher va Assistant)
            const qMain = query(collection(db, "groups"), where("teacherId", "==", user.uid));
            const qAssist = query(collection(db, "groups"), where("assistantTeacherId", "==", user.uid));
            
            const [mainSnap, assistSnap] = await Promise.all([
                getDocs(qMain), getDocs(qAssist)
            ]);

            const mainGroups = mainSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const assistGroups = assistSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Birlashtirish va dublikatlarni tozalash
            const allRawGroups = [...mainGroups, ...assistGroups];
            fetchedGroups = allRawGroups.filter((group, index, self) =>
                index === self.findIndex((t) => t.id === group.id)
            );
        }

        const detailsMap = {};
        
        const promises = fetchedGroups.map(async (grp) => {
             const [studSnap, lessonSnap, gradeSnap] = await Promise.all([
                 getDocs(query(collection(db, "students"), where("groupId", "==", grp.id))),
                 getDocs(query(collection(db, "lessons"), where("groupId", "==", grp.id), orderBy("date", "desc"))),
                 getDocs(query(collection(db, "grades"), where("groupId", "==", grp.id)))
             ]);

             // DATA NORMALIZATION
             const normalizedLessons = lessonSnap.docs.map(d => {
                 const data = d.data();
                 const tasks = (data.tasks || []).map(t => {
                     if (typeof t === 'string') return { id: generateId(), text: t, completed: false };
                     if (!t.id) return { ...t, id: generateId() };
                     return t;
                 });
                 return { id: d.id, ...data, tasks };
             });

             detailsMap[grp.id] = {
                 students: studSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)),
                 lessons: normalizedLessons,
                 grades: gradeSnap.docs.map(d => ({ ...d.data(), id: d.id, score: Number(d.data().score) || 0 }))
             };
        });

        await Promise.all(promises);

        setGroups(fetchedGroups);
        setCacheData(detailsMap);
        
        if (fetchedGroups.length > 0 && !selectedGroupId) {
            setSelectedGroupId(fetchedGroups[0].id);
        }

        const now = new Date();
        localStorage.setItem('assignmentsCache', JSON.stringify({ groups: fetchedGroups, details: detailsMap }));
        localStorage.setItem('assignmentsTime', now.getTime().toString());
        setLastUpdated(now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));

      } catch (e) {
        console.error("Load Error:", e);
      } finally {
        setPageLoading(false);
        setLoading(false);
      }
    };

    loadAllData();
  }, []);

  // 2. SWITCH GROUP
  useEffect(() => {
    if (selectedGroupId && cacheData[selectedGroupId]) {
        const data = cacheData[selectedGroupId];
        setStudents(data.students);
        setLessons(data.lessons);
        setAllGrades(data.grades);
    }
  }, [selectedGroupId, cacheData]);

  // --- STATISTICS ---
  const topStudents = useMemo(() => {
    if (students.length === 0 || allGrades.length === 0) return [];
    const stats = students.map(student => {
        const studentGrades = allGrades.filter(g => g.studentId === student.id);
        if (studentGrades.length === 0) return { ...student, avg: 0 };
        const total = studentGrades.reduce((sum, g) => sum + (g.score > 100 ? 100 : Number(g.score)), 0);
        return { ...student, avg: Math.round(total / studentGrades.length) };
    });
    return stats.sort((a, b) => b.avg - a.avg).slice(0, 3);
  }, [students, allGrades]);

  const getLessonProgress = (lessonId) => {
    if (students.length === 0) return 0;
    const gradedStudentIds = new Set(
        allGrades.filter(g => g.lessonId === lessonId).map(g => g.studentId)
    );
    return Math.round((gradedStudentIds.size / students.length) * 100);
  };

  const getGroupStyle = (index) => {
    const styles = [
      { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-500', active: 'bg-blue-600 border-blue-600 shadow-blue-200', icon: Users },
      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-500', active: 'bg-emerald-600 border-emerald-600 shadow-emerald-200', icon: Target },
      { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-500', active: 'bg-amber-500 border-amber-500 shadow-amber-200', icon: Star },
      { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-500', active: 'bg-rose-500 border-rose-500 shadow-rose-200', icon: Sparkles },
      { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-500', active: 'bg-violet-600 border-violet-600 shadow-violet-200', icon: BookOpen },
    ];
    return styles[index % styles.length];
  };

  const refreshData = () => {
    localStorage.removeItem('assignmentsCache');
    window.location.reload();
  };

  // --- LOCAL CACHE UPDATE ---
  const updateCacheLocally = (type, item) => {
      const currentGroupData = cacheData[selectedGroupId];
      if (!currentGroupData) return;

      let newData = { ...currentGroupData };

      if (type === 'grade_update') {
          newData.grades = newData.grades.map(g => (g.studentId === item.studentId && g.taskType === item.taskType && g.lessonId === item.lessonId) ? { ...g, score: item.score } : g);
      } else if (type === 'grade_add') {
          newData.grades = [...newData.grades, item];
      } else if (type === 'lesson_update') {
          newData.lessons = newData.lessons.map(l => l.id === item.id ? item : l);
      }

      const newCache = { ...cacheData, [selectedGroupId]: newData };
      setCacheData(newCache);
      if(type.includes('grade')) setAllGrades(newData.grades);
      if(type.includes('lesson')) setLessons(newData.lessons);
      
      localStorage.setItem('assignmentsCache', JSON.stringify({ groups, details: newCache }));
  };

  // --- MODAL ACTIONS ---
  const openGradingModal = async (lesson) => {
    setGradingLesson(lesson);
    setStudentSearch('');
    setLessonGrades({});
    
    // Load existing grades
    const gradesForLesson = allGrades.filter(g => g.lessonId === lesson.id);
    const loadedGrades = {};
    gradesForLesson.forEach(g => {
        // Use text key for now (backward compatibility)
        loadedGrades[`${g.studentId}_${g.taskType}`] = { score: g.score, docId: g.id };
    });
    setLessonGrades(loadedGrades);
  };

  const handleGradeChange = (studentId, taskName, value) => {
    const key = `${studentId}_${taskName}`;
    if (value === '') { setLessonGrades(prev => ({ ...prev, [key]: { ...prev[key], score: '' } })); return; }
    let numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;
    if (numValue > 100) numValue = 100;
    if (numValue < 0) numValue = 0;
    setLessonGrades(prev => ({ ...prev, [key]: { ...prev[key], score: numValue } }));
  };

  const saveGrade = async (studentId, studentName, taskName, value) => {
    const key = `${studentId}_${taskName}`;
    const currentEntry = lessonGrades[key];
    if ((value === '' || value === undefined) && !currentEntry?.docId) return;

    setSavingStatus('saving');
    const safeScore = value === '' ? 0 : Number(value);

    try {
        if (currentEntry?.docId) {
            await updateDoc(doc(db, "grades", currentEntry.docId), { score: safeScore, date: serverTimestamp() });
            updateCacheLocally('grade_update', { studentId, taskType: taskName, lessonId: gradingLesson.id, score: safeScore });
        } else {
            const newDoc = await addDoc(collection(db, "grades"), {
                studentId, studentName, groupId: selectedGroupId, 
                lessonId: gradingLesson.id, taskType: taskName, 
                comment: gradingLesson.topic, score: safeScore, date: serverTimestamp()
            });
            setLessonGrades(prev => ({ ...prev, [key]: { score: safeScore, docId: newDoc.id } }));
            updateCacheLocally('grade_add', { id: newDoc.id, studentId, taskType: taskName, lessonId: gradingLesson.id, score: safeScore, groupId: selectedGroupId });
        }
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus(null), 1000);
    } catch (e) { console.error("Save error:", e); setSavingStatus('error'); }
  };

  const openEditModal = (lesson) => {
    setEditingLesson(lesson);
    setNewTopic(lesson.topic);
    // Ensure tasks have IDs
    const tasksWithIds = (lesson.tasks || []).map(t => 
        t.id ? t : { ...t, id: generateId() }
    );
    if (tasksWithIds.length === 0) tasksWithIds.push({ id: generateId(), text: 'Homework', completed: false });
    setNewTasks(tasksWithIds);
  };

  // --- BATCH UPDATE ---
  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      const lessonRef = doc(db, "lessons", editingLesson.id);
      batch.update(lessonRef, { 
          topic: newTopic, 
          tasks: newTasks, 
          updatedAt: serverTimestamp() 
      });

      for (const newTask of newTasks) {
          const oldTask = editingLesson.tasks.find(t => t.id === newTask.id);
          if (oldTask && oldTask.text !== newTask.text) {
              const qGrades = query(
                  collection(db, "grades"), 
                  where("lessonId", "==", editingLesson.id),
                  where("taskType", "==", oldTask.text)
              );
              const gradesSnap = await getDocs(qGrades);
              
              gradesSnap.docs.forEach(gDoc => {
                  batch.update(doc(db, "grades", gDoc.id), { 
                      taskType: newTask.text,
                      comment: newTopic
                  });
              });
          }
      }

      await batch.commit();

      const updatedLesson = { ...editingLesson, topic: newTopic, tasks: newTasks };
      updateCacheLocally('lesson_update', updatedLesson);
      refreshData(); 
      
      setEditingLesson(null);
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  const deleteTaskFromLesson = async (lessonId, currentTasks, taskIndex) => {
    if(!window.confirm("Vazifani o'chirmoqchimisiz?")) return;
    const updatedTasks = currentTasks.filter((_, i) => i !== taskIndex);
    const targetLesson = lessons.find(l => l.id === lessonId);
    await updateDoc(doc(db, "lessons", lessonId), { tasks: updatedTasks });
    updateCacheLocally('lesson_update', { ...targetLesson, tasks: updatedTasks });
  };

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()));

  if (pageLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-indigo-600"/></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 font-sans touch-manipulation">
      
      {/* 1. HEADER */}
      <div className="bg-white pt-6 pb-4 shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="px-4 mb-4 flex justify-between items-end">
          <div>
              <h1 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Assignments</h1>
              <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                 {lastUpdated ? `Updated: ${lastUpdated}` : 'Syncing...'} 
              </p>
          </div>
          <div className="flex gap-2">
              <button onClick={refreshData} className="p-2 bg-slate-50 text-indigo-600 rounded-lg hover:bg-indigo-50 border border-slate-200 active:scale-95 transition-transform"><RefreshCw size={18}/></button>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center">
                Count: {lessons.length}
              </div>
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
                     <span className="text-[9px] font-black opacity-80 uppercase tracking-widest mb-1">Class</span>
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
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1 lg:hidden">All Tasks</h3>
           )}

           {lessons.length === 0 ? (
             <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
                <CalendarIcon className="mx-auto text-slate-300 mb-3" size={40}/>
                <p className="text-xs font-bold text-slate-400">Hozircha vazifalar yo'q</p>
             </div>
           ) : (
             lessons.map(l => {
               const progress = getLessonProgress(l.id);
               return (
               <div key={l.id} className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm relative group hover:border-indigo-200 transition-all animate-in fade-in">
                  <div className="absolute top-3 right-3 flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={() => openGradingModal(l)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-200 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform">
                      <Star size={12}/> Grade
                    </button>
                    <button onClick={() => openEditModal(l)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-slate-100">
                      <Edit2 size={14}/>
                    </button>
                  </div>

                  <div className="flex items-start gap-4">
                     <div className="flex flex-col items-center justify-center bg-indigo-50 rounded-2xl p-2 min-w-[4rem] h-16 border border-indigo-100 shrink-0">
                        <span className="text-[9px] font-black text-indigo-400 uppercase">{l.date.split('-')[1]}</span>
                        <span className="text-2xl font-black text-indigo-600 leading-none">{l.date.split('-')[2]}</span>
                     </div>
                     
                     <div className="flex-1 min-w-0 pt-1">
                        <h4 className="font-bold text-slate-800 text-sm uppercase leading-tight pr-24 truncate">{l.topic}</h4>
                        
                        <div className="mt-2.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-1000 ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }}></div>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400">{progress}% Graded</span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {l.tasks?.map((t, i) => (
                            <div key={i} className="flex items-center bg-slate-50 border border-slate-200 px-2 py-1 rounded-md text-[9px] text-slate-600 uppercase font-black tracking-wide max-w-full">
                              <span className="truncate">{typeof t === 'object' ? t.text : t}</span>
                            </div>
                          ))}
                        </div>
                     </div>
                  </div>
               </div>
             )})
           )}
         </div>

         {/* 3. ANALYTICS (Desktop Only) */}
         <div className="hidden lg:block space-y-6">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm sticky top-32">
                <div className="flex items-center gap-2 mb-4">
                    <Trophy size={18} className="text-amber-500" />
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Leaderboard</h3>
                </div>
                <div className="space-y-3">
                    {topStudents.length === 0 ? <p className="text-xs text-slate-400 italic">No data yet</p> : 
                    topStudents.map((s, i) => (
                        <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm ${i===0 ? 'bg-amber-400' : i===1 ? 'bg-slate-400' : 'bg-orange-400'}`}>{i+1}</div>
                                <span className="text-xs font-bold text-slate-700">{s.name}</span>
                            </div>
                            <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{s.avg}%</span>
                        </div>
                    ))}
                </div>
            </div>
         </div>
      </div>

      {/* --- GRADING MODAL --- */}
      {gradingLesson && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setGradingLesson(null)}></div>
          <div className="bg-white w-full max-w-5xl h-[90dvh] sm:h-[90vh] flex flex-col relative z-10 shadow-2xl overflow-hidden border border-white sm:rounded-[2rem] rounded-t-[2rem] mt-auto sm:mt-0 animate-in slide-in-from-bottom duration-300">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-4 shrink-0">
                <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase italic">Gradebook</h3>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{gradingLesson.topic}</p>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                        <input 
                            type="text" 
                            placeholder="Search student..." 
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                        />
                    </div>
                    <button onClick={() => setGradingLesson(null)} className="p-2 bg-white border border-slate-200 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><X size={18}/></button>
                </div>
            </div>

            {/* Status Bar */}
            <div className="px-6 py-1 bg-white border-b border-slate-50 flex justify-end shrink-0">
                {savingStatus === 'saving' && <span className="text-[10px] font-black text-orange-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Autosaving...</span>}
                {savingStatus === 'saved' && <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10}/> Saved</span>}
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-0 bg-white">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="p-4 w-48 min-w-[150px] text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-200">Student Name</th>
                            {gradingLesson.tasks?.map((task, idx) => (
                                <th key={idx} className="p-3 text-center min-w-[100px] text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50/30 border-b border-indigo-100 border-l border-slate-100">{typeof task === 'object' ? task.text : task}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                        {filteredStudents.length === 0 ? (
                            <tr><td colSpan={10} className="p-12 text-center text-slate-400 text-xs italic">O'quvchilar topilmadi</td></tr>
                        ) : (
                            filteredStudents.map((student) => {
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
                                                        className={`w-14 h-10 text-center bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm
                                                            ${gradeData.score !== '' && gradeData.score < 60 ? 'bg-red-50 text-red-600 border-red-100' : ''}
                                                            ${gradeData.score !== '' && gradeData.score >= 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : ''}
                                                        `}
                                                        placeholder="-"
                                                        value={gradeData.score !== undefined ? gradeData.score : ''}
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

      {/* --- EDIT MODAL --- */}
      {editingLesson && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingLesson(null)}></div>
          
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-sm h-[80dvh] sm:h-auto relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-200 border border-white flex flex-col mt-auto sm:mt-0 overflow-hidden">
            
            {/* Header */}
            <div className="p-6 shrink-0 border-b border-slate-50">
               <h3 className="text-xl font-black text-slate-800 uppercase text-center italic">Edit Lesson</h3>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                <div>
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Topic</label>
                   <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={newTopic} onChange={e => setNewTopic(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tasks</label>
                  <div className="space-y-2">
                    {newTasks.map((task, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input type="text" className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-indigo-400" value={task.text} onChange={(e) => { const u = [...newTasks]; u[idx].text = e.target.value; setNewTasks(u); }} />
                        <button type="button" onClick={() => setNewTasks(newTasks.filter((_, i) => i !== idx))} className="text-red-400 p-1 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setNewTasks([...newTasks, { id: generateId(), text: '', completed: false }])} className="w-full py-2 border border-dashed border-slate-300 rounded-xl text-slate-400 font-bold text-[10px] hover:border-indigo-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1"><Plus size={14}/> Add Task</button>
                </div>
            </div>

            {/* Fixed Footer */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                <button onClick={handleUpdate} disabled={loading} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-transform">
                    {loading ? "Saving..." : "Save Changes"}
                </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Assignments;