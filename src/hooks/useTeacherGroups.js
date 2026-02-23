import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const useTeacherGroups = () => {
    const queryClient = useQueryClient();
    const [uid, setUid] = useState(() => auth?.currentUser?.uid || null);

    // Auth holatini reaktiv kuzatamiz
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUid(user?.uid || null);
        });
        return () => unsubscribe();
    }, []);

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

            // Build a lookup map: groupId -> { name }
            const groupMeta = {};
            uniqueGroups.forEach(grp => {
                groupMeta[grp.id] = { name: grp.name };
            });

            // Firebase 'in' operator supports up to 30 items per query.
            // Chunk groupIds into batches of 30 to stay within the limit.
            const groupIds = uniqueGroups.map(g => g.id);
            const chunkArray = (arr, size) => {
                const chunks = [];
                for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
                return chunks;
            };
            const idChunks = chunkArray(groupIds, 30);

            // Fire ONE batched query for students and ONE for retake grades
            // (per chunk if > 30 groups). Total round trips: 2 * ceil(N/30) instead of 2*N.
            const [allStudentDocs, allGradeDocs] = await Promise.all([
                Promise.all(
                    idChunks.map(chunk =>
                        getDocs(query(collection(db, "students"), where("groupId", "in", chunk)))
                    )
                ).then(snaps => snaps.flatMap(s => s.docs)),
                Promise.all(
                    idChunks.map(chunk =>
                        getDocs(query(
                            collection(db, "grades"),
                            where("groupId", "in", chunk),
                            where("status", "==", "retake_submitted")
                        ))
                    )
                ).then(snaps => snaps.flatMap(s => s.docs))
            ]);

            // Group students by groupId in-memory
            const studentsByGroup = {};
            allStudentDocs.forEach(d => {
                const data = d.data();
                const gid = data.groupId;
                if (!studentsByGroup[gid]) studentsByGroup[gid] = [];
                studentsByGroup[gid].push({ id: d.id, ...data });
            });

            let alerts = [];
            let allDebtors = [];

            // Build studentsMap across all groups for fast name lookup in grade alerts
            const studentsMap = {};
            allStudentDocs.forEach(d => {
                const data = d.data();
                studentsMap[d.id] = data.name;
            });

            // Process debtors from students
            allStudentDocs.forEach(d => {
                const s = { id: d.id, ...d.data() };
                const gid = s.groupId;
                const groupName = groupMeta[gid]?.name || '';
                // Database'dagi tayyor average score ni tekshirib qarzdorlarga qo'shamiz!
                // Frontend HISOB-KITOB QILMAYDI! Hamma og'ir ish Backend (Cloud Functions) da!
                const avg = s.averageScore || 0;
                if (avg < 60) {
                    allDebtors.push({
                        id: s.id, name: s.name, groupId: gid,
                        groupName: groupName, averageScore: avg, avatarSeed: s.avatarSeed
                    });
                }
            });

            // Process retake alerts from grades
            allGradeDocs.forEach(d => {
                const g = d.data();
                const gid = g.groupId;
                const groupName = groupMeta[gid]?.name || '';
                alerts.push({
                    id: d.id,
                    studentName: studentsMap[g.studentId] || 'Unknown',
                    groupName: groupName,
                    topic: g.comment,
                    groupId: gid,
                    studentId: g.studentId,
                    highlightKey: `${g.lessonId}_${g.taskType}`,
                    date: g.date ? g.date.toDate().toISOString() : new Date().toISOString()
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
