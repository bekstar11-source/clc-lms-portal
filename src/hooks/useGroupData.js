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


            const groupDoc = await getDoc(doc(db, "groups", groupId));
            if (groupDoc.exists()) setGroupName(groupDoc.data().name);

            const qStudents = query(collection(db, "students"), where("groupId", "==", groupId));
            const qLessons = query(collection(db, "lessons"), where("groupId", "==", groupId), orderBy("date", "desc"));
            const qAllGroups = query(collection(db, "groups"));

            const [snapStudents, snapLessons, snapGroups] = await Promise.all([
                getDocs(qStudents), getDocs(qLessons), getDocs(qAllGroups)
            ]);
            setAllGroups(snapGroups.docs.map(d => ({ id: d.id, ...d.data() })));

            const lessonsList = snapLessons.docs.map(d => {
                const data = d.data();
                const normalizedTasks = (data.tasks || []).map(t => {
                    if (typeof t === 'string') return { id: generateId(), text: t, completed: false };
                    if (!t.id) return { ...t, id: generateId() };
                    return t;
                });
                return { id: d.id, ...data, tasks: normalizedTasks };
            });

            const studentsList = snapStudents.docs.map(d => {
                const sData = d.data();
                // 🚀 averageScore endi to'g'ridan-to'g'ri Firestore dagi tayyor 'averageScore' xossasidan o'qiladi. 
                // Xech qanday backend math / tsikl frontend da ishlamaydi. Cloud Functions ni kutamiz.
                return { id: d.id, ...sData, gameXp: sData.gameXp || 0, averageScore: sData.averageScore || 0 };
            });

            studentsList.sort((a, b) => a.name.localeCompare(b.name));

            setStudents(studentsList);
            setLessons(lessonsList);


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
