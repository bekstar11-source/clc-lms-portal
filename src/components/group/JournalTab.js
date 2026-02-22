import React from 'react';
import { Plus, Edit2, Trash2, Clock } from 'lucide-react';

const JournalTab = ({
    groupedLessons, lessons, handleOpenNewLesson, handleOpenEditLesson, handleDeleteLesson
}) => {
    return (
        <div className="animate-in slide-in-from-right-4 duration-300 pb-24">
            <div className="flex justify-between items-center mb-4 px-1">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Darslar Tarixi</h2>
                <button onClick={handleOpenNewLesson} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all"><Plus size={14} /> Yangi Dars</button>
            </div>
            <div className="space-y-6 relative">
                <div className="absolute left-4 top-4 bottom-0 w-0.5 bg-slate-200"></div>
                {Object.keys(groupedLessons).map((month) => (
                    <div key={month} className="relative z-10">
                        <div className="sticky top-[130px] z-20 mb-4 ml-10">
                            <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-200 shadow-sm">{month}</span>
                        </div>
                        <div className="space-y-4 pl-10">
                            {groupedLessons[month].map((l) => (
                                <div key={l.id} className="relative group bg-white p-4 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.99] transition-transform">
                                    <div className={`absolute -left-[30px] top-6 w-4 h-4 rounded-full border-4 shadow-sm ${l.isDelayed ? 'bg-orange-100 border-orange-400' : 'bg-white border-indigo-500'}`}></div>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-black text-indigo-500 uppercase">{l.date}</span>
                                                {l.isDelayed && <span className="text-[9px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock size={10} /> Qoldirildi</span>}
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-800 leading-tight mb-2">{l.topic}</h3>
                                            <div className="flex flex-wrap gap-1.5">
                                                {l.tasks?.map((t, i) => (
                                                    <span key={i} className="bg-slate-50 text-slate-500 border border-slate-100 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight">{typeof t === 'object' ? t.text : t}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenEditLesson(l); }} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg"><Edit2 size={14} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteLesson(l.id); }} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg"><Trash2 size={14} /></button>
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
    );
};

export default JournalTab;
