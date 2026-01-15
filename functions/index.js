// 🔥 DIQQAT: Mana shu yerga "/v1" qo'shish SHART!
const functions = require("firebase-functions/v1"); 
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendGradeNotification = functions.firestore
  .document('grades/{gradeId}')
  .onWrite(async (change, context) => {
      // Agar ma'lumot o'chirilgan bo'lsa
      if (!change.after.exists) return null;

      const newData = change.after.data();
      const oldData = change.before.exists ? change.before.data() : null;

      // Agar baho o'zgarmagan bo'lsa
      if (oldData && oldData.score === newData.score) return null;

      try {
          // Student ma'lumotini olish
          const studentSnap = await admin.firestore().doc(`students/${newData.studentId}`).get();
          const studentData = studentSnap.data();

          // Token borligini tekshirish va yuborish
          if (studentData && studentData.fcmToken) {
              const payload = {
                  notification: {
                      title: 'Yangi Baho! 🎓',
                      body: `Sizga "${newData.comment}" mavzusi bo'yicha ${newData.score} ball qo'yildi.`,
                  },
                  token: studentData.fcmToken
              };

              await admin.messaging().send(payload);
              console.log("Xabar yuborildi:", newData.studentName);
          } else {
              console.log("Token topilmadi:", newData.studentName);
          }
      } catch (error) {
          console.error("Xatolik:", error);
      }
      return null;
  });