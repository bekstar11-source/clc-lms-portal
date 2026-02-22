import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

const AddStudentModal = ({
    isAddStudentOpen,
    setIsAddStudentOpen,
    groupId,
    fetchData
}) => {
    const [addMode, setAddMode] = useState('single');
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentEmail, setNewStudentEmail] = useState('');
    const [bulkText, setBulkText] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSingleAdd = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await addDoc(collection(db, "students"), {
                name: newStudentName,
                email: newStudentEmail,
                groupId,
                joinedAt: serverTimestamp(),
                gameXp: 0,
                role: 'student'
            });
            setIsAddStudentOpen(false);
            setNewStudentName('');
            setNewStudentEmail('');
            fetchData(true);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkAdd = async () => {
        if (!bulkText.trim()) return;
        setLoading(true);
        try {
            const lines = bulkText.split('\n').filter(l => l.includes(','));
            await Promise.all(lines.map(line => {
                const [name, email] = line.split(',').map(s => s.trim());
                return addDoc(collection(db, "students"), {
                    name,
                    email,
                    groupId,
                    joinedAt: serverTimestamp(),
                    gameXp: 0,
                    role: 'student'
                });
            }));
            setBulkText('');
            setIsAddStudentOpen(false);
            fetchData(true);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isAddStudentOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddStudentOpen(false)}></div>
            <div className="bg-white w-full sm:w-auto sm:min-w-[400px] rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
                <h3 className="text-xl font-black text-slate-800 mb-6 uppercase text-center italic">Yangi O'quvchi</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                    <button onClick={() => setAddMode('single')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${addMode === 'single' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Bittalab</button>
                    <button onClick={() => setAddMode('bulk')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${addMode === 'bulk' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Ko'plab</button>
                </div>
                {addMode === 'single' ? (
                    <div className="space-y-4">
                        <input type="text" placeholder="Ism Familiya" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} />
                        <input type="email" placeholder="Email (Ixtiyoriy)" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" value={newStudentEmail} onChange={e => setNewStudentEmail(e.target.value)} />
                    </div>
                ) : (
                    <textarea placeholder="Ali Valiyev, ali@gmail.com" className="w-full h-32 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none" value={bulkText} onChange={e => setBulkText(e.target.value)}></textarea>
                )}
                <button onClick={addMode === 'single' ? handleSingleAdd : handleBulkAdd} disabled={loading} className="w-full mt-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg active:scale-95 transition-transform disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin mx-auto" /> : "Qo'shish"}
                </button>
            </div>
        </div>
    );
};

export default AddStudentModal;
