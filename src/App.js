import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

// SAHIFALAR
import Login from './pages/Login';
import Register from './pages/Register';
import GroupList from './pages/GroupList';
import GroupDetails from './pages/GroupDetails';
import Grading from './pages/Grading';
import Assignments from './pages/Assignments';
import StudentDashboard from './pages/StudentDashboard';

// KOMPONENTLAR
import Sidebar from './components/Sidebar';
import MobileNavbar from './components/MobileNavbar';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(true); // Qidiruv paytida loading bo'lib tursin

        try {
          console.log("Tekshirilayotgan email:", currentUser.email);

          // 1. O'quvchilar ro'yxatidan qidirish
          const studentsRef = collection(db, "students");
          const q = query(studentsRef, where("email", "==", currentUser.email));
          const snap = await getDocs(q);
          
          if (!snap.empty) {
            console.log("Natija: Bu foydalanuvchi - O'QUVCHI");
            setRole('student');
          } else {
            console.log("Natija: O'quvchilar orasida topilmadi -> O'QITUVCHI deb belgilandi");
            setRole('teacher');
          }
        } catch (error) {
          console.error("Xatolik yuz berdi:", error);
          // Xatolik bo'lsa, xavfsizlik uchun hech kimga ruxsat bermaymiz
          setRole(null); 
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-indigo-600">Tizim yuklanmoqda...</div>;

  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50">
        
        {/* Sidebar faqat O'QITUVCHI uchun */}
        {user && role === 'teacher' && <Sidebar />} 

        <main className={`flex-1 w-full ${user ? 'pb-24 md:pb-0' : ''}`}>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
            
            <Route path="/" element={
              !user ? <Navigate to="/login" /> : 
              role === 'student' ? <StudentDashboard /> : 
              role === 'teacher' ? <GroupList /> :
              <div className="p-10 text-center">Rol aniqlanmadi. Iltimos qayta kiring.</div>
            } />

            {/* O'QITUVCHI YO'LLARI */}
            <Route path="/group/:groupId" element={role === 'teacher' ? <GroupDetails /> : <Navigate to="/" />} />
            <Route path="/grading" element={role === 'teacher' ? <Grading /> : <Navigate to="/" />} />
            <Route path="/assignments" element={role === 'teacher' ? <Assignments /> : <Navigate to="/" />} />
            
            <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
          </Routes>
        </main>

        {/* Mobil menyu faqat O'QITUVCHI uchun */}
        {user && role === 'teacher' && <MobileNavbar />} 

      </div>
    </Router>
  );
}

export default App;