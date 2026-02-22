import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight } from 'lucide-react';

const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/notionists/svg?seed=${seed || 'teacher'}&backgroundColor=e0e7ff,c7d2fe`;

const DebtorsWidget = ({ debtors, triggerHaptic }) => {
    const navigate = useNavigate();

    return (
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-xl overflow-hidden">
            {debtors.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center"><div className="w-16 h-16 bg-emerald-100/50 rounded-full flex items-center justify-center mb-4"><Sparkles className="text-emerald-500" size={32} /></div><h3 className="text-sm font-black text-slate-800">Hammasi joyida!</h3></div>
            ) : (
                <div className="divide-y divide-slate-100/50">
                    {debtors.map((student, idx) => (
                        <div key={idx} onClick={() => { triggerHaptic(); navigate(`/group/${student.groupId}`, { state: { openStudentId: student.id } }) }} className="p-4 hover:bg-white/40 transition-colors cursor-pointer flex items-center justify-between gap-3 active:bg-white/60">
                            <div className="flex items-center gap-3 min-w-0"><div className="relative"><div className="w-10 h-10 rounded-full bg-white/80 overflow-hidden"><img src={getAvatarUrl(student.avatarSeed || student.name)} className="w-full h-full object-cover" alt="s" /></div></div><div className="min-w-0"><h4 className="font-bold text-slate-800 text-sm truncate">{student.name}</h4><span className="text-[9px] font-bold text-slate-500 bg-white/50 px-1.5 py-0.5 rounded truncate max-w-[120px]">{student.groupName}</span></div></div>
                            <div className="flex items-center gap-2"><span className="text-xs font-black text-red-500 bg-red-100/50 px-2 py-1 rounded-lg border border-red-100">{student.averageScore}%</span><div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-slate-400 shrink-0"><ChevronRight size={16} /></div></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DebtorsWidget;
