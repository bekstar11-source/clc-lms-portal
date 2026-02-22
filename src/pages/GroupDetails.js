import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useGroupData } from '../hooks/useGroupData';
import { useGroupActions } from '../hooks/useGroupActions';
import GroupHeader from '../components/group/GroupHeader';
import StudentsTab from '../components/group/StudentsTab';
import JournalTab from '../components/group/JournalTab';
import GradeModal from '../components/group/GradeModal';
import AddStudentModal from '../components/group/AddStudentModal';
import LessonModal from '../components/group/LessonModal';
import MoveStudentModal from '../components/group/MoveStudentModal';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const triggerHaptic = (type = 'tap') => {
    if (navigator.vibrate) {
        if (type === 'tap') navigator.vibrate(10);
        if (type === 'success') navigator.vibrate([10, 50, 10]);
        if (type === 'error') navigator.vibrate([50, 100, 50]);
    }
};

const getAvatarUrl = (seed) => {
    const safeSeed = seed || 'default';
    const cleanSeed = safeSeed.replace('bot_', '');
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${cleanSeed}&backgroundColor=e0e7ff,d1fae5,ffedd5`;
};

const generateId = () => Math.random().toString(36).substr(2, 9);

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

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const GroupDetails = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const highlightRef = useRef(null);

    // ── Data layer ────────────────────────────────────────────────────────────
    const {
        groupName, students, lessons, allGroups,
        currentUserRole, loading, refreshing, fetchData,
    } = useGroupData(groupId);

    const groupedLessons = groupLessonsByMonth(lessons);

    const actions = useGroupActions({
        groupId,
        lessons,
        groupedLessons,
        fetchData,
        navigate,
        triggerHaptic,
    });

    // ── UI state ──────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('students');
    const [studentViewMode, setStudentViewMode] = useState('list');
    const [modalExpandedMonths, setModalExpandedMonths] = useState({});

    // Modal open/close flags
    const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
    const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
    const [isAddLessonOpen, setIsAddLessonOpen] = useState(false);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

    // Move-student helper
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [targetGroupId, setTargetGroupId] = useState('');

    // Lesson form state
    const [lessonTopic, setLessonTopic] = useState('');
    const [lessonDate, setLessonDate] = useState('');
    const [lessonTasks, setLessonTasks] = useState([
        { id: generateId(), text: 'Uyga vazifa', completed: false },
    ]);
    const [isLessonDelayed, setIsLessonDelayed] = useState(false);
    const [editingLesson, setEditingLesson] = useState(null);

    // ── Redirect if group not found ───────────────────────────────────────────
    useEffect(() => {
        if (!loading && !groupName) navigate('/');
    }, [loading, groupName, navigate]);

    // ── Auto-open grade modal when navigated with a student id ────────────────
    useEffect(() => {
        if (location.state?.openStudentId && students.length > 0) {
            const target = students.find(s => s.id === location.state.openStudentId);
            if (target) {
                handleOpenGradeModal(target);
                setTimeout(() => {
                    if (highlightRef.current) {
                        highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        highlightRef.current.focus();
                    }
                }, 800);
            }
        }
    }, [students, location.state]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── EVENT HANDLERS ───────────────────────────────────────────────────────

    const handleForceRefresh = () => {
        triggerHaptic();
        fetchData(true);
    };

    // Grade modal

    const handleOpenGradeModal = (student) => {
        setSelectedStudent(student);
        setIsGradeModalOpen(true);
        actions.openGradeModal(student, setModalExpandedMonths);
    };

    const handleSaveAllGrades = (e) => {
        e.preventDefault();
        actions.handleSaveAllGrades(selectedStudent, () => setIsGradeModalOpen(false));
    };

    const toggleModalMonth = (month) => {
        triggerHaptic();
        setModalExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));
    };

    // Lesson modal

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
        if (tasksWithIds.length === 0) {
            tasksWithIds.push({ id: generateId(), text: 'Uyga vazifa', completed: false });
        }
        setEditingLesson({ ...lesson, tasks: tasksWithIds });
        setLessonTopic(lesson.topic);
        setLessonDate(lesson.date);
        setLessonTasks(tasksWithIds);
        setIsLessonDelayed(lesson.isDelayed || false);
        setIsAddLessonOpen(true);
    };

    const handleSaveLesson = (e) => {
        if (e) e.preventDefault();
        const cleanTasks = lessonTasks.filter(t => t.text.trim() !== '');
        actions.handleSaveLesson({
            lessonTopic,
            lessonDate,
            cleanTasks,
            isLessonDelayed,
            editingLesson,
            onSuccess: () => {
                setIsAddLessonOpen(false);
                setEditingLesson(null);
            },
        });
    };

    // Move-student modal

    const handleMoveStudent = () => {
        actions.handleMoveStudent(selectedStudent, targetGroupId, () => setIsMoveModalOpen(false));
    };

    // ─── DERIVED DATA ─────────────────────────────────────────────────────────

    const getDisplayedStudents = () => {
        const list = [...students];
        if (studentViewMode === 'leaderboard') return list.sort((a, b) => b.gameXp - a.gameXp);
        return list;
    };

    const displayedStudents = getDisplayedStudents();

    // ─── LOADING GUARD ────────────────────────────────────────────────────────

    if (
        (loading || actions.actionLoading) &&
        !isAddStudentOpen && !isMoveModalOpen && !isGradeModalOpen && !isAddLessonOpen
    ) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
            </div>
        );
    }

    // ─── RENDER ───────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-slate-50 font-sans touch-manipulation pb-20 md:ml-72 transition-all duration-300">

            {/* HEADER */}
            <GroupHeader
                groupName={groupName}
                studentsCount={students.length}
                refreshing={refreshing}
                onRefresh={handleForceRefresh}
                onDeleteGroup={() => actions.handleDeleteGroup(groupName, currentUserRole)}
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
                        openGradeModal={handleOpenGradeModal}
                        setSelectedStudent={setSelectedStudent}
                        setTargetGroupId={setTargetGroupId}
                        setIsMoveModalOpen={setIsMoveModalOpen}
                        handleDeleteStudent={actions.handleDeleteStudent}
                    />
                )}

                {/* JOURNAL TAB */}
                {activeTab === 'journal' && (
                    <JournalTab
                        groupedLessons={groupedLessons}
                        lessons={lessons}
                        handleOpenNewLesson={handleOpenNewLesson}
                        handleOpenEditLesson={handleOpenEditLesson}
                        handleDeleteLesson={actions.handleDeleteLesson}
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
                existingGradeDocs={actions.existingGradeDocs}
                existingGradeObjects={actions.existingGradeObjects}
                gradeScores={actions.gradeScores}
                savedStatus={actions.savedStatus}
                location={location}
                highlightRef={highlightRef}
                handleScoreChange={actions.handleScoreChange}
                handleDeleteGrade={actions.handleDeleteGrade}
                handleSaveAllGrades={handleSaveAllGrades}
                loading={loading}
                hasChanges={actions.hasChanges}
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
                loading={actions.actionLoading}
            />
        </div>
    );
};

export default GroupDetails;