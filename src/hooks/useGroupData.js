import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import {
    collection, query, where, getDocs,
    doc, getDoc, orderBy
} from 'firebase/firestore';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useGroupData = (groupId) => {
    const [groupName, setGroupName] = useState('');
    const [students, setStudents] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [allGroups, setAllGroups] = useState([]);
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async (forceRefresh = false) => {
        if (!groupId) return;
        try {
            if (forceRefresh) setRefreshing(true);

            const currentUser = auth.currentUser;
            if (currentUser) {
                const userDoc = await getDoc(doc(db, "students", currentUser.uid));
                if (userDoc.exists()) setCurrentUserRole(userDoc.data().role);
            }

            const CACHE_KEY = `group_cache_${groupId}`;
            const cachedData = localStorage.getItem(CACHE_KEY);

            if (!forceRefresh && cachedData) {
                const { data, timestamp } = JSON.parse(cachedData);
                if (Date.now() - timestamp < 10 * 60 * 1000) {
                    setGroupName(data.groupName);
                    setStudents(data.students);
                    setLessons(data.lessons);
                    setLoading(false);
                    setRefreshing(false);
                    return;
                }
            }

            const groupDoc = await getDoc(doc(db, "groups", groupId));
            if (groupDoc.exists()) setGroupName(groupDoc.data().name);

            const qGrades = query(collection(db, "grades"), where("groupId", "==", groupId));
            const qStudents = query(collection(db, "students"), where("groupId", "==", groupId));
            const qLessons = query(collection(db, "lessons"), where("groupId", "==", groupId), orderBy("date", "desc"));
            const qAllGroups = query(collection(db, "groups"));

            const [snapGrades, snapStudents, snapLessons, snapGroups] = await Promise.all([
                getDocs(qGrades), getDocs(qStudents), getDocs(qLessons), getDocs(qAllGroups)
            ]);
            setAllGroups(snapGroups.docs.map(d => ({ id: d.id, ...d.data() })));

            const allGrades = snapGrades.docs.map(d => d.data());

            const lessonsList = snapLessons.docs.map(d => {
                const data = d.data();
                const normalizedTasks = (data.tasks || []).map(t => {
                    if (typeof t === 'string') return { id: generateId(), text: t, completed: false };
                    if (!t.id) return { ...t, id: generateId() };
                    return t;
                });
                return { id: d.id, ...data, tasks: normalizedTasks };
            });

            const activeLessons = lessonsList.filter(l => !l.isDelayed);

            const studentsList = snapStudents.docs.map(d => {
                const sData = d.data();
                const studentGrades = allGrades.filter(g => g.studentId === d.id);

                let totalScore = 0;

                if (activeLessons.length === 0) {
                    return { id: d.id, ...sData, gameXp: sData.gameXp || 0, averageScore: 0 };
                }

                activeLessons.forEach(lesson => {
                    const grade = studentGrades.find(g => {
                        if (g.lessonId !== lesson.id) return false;
                        if (g.taskId) return lesson.tasks.some(t => t.id === g.taskId);
                        return lesson.tasks.some(t => t.text === g.taskType);
                    });

                    if (grade) {
                        totalScore += Number(grade.score) || 0;
                    }
                });

                const averageScore = Math.round(totalScore / activeLessons.length);

                return { id: d.id, ...sData, gameXp: sData.gameXp || 0, averageScore: averageScore };
            });

            studentsList.sort((a, b) => a.name.localeCompare(b.name));

            setStudents(studentsList);
            setLessons(lessonsList);

            if (groupDoc.exists()) {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    data: { groupName: groupDoc.data().name, students: studentsList, lessons: lessonsList },
                    timestamp: Date.now()
                }));
            }

            setLoading(false);
            setRefreshing(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchData(); }, [groupId]);

    return {
        groupName,
        students,
        lessons,
        allGroups,
        currentUserRole,
        loading,
        refreshing,
        fetchData,
        setStudents
    };
};
