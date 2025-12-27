import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Sahifalar importi
import Login from './pages/Login';
import Register from './pages/Register';
import TeacherDashboard from './pages/TeacherDashboard';
import GroupDetails from './pages/GroupDetails';
import StudentDashboard from './pages/StudentDashboard';
import Assignments from './pages/Assignments'; // Yangi sahifa

// Hozircha bo'sh sahifalar (Xatolik bermasligi uchun)
import Grading from './pages/Grading';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Routes>
        {/* Asosiy kirish yo'llari */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Ustoz (Teacher) yo'llari */}
        <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
        <Route path="/group/:groupId" element={<GroupDetails />} />
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/grading" element={<Grading />} />
        <Route path="/settings" element={<Settings />} />

        {/* O'quvchi (Student) yo'llari */}
        <Route path="/student-dashboard" element={<StudentDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;