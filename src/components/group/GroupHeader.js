import React from 'react';
import { ArrowLeft, RefreshCw, Trash2, Users, BookOpen } from 'lucide-react';

const GroupHeader = ({
    groupName, studentsCount, refreshing, onRefresh, onDeleteGroup, currentUserRole,
    activeTab, setActiveTab, navigate, triggerHaptic
}) => {
    return (
        <header className="fixed top-0 right-0 left-0 md:left-72 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 shadow-sm transition-all duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <button onClick={() => { triggerHaptic(); navigate('/'); }} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors shrink-0 active:scale-95"><ArrowLeft size={20} /></button>
                    <div className="min-w-0">
                        <h1 className="text-lg font-black text-slate-800 tracking-tight uppercase italic truncate w-48 sm:w-auto">{groupName}</h1>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">Sinfxona</span>
                            <span className="text-[10px] font-bold text-slate-400">{studentsCount} o'quvchi</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => { triggerHaptic(); onRefresh(); }} className={`p-2 rounded-xl border border-slate-100 transition-all ${refreshing ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
                        <RefreshCw size={20} className={refreshing ? "animate-spin" : ""} />
                    </button>
                    {currentUserRole === 'admin' && (
                        <button onClick={onDeleteGroup} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"><Trash2 size={20} /></button>
                    )}
                </div>
            </div>

            <div className="flex p-1 bg-slate-100 rounded-xl mt-4 md:w-fit">
                <button onClick={() => { triggerHaptic(); setActiveTab('students'); }} className={`flex-1 md:flex-none md:px-8 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'students' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><Users size={14} /> O'quvchilar</button>
                <button onClick={() => { triggerHaptic(); setActiveTab('journal'); }} className={`flex-1 md:flex-none md:px-8 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'journal' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><BookOpen size={14} /> Jurnal</button>
            </div>
        </header>
    );
};

export default GroupHeader;
