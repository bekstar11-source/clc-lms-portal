import React, { useState } from 'react';
import { auth, db } from '../firebase'; // Firebase sozlamalarimiz
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('student'); // Default rol: o'quvchi

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      // 1. Firebase Auth-da foydalanuvchi yaratish
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Firestore-da foydalanuvchi ma'lumotlarini (roli bilan) saqlash
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: fullName,
        email: email,
        role: role, // 'teacher' yoki 'student'
        createdAt: new Date()
      });

      alert("Muvaffaqiyatli ro'yxatdan o'tdingiz!");
    } catch (error) {
      alert("Xatolik: " + error.message);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <h2>Ro'yxatdan o'tish</h2>
      <form onSubmit={handleRegister}>
        <input type="text" placeholder="To'liq ismingiz" onChange={(e) => setFullName(e.target.value)} required /><br/><br/>
        <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} required /><br/><br/>
        <input type="password" placeholder="Parol" onChange={(e) => setPassword(e.target.value)} required /><br/><br/>
        
        <label>Roli: </label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="student">O'quvchi</option>
          <option value="teacher">Ustoz</option>
        </select><br/><br/>
        
        <button type="submit">Ro'yxatdan o'tish</button>
      </form>
    </div>
  );
};

export default Register;