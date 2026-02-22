import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

// KOMPONENTLAR
import Sidebar from './components/Sidebar';
import MobileNavbar from './components/MobileNavbar';

// SAHIFALAR (LAZY LOADED)
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const SprintGame = lazy(() => import('./pages/SprintGame'));
const SentenceGame = lazy(() => import('./pages/SentenceGame'));
const GameHub = lazy(() => import('./pages/GameHub'));
const WordGame = lazy(() => import('./pages/WordGame'));
const AdminGameBuilder = lazy(() => import('./pages/AdminGameBuilder'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));
const GroupList = lazy(() => import('./pages/GroupList'));
const GroupDetails = lazy(() => import('./pages/GroupDetails'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Settings = lazy(() => import('./pages/Settings'));
const StudentSettings = lazy(() => import('./pages/StudentSettings'));

// QO'SHIMCHA SAHIFALAR (LAZY LOADED)
const Assignments = lazy(() => import('./pages/Assignments'));
const Debtors = lazy(() => import('./pages/Debtors'));

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
            if (userData.status === 'banned') {
              await signOut(auth);
              alert("Sizning profilingiz bloklangan.");
              setUser(null); setRole(null);
            } else {
              setRole(userData.role || 'student');
            }
          } else {
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

      {/* SIDEBAR (Faqat Admin/Teacher uchun) */}
      {showSidebar && <Sidebar role={role} />}

      {/* ASOSIY KONTENT */}
      <main className={`flex-1 w-full transition-all duration-300 ${showSidebar ? 'md:ml-72' : ''} ${user ? 'pb-24 md:pb-0' : ''}`}>
        <Suspense fallback={
          <div className="flex h-screen items-center justify-center flex-col gap-3 bg-slate-50">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Sahifa Yuklanmoqda...</p>
          </div>
        }>
          <Routes>
            {/* LOGIN & REGISTER */}
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />

            {/* --- ASOSIY ROUTE (HOME) --- */}
            <Route path="/" element={
              !user ? <Navigate to="/login" /> :
                role === 'admin' ? <AdminPanel /> :
                  role === 'teacher' ? <TeacherDashboard /> :
                    <StudentDashboard />
            } />

            {/* ADMIN MAXSUS YO'LLARI */}
            <Route path="/admin" element={role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} />
            <Route path="/groups" element={role === 'admin' ? <GroupList /> : <Navigate to="/" />} />
            <Route path="/admin/game-builder" element={role === 'admin' ? <AdminGameBuilder /> : <Navigate to="/" />} />

            {/* 🔥 O'YINLAR (Faqat Login qilganlar uchun) */}
            <Route path="/games" element={user ? <GameHub /> : <Navigate to="/login" />} />
            <Route path="/sprint-game" element={user ? <SprintGame /> : <Navigate to="/login" />} />
            <Route path="/word-game" element={user ? <WordGame /> : <Navigate to="/login" />} />
            <Route path="/sentence-game" element={user ? <SentenceGame /> : <Navigate to="/login" />} />

            {/* O'QITUVCHI VA ADMIN UMUMIY YO'LLARI */}
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/group/:groupId" element={(role === 'teacher' || role === 'admin') ? <GroupDetails /> : <Navigate to="/" />} />
            <Route path="/assignments" element={(role === 'teacher' || role === 'admin') ? <Assignments /> : <Navigate to="/" />} />
            <Route path="/debtors" element={(role === 'teacher' || role === 'admin') ? <Debtors /> : <Navigate to="/" />} />

            {/* SOZLAMALAR */}
            <Route path="/settings" element={
              !user ? <Navigate to="/login" /> :
                role === 'student' ? <StudentSettings /> : <Settings />
            } />

            {/* 404 - Not Found */}
            <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
          </Routes>
        </Suspense>
      </main>

      {/* MOBILE MENU (Faqat Admin/Teacher uchun pastki menyu) */}
      {showSidebar && <MobileNavbar role={role} />}

    </div>
  );
}

export default App;