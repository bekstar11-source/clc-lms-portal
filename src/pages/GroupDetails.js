import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, X, Loader2, Edit2, Trash2, 
  UserPlus, Share2, Plus, ChevronDown, ChevronUp, Calendar,
  Trophy, Zap, Crown, List, Percent, Save, Check, Users, BookOpen
} from 'lucide-react';
import { db, auth } from '../firebase';
import { 
  collection, query, where, getDocs, addDoc, 
  doc, getDoc, serverTimestamp, orderBy, updateDoc, deleteDoc
} from 'firebase/firestore';

// --- HELPER: HAPTICS ---
const triggerHaptic = (type = 'tap') => {
  if (navigator.vibrate) {
    if(type === 'tap') navigator.vibrate(10);
    if(type === 'success') navigator.vibrate([10, 50, 10]);
    if(type === 'error') navigator.vibrate([50, 100, 50]);
  }
};

// --- HELPER: AVATAR ---
const getAvatarUrl = (seed) => {
    const safeSeed = seed || "default";
    const cleanSeed = safeSeed.replace('bot_', '');
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${cleanSeed}&backgroundColor=e0e7ff,d1fae5,ffedd5`;
};

const GroupDetails = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const highlightRef = useRef(null); 
  
  // Data State
  const [groupName, setGroupName] = useState('');
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]); 
  const [allGroups, setAllGroups] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'journal'
  const [studentViewMode, setStudentViewMode] = useState('list'); 
  const [expandedMonths, setExpandedMonths] = useState({});
  const [modalExpandedMonths, setModalExpandedMonths] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false); 
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  
  // Forms & Temp State
  const [addMode, setAddMode] = useState('single'); 
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [targetGroupId, setTargetGroupId] = useState('');
  const [lessonTopic, setLessonTopic] = useState('');
  const [lessonDate, setLessonDate] = useState('');
  const [lessonTasks, setLessonTasks] = useState([{ text: 'Homework', completed: false }]); 
  const [editingLesson, setEditingLesson] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // Grading State
  const [gradeScores, setGradeScores] = useState({}); 
  const [existingGradeDocs, setExistingGradeDocs] = useState({});
  const [existingGradeObjects, setExistingGradeObjects] = useState({});
  const [savedStatus, setSavedStatus] = useState({}); 

  // --- FETCHING ---
  const fetchData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "students", currentUser.uid));
        if (userDoc.exists()) setCurrentUserRole(userDoc.data().role);
      }
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (groupDoc.exists()) setGroupName(groupDoc.data().name);
      else navigate('/');
      
      // Parallel Fetch for Performance
      const qGrades = query(collection(db, "grades"), where("groupId", "==", groupId));
      const qStudents = query(collection(db, "students"), where("groupId", "==", groupId));
      const qLessons = query(collection(db, "lessons"), where("groupId", "==", groupId), orderBy("date", "desc"));
      const qGroups = query(collection(db, "groups"));

      const [snapGrades, snapStudents, snapLessons, snapGroups] = await Promise.all([
          getDocs(qGrades), getDocs(qStudents), getDocs(qLessons), getDocs(qGroups)
      ]);

      const allGrades = snapGrades.docs.map(d => d.data());
      
      const studentsList = snapStudents.docs.map(d => {
        const sData = d.data();
        const studentGrades = allGrades.filter(g => g.studentId === d.id);
        const totalScore = studentGrades.reduce((acc, curr) => acc + (curr.score || 0), 0);
        const averageScore = studentGrades.length > 0 ? Math.round(totalScore / studentGrades.length) : 0;
        return { id: d.id, ...sData, gameXp: sData.gameXp || 0, averageScore: averageScore };
      });
      studentsList.sort((a, b) => a.name.localeCompare(b.name)); 
      setStudents(studentsList);
      
      setLessons(snapLessons.docs.map(d => ({ id: d.id, ...d.data() })));
      setAllGroups(snapGroups.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => g.id !== groupId));
      setLoading(false);
    } catch (e) { console.error(e); setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [groupId]);

  // Deep Linking to Grade Modal
  useEffect(() => {
      if (location.state?.openStudentId && students.length > 0) {
          const target = students.find(s => s.id === location.state.openStudentId);
          if (target) {
              openGradeModal(target);
              // Scroll logic inside modal
              setTimeout(() => {
                  if (highlightRef.current) {
                      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      highlightRef.current.focus();
                  }
              }, 800);
          }
      }
  }, [students, location.state]);

  // --- HELPERS ---
  const getDisplayedStudents = () => {
    let list = [...students];
    if (studentViewMode === 'leaderboard') return list.sort((a, b) => b.gameXp - a.gameXp);
    return list;
  };

  const groupLessonsByMonth = (lessonList) => {
    const groups = {};
    lessonList.forEach(lesson => {
      const date = new Date(lesson.date);
      const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(lesson);
    });
    return groups;
  };
  
  const groupedLessons = groupLessonsByMonth(lessons);
  const toggleModalMonth = (month) => {
      triggerHaptic();
      setModalExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));
  };

  // --- ACTIONS ---
  const handleDeleteGroup = async () => { if (currentUserRole !== 'admin') return alert("Huquqingiz yo'q!"); if (window.confirm(`"${groupName}" guruhini butunlay o'chirib yubormoqchimisiz?`)) { setLoading(true); await deleteDoc(doc(db, "groups", groupId)); navigate('/'); } };
  
  const handleBulkAddStudents = async () => { 
      if (!bulkText.trim()) return; 
      setLoading(true); 
      const lines = bulkText.split('\n').filter(l => l.includes(',')); 
      await Promise.all(lines.map(line => { 
          const [name, email] = line.split(',').map(s => s.trim()); 
          return addDoc(collection(db, "students"), { name, email, groupId, joinedAt: serverTimestamp(), gameXp: 0, role: 'student' }); 
      })); 
      setBulkText(''); setIsAddStudentOpen(false); fetchData(); 
  };

  const handleMoveStudent = async () => { if (!targetGroupId) return alert("Guruhni tanlang!"); setLoading(true); try { await updateDoc(doc(db, "students", selectedStudent.id), { groupId: targetGroupId }); setIsMoveModalOpen(false); fetchData(); alert("Ko'chirildi!"); } catch (e) { alert(e.message); } finally { setLoading(false); } };
  const handleDeleteStudent = async (id, name) => { if (window.confirm(`${name} o'chirilsinmi?`)) { await deleteDoc(doc(db, "students", id)); fetchData(); } };

  const openGradeModal = async (student) => {
    triggerHaptic();
    setSelectedStudent(student); 
    setGradeScores({});
    setExistingGradeDocs({});
    setExistingGradeObjects({});
    setSavedStatus({});
    
    // Optimistic open
    setIsGradeModalOpen(true);

    const q = query(collection(db, "grades"), where("studentId", "==", student.id));
    const snap = await getDocs(q);
    
    const scores = {};
    const docs = {};
    const objs = {};

    snap.forEach(doc => {
        const data = doc.data();
        const key = `${data.lessonId}_${data.taskType}`;
        scores[key] = data.score;
        docs[key] = doc.id;
        objs[key] = data;
    });

    setGradeScores(scores);
    setExistingGradeDocs(docs);
    setExistingGradeObjects(objs);
    
    const allMonths = {};
    Object.keys(groupedLessons).forEach(m => allMonths[m] = true);
    setModalExpandedMonths(allMonths);
  };

  const handleSaveAllGrades = async (e) => {
    e.preventDefault();
    triggerHaptic('tap');
    const newSavedStatus = {};

    try {
      const entries = Object.entries(gradeScores);
      // Batch writes are better, but keeping loop for simplicity with current structure
      for (const [key, scoreVal] of entries) {
         if (scoreVal === '' || scoreVal === null) continue;

         const [lessonId, ...taskParts] = key.split('_');
         const taskType = taskParts.join('_'); 
         const scoreNum = Number(scoreVal);
         const lesson = lessons.find(l => l.id === lessonId);
         const topic = lesson ? lesson.topic : 'Vazifa';
         const eId = existingGradeDocs[key];
         const oldData = existingGradeObjects[key];

         if (oldData && oldData.score === scoreNum) continue;

         let gradeData = {
            score: scoreNum,
            date: serverTimestamp(),
            status: 'active',
            retakeDeadline: null
         };

         if (scoreNum < 60) {
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + 7);
            gradeData.status = 'retake_needed';
            gradeData.retakeDeadline = deadline;
            if (!eId) gradeData.previousScore = null;
         }

         if (eId && oldData && (oldData.status === 'retake_submitted' || oldData.status === 'retake_needed')) {
             gradeData.previousScore = oldData.score;
         }

         if (eId) {
             await updateDoc(doc(db, "grades", eId), gradeData);
         } else {
             const newDoc = await addDoc(collection(db, "grades"), {
                 studentId: selectedStudent.id,
                 studentName: selectedStudent.name,
                 groupId,
                 lessonId,
                 taskType,
                 comment: topic,
                 ...gradeData
             });
             existingGradeDocs[key] = newDoc.id;
         }
         
         newSavedStatus[key] = true;
         existingGradeObjects[key] = { ...oldData, ...gradeData, score: scoreNum };
      }
      
      setSavedStatus(newSavedStatus);
      triggerHaptic('success');
      setTimeout(() => setSavedStatus({}), 2000);
      fetchData(); // Refresh bg data

    } catch (er) {
        alert("Xatolik: " + er.message);
    }
  };

  const handleScoreChange = (lessonId, taskName, value) => {
      const key = `${lessonId}_${taskName}`;
      setGradeScores(prev => ({ ...prev, [key]: value }));
      if (savedStatus[key]) {
          const newStatus = { ...savedStatus };
          delete newStatus[key];
          setSavedStatus(newStatus);
      }
  };
  
  const handleDeleteLesson = async (id) => { if(window.confirm(`O'chirilsinmi?`)) { await deleteDoc(doc(db, "lessons", id)); fetchData(); }};
  const handleAddLesson = async (e) => { e.preventDefault(); const tasks = lessonTasks.filter(t=>t.text.trim()!==''); try { if(editingLesson) await updateDoc(doc(db,"lessons",editingLesson.id),{topic:lessonTopic,date:lessonDate,tasks}); else await addDoc(collection(db,"lessons"),{groupId,topic:lessonTopic,date:lessonDate,tasks,createdAt:serverTimestamp()}); setIsAddLessonOpen(false); setEditingLesson(null); setLessonTopic(''); setLessonDate(''); setLessonTasks([{text:'Homework',completed:false}]); fetchData(); } catch(e){alert(e.message);} };

  if (loading && !isAddStudentOpen && !isMoveModalOpen && !isGradeModalOpen && !isAddLessonOpen) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  const displayedStudents = getDisplayedStudents();

  return (
    <div className="min-h-screen bg-slate-50 font-sans touch-manipulation pb-20">
      
      {/* --- HEADER --- */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 shadow-sm">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => navigate('/')} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors shrink-0 active:scale-95"><ArrowLeft size={20}/></button>
                <div className="min-w-0">
                    <h1 className="text-lg font-black text-slate-800 tracking-tight uppercase italic truncate w-48 sm:w-auto">{groupName}</h1>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">Classroom</span>
                        <span className="text-[10px] font-bold text-slate-400">{students.length} students</span>
                    </div>
                </div>
            </div>
            {currentUserRole === 'admin' && (
                <button onClick={handleDeleteGroup} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"><Trash2 size={20}/></button>
            )}
        </div>

        {/* --- TABS --- */}
        <div className="flex p-1 bg-slate-100 rounded-xl mt-4">
            <button onClick={() => { triggerHaptic(); setActiveTab('students'); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'students' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                <Users size={14}/> Students
            </button>
            <button onClick={() => { triggerHaptic(); setActiveTab('journal'); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'journal' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                <BookOpen size={14}/> Journal
            </button>
        </div>
      </header>

      <div className="pt-[140px] px-4 sm:px-6 max-w-4xl mx-auto space-y-6">
        
        {/* --- TAB: STUDENTS --- */}
        {activeTab === 'students' && (
            <div className="animate-in slide-in-from-left-4 duration-300">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex bg-white rounded-lg p-0.5 border border-slate-100 shadow-sm">
                        <button onClick={() => setStudentViewMode('list')} className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${studentViewMode === 'list' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400'}`}><List size={16}/></button>
                        <button onClick={() => setStudentViewMode('leaderboard')} className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${studentViewMode === 'leaderboard' ? 'bg-yellow-100 text-yellow-600' : 'text-slate-400'}`}><Trophy size={16}/></button>
                    </div>
                    {currentUserRole === 'admin' && (
                        <button onClick={() => setIsAddStudentOpen(true)} className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all"><UserPlus size={14}/> Add</button>
                    )}
                </div>

                <div className="space-y-3 pb-24">
                   {displayedStudents.map((s, index) => {
                     // Styling logic
                     let rankStyle = "bg-slate-100 text-slate-500";
                     if (studentViewMode === 'leaderboard') {
                        if (index === 0) rankStyle = "bg-yellow-400 text-white shadow-lg shadow-yellow-200";
                        else if (index === 1) rankStyle = "bg-slate-300 text-white";
                        else if (index === 2) rankStyle = "bg-orange-400 text-white";
                     }
                     let scoreColor = "text-slate-400";
                     if (s.averageScore >= 80) scoreColor = "text-emerald-500";
                     else if (s.averageScore < 60 && s.averageScore > 0) scoreColor = "text-rose-500";

                     return (
                     <div key={s.id} onClick={() => openGradeModal(s)} className={`group bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3 active:scale-[0.98] transition-transform cursor-pointer relative overflow-hidden`}>
                        {studentViewMode === 'leaderboard' && index < 3 && <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/0 to-white/0 ${index === 0 ? 'via-yellow-50/50' : ''} pointer-events-none`}></div>}
                        
                        <div className="flex items-center gap-4 overflow-hidden min-w-0 flex-1">
                           {studentViewMode === 'leaderboard' && (
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-sm ${rankStyle}`}>{index + 1}</div>
                           )}
                           <div className="relative">
                               <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden border border-slate-100">
                                  <img src={getAvatarUrl(s.avatarSeed || s.name)} alt="" className="w-full h-full object-cover"/>
                               </div>
                               {studentViewMode === 'leaderboard' && index === 0 && <Crown size={14} className="absolute -top-2 -right-2 text-yellow-500 fill-yellow-500 animate-bounce"/>}
                           </div>
                           
                           <div className="flex flex-col min-w-0">
                               <span className="text-sm font-bold text-slate-800 truncate">{s.name}</span>
                               <div className="flex items-center gap-3 mt-1">
                                  <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-black uppercase"><Zap size={10} className="fill-indigo-500"/>{s.gameXp} XP</div>
                                  <div className={`flex items-center gap-1 text-[10px] font-black uppercase ${scoreColor}`}><Percent size={10} />{s.averageScore}% Avg</div>
                               </div>
                           </div>
                        </div>

                        {currentUserRole === 'admin' && (
                           <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                             <button onClick={() => { setSelectedStudent(s); setIsMoveModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-600 active:scale-90 transition-transform"><Share2 size={18}/></button>
                             <button onClick={() => handleDeleteStudent(s.id, s.name)} className="p-2 text-slate-300 hover:text-red-500 active:scale-90 transition-transform"><Trash2 size={18}/></button>
                           </div>
                        )}
                     </div>
                   )})}
                   {students.length === 0 && <div className="p-10 text-center text-slate-400 text-xs italic">O'quvchilar ro'yxati bo'sh.</div>}
                </div>
            </div>
        )}

        {/* --- TAB: JOURNAL --- */}
        {activeTab === 'journal' && (
            <div className="animate-in slide-in-from-right-4 duration-300 pb-24">
                <div className="flex justify-between items-center mb-4 px-1">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Timeline</h2>
                    <button onClick={() => { triggerHaptic(); setIsAddLessonOpen(true); }} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all"><Plus size={14}/> New Lesson</button>
                </div>

                <div className="space-y-6 relative">
                    {/* Vertical Line */}
                    <div className="absolute left-4 top-4 bottom-0 w-0.5 bg-slate-200"></div>

                    {Object.keys(groupedLessons).map((month) => (
                        <div key={month} className="relative z-10">
                            <div className="sticky top-[130px] z-20 mb-4 ml-10">
                                <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-200 shadow-sm">{month}</span>
                            </div>
                            <div className="space-y-4 pl-10">
                                {groupedLessons[month].map((l) => (
                                    <div key={l.id} className="relative group bg-white p-4 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.99] transition-transform">
                                        {/* Timeline Dot */}
                                        <div className="absolute -left-[30px] top-6 w-4 h-4 rounded-full bg-white border-4 border-indigo-500 shadow-sm"></div>
                                        
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black text-indigo-500 uppercase">{l.date}</span>
                                                </div>
                                                <h3 className="text-sm font-bold text-slate-800 leading-tight mb-2">{l.topic}</h3>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {l.tasks?.map((t, i) => (
                                                        <span key={i} className="bg-slate-50 text-slate-500 border border-slate-100 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight">{typeof t === 'object' ? t.text : t}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); setEditingLesson(l); setLessonTopic(l.topic); setLessonDate(l.date); setLessonTasks(l.tasks || [{ text: 'Homework', completed: false }]); setIsAddLessonOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg"><Edit2 size={14}/></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteLesson(l.id); }} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {lessons.length === 0 && <div className="ml-10 p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 italic border border-dashed border-slate-200">Hozircha darslar yo'q.</div>}
                </div>
            </div>
        )}
      </div>

      {/* --- MODAL: GRADING (FIXED BUTTON) --- */}
      {isGradeModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsGradeModalOpen(false)}></div>
          <div className="bg-white w-full max-w-lg h-[90vh] sm:h-[80vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] relative z-10 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden">
            
            {/* 1. Header (Fixed) */}
            <div className="p-5 bg-slate-900 text-white shrink-0 flex items-center justify-between relative overflow-hidden">
                <div className="flex items-center gap-3 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 overflow-hidden"><img src={getAvatarUrl(selectedStudent.avatarSeed || selectedStudent.name)} className="w-full h-full object-cover" alt=""/></div>
                    <div>
                        <h3 className="text-lg font-black leading-none">{selectedStudent.name}</h3>
                        <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mt-1">Grading Portal</p>
                    </div>
                </div>
                <button onClick={() => setIsGradeModalOpen(false)} className="relative z-10 p-2 bg-white/10 rounded-full hover:bg-white/20"><X size={20}/></button>
            </div>

            {/* 2. Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50">
               <form onSubmit={handleSaveAllGrades} className="space-y-4">
                  {Object.keys(groupedLessons).map((month) => (
                      <div key={month} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          <div onClick={() => toggleModalMonth(month)} className="p-3 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center cursor-pointer">
                              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2"><Calendar size={12}/> {month}</span>
                              {modalExpandedMonths[month] ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
                          </div>
                          
                          {modalExpandedMonths[month] && (
                              <div className="p-2 space-y-2">
                                  {groupedLessons[month].map(lesson => (
                                      <div key={lesson.id} className="p-2">
                                          <div className="flex items-center gap-2 mb-2 pl-1">
                                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{lesson.date}</span>
                                              <span className="text-xs font-bold text-slate-700 uppercase truncate">{lesson.topic}</span>
                                          </div>
                                          <div className="grid grid-cols-1 gap-2">
                                              {lesson.tasks?.map((task, idx) => {
                                                  const taskName = typeof task === 'object' ? task.text : task;
                                                  const key = `${lesson.id}_${taskName}`;
                                                  const score = gradeScores[key] || '';
                                                  const isSaved = savedStatus[key];
                                                  const isHighlighted = location.state?.highlightKey === key;
                                                  
                                                  let borderColor = "border-slate-200 focus-within:border-indigo-500";
                                                  if (score && score < 60) borderColor = "border-rose-300 bg-rose-50/30";
                                                  else if (score >= 60) borderColor = "border-emerald-300 bg-emerald-50/30";
                                                  if (isHighlighted) borderColor = "border-yellow-400 ring-2 ring-yellow-200 bg-yellow-50";

                                                  return (
                                                      <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${borderColor}`}>
                                                          <span className="text-[11px] font-bold text-slate-600 truncate mr-2">{taskName}</span>
                                                          <div className="relative">
                                                              <input 
                                                                ref={isHighlighted ? highlightRef : null}
                                                                type="number" inputMode="numeric" min="0" max="100" placeholder="-"
                                                                className="w-16 h-10 text-center text-lg font-black bg-white rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                                                value={score}
                                                                onChange={(e) => handleScoreChange(lesson.id, taskName, e.target.value)}
                                                                onClick={(e) => e.target.select()}
                                                              />
                                                              {isSaved && <div className="absolute -right-6 top-3 text-emerald-500"><Check size={16} strokeWidth={3}/></div>}
                                                          </div>
                                                      </div>
                                                  )
                                              })}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  ))}
               </form>
            </div>

            {/* 3. Sticky Footer (Button) */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
               <button onClick={handleSaveAllGrades} disabled={loading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 active:scale-95 transition-all uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={18}/> : <><Save size={18}/> Save Changes</>}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD STUDENT --- */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddStudentOpen(false)}></div>
          <div className="bg-white w-full sm:w-auto sm:min-w-[400px] rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase text-center italic">New Student</h3>
            
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
               <button onClick={() => setAddMode('single')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${addMode === 'single' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Single</button>
               <button onClick={() => setAddMode('bulk')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${addMode === 'bulk' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Bulk</button>
            </div>

            {addMode === 'single' ? (
              <div className="space-y-4">
                <input type="text" placeholder="Full Name" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" value={newStudentName} onChange={e=>setNewStudentName(e.target.value)} />
                <input type="email" placeholder="Email (Optional)" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" value={newStudentEmail} onChange={e=>setNewStudentEmail(e.target.value)} />
              </div>
            ) : (
              <textarea placeholder="Ali Valiyev, ali@gmail.com" className="w-full h-32 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none" value={bulkText} onChange={e=>setBulkText(e.target.value)}></textarea>
            )}

            <button onClick={addMode === 'single' ? async (e) => { e.preventDefault(); await addDoc(collection(db, "students"), { name: newStudentName, email: newStudentEmail, groupId, joinedAt: serverTimestamp(), gameXp: 0, role: 'student' }); setIsAddStudentOpen(false); setNewStudentName(''); setNewStudentEmail(''); fetchData(); } : handleBulkAddStudents} className="w-full mt-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg active:scale-95 transition-transform">
              {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Add Student'}
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD LESSON --- */}
      {isAddLessonOpen && (
         <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => {setIsAddLessonOpen(false); setEditingLesson(null);}}></div>
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-300 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase text-center italic">{editingLesson ? "Edit Lesson" : "New Lesson"}</h3>
              <form onSubmit={handleAddLesson} className="space-y-4">
                <input type="date" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500" value={lessonDate} onChange={e => setLessonDate(e.target.value)} />
                <input type="text" placeholder="Topic Name" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500" value={lessonTopic} onChange={e => setLessonTopic(e.target.value)} />
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tasks / Homework</label>
                      <button type="button" onClick={() => setLessonTasks([...lessonTasks, { text: '', completed: false }])} className="text-[10px] font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded-lg">+ Add</button>
                  </div>
                  {lessonTasks.map((task, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" required className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500" value={task.text} onChange={(e) => { const newTasks = [...lessonTasks]; newTasks[idx].text = e.target.value; setLessonTasks(newTasks); }} />
                      <button type="button" onClick={() => setLessonTasks(lessonTasks.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 bg-red-50 p-3 rounded-xl"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
                <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-200 active:scale-95 transition-all mt-2">Save Lesson</button>
              </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default GroupDetails;