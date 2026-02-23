/**
 * ═══════════════════════════════════════════════════════════════════
 *  CLC LMS Portal — Firebase Cloud Functions
 *  Project: web-pro-6dc7d
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Funksiyalar ro'yxati:
 *  1. calculateStudentAverage  — baho o'zgarganda o'quvchining
 *                                o'rtacha bahosini hisoblaydi va
 *                                students/{studentId}.averageScore
 *                                maydoniga yozadi.
 *
 *  2. sendGradeNotification    — o'quvchiga FCM push-xabar jo'natadi.
 * ═══════════════════════════════════════════════════════════════════
 */

// firebase-functions v7+ da bunday import ishlatiladi
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

// Admin SDK-ni bir marta ishga tushiramiz
admin.initializeApp();

const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// 1.  calculateStudentAverage
//     Trigger  : grades/{gradeId} yozilganda (yaratish / yangilash / o'chirish)
//     Maqsad   : o'quvchining barcha aktiv darslar bo'yicha o'rtacha bahosini
//                hisoblaydi va students/{studentId} hujjatiga averageScore
//                maydonini yozadi.
//
//     Hisoblash usuli:
//       — Guruhning barcha darslarini oladi (isDelayed=false bo'lganlar aktiv).
//       — Har bir aktiv dars uchun o'quvchining bahosini topadi.
//       — Agar baho yo'q bo'lsa, o'sha dars 0 sifatida hisoblanadi.
//       — averageScore = (jami balllar) / (aktiv darslar soni)
// ─────────────────────────────────────────────────────────────────────────────
exports.calculateStudentAverage = functions
    .firestore
    .document("grades/{gradeId}")
    .onWrite(async (change, context) => {

        // Qaysi hujjat o'zgardi: yangi yoki eski ma'lumotni olamiz
        const afterData = change.after.exists ? change.after.data() : null;
        const beforeData = change.before.exists ? change.before.data() : null;

        // Asl ma'lumot manbasi: o'chirishda afterData null bo'ladi
        const gradeData = afterData ?? beforeData;

        const studentId = gradeData?.studentId;
        const groupId = gradeData?.groupId;

        if (!studentId || !groupId) {
            console.warn("calculateStudentAverage: studentId yoki groupId yo'q, o'tildi.");
            return null;
        }

        // ── Optimizatsiya: agar baho qiymati o'zgarmagan bo'lsa to'xtatamiz ──
        if (
            afterData && beforeData &&
            afterData.score === beforeData.score &&
            afterData.taskId === beforeData.taskId
        ) {
            console.log(`calculateStudentAverage: ${studentId} uchun o'zgarish yo'q, o'tildi.`);
            return null;
        }

        try {
            // ── 1. Guruhning barcha darslarini olish ─────────────────────────
            const lessonsSnap = await db
                .collection("lessons")
                .where("groupId", "==", groupId)
                .get();

            if (lessonsSnap.empty) {
                console.log(`calculateStudentAverage: ${groupId} guruhida dars yo'q.`);
                return db.collection("students").doc(studentId).update({
                    averageScore: 0,
                    averageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            // Faqat aktiv (qoldirilmagan) darslarni olamiz
            const activeLessons = [];
            lessonsSnap.forEach(doc => {
                const lessonData = doc.data();
                if (!lessonData.isDelayed) {
                    activeLessons.push({ id: doc.id, ...lessonData });
                }
            });

            if (activeLessons.length === 0) {
                return db.collection("students").doc(studentId).update({
                    averageScore: 0,
                    averageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            // ── 2. O'quvchining barcha baholarini olish ──────────────────────
            const gradesSnap = await db
                .collection("grades")
                .where("studentId", "==", studentId)
                .where("groupId", "==", groupId)
                .get();

            // lessonId → [balllar] xaritasi (bir darsda bir necha task bo'lishi mumkin)
            const gradesByLesson = {};
            gradesSnap.forEach(doc => {
                const g = doc.data();
                if (!gradesByLesson[g.lessonId]) {
                    gradesByLesson[g.lessonId] = [];
                }
                gradesByLesson[g.lessonId].push(Number(g.score) || 0);
            });

            // ── 3. O'rtacha ballni hisoblash ─────────────────────────────────
            //    Har bir aktiv dars uchun o'sha darsdagi o'rtacha ball olinadi.
            //    Agar dars bo'yicha hali baho qo'yilmagan bo'lsa — 0 sifatida.
            let totalScore = 0;
            activeLessons.forEach(lesson => {
                const scoresForLesson = gradesByLesson[lesson.id];
                if (scoresForLesson && scoresForLesson.length > 0) {
                    const lessonAvg = scoresForLesson.reduce((s, v) => s + v, 0) / scoresForLesson.length;
                    totalScore += lessonAvg;
                }
                // Baho qo'yilmagan dars 0 bo'ladi (totalScore ga qo'shilmaydi)
            });

            const averageScore = Math.round(totalScore / activeLessons.length);

            // ── 4. students kolleksiyasiga yozish ───────────────────────────
            await db.collection("students").doc(studentId).update({
                averageScore,
                averageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(
                `✅ calculateStudentAverage: student=${studentId}, ` +
                `activeLessons=${activeLessons.length}, averageScore=${averageScore}`
            );

        } catch (error) {
            console.error("❌ calculateStudentAverage xatolik:", error);
        }

        return null;
    });


// ─────────────────────────────────────────────────────────────────────────────
// 2.  sendGradeNotification
//     Trigger  : grades/{gradeId} yozilganda
//     Maqsad   : o'quvchiga "Yangi Baho" haqida FCM push-xabar yuboradi.
//                Faqat baho qiymati o'zgarganda ishlaydi.
// ─────────────────────────────────────────────────────────────────────────────
exports.sendGradeNotification = functions
    .firestore
    .document("grades/{gradeId}")
    .onWrite(async (change, context) => {

        // O'chirilgan yozuvlar uchun bildirishnoma yubormaymiz
        if (!change.after.exists) return null;

        const newData = change.after.data();
        const oldData = change.before.exists ? change.before.data() : null;

        // Baho o'zgarmagan bo'lsa yubormaymiz
        if (oldData && oldData.score === newData.score) return null;

        const { studentId, score, comment } = newData;
        if (!studentId) return null;

        try {
            const studentSnap = await db.doc(`students/${studentId}`).get();
            if (!studentSnap.exists) return null;

            const studentData = studentSnap.data();

            if (studentData?.fcmToken) {
                const message = {
                    notification: {
                        title: "Yangi Baho! 🎓",
                        body: `"${comment || "Vazifa"}" bo'yicha sizga ${score} ball qo'yildi.`,
                    },
                    token: studentData.fcmToken,
                };

                await admin.messaging().send(message);
                console.log(`📱 Push yuborildi: student=${studentId}, score=${score}`);
            } else {
                console.log(`ℹ️ FCM token yo'q: student=${studentId}`);
            }

        } catch (error) {
            console.error("❌ sendGradeNotification xatolik:", error);
        }

        return null;
    });