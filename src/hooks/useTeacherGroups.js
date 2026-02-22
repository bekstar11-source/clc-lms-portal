import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const useTeacherGroups = () => {
    const queryClient = useQueryClient();
    const currentUser = auth?.currentUser;
    const uid = currentUser?.uid;

    const [unreadMessages, setUnreadMessages] = useState(0);

    // 1. GURUHLARNI YUKLASH (React Query / No LocalStorage)
    const { data: mainData = { teacherName: '', groups: [] }, isLoading: loadingGroups, isFetching: refreshingGroups, refetch: refetchGroups } = useQuery({
        queryKey: ['teacherGroups', uid],
        queryFn: async () => {
            if (!uid) return { teacherName: '', groups: [] };
            const userRef = doc(db, "students", uid);
            const mainGroupsQuery = query(collection(db, "groups"), where("teacherId", "==", uid));
            const assistGroupsQuery = query(collection(db, "groups"), where("assistantTeacherId", "==", uid));

            const [userDoc, mainGroupsSnap, assistGroupsSnap] = await Promise.all([
                getDoc(userRef), getDocs(mainGroupsQuery), getDocs(assistGroupsQuery)
            ]);

            let tName = userDoc.exists() ? userDoc.data().name : '';
            const mainGroups = mainGroupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'main' }));
            const assistGroups = assistGroupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'assistant' }));
            const fetchedGroups = [...mainGroups, ...assistGroups];

            const uniqueGroups = fetchedGroups.filter((group, index, self) =>
                index === self.findIndex((t) => t.id === group.id)
            );

            return { teacherName: tName, groups: uniqueGroups };
        },
        enabled: !!uid,
        staleTime: 5 * 60 * 1000
    });

    // 2. EXTRA MA'LUMOTLAR (Alertlar va Qarzdorlar)
    const { data: extraData = { retakeAlerts: [], debtors: [] }, isFetching: loadingExtra, refetch: refetchExtra } = useQuery({
        queryKey: ['teacherExtraData', uid, mainData.groups.map(g => g.id).join(',')],
        queryFn: async () => {
            const uniqueGroups = mainData.groups;
            if (!uniqueGroups.length) return { retakeAlerts: [], debtors: [] };

            const groupsDataPromises = uniqueGroups.map(async (grp) => {
                const qStudents = query(collection(db, "students"), where("groupId", "==", grp.id));
                const qGrades = query(collection(db, "grades"), where("groupId", "==", grp.id), where("status", "==", "retake_submitted"));

                const [studSnap, gradesSnap] = await Promise.all([
                    getDocs(qStudents), getDocs(qGrades)
                ]);

                return {
                    groupName: grp.name,
                    groupId: grp.id,
                    students: studSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                    gradeDocs: gradesSnap.docs
                };
            });

            const allGroupsData = await Promise.all(groupsDataPromises);

            let alerts = [];
            let allDebtors = [];

            allGroupsData.forEach(({ groupName, groupId, students, gradeDocs }) => {
                const studentsMap = {};
                students.forEach(s => {
                    studentsMap[s.id] = s.name;
                    // Database'dagi tayyor average score ni tekshirib qarzdorlarga qo'shamiz!
                    // Frontend HISOB-KITOB QILMAYDI! Hamma og'ir ish Backend (Cloud Functions) da!
                    const avg = s.averageScore || 0;
                    if (avg < 60) {
                        allDebtors.push({
                            id: s.id, name: s.name, groupId: groupId,
                            groupName: groupName, averageScore: avg, avatarSeed: s.avatarSeed
                        });
                    }
                });

                gradeDocs.forEach(d => {
                    const g = d.data();
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
                });
            });

            return {
                retakeAlerts: alerts.sort((a, b) => new Date(b.date) - new Date(a.date)),
                debtors: allDebtors.sort((a, b) => a.averageScore - b.averageScore)
            };
        },
        enabled: mainData.groups.length > 0,
        staleTime: 5 * 60 * 1000
    });

    // 3. REALTIME CHAT
    useEffect(() => {
        if (!uid) return;
        const q = query(collection(db, "chats"), where("participants", "array-contains", uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let totalUnread = 0;
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.unreadCounts && data.unreadCounts[uid]) {
                    totalUnread += data.unreadCounts[uid];
                }
            });
            setUnreadMessages(totalUnread);
        });
        return () => unsubscribe();
    }, [uid]);

    const handleForceRefresh = () => {
        refetchGroups();
        refetchExtra();
    };

    const handleRejectRetakeQuery = async (alertId) => {
        try {
            await updateDoc(doc(db, "grades", alertId), { status: 'retake_needed' });
            queryClient.setQueryData(['teacherExtraData', uid, mainData.groups.map(g => g.id).join(',')], (old) => {
                if (!old) return old;
                return {
                    ...old,
                    retakeAlerts: old.retakeAlerts.filter(a => a.id !== alertId)
                };
            });
            return true;
        } catch (error) {
            alert(error.message);
            return false;
        }
    };

    return {
        teacherName: mainData.teacherName,
        groups: mainData.groups,
        loading: loadingGroups,
        refreshing: refreshingGroups || loadingExtra,
        retakeAlerts: extraData.retakeAlerts,
        debtors: extraData.debtors,
        unreadMessages,
        handleForceRefresh,
        handleRejectRetakeQuery
    };
};
