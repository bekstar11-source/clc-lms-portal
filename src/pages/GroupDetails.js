import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Star, X, Loader2, Edit2, Trash2, 
  UserPlus, FileText, Users, CheckCircle2, Share2 // Share2 ikonkasi ko'chirish uchun
} from 'lucide-react';
import { db, auth } from '../firebase'; // auth import qilindi
import { 
  collection, query, where, getDocs, addDoc, 
  doc, getDoc, serverTimestamp, orderBy, updateDoc, deleteDoc
} from 'firebase/firestore';

import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';

const GroupDetails = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  
  const [groupName, setGroupName] = useState('');
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]); 
  const [allGroups, setAllGroups] = useState([]); // Boshqa guruhlar ro'yxati uchun
  
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false); 
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false); // Ko'chirish modali
  
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [targetGroupId, setTargetGroupId] = useState(''); // Qaysi guruhga o'tkazish

  const [addMode, setAddMode] = useState('single'); 
  const [bulkText, setBulkText] = useState('');
  
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
      if (groupDoc.exists()) {
        setGroupName(groupDoc.data().name);
      } else {
        navigate('/');
      }

      const qS = query(collection(db, "students"), where("groupId", "==", groupId));
      const snapS = await getDocs(qS);
      setStudents(snapS.docs.map(d => ({ id: d.id, ...d.data() })));

      const qL = query(collection(db, "lessons"), where("groupId", "==", groupId), orderBy("date", "desc"));
      const snapL = await getDocs(qL);
      setLessons(snapL.docs.map(d => ({ id: d.id, ...d.data() })));
      
      // Boshqa guruhlarni yuklash (O'quvchini ko'chirish uchun)
      const user = auth.currentUser;
      const qG = query(collection(db, "groups"), where("teacherId", "==", user.uid));
      const snapG = await getDocs(qG);
      setAllGroups(snapG.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => g.id !== groupId));

    } catch (e) { console.error("Fetch error:", e); }
  };

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const handleDeleteGroup = async () => {
    const confirmDelete = window.confirm(
      `DIQQAT! \n\n"${groupName}" guruhini butunlay o'chirib yubormoqchimisiz?\n\nBu amalni ortga qaytarib bo'lmaydi!`
    );
    if (confirmDelete) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, "groups", groupId));
        navigate('/');
      } catch (error) {
        alert("Xatolik yuz berdi: " + error.message);
        setLoading(false);
      }
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    if (window.confirm(`${studentName}ni o'chirishni xohlaysizmi?`)) {
      try {
        await deleteDoc(doc(db, "students", studentId));
        fetchData();
      } catch (error) { alert(error.message); }
    }
  };

  // --- YANGI: O'QUVCHINI KO'CHIRISH FUNKSIYASI ---
  const handleMoveStudent = async () => {
    if (!targetGroupId) return alert("Iltimos, guruhni tanlang!");
    setLoading(true);
    try {
      const studentRef = doc(db, "students", selectedStudent.id);
      await updateDoc(studentRef, { groupId: targetGroupId });
      
      setIsMoveModalOpen(false);
      setSelectedStudent(null);
      setTargetGroupId('');
      fetchData();
      alert("O'quvchi muvaffaqiyatli ko'chirildi!");
    } catch (error) {
      alert("Xatolik: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  // -----------------------------------------------

  const handleDeleteLesson = async (lessonId, topicName) => {
    if (window.confirm(`"${topicName}" mavzusini o'chirib yubormoqchimisiz?`)) {
      try {
        await deleteDoc(doc(db, "lessons", lessonId));
        fetchData(); 
      } catch (error) { alert("Xatolik: " + error.message); }
    }
  };

  const deleteTaskFromLesson = async (lessonId, allTasks, indexToDelete) => {
    if(!window.confirm("Vazifani o'chirmoqchimisiz?")) return;
    try {
      const updatedTasks = allTasks.filter((_, i) => i !== indexToDelete);
      await updateDoc(doc(db, "lessons", lessonId), { tasks: updatedTasks });
      fetchData();
    } catch (error) { alert("Xatolik: " + error.message); }
  };

  const handleAddLesson = async (e) => {
    e.preventDefault();
    const tasks = lessonTasks.filter(t => t.text.trim() !== '');
    try {
      if (editingLesson) {
        await updateDoc(doc(db, "lessons", editingLesson.id), { topic: lessonTopic, date: lessonDate, tasks: tasks });
      } else {
        await addDoc(collection(db, "lessons"), { groupId, topic: lessonTopic, date: lessonDate, tasks: tasks, createdAt: serverTimestamp() });
      }
      setIsAddLessonOpen(false); setEditingLesson(null); setLessonTopic(''); setLessonDate(''); setLessonTasks([{ text: 'Homework', completed: false }]);
      fetchData();
    } catch (error) { alert(error.message); }
  };

  const handleBulkAddStudents = async () => {
    if (!bulkText.trim()) return alert("Iltimos, ro'yxatni kiriting!");
    setLoading(true);
    try {
      const lines = bulkText.split('\n').filter(line => line.trim() !== '');
      const promises = lines.map(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const email = parts[1].trim();
          if (name && email.includes('@')) {
             return addDoc(collection(db, "students"), {
               name: name, email: email, groupId, joinedAt: serverTimestamp()
             });
          }
        }
        return null;
      });
      await Promise.all(promises);
      setBulkText(''); setIsAddStudentOpen(false); fetchData();
      alert(`${lines.length} ta o'quvchi muvaffaqiyatli qo'shildi!`);
    } catch (error) { alert("Xatolik: " + error.message); } finally { setLoading(false); }
  };

  const openGradeModal = async (student) => {
    setSelectedStudent(student); setSelectedLesson(null); setGradeScores({}); setExistingGradeDocs({}); setIsGradeModalOpen(true); setStudentGrades([]);
    try {
      const q = query(collection(db, "grades"), where("studentId", "==", student.id), orderBy("date", "asc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ score: d.data().score, date: d.data().date ? d.data().date.toDate().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : "" }));
      setStudentGrades(data);
    } catch (error) { console.error(error); }
  };

  const handleLessonSelect = async (lessonId) => {
    const lesson = lessons.find(l => l.id === lessonId);
    setSelectedLesson(lesson);
    const initialScores = {}; const docsMap = {};
    if (lesson) {
      lesson.tasks?.forEach(t => initialScores[typeof t === 'object' ? t.text : t] = '');
      try {
        const q = query(collection(db, "grades"), where("studentId", "==", selectedStudent.id), where("lessonId", "==", lesson.id));
        const qs = await getDocs(q);
        qs.forEach((doc) => { initialScores[doc.data().taskType] = doc.data().score; docsMap[doc.data().taskType] = doc.id; });
      } catch (err) { console.error(err); }
    }
    setGradeScores(initialScores); setExistingGradeDocs(docsMap);
  };

  const handleSaveGrade = async (e) => {
    e.preventDefault(); if (!selectedLesson) return;
    const filteredScores = Object.entries(gradeScores).filter(([_, score]) => score !== '' && score !== null);
    setLoading(true);
    try {
      for (const [taskType, score] of filteredScores) {
        const existingDocId = existingGradeDocs[taskType];
        if (existingDocId) {
          if (window.confirm(`"${taskType}" bahosini o'zgartirasizmi?`)) await updateDoc(doc(db, "grades", existingDocId), { score: Number(score), date: serverTimestamp() });
        } else {
          await addDoc(collection(db, "grades"), { studentId: selectedStudent.id, studentName: selectedStudent.name, groupId, score: Number(score), comment: selectedLesson.topic, taskType: taskType, lessonId: selectedLesson.id, date: serverTimestamp() });
        }
      }
      setIsGradeModalOpen(false);
    } catch (error) { alert("Xatolik: " + error.message); } finally { setLoading(false); }
  };

  if (loading && !isMoveModalOpen) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 font-sans pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-xl border border-slate-200 hover:bg-slate-50"><ArrowLeft size={20}/></button>
            <h1 className="text-xl sm:text-3xl font-black text-slate-800 uppercase italic truncate max-w-[200px] sm:max-w-none">CLC: {groupName}</h1>
            
            <button onClick={handleDeleteGroup} className="p-2 bg-red-50 text-red-500 rounded-xl border border-red-100 hover:bg-red-500 hover:text-white transition-all ml-2" title="Guruhni o'chirish"><Trash2 size={20} /></button>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
             <button onClick={() => { setEditingLesson(null); setLessonTasks([{ text: 'Homework', completed: false }]); setIsAddLessonOpen(true); }} className="flex-1 sm:flex-none bg-white text-slate-700 border border-slate-200 px-4 py-3 rounded-xl font-black text-[10px] uppercase italic tracking-widest hover:bg-slate-50 text-center">+ Lesson</button>
             <button onClick={() => setIsAddStudentOpen(true)} className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase italic tracking-widest shadow-lg shadow-indigo-100 text-center flex items-center justify-center gap-2"><UserPlus size={16} /> + Student</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Students List */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-lg font-black text-slate-800 flex items-center px-2 uppercase tracking-tighter">Students ({students.length})</h2>
            <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[500px]">
                  <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4 text-center">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                    {students.map((s) => (
                      <tr key={s.id} className="group hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-sm">{s.name}</td>
                        <td className="px-6 py-4 flex justify-center space-x-2">
                          <button onClick={() => openGradeModal(s)} className="flex items-center space-x-1 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"><Star size={14}/><span>Grade</span></button>
                          
                          {/* KO'CHIRISH TUGMASI */}
                          <button onClick={() => { setSelectedStudent(s); setIsMoveModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-600 rounded-lg" title="Guruhni almashtirish"><Share2 size={16}/></button>
                          
                          <button onClick={() => handleDeleteStudent(s.id, s.name)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Course Plan */}
          <div className="space-y-3">
            <h2 className="text-lg font-black text-slate-800 flex items-center px-2 uppercase tracking-tighter">Course Plan</h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {lessons.map((l, idx) => (
                <div key={idx} className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm border-l-4 border-l-amber-500 relative group">
                  <div className="absolute top-3 right-3 flex gap-1">
                    <button onClick={() => { setEditingLesson(l); setLessonTopic(l.topic); setLessonDate(l.date); setLessonTasks(l.tasks || [{ text: 'Homework', completed: false }]); setIsAddLessonOpen(true); }} className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:text-indigo-600"><Edit2 size={14}/></button>
                    <button onClick={() => handleDeleteLesson(l.id, l.topic)} className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                  <div className="text-[9px] font-black text-amber-600 uppercase mb-1 bg-amber-50 w-fit px-2 py-0.5 rounded-lg">{l.date}</div>
                  <h4 className="font-black text-slate-800 text-sm mb-2 uppercase w-[80%] leading-tight">{l.topic}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {l.tasks?.map((t, i) => (
                       <div key={i} className="flex items-center bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                        <span className="text-[8px] text-slate-600 font-bold uppercase tracking-tighter mr-1">{typeof t === 'object' ? t.text : t}</span>
                        <button onClick={() => deleteTaskFromLesson(l.id, l.tasks, i)} className="text-slate-300 hover:text-red-500"><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MOVE STUDENT MODAL */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMoveModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md relative z-10 shadow-2xl">
            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase italic tracking-tight">Move Student</h3>
            <p className="text-slate-400 text-sm font-bold mb-6">O'quvchi: <span className="text-indigo-600">{selectedStudent?.name}</span></p>
            
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Group</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                value={targetGroupId}
                onChange={(e) => setTargetGroupId(e.target.value)}
              >
                <option value="">Guruhni tanlang...</option>
                {allGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              
              <button 
                onClick={handleMoveStudent}
                disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center"
              >
                {loading ? <Loader2 className="animate-spin" /> : "O'tkazishni tasdiqlash"}
              </button>
              
              <button onClick={() => setIsMoveModalOpen(false)} className="w-full py-2 text-slate-400 font-black text-[10px] uppercase tracking-widest">Bekor qilish</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddStudentOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg relative z-10 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-800 mb-6 uppercase text-center italic tracking-tight">Add New Student</h3>
            <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-6 border border-slate-100">
               <button onClick={() => setAddMode('single')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${addMode === 'single' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><UserPlus size={16} /> Bittalab</button>
               <button onClick={() => setAddMode('bulk')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${addMode === 'bulk' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><Users size={16} /> Ko'pplab</button>
            </div>
            {addMode === 'single' ? (
              <form onSubmit={async (e) => { e.preventDefault(); await addDoc(collection(db, "students"), { name: newStudentName, email: newStudentEmail, groupId, joinedAt: serverTimestamp() }); setIsAddStudentOpen(false); setNewStudentName(''); setNewStudentEmail(''); fetchData(); }} className="space-y-4">
                <input type="text" placeholder="Full Name" required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} />
                <input type="email" placeholder="Email Address" required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm" value={newStudentEmail} onChange={e => setNewStudentEmail(e.target.value)} />
                <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest italic hover:bg-indigo-700">Add to Group</button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100"><p className="text-[10px] font-bold text-indigo-600 mb-1 flex items-center"><FileText size={12} className="mr-1"/> Format:</p><code className="text-xs text-slate-600 font-mono block bg-white p-2 rounded-lg border border-indigo-100">Ali Valiyev, ali@mail.ru <br/>Guli Karimova, guli@gmail.com</code></div>
                <textarea className="w-full h-40 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ism Familiya, email..." value={bulkText} onChange={(e) => setBulkText(e.target.value)}></textarea>
                <button onClick={handleBulkAddStudents} disabled={loading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest italic hover:bg-indigo-700 flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={16} /> Import All Students</>}</button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {isGradeModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsGradeModalOpen(false)}></div>
          <div className="bg-white rounded-[2rem] w-full max-w-5xl relative z-10 overflow-hidden flex flex-col lg:flex-row max-h-[90vh] shadow-2xl">
            <div className="lg:w-1/2 bg-slate-50 p-6 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-100 overflow-y-auto max-h-[40vh] lg:max-h-none">
              <div className="mb-4"><span className="text-[9px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded-md">Analytics</span><h3 className="text-lg font-black text-slate-800 mt-1">{selectedStudent.name}</h3></div>
              <div className="h-[200px] w-full mb-4 bg-white p-2 rounded-2xl border border-slate-100"><ResponsiveContainer width="100%" height="100%"><LineChart data={studentGrades}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" /><XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} fontSize={10} axisLine={false} tickLine={false} width={25} /><Tooltip /><Line type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={3} dot={{ fill: '#4F46E5', r: 3 }} /></LineChart></ResponsiveContainer></div>
            </div>
            <div className="lg:w-1/2 p-6 flex flex-col overflow-y-auto flex-1">
              <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-black text-slate-800 uppercase italic">Add Grades</h3><button onClick={() => setIsGradeModalOpen(false)} className="text-slate-400 p-2"><X size={20} /></button></div>
              <form onSubmit={handleSaveGrade} className="space-y-5 pb-20 lg:pb-0">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Lesson</label><select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-sm" value={selectedLesson?.id || ''} onChange={(e) => handleLessonSelect(e.target.value)}><option value="">-- Choose lesson --</option>{lessons.map((l) => <option key={l.id} value={l.id}>{l.date} - {l.topic}</option>)}</select></div>
                {selectedLesson && (<div className="space-y-3">{selectedLesson.tasks?.map((task, idx) => { const taskName = typeof task === 'object' ? task.text : task; const hasExistingGrade = existingGradeDocs[taskName] !== undefined; return (<div key={idx} className={`flex items-center justify-between p-3 border rounded-xl ${hasExistingGrade ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-200'}`}><span className={`font-bold text-xs ${hasExistingGrade ? 'text-indigo-700' : 'text-slate-700'}`}>{taskName}</span><input type="number" min="0" max="100" placeholder="-" className={`w-16 text-center font-black text-indigo-600 py-2 rounded-lg outline-none text-sm ${hasExistingGrade ? 'bg-white' : 'bg-slate-50'}`} value={gradeScores[taskName] || ''} onChange={(e) => setGradeScores({...gradeScores, [taskName]: e.target.value})} /></div>); })}</div>)}
                <button type="submit" disabled={loading || !selectedLesson} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest">{loading ? "Saving..." : "Save Scores"}</button>
              </form>
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