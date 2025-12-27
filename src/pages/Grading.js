import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Award, Filter, Users, Table as TableIcon, LayoutGrid, ChevronRight } from 'lucide-react';

const Grading = () => {
  const [viewType, setViewType] = useState('journal'); // 'journal' yoki 'rating'
  const [leaderboard, setLeaderboard] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [lessons, setLessons] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Ustozning guruhlarini yuklash
  useEffect(() => {
    const fetchInitialData = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const groupsQuery = query(collection(db, "groups"), where("teacherId", "==", user.uid));
        const groupsSnap = await getDocs(groupsQuery);
        const groupsList = groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGroups(groupsList);
        if (groupsList.length > 0) setSelectedGroup(groupsList[0].id);
      } catch (e) { console.error(e); }
    };
    fetchInitialData();
  }, []);

  // 2. Tanlangan guruh ma'lumotlarini yuklash
  useEffect(() => {
    if (!selectedGroup) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // O'quvchilar
        const studentsSnap = await getDocs(query(collection(db, "students"), where("groupId", "==", selectedGroup)));
        const studentsList = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Darslar (Ustunlar uchun)
        const lessonsSnap = await getDocs(query(collection(db, "lessons"), where("groupId", "==", selectedGroup), orderBy("date", "asc")));
        const lessonsList = lessonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLessons(lessonsList);

        // Baholar
        const gradesSnap = await getDocs(query(collection(db, "grades"), where("groupId", "==", selectedGroup)));
        const gradesList = gradesSnap.docs.map(doc => doc.data());
        setGrades(gradesList);

        // Reyting hisoblash
        const studentStats = studentsList.map(student => {
          const studentGrades = gradesList.filter(g => g.studentId === student.id);
          const total = studentGrades.reduce((acc, curr) => acc + curr.score, 0);
          const avg = studentGrades.length > 0 ? Math.round(total / studentGrades.length) : 0;
          return { ...student, avg, count: studentGrades.length };
        }).sort((a, b) => b.avg - a.avg);

        setLeaderboard(studentStats);
      } catch (error) {
        console.error("Xatolik:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedGroup]);

  // Jurnal uchun ma'lum katakdagi barcha baholarni olish
  const getStudentLessonGrades = (studentId, topic) => {
    return grades.filter(g => g.studentId === studentId && g.comment === topic);
  };

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-8 font-sans pb-20">
      
      {/* Yuqori qism: Navigatsiya va Filtrlar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none">Akademik Nazorat</h1>
          <div className="flex items-center space-x-2 mt-4">
            <button 
              onClick={() => setViewType('journal')}
              className={`flex items-center px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${viewType === 'journal' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
            >
              <TableIcon size={14} className="mr-2" /> Jurnal Ko'rinishi
            </button>
            <button 
              onClick={() => setViewType('rating')}
              className={`flex items-center px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${viewType === 'rating' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
            >
              <LayoutGrid size={14} className="mr-2" /> Umumiy Reyting
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 bg-white p-2.5 rounded-[1.5rem] border border-slate-200 shadow-sm w-full lg:w-fit">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Filter size={18} /></div>
          <select 
            value={selectedGroup} 
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="bg-transparent border-none outline-none font-black text-slate-700 pr-10 cursor-pointer text-sm flex-1 lg:flex-none"
          >
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-40 text-center">
            <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Ma'lumotlar yuklanmoqda...</p>
        </div>
      ) : viewType === 'journal' ? (
        
        /* JURNAL KO'RINISHI (DETAILED STYLE) */
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="sticky left-0 z-30 bg-slate-50 px-8 py-8 text-left min-w-[240px] border-r border-slate-200 shadow-[4px_0_10px_rgba(0,0,0,0.03)]">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">O'quvchilar</span>
                  </th>
                  {lessons.map((lesson) => (
                    <th key={lesson.id} className="px-4 py-8 text-center min-w-[150px] border-r border-slate-100 last:border-0 group">
                      <p className="text-[10px] font-black text-indigo-500 uppercase mb-2 tracking-tighter opacity-60">{lesson.date}</p>
                      <p className="text-xs font-black text-slate-700 leading-tight line-clamp-2 uppercase group-hover:text-indigo-600 transition-colors">{lesson.topic}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderboard.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 px-8 py-6 font-black text-slate-700 border-r border-slate-200 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px]">{student.name.charAt(0)}</div>
                        <span>{student.name}</span>
                      </div>
                    </td>
                    {lessons.map((lesson) => {
                      const lessonGrades = getStudentLessonGrades(student.id, lesson.topic);
                      return (
                        <td key={lesson.id} className="px-3 py-6 text-center border-r border-slate-50 last:border-0">
                          <div className="flex flex-wrap justify-center gap-2">
                            {lessonGrades.length > 0 ? (
                              lessonGrades.map((g, idx) => (
                                <div 
                                  key={idx} 
                                  title={`${g.taskType}: ${g.score}%`}
                                  className={`min-w-[42px] p-1.5 rounded-xl border flex flex-col items-center justify-center shadow-sm transition-transform hover:scale-110 ${
                                    g.score >= 85 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                                    g.score >= 60 ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 
                                    'bg-red-50 border-red-100 text-red-600'
                                  }`}
                                >
                                  <span className="text-[11px] font-black leading-none">{g.score}</span>
                                  <span className="text-[7px] font-black uppercase mt-1 opacity-50 truncate w-full text-center">
                                    {g.taskType.substring(0, 3)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span className="text-slate-100 font-black text-lg">-</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lessons.length === 0 && (
            <div className="p-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest bg-white">
              Guruhda hali darslar rejasi yo'q
            </div>
          )}
        </div>

      ) : (
        
        /* REYTING KO'RINISHI (RATING STYLE) */
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-xl">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-10 py-6">O'rin</th>
                  <th className="px-10 py-6">O'quvchi</th>
                  <th className="px-10 py-6 text-center">O'rtacha Ball</th>
                  <th className="px-10 py-6 text-center">Vazifalar Soni</th>
                  <th className="px-10 py-6">Umumiy Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                {leaderboard.map((student, index) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-all group">
                    <td className="px-10 py-6 text-center">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg ${index === 0 ? 'bg-amber-100 text-amber-600 shadow-amber-100' : index === 1 ? 'bg-slate-100 text-slate-500' : 'text-slate-300'}`}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-10 py-6">
                       <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-indigo-600">{student.name.charAt(0)}</div>
                        <span className="text-lg tracking-tight">{student.name}</span>
                       </div>
                    </td>
                    <td className="px-10 py-6 text-center">
                      <span className={`px-5 py-2 rounded-2xl font-black text-lg shadow-sm ${student.avg >= 85 ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>{student.avg}%</span>
                    </td>
                    <td className="px-10 py-6 text-center text-slate-400 uppercase text-[10px] tracking-widest">
                        {student.count} ta baho
                    </td>
                    <td className="px-10 py-6 min-w-[200px]">
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner">
                        <div className={`h-full transition-all duration-1000 ${student.avg >= 85 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${student.avg}%` }}></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Grading;