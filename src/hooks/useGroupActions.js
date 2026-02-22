import { useState } from 'react';
import { db } from '../firebase';
import {
    collection, query, where, getDocs, addDoc,
    doc, serverTimestamp, updateDoc, deleteDoc, writeBatch
} from 'firebase/firestore';

// --- CONFIG ---
const RETAKE_PERIOD_DAYS = 7;

/**
 * useGroupActions
 *
 * Encapsulates all Firebase CRUD operations for the GroupDetails page:
 * - Group deletion
 * - Lesson create / update / delete
 * - Student move / delete
 * - Grade open (fetch), save (batch write), delete
 *
 * @param {object} params
 * @param {string}   params.groupId          - Firestore group document ID
 * @param {Array}    params.lessons           - Current lessons list (from useGroupData)
 * @param {object}   params.groupedLessons    - Lessons grouped by month key
 * @param {Function} params.fetchData         - Refresh callback from useGroupData
 * @param {Function} params.navigate          - react-router navigate function
 * @param {Function} params.triggerHaptic     - Haptic feedback helper
 */
export const useGroupActions = ({
    groupId,
    lessons,
    groupedLessons,
    fetchData,
    navigate,
    triggerHaptic,
}) => {
    const [actionLoading, setActionLoading] = useState(false);

    // ─── GRADE STATE ──────────────────────────────────────────────────────────
    const [gradeScores, setGradeScores] = useState({});
    const [initialScores, setInitialScores] = useState({});
    const [existingGradeDocs, setExistingGradeDocs] = useState({});
    const [existingGradeObjects, setExistingGradeObjects] = useState({});
    const [savedStatus, setSavedStatus] = useState({});
    const [hasChanges, setHasChanges] = useState(false);

    // ─── GROUP ────────────────────────────────────────────────────────────────

    /**
     * Permanently deletes the current group from Firestore.
     * Only allowed for admins.
     */
    const handleDeleteGroup = async (groupName, currentUserRole) => {
        if (currentUserRole !== 'admin') return alert("Huquqingiz yo'q!");
        if (!window.confirm(`"${groupName}" guruhini butunlay o'chirib yubormoqchimisiz?`)) return;

        setActionLoading(true);
        await deleteDoc(doc(db, 'groups', groupId));
        navigate('/');
        // actionLoading is intentionally not reset — we're navigating away
    };

    // ─── STUDENT ──────────────────────────────────────────────────────────────

    /**
     * Moves the selected student to a different group.
     */
    const handleMoveStudent = async (selectedStudent, targetGroupId, onSuccess) => {
        if (!targetGroupId) return alert('Guruhni tanlang!');
        setActionLoading(true);
        try {
            await updateDoc(doc(db, 'students', selectedStudent.id), { groupId: targetGroupId });
            fetchData(true);
            onSuccess?.();
            alert("Ko'chirildi!");
        } catch (e) {
            alert(e.message);
        } finally {
            setActionLoading(false);
        }
    };

    /**
     * Deletes a student document from Firestore after confirmation.
     */
    const handleDeleteStudent = async (id, name) => {
        if (!window.confirm(`${name} o'chirilsinmi?`)) return;
        await deleteDoc(doc(db, 'students', id));
        fetchData(true);
    };

    // ─── LESSON ───────────────────────────────────────────────────────────────

    /**
     * Creates a new lesson or updates an existing one via a batch write.
     *
     * @param {object} params
     * @param {string}   params.lessonTopic
     * @param {string}   params.lessonDate
     * @param {Array}    params.cleanTasks     - Tasks with empty text already filtered out
     * @param {boolean}  params.isLessonDelayed
     * @param {object|null} params.editingLesson - Existing lesson object (null when creating)
     * @param {Function} params.onSuccess       - Called after a successful save (closes modal etc.)
     */
    const handleSaveLesson = async ({
        lessonTopic,
        lessonDate,
        cleanTasks,
        isLessonDelayed,
        editingLesson,
        onSuccess,
    }) => {
        if (!lessonTopic.trim() || !lessonDate) {
            return alert('Mavzu va sana kiritilishi shart!');
        }

        setActionLoading(true);
        try {
            if (editingLesson && editingLesson.id) {
                const batch = writeBatch(db);
                const lessonRef = doc(db, 'lessons', editingLesson.id);
                batch.update(lessonRef, {
                    topic: lessonTopic,
                    date: lessonDate,
                    tasks: cleanTasks,
                    isDelayed: isLessonDelayed,
                });
                await batch.commit();
            } else {
                await addDoc(collection(db, 'lessons'), {
                    groupId,
                    topic: lessonTopic,
                    date: lessonDate,
                    tasks: cleanTasks,
                    createdAt: serverTimestamp(),
                    isDelayed: isLessonDelayed,
                });
            }

            await fetchData(true);
            triggerHaptic('success');
            onSuccess?.();
        } catch (e) {
            alert('Xatolik: ' + e.message);
        } finally {
            setActionLoading(false);
        }
    };

    /**
     * Deletes a lesson document from Firestore after confirmation.
     */
    const handleDeleteLesson = async (id) => {
        if (!window.confirm("O'chirilsinmi?")) return;
        await deleteDoc(doc(db, 'lessons', id));
        fetchData(true);
    };

    // ─── GRADES ───────────────────────────────────────────────────────────────

    /**
     * Fetches all existing grade documents for the given student and populates
     * the grade state. Also expands all month sections in the modal.
     *
     * @param {object}   student              - Student object with at least an `id` field
     * @param {Function} setModalExpandedMonths - Setter to expand all months in the modal
     */
    const openGradeModal = async (student, setModalExpandedMonths) => {
        triggerHaptic();

        // Clear previous grade state
        setGradeScores({});
        setInitialScores({});
        setExistingGradeDocs({});
        setExistingGradeObjects({});
        setSavedStatus({});
        setHasChanges(false);

        const q = query(collection(db, 'grades'), where('studentId', '==', student.id));
        const snap = await getDocs(q);

        const scores = {};
        const docs = {};
        const objs = {};

        snap.forEach(docSnap => {
            const data = docSnap.data();

            // Determine the taskId — use stored taskId, or fall back to name-based lookup
            // for legacy grade documents that pre-date the taskId field.
            let targetTaskId = data.taskId;

            if (!targetTaskId) {
                const lesson = lessons.find(l => l.id === data.lessonId);
                if (lesson && lesson.tasks) {
                    const foundTask = lesson.tasks.find(t => t.text === data.taskType);
                    if (foundTask) targetTaskId = foundTask.id;
                }
            }

            if (targetTaskId) {
                const key = `${data.lessonId}_${targetTaskId}`;
                scores[key] = data.score;
                docs[key] = docSnap.id;
                objs[key] = data;
            }
        });

        setGradeScores(scores);
        setInitialScores({ ...scores });
        setExistingGradeDocs(docs);
        setExistingGradeObjects(objs);

        // Expand all month groups in the modal
        const allMonths = {};
        Object.keys(groupedLessons).forEach(m => (allMonths[m] = true));
        setModalExpandedMonths(allMonths);
    };

    /**
     * Updates a single score in local state and tracks whether there are unsaved changes.
     */
    const handleScoreChange = (lessonId, taskId, value) => {
        const key = `${lessonId}_${taskId}`;
        const newScores = { ...gradeScores, [key]: value };
        setGradeScores(newScores);

        // Detect if any score differs from the initial (persisted) value
        let isChanged = false;
        for (const k in newScores) {
            if (String(newScores[k]) !== String(initialScores[k] || '')) {
                isChanged = true;
                break;
            }
        }
        setHasChanges(isChanged);

        // Remove the "saved" checkmark for this cell if the user starts editing again
        if (savedStatus[key]) {
            setSavedStatus(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    /**
     * Deletes a single grade document (or just clears the local score if unsaved).
     */
    const handleDeleteGrade = async (lessonId, taskId) => {
        triggerHaptic('error');
        const key = `${lessonId}_${taskId}`;
        const docId = existingGradeDocs[key];

        if (docId) {
            if (!window.confirm("Rostdan ham bu bahoni o'chirib yubormoqchimisiz?")) return;
            try {
                await deleteDoc(doc(db, 'grades', docId));

                setGradeScores(prev => { const n = { ...prev }; delete n[key]; return n; });
                setExistingGradeDocs(prev => { const n = { ...prev }; delete n[key]; return n; });
                setInitialScores(prev => { const n = { ...prev }; delete n[key]; return n; });

                triggerHaptic('success');
                fetchData(true);
            } catch (e) {
                alert('Xatolik: ' + e.message);
            }
        } else {
            // Grade was never persisted — just clear the local value
            handleScoreChange(lessonId, taskId, '');
        }
    };

    /**
     * Batch-saves all changed grade scores to Firestore.
     * Handles both updates of existing grades and creation of new ones.
     *
     * @param {object}   selectedStudent - The student whose grades are being saved
     * @param {Function} onSuccess       - Called after a successful commit (e.g. close modal)
     */
    const handleSaveAllGrades = async (selectedStudent, onSuccess) => {
        if (!hasChanges) return;
        triggerHaptic('tap');

        const newSavedStatus = {};

        try {
            const entries = Object.entries(gradeScores);
            const batch = writeBatch(db);
            let changeCount = 0;

            for (const [key, scoreVal] of entries) {
                // Skip unchanged or empty scores
                if (String(scoreVal) === String(initialScores[key])) continue;
                if (scoreVal === '' || scoreVal === null) continue;

                // The key format is "lessonId_taskId"
                const firstUnderscore = key.indexOf('_');
                const lessonId = key.substring(0, firstUnderscore);
                const taskId = key.substring(firstUnderscore + 1);

                const scoreNum = Number(scoreVal);
                const lesson = lessons.find(l => l.id === lessonId);
                const topic = lesson ? lesson.topic : 'Vazifa';

                // Resolve task display name (kept in Firestore as a readable fallback)
                const taskObj = lesson?.tasks?.find(t => t.id === taskId);
                const taskName = taskObj ? taskObj.text : 'Vazifa';

                const eId = existingGradeDocs[key];
                const oldData = existingGradeObjects[key];

                let gradeData = {
                    score: scoreNum,
                    date: serverTimestamp(),
                    status: 'active',
                    retakeDeadline: null,
                    taskId,
                };

                if (scoreNum < 60) {
                    const deadline = new Date();
                    deadline.setDate(deadline.getDate() + RETAKE_PERIOD_DAYS);
                    gradeData.status = 'retake_needed';
                    gradeData.retakeDeadline = deadline;
                    if (!eId) gradeData.previousScore = null;
                }

                if (eId && oldData && (oldData.status === 'retake_submitted' || oldData.status === 'retake_needed')) {
                    gradeData.previousScore = oldData.score;
                }

                if (eId) {
                    batch.update(doc(db, 'grades', eId), { ...gradeData, taskType: taskName });
                } else {
                    const newRef = doc(collection(db, 'grades'));
                    batch.set(newRef, {
                        studentId: selectedStudent.id,
                        studentName: selectedStudent.name,
                        groupId,
                        lessonId,
                        taskType: taskName,
                        comment: topic,
                        ...gradeData,
                    });
                }

                newSavedStatus[key] = true;
                changeCount++;
            }

            if (changeCount > 0) {
                await batch.commit();
                setSavedStatus(newSavedStatus);
                triggerHaptic('success');
                setTimeout(() => {
                    onSuccess?.();
                    fetchData(true);
                }, 500);
            } else {
                onSuccess?.();
            }
        } catch (er) {
            alert('Xatolik: ' + er.message);
        }
    };

    // ─── RETURN ───────────────────────────────────────────────────────────────
    return {
        // Loading state shared by all actions
        actionLoading,

        // Grade state (needed by GradeModal)
        gradeScores,
        initialScores,
        existingGradeDocs,
        existingGradeObjects,
        savedStatus,
        hasChanges,

        // Group actions
        handleDeleteGroup,

        // Student actions
        handleMoveStudent,
        handleDeleteStudent,

        // Lesson actions
        handleSaveLesson,
        handleDeleteLesson,

        // Grade actions
        openGradeModal,
        handleScoreChange,
        handleDeleteGrade,
        handleSaveAllGrades,
    };
};
