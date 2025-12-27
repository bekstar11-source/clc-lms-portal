import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, TrendingUp, BookOpen, Award, 
  Calendar, CheckCircle, Loader2, ListTodo, 
  ChevronRight, ArrowUpRight, LayoutGrid, Table as TableIcon, Clock, Star
} from 'lucide-react';
import { db, auth } from '../firebase';
import { 
  collection, query, where, getDocs, 
  orderBy 
} from 'firebase/firestore'; 
import { signOut } from 'firebase/auth';
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [grades, setGrades] = useState([]);
  const [lessons, setLessons] = useState([]);
  
  // Tablar: 'dashboard', 'schedule', 'grades'
  const [activeTab, setActiveTab] = useState('dashboard'); 

  useEffect(() => {
    const fetchStudentData = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate('/');
        return;
      }

      try {
        const qS = query(collection(db, "students"), where("email", "==", user.email));
        const snapS = await getDocs(qS);

        if (snapS.empty) {
          setLoading(false);
          return;
        }

        const studentDoc = snapS.docs[0];
        const studentData = { id: studentDoc.id, ...studentDoc.data() };
        setStudent(studentData);

        // Baholarni yuklash
        const gradesQuery = query(
          collection(db, "grades"), 
          where("studentId", "==", studentData.id),
          orderBy("date", "asc")
        );
        const gradesSnapshot = await getDocs(gradesQuery);
        const gradesData = gradesSnapshot.docs.map(doc => ({
          ...doc.data(),
          dateStr: doc.data().date ? doc.data().date.toDate().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : ''
        }));
        setGrades(gradesData);

        // Darslarni yuklash
        const lessonsQuery = query(
          collection(db, "lessons"),
          where("groupId", "==", studentData.groupId),
          orderBy("date", "desc") 
        );
        const lessonsSnapshot = await getDocs(lessonsQuery);
        setLessons(lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (error) {
        console.error("Xatolik:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Chiqishda xatolik:", error);
    }
  };

  const getLessonStatus = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) return { label: 'Bugun', color: 'bg-emerald-100 text-emerald-700' };
    if (dateStr > today) return { label: 'Rejada', color: 'bg-indigo-50 text-indigo-600' };
    return { label: 'O\'tdi', color: 'bg-slate-100 text-slate-500' };
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;

  if (!student) return <div className="min-h-screen flex items-center justify-center">Guruh topilmadi.</div>;

  const averageScore = grades.length > 0 ? Math.round(grades.reduce((acc, curr) => acc + curr.score, 0) / grades.length) : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-6 sm:px-12 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black italic shadow-lg">S</div>
          <div>
            <span className="font-black text-slate-800 text-lg block leading-none">Student Portal</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CLC Academy</span>
          </div>
        </div>
        
        {/* VIEW TOGGLER (O'rtadagi menyu) - YANGILANDI */}
        <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LayoutGrid size={16} /> <span>Umumiy</span>
          </button>
          <button 
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'schedule' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <TableIcon size={16} /> <span>Jadval</span>
          </button>
          {/* YANGI TUGMA */}
          <button 
            onClick={() => setActiveTab('grades')}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'grades' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Star size={16} /> <span>Baholar</span>
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-black text-slate-700">{student.name}</p>
          </div>
          <button onClick={handleLogout} className="p-3 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-2xl transition-all"><LogOut size={20} /></button>
        </div>
      </nav>

      {/* Mobile Toggler */}
      <div className="md:hidden px-6 pt-6 pb-2">
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
           <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Umumiy</button>
           <button onClick={() => setActiveTab('schedule')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'schedule' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Jadval</button>
           <button onClick={() => setActiveTab('grades')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'grades' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Baholar</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-10">
        
        {/* 1-KO'RINISH: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Chap tomon */}
            <div className="lg:col-span-2 space-y-10">
              <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-[3rem] p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                 <div className="relative z-10">
                  <span className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6 inline-block">Overview</span>
                  <h1 className="text-4xl font-black mb-4">Salom, {student.name.split(' ')[0]}!</h1>
                  <p className="text-indigo-100 mb-8 max-w-md font-medium">Barcha natijalaringiz va o'quv rejangizni kuzatib boring.</p>
                  <div className="flex gap-4">
                     <div className="bg-white/10 px-6 py-3 rounded-2xl"><p className="text-[10px] uppercase opacity-70">Baholar</p><p className="text-2xl font-black">{grades.length}</p></div>
                     <div className="bg-white/10 px-6 py-3 rounded-2xl"><p className="text-[10px] uppercase opacity-70">Darslar</p><p className="text-2xl font-black">{lessons.length}</p></div>
                  </div>
                 </div>
                 <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
              </div>

              {/* Chart */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-slate-800">Progress Grafigi</h3>
                  <TrendingUp className="text-indigo-500" />
                </div>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={grades}>
                      <defs><linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/><stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="dateStr" stroke="#94A3B8" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={10} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={4} fill="url(#scoreGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* O'ng tomon: SO'NGGI BAHOLAR (Yangilangan) */}
            <div className="space-y-8">
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 text-center shadow-lg">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Umumiy Reyting</p>
                  <h2 className="text-6xl font-black text-slate-800">{averageScore}<span className="text-xl text-indigo-400">%</span></h2>
               </div>
               
               <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                 <h3 className="text-lg font-black text-slate-800 mb-4 px-2">So'nggi Baholar</h3>
                 <div className="space-y-3">
                    {grades.slice(-4).reverse().map((g, i) => (
                      <div key={i} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
                        <div className="flex-1 min-w-0 pr-2">
                          {/* YANGI: Mavzu nomi + Vazifa turi */}
                          <p className="font-bold text-slate-700 text-sm truncate">{g.comment || 'Mavzu'}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wide truncate">
                               {g.taskType || 'Vazifa'}
                             </span>
                             <span className="text-[9px] text-slate-400 uppercase">{g.dateStr}</span>
                          </div>
                        </div>
                        <div className={`font-black text-lg ${g.score >= 80 ? 'text-emerald-500' : 'text-indigo-500'}`}>{g.score}</div>
                      </div>
                    ))}
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* 2-KO'RINISH: JADVAL (SCHEDULE) */}
        {activeTab === 'schedule' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <div>
                   <h2 className="text-2xl font-black text-slate-800 tracking-tight">Dars Jadvali & Vazifalar</h2>
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">To'liq kurs rejasi</p>
                 </div>
                 <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center text-xs font-bold text-slate-500">
                   <Calendar size={14} className="mr-2 text-indigo-500" /> {lessons.length} ta dars
                 </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-8 py-6 w-32">Sana / Status</th>
                      <th className="px-8 py-6 w-1/3">Mavzu</th>
                      <th className="px-8 py-6">Berilgan Vazifalar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {lessons.map((lesson) => {
                      const status = getLessonStatus(lesson.date);
                      return (
                        <tr key={lesson.id} className="hover:bg-indigo-50/30 transition-colors group">
                          <td className="px-8 py-6 align-top">
                            <div className="flex flex-col items-start">
                              <span className="font-black text-slate-800 text-sm mb-2">{lesson.date}</span>
                              <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${status.color}`}>{status.label}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 align-top">
                             <h4 className="font-black text-slate-800 text-base mb-1 group-hover:text-indigo-600 transition-colors">{lesson.topic}</h4>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center"><Clock size={10} className="mr-1" /> CLC Academy Module</p>
                          </td>
                          <td className="px-8 py-6 align-top">
                            <div className="flex flex-wrap gap-2">
                              {lesson.tasks && lesson.tasks.length > 0 ? (
                                lesson.tasks.map((task, idx) => {
                                  const taskText = typeof task === 'object' ? task.text : task;
                                  return (
                                    <div key={idx} className="bg-white border border-slate-200 px-4 py-3 rounded-2xl flex items-center shadow-sm group-hover:border-indigo-200 transition-colors">
                                       <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-3"></div>
                                       <span className="text-sm font-bold text-slate-600">{taskText}</span>
                                    </div>
                                  );
                                })
                              ) : <span className="text-slate-400 text-xs italic bg-slate-50 px-3 py-1 rounded-lg">Vazifa yo'q</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3-KO'RINISH: BARCHA BAHOLAR (NEW GRADES TAB) */}
        {activeTab === 'grades' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                   <div>
                     <h2 className="text-2xl font-black text-slate-800 tracking-tight">Akademik Jurnal</h2>
                     <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Barcha baholaringiz tarixi</p>
                   </div>
                   <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center text-xs font-bold text-slate-500">
                     <Award size={14} className="mr-2 text-emerald-500" /> {grades.length} ta baho
                   </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-8 py-6">Sana</th>
                        <th className="px-8 py-6">Mavzu</th>
                        <th className="px-8 py-6">Vazifa Turi</th>
                        <th className="px-8 py-6 text-right">Baho (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {[...grades].reverse().map((grade, idx) => ( // Eng yangisi tepada turishi uchun reverse qilamiz
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-6 font-bold text-slate-500 text-sm">{grade.dateStr}</td>
                          <td className="px-8 py-6 font-black text-slate-800 text-base">{grade.comment}</td>
                          <td className="px-8 py-6">
                            <span className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
                              {grade.taskType}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <span className={`text-lg font-black ${grade.score >= 80 ? 'text-emerald-500' : grade.score >= 60 ? 'text-indigo-500' : 'text-red-500'}`}>
                              {grade.score}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {grades.length === 0 && (
                        <tr>
                          <td colSpan="4" className="text-center py-20 text-slate-400 font-bold text-sm italic">
                            Hozircha baholar yo'q
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default StudentDashboard;