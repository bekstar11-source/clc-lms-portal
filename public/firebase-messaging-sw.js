importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// O'zingizning Firebase configingizni shu yerga qo'ying (firebase.js dagi bilan bir xil)
firebase.initializeApp({
  apiKey: "AIzaSyBWAk0YO8UmuMZeOWe-zPQg--RsL_ZiBIc",
  authDomain: "web-pro-6dc7d.firebaseapp.com",
  projectId: "web-pro-6dc7d",
  storageBucket: "web-pro-6dc7d.firebasestorage.app",
  messagingSenderId: "109951567314",
  appId: "1:109951567314:web:2bd08f130919ffc781340b"
});

const messaging = firebase.messaging();

// Orqa fonda xabar kelganda ishlaydi
messaging.onBackgroundMessage(function(payload) {
  console.log('Orqa fonda xabar keldi:', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png' // Agar logo bo'lsa
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});