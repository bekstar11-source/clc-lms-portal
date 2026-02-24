import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, getDocs, doc, updateDoc,
  serverTimestamp, orderBy, addDoc, deleteDoc
} from 'firebase/firestore';
import {
  X, Trash2, Edit2, Plus, Star,
  Calendar as CalendarIcon, Users, Loader2, Trophy,
  Target, BookOpen, Sparkles, RefreshCw, Search, CheckCircle2
} from 'lucide-react';
import { useTeacherGroups } from '../hooks/useTeacherGroups';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// --- HELPER: UUID FOR TASKS ---
const generateId = () => Math.random().toString(36).substr(2, 9);

// --- FETCHER: students va barcha lessons (lekin grades emas!) ---
const fetchGroupDetails = async (groupId) => {
  const [studSnap, lessonSnap] = await Promise.all([
    getDocs(query(collection(db, 'students'), where('groupId', '==', groupId))),
    getDocs(query(collection(db, 'lessons'), where('groupId', '==', groupId), orderBy('date', 'desc'))),
  ]);

  const normalizedLessons = lessonSnap.docs.map(d => {
    const data = d.data();
    const tasks = (data.tasks || []).map(t => {
      if (typeof t === 'string') return { id: generateId(), text: t, completed: false };
      if (!t.id) return { ...t, id: generateId() };
      return t;
    });
    return { id: d.id, ...data, tasks };
  });

  return {
    students: studSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    lessons: normalizedLessons,
  };
};

// --- FETCHER: faqat ko'rinib turgan 6 ta darsning baholarini yuklash ---
const fetchGradesForLessons = async (lessonIds) => {
  if (!lessonIds || lessonIds.length === 0) return [];
  // Firestore IN clause supports max 30 items. (Bizning sahifada 6 ta).
  const gradeSnap = await getDocs(query(collection(db, 'grades'), where('lessonId', 'in', lessonIds)));
  return gradeSnap.docs.map(d => ({ ...d.data(), id: d.id, score: Number(d.data().score) || 0 }));
};

const Assignments = () => {
  const queryClient = useQueryClient();

  // --- useTeacherGroups hook - barcha guruhlarni yuklaydi ---
  const { groups, loading: groupsLoading, handleForceRefresh } = useTeacherGroups();

  // --- STATE ---
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  // Modals & UI State
  const [editingLesson, setEditingLesson] = useState(null);
  const [newTopic, setNewTopic] = useState('');
  const [newTasks, setNewTasks] = useState([]);

  const [gradingLesson, setGradingLesson] = useState(null);
  const [lessonGrades, setLessonGrades] = useState({});
  const [savingStatus, setSavingStatus] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');

  // ── ADD LESSON MODAL STATE ────────────────────────────────────────────────
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false);
  const [lessonTopic, setLessonTopic] = useState('');
  const [lessonDate, setLessonDate] = useState('');
  const [lessonTasks, setLessonTasks] = useState([{ id: generateId(), text: 'Uyga vazifa', completed: false }]);
  const [isLessonDelayed, setIsLessonDelayed] = useState(false);
  const [addingLesson, setAddingLesson] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Pagination
  const LESSONS_PER_PAGE = 6;
  const [currentPage, setCurrentPage] = useState(1);

  // groups kelishi bilan birinchi guruhni tanlash + BARCHA guruhlarni prefetch qilish
  useEffect(() => {
    if (groups.length === 0) return;

    // Birinchi guruhni tanlash (faqat bir marta)
    if (!selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }

    // ⚡ PREFETCH: Barcha guruhlar uchun ma'lumotni background da yuklash
    // Bu guruhdan guruhga o'tishni darhol tezlashtiradi
    groups.forEach(group => {
      queryClient.prefetchQuery({
        queryKey: ['groupDetails', group.id],
        queryFn: () => fetchGroupDetails(group.id),
        staleTime: 5 * 60 * 1000,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  // Guruh o'zgarganda pagination reset
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGroupId]);

  // --- REACT QUERY: Asosiy baza (O'quvchilar va Darslar) ---
  const {
    data: groupData,
    isLoading: groupLoading,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['groupDetails', selectedGroupId],
    queryFn: () => fetchGroupDetails(selectedGroupId),
    enabled: !!selectedGroupId,
    staleTime: 5 * 60 * 1000,
  });

  const students = useMemo(() => groupData?.students ?? [], [groupData]);
  const lessons = useMemo(() => groupData?.lessons ?? [], [groupData]);

  // Hozirgi sahifada ko'rsatiladigan 6 ta darsning ID'lari
  const visibleLessonIds = useMemo(() => {
    return lessons
      .slice((currentPage - 1) * LESSONS_PER_PAGE, currentPage * LESSONS_PER_PAGE)
      .map(l => l.id);
  }, [lessons, currentPage]);

  // --- REACT QUERY: Faqat ko'rinib turgan sahifadagi darslar baholari ---
  const {
    data: pageGradesArray,
    isLoading: gradesLoading
  } = useQuery({
    queryKey: ['pageGrades', selectedGroupId, visibleLessonIds],
    queryFn: () => fetchGradesForLessons(visibleLessonIds),
    enabled: !!selectedGroupId && visibleLessonIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const pageGrades = useMemo(() => pageGradesArray ?? [], [pageGradesArray]);

  const pageLoading = groupLoading || (gradesLoading && visibleLessonIds.length > 0);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  // --- STATISTICS: Backend dagi averageScore dan olinadi (barcha grade'larni yuklamaslik uchun) ---
  const topStudents = useMemo(() => {
    if (students.length === 0) return [];
    return [...students]
      .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))
      .slice(0, 3)
      .map(s => ({ ...s, avg: s.averageScore || 0 }));
  }, [students]);

  const getLessonProgress = (lessonId) => {
    if (students.length === 0) return 0;
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson || !lesson.tasks) return 0;
    const lessonGradesArr = pageGrades.filter(g => g.lessonId === lessonId);
    const totalPossibleGrades = students.length * lesson.tasks.length;
    if (totalPossibleGrades === 0) return 0;
    return Math.round((lessonGradesArr.length / totalPossibleGrades) * 100);
  };

  const getGroupStyle = (index) => {
    const styles = [
      { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-500', active: 'bg-blue-600 border-blue-600 shadow-blue-200', icon: Users },
      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-500', active: 'bg-emerald-600 border-emerald-600 shadow-emerald-200', icon: Target },
      { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-500', active: 'bg-amber-500 border-amber-500 shadow-amber-200', icon: Star },
      { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-500', active: 'bg-rose-500 border-rose-500 shadow-rose-200', icon: Sparkles },
      { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-500', active: 'bg-violet-600 border-violet-600 shadow-violet-200', icon: BookOpen },
    ];
    return styles[index % styles.length];
  };

  const refreshData = () => {
    handleForceRefresh();
    if (selectedGroupId) {
      queryClient.invalidateQueries({ queryKey: ['groupDetails', selectedGroupId] });
    }
  };

  // --- QUERY CACHE UPDATE (Faqat Grade state ini yangilash) ---
  const updateQueryCache = (type, item) => {
    if (!selectedGroupId || !groupData) return;

    if (type.includes('grade')) {
      // Grade'larni pagination keshiga yozamiz
      queryClient.setQueryData(['pageGrades', selectedGroupId, visibleLessonIds], (old) => {
        if (!old) return old;
        if (type === 'grade_update') return old.map(g => g.id === item.id ? { ...g, score: item.score } : g);
        if (type === 'grade_add') return [...old, item];
        return old;
      });
    } else {
      // Dars va O'quvchilarni groupDetails keshiga yozamiz
      queryClient.setQueryData(['groupDetails', selectedGroupId], (old) => {
        if (!old) return old;
        let newData = { ...old };
        if (type === 'lesson_update') {
          newData.lessons = newData.lessons.map(l => l.id === item.id ? item : l);
        } else if (type === 'lesson_add') {
          newData.lessons = [item, ...newData.lessons];
        } else if (type === 'lesson_delete') {
          newData.lessons = newData.lessons.filter(l => l.id !== item.id);
        }
        return newData;
      });

      // Agar dars o'chirilgan bo'lsa, pageGrades keshidan ham ochirib tashlaymiz
      if (type === 'lesson_delete') {
        queryClient.setQueryData(['pageGrades', selectedGroupId, visibleLessonIds], (old) => {
          if (!old) return old;
          return old.filter(g => g.lessonId !== item.id);
        });
      }
    }
  };

  // ── ADD LESSON HANDLER ────────────────────────────────────────────────────
  const openAddLessonModal = () => {
    setLessonTopic('');
    setLessonDate('');
    setLessonTasks([{ id: generateId(), text: 'Uyga vazifa', completed: false }]);
    setIsLessonDelayed(false);
    setIsAddLessonOpen(true);
  };

  const handleAddLesson = async (e) => {
    if (e) e.preventDefault();
    if (!lessonTopic.trim() || !lessonDate) return alert('Mavzu va sana kiritilishi shart!');
    if (!selectedGroupId) return;

    const cleanTasks = lessonTasks.filter(t => t.text.trim() !== '');
    setAddingLesson(true);
    try {
      const newDoc = await addDoc(collection(db, 'lessons'), {
        groupId: selectedGroupId,
        topic: lessonTopic,
        date: lessonDate,
        tasks: cleanTasks,
        isDelayed: isLessonDelayed,
        createdAt: serverTimestamp(),
      });

      const newLesson = {
        id: newDoc.id,
        groupId: selectedGroupId,
        topic: lessonTopic,
        date: lessonDate,
        tasks: cleanTasks,
        isDelayed: isLessonDelayed,
      };

      updateQueryCache('lesson_add', newLesson);
      setIsAddLessonOpen(false);
    } catch (e) {
      alert('Xatolik: ' + e.message);
    } finally {
      setAddingLesson(false);
    }
  };

  // ── DELETE LESSON + unga tegishli barcha baholar ─────────────────────────
  const handleDeleteLesson = async (lesson) => {
    if (!window.confirm("Bu darsni o'chirib yubormoqchimisiz?\nBarcha baholar ham o'chiriladi!")) return;
    try {
      const lessonGradesDocs = pageGrades.filter(g => g.lessonId === lesson.id);
      const deleteGradePromises = lessonGradesDocs.map(g => deleteDoc(doc(db, 'grades', g.id)));
      await Promise.all([
        deleteDoc(doc(db, 'lessons', lesson.id)),
        ...deleteGradePromises,
      ]);

      updateQueryCache('lesson_delete', lesson);
    } catch (e) {
      alert('Xatolik: ' + e.message);
    }
  };

  // --- 🔥 GRADING LOGIC ---
  const openGradingModal = async (lesson) => {
    setGradingLesson(lesson);
    setStudentSearch('');
    setLessonGrades({});

    const gradesForLesson = pageGrades.filter(g => g.lessonId === lesson.id);
    const loadedGrades = {};

    gradesForLesson.forEach(g => {
      let taskIdKey = g.taskId;
      if (!taskIdKey && lesson.tasks) {
        const foundTask = lesson.tasks.find(t => t.text === g.taskType);
        if (foundTask) taskIdKey = foundTask.id;
      }
      if (taskIdKey) {
        loadedGrades[`${g.studentId}_${taskIdKey} `] = { score: g.score, docId: g.id };
      }
    });
    setLessonGrades(loadedGrades);
  };

  const handleGradeChange = (studentId, taskId, value) => {
    const key = `${studentId}_${taskId} `;
    if (value === '') {
      setLessonGrades(prev => ({ ...prev, [key]: { ...prev[key], score: '' } }));
      return;
    }
    let numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;
    if (numValue > 100) numValue = 100;
    if (numValue < 0) numValue = 0;
    setLessonGrades(prev => ({ ...prev, [key]: { ...prev[key], score: numValue } }));
  };

  const saveGrade = async (studentId, studentName, task, value) => {
    const taskId = task.id;
    const taskName = task.text;
    const key = `${studentId}_${taskId} `;
    const currentEntry = lessonGrades[key];

    if ((value === '' || value === undefined) && !currentEntry?.docId) return;

    setSavingStatus('saving');
    const safeScore = value === '' ? 0 : Number(value);

    let gradeData = {
      score: safeScore,
      date: serverTimestamp(),
      taskId: taskId,
      status: 'active',
      retakeDeadline: null,
    };

    if (safeScore < 60) {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 7);
      gradeData.status = 'retake_needed';
      gradeData.retakeDeadline = deadline;
    }

    try {
      if (currentEntry?.docId) {
        // Bahoni yangilaganda statusini ham yangilaymiz
        await updateDoc(doc(db, 'grades', currentEntry.docId), gradeData);
        updateQueryCache('grade_update', { id: currentEntry.docId, score: safeScore });
      } else {
        const newDoc = await addDoc(collection(db, 'grades'), {
          studentId,
          studentName,
          groupId: selectedGroupId,
          lessonId: gradingLesson.id,
          taskType: taskName,
          comment: gradingLesson.topic,
          ...gradeData,
        });

        setLessonGrades(prev => ({ ...prev, [key]: { score: safeScore, docId: newDoc.id } }));
        updateQueryCache('grade_add', {
          id: newDoc.id,
          studentId,
          taskId,
          taskType: taskName,
          lessonId: gradingLesson.id,
          score: safeScore,
          groupId: selectedGroupId,
        });
      }
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus(null), 1000);
    } catch (e) {
      console.error('Save error:', e);
      setSavingStatus('error');
    }
  };

  const openEditModal = (lesson) => {
    setEditingLesson(lesson);
    setNewTopic(lesson.topic);
    const tasksWithIds = (lesson.tasks || []).map(t => t.id ? t : { ...t, id: generateId() });
    if (tasksWithIds.length === 0) tasksWithIds.push({ id: generateId(), text: 'Homework', completed: false });
    setNewTasks(tasksWithIds);
  };

  // --- 🔥 BATCH UPDATE (TOPIC + TASKS + GRADE taskType sync) ---
  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const lessonRef = doc(db, 'lessons', editingLesson.id);
      await updateDoc(lessonRef, {
        topic: newTopic,
        tasks: newTasks,
        updatedAt: serverTimestamp(),
      });

      const oldTasks = editingLesson.tasks || [];
      const gradeUpdatePromises = [];

      for (const newTask of newTasks) {
        const oldTask = oldTasks.find(t => t.id === newTask.id);
        if (oldTask && oldTask.text !== newTask.text) {
          const changedGrades = pageGrades.filter(
            g => g.lessonId === editingLesson.id && g.taskType === oldTask.text
          );
          for (const grade of changedGrades) {
            gradeUpdatePromises.push(
              updateDoc(doc(db, 'grades', grade.id), { taskType: newTask.text })
            );
          }
        }
      }

      if (gradeUpdatePromises.length > 0) {
        await Promise.all(gradeUpdatePromises);
        // Page grades cache ni ham yangilaymiz
        queryClient.setQueryData(['pageGrades', selectedGroupId, visibleLessonIds], (old) => {
          if (!old) return old;
          return old.map(g => {
            if (g.lessonId !== editingLesson.id) return g;
            const matchedNewTask = newTasks.find(nt => {
              const ot = oldTasks.find(o => o.id === nt.id);
              return ot && ot.text === g.taskType && ot.text !== nt.text;
            });
            return matchedNewTask ? { ...g, taskType: matchedNewTask.text } : g;
          });
        });
      }

      const updatedLesson = { ...editingLesson, topic: newTopic, tasks: newTasks };
      updateQueryCache('lesson_update', updatedLesson);
      setEditingLesson(null);
    } catch (e) {
      alert(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase())
  );

  if (groupsLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-indigo-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 font-sans touch-manipulation">

      {/* 1. HEADER */}
      <div className="bg-white pt-safe pt-4 pb-3 shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="px-4 mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-slate-800 uppercase italic tracking-tight leading-none">Assignments</h1>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
              {pageLoading ? 'Yuklanmoqda...' : lastUpdated ? `Updated: ${lastUpdated}` : 'Syncing...'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openAddLessonModal}
              disabled={!selectedGroupId}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-indigo-700 shadow-md shadow-indigo-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} /> <span className="hidden xs:inline">Yangi</span> Dars
            </button>
            <button
              onClick={refreshData}
              className="p-2 bg-slate-50 text-indigo-600 rounded-xl hover:bg-indigo-50 border border-slate-200 active:scale-95 transition-transform"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="flex overflow-x-auto px-4 gap-2.5 pb-1 no-scrollbar snap-x items-center">
          {groups.map((group, index) => {
            const isActive = selectedGroupId === group.id;
            const style = getGroupStyle(index);
            const Icon = style.icon;

            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className={`snap-center shrink-0 rounded-2xl border transition-all duration-300 ease-in-out flex flex-col justify-center relative overflow-hidden ${isActive
                  ? `w-40 sm:w-48 h-[4.5rem] sm:h-20 px-4 sm:px-5 items-start text-white shadow-lg ${style.active}`
                  : `w-14 sm:w-16 h-14 sm:h-16 items-center hover:bg-opacity-80 ${style.bg} ${style.border} ${style.text}`
                  }`}
              >
                {isActive ? (
                  <>
                    <span className="text-[9px] font-black opacity-80 uppercase tracking-widest mb-0.5">Class</span>
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wide truncate w-full text-left">{group.name}</span>
                    <Icon size={70} className="absolute -right-3 -bottom-3 opacity-10 rotate-12" />
                  </>
                ) : (
                  <Icon size={22} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 2. TASKS LIST */}
        <div className="lg:col-span-2 space-y-3">
          {selectedGroupId && (
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest lg:hidden">All Tasks</h3>
              {lessons.length > 0 && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg ml-auto">
                  {Math.min(currentPage * LESSONS_PER_PAGE, lessons.length)} / {lessons.length} dars
                </span>
              )}
            </div>
          )}

          {/* Loading state for group switch */}
          {pageLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-indigo-400" size={32} />
            </div>
          ) : lessons.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
              <CalendarIcon className="mx-auto text-slate-300 mb-3" size={40} />
              <p className="text-xs font-bold text-slate-400 mb-4">Hozircha darslar yo'q</p>
              <button
                onClick={openAddLessonModal}
                disabled={!selectedGroupId}
                className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-md shadow-indigo-200 active:scale-95 transition-all disabled:opacity-50"
              >
                <Plus size={14} /> Birinchi darsni qo'shish
              </button>
            </div>
          ) : (
            <>
              {lessons
                .slice((currentPage - 1) * LESSONS_PER_PAGE, currentPage * LESSONS_PER_PAGE)
                .map(l => {
                  const progress = getLessonProgress(l.id);
                  return (
                    <div key={l.id} className="bg-white rounded-[1.25rem] sm:rounded-[1.5rem] border border-slate-100 shadow-sm hover:border-indigo-200 transition-all animate-in fade-in overflow-hidden">
                      {/* Card Top: Date + Topic + Actions */}
                      <div className="flex items-center gap-3 p-4 pb-3">
                        {/* Date badge */}
                        <div className="flex flex-col items-center justify-center bg-indigo-50 rounded-xl p-2 min-w-[3.5rem] h-14 border border-indigo-100 shrink-0">
                          <span className="text-[9px] font-black text-indigo-400 uppercase">{l.date.split('-')[1]}</span>
                          <span className="text-xl font-black text-indigo-600 leading-none">{l.date.split('-')[2]}</span>
                        </div>

                        {/* Title + badge */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 text-sm uppercase leading-tight truncate">{l.topic}</h4>
                          {l.isDelayed && (
                            <span className="inline-block text-[9px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-md mt-1">Qoldirildi</span>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-1000 ${progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }}></div>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 shrink-0">{progress}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Tasks tags */}
                      {l.tasks?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                          {l.tasks.map((t, i) => (
                            <div key={i} className="flex items-center bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[9px] text-slate-600 uppercase font-black tracking-wide">
                              <span className="truncate max-w-[120px]">{typeof t === 'object' ? t.text : t}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50/70 border-t border-slate-100">
                        <button
                          onClick={() => openGradingModal(l)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-sm shadow-indigo-200 active:scale-95 transition-transform"
                        >
                          <Star size={11} /> Baho
                        </button>
                        <button
                          onClick={() => openEditModal(l)}
                          className="p-2.5 bg-white text-slate-400 rounded-xl hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-slate-200 active:scale-95"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteLesson(l)}
                          className="p-2.5 bg-white text-slate-400 rounded-xl hover:text-red-500 hover:bg-red-50 transition-all border border-slate-200 active:scale-95"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}

              {/* --- PAGINATION CONTROLS --- */}
              {Math.ceil(lessons.length / LESSONS_PER_PAGE) > 1 && (
                <div className="flex items-center justify-between gap-2 pt-2 pb-1">
                  {/* Prev */}
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-[11px] font-black text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
                  >
                    ← Oldingi
                  </button>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {Array.from({ length: Math.ceil(lessons.length / LESSONS_PER_PAGE) }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 shrink-0 rounded-xl text-[11px] font-black transition-all active:scale-95 shadow-sm ${page === currentPage
                          ? 'bg-indigo-600 text-white shadow-indigo-200'
                          : 'bg-white border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                          }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  {/* Next */}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(lessons.length / LESSONS_PER_PAGE), p + 1))}
                    disabled={currentPage === Math.ceil(lessons.length / LESSONS_PER_PAGE)}
                    className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-[11px] font-black text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
                  >
                    Keyingi →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 3. ANALYTICS (Desktop Only) */}
        <div className="hidden lg:block space-y-6">
          <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm sticky top-32">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={18} className="text-amber-500" />
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Leaderboard</h3>
            </div>
            <div className="space-y-3">
              {topStudents.length === 0 ? <p className="text-xs text-slate-400 italic">No data yet</p> :
                topStudents.map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : 'bg-orange-400'}`}>{i + 1}</div>
                      <span className="text-xs font-bold text-slate-700">{s.name}</span>
                    </div>
                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{s.avg}%</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── ADD LESSON MODAL ─────────────────────────────────────────────────── */}
      {isAddLessonOpen && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddLessonOpen(false)}></div>
          <div className="bg-white w-full max-w-sm h-[80dvh] sm:h-auto rounded-t-[2.5rem] sm:rounded-[2.5rem] relative z-10 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden">

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase text-center italic">Yangi Dars</h3>

              <form id="add-lesson-form" className="space-y-4" onSubmit={handleAddLesson}>
                <input
                  type="date"
                  required
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  value={lessonDate}
                  onChange={e => setLessonDate(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Mavzu Nomi"
                  required
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  value={lessonTopic}
                  onChange={e => setLessonTopic(e.target.value)}
                />

                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div onClick={() => setIsLessonDelayed(!isLessonDelayed)} className={`w-10 h-6 rounded-full p-1 transition-all cursor-pointer ${isLessonDelayed ? 'bg-orange-400' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isLessonDelayed ? 'translate-x-4' : 'translate-x-0'}`}></div>
                  </div>
                  <span className="text-xs font-bold text-slate-500">Darsni keyinga qoldirish</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vazifalar / Uyga vazifa</label>
                    <button
                      type="button"
                      onClick={() => setLessonTasks([...lessonTasks, { id: generateId(), text: '', completed: false }])}
                      className="text-[10px] font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded-lg"
                    >+ Qo'shish</button>
                  </div>
                  {lessonTasks.map((task, idx) => (
                    <div key={task.id} className="flex gap-2">
                      <input
                        type="text"
                        required
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500"
                        value={task.text}
                        onChange={e => {
                          const updated = [...lessonTasks];
                          updated[idx] = { ...updated[idx], text: e.target.value };
                          setLessonTasks(updated);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setLessonTasks(lessonTasks.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600 bg-red-50 p-3 rounded-xl"
                      ><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </form>
            </div>

            <div className="p-4 bg-white border-t border-slate-100 shrink-0 z-50 relative pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <button
                form="add-lesson-form"
                type="submit"
                disabled={addingLesson}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-200 active:scale-95 transition-all disabled:opacity-70"
              >
                {addingLesson ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Darsni Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- GRADING MODAL --- */}
      {gradingLesson && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setGradingLesson(null)}></div>
          <div className="bg-white w-full max-w-5xl h-[92dvh] sm:h-[90vh] flex flex-col relative z-10 shadow-2xl overflow-hidden sm:rounded-[2rem] rounded-t-[2rem] animate-in slide-in-from-bottom duration-300">

            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-800 uppercase italic leading-none">Gradebook</h3>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5 truncate">{gradingLesson.topic}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {savingStatus === 'saving' && <span className="text-[10px] font-black text-orange-500 flex items-center gap-1 hidden sm:flex"><Loader2 size={10} className="animate-spin" /> Saving...</span>}
                {savingStatus === 'saved' && <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1 hidden sm:flex"><CheckCircle2 size={10} /> Saved</span>}
                <button onClick={() => setGradingLesson(null)} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors active:scale-95"><X size={16} /></button>
              </div>
            </div>

            {/* Search + status bar */}
            <div className="px-4 sm:px-6 py-2 bg-white border-b border-slate-100 flex items-center gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  placeholder="O'quvchi qidirish..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>
              {savingStatus === 'saving' && <span className="text-[10px] font-black text-orange-500 flex items-center gap-1 sm:hidden"><Loader2 size={10} className="animate-spin" /></span>}
              {savingStatus === 'saved' && <span className="text-[10px] font-black text-emerald-500 sm:hidden"><CheckCircle2 size={14} /></span>}
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar bg-white">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="p-3 sm:p-4 min-w-[120px] sm:min-w-[150px] text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-200 sticky left-0 z-30">O'quvchi</th>
                    {gradingLesson.tasks?.map((task, idx) => (
                      <th key={idx} className="p-2 sm:p-3 text-center min-w-[80px] sm:min-w-[100px] text-[9px] sm:text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50/30 border-b border-indigo-100 border-l border-slate-100">{typeof task === 'object' ? task.text : task}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStudents.length === 0 ? (
                    <tr><td colSpan={10} className="p-12 text-center text-slate-400 text-xs italic">O'quvchilar topilmadi</td></tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const nameParts = student.name.split(' ');
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="p-2.5 sm:p-3 border-r border-slate-100 bg-white sticky left-0 z-10 group-hover:bg-slate-50/50">
                            <div className="flex flex-col leading-tight">
                              <span className="font-bold text-slate-700 text-xs sm:text-sm">{nameParts[0]}</span>
                              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">{nameParts.slice(1).join(' ')}</span>
                            </div>
                          </td>
                          {gradingLesson.tasks?.map((task, idx) => {
                            const taskId = typeof task === 'object' ? task.id : null;
                            const key = `${student.id}_${taskId} `;
                            const gradeData = lessonGrades[key] || { score: '' };

                            return (
                              <td key={idx} className="p-1.5 sm:p-2 border-l border-slate-50 text-center">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  className={`w-12 sm:w-14 h-10 text-center bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm
                                    ${gradeData.score !== '' && gradeData.score < 60 ? 'bg-red-50 text-red-600 border-red-100' : ''}
                                    ${gradeData.score !== '' && gradeData.score >= 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : ''}
                                  `}
                                  placeholder="-"
                                  value={gradeData.score !== undefined ? gradeData.score : ''}
                                  onChange={(e) => handleGradeChange(student.id, taskId, e.target.value)}
                                  onBlur={(e) => saveGrade(student.id, student.name, task, e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT MODAL --- */}
      {editingLesson && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingLesson(null)}></div>

          <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-sm h-[80dvh] sm:h-auto relative z-10 shadow-2xl animate-in slide-in-from-bottom duration-200 border border-white flex flex-col mt-auto sm:mt-0 overflow-hidden">

            {/* Header */}
            <div className="p-6 shrink-0 border-b border-slate-50">
              <h3 className="text-xl font-black text-slate-800 uppercase text-center italic">Edit Lesson</h3>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Topic</label>
                <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={newTopic} onChange={e => setNewTopic(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tasks</label>
                <div className="space-y-2">
                  {newTasks.map((task, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-indigo-400" value={task.text} onChange={(e) => { const u = [...newTasks]; u[idx].text = e.target.value; setNewTasks(u); }} />
                      <button type="button" onClick={() => setNewTasks(newTasks.filter((_, i) => i !== idx))} className="text-red-400 p-1 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setNewTasks([...newTasks, { id: generateId(), text: '', completed: false }])} className="w-full py-2 border border-dashed border-slate-300 rounded-xl text-slate-400 font-bold text-[10px] hover:border-indigo-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1"><Plus size={14} /> Add Task</button>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0 pb-[calc(2rem+env(safe-area-inset-bottom))]">
              <button onClick={handleUpdate} disabled={isSaving} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-transform">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Assignments;