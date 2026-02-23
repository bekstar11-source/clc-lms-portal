/**
 * one-time-recalculate.js
 * 
 * Barcha mavjud o'quvchilar uchun averageScore ni qayta hisoblaydi.
 * Faqat bir marta ishga tushiriladi:
 *   node one-time-recalculate.js
 */

const admin = require("firebase-admin");
const serviceAccount = require("/Users/bekstar11gmail.com/Aslbek Joraboyev Dropbox/Aslbek Jo'raboyev/Mac/Downloads/web-pro-6dc7d-firebase-adminsdk-fbsvc-1547fbd9e9.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function recalculateAll() {
    console.log("🚀 Hamma o'quvchilar uchun averageScore hisoblanmoqda...\n");

    // 1. Barcha o'quvchilarni olish
    const studentsSnap = await db.collection("students").get();
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`📋 Jami o'quvchilar: ${students.length}`);

    let updated = 0;
    let skipped = 0;

    for (const student of students) {
        const studentId = student.id;
        const groupId = student.groupId;

        if (!groupId) { skipped++; continue; }

        try {
            // 2. Guruhning aktiv darslarini olish
            const lessonsSnap = await db.collection("lessons")
                .where("groupId", "==", groupId)
                .get();

            const activeLessons = [];
            lessonsSnap.forEach(doc => {
                const l = doc.data();
                if (!l.isDelayed) activeLessons.push({ id: doc.id, ...l });
            });

            if (activeLessons.length === 0) {
                await db.collection("students").doc(studentId).update({
                    averageScore: 0,
                    averageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`  ⚪ ${student.name} → 0% (dars yo'q)`);
                updated++;
                continue;
            }

            // 3. O'quvchining baholarini olish
            const gradesSnap = await db.collection("grades")
                .where("studentId", "==", studentId)
                .where("groupId", "==", groupId)
                .get();

            // lessonId → [balllar]
            const gradesByLesson = {};
            gradesSnap.forEach(doc => {
                const g = doc.data();
                if (!gradesByLesson[g.lessonId]) gradesByLesson[g.lessonId] = [];
                gradesByLesson[g.lessonId].push(Number(g.score) || 0);
            });

            // 4. O'rtacha hisoblash
            let totalScore = 0;
            activeLessons.forEach(lesson => {
                const scores = gradesByLesson[lesson.id];
                if (scores && scores.length > 0) {
                    totalScore += scores.reduce((s, v) => s + v, 0) / scores.length;
                }
            });

            const averageScore = Math.round(totalScore / activeLessons.length);

            // 5. Saqlash
            await db.collection("students").doc(studentId).update({
                averageScore,
                averageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            const emoji = averageScore >= 80 ? "🟢" : averageScore >= 60 ? "🟡" : averageScore > 0 ? "🔴" : "⚪";
            console.log(`  ${emoji} ${student.name.padEnd(25)} → ${averageScore}% (${activeLessons.length} dars)`);
            updated++;

        } catch (e) {
            console.error(`  ❌ ${student.name}: ${e.message}`);
            skipped++;
        }
    }

    console.log(`\n✅ Tayyor! Yangilandi: ${updated}, O'tkazildi: ${skipped}`);
    process.exit(0);
}

recalculateAll().catch(e => {
    console.error("❌ Xatolik:", e);
    process.exit(1);
});
