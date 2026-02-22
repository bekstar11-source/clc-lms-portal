import React from 'react';
import { Sparkles, RefreshCw, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/notionists/svg?seed=${seed || 'teacher'}&backgroundColor=e0e7ff,c7d2fe`;

const DashboardHeader = ({ teacherName, refreshing, onRefresh, unreadMessages, triggerHaptic }) => {
    const navigate = useNavigate();
    return (
        <div className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl border-b border-white/40 px-6 py-4 pt-[calc(1rem+env(safe-area-inset-top))] flex justify-between items-center transition-all duration-300 shadow-sm">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1 mb-0.5"><Sparkles size={10} className="text-indigo-600" /> Teacher Portal</p>
                <h1 className="text-xl font-black text-slate-800">Hi, <span className="text-indigo-600">{teacherName?.split(' ')[0]}</span></h1>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={() => { triggerHaptic(); onRefresh(); }} className={`p-2.5 bg-white/70 text-slate-500 hover:text-indigo-600 rounded-xl shadow-sm border border-white active:scale-95 transition-all ${refreshing ? 'animate-spin text-indigo-600' : ''}`}><RefreshCw size={20} /></button>
                <button onClick={() => { triggerHaptic(); navigate('/chat'); }} className="hidden md:flex p-2.5 bg-white/70 text-slate-500 hover:text-indigo-600 rounded-xl shadow-sm border border-white active:scale-95 transition-all relative">
                    <MessageCircle size={20} />
                    {unreadMessages > 0 && (<span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>)}
                </button>
                <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 overflow-hidden shadow-sm">
                    <img src={getAvatarUrl(teacherName)} alt="me" className="w-full h-full object-cover" />
                </div>
            </div>
        </div>
    );
};

export default DashboardHeader;
