import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

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
const messaging = getMessaging(app);

// 🔥 Offline Persistence: Sahifa qayta ochilganda ma'lumot IndexedDB dan darhol keladi
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Bir vaqtda bir nechta tab ochiq — persistence faqat bitta tabda ishlaydi
    console.warn('Firestore persistence: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // Brauzer support qilmaydi (juda eski)
    console.warn('Firestore persistence: not supported in this browser');
  }
});

export { auth, db, messaging };