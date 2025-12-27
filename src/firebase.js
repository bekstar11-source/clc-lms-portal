import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  // Bu yerga o'z config ma'lumotlaringizni qo'ying
 apiKey: "AIzaSyBWAk0YO8UmuMZeOWe-zPQg--RsL_ZiBIc",
  authDomain: "web-pro-6dc7d.firebaseapp.com",
  projectId: "web-pro-6dc7d",
  storageBucket: "web-pro-6dc7d.firebasestorage.app",
  messagingSenderId: "109951567314",
  appId: "1:109951567314:web:2bd08f130919ffc781340b",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);