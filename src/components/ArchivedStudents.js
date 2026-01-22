import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { RefreshCcw, Trash2, ArchiveRestore, X, Search } from 'lucide-react';

const ArchivedStudents = ({ onClose }) => {
  const [archivedList, setArchivedList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Arxivdagi o'quvchilarni yuklash
  const fetchArchived = async () => {
    setLoading(true);
    try {
      // Faqat isArchived: true bo'lganlarni qidiramiz
      const q = query(collection(db, "students"), where("isArchived", "==", true));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setArchivedList(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchived();
  }, []);

  // 1. Qayta tiklash (Restore)
  const handleRestore = async (id) => {
    if(!window.confirm("O'quvchini asosiy ro'yxatga qaytarasizmi?")) return;
    try {
      await updateDoc(doc(db, "students", id), {
        isArchived: false, // Arxivdan chiqaramiz
        archivedAt: null
      });
      fetchArchived(); // Ro'yxatni yangilash
    } catch (e) { alert(e.message); }
  };

  // 2. Butunlay o'chirish (Hard Delete)
  const handlePermanentDelete = async (id) => {
    if(!window.confirm("DIQQAT! Bu o'quvchi butunlay o'chiriladi va uni qaytarib bo'lmaydi. Rozimisiz?")) return;
    try {
      await deleteDoc(doc(db, "students", id));
      fetchArchived();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-2xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <ArchiveRestore className="text-orange-500"/> Arxiv (O'chirilganlar)
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20}/>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {loading ? (
            <div className="text-center py-10 text-slate-400">Yuklanmoqda...</div>
          ) : archivedList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
              <ArchiveRestore size={48} className="mb-2"/>
              <p>Arxiv bo'sh</p>
            </div>
          ) : (
            archivedList.map(student => (
              <div key={student.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-all">
                <div>
                  <h3 className="font-bold text-slate-800">{student.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {student.archivedAt ? new Date(student.archivedAt).toLocaleDateString() : "Sana yo'q"} da arxivlangan
                  </p>
                  <p className="text-xs text-indigo-500 font-bold">{student.groupName || "Guruhsiz"}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Tiklash tugmasi */}
                  <button 
                    onClick={() => handleRestore(student.id)}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors flex items-center gap-2 font-bold text-xs"
                  >
                    <RefreshCcw size={16}/> <span className="hidden sm:inline">Tiklash</span>
                  </button>

                  {/* Butunlay o'chirish */}
                  <button 
                    onClick={() => handlePermanentDelete(student.id)}
                    className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                    title="Butunlay o'chirish"
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchivedStudents;