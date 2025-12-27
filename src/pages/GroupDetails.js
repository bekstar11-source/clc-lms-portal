import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, UserPlus, Star, Plus, Calendar, X, Save, Loader2, Info, Edit2, PlusCircle, Trash2
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
  
  // Baholash uchun statelar
  const [gradeScores, setGradeScores] = useState({}); 
  const [existingGradeDocs, setExistingGradeDocs] = useState({}); // Mavjud baholarning ID lari
  
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
    const confirmDelete = window.confirm(`DIQQAT!\n\n"${topicName}" mavzusini butunlay o'chirib yubormoqchimisiz?\nBu amalni orqaga qaytarib bo'lmaydi.`);
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, "lessons", lessonId));
        fetchData(); 
      } catch (error) {
        alert("Xatolik yuz berdi: " + error.message);
      }
    }
  };

  const deleteTaskFromLesson = async (lessonId, allTasks, indexToDelete) => {
    if(!window.confirm("Bu vazifani o'chirib tashlamoqchimisiz?")) return;
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
    setExistingGradeDocs({}); // Reset qilish
    setIsGradeModalOpen(true);
    setStudentGrades([]);

    try {
      // Tarix uchun barcha baholarni yuklash
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

  // YANGI: Dars tanlanganda, shu darsga tegishli eski baholarni yuklash
  const handleLessonSelect = async (lessonId) => {
    const lesson = lessons.find(l => l.id === lessonId);
    setSelectedLesson(lesson);
    
    // Default bo'sh qilib turamiz
    const initialScores = {};
    const docsMap = {};

    if (lesson) {
      // 1. Darsdagi vazifalar uchun bo'sh joy tayyorlash
      lesson.tasks?.forEach(t => {
        const taskName = typeof t === 'object' ? t.text : t;
        initialScores[taskName] = '';
      });

      // 2. Bazadan shu o'quvchi va shu dars uchun qo'yilgan baholarni olish
      try {
        const q = query(
          collection(db, "grades"), 
          where("studentId", "==", selectedStudent.id),
          where("lessonId", "==", lesson.id)
        );
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Inputga eski bahoni yozib qo'yamiz
          initialScores[data.taskType] = data.score;
          // Qaysi document ekanligini saqlab qo'yamiz (Update qilish uchun)
          docsMap[data.taskType] = doc.id;
        });
      } catch (err) {
        console.error("Eski baholarni yuklashda xatolik:", err);
      }
    }
    
    setGradeScores(initialScores);
    setExistingGradeDocs(docsMap);
  };

  // YANGI: Saqlash jarayoni (Update yoki Create)
  const handleSaveGrade = async (e) => {
    e.preventDefault();
    if (!selectedLesson) return;

    // Faqat qiymati bor inputlarni olamiz
    const filteredScores = Object.entries(gradeScores).filter(([_, score]) => score !== '' && score !== null);
    
    if (filteredScores.length === 0) return alert("Hech qanday baho kiritilmadi!");
    
    setLoading(true);
    try {
      for (const [taskType, score] of filteredScores) {
        const existingDocId = existingGradeDocs[taskType]; // Bu vazifa uchun oldin baho bormi?

        if (existingDocId) {
          // AGAR BAHO MAVJUD BO'LSA:
          // Eski qiymat bilan yangisini solishtirish (ixtiyoriy, lekin foydali)
          // Asosiy talab: So'rash
          const confirmUpdate = window.confirm(`"${taskType}" uchun baho allaqachon mavjud. Uni o'zgartirishni xohlaysizmi?`);
          
          if (confirmUpdate) {
            // Yangilash (Update)
            const gradeRef = doc(db, "grades", existingDocId);
            await updateDoc(gradeRef, {
              score: Number(score),
              date: serverTimestamp() // O'zgargan vaqtni yangilash
            });
          }
          // Agar "Yo'q" desa, shunchaki o'tkazib yuboramiz (o'zgartirmaymiz)
        } else {
          // AGAR YANGI BAHO BO'LSA (Create):
          await addDoc(collection(db, "grades"), {
            studentId: selectedStudent.id,
            studentName: selectedStudent.name,
            groupId,
            score: Number(score),
            comment: selectedLesson.topic,
            taskType: taskType,
            lessonId: selectedLesson.id,
            date: serverTimestamp()
          });
        }
      }

      setIsGradeModalOpen(false);
      alert("Jarayon yakunlandi!");
    } catch (error) { 
      alert("Xatolik: " + error.message); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-xl border border-slate-200"><ArrowLeft size={20}/></button>
            <h1 className="text-3xl font-black text-slate-800 uppercase italic">CLC: {groupName}</h1>
          </div>
          <div className="flex space-x-3">
             <button onClick={() => { setEditingLesson(null); setLessonTasks([{ text: 'Homework', completed: false }]); setIsAddLessonOpen(true); }} className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-2xl font-black text-xs uppercase italic tracking-widest hover:bg-slate-50">+ Lesson</button>
             <button onClick={() => setIsAddStudentOpen(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase italic tracking-widest shadow-lg shadow-indigo-100">+ Student</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Students List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-black text-slate-800 flex items-center px-2 uppercase tracking-tighter">Students List</h2>
            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr><th className="px-8 py-5">Name</th><th className="px-8 py-5 text-center">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                  {students.map((s) => (
                    <tr key={s.id} className="group hover:bg-slate-50/50">
                      <td className="px-8 py-6">{s.name}</td>
                      <td className="px-8 py-6 flex justify-center space-x-2">
                        <button onClick={() => openGradeModal(s)} className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Star size={14}/><span>Grade</span></button>
                        <button onClick={() => handleDeleteStudent(s.id, s.name)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Group Plan */}
          <div className="space-y-4">
            <h2 className="text-xl font-black text-slate-800 flex items-center px-2 uppercase tracking-tighter">Course Plan</h2>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {lessons.map((l, idx) => (
                <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm border-l-4 border-l-amber-500 group relative">
                  
                  <div className="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                    <button 
                      onClick={() => { setEditingLesson(l); setLessonTopic(l.topic); setLessonDate(l.date); setLessonTasks(l.tasks || [{ text: 'Homework', completed: false }]); setIsAddLessonOpen(true); }} 
                      className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                    >
                      <Edit2 size={14}/>
                    </button>
                    <button 
                      onClick={() => handleDeleteLesson(l.id, l.topic)} 
                      className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-white hover:bg-red-500 transition-all"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>

                  <div className="text-[10px] font-black text-amber-600 uppercase mb-2 bg-amber-50 w-fit px-2 py-1 rounded-lg">{l.date}</div>
                  <h4 className="font-black text-slate-800 leading-tight mb-3 uppercase w-[80%]">{l.topic}</h4>
                  
                  <div className="flex flex-wrap gap-2">
                    {l.tasks?.map((t, i) => (
                      <div key={i} className="flex items-center bg-slate-50 border border-slate-100 pl-3 pr-1 py-1 rounded-xl group/task hover:bg-red-50 hover:border-red-100 transition-colors">
                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter mr-1">
                          {typeof t === 'object' ? t.text : t}
                        </span>
                        <button onClick={() => deleteTaskFromLesson(l.id, l.tasks, i)} className="p-1 text-slate-300 hover:text-red-500 rounded-full"><X size={10} strokeWidth={3} /></button>
                      </div>
                    ))}
                    {(!l.tasks || l.tasks.length === 0) && <span className="text-[9px] text-slate-300 italic">Vazifalar yo'q</span>}
                  </div>

                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* GRADE MODAL */}
      {isGradeModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsGradeModalOpen(false)}></div>
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl relative z-10 overflow-hidden flex flex-col lg:flex-row max-h-[90vh]">
            <div className="lg:w-1/2 bg-slate-50 p-8 flex flex-col border-r border-slate-100 overflow-y-auto">
              <div className="mb-6"><span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-lg italic">Analytics</span><h3 className="text-2xl font-black text-slate-800 mt-2">{selectedStudent.name}</h3></div>
              <div className="h-[250px] w-full mb-6 bg-white p-4 rounded-3xl border border-slate-100 shadow-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={studentGrades}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" /><XAxis dataKey="date" fontSize={10} fontWeight="bold" stroke="#94A3B8" axisLine={false} tickLine={false} dy={10} /><YAxis domain={[0, 100]} fontSize={10} fontWeight="bold" stroke="#94A3B8" axisLine={false} tickLine={false} dx={-10} /><Tooltip /><Line type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={4} dot={{ fill: '#4F46E5', r: 4 }} /></LineChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 pr-2 overflow-y-auto font-bold text-xs">
                {studentGrades.slice().reverse().map((g, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-white rounded-2xl border border-slate-100"><div className="text-slate-600">{g.taskType}: {g.comment}</div><div className="text-indigo-600">{g.score}%</div></div>
                ))}
              </div>
            </div>

            <div className="lg:w-1/2 p-8 flex flex-col overflow-y-auto">
              <div className="flex justify-between items-center mb-8"><h3 className="text-xl font-black text-slate-800 uppercase italic">Add Grades</h3><button onClick={() => setIsGradeModalOpen(false)} className="text-slate-400"><X size={24} /></button></div>
              <form onSubmit={handleSaveGrade} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Lesson</label>
                  <select 
                    required 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" 
                    value={selectedLesson?.id || ''} 
                    onChange={(e) => handleLessonSelect(e.target.value)}
                  >
                    <option value="">-- Choose lesson --</option>
                    {lessons.map((l) => <option key={l.id} value={l.id}>{l.date} - {l.topic}</option>)}
                  </select>
                </div>

                {selectedLesson && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    {selectedLesson.tasks?.map((task, idx) => {
                      const taskName = typeof task === 'object' ? task.text : task;
                      // Input rangini o'zgartirish: agar baho oldin qo'yilgan bo'lsa, bilinishi uchun
                      const hasExistingGrade = existingGradeDocs[taskName] !== undefined;

                      return (
                        <div key={idx} className={`flex items-center justify-between p-4 border rounded-2xl transition-all ${hasExistingGrade ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-200'}`}>
                          <span className={`font-bold text-sm ${hasExistingGrade ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {taskName} {hasExistingGrade && <span className="ml-2 text-[9px] bg-white px-2 py-0.5 rounded-full uppercase tracking-wider text-indigo-400">Recorded</span>}
                          </span>
                          <input 
                            type="number" min="0" max="100" placeholder="0-100" 
                            className={`w-20 text-center font-black text-indigo-600 py-2 rounded-xl outline-none ${hasExistingGrade ? 'bg-white shadow-sm' : 'bg-slate-50'}`}
                            value={gradeScores[taskName] || ''} 
                            onChange={(e) => setGradeScores({...gradeScores, [taskName]: e.target.value})} 
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <button type="submit" disabled={loading || !selectedLesson} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-[0.2em]">{loading ? "Saving..." : "Save Scores"}</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT LESSON MODAL */}
      {isAddLessonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setIsAddLessonOpen(false); setEditingLesson(null); }}></div>
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tight">{editingLesson ? "Edit Lesson" : "New Lesson"}</h3>
            <form onSubmit={handleAddLesson} className="space-y-4">
              <input type="date" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={lessonDate} onChange={e => setLessonDate(e.target.value)} />
              <input type="text" placeholder="Topic Name" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={lessonTopic} onChange={e => setLessonTopic(e.target.value)} />
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tasks for this lesson</label>
                {lessonTasks.map((task, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input type="text" required placeholder="e.g. Vocabulary" className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" value={task.text} onChange={(e) => {
                      const newTasks = [...lessonTasks];
                      newTasks[idx].text = e.target.value;
                      setLessonTasks(newTasks);
                    }} />
                    <button type="button" onClick={() => setLessonTasks(lessonTasks.filter((_, i) => i !== idx))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setLessonTasks([...lessonTasks, { text: '', completed: false }])} className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-xs hover:border-indigo-400 transition-all">+ Add New Task Type</button>
              </div>
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest mt-4 italic">Save Planning</button>
            </form>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddStudentOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md relative z-10 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-800 mb-6 uppercase text-center italic tracking-tight">New Student</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await addDoc(collection(db, "students"), { name: newStudentName, email: newStudentEmail, groupId, joinedAt: serverTimestamp() });
              setIsAddStudentOpen(false); setNewStudentName(''); setNewStudentEmail(''); fetchData();
            }} className="space-y-4">
              <input type="text" placeholder="Full Name" required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} />
              <input type="email" placeholder="Email Address" required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" value={newStudentEmail} onChange={e => setNewStudentEmail(e.target.value)} />
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest italic">Add to Group</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetails;