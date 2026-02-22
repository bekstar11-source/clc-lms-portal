import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { LayoutGrid, AlertTriangle, MessageCircle, LogOut } from 'lucide-react';

import DashboardHeader from '../../components/dashboard/DashboardHeader';
import TeacherStats from '../../components/dashboard/TeacherStats';
import GroupListWidget from '../../components/dashboard/GroupListWidget';
import RecentActivitiesWidget from '../../components/dashboard/RecentActivitiesWidget';
import DebtorsWidget from '../../components/dashboard/DebtorsWidget';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTeacherGroups } from '../../hooks/useTeacherGroups';

const TeacherDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const {
        teacherName, groups, loading, refreshing, retakeAlerts,
        debtors, unreadMessages, handleForceRefresh, handleRejectRetakeQuery
    } = useTeacherGroups();

    const [activeTab, setActiveTab] = useState('groups');
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);

    const triggerHaptic = (type = 'tap') => {
        if (navigator.vibrate) {
            if (type === 'tap') navigator.vibrate(10);
            if (type === 'success') navigator.vibrate([10, 50, 10]);
        }
    };

    useEffect(() => {
        if (location.pathname === '/debtors') setActiveTab('debtors');
        else setActiveTab('groups');
    }, [location.pathname]);

    useEffect(() => {
        const backListener = App.addListener('backButton', () => {
            if (isExitModalOpen) { App.exitApp(); return; }
            if (activeTab !== 'groups') {
                setActiveTab('groups');
                triggerHaptic();
            } else {
                setIsExitModalOpen(true);
                triggerHaptic();
            }
        });
        return () => { backListener.then(h => h.remove()); };
    }, [activeTab, isExitModalOpen]);

    if (loading) return <LoadingSpinner />;

    return (
        <div className="min-h-screen relative font-sans touch-manipulation pb-28 md:pb-10">

            {/* BACKGROUND */}
            <div className="fixed inset-0 z-0">
                <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://github.com/user-attachments/assets/1d6178e4-9b57-4c89-bd1d-ef7d30a62448')" }}></div>
                <div className="absolute inset-0 bg-slate-50/70 backdrop-blur-sm"></div>
            </div>

            <div className="relative z-10">
                <DashboardHeader
                    teacherName={teacherName}
                    refreshing={refreshing}
                    onRefresh={handleForceRefresh}
                    unreadMessages={unreadMessages}
                    triggerHaptic={triggerHaptic}
                />

                <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
                    {/* STATS */}
                    <TeacherStats groupsCount={groups.length} debtorsCount={debtors.length} />

                    {/* GROUPS TAB */}
                    {activeTab === 'groups' && (
                        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                            <RecentActivitiesWidget
                                alerts={retakeAlerts}
                                handleRejectRetake={handleRejectRetakeQuery}
                                triggerHaptic={triggerHaptic}
                            />
                            <GroupListWidget groups={groups} triggerHaptic={triggerHaptic} />
                        </div>
                    )}

                    {/* DEBTORS TAB */}
                    {activeTab === 'debtors' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <DebtorsWidget debtors={debtors} triggerHaptic={triggerHaptic} />
                        </div>
                    )}
                </main>

                {/* BOTTOM NAVIGATION */}
                {location.pathname !== '/chat' && (
                    <div className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white/70 backdrop-blur-xl border-t border-white/40 flex justify-around py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] z-[999] shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)]">
                        <button onClick={() => { triggerHaptic(); setActiveTab('groups'); }} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 ${activeTab === 'groups' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-500'}`}><LayoutGrid size={24} strokeWidth={2.5} /><span className="text-[10px] font-black">Guruhlar</span></button>
                        <button onClick={() => { triggerHaptic(); navigate('/chat'); }} className="flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 text-slate-500 hover:text-indigo-600 relative"><MessageCircle size={24} strokeWidth={2.5} /><span className="text-[10px] font-black">Xabarlar</span>{unreadMessages > 0 && (<span className="absolute top-1 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>)}</button>
                        <button onClick={() => { triggerHaptic(); setActiveTab('debtors'); }} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95 ${activeTab === 'debtors' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-500'}`}><AlertTriangle size={24} strokeWidth={2.5} /><span className="text-[10px] font-black">Qarzdorlar</span></button>
                    </div>
                )}
            </div>

            {/* CHIQISH MODALI */}
            {isExitModalOpen && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] p-6 w-full max-w-xs shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
                        <div className="text-center mb-6"><div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3"><LogOut size={24} className="text-indigo-600 ml-1" /></div><h3 className="text-lg font-black text-slate-800 mb-1">Chiqish?</h3><p className="text-sm font-medium text-slate-500">Ilovadan chiqib ketmoqchimisiz?</p></div>
                        <div className="flex gap-3"><button onClick={() => setIsExitModalOpen(false)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors active:scale-95">Yo'q</button><button onClick={() => App.exitApp()} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">Ha, Chiqish</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherDashboard;
