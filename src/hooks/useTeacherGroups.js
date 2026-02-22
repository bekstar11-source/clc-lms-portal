import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';

export const useTeacherGroups = () => {
  const [teacherName, setTeacherName] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retakeAlerts, setRetakeAlerts] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const fetchData = async (forceRefresh = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    if (forceRefresh) setRefreshing(true);

    try {
      const CACHE_KEY = `teacher_dash_${currentUser.uid}_v6`; 
      const cached = localStorage.getItem(CACHE_KEY);

      if (!forceRefresh && cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 10 * 60 * 1000) {
              setTeacherName(data.teacherName);
              setGroups(data.groups);
              setRetakeAlerts(data.retakeAlerts);
              setDebtors(data.debtors);
              setLoading(false);
              setRefreshing(false);
              return;
          }
      }

      const userRef = doc(db, "students", currentUser.uid);
      const mainGroupsQuery = query(collection(db, "groups"), where("teacherId", "==", currentUser.uid));
      const assistGroupsQuery = query(collection(db, "groups"), where("assistantTeacherId", "==", currentUser.uid));
      
      const [userDoc, mainGroupsSnap, assistGroupsSnap] = await Promise.all([
          getDoc(userRef), getDocs(mainGroupsQuery), getDocs(assistGroupsQuery)
      ]);

      let tName = '';
      if (userDoc.exists()) {
          tName = userDoc.data().name;
          setTeacherName(tName);
      }
      
      const mainGroups = mainGroupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'main' }));
      const assistGroups = assistGroupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'assistant' }));
      const fetchedGroups = [...mainGroups, ...assistGroups];
      
      const uniqueGroups = fetchedGroups.filter((group, index, self) =>
        index === self.findIndex((t) => t.id === group.id)
      );

      setGroups(uniqueGroups);

      const groupsDataPromises = uniqueGroups.map(async (grp) => {
          const qStudents = query(collection(db, "students"), where("groupId", "==", grp.id));
          const qGrades = query(collection(db, "grades"), where("groupId", "==", grp.id));
          const qLessons = query(collection(db, "lessons"), where("groupId", "==", grp.id));

          const [studSnap, gradesSnap, lessonsSnap] = await Promise.all([
              getDocs(qStudents), getDocs(qGrades), getDocs(qLessons)
          ]);

          return {
              groupName: grp.name,
              groupId: grp.id,
              students: studSnap.docs.map(d => ({ id: d.id, ...d.data() })),
              grades: gradesSnap.docs.map(d => d.data()),
              gradeDocs: gradesSnap.docs,
              lessons: lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          };
      });

      const allGroupsData = await Promise.all(groupsDataPromises);

      let alerts = [];
      let allDebtors = [];

      allGroupsData.forEach(({ groupName, groupId, students, grades, gradeDocs, lessons }) => {
          const studentsMap = {};
          students.forEach(s => studentsMap[s.id] = s.name);

          // 1. Tekshiruvdagilar
          gradeDocs.forEach(d => {
              const g = d.data();
              if (g.status === 'retake_submitted') {
                  alerts.push({ 
                      id: d.id, 
                      studentName: studentsMap[g.studentId] || 'Unknown', 
                      groupName: groupName, 
                      topic: g.comment,
                      groupId: groupId, 
                      studentId: g.studentId,
                      highlightKey: `${g.lessonId}_${g.taskType}`,
                      date: g.date ? g.date.toDate().toISOString() : new Date().toISOString()
                  });
              }
          });

          // 2. O'quvchilarni tahlil qilish (Qarzdorlar uchun)
          const activeLessons = lessons.filter(l => !l.isDelayed);

          if (activeLessons.length > 0) {
              students.forEach(student => {
                  const studentGrades = grades.filter(g => g.studentId === student.id);
                  let totalScore = 0;

                  activeLessons.forEach(lesson => {
                      const grade = studentGrades.find(g => g.lessonId === lesson.id);
                      if (grade) totalScore += Number(grade.score) || 0;
                      else totalScore += 0;
                  });

                  const average = Math.round(totalScore / activeLessons.length);
                  if (average < 60) {
                      allDebtors.push({
                          id: student.id, name: student.name, groupId: groupId,
                          groupName: groupName, averageScore: average, avatarSeed: student.avatarSeed
                      });
                  }
              });
          }
      });

      setRetakeAlerts(alerts.sort((a,b) => new Date(b.date) - new Date(a.date)));
      setDebtors(allDebtors.sort((a, b) => a.averageScore - b.averageScore));

      const cacheData = {
          teacherName: tName,
          groups: uniqueGroups,
          retakeAlerts: alerts,
          debtors: allDebtors
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: cacheData, timestamp: Date.now() }));

    } catch (error) { console.error(error); } 
    finally { 
        setLoading(false); 
        setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // 2. REALTIME CHAT
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "chats"), where("participants", "array-contains", auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalUnread = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.unreadCounts && data.unreadCounts[auth.currentUser.uid]) {
          totalUnread += data.unreadCounts[auth.currentUser.uid];
        }
      });
      setUnreadMessages(totalUnread);
    });
    return () => unsubscribe();
  }, []);

  const handleForceRefresh = () => { fetchData(true); };

  const handleRejectRetakeQuery = async (alertId) => {
      try {
          await updateDoc(doc(db, "grades", alertId), { status: 'retake_needed' });
          setRetakeAlerts(prev => prev.filter(a => a.id !== alertId));
          return true;
      } catch (error) { 
          alert(error.message); 
          return false;
      }
  };

  return {
    teacherName, groups, loading, refreshing, retakeAlerts, debtors, unreadMessages, handleForceRefresh, handleRejectRetakeQuery
  };
};
