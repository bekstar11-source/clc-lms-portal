import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { AlertTriangle, Trash2, Loader2, CheckCircle, RefreshCw, FileWarning } from 'lucide-react';

const SystemHealth = () => {
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState([]); // Duplikatlar va Yetim baholar

  const checkSystem = async () => {
    setLoading(true);
    setIssues([]);
    
    try {
      // 1. Barcha kerakli ma'lumotlarni yuklaymiz
      const [gradesSnap, lessonsSnap, studentsSnap] = await Promise.all([
        getDocs(collection(db, "grades")),
        getDocs(collection(db, "lessons")),
        getDocs(collection(db, "students"))
      ]);

      const grades = gradesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Oson qidirish uchun Map qilamiz
      const lessonMap = {};
      lessonsSnap.forEach(d => { lessonMap[d.id] = { id: d.id, ...d.data() } });
      
      const studentMap = {};
      studentsSnap.forEach(d => { studentMap[d.id] = d.data() });

      const foundIssues = [];

      // --- 1. DUPLIKATLARNI TEKSHIRISH ---
      const gradeGroups = {};
      grades.forEach(g => {
        const key = `${g.studentId}-${g.lessonId}-${g.taskType}`;
        if (!gradeGroups[key]) gradeGroups[key] = [];
        gradeGroups[key].push(g);
      });

      Object.values(gradeGroups).forEach(group => {
        if (group.length > 1) {
          const first = group[0];
          foundIssues.push({
            type: 'duplicate',
            title: "Duplikat Baho",
            desc: "Bitta vazifaga bir nechta baho qo'yilgan",
            studentName: studentMap[first.studentId]?.name || "Noma'lum",
            lessonTopic: lessonMap[first.lessonId]?.topic || "Noma'lum dars",
            taskType: first.taskType,
            items: group // O'chirish uchun
          });
        }
      });

      // --- 2. YETIM BAHOLARNI (DELETED TASKS) TEKSHIRISH ---
      grades.forEach(grade => {
        const lesson = lessonMap[grade.lessonId];
        
        let isOrphan = false;
        let reason = "";

        if (!lesson) {
          isOrphan = true;
          reason = "Dars butunlay o'chirilgan";
        } else {
          // Dars bor, lekin ichida bu vazifa bormi?
          const taskExists = lesson.tasks?.some(t => {
            const tName = typeof t === 'string' ? t : t.text;
            return tName === grade.taskType;
          });
          
          if (!taskExists) {
            isOrphan = true;
            reason = `"${grade.taskType}" vazifasi darsdan o'chirilgan`;
          }
        }

        if (isOrphan) {
          foundIssues.push({
            type: 'orphan',
            title: "Keraksiz Baho (Orphan)",
            desc: reason,
            studentName: studentMap[grade.studentId]?.name || "Noma'lum",
            lessonTopic: lesson ? lesson.topic : "O'chirilgan Dars ID: " + grade.lessonId,
            taskType: grade.taskType,
            items: [grade]
          });
        }
      });

      setIssues(foundIssues);

    } catch (error) {
      console.error(error);
      alert("Tekshirishda xatolik: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fixIssue = async (issue, itemIndex, gradeId) => {
    if(!window.confirm("Bu noto'g'ri bahoni bazadan o'chirmoqchimisiz?")) return;
    try {
      await deleteDoc(doc(db, "grades", gradeId));
      
      // Ekrandan olib tashlash
      const newIssues = [...issues];
      newIssues[itemIndex].items = newIssues[itemIndex].items.filter(i => i.id !== gradeId);
      
      if (newIssues[itemIndex].items.length === 0 || (newIssues[itemIndex].type === 'duplicate' && newIssues[itemIndex].items.length === 1)) {
         newIssues.splice(itemIndex, 1);
      }
      setIssues(newIssues);
      
    } catch (e) { alert("Xatolik: " + e.message); }
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-rose-100 shadow-sm mb-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                <AlertTriangle size={24} />
            </div>
            <div>
                <h3 className="text-lg font-black text-slate-800">Tizim Salomatligi</h3>
                <p className="text-xs text-slate-400 font-bold">Duplikatlar va O'chirilgan vazifa baholari</p>
            </div>
        </div>
        <button 
            onClick={checkSystem} 
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-700 active:scale-95 transition shadow-lg shadow-slate-200"
        >
            {loading ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
            {loading ? "Tekshirilmoqda..." : "Tekshirish"}
        </button>
      </div>

      <div className="space-y-4">
        {issues.length === 0 && !loading && (
            <div className="text-center p-6 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-600 font-bold flex flex-col items-center gap-2">
                <CheckCircle size={32}/>
                Muammolar topilmadi! Baza toza.
            </div>
        )}

        {issues.map((issue, idx) => (
            <div key={idx} className={`border rounded-2xl overflow-hidden ${issue.type === 'orphan' ? 'border-orange-200' : 'border-rose-200'}`}>
                <div className={`p-4 flex justify-between items-center ${issue.type === 'orphan' ? 'bg-orange-50' : 'bg-rose-50'}`}>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {issue.type === 'orphan' ? <FileWarning size={16} className="text-orange-500"/> : <AlertTriangle size={16} className="text-rose-500"/>}
                            <h4 className={`font-black text-sm ${issue.type === 'orphan' ? 'text-orange-700' : 'text-rose-700'}`}>{issue.title}</h4>
                        </div>
                        <p className="text-xs text-slate-600 font-medium">{issue.desc}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-slate-800 text-xs">{issue.studentName}</p>
                        <p className="text-[10px] text-slate-500">{issue.lessonTopic}</p>
                    </div>
                </div>

                <div className="bg-white p-2 space-y-2">
                    {issue.items.map((grade) => (
                        <div key={grade.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3">
                                <span className="font-black text-sm text-indigo-600">{grade.score}%</span>
                                <div className="text-[10px] text-slate-400">
                                    <p><span className="font-bold">Vazifa:</span> {grade.taskType}</p>
                                    <p>ID: {grade.id}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => fixIssue(issue, idx, grade.id)}
                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                title="O'chirish"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default SystemHealth;