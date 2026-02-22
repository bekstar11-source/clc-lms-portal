import React from 'react';
import { Trash2 } from 'lucide-react';

const generateId = () => Math.random().toString(36).substr(2, 9);

const LessonModal = ({
    isAddLessonOpen,
    setIsAddLessonOpen,
    editingLesson,
    setEditingLesson,
    lessonDate,
    setLessonDate,
    lessonTopic,
    setLessonTopic,
    isLessonDelayed,
    setIsLessonDelayed,
    lessonTasks,
    setLessonTasks,
    handleSaveLesson
}) => {
    if (!isAddLessonOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setIsAddLessonOpen(false); setEditingLesson(null); }}></div>
            <div className="bg-white w-full max-w-sm h-[80dvh] sm:h-auto rounded-t-[2.5rem] sm:rounded-[2.5rem] relative z-10 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    <h3 className="text-xl font-black text-slate-800 mb-2 uppercase text-center italic">{editingLesson ? "Darsni Tahrirlash" : "Yangi Dars"}</h3>
                    <form id="lesson-form" className="space-y-4" onSubmit={handleSaveLesson}>
                        <input type="date" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500" value={lessonDate} onChange={e => setLessonDate(e.target.value)} />
                        <input type="text" placeholder="Mavzu Nomi" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500" value={lessonTopic} onChange={e => setLessonTopic(e.target.value)} />

                        <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div onClick={() => setIsLessonDelayed(!isLessonDelayed)} className={`w-10 h-6 rounded-full p-1 transition-all cursor-pointer ${isLessonDelayed ? 'bg-orange-400' : 'bg-slate-300'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isLessonDelayed ? 'translate-x-4' : 'translate-x-0'}`}></div>
                            </div>
                            <span className="text-xs font-bold text-slate-500">Darsni keyinga qoldirish</span>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vazifalar / Uyga vazifa</label>
                                <button type="button" onClick={() => setLessonTasks([...lessonTasks, { id: generateId(), text: '', completed: false }])} className="text-[10px] font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded-lg">+ Qo'shish</button>
                            </div>
                            {lessonTasks.map((task, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input type="text" required className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500" value={task.text} onChange={(e) => { const newTasks = [...lessonTasks]; newTasks[idx].text = e.target.value; setLessonTasks(newTasks); }} />
                                    <button type="button" onClick={() => setLessonTasks(lessonTasks.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 bg-red-50 p-3 rounded-xl"><Trash2 size={16} /></button>
                                </div>
                            ))}
                        </div>
                    </form>
                </div>

                <div className="p-4 bg-white border-t border-slate-100 shrink-0 z-50 relative pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <button onClick={handleSaveLesson} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-200 active:scale-95 transition-all">
                        {editingLesson ? "Darsni Yangilash" : "Darsni Yaratish"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LessonModal;
