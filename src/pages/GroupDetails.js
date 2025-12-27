import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Star, X, Loader2, Edit2, Trash2, Menu
} from 'lucide-react';
import { db } from '../firebase';
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
  
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false); 
  
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  
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

      const qS = query(collection(db, "students"), where("groupId", "==", groupId));
      const snapS = await getDocs(qS);
      setStudents(snapS.docs.map(d => ({ id: d.id, ...d.data() })));

      const qL = query(collection(db, "lessons"), where("groupId", "==", groupId), orderBy("date", "desc"));
      const snapL = await getDocs(qL);
      setLessons(snapL.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Fetch error:", e); }
  };

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const handleDeleteStudent = async (studentId, studentName) => {
    if (window.confirm(`${studentName}ni o'chirishni xohlaysizmi?`)) {
      try {
        await deleteDoc(doc(db, "students", studentId));
        fetchData();
      } catch (error) { alert(error.message); }
    }
  };

  const handleDeleteLesson = async (lessonId, topicName) => {
    const confirmDelete = window.confirm(`DIQQAT!\n\n"${topicName}" mavzusini o'chirib yubormoqchimisiz?`);
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, "lessons", lessonId));
        fetchData(); 
      } catch (error) {
        alert("Xatolik: " + error.message);
      }
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
        await updateDoc(doc(db, "lessons", editingLesson.id), {
          topic: lessonTopic, date: lessonDate, tasks: tasks
        });
      } else {
        await addDoc(collection(db, "lessons"), { 
          groupId, topic: lessonTopic, date: lessonDate, tasks: tasks, createdAt: serverTimestamp() 
        });
      }
      setIsAddLessonOpen(false);
      setEditingLesson(null);
      setLessonTopic(''); setLessonDate(''); setLessonTasks([{ text: 'Homework', completed: false }]);
      fetchData();
    } catch (error) { alert(error.message); }
  };

  const openGradeModal = async (student) => {
    setSelectedStudent(student);
    setSelectedLesson(null);
    setGradeScores({});
    setExistingGradeDocs({});
    setIsGradeModalOpen(true);
    setStudentGrades([]);

    try {
      const q = query(collection(db, "grades"), where("studentId", "==", student.id), orderBy("date", "asc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => {
        const dData = d.data();
        return {
          score: dData.score,
          date: dData.date ? dData.date.toDate().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : "",
          comment: dData.comment,
          taskType: dData.taskType
        };
      });
      setStudentGrades(data);
    } catch (error) { console.error(error); }
  };

  const handleLessonSelect = async (lessonId) => {
    const lesson = lessons.find(l => l.id === lessonId);
    setSelectedLesson(lesson);
    const initialScores = {};
    const docsMap = {};

    if (lesson) {
      lesson.tasks?.forEach(t => {
        const taskName = typeof t === 'object' ? t.text : t;
        initialScores[taskName] = '';
      });

      try {
        const q = query(
          collection(db, "grades"), 
          where("studentId", "==", selectedStudent.id),
          where("lessonId", "==", lesson.id)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          initialScores[data.taskType] = data.score;
          docsMap[data.taskType] = doc.id;
        });
      } catch (err) { console.error(err); }
    }
    setGradeScores(initialScores);
    setExistingGradeDocs(docsMap);
  };

  const handleSaveGrade = async (e) => {
    e.preventDefault();
    if (!selectedLesson) return;
    const filteredScores = Object.entries(gradeScores).filter(([_, score]) => score !== '' && score !== null);
    if (filteredScores.length === 0) return alert("Baho kiriting!");
    
    setLoading(true);
    try {
      for (const [taskType, score] of filteredScores) {
        const existingDocId = existingGradeDocs[taskType];
        if (existingDocId) {
          if (window.confirm(`"${taskType}" bahosini o'zgartirasizmi?`)) {
            await updateDoc(doc(db, "grades", existingDocId), { score: Number(score), date: serverTimestamp() });
          }
        } else {
          await addDoc(collection(db, "grades"), {
            studentId: selectedStudent.id, studentName: selectedStudent.name, groupId,
            score: Number(score), comment: selectedLesson.topic, taskType: taskType,
            lessonId: selectedLesson.id, date: serverTimestamp()
          });
        }
      }
      setIsGradeModalOpen(false);
      alert("Saqlandi!");
    } catch (error) { alert("Xatolik: " + error.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 font-sans pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Responsive Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-xl border border-slate-200 hover:bg-slate-50"><ArrowLeft size={20}/></button>
            <h1 className="text-xl sm:text-3xl font-black text-slate-800 uppercase italic truncate max-w-[200px] sm:max-w-none">CLC: {groupName}</h1>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
             <button onClick={() => { setEditingLesson(null); setLessonTasks([{ text: 'Homework', completed: false }]); setIsAddLessonOpen(true); }} className="flex-1 sm:flex-none bg-white text-slate-700 border border-slate-200 px-4 py-3 rounded-xl font-black text-[10px] uppercase italic tracking-widest hover:bg-slate-50 text-center">+ Lesson</button>
             <button onClick={() => setIsAddStudentOpen(true)} className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase italic tracking-widest shadow-lg shadow-indigo-100 text-center">+ Student</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Students List (Responsive Table) */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-lg font-black text-slate-800 flex items-center px-2 uppercase tracking-tighter">Students List</h2>
            <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[500px]"> {/* min-w qo'shildi, siqilib qolmasligi uchun */}
                  <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4 text-center">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                    {students.map((s) => (
                      <tr key={s.id} className="group hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-sm">{s.name}</td>
                        <td className="px-6 py-4 flex justify-center space-x-2">
                          <button onClick={() => openGradeModal(s)} className="flex items-center space-x-1 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"><Star size={14}/><span>Grade</span></button>
                          <button onClick={() => handleDeleteStudent(s.id, s.name)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Group Plan (Mobile Friendly) */}
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

      {/* GRADE MODAL (Responsive Split) */}
      {isGradeModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsGradeModalOpen(false)}></div>
          <div className="bg-white rounded-[2rem] w-full max-w-5xl relative z-10 overflow-hidden flex flex-col lg:flex-row max-h-[90vh] shadow-2xl">
            
            {/* Chap tomon: Grafika (Mobilda tepada) */}
            <div className="lg:w-1/2 bg-slate-50 p-6 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-100 overflow-y-auto max-h-[40vh] lg:max-h-none">
              <div className="mb-4"><span className="text-[9px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded-md">Analytics</span><h3 className="text-lg font-black text-slate-800 mt-1">{selectedStudent.name}</h3></div>
              <div className="h-[200px] w-full mb-4 bg-white p-2 rounded-2xl border border-slate-100">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={studentGrades}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" /><XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} fontSize={10} axisLine={false} tickLine={false} width={25} /><Tooltip /><Line type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={3} dot={{ fill: '#4F46E5', r: 3 }} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* O'ng tomon: Form (Mobilda pastda) */}
            <div className="lg:w-1/2 p-6 flex flex-col overflow-y-auto flex-1">
              <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-black text-slate-800 uppercase italic">Add Grades</h3><button onClick={() => setIsGradeModalOpen(false)} className="text-slate-400 p-2"><X size={20} /></button></div>
              <form onSubmit={handleSaveGrade} className="space-y-5 pb-20 lg:pb-0"> {/* Mobile klaviatura uchun joy */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Lesson</label>
                  <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-sm" value={selectedLesson?.id || ''} onChange={(e) => handleLessonSelect(e.target.value)}>
                    <option value="">-- Choose lesson --</option>
                    {lessons.map((l) => <option key={l.id} value={l.id}>{l.date} - {l.topic}</option>)}
                  </select>
                </div>
                {selectedLesson && (
                  <div className="space-y-3">
                    {selectedLesson.tasks?.map((task, idx) => {
                      const taskName = typeof task === 'object' ? task.text : task;
                      const hasExistingGrade = existingGradeDocs[taskName] !== undefined;
                      return (
                        <div key={idx} className={`flex items-center justify-between p-3 border rounded-xl ${hasExistingGrade ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-200'}`}>
                          <span className={`font-bold text-xs ${hasExistingGrade ? 'text-indigo-700' : 'text-slate-700'}`}>{taskName}</span>
                          <input type="number" min="0" max="100" placeholder="-" className={`w-16 text-center font-black text-indigo-600 py-2 rounded-lg outline-none text-sm ${hasExistingGrade ? 'bg-white' : 'bg-slate-50'}`} value={gradeScores[taskName] || ''} onChange={(e) => setGradeScores({...gradeScores, [taskName]: e.target.value})} />
                        </div>
                      );
                    })}
                  </div>
                )}
                <button type="submit" disabled={loading || !selectedLesson} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest">{loading ? "Saving..." : "Save Scores"}</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ADD LESSON / STUDENT MODALS */}
      {(isAddLessonOpen || isAddStudentOpen) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => {setIsAddLessonOpen(false); setIsAddStudentOpen(false);}}></div>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl">
            <h3 className="text-xl font-black text-slate-800 mb-4 uppercase text-center italic">{isAddLessonOpen ? (editingLesson ? "Edit Lesson" : "New Lesson") : "New Student"}</h3>
            {isAddLessonOpen ? (
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
            ) : (
              <form onSubmit={async (e) => { e.preventDefault(); await addDoc(collection(db, "students"), { name: newStudentName, email: newStudentEmail, groupId, joinedAt: serverTimestamp() }); setIsAddStudentOpen(false); setNewStudentName(''); setNewStudentEmail(''); fetchData(); }} className="space-y-3">
                <input type="text" placeholder="Full Name" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} />
                <input type="email" placeholder="Email Address" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm" value={newStudentEmail} onChange={e => setNewStudentEmail(e.target.value)} />
                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">Add</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetails;