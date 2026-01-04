import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { 
  collection, getDocs, doc, updateDoc, addDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  ShieldCheck, Search, Loader2, LogOut, ChevronDown, 
  LayoutGrid, Plus, UserPlus, Users, Filter, CheckCircle, Trash2,
  BarChart3, Megaphone, Key, Pencil, X, Target, Sparkles, Layers, GraduationCap, Briefcase
} from 'lucide-react';

// Yordamchi komponent: Gradient Matn
const GradientText = ({ children, from, to }) => (
  <span className={`bg-clip-text text-transparent bg-gradient-to-r ${from} ${to}`}>
    {children}
  </span>
);

const AdminPanel = () => {
  // --- TABS & FILTERS ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [studentFilter, setStudentFilter] = useState('new'); 
  
  // --- DATA ---
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- UI & FORMS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  
  // --- ANNOUNCEMENT STATES ---
  const [announcementText, setAnnouncementText] = useState('');
  const [targetType, setTargetType] = useState('all'); 
  const [selectedTargetId, setSelectedTargetId] = useState('');

  // --- EDIT USER MODAL STATES ---
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('student'); // 👈 YANGI: Role State

  // 1. DATA FETCHING
  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersSnap, groupsSnap, announceSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "groups")),
        getDocs(collection(db, "announcements"))
      ]);
      
      const userList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      userList.sort((a, b) => (b.joinedAt?.seconds || 0) - (a.joinedAt?.seconds || 0));

      setUsers(userList);
      setGroups(groupsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const annList = announceSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      annList.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAnnouncements(annList);

    } catch (error) {
      alert("Xatolik: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- DERIVED DATA ---
  const teachers = users.filter(u => u.role === 'teacher');
  const displayedStudents = (() => {
    // Endi bu yerda filtrlashda ehtiyot bo'lamiz, "student" tabida bo'lsak ham
    // Admin userlarni ham ko'rish kerak bo'lishi mumkin, lekin asosan studentlarni chiqaramiz.
    // Qidiruv orqali hammasini topsa bo'ladi.
    let filtered = users; 
    
    // Agar "student" tabida faqat studentlar kerak bo'lsa:
    // filtered = users.filter(u => u.role === 'student' || !u.role); 
    // Lekin rol o'zgartirish uchun hamma userlarni ko'rsatgan ma'qul (yoki alohida tab kerak).
    // Hozircha "Barchasi" filtrida hammasi chiqadi.

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(u => u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower));
    }
    
    if (studentFilter === 'new') return filtered.filter(u => !u.groupId && (u.role === 'student' || !u.role));
    if (studentFilter === 'assigned') return filtered.filter(u => u.groupId);
    // 'all' bo'lsa hammasi qaytadi
    return filtered; 
  })();

  const stats = {
      totalStudents: users.filter(u => u.role === 'student' || !u.role).length,
      totalTeachers: teachers.length,
      newStudents: users.filter(u => (u.role === 'student' || !u.role) && !u.groupId).length,
      totalGroups: groups.length
  };

  // ================= ACTIONS =================
  const handleDeleteUser = async (userId, userName) => {
    if(!window.confirm(`DIQQAT!\n"${userName}" ni butunlay o'chirib yubormoqchimisiz?`)) return;
    setProcessingId(userId);
    try { await deleteDoc(doc(db, "students", userId)); setUsers(prev => prev.filter(u => u.id !== userId)); } catch (e) { alert(e.message); } finally { setProcessingId(null); }
  };
  
  const handleResetPassword = async (email) => {
      if(!window.confirm(`${email} ga parolni tiklash havolasini yuborasizmi?`)) return;
      try { await sendPasswordResetEmail(auth, email); alert("Email yuborildi!"); } catch (e) { alert("Xatolik: " + e.message); }
  };

  // 🔥 YANGI: EDIT MODAL OCHISH (Role bilan)
  const openEditModal = (user) => { 
      setEditingUser(user); 
      setNewName(user.name); 
      setNewRole(user.role || 'student'); // Userning hozirgi rolini olamiz
      setIsEditUserOpen(true); 
  };

  // 🔥 YANGI: SAQLASH (Role bilan)
  const saveUserEdit = async (e) => {
      e.preventDefault(); if(!editingUser) return;
      try { 
          await updateDoc(doc(db, "students", editingUser.id), { 
              name: newName,
              role: newRole // Rolni ham yangilaymiz
          }); 
          setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, name: newName, role: newRole } : u)); 
          setIsEditUserOpen(false); 
          alert("Ma'lumotlar yangilandi!");
      } catch (e) { alert(e.message); }
  };

  const createGroup = async (e) => {
    e.preventDefault(); if(!newGroupName.trim()) return;
    try { const docRef = await addDoc(collection(db, "groups"), { name: newGroupName, teacherId: null, createdAt: serverTimestamp() }); setGroups([...groups, { id: docRef.id, name: newGroupName, teacherId: null }]); setNewGroupName(''); } catch(e) { alert(e.message); }
  };
  const deleteGroup = async (id) => { if(window.confirm("O'chirilsinmi?")) { await deleteDoc(doc(db, "groups", id)); setGroups(prev=>prev.filter(g=>g.id!==id)); }};
  const assignGroupToStudent = async (uid, gid) => { 
      setProcessingId(uid); try { await updateDoc(doc(db, "students", uid), { groupId: gid || null }); setUsers(p=>p.map(u=>u.id===uid?{...u, groupId: gid||null}:u)); } catch(e){alert(e.message)} finally{setProcessingId(null)}
  };
  const assignTeacherToGroup = async (gid, tid) => {
      setProcessingId(gid); try { await updateDoc(doc(db, "groups", gid), { teacherId: tid }); setGroups(p=>p.map(g=>g.id===gid?{...g, teacherId: tid}:g)); } catch(e){alert(e.message)} finally{setProcessingId(null)}
  };
  const postAnnouncement = async (e) => {
      e.preventDefault(); if(!announcementText.trim()) return;
      if((targetType === 'group' || targetType === 'specific_teacher') && !selectedTargetId) { alert("Targetni tanlang."); return; }
      let targetDisplayName = "Barchaga";
      if (targetType === 'teachers') targetDisplayName = "O'qituvchilarga";
      if (targetType === 'group') { const g = groups.find(grp => grp.id === selectedTargetId); targetDisplayName = g ? `Guruh: ${g.name}` : "Guruh"; }
      if (targetType === 'specific_teacher') { const t = teachers.find(tch => tch.id === selectedTargetId); targetDisplayName = t ? `O'qituvchi: ${t.name}` : "O'qituvchi"; }
      try {
          const newAnn = { text: announcementText, createdAt: serverTimestamp(), createdBy: 'Admin', targetType, targetId: selectedTargetId || null, targetName: targetDisplayName };
          const docRef = await addDoc(collection(db, "announcements"), newAnn);
          setAnnouncements([{ id: docRef.id, ...newAnn, createdAt: { seconds: Date.now()/1000 } }, ...announcements]);
          setAnnouncementText(''); setTargetType('all'); setSelectedTargetId(''); alert("Yuborildi!");
      } catch(e) { alert(e.message); }
  };
  const deleteAnnouncement = async (id) => { if(!window.confirm("O'chirilsinmi?")) return; await deleteDoc(doc(db, "announcements", id)); setAnnouncements(prev => prev.filter(a => a.id !== id)); };
  const handleLogout = async () => { if (window.confirm("Chiqasizmi?")) await signOut(auth); };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#F8FAFC] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-200 via-slate-50 to-slate-100"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  return (
    <div className="min-h-screen p-6 md:p-10 bg-[#F8FAFC] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-purple-100 overflow-x-hidden relative">
      
      {/* Orqa fon effektlari */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* HEADER */}
        <div className="flex justify-between items-center bg-white/60 backdrop-blur-xl p-4 rounded-[2rem] border border-white/40 shadow-sm">
          <div className="flex items-center gap-4 pl-2">
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-3.5 rounded-2xl text-white shadow-lg shadow-indigo-200/50">
                <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">
                <GradientText from="from-indigo-600" to="to-purple-500">Super Admin</GradientText>
              </h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Sparkles size={12} className="text-amber-400"/> Markaziy Boshqaruv
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-white/80 p-3.5 rounded-2xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all shadow-sm border border-white/50 group">
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform"/>
          </button>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="relative overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-600 p-6 rounded-[2rem] shadow-xl shadow-blue-200/40 text-white">
                <div className="absolute -right-4 -bottom-4 opacity-20"><Users size={80}/></div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">O'quvchilar</p>
                <p className="text-3xl font-black">{stats.totalStudents}</p>
            </div>
            <div className="relative overflow-hidden bg-gradient-to-br from-violet-500 to-purple-600 p-6 rounded-[2rem] shadow-xl shadow-purple-200/40 text-white">
                <div className="absolute -right-4 -bottom-4 opacity-20"><GraduationCap size={80}/></div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">O'qituvchilar</p>
                <p className="text-3xl font-black">{stats.totalTeachers}</p>
            </div>
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-[2rem] shadow-xl shadow-emerald-200/40 text-white">
                <div className="absolute -right-4 -bottom-4 opacity-20"><Layers size={80}/></div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Guruhlar</p>
                <p className="text-3xl font-black">{stats.totalGroups}</p>
            </div>
            <div className={`relative overflow-hidden p-6 rounded-[2rem] shadow-xl transition-all ${stats.newStudents > 0 ? 'bg-gradient-to-br from-rose-500 to-orange-600 shadow-rose-200/40 text-white' : 'bg-white/80 backdrop-blur-xl border border-white/50 text-slate-500'}`}>
                <div className="absolute -right-4 -bottom-4 opacity-20"><UserPlus size={80}/></div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${stats.newStudents > 0 ? 'opacity-80' : ''}`}>Yangi (Pending)</p>
                <p className="text-3xl font-black flex items-center gap-2">
                    {stats.newStudents}
                    {stats.newStudents > 0 && <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span></span>}
                </p>
            </div>
        </div>

        {/* TABS */}
        <div className="flex flex-wrap gap-3 bg-white/60 backdrop-blur-md p-2 rounded-[2rem] border border-white/40 w-fit shadow-sm">
           {['dashboard', 'students', 'groups', 'announcements'].map(tab => (
               <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all relative overflow-hidden group ${activeTab === tab ? 'text-white shadow-lg scale-105' : 'text-slate-500 hover:bg-white/50'}`}>
                   {activeTab === tab && (
                     <div className={`absolute inset-0 bg-gradient-to-r ${
                        tab === 'dashboard' ? 'from-slate-700 to-slate-900' :
                        tab === 'students' ? 'from-cyan-500 to-blue-600' :
                        tab === 'groups' ? 'from-emerald-500 to-teal-600' :
                        'from-amber-400 to-orange-500'
                     } -z-10`}></div>
                   )}
                   {tab === 'dashboard' && <BarChart3 size={16}/>}
                   {tab === 'students' && <Users size={16}/>}
                   {tab === 'groups' && <LayoutGrid size={16}/>}
                   {tab === 'announcements' && <Megaphone size={16}/>}
                   <span className="relative z-10">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
               </button>
           ))}
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[3rem] border border-white/50 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-20 p-1">
          
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
            <div className="p-16 text-center flex flex-col items-center justify-center bg-gradient-to-b from-white/0 to-slate-50/50 rounded-[3rem]">
                <div className="bg-indigo-50 p-6 rounded-full mb-6 shadow-inner-lg"><BarChart3 className="text-indigo-400" size={80}/></div>
                <h3 className="text-3xl font-black text-slate-800 mb-2">Xush kelibsiz, <GradientText from="from-indigo-600" to="to-purple-500">Admin!</GradientText></h3>
                <p className="text-slate-500 font-medium max-w-md mx-auto">Tizim barqaror. Yangi o'quvchilarni tekshirish va guruhlarga biriktirishni unutmang.</p>
            </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === 'students' && (
           <div>
              {/* Filter */}
              <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 rounded-t-[3rem]">
                 <div className="flex bg-white/70 p-1.5 rounded-2xl shadow-sm border border-white/50">
                    <button onClick={() => setStudentFilter('new')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${studentFilter==='new'?'bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md':'text-slate-500 hover:bg-white'}`}><UserPlus size={14}/> Yangi ({stats.newStudents})</button>
                    <button onClick={() => setStudentFilter('assigned')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${studentFilter==='assigned'?'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md':'text-slate-500 hover:bg-white'}`}><CheckCircle size={14}/> Guruhlangan</button>
                    <button onClick={() => setStudentFilter('all')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${studentFilter==='all'?'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md':'text-slate-500 hover:bg-white'}`}><Filter size={14}/> Barchasi</button>
                 </div>
                 <div className="relative w-full md:w-80 group">
                    <Search className="absolute left-5 top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18}/>
                    <input className="w-full pl-12 pr-6 py-3 rounded-2xl border border-slate-200 bg-white/80 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all" placeholder="Ism yoki email..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
                 </div>
              </div>

              {/* Users List */}
              <div className="p-6 bg-slate-50/30 min-h-[500px] max-h-[70vh] overflow-y-auto custom-scrollbar space-y-3 rounded-b-[3rem]">
                 {displayedStudents.length === 0 ? <div className="text-center py-20 text-slate-400 font-bold italic">Foydalanuvchilar topilmadi.</div> : 
                 displayedStudents.map(user => {
                   const isNew = !user.groupId;
                   return (
                    <div key={user.id} className={`flex flex-col md:flex-row md:items-center justify-between p-5 rounded-[2rem] border shadow-sm transition-all hover:-translate-y-1 hover:shadow-md group ${isNew ? 'bg-gradient-to-r from-rose-50/80 to-white border-rose-100' : 'bg-white border-slate-100'}`}>
                       
                       <div className="flex items-center gap-4 mb-4 md:mb-0">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${isNew ? 'bg-gradient-to-br from-rose-400 to-orange-400 text-white' : 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600'}`}>
                              {user.name?.charAt(0)}
                          </div>
                          <div>
                             <h4 className="font-black text-slate-800 text-base flex items-center gap-2">
                                 {user.name} 
                                 {isNew && <span className="bg-rose-500 text-white text-[8px] px-2 py-0.5 rounded-full animate-pulse">NEW</span>}
                                 {user.role === 'admin' && <span className="bg-slate-800 text-white text-[8px] px-2 py-0.5 rounded-full">ADMIN</span>}
                                 {user.role === 'teacher' && <span className="bg-purple-500 text-white text-[8px] px-2 py-0.5 rounded-full">TEACHER</span>}
                             </h4>
                             <p className="text-xs font-bold text-slate-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span>{user.email}</p>
                          </div>
                       </div>

                       <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                          {/* Faqat studentlarga guruh tanlash ko'rinadi */}
                          {(user.role === 'student' || !user.role) && (
                            <div className="relative w-full md:w-64 group/select">
                               <select className={`w-full appearance-none pl-5 pr-12 py-3.5 rounded-2xl text-xs font-black border outline-none cursor-pointer transition-all shadow-sm ${isNew ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white border-transparent hover:shadow-rose-200/50 hover:scale-[1.02]' : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500'}`} onChange={(e)=>assignGroupToStudent(user.id, e.target.value)} value={user.groupId||""} disabled={processingId===user.id}>
                                  <option value="" className="text-slate-500">-- Guruhni Tanlang --</option>
                                  {groups.map(g => <option key={g.id} value={g.id} className="text-slate-800 font-bold">{g.name}</option>)}
                               </select>
                               <ChevronDown className={`absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover/select:translate-y-0 ${isNew ? 'text-white/80' : 'text-slate-400'}`} size={16}/>
                            </div>
                          )}

                          <div className="flex gap-2 shrink-0 bg-slate-100/50 p-1.5 rounded-2xl">
                             <button onClick={()=>openEditModal(user)} className="p-2.5 text-slate-400 hover:bg-white hover:text-indigo-600 rounded-xl transition-all shadow-sm" title="Tahrirlash"><Pencil size={16}/></button>
                             <button onClick={()=>handleResetPassword(user.email)} className="p-2.5 text-slate-400 hover:bg-white hover:text-amber-500 rounded-xl transition-all shadow-sm" title="Parolni tiklash"><Key size={16}/></button>
                             <button onClick={()=>handleDeleteUser(user.id, user.name)} className="p-2.5 text-slate-400 hover:bg-white hover:text-rose-500 rounded-xl transition-all shadow-sm" title="O'chirish"><Trash2 size={16}/></button>
                          </div>
                       </div>
                    </div>
                   )
                 })}
              </div>
           </div>
        )}

        {/* GROUPS TAB */}
        {activeTab === 'groups' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-8">
              {/* Create Group */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-8 rounded-[2.5rem] shadow-lg shadow-emerald-100/50 border border-emerald-100 h-fit relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 text-emerald-200 opacity-50"><Layers size={100}/></div>
                  <h3 className="text-lg font-black text-emerald-800 mb-6 flex items-center gap-3 relative z-10">
                    <div className="bg-emerald-500 p-2 rounded-xl text-white shadow-md"><Plus size={20}/></div> Yangi Guruh
                  </h3>
                  <form onSubmit={createGroup} className="space-y-4 relative z-10">
                      <input type="text" placeholder="Guruh nomi..." className="w-full px-5 py-4 bg-white/80 backdrop-blur-sm rounded-2xl font-bold text-sm outline-none border border-emerald-200 focus:border-emerald-500 transition-all shadow-sm" value={newGroupName} onChange={e=>setNewGroupName(e.target.value)}/>
                      <button className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:shadow-xl hover:scale-[1.02] transition-all">Yaratish</button>
                  </form>
              </div>

              {/* Groups List */}
              <div className="lg:col-span-2 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                  {groups.map(g => {
                    const hasTeacher = !!g.teacherId;
                    return (
                      <div key={g.id} className={`flex flex-col md:flex-row md:items-center justify-between p-5 rounded-[2rem] border transition-all hover:-translate-y-1 hover:shadow-md ${hasTeacher ? 'bg-white border-slate-100' : 'bg-amber-50/50 border-amber-100'}`}>
                          <div className="flex items-center gap-4 mb-4 md:mb-0">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white shadow-sm ${hasTeacher ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'bg-gradient-to-br from-amber-400 to-orange-400'}`}><Layers size={24} /></div>
                              <div><h4 className="font-black text-slate-800 text-lg">{g.name}</h4><p className={`text-[10px] font-bold uppercase tracking-widest ${hasTeacher ? 'text-emerald-500' : 'text-amber-500'}`}>{hasTeacher ? 'Faol Guruh' : 'O\'qituvchi Biriktirilmagan'}</p></div>
                          </div>
                          <div className="flex items-center gap-3 w-full md:w-auto">
                              <div className="relative w-full md:w-64">
                                  <select className={`w-full appearance-none pl-5 pr-10 py-3.5 rounded-2xl text-xs font-black border outline-none cursor-pointer transition-all shadow-sm ${hasTeacher ? 'bg-slate-50 text-slate-700' : 'bg-amber-100 text-amber-700'}`} value={g.teacherId||""} onChange={(e)=>assignTeacherToGroup(g.id, e.target.value)} disabled={processingId===g.id}>
                                      <option value="">-- O'qituvchi yo'q --</option>
                                      {teachers.map(t=><option key={t.id} value={t.id} className="text-slate-800 font-bold">{t.name}</option>)}
                                  </select>
                                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={16}/>
                              </div>
                              <button onClick={()=>deleteGroup(g.id)} className="p-3.5 bg-slate-100/50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all shadow-sm"><Trash2 size={18}/></button>
                          </div>
                      </div>
                    )
                  })}
              </div>
           </div>
        )}

        {/* ANNOUNCEMENTS TAB */}
        {activeTab === 'announcements' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 p-8">
                <div className="lg:col-span-2 bg-gradient-to-br from-amber-50 to-orange-50 p-8 rounded-[2.5rem] shadow-lg shadow-amber-100/50 border border-amber-100 h-fit relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 text-amber-200 opacity-50"><Megaphone size={100}/></div>
                    <h3 className="text-lg font-black text-amber-800 mb-6 flex items-center gap-3 relative z-10"><div className="bg-amber-500 p-2 rounded-xl text-white shadow-md"><Megaphone size={20}/></div> E'lon Yuborish</h3>
                    
                    <div className="space-y-5 relative z-10">
                        <textarea className="w-full h-32 p-5 bg-white/80 backdrop-blur-sm rounded-2xl font-bold text-sm outline-none border border-amber-200 focus:border-amber-500 resize-none" placeholder="Xabar matni..." value={announcementText} onChange={e=>setAnnouncementText(e.target.value)}></textarea>
                        <div>
                            <label className="text-[10px] font-black text-amber-700/70 uppercase tracking-widest ml-1 mb-2 block flex items-center gap-1"><Target size={12}/> Kimga yuborilsin?</label>
                            <div className="relative"><select className="w-full px-5 py-3.5 bg-white/80 backdrop-blur-sm rounded-2xl font-bold text-xs outline-none border border-amber-200 appearance-none cursor-pointer" value={targetType} onChange={(e) => { setTargetType(e.target.value); setSelectedTargetId(''); }}><option value="all">🌐 Barcha Foydalanuvchilarga</option><option value="teachers">👨‍🏫 Barcha O'qituvchilarga</option><option value="group">🎓 Aniq Bir Guruhga</option><option value="specific_teacher">👤 Aniq Bir O'qituvchiga</option></select><ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none"/></div>
                        </div>
                        {(targetType === 'group' || targetType === 'specific_teacher') && (
                             <div className="animate-in slide-in-from-top-4 fade-in">
                                <label className="text-[10px] font-black text-amber-700/70 uppercase tracking-widest ml-1 mb-2 block">Aniqlashtiring</label>
                                <div className="relative"><select className="w-full px-5 py-3.5 bg-amber-100/50 backdrop-blur-sm rounded-2xl font-bold text-xs outline-none border border-amber-300 appearance-none cursor-pointer" value={selectedTargetId} onChange={(e) => setSelectedTargetId(e.target.value)}><option value="">-- Tanlang --</option>{targetType === 'group' ? groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>) : teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none"/></div>
                             </div>
                        )}
                        <button onClick={postAnnouncement} className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:shadow-xl hover:scale-[1.02] transition-all">Yuborish</button>
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                    {announcements.length === 0 && <div className="text-center py-20 text-slate-400 font-bold italic">E'lonlar mavjud emas</div>}
                    {announcements.map(a => (
                        <div key={a.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-start group hover:border-amber-200 hover:shadow-md transition-all relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${a.targetType === 'all' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-600'}`}>{a.targetName || a.targetType}</span>
                                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">• {a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000).toLocaleString() : 'Hozirgina'}</span>
                                </div>
                                <p className="font-bold text-slate-700 text-sm leading-relaxed ml-1">{a.text}</p>
                            </div>
                            <button onClick={() => deleteAnnouncement(a.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shrink-0 relative z-10"><Trash2 size={18}/></button>
                            <div className="absolute -right-6 -bottom-6 text-amber-50 opacity-50 rotate-12 group-hover:scale-110 transition-transform z-0"><Megaphone size={80}/></div>
                        </div>
                    ))}
                </div>
            </div>
        )}
        </div>

      </div>

      {/* 🔥 YANGI: EDIT USER MODAL (ROLE BILAN) */}
      {isEditUserOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-white/50 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-200/50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                   <div className="relative z-10">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Pencil size={20} className="text-indigo-500"/> Tahrirlash</h3>
                          <button onClick={()=>setIsEditUserOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} className="text-slate-400"/></button>
                      </div>
                      <form onSubmit={saveUserEdit} className="space-y-4">
                          <div>
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Ism Familiya</label>
                             <input className="w-full px-5 py-4 bg-slate-50/80 rounded-2xl font-bold text-sm outline-none border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="To'liq ism..."/>
                          </div>

                          {/* 🆕 ROLE SELECT */}
                          <div>
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block flex items-center gap-1"><Briefcase size={12}/> Foydalanuvchi Roli</label>
                             <div className="relative">
                               <select className="w-full px-5 py-4 bg-slate-50/80 rounded-2xl font-bold text-sm outline-none border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all appearance-none cursor-pointer" value={newRole} onChange={e=>setNewRole(e.target.value)}>
                                   <option value="student">🎓 Student</option>
                                   <option value="teacher">👨‍🏫 Teacher</option>
                                   <option value="admin">🛡️ Admin</option>
                               </select>
                               <ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                             </div>
                          </div>

                          <button className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:shadow-xl hover:scale-[1.02] transition-all active:scale-95">Saqlash</button>
                      </form>
                   </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminPanel;