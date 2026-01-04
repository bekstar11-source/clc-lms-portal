import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

// KOMPONENTLAR
import Sidebar from './components/Sidebar';
import MobileNavbar from './components/MobileNavbar';

// SAHIFALAR
import AdminPanel from './pages/AdminPanel';
import TeacherDashboard from './pages/TeacherDashboard'; // 👈 Yangilangan Dashboard
import GroupList from './pages/GroupList';             // Admin uchun guruhlar ro'yxati
import GroupDetails from './pages/GroupDetails';       // Guruh ichi
import StudentDashboard from './pages/StudentDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Settings from './pages/Settings'; 
import StudentSettings from './pages/StudentSettings';

// QO'SHIMCHA SAHIFALAR
import Assignments from './pages/Assignments'; 
import Grading from './pages/Grading';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // AUTH TEKSHIRUV
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        try {
          const userRef = doc(db, "students", currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
             const userData = userSnap.data();
             // Bloklangan foydalanuvchini chiqarib yuborish
             if (userData.status === 'banned') {
               await signOut(auth);
               alert("Sizning profilingiz bloklangan.");
               setUser(null); setRole(null);
             } else {
               setRole(userData.role || 'student'); 
             }
          } else {
             // Agar user bazada topilmasa (lekin authda bo'lsa), default student beramiz
             setRole('student');
          }
        } catch (error) { 
          console.error("Auth Error:", error);
          setRole('student'); 
        }
      } else {
        setUser(null); setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // YUKLANISH EKRANI
  if (loading) return (
    <div className="flex h-screen items-center justify-center flex-col gap-3 bg-slate-50">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Tizim Yuklanmoqda...</p>
    </div>
  );

  // Sidebar faqat Teacher va Admin ga ko'rinadi
  const showSidebar = user && (role === 'teacher' || role === 'admin');

  return (
    <div className="flex min-h-screen bg-slate-50">
      
      {/* SIDEBAR */}
      {showSidebar && <Sidebar role={role} />} 

      {/* ASOSIY KONTENT */}
      <main className={`flex-1 w-full transition-all duration-300 ${showSidebar ? 'md:ml-72' : ''} ${user ? 'pb-24 md:pb-0' : ''}`}>
        <Routes>
          {/* LOGIN & REGISTER */}
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
          
          {/* --- ASOSIY ROUTE (HOME) --- */}
          <Route path="/" element={
            !user ? <Navigate to="/login" /> :
            role === 'admin' ? <AdminPanel /> :          // Admin -> AdminPanel
            role === 'teacher' ? <TeacherDashboard /> :  // Teacher -> Yangi TeacherDashboard (E'lonlar + Guruhlar)
            <StudentDashboard />                         // Student -> StudentDashboard
          } />

          {/* ADMIN MAXSUS YO'LLARI */}
          <Route path="/admin" element={role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} />
          
          {/* Admin "Guruhlar" menyusini bosganda hamma guruhlarni ko'rishi uchun */}
          <Route path="/groups" element={role === 'admin' ? <GroupList /> : <Navigate to="/" />} />

          {/* O'QITUVCHI VA ADMIN UMUMIY YO'LLARI */}
          {/* 1. Guruh ichiga kirish */}
          <Route path="/group/:groupId" element={(role === 'teacher' || role === 'admin') ? <GroupDetails /> : <Navigate to="/" />} />
          
          {/* 2. Vazifalar umumiy sahifasi */}
          <Route path="/assignments" element={(role === 'teacher' || role === 'admin') ? <Assignments /> : <Navigate to="/" />} />
          
          {/* 3. Baholash sahifasi */}
          <Route path="/grading" element={(role === 'teacher' || role === 'admin') ? <Grading /> : <Navigate to="/" />} />

          {/* SOZLAMALAR */}
          <Route path="/settings" element={
            !user ? <Navigate to="/login" /> :
            role === 'student' ? <StudentSettings /> : <Settings />
          } />
          
          {/* 404 - Not Found */}
          <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
        </Routes>
      </main>

      {/* MOBILE MENU (Pastki menyu) */}
      {showSidebar && <MobileNavbar role={role} />} 

    </div>
  );
}

export default App;