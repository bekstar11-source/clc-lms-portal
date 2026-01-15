import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging"; // 👈 1. IMPORT QILING

const firebaseConfig = {
  apiKey: "AIzaSyBWAk0YO8UmuMZeOWe-zPQg--RsL_ZiBIc",
  authDomain: "web-pro-6dc7d.firebaseapp.com",
  projectId: "web-pro-6dc7d",
  storageBucket: "web-pro-6dc7d.firebasestorage.app",
  messagingSenderId: "109951567314",
  appId: "1:109951567314:web:2bd08f130919ffc781340b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app); // 👈 2. INITIALIZE QILING

// 3. EXPORT QILING (messaging so'zi shu yerda bo'lishi shart)
export { auth, db, messaging };