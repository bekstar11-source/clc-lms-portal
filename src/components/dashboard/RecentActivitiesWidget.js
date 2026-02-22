import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, XCircle, ArrowRight } from 'lucide-react';

const RecentActivitiesWidget = ({ alerts, handleRejectRetake, triggerHaptic }) => {
    const navigate = useNavigate();
    const [isExpanded, setIsExpanded] = useState(true);

    if (alerts.length === 0) return null;

    const toggleExpand = () => {
        triggerHaptic();
        setIsExpanded(!isExpanded);
    };

    const onAlertClick = (alert) => {
        triggerHaptic();
        navigate(`/group/${alert.groupId}`, { state: { openStudentId: alert.studentId, highlightKey: alert.highlightKey } });
    };

    const onRejectClick = async (e, alertId) => {
        e.stopPropagation();
        triggerHaptic();
        if (!window.confirm("Rad etasizmi?")) return;

        const success = await handleRejectRetake(alertId);
        if (success) triggerHaptic('success');
    };

    return (
        <div className="mb-6 bg-white rounded-[2rem] border border-indigo-200 shadow-lg shadow-indigo-100/50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
            {/* HEADER */}
            <div
                onClick={toggleExpand}
                className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/50 border-b border-indigo-100' : 'hover:bg-indigo-50/30'}`}
            >
                <div className="flex items-center gap-2">
                    <div className="relative"><Bell size={20} className="text-indigo-600" /><span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-white"></span></div>
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Tekshiruv</h2>
                    <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{alerts.length}</span>
                </div>
                <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                    <ChevronDown size={16} />
                </div>
            </div>

            {/* BODY (Gorizontal Scroll) */}
            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="p-4 bg-white/50">
                        <div className="flex overflow-x-auto gap-3 pb-2 -mx-2 px-2 scrollbar-hide snap-x">
                            {alerts.map((alert, idx) => (
                                <div key={idx} onClick={() => onAlertClick(alert)} className="snap-center shrink-0 w-[260px] bg-white p-4 rounded-[1.5rem] border border-indigo-50 shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-600 truncate max-w-[120px]">{alert.groupName}</span>
                                        <button onClick={(e) => onRejectClick(e, alert.id)} className="w-6 h-6 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-rose-100 hover:text-rose-500 transition-colors"><XCircle size={14} /></button>
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-sm truncate">{alert.studentName}</h4>
                                    <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{alert.topic}</p>
                                    <div className="mt-3 flex items-center gap-1 text-[10px] font-black text-indigo-500 uppercase tracking-wide">Tekshirish <ArrowRight size={12} /></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RecentActivitiesWidget;
