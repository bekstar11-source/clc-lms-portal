import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { 
  X, Trash2, Edit2, Plus, 
  Calendar as CalendarIcon, Users, Loader2
} from 'lucide-react';

const Assignments = () => {
  // STATE
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  
  const [lessons, setLessons] = useState([]);
  
  const [editingLesson, setEditingLesson] = useState(null);
  const [newTopic, setNewTopic] = useState('');
  const [newTasks, setNewTasks] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // GURUHLARNI YUKLASH
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(collection(db, "groups"), where("teacherId", "==", user.uid));
        const snap = await getDocs(q);
        const groupList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        setGroups(groupList);
        // Avtomatik birinchi guruhni tanlash
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

  // DARSLARNI YUKLASH (Guruh o'zgarganda)
  useEffect(() => {
    const fetchLessons = async () => {
      if (!selectedGroupId) return;
      
      setLoading(true);
      // Tanlangan guruhning BARCHA darslarini sanaga qarab (yangi tepada) olamiz
      const q = query(
        collection(db, "lessons"), 
        where("groupId", "==", selectedGroupId),
        orderBy("date", "desc") 
      );
      
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLessons(list);
      setLoading(false);
    };

    fetchLessons();
  }, [selectedGroupId]);

  // --- EDIT FUNCTIONS ---
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
      
      // Lokal yangilash
      setLessons(prev => prev.map(l => l.id === editingLesson.id ? { ...l, topic: newTopic, tasks: newTasks } : l));
      
      setEditingLesson(null);
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  const deleteTaskFromLesson = async (lessonId, currentTasks, taskIndex) => {
    if(!window.confirm("Vazifani o'chirmoqchimisiz?")) return;
    const updatedTasks = currentTasks.filter((_, i) => i !== taskIndex);
    
    // Bazada yangilash
    await updateDoc(doc(db, "lessons", lessonId), { tasks: updatedTasks });
    // State yangilash
    setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, tasks: updatedTasks } : l));
  };

  if (pageLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-indigo-600"/></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32">
      
      {/* 1. HEADER & GROUPS SCROLL */}
      <div className="bg-white pt-6 pb-4 shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="px-4 mb-4 flex justify-between items-center">
          <h1 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Assignments</h1>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">
            Total: {lessons.length}
          </div>
        </div>

        {/* GURUHLAR RO'YXATI (Horizontal Scroll) */}
        <div className="flex overflow-x-auto px-4 gap-3 pb-2 no-scrollbar snap-x">
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              className={`snap-center shrink-0 px-5 py-3 rounded-2xl border transition-all flex items-center gap-2 ${
                selectedGroupId === group.id 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Users size={16} />
              <span className="text-xs font-black uppercase tracking-wide whitespace-nowrap">{group.name}</span>
            </button>
          ))}
          {groups.length === 0 && <div className="text-xs text-slate-400 px-2">Guruhlar topilmadi</div>}
        </div>
      </div>

      {/* 2. TASKS LIST (All Assignments for Selected Group) */}
      <div className="p-4 max-w-2xl mx-auto">
         {selectedGroupId && (
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-2">
              All Tasks for Selected Group
            </h3>
         )}

         <div className="space-y-3">
           {lessons.length === 0 ? (
             <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-[2rem]">
                <CalendarIcon className="mx-auto text-slate-300 mb-2" size={32}/>
                <p className="text-xs font-bold text-slate-400">Bu guruhda hali vazifalar yo'q</p>
             </div>
           ) : (
             lessons.map(l => (
               <div key={l.id} className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm relative group hover:border-indigo-200 transition-all">
                  
                  {/* EDIT Button */}
                  <div className="absolute top-3 right-3 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditModal(l)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-indigo-600 hover:bg-indigo-50">
                      <Edit2 size={14}/>
                    </button>
                  </div>

                  <div className="flex items-start gap-4">
                     {/* Date Box */}
                     <div className="flex flex-col items-center justify-center bg-indigo-50 rounded-2xl p-2 min-w-[3.5rem] h-14 border border-indigo-100">
                        <span className="text-[8px] font-black text-indigo-400 uppercase">{l.date.split('-')[1]}</span>
                        <span className="text-xl font-black text-indigo-600 leading-none">{l.date.split('-')[2]}</span>
                     </div>

                     {/* Content */}
                     <div className="flex-1 pt-1">
                        <h4 className="font-bold text-slate-700 text-sm uppercase leading-tight pr-8">{l.topic}</h4>
                        
                        {/* TASKS BUBBLES */}
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {l.tasks?.map((t, i) => (
                            <div key={i} className="flex items-center bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-[9px] text-slate-600 uppercase font-black tracking-wide">
                              {typeof t === 'object' ? t.text : t}
                              <button onClick={() => deleteTaskFromLesson(l.id, l.tasks, i)} className="ml-1.5 text-slate-300 hover:text-red-500">
                                 <X size={10} strokeWidth={3} />
                              </button>
                            </div>
                          ))}
                          {(!l.tasks || l.tasks.length === 0) && <span className="text-[9px] italic text-slate-300">Vazifalar yo'q</span>}
                        </div>
                     </div>
                  </div>
               </div>
             ))
           )}
         </div>
      </div>

      {/* EDIT MODAL */}
      {editingLesson && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingLesson(null)}></div>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 mb-4 uppercase text-center italic">Edit Lesson</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Topic</label>
                   <input 
                     type="text" 
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                     value={newTopic} 
                     onChange={e => setNewTopic(e.target.value)} 
                   />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tasks</label>
                  <div className="max-h-40 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                    {newTasks.map((task, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input 
                          type="text" 
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-indigo-400" 
                          value={task.text} 
                          onChange={(e) => { 
                            const u = [...newTasks]; u[idx].text = e.target.value; setNewTasks(u); 
                          }} 
                        />
                        <button type="button" onClick={() => setNewTasks(newTasks.filter((_, i) => i !== idx))} className="text-red-400 p-1 hover:bg-red-50 rounded">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setNewTasks([...newTasks, { text: '', completed: false }])} 
                    className="w-full py-2 border border-dashed border-slate-300 rounded-xl text-slate-400 font-bold text-[10px] hover:border-indigo-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus size={14}/> Add Task
                  </button>
                </div>

                <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100">
                  {loading ? "Saving..." : "Save Changes"}
                </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Assignments;