import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// ... Boshqa importlar (Login, GroupList va h.k.) ...
import Login from './pages/Login';
import Register from './pages/Register';
import GroupList from './pages/GroupList';
import GroupDetails from './pages/GroupDetails';
import Grading from './pages/Grading';
import Assignments from './pages/Assignments';

// KOMPONENTLAR
import Sidebar from './components/Sidebar';
import MobileNavbar from './components/MobileNavbar'; // <-- YANGI IMPORT

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-indigo-600">CLC Loading...</div>;

  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50">
        
        {/* Faqat Kompyuterda ko'rinadigan Sidebar */}
        {user && <Sidebar />} 

        {/* Asosiy kontent */}
        <main className="flex-1 w-full pb-24 md:pb-0"> {/* <-- pb-24 qo'shildi (Mobil menyu uchun joy) */}
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
            
            {/* Himoyalangan yo'llar */}
            <Route path="/" element={user ? <GroupList /> : <Navigate to="/login" />} />
            <Route path="/group/:groupId" element={user ? <GroupDetails /> : <Navigate to="/login" />} />
            <Route path="/grading" element={user ? <Grading /> : <Navigate to="/login" />} />
            <Route path="/assignments" element={user ? <Assignments /> : <Navigate to="/login" />} />
            
            <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
          </Routes>
        </main>

        {/* Faqat Telefonda ko'rinadigan Bottom Navbar */}
        {user && <MobileNavbar />} 

      </div>
    </Router>
  );
}

export default App;