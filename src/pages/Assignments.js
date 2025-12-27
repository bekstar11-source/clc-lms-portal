import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { db } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  X, Save, CheckCircle2, Clock, BookOpen, 
  Calendar as CalendarIcon, Sparkles, Plus, Trash2, Check, Edit3 
} from 'lucide-react';
import './CalendarCustom.css';

const Assignments = () => {
  const [lessons, setLessons] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingLesson, setEditingLesson] = useState(null);
  const [newTopic, setNewTopic] = useState('');
  const [newTasks, setNewTasks] = useState([]); 
  const [loading, setLoading] = useState(false);

  const fetchLessons = async () => {
    const q = query(collection(db, "lessons"));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setLessons(list);
  };

  useEffect(() => {
    fetchLessons();
  }, []);

  const getDayLessons = (date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    const dateStr = localDate.toISOString().split('T')[0];
    return lessons.filter(l => l.date === dateStr);
  };

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const dayLessons = getDayLessons(date);
      if (dayLessons.length > 0) {
        return (
          <div className="flex justify-center mt-1">
            <div className="h-1.5 w-6 bg-indigo-500 rounded-full shadow-sm"></div>
          </div>
        );
      }
    }
  };

  const openEditModal = (lesson) => {
    setEditingLesson(lesson);
    setNewTopic(lesson.topic);
    const tasks = (lesson.tasks || []).map(t => 
      typeof t === 'string' ? { text: t, completed: false } : t
    );
    setNewTasks(tasks);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const lessonRef = doc(db, "lessons", editingLesson.id);
      await updateDoc(lessonRef, {
        topic: newTopic,
        tasks: newTasks,
        updatedAt: serverTimestamp()
      });
      await fetchLessons();
      setEditingLesson(null);
      alert("Changes saved successfully!");
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  const toggleTask = (index) => {
    const updated = [...newTasks];
    updated[index].completed = !updated[index].completed;
    setNewTasks(updated);
  };

  const deleteTask = (index) => {
    setNewTasks(newTasks.filter((_, i) => i !== index));
  };

  const addTask = () => {
    setNewTasks([...newTasks, { text: '', completed: false }]);
  };

  const selectedDayLessons = getDayLessons(selectedDate);

  return (
    <div className="p-4 sm:p-10 max-w-7xl mx-auto font-sans bg-[#f8fafc] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter italic">CLC Planning</h1>
          <p className="text-indigo-600 font-bold text-xs uppercase tracking-[0.3em] mt-2 flex items-center">
            <Sparkles size={14} className="mr-2" /> Developed by Aslbek Juraboev
          </p>
        </div>
        <div className="bg-white px-8 py-4 rounded-[2rem] shadow-xl shadow-indigo-100/20 border border-white flex items-center">
          <CalendarIcon className="text-indigo-500 mr-4" size={24} />
          <div className="text-left">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Date</p>
            <p className="font-black text-slate-800 text-lg">{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-white">
             <Calendar 
              locale="en-US"
              onChange={setSelectedDate} 
              value={selectedDate} 
              tileContent={tileContent}
              className="w-full border-none"
            />
          </div>
        </div>

        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center">
              <Clock size={16} className="mr-2 text-indigo-500" /> Daily Overview
            </h4>

            <div className="space-y-6">
              {selectedDayLessons.length > 0 ? (
                selectedDayLessons.map(l => (
                  <div key={l.id} className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h5 className="font-black text-slate-800 text-lg">{l.topic}</h5>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 italic">Crystal Learning Centre</p>
                      </div>
                      <button 
                        onClick={() => openEditModal(l)}
                        className="p-3 bg-white text-indigo-600 rounded-2xl shadow-sm hover:bg-indigo-600 hover:text-white transition-all"
                      >
                        <Edit3 size={18} />
                      </button>
                    </div>

                    {/* YANGI QO'SHILGAN QISM: VAZIFALAR RO'YXATI */}
                    <div className="mb-5 space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                      {l.tasks && l.tasks.length > 0 ? (
                        l.tasks.map((task, i) => {
                          const isCompleted = typeof task === 'object' ? task.completed : false;
                          const taskText = typeof task === 'object' ? task.text : task;
                          
                          return (
                            <div key={i} className={`flex items-start p-3 rounded-2xl border ${isCompleted ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-200'}`}>
                              <div className={`mt-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center mr-2 ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-200'}`}>
                                {isCompleted && <Check size={10} strokeWidth={4} />}
                              </div>
                              <span className={`text-xs font-bold leading-tight ${isCompleted ? 'text-emerald-700 line-through opacity-60' : 'text-slate-600'}`}>
                                {taskText}
                              </span>
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-[11px] font-bold text-slate-400 italic py-2">Hozircha vazifalar yo'q</p>
                      )}
                    </div>
                    
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                        <span className="text-slate-400">Task Completion</span>
                        <span className="text-indigo-600">
                          {l.tasks?.length ? Math.round((l.tasks.filter(t => (typeof t === 'object' ? t.completed : false)).length / l.tasks.length) * 100) : 0}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 transition-all duration-700"
                          style={{ width: `${l.tasks?.length ? (l.tasks.filter(t => (typeof t === 'object' ? t.completed : false)).length / l.tasks.length) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                  </div>
                ))
              ) : (
                <div className="py-20 text-center text-slate-400 font-bold text-sm italic border-2 border-dashed border-slate-100 rounded-[3rem]">
                  No lessons found for this date.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {editingLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingLesson(null)}></div>
          <div className="bg-white rounded-[4rem] p-12 w-full max-w-2xl relative z-10 shadow-2xl border border-white">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Edit Planner</h3>
              <button onClick={() => setEditingLesson(null)} className="p-4 bg-slate-100 text-slate-400 hover:text-red-500 rounded-3xl transition-all">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleUpdate} className="space-y-8">
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Topic Title</label>
                <input 
                  type="text" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] font-black text-slate-800 text-xl"
                  value={newTopic} onChange={(e) => setNewTopic(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-4">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tasks & Progress</label>
                  <button type="button" onClick={addTask} className="text-indigo-600 font-black text-[10px] uppercase flex items-center">
                    <Plus size={14} className="mr-1" /> Add Task
                  </button>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
                  {newTasks.map((task, idx) => (
                    <div key={idx} className={`flex items-center gap-3 p-3 rounded-[1.5rem] border ${task.completed ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`}>
                      <button 
                        type="button" 
                        onClick={() => toggleTask(idx)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${task.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'}`}
                      >
                        {task.completed ? <Check size={18} /> : <div className="w-2 h-2 rounded-full bg-current" />}
                      </button>
                      <input 
                        type="text" className={`flex-1 bg-transparent border-none outline-none font-bold text-sm ${task.completed ? 'text-emerald-700 line-through opacity-50' : 'text-slate-700'}`}
                        value={task.text} 
                        onChange={(e) => {
                          const updated = [...newTasks];
                          updated[idx].text = e.target.value;
                          setNewTasks(updated);
                        }}
                      />
                      <button type="button" onClick={() => deleteTask(idx)} className="p-2 text-slate-300 hover:text-red-500">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                type="submit" disabled={loading}
                className="w-full py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black shadow-xl hover:bg-indigo-700 flex items-center justify-center space-x-3 transition-all"
              >
                {loading ? "Processing..." : <><Save size={22} /> <span className="uppercase tracking-widest text-sm">Save Planner</span></>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assignments;