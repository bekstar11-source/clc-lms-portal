import React from 'react';
import { List, Trophy, UserPlus, Zap, Percent, Share2, Trash2, Crown } from 'lucide-react';

const getAvatarUrl = (seed) => {
    const safeSeed = seed || "default";
    const cleanSeed = safeSeed.replace('bot_', '');
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${cleanSeed}&backgroundColor=e0e7ff,d1fae5,ffedd5`;
};

const StudentsTab = ({
    displayedStudents, studentViewMode, setStudentViewMode, currentUserRole,
    setIsAddStudentOpen, openGradeModal, setSelectedStudent, setTargetGroupId,
    setIsMoveModalOpen, handleDeleteStudent
}) => {
    return (
        <div className="animate-in slide-in-from-left-4 duration-300">
            <div className="flex justify-between items-center mb-4">
                <div className="flex bg-white rounded-lg p-0.5 border border-slate-100 shadow-sm">
                    <button onClick={() => setStudentViewMode('list')} className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${studentViewMode === 'list' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400'}`}><List size={16} /></button>
                    <button onClick={() => setStudentViewMode('leaderboard')} className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${studentViewMode === 'leaderboard' ? 'bg-yellow-100 text-yellow-600' : 'text-slate-400'}`}><Trophy size={16} /></button>
                </div>
                {currentUserRole === 'admin' && (
                    <button onClick={() => setIsAddStudentOpen(true)} className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all"><UserPlus size={14} /> Qo'shish</button>
                )}
            </div>

            <div className="space-y-3 pb-24">
                {displayedStudents.map((s, index) => {
                    let rankStyle = "bg-slate-100 text-slate-500";
                    if (studentViewMode === 'leaderboard') {
                        if (index === 0) rankStyle = "bg-yellow-400 text-white shadow-lg shadow-yellow-200";
                        else if (index === 1) rankStyle = "bg-slate-300 text-white";
                        else if (index === 2) rankStyle = "bg-orange-400 text-white";
                    }
                    let scoreColor = "text-slate-400";
                    if (s.averageScore >= 80) scoreColor = "text-emerald-500";
                    else if (s.averageScore < 60 && s.averageScore > 0) scoreColor = "text-rose-500";

                    return (
                        <div key={s.id} onClick={() => openGradeModal(s)} className={`group bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3 active:scale-[0.98] transition-transform cursor-pointer relative overflow-hidden`}>
                            {studentViewMode === 'leaderboard' && index < 3 && <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/0 to-white/0 ${index === 0 ? 'via-yellow-50/50' : ''} pointer-events-none`}></div>}
                            <div className="flex items-center gap-4 overflow-hidden min-w-0 flex-1">
                                {studentViewMode === 'leaderboard' && (<div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-sm ${rankStyle}`}>{index + 1}</div>)}
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden border border-slate-100"><img src={getAvatarUrl(s.avatarSeed || s.name)} alt="" className="w-full h-full object-cover" /></div>
                                    {studentViewMode === 'leaderboard' && index === 0 && <Crown size={14} className="absolute -top-2 -right-2 text-yellow-500 fill-yellow-500 animate-bounce" />}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-bold text-slate-800 truncate">{s.name}</span>
                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-black uppercase"><Zap size={10} className="fill-indigo-500" />{s.gameXp} XP</div>
                                        <div className={`flex items-center gap-1 text-[10px] font-black uppercase ${scoreColor}`}><Percent size={10} />{s.averageScore}% O'rtacha</div>
                                    </div>
                                </div>
                            </div>
                            {currentUserRole === 'admin' && (
                                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => { setSelectedStudent(s); setTargetGroupId(''); setIsMoveModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-600 active:scale-90 transition-transform"><Share2 size={18} /></button>
                                    <button onClick={() => handleDeleteStudent(s.id, s.name)} className="p-2 text-slate-300 hover:text-red-500 active:scale-90 transition-transform"><Trash2 size={18} /></button>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export default StudentsTab;
