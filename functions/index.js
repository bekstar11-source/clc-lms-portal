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

exports.calculateStudentAverage = functions.firestore
    .document('grades/{gradeId}')
    .onWrite(async (change, context) => {
        const db = admin.firestore();

        const data = change.after.exists ? change.after.data() : change.before.data();
        const studentId = data.studentId;
        const groupId = data.groupId;

        if (!studentId || !groupId) return null;

        try {
            const lessonsSnap = await db.collection("lessons")
                .where("groupId", "==", groupId)
                .get();

            const activeLessons = [];
            lessonsSnap.forEach(doc => {
                const l = doc.data();
                if (!l.isDelayed) activeLessons.push({ id: doc.id, ...l });
            });

            if (activeLessons.length === 0) {
                await db.collection("students").doc(studentId).update({ averageScore: 0 });
                return null;
            }

            const gradesSnap = await db.collection("grades")
                .where("studentId", "==", studentId)
                .get();

            const studentGrades = [];
            gradesSnap.forEach(doc => {
                studentGrades.push(doc.data());
            });

            let totalScore = 0;
            activeLessons.forEach(lesson => {
                const grade = studentGrades.find(g => g.lessonId === lesson.id);
                if (grade) {
                    totalScore += Number(grade.score) || 0;
                }
            });

            const average = Math.round(totalScore / activeLessons.length);

            await db.collection("students").doc(studentId).update({ averageScore: average });
            console.log(`Updated avg score for student ${studentId} to ${average}`);

        } catch (error) {
            console.error("Error calculating average grade:", error);
        }
        return null;
    });