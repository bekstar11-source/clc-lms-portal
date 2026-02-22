import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, ChevronRight } from 'lucide-react';

const GroupListWidget = ({ groups, triggerHaptic }) => {
    const navigate = useNavigate();
    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group, index) => {
                const isMain = group.role === 'main';
                const style = isMain ? (index % 2 === 0 ? 'from-blue-500 to-indigo-600' : 'from-emerald-400 to-teal-600') : 'from-amber-400 to-orange-500';
                return (
                    <div key={group.id} onClick={() => { triggerHaptic(); navigate(`/group/${group.id}`); }} className="group relative bg-white/40 backdrop-blur-xl rounded-[2rem] p-5 border border-white/60 shadow-xl shadow-indigo-500/10 cursor-pointer active:scale-[0.97] transition-all flex flex-col justify-between min-h-[160px] hover:bg-white/50">
                        <div>
                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${style} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300 mb-3`}>{isMain ? <Users size={20} strokeWidth={2.5} /> : <UserCheck size={20} strokeWidth={2.5} />}</div>
                            <h3 className="text-lg font-black text-slate-800 leading-tight line-clamp-2">{group.name}</h3>
                            <p className={`mt-1 text-[9px] font-black uppercase tracking-wider ${isMain ? 'text-indigo-900/60' : 'text-amber-700/70'}`}>{isMain ? 'Main Teacher' : 'Assistant'}</p>
                        </div>
                        <div className="mt-3 flex justify-end"><div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center text-indigo-600 shadow-sm border border-white/50 group-hover:scale-110 transition-transform"><ChevronRight size={20} /></div></div>
                    </div>
                );
            })}
        </div>
    );
};

export default GroupListWidget;
