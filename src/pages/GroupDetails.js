import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Star, X, Loader2, Edit2, Trash2, 
  UserPlus, Share2, Plus, ChevronDown, ChevronUp, Calendar,
  Trophy, Zap, Crown, List, Percent, Save, Check
} from 'lucide-react';
import { db, auth } from '../firebase';
import { 
  collection, query, where, getDocs, addDoc, 
  doc, getDoc, serverTimestamp, orderBy, updateDoc, deleteDoc
} from 'firebase/firestore';

const GroupDetails = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const highlightRef = useRef(null); 
  
  const [groupName, setGroupName] = useState('');
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]); 
  const [allGroups, setAllGroups] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [studentViewMode, setStudentViewMode] = useState('list'); 
  const [expandedMonths, setExpandedMonths] = useState({});
  const [modalExpandedMonths, setModalExpandedMonths] = useState({});
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false); 
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
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
  
  const [gradeScores, setGradeScores] = useState({}); 
  const [existingGradeDocs, setExistingGradeDocs] = useState({});
  const [existingGradeObjects, setExistingGradeObjects] = useState({});
  const [savedStatus, setSavedStatus] = useState({}); 
  const [loading, setLoading] = useState(false);

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
      
      const qGrades = query(collection(db, "grades"), where("groupId", "==", groupId));
      const snapGrades = await getDocs(qGrades);
      const allGrades = snapGrades.docs.map(d => d.data());
      
      const qS = query(collection(db, "students"), where("groupId", "==", groupId));
      const snapS = await getDocs(qS);
      const studentsList = snapS.docs.map(d => {
        const sData = d.data();
        const studentGrades = allGrades.filter(g => g.studentId === d.id);
        const totalScore = studentGrades.reduce((acc, curr) => acc + (curr.score || 0), 0);
        const averageScore = studentGrades.length > 0 ? Math.round(totalScore / studentGrades.length) : 0;
        return { id: d.id, ...sData, gameXp: sData.gameXp || 0, averageScore: averageScore };
      });
      studentsList.sort((a, b) => a.name.localeCompare(b.name)); 
      setStudents(studentsList);
      
      const qL = query(collection(db, "lessons"), where("groupId", "==", groupId), orderBy("date", "desc"));
      const snapL = await getDocs(qL);
      setLessons(snapL.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const qG = query(collection(db, "groups"));
      const snapG = await getDocs(qG);
      setAllGroups(snapG.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => g.id !== groupId));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchData(); }, [groupId]);

  useEffect(() => {
      if (location.state?.openStudentId && students.length > 0) {
          const target = students.find(s => s.id === location.state.openStudentId);
          if (target) {
              openGradeModal(target);
              setTimeout(() => {
                  if (highlightRef.current) {
                      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      highlightRef.current.focus();
                  }
              }, 500);
          }
      }
  }, [students, location.state]);

  const getDisplayedStudents = () => {
    let list = [...students];
    if (studentViewMode === 'leaderboard') return list.sort((a, b) => b.gameXp - a.gameXp);
    return list;
  };
  const displayedStudents = getDisplayedStudents();

  const getAvatarUrl = (seed) => {
    const safeSeed = seed || "default";
    const cleanSeed = safeSeed.replace('bot_', '');
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${cleanSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;
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
  const toggleMonth = (month) => setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));
  const toggleModalMonth = (month) => setModalExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));

  const handleDeleteGroup = async () => { if (currentUserRole !== 'admin') return alert("Huquqingiz yo'q!"); if (window.confirm(`"${groupName}" guruhini butunlay o'chirib yubormoqchimisiz?`)) { setLoading(true); await deleteDoc(doc(db, "groups", groupId)); navigate('/'); } };
  const handleBulkAddStudents = async () => { if (!bulkText.trim()) return; setLoading(true); const lines = bulkText.split('\n').filter(l => l.includes(',')); await Promise.all(lines.map(line => { const [name, email] = line.split(',').map(s => s.trim()); return addDoc(collection(db, "students"), { name, email, groupId, joinedAt: serverTimestamp(), gameXp: 0, role: 'student' }); })); setBulkText(''); setIsAddStudentOpen(false); fetchData(); setLoading(false); };
  const handleMoveStudent = async () => { if (!targetGroupId) return alert("Guruhni tanlang!"); setLoading(true); try { await updateDoc(doc(db, "students", selectedStudent.id), { groupId: targetGroupId }); setIsMoveModalOpen(false); fetchData(); alert("Ko'chirildi!"); } catch (e) { alert(e.message); } finally { setLoading(false); } };
  const handleDeleteStudent = async (id, name) => { if (window.confirm(`${name} o'chirilsinmi?`)) { await deleteDoc(doc(db, "students", id)); fetchData(); } };

  const openGradeModal = async (student) => {
    setLoading(true);
    setSelectedStudent(student); 
    setGradeScores({});
    setExistingGradeDocs({});
    setExistingGradeObjects({});
    setSavedStatus({});
    
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

    setIsGradeModalOpen(true);
    setLoading(false);
  };

  const handleSaveAllGrades = async (e) => {
    e.preventDefault();
    setLoading(true);
    const newSavedStatus = {};

    try {
      const entries = Object.entries(gradeScores);

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
      setTimeout(() => setSavedStatus({}), 2000);
      fetchData();

    } catch (er) {
        alert("Xatolik: " + er.message);
    } finally {
        setLoading(false);
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

  if (loading && !isAddStudentOpen && !isMoveModalOpen && !isGradeModalOpen) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28 md:pb-10">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/')} className="p-2 rounded-full bg-slate-50 hover:bg-slate-100 transition-colors shrink-0"><ArrowLeft size={20}/></button>
          <div className="flex flex-col min-w-0">
            {/* 🔥 Truncate qo'shildi guruh nomi sig'may qolmasligi uchun */}
            <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none uppercase italic truncate w-48 sm:w-auto">{groupName}</h1>
            <p className="text-[10px] font-bold text-indigo-600 tracking-widest uppercase">Classroom</p>
          </div>
        </div>
        {currentUserRole === 'admin' && (
            <button onClick={handleDeleteGroup} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"><Trash2 size={20}/></button>
        )}
      </header>

      <div className="pt-24 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* STUDENTS LIST */}
          <div className="lg:col-span-2 space-y-3">
             <div className="flex justify-between items-center px-1">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Students ({students.length})</h2>
                {currentUserRole === 'admin' && (
                    <button onClick={() => setIsAddStudentOpen(true)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"><UserPlus size={14}/> Add New</button>
                )}
             </div>
             
             <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                <div className="flex border-b border-slate-100">
                    <button onClick={() => setStudentViewMode('list')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${studentViewMode === 'list' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><List size={14} /> Ro'yxat</button>
                    <button onClick={() => setStudentViewMode('leaderboard')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${studentViewMode === 'leaderboard' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><Trophy size={14} /> Reyting</button>
                </div>

                <div className="divide-y divide-slate-50 font-bold text-slate-700">
                   {displayedStudents.map((s, index) => {
                     let rankStyle = "bg-slate-100 text-slate-500";
                     if (studentViewMode === 'leaderboard') {
                        if (index === 0) rankStyle = "bg-yellow-100 text-yellow-600 border border-yellow-200";
                        else if (index === 1) rankStyle = "bg-slate-200 text-slate-600 border border-slate-300";
                        else if (index === 2) rankStyle = "bg-orange-100 text-orange-600 border border-orange-200";
                     }
                     let scoreColor = "bg-slate-100 text-slate-400";
                     if (s.averageScore >= 80) scoreColor = "bg-emerald-100 text-emerald-600";
                     else if (s.averageScore >= 60) scoreColor = "bg-yellow-100 text-yellow-600";
                     else if (s.averageScore > 0) scoreColor = "bg-rose-100 text-rose-600";

                     return (
                     <div key={s.id} className={`group p-4 flex items-center justify-between gap-2 transition-colors ${studentViewMode === 'leaderboard' && index < 3 ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                           {studentViewMode === 'leaderboard' && (
                               <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${rankStyle}`}>{index + 1}</div>
                           )}
                           <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0 relative">
                              <img src={getAvatarUrl(s.avatarSeed || s.name)} alt="" className="w-full h-full object-cover"/>
                           </div>
                           <div className="flex flex-col min-w-0">
                               <span className="text-sm truncate flex items-center gap-1 font-bold">
                                   {s.name}
                                   {studentViewMode === 'leaderboard' && index === 0 && <Crown size={12} className="text-yellow-500 fill-yellow-500"/>}
                               </span>
                               <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                  <div className="flex items-center gap-1 text-[9px] text-indigo-500 font-black uppercase bg-indigo-50 px-1.5 py-0.5 rounded-md shrink-0"><Zap size={10} className="fill-indigo-500"/>{s.gameXp} XP</div>
                                  <div className={`flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 ${scoreColor}`}><Percent size={10} />{s.averageScore}%</div>
                               </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                           <button onClick={() => openGradeModal(s)} className="p-2.5 text-indigo-400 bg-indigo-50 rounded-xl hover:bg-indigo-600 hover:text-white transition-all active:scale-95"><Star size={18} fill="currentColor" className="opacity-80"/></button>
                           {currentUserRole === 'admin' && (<>
                             <button onClick={() => { setSelectedStudent(s); setIsMoveModalOpen(true); }} className="p-2.5 text-slate-300 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-all active:scale-95"><Share2 size={18}/></button>
                             <button onClick={() => handleDeleteStudent(s.id, s.name)} className="p-2.5 text-slate-300 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all active:scale-95"><Trash2 size={18}/></button>
                           </>)}
                        </div>
                     </div>
                   )})}
                   {students.length === 0 && <div className="p-8 text-center text-slate-400 text-xs italic">O'quvchilar yo'q.</div>}
                </div>
             </div>
          </div>

          {/* COURSE JOURNAL */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
               <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Course Journal</h2>
               <button onClick={() => setIsAddLessonOpen(true)} className="p-2 bg-indigo-600 text-white rounded-xl tap-active shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors"><Plus size={18}/></button>
            </div>
            <div className="space-y-3">
              {Object.keys(groupedLessons).length === 0 && <p className="text-center text-slate-400 text-xs py-4">Hozircha darslar yo'q</p>}
              {Object.keys(groupedLessons).map((month, index) => {
                const monthLessons = groupedLessons[month];
                const isExpanded = expandedMonths[month] || index === 0;
                return (
                  <div key={month} className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div onClick={() => toggleMonth(month)} className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-2"><Calendar size={18} className="text-indigo-500" /><span className="font-black text-slate-700 text-xs uppercase tracking-wide">{month}</span></div>
                      <div className="flex items-center gap-2"><span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{monthLessons.length}</span>{isExpanded ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}</div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/30 p-2 space-y-2">
                        {monthLessons.map((l) => (
                          <div key={l.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm relative group hover:border-indigo-200 transition-colors">
                            <div className="absolute top-2 right-2 flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity z-10">
                              <button onClick={() => { setEditingLesson(l); setLessonTopic(l.topic); setLessonDate(l.date); setLessonTasks(l.tasks || [{ text: 'Homework', completed: false }]); setIsAddLessonOpen(true); }} className="p-1.5 bg-slate-50 text-slate-400 border border-slate-100 rounded-lg hover:text-indigo-600 shadow-sm"><Edit2 size={14}/></button>
                              <button onClick={() => handleDeleteLesson(l.id)} className="p-1.5 bg-slate-50 text-slate-400 border border-slate-100 rounded-lg hover:text-red-500 shadow-sm"><Trash2 size={14}/></button>
                            </div>
                            <div className="flex items-start gap-3">
                               <div className="flex flex-col items-center justify-center bg-slate-100 rounded-lg p-1.5 min-w-[3rem]">
                                  <span className="text-[8px] font-black text-slate-500 uppercase">{l.date.split('-')[1]}</span>
                                  <span className="text-sm font-black text-slate-800 leading-none">{l.date.split('-')[2]}</span>
                               </div>
                               <div className="min-w-0">
                                  <h4 className="font-bold text-slate-700 text-xs uppercase leading-tight pr-10 truncate">{l.topic}</h4>
                                  <div className="flex flex-wrap gap-1 mt-1.5">{l.tasks?.map((t, i) => (<div key={i} className="flex items-center bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[8px] text-slate-500 uppercase font-bold max-w-full"><span className="truncate max-w-[150px]">{typeof t === 'object' ? t.text : t}</span></div>))}</div>
                               </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* --- YANGI GRADE MODAL --- */}
      {isGradeModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsGradeModalOpen(false)}></div>
          {/* 🔥 Modal Full Height on Mobile */}
          <div className="bg-white border border-white shadow-2xl rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-lg relative z-10 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom duration-300">
            {/* Modal Header */}
            <div className="p-4 bg-indigo-600 text-white flex items-center justify-between relative overflow-hidden shrink-0">
               <div className="flex items-center gap-3 relative z-10">
                  <div className="w-12 h-12 rounded-full border-2 border-white/20 overflow-hidden bg-white/10"><img src={getAvatarUrl(selectedStudent.avatarSeed || selectedStudent.name)} className="w-full h-full object-cover" alt="" /></div>
                  <div><h3 className="text-base font-black leading-tight uppercase italic">{selectedStudent.name}</h3><p className="text-indigo-200 text-[8px] font-bold uppercase tracking-[0.2em]">All Assignments</p></div>
               </div>
               <button onClick={() => setIsGradeModalOpen(false)} className="relative z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X size={18} className="text-white"/></button>
               <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar pb-24">
               <form onSubmit={handleSaveAllGrades} className="space-y-4">
                  
                  {Object.keys(groupedLessons).length === 0 && <p className="text-center text-slate-400 text-xs">Vazifalar yo'q.</p>}

                  {Object.keys(groupedLessons).map((month) => {
                      const monthLessons = groupedLessons[month];
                      const isOpen = modalExpandedMonths[month];

                      return (
                          <div key={month} className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                              {/* OY NOMİ */}
                              <div onClick={() => toggleModalMonth(month)} className={`p-3 flex justify-between items-center cursor-pointer transition-colors ${isOpen ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                                  <div className="flex items-center gap-2">
                                      <Calendar size={14} className="text-indigo-500" />
                                      <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider">{month}</span>
                                  </div>
                                  {isOpen ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
                              </div>

                              {/* DARSLAR RO'YXATI */}
                              {isOpen && (
                                  <div className="bg-slate-50/30 divide-y divide-slate-100">
                                      {monthLessons.map(lesson => (
                                          <div key={lesson.id} className="p-3">
                                              <div className="flex justify-between items-start mb-2">
                                                  <span className="text-[10px] font-black text-slate-700 uppercase leading-tight pr-2 truncate">{lesson.topic}</span>
                                                  <span className="text-[8px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100 whitespace-nowrap">{lesson.date}</span>
                                              </div>
                                              
                                              {/* Har bir task uchun input */}
                                              <div className="space-y-2">
                                                  {lesson.tasks?.map((task, idx) => {
                                                      const taskName = typeof task === 'object' ? task.text : task;
                                                      const key = `${lesson.id}_${taskName}`;
                                                      const score = gradeScores[key] || '';
                                                      const oldData = existingGradeObjects[key];
                                                      const isRetake = oldData && (oldData.status === 'retake_needed' || oldData.status === 'retake_submitted');
                                                      const isSaved = savedStatus[key];
                                                      const isHighlighted = location.state?.highlightKey === key;

                                                      return (
                                                          <div 
                                                            key={idx} 
                                                            className={`flex items-center justify-between p-2 rounded-xl border relative transition-all duration-500 
                                                              ${isHighlighted ? 'bg-yellow-50 border-yellow-300 shadow-md ring-2 ring-yellow-200' : isRetake ? 'bg-amber-50 border-amber-200' : score ? 'bg-white border-indigo-200' : 'bg-white border-slate-100'}
                                                            `}
                                                          >
                                                              <div className="flex flex-col min-w-0 pr-2">
                                                                  <span className="text-[10px] font-bold text-slate-600 truncate">{taskName}</span>
                                                                  {isRetake && <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter flex items-center gap-1">⚠️ Retake Required</span>}
                                                              </div>
                                                              <div className="relative shrink-0">
                                                                  <input 
                                                                      ref={isHighlighted ? highlightRef : null}
                                                                      type="number" 
                                                                      inputMode="numeric" 
                                                                      min="0" 
                                                                      max="100" 
                                                                      placeholder="-" 
                                                                      // 🔥 Touch target for input
                                                                      className={`w-14 h-10 text-center font-black text-sm rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${score ? 'text-indigo-600 bg-indigo-50' : 'bg-slate-100 text-slate-400'}`}
                                                                      value={score}
                                                                      onChange={(e) => handleScoreChange(lesson.id, taskName, e.target.value)}
                                                                      onClick={(e) => e.target.select()} // 🔥 Bosganda hammasini tanlash
                                                                  />
                                                                  {/* SAVED INDICATOR */}
                                                                  {isSaved && (
                                                                      <div className="absolute right-16 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[9px] font-black text-emerald-500 animate-in fade-in slide-in-from-right-2 duration-300 whitespace-nowrap">
                                                                          <Check size={12} strokeWidth={3} /> Saved
                                                                      </div>
                                                                  )}
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
                      );
                  })}
               </form>
            </div>

            {/* SAVE BUTTON */}
            {/* 🔥 pb-safe: iPhone pastki qismi uchun */}
            <div className="p-4 bg-white border-t border-slate-100 absolute bottom-0 left-0 right-0 z-20 pb-safe">
               <button onClick={handleSaveAllGrades} disabled={loading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 active:scale-95 transition-all uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={18}/> : <><Save size={18}/> Save All Changes</>}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddStudentOpen(false)}></div>
          <div className="bg-white w-full sm:w-auto sm:min-w-[500px] rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 pb-safe relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <h3 className="text-2xl font-black text-slate-800 mb-6 uppercase italic text-center">Add Students</h3>
            <div className="flex bg-slate-50 p-1 rounded-2xl mb-6 border border-slate-100">
               <button onClick={() => setAddMode('single')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${addMode === 'single' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Single</button>
               <button onClick={() => setAddMode('bulk')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${addMode === 'bulk' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Bulk Import</button>
            </div>
            {addMode === 'single' ? (
              <div className="space-y-4">
                <input type="text" placeholder="Full Name" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-600" value={newStudentName} onChange={e=>setNewStudentName(e.target.value)} />
                <input type="email" placeholder="Email Address" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-600" value={newStudentEmail} onChange={e=>setNewStudentEmail(e.target.value)} />
              </div>
            ) : (
              <textarea placeholder="Ali Valiyev, ali@gmail.com" className="w-full h-40 px-6 py-4 bg-slate-50 rounded-2xl font-bold text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-600" value={bulkText} onChange={e=>setBulkText(e.target.value)}></textarea>
            )}
            <button onClick={addMode === 'single' ? async (e) => { e.preventDefault(); await addDoc(collection(db, "students"), { name: newStudentName, email: newStudentEmail, groupId, joinedAt: serverTimestamp(), gameXp: 0, role: 'student' }); setIsAddStudentOpen(false); setNewStudentName(''); setNewStudentEmail(''); fetchData(); } : handleBulkAddStudents} className="w-full mt-6 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-100 tap-active mb-4">
              {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Complete Registration'}
            </button>
          </div>
        </div>
      )}

      {/* MOVE STUDENT MODAL */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMoveModalOpen(false)}></div>
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 w-full max-w-md relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe">
            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase italic tracking-tight">Move Student</h3>
            <div className="flex items-center gap-3 mb-6 bg-slate-50 p-3 rounded-2xl border border-slate-100">
               <div className="w-10 h-10 rounded-full bg-white border border-slate-200 overflow-hidden"><img src={getAvatarUrl(selectedStudent?.avatarSeed || selectedStudent?.name)} className="w-full h-full object-cover" alt="" /></div>
               <span className="font-bold text-slate-700">{selectedStudent?.name}</span>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Group</label>
              <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={targetGroupId} onChange={(e) => setTargetGroupId(e.target.value)}>
                <option value="">Guruhni tanlang...</option>
                {allGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button onClick={handleMoveStudent} disabled={loading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center mb-4">{loading ? <Loader2 className="animate-spin" /> : "Confirm Move"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD LESSON MODAL */}
      {isAddLessonOpen && (
         <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => {setIsAddLessonOpen(false); setEditingLesson(null);}}></div>
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe">
            <h3 className="text-xl font-black text-slate-800 mb-4 uppercase text-center italic">{editingLesson ? "Edit Lesson" : "New Lesson"}</h3>
              <form onSubmit={handleAddLesson} className="space-y-3">
                <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" value={lessonDate} onChange={e => setLessonDate(e.target.value)} />
                <input type="text" placeholder="Topic Name" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" value={lessonTopic} onChange={e => setLessonTopic(e.target.value)} />
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tasks</label>
                  {lessonTasks.map((task, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" required className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs" value={task.text} onChange={(e) => { const newTasks = [...lessonTasks]; newTasks[idx].text = e.target.value; setLessonTasks(newTasks); }} />
                      <button type="button" onClick={() => setLessonTasks(lessonTasks.filter((_, i) => i !== idx))} className="text-red-400 p-2"><Trash2 size={16} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setLessonTasks([...lessonTasks, { text: '', completed: false }])} className="w-full py-2 border border-dashed border-slate-200 rounded-lg text-slate-400 font-bold text-[10px] hover:border-indigo-400">+ Add Task</button>
                </div>
                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest mt-2 mb-4">Save</button>
              </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default GroupDetails;