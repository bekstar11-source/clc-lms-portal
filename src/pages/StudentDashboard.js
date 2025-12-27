import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, TrendingUp, Award, Calendar, Loader2, 
  LayoutGrid, Table as TableIcon, Clock, Star, Users 
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore'; // doc va getDoc qo'shildi
import { signOut } from 'firebase/auth';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [groupName, setGroupName] = useState(''); // <-- YANGI STATE: Guruh nomi uchun
  const [grades, setGrades] = useState([]);
  const [lessons, setLessons] = useState([]);
  
  const [activeTab, setActiveTab] = useState('dashboard'); 

  useEffect(() => {
    const fetchStudentData = async () => {
      const user = auth.currentUser;
      if (!user) { navigate('/'); return; }

      try {
        // 1. O'quvchini topish
        const qS = query(collection(db, "students"), where("email", "==", user.email));
        const snapS = await getDocs(qS);

        if (snapS.empty) { setLoading(false); return; }

        const studentDoc = snapS.docs[0];
        const studentData = { id: studentDoc.id, ...studentDoc.data() };
        setStudent(studentData);

        // --- YANGI QISM: Guruh nomini olish ---
        if (studentData.groupId) {
          const groupRef = doc(db, "groups", studentData.groupId);
          const groupSnap = await getDoc(groupRef);
          if (groupSnap.exists()) {
            setGroupName(groupSnap.data().name);
          } else {
            setGroupName("Guruh o'chirilgan");
          }
        } else {
          setGroupName("Guruhsiz");
        }
        // -------------------------------------

        // Baholarni yuklash
        const gradesQuery = query(collection(db, "grades"), where("studentId", "==", studentData.id), orderBy("date", "asc"));
        const gradesSnapshot = await getDocs(gradesQuery);
        const gradesData = gradesSnapshot.docs.map(doc => ({
          ...doc.data(),
          dateStr: doc.data().date ? doc.data().date.toDate().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : ''
        }));
        setGrades(gradesData);

        // Darslarni yuklash
        const lessonsQuery = query(collection(db, "lessons"), where("groupId", "==", studentData.groupId), orderBy("date", "desc"));
        const lessonsSnapshot = await getDocs(lessonsQuery);
        setLessons(lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (error) { console.error("Xatolik:", error); } 
      finally { setLoading(false); }
    };
    fetchStudentData();
  }, [navigate]);

  const handleLogout = async () => {
    if(window.confirm("Chiqmoqchimisiz?")) {
      await signOut(auth);
      navigate('/');
    }
  };

  const getLessonStatus = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) return { label: 'Bugun', color: 'bg-emerald-100 text-emerald-700' };
    if (dateStr > today) return { label: 'Rejada', color: 'bg-indigo-50 text-indigo-600' };
    return { label: 'O\'tdi', color: 'bg-slate-100 text-slate-500' };
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;
  if (!student) return <div className="min-h-screen flex items-center justify-center">Ma'lumot topilmadi.</div>;

  const averageScore = grades.length > 0 ? Math.round(grades.reduce((acc, curr) => acc + curr.score, 0) / grades.length) : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      
      {/* Navbar (Sticky) */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg shadow-indigo-200 text-sm">
            {student.name.charAt(0)}
          </div>
          <div>
            <span className="font-black text-slate-800 text-sm block leading-none">{student.name.split(' ')[0]}</span>
            {/* YANGI: Guruh nomi Navbarda */}
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center mt-0.5">
              {groupName}
            </span>
          </div>
        </div>
        
        <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-xl transition-all">
          <LogOut size={18} />
        </button>
      </nav>

      {/* MOBILE TAB SWITCHER */}
      <div className="px-4 pt-4 pb-2 sticky top-[60px] z-40 bg-slate-50">
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
           <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>Umumiy</button>
           <button onClick={() => setActiveTab('schedule')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'schedule' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>Jadval</button>
           <button onClick={() => setActiveTab('grades')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'grades' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>Baholar</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        
        {/* 1-KO'RINISH: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Welcome Card - YANGILANDI */}
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-[2rem] p-6 sm:p-10 text-white relative overflow-hidden shadow-xl shadow-indigo-200">
               <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                   <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em]">Student Portal</span>
                   {/* YANGI: Guruh Badge */}
                   <span className="bg-amber-400/20 text-amber-300 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-400/30 flex items-center gap-1">
                      <Users size={10} /> {groupName}
                   </span>
                </div>
                
                <h1 className="text-2xl sm:text-4xl font-black mb-2">Salom, {student.name.split(' ')[0]}!</h1>
                <p className="text-indigo-100 mb-6 text-sm sm:text-base font-medium opacity-90">Siz hozir <b>{groupName}</b> guruhi bo'yicha ta'lim olyapsiz.</p>
                
                <div className="flex gap-3">
                   <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10"><p className="text-[9px] uppercase opacity-70">Baholar</p><p className="text-xl font-black">{grades.length}</p></div>
                   <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10"><p className="text-[9px] uppercase opacity-70">Darslar</p><p className="text-xl font-black">{lessons.length}</p></div>
                </div>
               </div>
               <div className="absolute -right-5 -bottom-5 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            </div>

            {/* Total Rating */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 text-center shadow-lg">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Umumiy Reyting</p>
               <h2 className="text-5xl font-black text-slate-800">{averageScore}<span className="text-lg text-indigo-400 ml-1">%</span></h2>
            </div>

            {/* Chart */}
            <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 mb-4 px-2">Progress</h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={grades}>
                    <defs><linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/><stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="dateStr" stroke="#94A3B8" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={10} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                    <Area type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={3} fill="url(#scoreGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Last Grades List */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-slate-800 px-2">So'nggi Baholar</h3>
              {grades.slice(-4).reverse().map((g, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-100 shadow-sm">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-slate-700 text-xs truncate">{g.comment || 'Mavzu'}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wide truncate">{g.taskType}</span>
                        <span className="text-[8px] text-slate-400 uppercase">{g.dateStr}</span>
                    </div>
                  </div>
                  <div className={`font-black text-base ${g.score >= 80 ? 'text-emerald-500' : 'text-indigo-500'}`}>{g.score}%</div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* 2-KO'RINISH: JADVAL (O'zgarishsiz) */}
        {activeTab === 'schedule' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-lg overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                 <h2 className="text-lg font-black text-slate-800">Dars Jadvali</h2>
                 <p className="text-slate-400 text-[10px] font-bold uppercase mt-1">Jami: {lessons.length} ta dars</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-4 py-4 w-24">Sana</th>
                      <th className="px-4 py-4 w-1/3">Mavzu</th>
                      <th className="px-4 py-4">Vazifalar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-sans">
                    {lessons.map((lesson) => {
                      const status = getLessonStatus(lesson.date);
                      return (
                        <tr key={lesson.id} className="group">
                          <td className="px-4 py-4 align-top">
                            <span className="font-bold text-slate-800 text-xs block mb-1">{lesson.date}</span>
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${status.color}`}>{status.label}</span>
                          </td>
                          <td className="px-4 py-4 align-top">
                             <h4 className="font-black text-slate-700 text-sm mb-1">{lesson.topic}</h4>
                             <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center"><Clock size={9} className="mr-1" /> Module</p>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-wrap gap-1.5">
                              {lesson.tasks && lesson.tasks.length > 0 ? (
                                lesson.tasks.map((task, idx) => (
                                  <div key={idx} className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg flex items-center">
                                     <div className="w-1 h-1 rounded-full bg-indigo-500 mr-1.5"></div>
                                     <span className="text-[10px] font-bold text-slate-600">{typeof task === 'object' ? task.text : task}</span>
                                  </div>
                                ))
                              ) : <span className="text-slate-300 text-[10px] italic">Yo'q</span>}
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

        {/* 3-KO'RINISH: BAHOLAR (O'zgarishsiz) */}
        {activeTab === 'grades' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-white rounded-[2rem] border border-slate-100 shadow-lg overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                   <h2 className="text-lg font-black text-slate-800">Baho Tarixi</h2>
                   <p className="text-slate-400 text-[10px] font-bold uppercase mt-1">Jami: {grades.length} ta</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-4 py-4">Sana</th>
                        <th className="px-4 py-4">Mavzu</th>
                        <th className="px-4 py-4">Turi</th>
                        <th className="px-4 py-4 text-right">Baho</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-sans">
                      {[...grades].reverse().map((grade, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-4 font-bold text-slate-500 text-xs">{grade.dateStr}</td>
                          <td className="px-4 py-4 font-black text-slate-700 text-sm">{grade.comment}</td>
                          <td className="px-4 py-4"><span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest">{grade.taskType}</span></td>
                          <td className="px-4 py-4 text-right"><span className={`text-base font-black ${grade.score >= 80 ? 'text-emerald-500' : grade.score >= 60 ? 'text-indigo-500' : 'text-red-500'}`}>{grade.score}</span></td>
                        </tr>
                      ))}
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