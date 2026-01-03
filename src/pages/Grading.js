import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { 
  BarChart3, Calendar, Trophy, Search, ChevronDown, Clock
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

const Grading = () => {
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupData();
    }
  }, [selectedGroupId]);

  const fetchGroups = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, "groups"), where("teacherId", "==", user.uid));
    const snap = await getDocs(q);
    setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const fetchGroupData = async () => {
    setLoading(true);
    try {
      // 1. O'quvchilar
      const qS = query(collection(db, "students"), where("groupId", "==", selectedGroupId));
      const snapS = await getDocs(qS);
      const studentsList = snapS.docs.map(d => ({ id: d.id, ...d.data() }));
      // Alifbo tartibida
      studentsList.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(studentsList);

      // 2. Darslar (Sana bo'yicha)
      const qL = query(collection(db, "lessons"), where("groupId", "==", selectedGroupId), orderBy("date", "asc"));
      const snapL = await getDocs(qL);
      setLessons(snapL.docs.map(d => ({ id: d.id, ...d.data() })));

      // 3. Baholar
      const qG = query(collection(db, "grades"), where("groupId", "==", selectedGroupId));
      const snapG = await getDocs(qG);
      setGrades(snapG.docs.map(d => d.data()));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // --- LOGIKA: Har bir dars ichidagi vazifalarni alohida ustun qilish ---
  const tableColumns = useMemo(() => {
    const cols = [];
    lessons.forEach(lesson => {
      if (lesson.tasks && lesson.tasks.length > 0) {
        lesson.tasks.forEach(task => {
          cols.push({
            id: `${lesson.id}-${typeof task === 'object' ? task.text : task}`,
            lessonId: lesson.id,
            date: lesson.date,
            taskName: typeof task === 'object' ? task.text : task,
            topic: lesson.topic
          });
        });
      } else {
        // Agar vazifa bo'lmasa, umumiy darsni o'zini chiqaramiz
        cols.push({
            id: lesson.id,
            lessonId: lesson.id,
            date: lesson.date,
            taskName: 'General',
            topic: lesson.topic
        });
      }
    });
    return cols;
  }, [lessons]);

  // Bahoni olish (Student + Lesson + Task)
  const getGrade = (studentId, lessonId, taskName) => {
    const grade = grades.find(g => 
        g.studentId === studentId && 
        g.lessonId === lessonId && 
        g.taskType === taskName
    );
    return grade ? grade.score : '-';
  };

  // O'quvchining umumiy o'rtacha bahosi
  const calculateAverage = (studentId) => {
    const studentGrades = grades.filter(g => g.studentId === studentId);
    if (studentGrades.length === 0) return 0;
    
    // Faqat raqamlarni hisoblash (xatolarni oldini olish)
    const validGrades = studentGrades.map(g => Number(g.score)).filter(s => !isNaN(s));
    if (validGrades.length === 0) return 0;

    const sum = validGrades.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / validGrades.length);
  };

  // Vaqtni formatlash (So'nggi faollik uchun)
  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'No info';
    // Firebase Timestamp ni Date ga o'tkazish
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    const now = new Date();
    const diffInHours = Math.abs(now - date) / 36e5;

    if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  // Chart Data
  const chartData = students.map(s => ({
    name: s.name.split(' ')[0], 
    average: calculateAverage(s.id)
  })).sort((a, b) => b.average - a.average);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans pb-24">
      <div className="max-w-full mx-auto space-y-6">
        
        {/* HEADER & FILTER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
               <BarChart3 size={20} />
             </div>
             <div>
               <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase italic">Jurnal</h1>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Akademik Natijalar</p>
             </div>
          </div>

          <div className="relative group w-full md:w-72">
            <select 
              className="w-full appearance-none bg-white border border-slate-200 text-slate-700 text-sm font-bold py-3 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all cursor-pointer"
              onChange={(e) => setSelectedGroupId(e.target.value)}
              value={selectedGroupId}
            >
              <option value="">Guruhni tanlang...</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        {selectedGroupId ? (
          <>
            {/* ANALYTICS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* TOP STUDENTS */}
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="text-yellow-300" size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Top O'quvchilar</span>
                  </div>
                  <div className="space-y-3">
                    {chartData.slice(0, 3).map((s, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/10 p-2 rounded-xl backdrop-blur-sm border border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-white text-indigo-600 flex items-center justify-center font-black text-xs">{i + 1}</div>
                          <span className="font-bold text-sm">{s.name}</span>
                        </div>
                        <span className="font-black text-yellow-300">{s.average}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-x-10 -translate-y-10"></div>
              </div>

              {/* CHART */}
              <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm h-[300px]">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Guruh O'zlashtirishi</h3>
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="average" radius={[6, 6, 0, 0]} barSize={30}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.average >= 80 ? '#10b981' : entry.average >= 60 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* THE BIG TABLE (Horizontal Scroll & Task Based) */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-lg overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-black text-slate-800">To'liq Jurnal</h3>
                <p className="text-xs text-slate-400 font-bold mt-1">Barcha topshiriqlar va baholar tarixi</p>
              </div>
              
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {/* Fixed Column Header: O'quvchi */}
                      <th className="sticky left-0 z-20 bg-slate-50 border-b border-r border-slate-200 px-4 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[140px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                        Student
                      </th>
                      
                      {/* Scrollable Task Headers */}
                      {tableColumns.map((col, index) => (
                        <th key={index} className="px-2 py-4 border-b border-slate-100 bg-white min-w-[100px] border-r border-dashed border-slate-100">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter mb-1">{col.date.slice(5)}</span>
                            {/* Task Name */}
                            <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wide truncate max-w-[90px]" title={col.taskName}>
                                {col.taskName}
                            </span>
                          </div>
                        </th>
                      ))}
                      
                      <th className="px-4 py-4 border-b border-slate-100 bg-slate-50 text-center text-[10px] font-black text-emerald-600 uppercase tracking-widest min-w-[80px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const avg = calculateAverage(student.id);
                      // Ismni 2 ga bo'lish
                      const nameParts = student.name.split(' ');
                      const firstName = nameParts[0];
                      const lastName = nameParts.slice(1).join(' ');

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Fixed Name Column */}
                          <td className="sticky left-0 z-10 bg-white border-r border-slate-100 px-3 py-3 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-700 text-sm leading-tight">{firstName}</span>
                                <span className="text-[10px] text-slate-400 font-bold leading-tight mb-1.5">{lastName}</span>
                                
                                {/* SO'NGI FAOLLIK */}
                                <div className="flex items-center gap-1 text-[9px] text-indigo-400 bg-indigo-50 w-fit px-1.5 py-0.5 rounded">
                                    <Clock size={10} />
                                    <span>{formatLastSeen(student.lastLogin)}</span>
                                </div>
                            </div>
                          </td>
                          
                          {/* Task Grades */}
                          {tableColumns.map((col, index) => {
                            const score = getGrade(student.id, col.lessonId, col.taskName);
                            let scoreColor = 'text-slate-300'; 
                            let bgClass = '';

                            if (score !== '-') {
                                const numScore = Number(score);
                                if (numScore >= 80) { scoreColor = 'text-emerald-600'; bgClass = 'bg-emerald-50'; }
                                else if (numScore >= 60) { scoreColor = 'text-amber-500'; bgClass = 'bg-amber-50'; }
                                else { scoreColor = 'text-red-500'; bgClass = 'bg-red-50'; }
                            }

                            return (
                              <td key={index} className="px-2 py-3 text-center border-b border-r border-dashed border-slate-100">
                                <div className={`inline-flex items-center justify-center w-10 h-8 rounded-lg font-black text-sm ${bgClass} ${scoreColor}`}>
                                  {score}
                                </div>
                              </td>
                            );
                          })}
                          
                          {/* Average Column */}
                          <td className="px-4 py-3 text-center border-b border-slate-50">
                            <span className={`inline-block px-2 py-1 rounded-lg font-black text-xs ${avg >= 80 ? 'text-white bg-emerald-500' : avg >= 60 ? 'text-white bg-amber-400' : 'text-white bg-red-400'}`}>
                              {avg}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {students.length === 0 && (
                <div className="p-10 text-center text-slate-400 font-bold text-sm italic">
                  Ma'lumotlar topilmadi.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-[50vh] bg-white rounded-[3rem] border border-slate-100 text-center p-8">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <Search className="text-indigo-500" size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Jurnalni ochish</h3>
            <p className="text-slate-400 max-w-xs">Natijalarni ko'rish uchun yuqoridagi ro'yxatdan guruhni tanlang.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Grading;