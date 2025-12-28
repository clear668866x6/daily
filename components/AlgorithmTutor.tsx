
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, AlgorithmTask, AlgorithmSubmission, SubjectCategory } from '../types';
import * as storage from '../services/storageService';
import { Code, CheckCircle, Send, Play, Lock, FileCode, Loader2, ChevronDown, ChevronLeft, ChevronRight, Megaphone, PlusCircle, Terminal, Zap, Trophy, Layout, Cpu, Award, X, Moon, Star, Flame, Clock, Users } from 'lucide-react';
import { MarkdownText } from './MarkdownText';
import { ToastType } from './Toast';
import { Fireworks } from './Fireworks'; 

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
};

// --- Achievement Config ---
interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    condition: (submissions: AlgorithmSubmission[], tasks: AlgorithmTask[]) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
    {
        id: 'first_blood',
        title: '初出茅庐',
        description: '成功通过第 1 道算法题',
        icon: Zap,
        color: 'text-yellow-600 bg-yellow-100',
        condition: (s) => s.filter(x => x.status === 'Passed').length >= 1
    },
    {
        id: 'three_streak',
        title: '持之以恒',
        description: '累计 AC 题目达到 3 道',
        icon: Star,
        color: 'text-blue-600 bg-blue-100',
        condition: (s) => new Set(s.filter(x => x.status === 'Passed').map(x => x.taskId)).size >= 3
    },
    {
        id: 'five_kills',
        title: '渐入佳境',
        description: '累计 AC 题目达到 5 道',
        icon: Flame,
        color: 'text-orange-600 bg-orange-100',
        condition: (s) => new Set(s.filter(x => x.status === 'Passed').map(x => x.taskId)).size >= 5
    },
    {
        id: 'master',
        title: '算法大师',
        description: '累计 AC 题目达到 20 道',
        icon: Trophy,
        color: 'text-purple-600 bg-purple-100',
        condition: (s) => new Set(s.filter(x => x.status === 'Passed').map(x => x.taskId)).size >= 20
    },
    {
        id: 'night_owl',
        title: '夜战考研人',
        description: '在深夜 (23:00 - 04:00) 提交并通过代码',
        icon: Moon,
        color: 'text-indigo-600 bg-indigo-100',
        condition: (s) => false 
    }
];

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
  const [submissions, setSubmissions] = useState<AlgorithmSubmission[]>([]);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  
  // Calendar State
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  // Language & Code State
  const [language, setLanguage] = useState<keyof typeof LANGUAGES>('cpp');
  const [code, setCode] = useState(''); 

  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- Effects State ---
  const [showFireworks, setShowFireworks] = useState(false); 
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement | null>(null);

  // Check-in Duration Modal State
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInDuration, setCheckInDuration] = useState<number>(30);

  // Admin State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]); // New: Assignments
  const [allUsers, setAllUsers] = useState<User[]>([]); // New: User List for admin
  const [isPublishing, setIsPublishing] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

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
  }, [activeTask, language, user.id]);

  useEffect(() => {
      if (!activeTask) return;
      const draftKey = `kaoyan_algo_draft_${user.id}_${activeTask}_${language}`;
      localStorage.setItem(draftKey, code);
  }, [code, activeTask, language, user.id]);

  useEffect(() => {
    refreshData();
    if (isAdmin) {
        storage.getAllUsers().then(setAllUsers);
    }
  }, [user]);

  // Auto-select first task of selected date
  useEffect(() => {
      const tasksForDay = tasks.filter(t => t.date === selectedDate);
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
      
      if (allTasks.length > 0 && !activeTask) {
        const todayTask = allTasks.find(t => t.date === todayStr);
        setActiveTask(todayTask ? todayTask.id : allTasks[0].id);
      }
      const subs = storage.getAlgorithmSubmissions(user.id);
      setSubmissions(subs);
    } catch (e) {
      console.error("Failed to load tasks", e);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAchievements = (currentSubs: AlgorithmSubmission[]) => {
      // 1. Regular Check
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

      // 2. Night Owl Check
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 23 || hour <= 4) {
          const key = `ach_shown_${user.id}_night_owl`;
          if (!localStorage.getItem(key)) {
              const ach = ACHIEVEMENTS.find(a => a.id === 'night_owl');
              if (ach) {
                  setNewlyUnlocked(ach);
                  localStorage.setItem(key, 'true');
                  setTimeout(() => setNewlyUnlocked(null), 5000);
              }
          }
      }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle || !newTaskDesc) return;
    setIsPublishing(true);
    try {
      const newTask: AlgorithmTask = {
        id: Date.now().toString(),
        title: newTaskTitle,
        description: newTaskDesc,
        difficulty: 'Medium',
        date: todayStr,
        assignedTo: assignedUsers.length > 0 ? assignedUsers : undefined
      };
      await storage.addAlgorithmTask(newTask);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setAssignedUsers([]);
      onShowToast("✅ 题目发布成功！", 'success');
      await refreshData();
      setSelectedDate(todayStr);
      setActiveTask(newTask.id);
    } catch (e) {
      onShowToast("发布失败", 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const toggleUserAssignment = (userId: string) => {
      setAssignedUsers(prev => 
          prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      );
  }

  const handleSubmitCode = async () => {
    if (isGuest) return;
    if (!activeTask) return;
    if (!code.trim()) {
        onShowToast("代码不能为空", 'error');
        return;
    }

    setIsRunning(true);
    
    // Simulate submission delay
    setTimeout(() => {
      const submission: AlgorithmSubmission = {
        taskId: activeTask,
        userId: user.id,
        code: code,
        language: language,
        status: 'Passed'
      };
      storage.submitAlgorithmCode(submission);
      
      const newSubs = [...submissions.filter(s => s.taskId !== activeTask), submission];
      setSubmissions(newSubs);
      setIsRunning(false);
      
      onShowToast("✅ 提交成功！AC！", 'success');
      
      // Trigger Fireworks
      setShowFireworks(true);
      setTimeout(() => setShowFireworks(false), 6000);

      // Check achievements
      checkAchievements(newSubs);

    }, 1200);
  };

  // --- Calendar & Stats Helpers ---
  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfWeek = new Date(year, month, 1).getDay();
      return { daysInMonth, firstDayOfWeek, year, month };
  };

  const dateStatusMap = useMemo(() => {
      const map: Record<string, 'all' | 'partial' | 'none'> = {};
      const uniqueDates = Array.from(new Set(tasks.map(t => t.date)));
      
      uniqueDates.forEach(date => {
          const dateTasks = tasks.filter(t => t.date === date);
          if (dateTasks.length === 0) return;
          const passedCount = dateTasks.filter(t => 
              submissions.some(s => s.taskId === t.id && s.status === 'Passed')
          ).length;
          if (passedCount === dateTasks.length) map[date] = 'all';
          else if (passedCount > 0) map[date] = 'partial';
          else map[date] = 'none';
      });
      return map;
  }, [tasks, submissions]);

  const selectedDateTasks = useMemo(() => tasks.filter(t => t.date === selectedDate), [tasks, selectedDate]);
  const isSelectedDateToday = selectedDate === todayStr;
  const passedCountForSelectedDate = selectedDateTasks.filter(t => 
    submissions.find(s => s.taskId === t.id && s.status === 'Passed')
  ).length;
  const isSelectedDateAllDone = selectedDateTasks.length > 0 && passedCountForSelectedDate === selectedDateTasks.length;

  const totalAcCount = useMemo(() => {
      const uniqueSolvedTaskIds = new Set(submissions.filter(s => s.status === 'Passed').map(s => s.taskId));
      return uniqueSolvedTaskIds.size;
  }, [submissions]);

  const handleOpenCheckInModal = () => {
      if (isGuest) return;
      if (!isSelectedDateToday) return;
      if (!isSelectedDateAllDone) return;
      setShowCheckInModal(true);
  }

  const confirmCheckIn = () => {
    const content = `## 每日算法打卡 💻\n\n**今日成就：**\n我完成了 ${selectedDate} 的 ${selectedDateTasks.length} 道算法挑战！使用语言：${LANGUAGES[language].name}\n\n**题目列表：**\n${selectedDateTasks.map(t => `- [AC] ${t.title}`).join('\n')}\n\n**耗时：** ${checkInDuration} 分钟\n\n代码已提交通过，坚持就是胜利！🚀`;
    onCheckIn(SubjectCategory.ALGORITHM, content, checkInDuration);
    setShowCheckInModal(false);
  };

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
                  className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs relative transition-all border
                      ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-110 z-10' : 'bg-white text-gray-600 hover:bg-indigo-50 border-transparent'}
                      ${isToday && !isSelected ? 'text-indigo-600 font-bold border-indigo-200' : ''}
                  `}
              >
                  {d}
                  {status && (
                      <div className={`absolute -bottom-1 w-1 h-1 rounded-full
                          ${status === 'all' ? 'bg-green-500' : status === 'partial' ? 'bg-yellow-400' : 'bg-gray-300'}
                      `}></div>
                  )}
              </button>
          );
      }
      return cells;
  };

  const renderTaskItem = (task: AlgorithmTask) => {
    const isDone = submissions.some(s => s.taskId === task.id && s.status === 'Passed');
    const isActive = activeTask === task.id;
    // Highlight assigned tasks
    const isAssigned = task.assignedTo && task.assignedTo.includes(user.id);

    return (
        <button
            key={task.id}
            onClick={() => { setActiveTask(task.id); }}
            className={`w-full text-left p-3 rounded-xl transition-all border relative overflow-hidden group mb-2.5 
                ${isActive 
                    ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' 
                    : 'border-gray-100 hover:border-indigo-200 hover:bg-white bg-white'
                }`}
        >
            <div className="flex justify-between items-center relative z-10">
                <span className={`font-bold text-sm truncate pr-2 ${isActive ? 'text-indigo-900' : 'text-gray-700'}`}>{task.title}</span>
                {isDone ? (
                    <div className="bg-green-100 text-green-700 p-0.5 rounded-full"><CheckCircle className="w-3.5 h-3.5" /></div>
                ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-200 group-hover:border-indigo-200 transition-colors"></div>
                )}
            </div>
            <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                        task.difficulty === 'Easy' ? 'bg-green-50 text-green-600 border-green-100' :
                        task.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                        'bg-red-50 text-red-600 border-red-100'
                    }`}>
                        {task.difficulty}
                    </span>
                    {isAssigned && (
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-200">
                            指定
                        </span>
                    )}
                </div>
                <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(task.date).getDate()}日
                </span>
            </div>
            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-md"></div>}
        </button>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12 relative">
      
      {/* 🎆 Fireworks Overlay */}
      <Fireworks active={showFireworks} onClose={() => setShowFireworks(false)} />

      {/* 🏆 Achievement Unlock Popup */}
      {newlyUnlocked && (
          <div className="fixed top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] animate-bounce-in pointer-events-none">
              <div className="bg-white/95 backdrop-blur px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border-2 border-yellow-400 text-center ring-4 ring-yellow-400/20">
                  <div className={`p-4 rounded-full ${newlyUnlocked.color} shadow-lg mb-2`}>
                      <newlyUnlocked.icon className="w-10 h-10" />
                  </div>
                  <div>
                      <div className="text-yellow-500 font-black text-xs uppercase tracking-[0.2em] mb-1">New Achievement</div>
                      <div className="font-bold text-2xl text-gray-800">{newlyUnlocked.title}</div>
                      <div className="text-sm text-gray-500 mt-1 font-medium">{newlyUnlocked.description}</div>
                  </div>
              </div>
          </div>
      )}

      {/* Time Input Modal */}
      {showCheckInModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 transform scale-100 transition-all">
                  <div className="text-center mb-6">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Clock className="w-6 h-6 text-green-600" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">恭喜全部 AC！</h3>
                      <p className="text-gray-500 text-sm mt-1">记录一下今天攻克这些难题花了多久吧</p>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 mb-6">
                      <input 
                          type="number" 
                          value={checkInDuration} 
                          onChange={(e) => setCheckInDuration(parseInt(e.target.value) || 0)}
                          className="w-24 text-center text-2xl font-bold border-b-2 border-indigo-200 focus:border-indigo-500 focus:outline-none text-indigo-600"
                          autoFocus
                      />
                      <span className="text-gray-400 font-bold">分钟</span>
                  </div>

                  <div className="flex gap-3">
                      <button onClick={() => setShowCheckInModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                          稍后
                      </button>
                      <button onClick={confirmCheckIn} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
                          确认打卡
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-6 border border-gray-100 shadow-sm sticky top-0 z-40 backdrop-blur-md bg-white/90">
          <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600 shadow-sm">
                  <Terminal className="w-6 h-6" />
              </div>
              <div>
                  <h1 className="text-xl font-bold text-gray-800">算法训练营</h1>
                  <p className="text-xs text-gray-500 mt-0.5">LeetCode Style Practice</p>
              </div>
          </div>
          <div className="flex items-center gap-6">
              <button 
                onClick={() => setShowAchievementModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-50 to-orange-50 text-yellow-700 rounded-xl border border-yellow-200 hover:shadow-md transition-all font-bold text-sm group"
              >
                  <Award className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>成就馆</span>
              </button>
              
              <div className="h-8 w-px bg-gray-100 hidden md:block"></div>
              
              <div className="text-right hidden md:block">
                  <div className="text-xs text-gray-400 font-medium">累计 AC</div>
                  <div className="text-2xl font-black text-gray-800 flex items-center justify-end gap-1">
                      {totalAcCount} <Trophy className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  </div>
              </div>
              
              <div className="h-8 w-px bg-gray-100 hidden md:block"></div>
              
              <div className="text-right">
                   <div className="text-xs text-gray-400 font-medium">今日进度</div>
                   <div className="flex items-center gap-2">
                       <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                           <div 
                                className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out"
                                style={{width: `${selectedDateTasks.length > 0 ? (passedCountForSelectedDate/selectedDateTasks.length)*100 : 0}%`}}
                           ></div>
                       </div>
                       <span className="text-xs font-bold text-gray-700">{passedCountForSelectedDate}/{selectedDateTasks.length}</span>
                   </div>
              </div>
          </div>
      </div>

      {/* Admin Panel */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm border border-dashed border-indigo-200 overflow-hidden">
             <div 
                className="bg-indigo-50/50 px-6 py-3 flex justify-between items-center cursor-pointer hover:bg-indigo-50 transition-colors"
                onClick={() => setShowAdminPanel(!showAdminPanel)}
             >
                 <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                     <Megaphone className="w-4 h-4" /> 管理员发题通道
                 </div>
                 <ChevronDown className={`w-4 h-4 text-indigo-400 transition-transform ${showAdminPanel ? 'rotate-180' : ''}`} />
             </div>
             
             {showAdminPanel && (
                 <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-4 bg-white">
                     <div className="md:col-span-8 space-y-3">
                         <input 
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                            placeholder="题目名称 (例如: LeetCode 1. 两数之和)" 
                            value={newTaskTitle} 
                            onChange={e => setNewTaskTitle(e.target.value)} 
                        />
                         <textarea 
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none font-mono" 
                            placeholder="题目描述 (支持 Markdown)" 
                            value={newTaskDesc} 
                            onChange={e => setNewTaskDesc(e.target.value)} 
                        />
                        {/* Assignment Selector */}
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                            <h4 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1"><Users className="w-3 h-3"/> 指定完成人 (不选默认全员可选)</h4>
                            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar">
                                {allUsers.filter(u => u.role !== 'admin').map(u => (
                                    <button 
                                        key={u.id}
                                        onClick={() => toggleUserAssignment(u.id)}
                                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                                            assignedUsers.includes(u.id) 
                                            ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-bold' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-200'
                                        }`}
                                    >
                                        {u.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                     </div>
                     <div className="md:col-span-4 flex items-end">
                         <button 
                            onClick={handleAddTask} 
                            disabled={isPublishing}
                            className="w-full h-full max-h-[140px] bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md flex flex-col items-center justify-center gap-2"
                         >
                            {isPublishing ? <Loader2 className="animate-spin w-6 h-6"/> : <PlusCircle className="w-8 h-8" />}
                            <span>{isPublishing ? '发布中...' : '发布题目'}</span>
                         </button>
                     </div>
                 </div>
             )}
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-280px)] min-h-[600px]">
        
        {/* Left Sidebar */}
        <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0">
            {/* Calendar Widget */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex justify-between items-center mb-3">
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronLeft className="w-4 h-4" /></button>
                    <div className="text-sm font-bold text-gray-800">
                        {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
                    </div>
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronRight className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 place-items-center">
                    {renderCalendar()}
                </div>
            </div>

            {/* Task List Widget */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col flex-1 overflow-hidden">
                <div className="px-4 py-3 flex justify-between items-center bg-gray-50 border-b border-gray-100">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                        <Layout className="w-3 h-3" /> 任务列表
                    </div>
                    <span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                        {selectedDateTasks.length}
                    </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-gray-50/30">
                    {isLoading ? (
                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-400"/></div> 
                    ) : (
                        <>
                            {selectedDateTasks.length > 0 ? (
                                selectedDateTasks.map(renderTaskItem)
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2 opacity-60">
                                    <Cpu className="w-8 h-8" />
                                    <p className="text-xs">今日休整</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Check-in Action */}
                {isSelectedDateToday && selectedDateTasks.length > 0 && (
                    <div className="p-3 border-t border-gray-100 bg-white">
                        <button
                            disabled={!isSelectedDateAllDone || isGuest}
                            onClick={handleOpenCheckInModal}
                            className={`w-full py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-all shadow-sm ${
                                isSelectedDateAllDone && !isGuest 
                                ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-200' 
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {isGuest ? <Lock className="w-3 h-3"/> : <Send className="w-3 h-3" />}
                            {isGuest ? '访客不可打卡' : (isSelectedDateAllDone ? '一键算法打卡' : '待完成')}
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Right Editor */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden relative">
            {activeTask ? (
            <>
                {/* Task Description Panel */}
                <div className="h-1/3 min-h-[150px] flex flex-col border-b border-gray-200">
                     <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-gray-800">{tasks.find(t => t.id === activeTask)?.title}</h3>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">Problem</span>
                        </div>
                        
                        <div className="relative group">
                            <select 
                                value={language}
                                onChange={(e) => setLanguage(e.target.value as keyof typeof LANGUAGES)}
                                className="appearance-none bg-white border border-gray-200 text-gray-700 text-xs font-bold py-1.5 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm hover:border-indigo-300 transition-colors"
                            >
                                {(Object.keys(LANGUAGES) as Array<keyof typeof LANGUAGES>).map((key) => (
                                    <option key={key} value={key}>{LANGUAGES[key].name}</option>
                                ))}
                            </select>
                            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-white prose prose-sm max-w-none prose-indigo">
                        <MarkdownText content={tasks.find(t => t.id === activeTask)?.description || ''} />
                    </div>
                </div>
                
                {/* Code Editor Panel - Dark Mode IDE Style */}
                <div className="flex-1 flex flex-col relative bg-[#1e1e1e] min-h-0 text-gray-300">
                    <div className="h-8 bg-[#252526] border-b border-[#3e3e42] flex items-center px-4 gap-4 text-xs select-none">
                        <span className="flex items-center gap-1.5 text-blue-400"><FileCode className="w-3 h-3"/> main.{language === 'python' ? 'py' : language === 'javascript' ? 'js' : language === 'java' ? 'java' : 'cpp'}</span>
                        <span className="text-gray-600">|</span>
                        <span className="text-gray-500">UTF-8</span>
                        <span className="ml-auto text-green-500 flex items-center gap-1"><Zap className="w-3 h-3"/> Auto-saved</span>
                    </div>

                    <div className="flex-1 relative overflow-hidden flex text-sm font-mono group min-h-0">
                        {/* Line Numbers */}
                        <div 
                            ref={lineNumbersRef}
                            className="w-10 bg-[#1e1e1e] border-r border-[#3e3e42] text-gray-600 text-right py-4 pr-2 select-none shrink-0 leading-6 z-10 overflow-hidden"
                        >
                            {(code || '').split('\n').map((_, i) => (
                                <div key={i}>{i + 1}</div>
                            ))}
                        </div>

                        {/* Editor Layers */}
                        <div className="flex-1 relative overflow-hidden">
                            {/* Highlight Layer */}
                            <div 
                                ref={highlighterRef}
                                className="absolute inset-0 p-4 pointer-events-none whitespace-pre overflow-hidden text-gray-100 leading-6" 
                                aria-hidden="true"
                                style={{ fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace' }}
                            >
                                {highlightCode(code)}
                            </div>

                            {/* Input Layer */}
                            <textarea
                                ref={editorRef}
                                value={code}
                                onScroll={handleEditorScroll}
                                onChange={e => !isGuest && setCode(e.target.value)}
                                readOnly={isGuest}
                                spellCheck={false}
                                placeholder="// Write your solution here..."
                                className={`absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-white resize-none focus:outline-none whitespace-pre overflow-auto leading-6 selection:bg-blue-500/30 ${isGuest ? 'cursor-not-allowed opacity-50' : ''}`}
                                style={{ fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace' }}
                            />
                        </div>

                        {isGuest && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px] z-20">
                                <div className="bg-[#252526] px-6 py-4 rounded-xl border border-[#3e3e42] shadow-xl flex flex-col items-center text-gray-400">
                                    <Lock className="w-8 h-8 mb-2 text-gray-500" />
                                    <p className="font-bold text-sm">访客模式不可编辑</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Action Bar */}
                <div className="p-3 border-t border-gray-200 bg-white flex justify-end items-center gap-3">
                    <button
                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                        onClick={() => setCode('')}
                    >
                        清空代码
                    </button>
                    <button
                        onClick={handleSubmitCode}
                        disabled={isRunning || !code.trim() || isGuest}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2 shadow-md shadow-indigo-200 disabled:opacity-50 disabled:shadow-none"
                    >
                        {isRunning ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4 fill-current" />}
                        <span>{isRunning ? '运行中...' : '提交运行'}</span>
                    </button>
                </div>
            </>
            ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-gray-50/30">
                <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                    <Code className="w-12 h-12 text-gray-200" />
                </div>
                <p className="font-medium text-gray-400">请从左侧选择一道题目开始编码</p>
            </div>
            )}
        </div>
      </div>

      {/* Achievement Hall Modal */}
      {showAchievementModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden relative transform transition-all">
                  <button onClick={() => setShowAchievementModal(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors z-10"><X className="w-4 h-4 text-gray-500"/></button>
                  
                  {/* Modal Header */}
                  <div className="p-8 pb-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                      <div className="flex items-center gap-3 mb-2">
                          <div className="bg-yellow-100 p-2 rounded-xl">
                              <Award className="w-6 h-6 text-yellow-600" />
                          </div>
                          <h2 className="text-2xl font-black text-gray-800">算法成就馆</h2>
                      </div>
                      <p className="text-gray-500 text-sm">收集徽章，见证你的算法进阶之路</p>
                  </div>

                  {/* Badges Grid */}
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar bg-white">
                      {ACHIEVEMENTS.map(ach => {
                          let unlocked = false;
                          if (ach.id === 'night_owl') {
                              unlocked = !!localStorage.getItem(`ach_shown_${user.id}_night_owl`);
                          } else {
                              unlocked = ach.condition(submissions, tasks);
                          }

                          return (
                              <div key={ach.id} className={`p-4 rounded-2xl border flex items-center gap-4 transition-all relative overflow-hidden group ${
                                  unlocked 
                                  ? 'bg-white border-gray-200 shadow-sm opacity-100 hover:border-yellow-300 hover:shadow-md' 
                                  : 'bg-gray-50 border-gray-100 opacity-60 grayscale'
                              }`}>
                                  <div className={`p-3 rounded-full shrink-0 relative z-10 ${unlocked ? ach.color : 'bg-gray-200 text-gray-400'}`}>
                                      <ach.icon className="w-6 h-6" />
                                  </div>
                                  <div className="relative z-10">
                                      <h4 className="font-bold text-gray-800">{ach.title}</h4>
                                      <p className="text-xs text-gray-500 mt-0.5">{ach.description}</p>
                                      {unlocked && <div className="mt-1 text-[10px] font-bold text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> 已解锁</div>}
                                  </div>
                                  {unlocked && <div className="absolute top-0 right-0 p-10 bg-gradient-to-br from-yellow-50 to-transparent rounded-full -mr-10 -mt-10 z-0 opacity-50"></div>}
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}

      <style>{`
        .animate-bounce-in {
            animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        @keyframes bounceIn {
            0% { transform: translate(-50%, -150%) scale(0.5); opacity: 0; }
            60% { transform: translate(-50%, 10%) scale(1.05); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
