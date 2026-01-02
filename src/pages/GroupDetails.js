import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Star, X, Loader2, Edit2, Trash2, 
  UserPlus, Share2, Plus, ChevronDown, ChevronUp, Calendar
} from 'lucide-react';
import { db, auth } from '../firebase';
import { 
  collection, query, where, getDocs, addDoc, 
  doc, getDoc, serverTimestamp, orderBy, updateDoc, deleteDoc
} from 'firebase/firestore';

const GroupDetails = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  
  const [groupName, setGroupName] = useState('');
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]); 
  const [allGroups, setAllGroups] = useState([]);
  
  // Accordion States
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedGradeMonths, setExpandedGradeMonths] = useState({});

  // MODALS STATE
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false); 
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  
  // FORM STATES
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
  const [selectedLesson, setSelectedLesson] = useState(null); 
  const [gradeScores, setGradeScores] = useState({}); 
  const [existingGradeDocs, setExistingGradeDocs] = useState({});
  const [studentGrades, setStudentGrades] = useState([]); 
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (groupDoc.exists()) setGroupName(groupDoc.data().name);
      else navigate('/');

      const qS = query(collection(db, "students"), where("groupId", "==", groupId));
      const snapS = await getDocs(qS);
      setStudents(snapS.docs.map(d => ({ id: d.id, ...d.data() })));

      const qL = query(collection(db, "lessons"), where("groupId", "==", groupId), orderBy("date", "desc"));
      const snapL = await getDocs(qL);
      setLessons(snapL.docs.map(d => ({ id: d.id, ...d.data() })));

      const user = auth.currentUser;
      if (user) {
        const qG = query(collection(db, "groups"), where("teacherId", "==", user.uid));
        const snapG = await getDocs(qG);
        setAllGroups(snapG.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => g.id !== groupId));
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchData(); }, [groupId]);

  // AVATAR URL GENERATOR
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

  // --- HELPER FUNCTIONS ---
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

  const groupGradesByMonth = () => {
    const groups = {};
    studentGrades.forEach(grade => {
      if (grade.rawDate) {
        const date = grade.rawDate.toDate(); 
        const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!groups[monthKey]) groups[monthKey] = [];
        groups[monthKey].push(grade);
      }
    });
    return groups;
  };
  const groupedGrades = groupGradesByMonth();
  const toggleGradeMonth = (month) => setExpandedGradeMonths(prev => ({ ...prev, [month]: !prev[month] }));

  // --- CRUD Functions ---
  const handleDeleteGroup = async () => {
    if (window.confirm(`"${groupName}" guruhini butunlay o'chirib yubormoqchimisiz?`)) {
      setLoading(true); await deleteDoc(doc(db, "groups", groupId)); navigate('/');
    }
  };
  const handleBulkAddStudents = async () => {
    if (!bulkText.trim()) return; setLoading(true);
    const lines = bulkText.split('\n').filter(l => l.includes(','));
    await Promise.all(lines.map(line => {
      const [name, email] = line.split(',').map(s => s.trim());
      return addDoc(collection(db, "students"), { name, email, groupId, joinedAt: serverTimestamp() });
    }));
    setBulkText(''); setIsAddStudentOpen(false); fetchData(); setLoading(false);
  };
  const handleMoveStudent = async () => {
    if (!targetGroupId) return alert("Guruhni tanlang!"); setLoading(true);
    try { await updateDoc(doc(db, "students", selectedStudent.id), { groupId: targetGroupId }); setIsMoveModalOpen(false); fetchData(); alert("Ko'chirildi!"); } 
    catch (e) { alert(e.message); } finally { setLoading(false); }
  };
  const handleDeleteStudent = async (id, name) => { if (window.confirm(`${name} o'chirilsinmi?`)) { await deleteDoc(doc(db, "students", id)); fetchData(); }};
  
  const openGradeModal = async (student) => {
    setSelectedStudent(student); setIsGradeModalOpen(true);
    const q = query(collection(db, "grades"), where("studentId", "==", student.id), orderBy("date", "desc"));
    const snap = await getDocs(q);
    
    const data = snap.docs.map(d => ({ 
        id: d.id,
        ...d.data(),
        rawDate: d.data().date,
        dateStr: d.data().date?.toDate().toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'})
    }));
    setStudentGrades(data);
  };

  const handleLessonSelect = async (lId) => {
    const l = lessons.find(lx => lx.id === lId); setSelectedLesson(l);
    const iS = {}; const dM = {};
    if (l) {
      l.tasks?.forEach(t => iS[typeof t === 'object' ? t.text : t] = '');
      const q = query(collection(db, "grades"), where("studentId", "==", selectedStudent.id), where("lessonId", "==", l.id));
      const qs = await getDocs(q); qs.forEach((d) => { iS[d.data().taskType] = d.data().score; dM[d.data().taskType] = d.id; });
    }
    setGradeScores(iS); setExistingGradeDocs(dM);
  };

  const handleSaveGrade = async (e) => {
    e.preventDefault(); if (!selectedLesson) return; setLoading(true);
    const fS = Object.entries(gradeScores).filter(([_, s]) => s !== '' && s !== null);
    try {
      for (const [tT, sc] of fS) {
        const eId = existingGradeDocs[tT];
        if (eId) { if (window.confirm(`"${tT}" bahosi o'zgartirilsinmi?`)) await updateDoc(doc(db, "grades", eId), { score: Number(sc), date: serverTimestamp() }); } 
        else { await addDoc(collection(db, "grades"), { studentId: selectedStudent.id, studentName: selectedStudent.name, groupId, score: Number(sc), comment: selectedLesson.topic, taskType: tT, lessonId: selectedLesson.id, date: serverTimestamp() }); }
      }
      setIsGradeModalOpen(false);
    } catch (er) { alert(er.message); } finally { setLoading(false); }
  };
  
  const handleDeleteLesson = async (id) => { if(window.confirm(`O'chirilsinmi?`)) { await deleteDoc(doc(db, "lessons", id)); fetchData(); }};
  const deleteTaskFromLesson = async (lId, tasks, idx) => { if(window.confirm('Vazifa o\'chirilsinmi?')) { const u = tasks.filter((_,i)=>i!==idx); await updateDoc(doc(db,"lessons",lId),{tasks:u}); fetchData(); }};
  const handleAddLesson = async (e) => { e.preventDefault(); const tasks = lessonTasks.filter(t=>t.text.trim()!==''); try { if(editingLesson) await updateDoc(doc(db,"lessons",editingLesson.id),{topic:lessonTopic,date:lessonDate,tasks}); else await addDoc(collection(db,"lessons"),{groupId,topic:lessonTopic,date:lessonDate,tasks,createdAt:serverTimestamp()}); setIsAddLessonOpen(false); setEditingLesson(null); setLessonTopic(''); setLessonDate(''); setLessonTasks([{text:'Homework',completed:false}]); fetchData(); } catch(e){alert(e.message);} };

  if (loading && !isAddStudentOpen && !isMoveModalOpen) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  return (
    // DIQQAT: pb-32 bu yerda footer uchun joy qoldiradi
    <div className="min-h-screen bg-[#F8FAFC] pb-32">
      
      {/* 1. FIXED HEADER (Doim tepada qotib turadi) */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-full bg-slate-50 hover:bg-slate-100 transition-colors"><ArrowLeft size={20}/></button>
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none uppercase italic">{groupName}</h1>
            <p className="text-[10px] font-bold text-indigo-600 tracking-widest uppercase">Teacher Panel</p>
          </div>
        </div>
        <button onClick={handleDeleteGroup} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={20}/></button>
      </header>

      <div className="pt-24 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 1. STUDENTS LIST */}
          <div className="lg:col-span-2 space-y-3">
             <div className="flex justify-between items-center px-1">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">All Students ({students.length})</h2>
                <button onClick={() => setIsAddStudentOpen(true)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"><UserPlus size={14}/> Add New</button>
             </div>
             
             <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                <div className="hidden sm:flex bg-slate-50 border-b border-slate-100 p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                   <div className="flex-1 px-2">Student</div>
                   <div className="w-40 text-center">Actions</div>
                </div>

                <div className="divide-y divide-slate-50 font-bold text-slate-700">
                   {students.map((s) => (
                     <div key={s.id} className="group p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                              <img src={getAvatarUrl(s.avatarSeed || s.name)} alt="" className="w-full h-full object-cover"/>
                           </div>
                           <span className="text-sm">{s.name}</span>
                        </div>
                        <div className="flex items-center justify-end gap-2 w-full sm:w-auto border-t border-dashed border-slate-100 sm:border-none pt-3 sm:pt-0 mt-1 sm:mt-0">
                           <button onClick={() => openGradeModal(s)} className="flex-1 sm:flex-none flex items-center justify-center space-x-1 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">
                              <Star size={14}/><span>Grade</span>
                           </button>
                           <button onClick={() => { setSelectedStudent(s); setIsMoveModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all">
                              <Share2 size={16}/>
                           </button>
                           <button onClick={() => handleDeleteStudent(s.id, s.name)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
                              <Trash2 size={16}/>
                           </button>
                        </div>
                     </div>
                   ))}
                   {students.length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-xs italic">O'quvchilar yo'q. Qo'shish tugmasini bosing.</div>
                   )}
                </div>
             </div>
          </div>

          {/* 2. COURSE PLAN (O'ZGARTIRILDI: Ichki scroll olib tashlandi) */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
               <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Course Journal</h2>
               <button onClick={() => setIsAddLessonOpen(true)} className="p-2 bg-indigo-600 text-white rounded-xl tap-active shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors"><Plus size={18}/></button>
            </div>
            
            {/* BU YERDA 'max-h' va 'overflow' olib tashlandi, endi sahifa bilan birga scroll bo'ladi */}
            <div className="space-y-3">
              {Object.keys(groupedLessons).length === 0 && <p className="text-center text-slate-400 text-xs py-4">Hozircha darslar yo'q</p>}
              
              {Object.keys(groupedLessons).map((month, index) => {
                const monthLessons = groupedLessons[month];
                const isExpanded = expandedMonths[month] || index === 0;

                return (
                  <div key={month} className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div onClick={() => toggleMonth(month)} className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-indigo-500" />
                        <span className="font-black text-slate-700 text-xs uppercase tracking-wide">{month}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{monthLessons.length}</span>
                        {isExpanded ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/30 p-2 space-y-2">
                        {monthLessons.map((l) => (
                          <div key={l.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm relative group hover:border-indigo-200 transition-colors">
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingLesson(l); setLessonTopic(l.topic); setLessonDate(l.date); setLessonTasks(l.tasks || [{ text: 'Homework', completed: false }]); setIsAddLessonOpen(true); }} className="p-1 bg-slate-50 text-slate-400 rounded hover:text-indigo-600"><Edit2 size={12}/></button>
                              <button onClick={() => handleDeleteLesson(l.id)} className="p-1 bg-slate-50 text-slate-400 rounded hover:text-red-500"><Trash2 size={12}/></button>
                            </div>
                            <div className="flex items-start gap-3">
                               <div className="flex flex-col items-center justify-center bg-slate-100 rounded-lg p-1.5 min-w-[3rem]">
                                  <span className="text-[8px] font-black text-slate-500 uppercase">{l.date.split('-')[1]}</span>
                                  <span className="text-sm font-black text-slate-800 leading-none">{l.date.split('-')[2]}</span>
                               </div>
                               <div>
                                  <h4 className="font-bold text-slate-700 text-xs uppercase leading-tight pr-6">{l.topic}</h4>
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {l.tasks?.map((t, i) => (
                                      <div key={i} className="flex items-center bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[8px] text-slate-500 uppercase font-bold">
                                        {typeof t === 'object' ? t.text : t}
                                        <button onClick={() => deleteTaskFromLesson(l.id, l.tasks, i)} className="ml-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={8} /></button>
                                      </div>
                                    ))}
                                  </div>
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

      {/* --- MODALS --- */}
      {/* ... Qolgan modallar o'zgarishsiz qoldi ... */}
      
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddStudentOpen(false)}></div>
          <div className="bg-white w-full sm:w-auto sm:min-w-[500px] rounded-t-[3rem] sm:rounded-[2.5rem] p-8 pb-12 relative z-10 shadow-2xl">
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
            <button onClick={addMode === 'single' ? async (e) => { e.preventDefault(); await addDoc(collection(db, "students"), { name: newStudentName, email: newStudentEmail, groupId, joinedAt: serverTimestamp() }); setIsAddStudentOpen(false); setNewStudentName(''); setNewStudentEmail(''); fetchData(); } : handleBulkAddStudents} className="w-full mt-6 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-100 tap-active">
              {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Complete Registration'}
            </button>
          </div>
        </div>
      )}

      {isMoveModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMoveModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md relative z-10 shadow-2xl">
            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase italic tracking-tight">Move Student</h3>
            <div className="flex items-center gap-3 mb-6 bg-slate-50 p-3 rounded-2xl border border-slate-100">
               <div className="w-10 h-10 rounded-full bg-white border border-slate-200 overflow-hidden">
                   <img src={getAvatarUrl(selectedStudent?.avatarSeed || selectedStudent?.name)} className="w-full h-full object-cover" alt="" />
               </div>
               <span className="font-bold text-slate-700">{selectedStudent?.name}</span>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Group</label>
              <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={targetGroupId} onChange={(e) => setTargetGroupId(e.target.value)}>
                <option value="">Guruhni tanlang...</option>
                {allGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button onClick={handleMoveStudent} disabled={loading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center">
                {loading ? <Loader2 className="animate-spin" /> : "Confirm Move"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isGradeModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-white/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setIsGradeModalOpen(false)}></div>
          <div className="bg-white/95 border border-white shadow-2xl rounded-[2.5rem] w-full max-w-lg relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-4 bg-indigo-600 text-white flex items-center justify-between relative overflow-hidden shrink-0">
               <div className="flex items-center gap-3 relative z-10">
                  <div className="w-12 h-12 rounded-full border-2 border-white/20 overflow-hidden bg-white/10">
                     <img src={getAvatarUrl(selectedStudent.avatarSeed || selectedStudent.name)} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div>
                     <h3 className="text-base font-black leading-tight uppercase italic">{selectedStudent.name}</h3>
                     <p className="text-indigo-200 text-[8px] font-bold uppercase tracking-[0.2em]">Student Profile</p>
                  </div>
               </div>
               <button onClick={() => setIsGradeModalOpen(false)} className="relative z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                  <X size={18} className="text-white"/>
               </button>
               <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-6">
              <section>
                <div className="flex items-center gap-2 mb-4">
                   <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                   <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest italic">Evaluation</h4>
                </div>
                <form onSubmit={handleSaveGrade} className="space-y-4">
                  <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Lesson Selection</label>
                      <div className="relative">
                        <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 appearance-none" value={selectedLesson?.id || ''} onChange={(e) => handleLessonSelect(e.target.value)}>
                            <option value="">-- Darsni tanlang --</option>
                            {lessons.map((l) => <option key={l.id} value={l.id}>{l.date} - {l.topic}</option>)}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronDown size={16} /></div>
                      </div>
                  </div>
                  {selectedLesson && (
                      <div className="grid grid-cols-1 gap-2 animate-in slide-in-from-top-2 duration-300">
                          {selectedLesson.tasks?.map((task, idx) => { 
                              const taskName = typeof task === 'object' ? task.text : task; 
                              const hasExistingGrade = existingGradeDocs[taskName] !== undefined; 
                              return (
                                  <div key={idx} className={`flex items-center justify-between p-3 border rounded-2xl transition-all ${hasExistingGrade ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                                      <span className={`font-bold text-[11px] ${hasExistingGrade ? 'text-indigo-700' : 'text-slate-600'}`}>{taskName}</span>
                                      <input type="number" min="0" max="100" placeholder="-" className={`w-16 text-center font-black text-indigo-600 py-1.5 rounded-xl outline-none text-xs border focus:ring-2 focus:ring-indigo-500 ${hasExistingGrade ? 'bg-white border-indigo-100' : 'bg-slate-50 border-slate-200'}`} value={gradeScores[taskName] || ''} onChange={(e) => setGradeScores({...gradeScores, [taskName]: e.target.value})} />
                                  </div>
                              ); 
                          })}
                      </div>
                  )}
                  <button type="submit" disabled={loading || !selectedLesson} className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 active:scale-95 transition-all uppercase text-[10px] tracking-widest disabled:opacity-50">{loading ? "Saqlanmoqda..." : "Baholarni Saqlash"}</button>
                </form>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-3">
                   <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                   <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest italic">Grade History</h4>
                </div>
                <div className="space-y-2">
                  {Object.keys(groupedGrades).length === 0 && <p className="text-slate-400 text-[10px] italic text-center py-4 bg-slate-50 rounded-2xl">Hozircha baholar yo'q.</p>}
                  {Object.keys(groupedGrades).map((month, index) => {
                     const mGrades = groupedGrades[month];
                     const isExp = expandedGradeMonths[month] || index === 0;
                     return (
                       <div key={month} className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                          <div onClick={() => toggleGradeMonth(month)} className="p-3 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors">
                             <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">{month}</span>
                             <div className="flex items-center gap-2">
                                <span className="bg-white px-2 py-0.5 rounded-lg text-[8px] font-bold text-slate-400 border border-slate-100">{mGrades.length}</span>
                                {isExp ? <ChevronUp size={12} className="text-slate-400"/> : <ChevronDown size={12} className="text-slate-400"/>}
                             </div>
                          </div>
                          {isExp && (
                             <div className="divide-y divide-slate-50 animate-in fade-in duration-300">
                                {mGrades.map((g) => (
                                  <div key={g.id} className="p-3 flex justify-between items-center hover:bg-slate-50/30 transition-colors">
                                     <div className="max-w-[70%]">
                                        <p className="text-[10px] font-black text-slate-700 uppercase leading-tight mb-1 truncate">{g.comment}</p>
                                        <div className="flex gap-2">
                                           <span className="text-[8px] text-slate-400 font-bold">{g.dateStr}</span>
                                           <span className="text-[8px] text-indigo-400 font-black uppercase tracking-tighter bg-indigo-50 px-1 rounded">{g.taskType}</span>
                                        </div>
                                     </div>
                                     <div className={`text-sm font-black ${g.score >= 80 ? 'text-emerald-500' : g.score <= 40 ? 'text-red-500' : 'text-indigo-600'}`}>{g.score}</div>
                                  </div>
                                ))}
                             </div>
                          )}
                       </div>
                     );
                  })}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {isAddLessonOpen && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => {setIsAddLessonOpen(false); setEditingLesson(null);}}></div>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl">
            <h3 className="text-xl font-black text-slate-800 mb-4 uppercase text-center italic">{editingLesson ? "Edit Lesson" : "New Lesson"}</h3>
              <form onSubmit={handleAddLesson} className="space-y-3">
                <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" value={lessonDate} onChange={e => setLessonDate(e.target.value)} />
                <input type="text" placeholder="Topic Name" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" value={lessonTopic} onChange={e => setLessonTopic(e.target.value)} />
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tasks</label>
                  {lessonTasks.map((task, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" required className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs" value={task.text} onChange={(e) => { const newTasks = [...lessonTasks]; newTasks[idx].text = e.target.value; setLessonTasks(newTasks); }} />
                      <button type="button" onClick={() => setLessonTasks(lessonTasks.filter((_, i) => i !== idx))} className="text-red-400"><Trash2 size={16} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setLessonTasks([...lessonTasks, { text: '', completed: false }])} className="w-full py-2 border border-dashed border-slate-200 rounded-lg text-slate-400 font-bold text-[10px] hover:border-indigo-400">+ Add Task</button>
                </div>
                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest mt-2">Save</button>
              </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default GroupDetails;