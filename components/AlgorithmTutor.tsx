
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, AlgorithmTask, AlgorithmSubmission, SubjectCategory } from '../types';
import * as storage from '../services/storageService';
import { Code, CheckCircle, Send, Play, Lock, FileCode, Loader2, ChevronDown, ChevronLeft, ChevronRight, Megaphone, PlusCircle, Terminal, Zap, Trophy, Layout, Cpu, Award, X, Moon, Star, Flame, Clock, Users, Trash2, Edit2, Save, Eye, History, Filter, Calendar } from 'lucide-react';
import { MarkdownText } from './MarkdownText';
import { ToastType } from './Toast';
import { ACHIEVEMENTS } from '../constants';
import { FullScreenEditor } from './FullScreenEditor'; // Assuming reusing or similar

interface Props {
  user: User;
  onCheckIn: (subject: SubjectCategory, content: string, duration?: number) => void;
  onShowToast: (message: string, type: ToastType) => void;
}

const LANGUAGES = {
    'cpp': { name: 'C++ 17', template: '// Write your C++ solution here\n#include <iostream>\nusing namespace std;\n\nclass Solution {\npublic:\n    void solve() {\n        \n    }\n};' },
    'java': { name: 'Java 11', template: '// Write your Java solution here\nimport java.util.*;\n\nclass Solution {\n    public void solve() {\n        \n    }\n}' },
    'python': { name: 'Python 3', template: '# Write your Python solution here\n\nclass Solution:\n    def solve(self):\n        pass' },
    'javascript': { name: 'JavaScript', template: '// Write your JavaScript solution here\n\n/**\n * @param {number[]} nums\n * @return {number}\n */\nvar solve = function(nums) {\n    \n};' }
} as const;

type LanguageKey = keyof typeof LANGUAGES;

// --- Improved Syntax Highlighter ---
const highlightCode = (code: string) => {
    if (!code) return <div className="h-6"></div>; 

    const keywords = /\b(class|public|private|protected|void|int|float|string|bool|if|else|for|while|return|import|using|namespace|function|var|let|const|def|pass|from|true|false|null|new|this)\b/g;
    const types = /\b(Solution|vector|map|set|List|ArrayList|String|Array|Object)\b/g;
    
    return code.split('\n').map((line, i) => {
        let processed = line
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        const commentMatch = processed.match(/(\/\/|#)/);
        let commentIndex = commentMatch ? commentMatch.index : -1;
        
        let codePart = processed;
        let commentPart = '';

        if (commentIndex !== undefined && commentIndex !== -1) {
            codePart = processed.substring(0, commentIndex);
            commentPart = processed.substring(commentIndex);
        }

        codePart = codePart
            .replace(keywords, '<span class="text-purple-400 font-bold">$&</span>')
            .replace(types, '<span class="text-yellow-400">$&</span>');

        if (commentPart) {
            commentPart = `<span class="text-gray-500 italic">${commentPart}</span>`;
        }

        const finalHtml = codePart + commentPart;

        return <div key={i} className="whitespace-pre min-h-[1.5rem]" dangerouslySetInnerHTML={{__html: finalHtml || ' '}} />;
    });
};

export const AlgorithmTutor: React.FC<Props> = ({ user, onCheckIn, onShowToast }) => {
  const [tasks, setTasks] = useState<AlgorithmTask[]>([]);
  // submissions state now stores current user's submissions
  const [mySubmissions, setMySubmissions] = useState<AlgorithmSubmission[]>([]);
  // global submissions for stats
  const [allSubmissions, setAllSubmissions] = useState<AlgorithmSubmission[]>([]);

  const [activeTask, setActiveTask] = useState<string | null>(null);
  
  // Calendar State
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  // Language & Code State
  const [language, setLanguage] = useState<LanguageKey>('cpp');
  const [code, setCode] = useState(''); 

  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Timer State
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  // --- Effects State ---
  const [showBossModal, setShowBossModal] = useState(false);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [newlyUnlocked, setNewlyUnlocked] = useState<any | null>(null); 

  // Modals
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInDuration, setCheckInDuration] = useState<number>(30); 
  const [showSolutionsModal, setShowSolutionsModal] = useState(false);
  const [selectedTaskForSolutions, setSelectedTaskForSolutions] = useState<AlgorithmTask | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<AlgorithmSubmission | null>(null);

  // History Panel State
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [historyFilterDate, setHistoryFilterDate] = useState('');

  // Admin State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(todayStr); // Added Date selection for Admin
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]); 
  const [allUsers, setAllUsers] = useState<User[]>([]); 
  const [isPublishing, setIsPublishing] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Refs for Editor Sync
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlighterRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const isGuest = user.role === 'guest';
  const isAdmin = user.role === 'admin';

  // --- Persistence Logic ---
  useEffect(() => {
      if (!activeTask) return;
      const draftKey = `kaoyan_algo_draft_${user.id}_${activeTask}_${language}`;
      const savedCode = localStorage.getItem(draftKey);
      setCode(savedCode || LANGUAGES[language].template);
      setStartTime(Date.now()); 
      setElapsedTime(0);
  }, [activeTask, language, user.id]);

  useEffect(() => {
      if (!activeTask) return;
      const draftKey = `kaoyan_algo_draft_${user.id}_${activeTask}_${language}`;
      localStorage.setItem(draftKey, code);
  }, [code, activeTask, language, user.id]);

  // Timer Tick
  useEffect(() => {
      if (!activeTask || isGuest) return;
      const interval = setInterval(() => {
          setElapsedTime(Math.floor((Date.now() - startTime) / 60000));
      }, 60000); 
      return () => clearInterval(interval);
  }, [activeTask, startTime, isGuest]);

  useEffect(() => {
    refreshData();
    if (isAdmin) {
        storage.getAllUsers().then(setAllUsers);
    }
  }, [user]);

  // Auto-select first task of selected date
  useEffect(() => {
      const visibleTasks = getFilteredTasks();
      const tasksForDay = visibleTasks.filter(t => t.date === selectedDate);
      
      if (tasksForDay.length > 0) {
          if (!activeTask || !tasksForDay.find(t => t.id === activeTask)) {
              setActiveTask(tasksForDay[0].id);
          }
      } else {
          setActiveTask(null);
      }
  }, [selectedDate, tasks]);

  const handleEditorScroll = () => {
      if (editorRef.current) {
          const { scrollTop, scrollLeft } = editorRef.current;
          if (highlighterRef.current) {
              highlighterRef.current.scrollTop = scrollTop;
              highlighterRef.current.scrollLeft = scrollLeft;
          }
          if (lineNumbersRef.current) {
              lineNumbersRef.current.scrollTop = scrollTop;
          }
      }
  };

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const allTasks = await storage.getAlgorithmTasks();
      setTasks(allTasks);
      const subs = await storage.getAlgorithmSubmissions(user.id);
      setMySubmissions(subs);
      const allSubs = await storage.getAllAlgorithmSubmissions();
      setAllSubmissions(allSubs);
    } catch (e) {
      console.error("Failed to load tasks", e);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredTasks = () => {
      if (isAdmin) return tasks;
      return tasks.filter(t => 
          !t.assignedTo || t.assignedTo.length === 0 || t.assignedTo.includes(user.id)
      );
  }

  const checkAchievements = (currentSubs: AlgorithmSubmission[]) => {
      ACHIEVEMENTS.forEach(ach => {
          if (ach.id === 'night_owl') return;
          if (ach.condition(currentSubs, tasks)) {
              const key = `ach_shown_${user.id}_${ach.id}`;
              if (!localStorage.getItem(key)) {
                  setNewlyUnlocked(ach);
                  localStorage.setItem(key, 'true');
                  setTimeout(() => setNewlyUnlocked(null), 5000);
              }
          }
      });
  };

  const handlePublishOrUpdate = async () => {
    if (!newTaskTitle || !newTaskDesc) return;
    setIsPublishing(true);
    try {
      if (editingTaskId) {
          await storage.updateAlgorithmTask(editingTaskId, {
              title: newTaskTitle,
              description: newTaskDesc,
              date: newTaskDate,
              assignedTo: assignedUsers.length > 0 ? assignedUsers : undefined
          });
          onShowToast("✅ 题目更新成功！", 'success');
          setEditingTaskId(null);
      } else {
          const newTask: AlgorithmTask = {
            id: Date.now().toString(),
            title: newTaskTitle,
            description: newTaskDesc,
            difficulty: 'Medium',
            date: newTaskDate,
            assignedTo: assignedUsers.length > 0 ? assignedUsers : undefined
          };
          await storage.addAlgorithmTask(newTask);
          onShowToast("✅ 题目发布成功！", 'success');
          setActiveTask(newTask.id);
      }
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskDate(todayStr);
      setAssignedUsers([]);
      setShowAdminPanel(false);
      await refreshData();
    } catch (e) {
      onShowToast("操作失败", 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSubmitCode = async () => {
    if (isGuest) return;
    if (!activeTask) return;
    if (!code.trim()) {
        onShowToast("代码不能为空", 'error');
        return;
    }
    setIsRunning(true);
    setTimeout(async () => {
      const duration = Math.max(1, Math.floor((Date.now() - startTime) / 60000));
      const submission: AlgorithmSubmission = {
        taskId: activeTask,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        code: code,
        language: language,
        status: 'Passed',
        timestamp: Date.now(),
        duration: duration
      };
      try {
          await storage.submitAlgorithmCode(submission);
          await refreshData();
          setIsRunning(false);
          setShowBossModal(true);
          const updatedMySubs = [...mySubmissions, submission];
          checkAchievements(updatedMySubs);
      } catch(e) {
          console.error(e);
          onShowToast("提交失败，请重试", 'error');
          setIsRunning(false);
      }
    }, 1200);
  };

  // ... (Helpers and Memos)
  const handleOpenCheckInModal = () => {
      setCheckInDuration(30); 
      setShowCheckInModal(true);
  };

  const confirmCheckIn = () => {
      const content = `## 算法训练打卡 (${selectedDate})\n\n完成了今日所有指定算法任务！\n\n**耗时**: ${checkInDuration} 分钟\n\n继续加油！`;
      onCheckIn(SubjectCategory.ALGORITHM, content, checkInDuration);
      setShowCheckInModal(false);
      onShowToast("打卡成功！", 'success');
  };

  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfWeek = new Date(year, month, 1).getDay();
      return { daysInMonth, firstDayOfWeek, year, month };
  };

  const visibleTasks = useMemo(() => getFilteredTasks(), [tasks, user.id, isAdmin]);

  const dateStatusMap = useMemo(() => {
      const map: Record<string, 'all' | 'partial' | 'none'> = {};
      const uniqueDates = Array.from(new Set(visibleTasks.map(t => t.date)));
      uniqueDates.forEach(date => {
          const dateTasks = visibleTasks.filter(t => t.date === date);
          if (dateTasks.length === 0) return;
          const passedCount = dateTasks.filter(t => 
              mySubmissions.some(s => s.taskId === t.id && s.status === 'Passed')
          ).length;
          if (passedCount === dateTasks.length) map[date] = 'all';
          else if (passedCount > 0) map[date] = 'partial';
          else map[date] = 'none';
      });
      return map;
  }, [visibleTasks, mySubmissions]);

  const selectedDateTasks = useMemo(() => visibleTasks.filter(t => t.date === selectedDate), [visibleTasks, selectedDate]);
  const isSelectedDateToday = selectedDate === todayStr;
  const passedCountForSelectedDate = selectedDateTasks.filter(t => 
    mySubmissions.find(s => s.taskId === t.id && s.status === 'Passed')
  ).length;
  const isSelectedDateAllDone = selectedDateTasks.length > 0 && passedCountForSelectedDate === selectedDateTasks.length;

  const totalAcCount = useMemo(() => {
      const visibleTaskIds = new Set(visibleTasks.map(t => t.id));
      const uniqueSolvedTaskIds = new Set(mySubmissions.filter(s => s.status === 'Passed' && visibleTaskIds.has(s.taskId)).map(s => s.taskId));
      return uniqueSolvedTaskIds.size;
  }, [mySubmissions, visibleTasks]);

  // History Filter
  const filteredHistory = useMemo(() => {
      let filtered = mySubmissions;
      if (historyFilterDate) {
          filtered = filtered.filter(s => {
              const date = new Date(s.timestamp).toISOString().split('T')[0];
              return date === historyFilterDate;
          });
      }
      return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [mySubmissions, historyFilterDate]);

  // ... (Render Functions like Calendar, TaskItem - kept same logic)
  const renderCalendar = () => {
      const { daysInMonth, firstDayOfWeek, year, month } = getDaysInMonth(currentMonth);
      const cells = [];
      const monthStr = String(month + 1).padStart(2, '0');
      for (let i = 0; i < firstDayOfWeek; i++) cells.push(<div key={`empty-${i}`} className="h-7 w-7"></div>);
      for (let d = 1; d <= daysInMonth; d++) {
          const dayStr = String(d).padStart(2, '0');
          const dateStr = `${year}-${monthStr}-${dayStr}`;
          const status = dateStatusMap[dateStr];
          const isSelected = selectedDate === dateStr;
          const isToday = dateStr === todayStr;
          cells.push(
              <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs relative transition-all border ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-110 z-10' : 'bg-white text-gray-600 hover:bg-indigo-50 border-transparent'} ${isToday && !isSelected ? 'text-indigo-600 font-bold border-indigo-200' : ''}`}
              >
                  {d}
                  {status && <div className={`absolute -bottom-1 w-1 h-1 rounded-full ${status === 'all' ? 'bg-green-500' : status === 'partial' ? 'bg-yellow-400' : 'bg-gray-300'}`}></div>}
              </button>
          );
      }
      return cells;
  };

  const renderTaskItem = (task: AlgorithmTask) => {
    const isDone = mySubmissions.some(s => s.taskId === task.id && s.status === 'Passed');
    const isActive = activeTask === task.id;
    // ... Global stats logic ...
    const taskSubmissions = allSubmissions.filter(s => s.taskId === task.id && s.status === 'Passed');
    const uniquePassers = new Set(taskSubmissions.map(s => s.userId)).size;

    return (
        <div 
            key={task.id}
            className={`w-full text-left rounded-xl transition-all border relative overflow-hidden group mb-2.5 flex flex-col ${isActive ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-gray-100 hover:border-indigo-200 hover:bg-white bg-white'}`}
        >
            {isAdmin && (
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-20">
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setEditingTaskId(task.id); 
                            setNewTaskTitle(task.title); 
                            setNewTaskDesc(task.description); 
                            setNewTaskDate(task.date); 
                            setAssignedUsers(task.assignedTo || []); 
                            setShowAdminPanel(true); 
                        }} 
                        className="p-1.5 bg-white text-indigo-600 rounded-md shadow-sm border border-gray-200 hover:bg-indigo-50"
                    >
                        <Edit2 className="w-3 h-3" />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); if(confirm('确认删除?')) { storage.deleteAlgorithmTask(task.id).then(refreshData); } }} 
                        className="p-1.5 bg-white text-red-500 rounded-md shadow-sm border border-gray-200 hover:bg-red-50"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            )}
            <div className="p-3 w-full text-left cursor-pointer" onClick={() => setActiveTask(task.id)}>
                <div className="flex justify-between items-center relative z-10">
                    <span className={`font-bold text-sm truncate pr-2 ${isActive ? 'text-indigo-900' : 'text-gray-700'}`}>{task.title}</span>
                    {isDone ? <div className="bg-green-100 text-green-700 p-0.5 rounded-full"><CheckCircle className="w-3.5 h-3.5" /></div> : <div className="w-4 h-4 rounded-full border-2 border-gray-200 group-hover:border-indigo-200 transition-colors"></div>}
                </div>
                <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${task.difficulty === 'Easy' ? 'bg-green-50 text-green-600 border-green-100' : task.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{task.difficulty}</span>
                        <button onClick={(e) => { e.stopPropagation(); if (isDone || isAdmin) { setSelectedTaskForSolutions(task); setShowSolutionsModal(true); } else { onShowToast("🔒 完成题目后方可查看他人代码", 'info'); } }} className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${isDone || isAdmin ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 cursor-pointer' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-70'}`} title={isDone ? "查看通过记录" : "完成题目后解锁"}>{isDone || isAdmin ? <Users className="w-3 h-3" /> : <Lock className="w-3 h-3" />}{uniquePassers}</button>
                    </div>
                </div>
            </div>
            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-md"></div>}
        </div>
    );
  };

  // ... (Render Main Component)
  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12 relative">
      
      {/* Admin Publish Modal */}
      {showAdminPanel && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
                      <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                          <Megaphone className="w-5 h-5 text-indigo-600" /> 
                          {editingTaskId ? '编辑题目' : '发布新题'}
                      </h3>
                      <button onClick={() => { setShowAdminPanel(false); setEditingTaskId(null); setNewTaskTitle(''); setNewTaskDesc(''); }} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                      <div className="flex gap-4">
                          <div className="flex-1">
                              <label className="block text-sm font-bold text-gray-700 mb-1">题目名称</label>
                              <input 
                                  value={newTaskTitle}
                                  onChange={e => setNewTaskTitle(e.target.value)}
                                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-800"
                                  placeholder="例如: 两数之和"
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">发布日期</label>
                              <div className="relative">
                                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input 
                                      type="date"
                                      value={newTaskDate}
                                      onChange={e => setNewTaskDate(e.target.value)}
                                      className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800 font-mono"
                                  />
                              </div>
                          </div>
                      </div>
                      
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">题目描述 (Markdown)</label>
                          <textarea 
                              value={newTaskDesc}
                              onChange={e => setNewTaskDesc(e.target.value)}
                              className="w-full h-40 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono leading-relaxed resize-none"
                              placeholder="描述题目要求、输入输出样例..."
                          />
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">指定人员 (选填，留空则全员可见)</label>
                          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-gray-100 p-2 rounded-xl bg-gray-50">
                              {allUsers.filter(u => u.role !== 'admin').map(u => (
                                  <button
                                      key={u.id}
                                      onClick={() => {
                                          if (assignedUsers.includes(u.id)) {
                                              setAssignedUsers(assignedUsers.filter(id => id !== u.id));
                                          } else {
                                              setAssignedUsers([...assignedUsers, u.id]);
                                          }
                                      }}
                                      className={`text-xs px-3 py-1.5 rounded-full border transition-all font-bold ${
                                          assignedUsers.includes(u.id) 
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                          : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
                                      }`}
                                  >
                                      {u.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>

                  <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                      <button 
                          onClick={() => { setShowAdminPanel(false); setEditingTaskId(null); }}
                          className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors"
                      >
                          取消
                      </button>
                      <button 
                          onClick={handlePublishOrUpdate}
                          disabled={isPublishing || !newTaskTitle.trim() || !newTaskDesc.trim()}
                          className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all flex items-center gap-2"
                      >
                          {isPublishing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />}
                          {editingTaskId ? '保存修改' : '立即发布'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ... Other Modals ... (Keep existing code) */}
      {showBossModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black cursor-pointer animate-fade-in" onClick={() => setShowBossModal(false)}>
              <div className="text-white text-center"><h1 className="text-8xl md:text-9xl font-black mb-4 tracking-tighter animate-bounce">你太强了</h1><p className="text-gray-400 text-lg">点击任意处关闭</p></div>
          </div>
      )}
      {/* ... Solutions List Modal ... */}
      {showSolutionsModal && selectedTaskForSolutions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-800">通过记录 - {selectedTaskForSolutions.title}</h3><button onClick={() => setShowSolutionsModal(false)}><X className="w-5 h-5 text-gray-400"/></button></div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {allSubmissions.filter(s => s.taskId === selectedTaskForSolutions.id && s.status === 'Passed').length === 0 ? <div className="text-center text-gray-400 py-8">暂无通过记录</div> : allSubmissions.filter(s => s.taskId === selectedTaskForSolutions.id && s.status === 'Passed').sort((a, b) => b.timestamp - a.timestamp).map(sub => (
                              <div key={sub.id} onClick={() => setViewingSubmission(sub)} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-100 transition-all cursor-pointer group">
                                  <div className="flex items-center gap-3"><img src={sub.userAvatar || 'https://api.dicebear.com/7.x/notionists/svg?seed=Unknown'} className="w-8 h-8 rounded-full bg-gray-100" /><div><div className="font-bold text-sm text-gray-800">{sub.userName || 'Unknown'}</div><div className="text-xs text-gray-400 font-mono">{new Date(sub.timestamp).toLocaleDateString()}</div></div></div>
                                  <div className="text-right"><div className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">{sub.duration || '?'} min</div><div className="text-[10px] text-gray-400 mt-1 uppercase">{sub.language}</div></div>
                              </div>
                          ))}
                  </div>
              </div>
          </div>
      )}
      {/* ... Viewer Modal ... */}
      {viewingSubmission && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
              <div className="bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden border border-gray-700">
                  <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-[#252526]"><div className="flex items-center gap-3"><img src={viewingSubmission.userAvatar} className="w-8 h-8 rounded-full bg-gray-600" /><div><div className="font-bold text-gray-200 text-sm">{viewingSubmission.userName} 的提交代码</div><div className="text-xs text-gray-400 flex gap-2"><span>{new Date(viewingSubmission.timestamp).toLocaleString()}</span><span>•</span><span>耗时: {viewingSubmission.duration || '?'} min</span></div></div></div><button onClick={() => setViewingSubmission(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"><X className="w-5 h-5"/></button></div>
                  <div className="flex-1 overflow-auto p-6 bg-[#1e1e1e] font-mono text-sm leading-6 text-gray-300"><pre>{viewingSubmission.code}</pre></div>
              </div>
          </div>
      )}
      {/* ... Achievement Modal ... */}
      {showAchievementModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/95 backdrop-blur-md animate-fade-in p-6">
              <div className="w-full max-w-5xl h-full flex flex-col">
                  <div className="flex justify-between items-center mb-8"><div><h2 className="text-4xl font-black text-white flex items-center gap-3"><Trophy className="w-10 h-10 text-yellow-500" /> 算法成就馆</h2><p className="text-gray-400 mt-2">收集徽章，见证你的算法进阶之路</p></div><button onClick={() => setShowAchievementModal(false)} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-white"><X className="w-6 h-6"/></button></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-10 custom-scrollbar">
                      {ACHIEVEMENTS.map(ach => {
                          const unlocked = ach.id === 'night_owl' ? !!localStorage.getItem(`ach_shown_${user.id}_night_owl`) : ach.condition(mySubmissions, tasks, []);
                          return <div key={ach.id} className={`p-6 rounded-3xl border-2 flex flex-col gap-4 transition-all relative overflow-hidden group ${unlocked ? 'bg-white/10 border-white/20 shadow-2xl shadow-yellow-500/10' : 'bg-black/20 border-white/5 opacity-50 grayscale'}`}><div className={`p-4 rounded-full w-fit shrink-0 relative z-10 ${unlocked ? ach.color : 'bg-gray-800 text-gray-500'}`}><ach.icon className="w-8 h-8" /></div><div className="relative z-10"><h4 className="text-xl font-bold text-white mb-2">{ach.title}</h4><p className="text-gray-400 text-sm leading-relaxed">{ach.description}</p>{unlocked && <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-green-400 bg-green-900/30 px-3 py-1 rounded-full border border-green-800/50"><CheckCircle className="w-3 h-3"/> 已解锁</div>}</div></div>;
                      })}
                  </div>
              </div>
          </div>
      )}
      {/* ... CheckIn Modal ... (Keep existing) */}
      {showCheckInModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 transform scale-100 transition-all"><div className="text-center mb-6"><div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3"><Clock className="w-6 h-6 text-green-600" /></div><h3 className="text-lg font-bold text-gray-800">恭喜全部 AC！</h3><p className="text-gray-500 text-sm mt-1">记录一下今天攻克这些难题花了多久吧</p></div><div className="flex items-center justify-center gap-2 mb-6"><input type="number" value={checkInDuration} onChange={(e) => setCheckInDuration(parseInt(e.target.value) || 0)} className="w-24 text-center text-2xl font-bold border-b-2 border-indigo-200 focus:border-indigo-500 focus:outline-none text-indigo-600" autoFocus /><span className="text-gray-400 font-bold">分钟</span></div><div className="flex gap-3"><button onClick={() => setShowCheckInModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">稍后</button><button onClick={confirmCheckIn} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">确认打卡</button></div></div></div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-6 border border-gray-100 shadow-sm sticky top-0 z-40 backdrop-blur-md bg-white/90">
          <div className="flex items-center gap-4"><div className="bg-indigo-100 p-3 rounded-xl text-indigo-600 shadow-sm"><Terminal className="w-6 h-6" /></div><div><h1 className="text-xl font-bold text-gray-800">算法训练营</h1><p className="text-xs text-gray-500 mt-0.5">LeetCode Style Practice</p></div></div>
          <div className="flex items-center gap-6">
              {isAdmin && (
                  <button onClick={() => { setShowAdminPanel(true); setEditingTaskId(null); setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskDate(todayStr); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all font-bold text-sm active:scale-95">
                      <PlusCircle className="w-4 h-4" /> <span>出题</span>
                  </button>
              )}
              {activeTask && !isGuest && <div className="hidden md:flex flex-col items-end"><span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Time</span><span className={`font-mono font-bold text-lg ${elapsedTime > 60 ? 'text-red-500' : 'text-gray-700'}`}>{Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{Math.floor(elapsedTime % 60).toString().padStart(2, '0')}</span></div>}
              <button onClick={() => setShowAchievementModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-50 to-orange-50 text-yellow-700 rounded-xl border border-yellow-200 hover:shadow-md transition-all font-bold text-sm group"><Award className="w-4 h-4 group-hover:scale-110 transition-transform" /><span>成就馆</span></button>
              <div className="h-8 w-px bg-gray-100 hidden md:block"></div>
              <div className="text-right hidden md:block"><div className="text-xs text-gray-400 font-medium">累计 AC</div><div className="text-2xl font-black text-gray-800 flex items-center justify-end gap-1">{totalAcCount} <Trophy className="w-4 h-4 text-yellow-500 fill-yellow-500" /></div></div>
          </div>
      </div>

      {/* Main Workspace (Keep existing) */}
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-280px)] min-h-[600px]">
        {/* Left Sidebar */}
        <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0">
            {/* Calendar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex justify-between items-center mb-3"><button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronLeft className="w-4 h-4" /></button><div className="text-sm font-bold text-gray-800">{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</div><button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronRight className="w-4 h-4" /></button></div>
                <div className="grid grid-cols-7 gap-1 place-items-center">{renderCalendar()}</div>
            </div>
            {/* Task List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col flex-1 overflow-hidden">
                <div className="px-4 py-3 flex justify-between items-center bg-gray-50 border-b border-gray-100"><div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Layout className="w-3 h-3" /> 任务列表</div><span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-mono">{selectedDateTasks.length}</span></div>
                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-gray-50/30">
                    {isLoading ? <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-400"/></div> : (selectedDateTasks.length > 0 ? selectedDateTasks.map(renderTaskItem) : <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2 opacity-60"><Cpu className="w-8 h-8" /><p className="text-xs">今日无指定任务</p></div>)}
                </div>
                {isSelectedDateToday && selectedDateTasks.length > 0 && <div className="p-3 border-t border-gray-100 bg-white"><button disabled={!isSelectedDateAllDone || isGuest} onClick={handleOpenCheckInModal} className={`w-full py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-all shadow-sm ${isSelectedDateAllDone && !isGuest ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>{isGuest ? <Lock className="w-3 h-3"/> : <Send className="w-3 h-3" />}{isGuest ? '访客不可打卡' : (isSelectedDateAllDone ? '一键算法打卡' : '待完成')}</button></div>}
            </div>
        </div>

        {/* Right Editor (Keep existing) */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden relative">
            {activeTask ? (
            <>
                {/* Description */}
                <div className="h-1/3 min-h-[150px] flex flex-col border-b border-gray-200">
                     <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-3"><h3 className="text-lg font-bold text-gray-800">{visibleTasks.find(t => t.id === activeTask)?.title}</h3><span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">Problem</span></div>
                        <div className="relative group">
                            <select 
                                value={language} 
                                onChange={(e) => setLanguage(e.target.value as LanguageKey)} 
                                className="appearance-none bg-white border border-gray-200 text-gray-700 text-xs font-bold py-1.5 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm hover:border-indigo-300 transition-colors"
                            >
                                {(Object.keys(LANGUAGES) as LanguageKey[]).map((key) => (
                                    <option key={key} value={key}>
                                        {LANGUAGES[key].name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-white prose prose-sm max-w-none prose-indigo"><MarkdownText content={visibleTasks.find(t => t.id === activeTask)?.description || ''} /></div>
                </div>
                {/* Code Editor */}
                <div className="flex-1 flex flex-col relative bg-[#1e1e1e] min-h-0 text-gray-300">
                    <div className="h-8 bg-[#252526] border-b border-[#3e3e42] flex items-center px-4 gap-4 text-xs select-none"><span className="flex items-center gap-1.5 text-blue-400"><FileCode className="w-3 h-3"/> main.{language === 'python' ? 'py' : language === 'javascript' ? 'js' : language === 'java' ? 'java' : 'cpp'}</span><span className="text-gray-600">|</span><span className="text-gray-500">UTF-8</span><span className="ml-auto text-green-500 flex items-center gap-1"><Zap className="w-3 h-3"/> Auto-saved</span></div>
                    <div className="flex-1 relative overflow-hidden flex text-sm font-mono group min-h-0">
                        <div ref={lineNumbersRef} className="w-10 bg-[#1e1e1e] border-r border-[#3e3e42] text-gray-600 text-right py-4 pr-2 select-none shrink-0 leading-6 z-10 overflow-hidden">{(code || '').split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}</div>
                        <div className="flex-1 relative overflow-hidden">
                            <div ref={highlighterRef} className="absolute inset-0 p-4 pointer-events-none whitespace-pre overflow-hidden text-gray-100 leading-6" aria-hidden="true" style={{ fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace' }}>{highlightCode(code)}</div>
                            <textarea ref={editorRef} value={code} onScroll={handleEditorScroll} onChange={e => !isGuest && setCode(e.target.value)} readOnly={isGuest} spellCheck={false} placeholder="// Write your solution here..." className={`absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-white resize-none focus:outline-none whitespace-pre overflow-auto leading-6 selection:bg-blue-500/30 ${isGuest ? 'cursor-not-allowed opacity-50' : ''}`} style={{ fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace' }} />
                        </div>
                        {isGuest && <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px] z-20"><div className="bg-[#252526] px-6 py-4 rounded-xl border border-[#3e3e42] shadow-xl flex flex-col items-center text-gray-400"><Lock className="w-8 h-8 mb-2 text-gray-500" /><p className="font-bold text-sm">访客模式不可编辑</p></div></div>}
                    </div>
                </div>
                {/* Footer */}
                <div className="p-3 border-t border-gray-200 bg-white flex justify-end items-center gap-3"><button className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors" onClick={() => setCode('')}>清空代码</button><button onClick={handleSubmitCode} disabled={isRunning || !code.trim() || isGuest} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2 shadow-md shadow-indigo-200 disabled:opacity-50 disabled:shadow-none">{isRunning ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4 fill-current" />}<span>{isRunning ? '运行中...' : '提交运行'}</span></button></div>
            </>
            ) : <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-gray-50/30"><div className="bg-white p-6 rounded-full shadow-sm mb-4"><Code className="w-12 h-12 text-gray-200" /></div><p className="font-medium text-gray-400">请从左侧选择一道题目开始编码</p></div>}
        </div>
      </div>

      {/* --- My Submissions History Panel --- (Keep existing) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button 
            onClick={() => setShowHistoryPanel(!showHistoryPanel)}
            className="w-full flex justify-between items-center p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"
          >
              <div className="flex items-center gap-2 font-bold text-gray-700 text-sm">
                  <History className="w-4 h-4" /> 我的提交记录
                  <span className="bg-gray-200 text-gray-600 px-2 rounded-full text-xs">{filteredHistory.length}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showHistoryPanel ? 'rotate-180' : ''}`} />
          </button>
          
          {showHistoryPanel && (
              <div className="p-4 border-t border-gray-100 animate-fade-in">
                  <div className="flex justify-end mb-4">
                      <div className="relative">
                          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                          <input 
                            type="date" 
                            value={historyFilterDate}
                            onChange={e => setHistoryFilterDate(e.target.value)}
                            className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          {historyFilterDate && <button onClick={() => setHistoryFilterDate('')} className="ml-2 text-xs text-red-500 hover:underline">清除</button>}
                      </div>
                  </div>
                  
                  <div className="space-y-2">
                      {filteredHistory.length > 0 ? filteredHistory.map(sub => {
                          const taskTitle = tasks.find(t => t.id === sub.taskId)?.title || '未知题目';
                          return (
                              <div key={sub.id} onClick={() => setViewingSubmission(sub)} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all cursor-pointer group">
                                  <div className="flex items-center gap-4">
                                      <div className={`p-2 rounded-lg ${sub.status === 'Passed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                          {sub.status === 'Passed' ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                      </div>
                                      <div>
                                          <div className="font-bold text-sm text-gray-800">{taskTitle}</div>
                                          <div className="text-xs text-gray-400 font-mono mt-0.5">{new Date(sub.timestamp).toLocaleString()}</div>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-4 text-right">
                                      <div className="text-xs text-gray-500 font-mono bg-white border border-gray-200 px-2 py-1 rounded">
                                          {sub.language}
                                      </div>
                                      <div className="text-xs font-bold text-gray-600">
                                          {sub.duration} min
                                      </div>
                                  </div>
                              </div>
                          );
                      }) : (
                          <div className="text-center py-8 text-gray-400 text-xs">暂无记录</div>
                      )}
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};
