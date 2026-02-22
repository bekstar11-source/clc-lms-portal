import React from 'react';
import { Share2, ChevronDown, Loader2 } from 'lucide-react';

const MoveStudentModal = ({
    isMoveModalOpen,
    setIsMoveModalOpen,
    selectedStudent,
    allGroups,
    groupId,
    targetGroupId,
    setTargetGroupId,
    handleMoveStudent,
    loading
}) => {
    if (!isMoveModalOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl border border-white/50 animate-in zoom-in-95 duration-300">
                <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2"><Share2 size={20} className="text-indigo-500" /> O'quvchini Ko'chirish</h3>
                <p className="text-sm text-slate-500 mb-4 font-medium">"{selectedStudent?.name}" ni qaysi guruhga o'tkazmoqchisiz?</p>
                <div className="relative mb-6">
                    <select className="w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition-all" value={targetGroupId} onChange={(e) => setTargetGroupId(e.target.value)}>
                        <option value="">-- Guruhni tanlang --</option>
                        {allGroups.filter(g => g.id !== groupId).map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setIsMoveModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition-colors">Bekor qilish</button>
                    <button onClick={handleMoveStudent} disabled={!targetGroupId || loading} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? <Loader2 className="animate-spin mx-auto" /> : "Ko'chirish"}</button>
                </div>
            </div>
        </div>
    );
};

export default MoveStudentModal;
