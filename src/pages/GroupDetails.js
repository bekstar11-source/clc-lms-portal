import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft, X, Loader2, Edit2, Trash2,
    UserPlus, Share2, Plus, ChevronDown, ChevronUp, Calendar,
    Trophy, Zap, Crown, List, Percent, Save, Check, Users, BookOpen, RefreshCw, Clock
} from 'lucide-react';
import { db, auth } from '../firebase';
import {
    collection, query, where, getDocs, addDoc,
    doc, getDoc, serverTimestamp, orderBy, updateDoc, deleteDoc, writeBatch
} from 'firebase/firestore';
import { useGroupData } from '../hooks/useGroupData';
import GroupHeader from '../components/group/GroupHeader';
import StudentsTab from '../components/group/StudentsTab';
import JournalTab from '../components/group/JournalTab';
import GradeModal from '../components/group/GradeModal';
import AddStudentModal from '../components/group/AddStudentModal';
import LessonModal from '../components/group/LessonModal';
import MoveStudentModal from '../components/group/MoveStudentModal';

// --- CONFIG ---
const GRACE_PERIOD_DAYS = 7;
const RETAKE_PERIOD_DAYS = 7;

// --- YORDAMCHI FUNKSIYALAR ---
const triggerHaptic = (type = 'tap') => {
    if (navigator.vibrate) {
        if (type === 'tap') navigator.vibrate(10);
        if (type === 'success') navigator.vibrate([10, 50, 10]);
        if (type === 'error') navigator.vibrate([50, 100, 50]);
    }
};

const getAvatarUrl = (seed) => {
    const safeSeed = seed || "default";
    const cleanSeed = safeSeed.replace('bot_', '');
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${cleanSeed}&backgroundColor=e0e7ff,d1fae5,ffedd5`;
};

const generateId = () => Math.random().toString(36).substr(2, 9);



const GroupDetails = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const highlightRef = useRef(null);

    // UI Holati
    const [activeTab, setActiveTab] = useState('students');
    const [studentViewMode, setStudentViewMode] = useState('list');
    const [modalExpandedMonths, setModalExpandedMonths] = useState({});
    const { groupName, students, lessons, allGroups, currentUserRole, loading, refreshing, fetchData, setStudents } = useGroupData(groupId);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (!loading && !groupName) {
            navigate('/');
        }
    }, [loading, groupName, navigate]);

    // Modallar
    const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
    const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
    const [isAddLessonOpen, setIsAddLessonOpen] = useState(false);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);


    const [targetGroupId, setTargetGroupId] = useState('');

    // Dars Formasi
    const [lessonTopic, setLessonTopic] = useState('');
    const [lessonDate, setLessonDate] = useState('');
    const [lessonTasks, setLessonTasks] = useState([{ id: generateId(), text: 'Uyga vazifa', completed: false }]);
    const [isLessonDelayed, setIsLessonDelayed] = useState(false);
    const [editingLesson, setEditingLesson] = useState(null);

    // Baholash
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [gradeScores, setGradeScores] = useState({});
    const [initialScores, setInitialScores] = useState({});
    const [existingGradeDocs, setExistingGradeDocs] = useState({});
    const [existingGradeObjects, setExistingGradeObjects] = useState({});
    const [savedStatus, setSavedStatus] = useState({});
    const [hasChanges, setHasChanges] = useState(false);

    // --- MA'LUMOT OLISH ---
    // Hooks orgali olib chiqildi

    useEffect(() => {
        if (location.state?.openStudentId && students.length > 0) {
            const target = students.find(s => s.id === location.state.openStudentId);
            if (target) {
                openGradeModal(target);
                setTimeout(() => {
                    if (highlightRef.current) {
                        highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        highlightRef.current.focus();
                    }
                }, 800);
            }
        }
    }, [students, location.state]);

    const getDisplayedStudents = () => {
        let list = [...students];
        if (studentViewMode === 'leaderboard') return list.sort((a, b) => b.gameXp - a.gameXp);
        return list;
    };

    const groupLessonsByMonth = (lessonList) => {
        const groups = {};
        lessonList.forEach(lesson => {
            const date = new Date(lesson.date);
            const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            if (!groups[monthKey]) groups[monthKey] = [];
            groups[monthKey].push(lesson);
        });
        return groups;
    };

    const groupedLessons = groupLessonsByMonth(lessons);
    const toggleModalMonth = (month) => {
        triggerHaptic();
        setModalExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));
    };

    const handleForceRefresh = () => {
        triggerHaptic();
        fetchData(true);
    };

    const handleDeleteGroup = async () => { if (currentUserRole !== 'admin') return alert("Huquqingiz yo'q!"); if (window.confirm(`"${groupName}" guruhini butunlay o'chirib yubormoqchimisiz?`)) { setActionLoading(true); await deleteDoc(doc(db, "groups", groupId)); navigate('/'); } };

    const handleMoveStudent = async () => { if (!targetGroupId) return alert("Guruhni tanlang!"); setActionLoading(true); try { await updateDoc(doc(db, "students", selectedStudent.id), { groupId: targetGroupId }); setIsMoveModalOpen(false); fetchData(true); alert("Ko'chirildi!"); } catch (e) { alert(e.message); } finally { setActionLoading(false); } };
    const handleDeleteStudent = async (id, name) => { if (window.confirm(`${name} o'chirilsinmi?`)) { await deleteDoc(doc(db, "students", id)); fetchData(true); } };

    // --- LESSON MANAGEMENT ---
    const handleOpenNewLesson = () => {
        triggerHaptic();
        setEditingLesson(null);
        setLessonTopic('');
        setLessonDate('');
        setLessonTasks([{ id: generateId(), text: 'Uyga vazifa', completed: false }]);
        setIsLessonDelayed(false);
        setIsAddLessonOpen(true);
    };

    const handleOpenEditLesson = (lesson) => {
        triggerHaptic();
        const tasksWithIds = (lesson.tasks || []).map(t =>
            t.id ? t : { ...t, id: generateId() }
        );
        if (tasksWithIds.length === 0) tasksWithIds.push({ id: generateId(), text: 'Uyga vazifa', completed: false });

        setEditingLesson({ ...lesson, tasks: tasksWithIds });
        setLessonTopic(lesson.topic);
        setLessonDate(lesson.date);
        setLessonTasks(tasksWithIds);
        setIsLessonDelayed(lesson.isDelayed || false);
        setIsAddLessonOpen(true);
    };

    const handleSaveLesson = async (e) => {
        if (e) e.preventDefault();
        const cleanTasks = lessonTasks.filter(t => t.text.trim() !== '');
        if (!lessonTopic.trim() || !lessonDate) return alert("Mavzu va sana kiritilishi shart!");

        setActionLoading(true);
        try {
            if (editingLesson && editingLesson.id) {
                const batch = writeBatch(db);
                const lessonRef = doc(db, "lessons", editingLesson.id);

                // 🔥 ESKI MURAKKAB KOD OLIB TASHLANDI:
                // Endi taskType o'zgarsa ham, baholar ID orqali bog'langani uchun muammo bo'lmaydi.

                batch.update(lessonRef, {
                    topic: lessonTopic,
                    date: lessonDate,
                    tasks: cleanTasks,
                    isDelayed: isLessonDelayed
                });

                await batch.commit();
            } else {
                await addDoc(collection(db, "lessons"), {
                    groupId,
                    topic: lessonTopic,
                    date: lessonDate,
                    tasks: cleanTasks,
                    createdAt: serverTimestamp(),
                    isDelayed: isLessonDelayed
                });
            }
            setIsAddLessonOpen(false);
            setEditingLesson(null);
            await fetchData(true);
            triggerHaptic('success');
        } catch (e) { alert("Xatolik: " + e.message); }
        finally { setActionLoading(false); }
    };

    const handleDeleteLesson = async (id) => { if (window.confirm(`O'chirilsinmi?`)) { await deleteDoc(doc(db, "lessons", id)); fetchData(true); } };

    // --- 🔥 GRADING ACTIONS (O'ZGARDI) ---
    const openGradeModal = async (student) => {
        triggerHaptic();
        setSelectedStudent(student);
        setGradeScores({});
        setInitialScores({});
        setExistingGradeDocs({});
        setExistingGradeObjects({});
        setSavedStatus({});
        setHasChanges(false);
        setIsGradeModalOpen(true);

        const q = query(collection(db, "grades"), where("studentId", "==", student.id));
        const snap = await getDocs(q);

        const scores = {};
        const docs = {};
        const objs = {};

        snap.forEach(doc => {
            const data = doc.data();

            // 🔥 MUHIM QISM: ID ni aniqlash
            let targetTaskId = data.taskId;

            // Agar bazadagi ma'lumotda taskId bo'lmasa (eski data),
            // Biz uni nomi (taskType) orqali current lessonlardan qidirib topamiz
            if (!targetTaskId) {
                const lesson = lessons.find(l => l.id === data.lessonId);
                if (lesson && lesson.tasks) {
                    const foundTask = lesson.tasks.find(t => t.text === data.taskType);
                    if (foundTask) targetTaskId = foundTask.id;
                }
            }

            // Agar ID topilsa (yoki bor bo'lsa), key ni ID bilan yasaymiz
            if (targetTaskId) {
                const key = `${data.lessonId}_${targetTaskId}`;
                scores[key] = data.score;
                docs[key] = doc.id;
                objs[key] = data;
            }
        });

        setGradeScores(scores);
        setInitialScores({ ...scores });
        setExistingGradeDocs(docs);
        setExistingGradeObjects(objs);

        const allMonths = {};
        Object.keys(groupedLessons).forEach(m => allMonths[m] = true);
        setModalExpandedMonths(allMonths);
    };

    // 🔥 SCORE CHANGE: Key endi lessonId_taskId formatida
    const handleScoreChange = (lessonId, taskId, value) => {
        const key = `${lessonId}_${taskId}`;
        const newScores = { ...gradeScores, [key]: value };
        setGradeScores(newScores);

        let isChanged = false;
        const initialVal = initialScores[key] || '';
        if (String(value) !== String(initialVal)) isChanged = true;
        if (!isChanged) {
            for (let k in newScores) {
                const init = initialScores[k] || '';
                if (String(newScores[k]) !== String(init)) {
                    isChanged = true;
                    break;
                }
            }
        }
        setHasChanges(isChanged);
        if (savedStatus[key]) {
            const newStatus = { ...savedStatus };
            delete newStatus[key];
            setSavedStatus(newStatus);
        }
    };

    const handleDeleteGrade = async (lessonId, taskId) => {
        triggerHaptic('error');
        const key = `${lessonId}_${taskId}`;
        const docId = existingGradeDocs[key];

        if (docId) {
            if (window.confirm("Rostdan ham bu bahoni o'chirib yubormoqchimisiz?")) {
                try {
                    await deleteDoc(doc(db, "grades", docId));
                    const newScores = { ...gradeScores };
                    delete newScores[key];
                    setGradeScores(newScores);
                    const newDocs = { ...existingGradeDocs };
                    delete newDocs[key];
                    setExistingGradeDocs(newDocs);
                    const newInitials = { ...initialScores };
                    delete newInitials[key];
                    setInitialScores(newInitials);
                    triggerHaptic('success');
                    fetchData(true);
                } catch (e) { alert("Xatolik: " + e.message); }
            }
        } else {
            handleScoreChange(lessonId, taskId, '');
        }
    };

    const handleSaveAllGrades = async (e) => {
        e.preventDefault();
        if (!hasChanges) return;

        triggerHaptic('tap');
        const newSavedStatus = {};

        try {
            const entries = Object.entries(gradeScores);
            const batch = writeBatch(db);
            let changeCount = 0;

            for (const [key, scoreVal] of entries) {
                if (String(scoreVal) === String(initialScores[key])) continue;
                if (scoreVal === '' || scoreVal === null) continue;

                // 🔥 Key dan ID larni ajratib olish
                const firstUnderscore = key.indexOf('_');
                const lessonId = key.substring(0, firstUnderscore);
                const taskId = key.substring(firstUnderscore + 1);

                const scoreNum = Number(scoreVal);
                const lesson = lessons.find(l => l.id === lessonId);
                const topic = lesson ? lesson.topic : 'Vazifa';

                // Task nomini topish (faqat display uchun)
                const taskObj = lesson?.tasks.find(t => t.id === taskId);
                const taskName = taskObj ? taskObj.text : 'Vazifa';

                const eId = existingGradeDocs[key];
                const oldData = existingGradeObjects[key];

                let gradeData = {
                    score: scoreNum,
                    date: serverTimestamp(),
                    status: 'active',
                    retakeDeadline: null,
                    // 🔥 ENDI ID HAM SAQLANADI
                    taskId: taskId
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
                    const gradeRef = doc(db, "grades", eId);
                    // taskId yangilanmasa ham bo'ladi, lekin ishonch uchun qo'shamiz
                    batch.update(gradeRef, { ...gradeData, taskType: taskName });
                } else {
                    const newRef = doc(collection(db, "grades"));
                    batch.set(newRef, {
                        studentId: selectedStudent.id,
                        studentName: selectedStudent.name,
                        groupId,
                        lessonId,
                        taskType: taskName, // Nomi ham tursin (zaxira uchun)
                        comment: topic,
                        ...gradeData
                    });
                }
                newSavedStatus[key] = true;
                changeCount++;
            }

            if (changeCount > 0) {
                await batch.commit();
                setSavedStatus(newSavedStatus);
                triggerHaptic('success');
                setTimeout(() => { setIsGradeModalOpen(false); fetchData(true); }, 500);
            } else {
                setIsGradeModalOpen(false);
            }
        } catch (er) { alert("Xatolik: " + er.message); }
    };

    if ((loading || actionLoading) && !isAddStudentOpen && !isMoveModalOpen && !isGradeModalOpen && !isAddLessonOpen) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;

    const displayedStudents = getDisplayedStudents();

    return (
        <div className="min-h-screen bg-slate-50 font-sans touch-manipulation pb-20 md:ml-72 transition-all duration-300">

            {/* HEADER */}
            <GroupHeader
                groupName={groupName}
                studentsCount={students.length}
                refreshing={refreshing}
                onRefresh={handleForceRefresh}
                onDeleteGroup={handleDeleteGroup}
                currentUserRole={currentUserRole}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                navigate={navigate}
                triggerHaptic={triggerHaptic}
            />

            {/* CONTENT */}
            <div className="pt-[140px] px-4 sm:px-6 w-full space-y-6">

                {/* STUDENTS TAB */}
                {activeTab === 'students' && (
                    <StudentsTab
                        displayedStudents={displayedStudents}
                        studentViewMode={studentViewMode}
                        setStudentViewMode={setStudentViewMode}
                        currentUserRole={currentUserRole}
                        setIsAddStudentOpen={setIsAddStudentOpen}
                        openGradeModal={openGradeModal}
                        setSelectedStudent={setSelectedStudent}
                        setTargetGroupId={setTargetGroupId}
                        setIsMoveModalOpen={setIsMoveModalOpen}
                        handleDeleteStudent={handleDeleteStudent}
                    />
                )}

                {/* JOURNAL TAB */}
                {activeTab === 'journal' && (
                    <JournalTab
                        groupedLessons={groupedLessons}
                        lessons={lessons}
                        handleOpenNewLesson={handleOpenNewLesson}
                        handleOpenEditLesson={handleOpenEditLesson}
                        handleDeleteLesson={handleDeleteLesson}
                    />
                )}
            </div>

            {/* MODALS */}
            <GradeModal
                isGradeModalOpen={isGradeModalOpen}
                setIsGradeModalOpen={setIsGradeModalOpen}
                selectedStudent={selectedStudent}
                groupedLessons={groupedLessons}
                modalExpandedMonths={modalExpandedMonths}
                toggleModalMonth={toggleModalMonth}
                existingGradeDocs={existingGradeDocs}
                existingGradeObjects={existingGradeObjects}
                gradeScores={gradeScores}
                savedStatus={savedStatus}
                location={location}
                highlightRef={highlightRef}
                handleScoreChange={handleScoreChange}
                handleDeleteGrade={handleDeleteGrade}
                handleSaveAllGrades={handleSaveAllGrades}
                loading={loading}
                hasChanges={hasChanges}
            />

            <AddStudentModal
                isAddStudentOpen={isAddStudentOpen}
                setIsAddStudentOpen={setIsAddStudentOpen}
                groupId={groupId}
                fetchData={fetchData}
            />

            <LessonModal
                isAddLessonOpen={isAddLessonOpen}
                setIsAddLessonOpen={setIsAddLessonOpen}
                editingLesson={editingLesson}
                setEditingLesson={setEditingLesson}
                lessonDate={lessonDate}
                setLessonDate={setLessonDate}
                lessonTopic={lessonTopic}
                setLessonTopic={setLessonTopic}
                isLessonDelayed={isLessonDelayed}
                setIsLessonDelayed={setIsLessonDelayed}
                lessonTasks={lessonTasks}
                setLessonTasks={setLessonTasks}
                handleSaveLesson={handleSaveLesson}
            />

            <MoveStudentModal
                isMoveModalOpen={isMoveModalOpen}
                setIsMoveModalOpen={setIsMoveModalOpen}
                selectedStudent={selectedStudent}
                allGroups={allGroups}
                groupId={groupId}
                targetGroupId={targetGroupId}
                setTargetGroupId={setTargetGroupId}
                handleMoveStudent={handleMoveStudent}
                loading={actionLoading}
            />
        </div>
    );
};

export default GroupDetails;