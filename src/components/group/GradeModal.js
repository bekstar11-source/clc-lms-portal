import React, { useState, useEffect } from 'react';
import { X, Calendar, ChevronUp, ChevronDown, Check, Trash2, Loader2, Save } from 'lucide-react';

const GRACE_PERIOD_DAYS = 7;
const RETAKE_PERIOD_DAYS = 7;

const getAvatarUrl = (seed) => {
    const safeSeed = seed || "default";
    const cleanSeed = safeSeed.replace('bot_', '');
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${cleanSeed}&backgroundColor=e0e7ff,d1fae5,ffedd5`;
};

const MiniCountdown = ({ deadline, label, type = 'danger' }) => {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        if (!deadline) return;
        const calculate = () => {
            const diff = new Date(deadline) - new Date();
            if (diff <= 0) { setTimeLeft("Tugadi"); return; }
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            setTimeLeft(days > 0 ? `${days}k` : `${hours}s`);
        };
        calculate();
        const timer = setInterval(calculate, 60000);
        return () => clearInterval(timer);
    }, [deadline]);

    const colorClass = type === 'danger'
        ? 'bg-red-50 text-red-500 border-red-200'
        : 'bg-amber-50 text-amber-600 border-amber-200';

    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider shadow-sm animate-pulse ${colorClass}`}>
            <span>{label}</span>
            <span className="opacity-50">•</span>
            <span>{timeLeft} qoldi</span>
        </div>
    );
};

const GradeModal = ({
    isGradeModalOpen,
    setIsGradeModalOpen,
    selectedStudent,
    groupedLessons,
    modalExpandedMonths,
    toggleModalMonth,
    existingGradeDocs,
    existingGradeObjects,
    gradeScores,
    savedStatus,
    location,
    highlightRef,
    handleScoreChange,
    handleDeleteGrade,
    handleSaveAllGrades,
    loading,
    hasChanges
}) => {
    if (!isGradeModalOpen || !selectedStudent) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center sm:p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsGradeModalOpen(false)}></div>
            <div className="bg-white w-full max-w-lg h-[95dvh] sm:h-[85vh] rounded-t-[2rem] sm:rounded-[2.5rem] relative z-10 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden">
                <div className="w-full flex justify-center pt-3 pb-1 bg-slate-900 sm:hidden">
                    <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                </div>
                <div className="p-5 bg-slate-900 text-white shrink-0 flex items-center justify-between relative overflow-hidden z-50">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 overflow-hidden">
                            <img src={getAvatarUrl(selectedStudent.avatarSeed || selectedStudent.name)} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black leading-none">{selectedStudent.name}</h3>
                            <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mt-1">Baholash Paneli</p>
                        </div>
                    </div>
                    <button onClick={() => setIsGradeModalOpen(false)} className="relative z-10 p-2 bg-white/10 rounded-full hover:bg-white/20"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50">
                    <form onSubmit={handleSaveAllGrades} className="space-y-4">
                        {Object.keys(groupedLessons).map((month) => (
                            <div key={month} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div onClick={() => toggleModalMonth(month)} className="p-3 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center cursor-pointer">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2"><Calendar size={12} /> {month}</span>
                                    {modalExpandedMonths[month] ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                </div>
                                {modalExpandedMonths[month] && (
                                    <div className="p-2 space-y-2">
                                        {groupedLessons[month].map(lesson => (
                                            <div key={lesson.id} className={`p-2 ${lesson.isDelayed ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                                <div className="flex items-center gap-2 mb-2 pl-1">
                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{lesson.date}</span>
                                                    <span className="text-xs font-bold text-slate-700 uppercase truncate">{lesson.topic}</span>
                                                    {lesson.isDelayed && <span className="text-[9px] font-bold text-orange-500">(Qoldirildi)</span>}
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {lesson.tasks?.map((task, idx) => {
                                                        const taskName = typeof task === 'object' ? task.text : task;
                                                        const taskId = typeof task === 'object' ? task.id : null;
                                                        const key = `${lesson.id}_${taskId}`;

                                                        const score = gradeScores[key] || '';
                                                        const isSaved = savedStatus[key];
                                                        const isHighlighted = location.state?.highlightKey === key;

                                                        const lessonDate = new Date(lesson.date);
                                                        const todayStr = new Date().toISOString().split('T')[0];
                                                        const isLate = lesson.date < todayStr;

                                                        const missingDeadline = new Date(lessonDate);
                                                        missingDeadline.setDate(missingDeadline.getDate() + GRACE_PERIOD_DAYS);

                                                        let showCountdown = false;
                                                        let countdownLabel = "";
                                                        let targetDeadline = null;
                                                        let countdownType = "danger";

                                                        if (score === '' && !existingGradeDocs[key] && isLate && !lesson.isDelayed) {
                                                            showCountdown = true;
                                                            countdownLabel = "Missing";
                                                            targetDeadline = missingDeadline.toISOString();
                                                        }

                                                        const gradeObj = existingGradeObjects[key];
                                                        if (score !== '' && Number(score) < 60) {
                                                            showCountdown = true;
                                                            countdownLabel = "Retake";
                                                            countdownType = "warning";
                                                            if (gradeObj && gradeObj.retakeDeadline) {
                                                                targetDeadline = gradeObj.retakeDeadline.toDate ? gradeObj.retakeDeadline.toDate() : gradeObj.retakeDeadline;
                                                            } else {
                                                                const rtDate = new Date();
                                                                rtDate.setDate(rtDate.getDate() + RETAKE_PERIOD_DAYS);
                                                                targetDeadline = rtDate.toISOString();
                                                            }
                                                            if (gradeObj && gradeObj.status === 'retake_submitted') showCountdown = false;
                                                        }

                                                        let borderColor = "border-slate-200 focus-within:border-indigo-500";
                                                        if (score && score < 60) borderColor = "border-rose-300 bg-rose-50/30";
                                                        else if (score >= 60) borderColor = "border-emerald-300 bg-emerald-50/30";
                                                        if (isHighlighted) borderColor = "border-yellow-400 ring-2 ring-yellow-200 bg-yellow-50";

                                                        return (
                                                            <div key={idx} className={`flex flex-col gap-1 p-3 rounded-xl border transition-all ${borderColor}`}>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[11px] font-bold text-slate-600 truncate mr-2">{taskName}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="relative">
                                                                            <input
                                                                                ref={isHighlighted ? highlightRef : null}
                                                                                type="number" inputMode="numeric" min="0" max="100" placeholder="-"
                                                                                className="w-16 h-10 text-center text-lg font-black bg-white rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                                                                value={score}
                                                                                onChange={(e) => handleScoreChange(lesson.id, taskId, e.target.value)}
                                                                                onClick={(e) => e.target.select()}
                                                                            />
                                                                            {isSaved && <div className="absolute -right-6 top-3 text-emerald-500"><Check size={16} strokeWidth={3} /></div>}
                                                                        </div>
                                                                        {(score !== '' || existingGradeDocs[key]) && (
                                                                            <button type="button" onClick={() => handleDeleteGrade(lesson.id, taskId)} className="p-2.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 active:scale-90 transition-transform"><Trash2 size={16} /></button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {showCountdown && (
                                                                    <div className="mt-1 flex justify-end">
                                                                        <MiniCountdown deadline={targetDeadline} label={countdownLabel} type={countdownType} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </form>
                </div>
                <div className="p-4 bg-white border-t border-slate-100 shrink-0 z-50 relative pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <button
                        onClick={handleSaveAllGrades}
                        disabled={loading || !hasChanges}
                        className={`w-full py-4 rounded-2xl font-black shadow-xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${hasChanges ? 'bg-indigo-600 text-white shadow-indigo-200 cursor-pointer' : 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'}`}
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> O'zgarishlarni Saqlash</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GradeModal;
