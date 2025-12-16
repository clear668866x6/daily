
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, AlgorithmTask, AlgorithmSubmission, SubjectCategory } from '../types';
import * as storage from '../services/storageService';
import { Code, CheckCircle, Send, Play, Lock, FileCode, Loader2, ChevronDown, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Megaphone, PlusCircle, Terminal, Zap, Trophy, Layout, Cpu } from 'lucide-react';
import { MarkdownText } from './MarkdownText';
import { ToastType } from './Toast';
import { Fireworks } from './Fireworks'; // Added Import

interface Props {
  user: User;
  onCheckIn: (subject: SubjectCategory, content: string) => void;
  onShowToast: (message: string, type: ToastType) => void;
}

const LANGUAGES = {
    'cpp': { name: 'C++ 17', template: '#include <iostream>\nusing namespace std;\n\nclass Solution {\npublic:\n    void solve() {\n        // Your code here\n    }\n};' },
    'java': { name: 'Java 11', template: 'class Solution {\n    public void solve() {\n        // Your code here\n    }\n}' },
    'python': { name: 'Python 3', template: 'class Solution:\n    def solve(self):\n        # Your code here\n        pass' },
    'javascript': { name: 'JavaScript', template: '/**\n * @param {string} arg\n * @return {void}\n */\nvar solve = function(arg) {\n    // Your code here\n};' }
};

// --- Simple Syntax Highlighter Helper ---
const highlightCode = (code: string) => {
    // Basic keywords for C++/Java/JS/Python
    const keywords = /\b(class|public|private|protected|void|int|float|string|bool|if|else|for|while|return|import|using|namespace|function|var|let|const|def|pass|from|true|false|null|new|this)\b/g;
    const types = /\b(Solution|vector|map|set|List|ArrayList|String|Array|Object)\b/g;
    const comments = /(\/\/.*|\/\*[\s\S]*?\*\/|#.*)/g;
    
    // Split by newlines to handle per-line rendering
    return code.split('\n').map((line, i) => {
        let processed = line
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Apply simplistic coloring
        processed = processed.replace(comments, '<span class="text-gray-400 italic">$&</span>');
        // Only highlight keywords if not inside a comment span (simple heuristic)
        if (!processed.includes('span class="text-gray-400"')) {
             processed = processed
                .replace(keywords, '<span class="text-purple-600 font-bold">$&</span>')
                .replace(types, '<span class="text-yellow-600">$&</span>');
        }
        
        return <div key={i} className="whitespace-pre" dangerouslySetInnerHTML={{__html: processed || ' '}} />;
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
  const [code, setCode] = useState(''); // Initial empty, loaded by effect

  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showFireworks, setShowFireworks] = useState(false); // Fireworks State
  
  // Admin State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // UI State
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const isGuest = user.role === 'guest';
  const isAdmin = user.role === 'admin';

  // --- Persistence Logic ---

  // 1. Load Draft when task or language changes
  useEffect(() => {
      if (!activeTask) return;
      const draftKey = `kaoyan_algo_draft_${user.id}_${activeTask}_${language}`;
      const savedCode = localStorage.getItem(draftKey);
      
      if (savedCode) {
          setCode(savedCode);
      } else {
          setCode(LANGUAGES[language].template);
      }
  }, [activeTask, language, user.id]);

  // 2. Save Draft when code changes
  useEffect(() => {
      if (!activeTask || !code) return;
      // Debounce saving slightly or just save on every change (localStorage is fast enough for text)
      const draftKey = `kaoyan_algo_draft_${user.id}_${activeTask}_${language}`;
      localStorage.setItem(draftKey, code);
  }, [code, activeTask, language, user.id]);


  useEffect(() => {
    refreshData();
  }, [user]);

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

  const handleAddTask = async () => {
    if (!newTaskTitle || !newTaskDesc) return;
    setIsPublishing(true);
    try {
      const newTask: AlgorithmTask = {
        id: Date.now().toString(),
        title: newTaskTitle,
        description: newTaskDesc,
        difficulty: 'Medium',
        date: todayStr
      };
      await storage.addAlgorithmTask(newTask);
      setNewTaskTitle('');
      setNewTaskDesc('');
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

  const handleSubmitCode = async () => {
    if (isGuest) return;
    if (!activeTask) return;
    setIsRunning(true);
    
    // Simulate server delay
    setTimeout(() => {
      const submission: AlgorithmSubmission = {
        taskId: activeTask,
        userId: user.id,
        code: code,
        language: language,
        status: 'Passed'
      };
      storage.submitAlgorithmCode(submission);
      setSubmissions(prev => {
        const filtered = prev.filter(s => s.taskId !== activeTask);
        return [...filtered, submission];
      });
      setIsRunning(false);
      
      // Trigger Fireworks
      onShowToast("✅ AC！测试用例全部通过。", 'success');
      setShowFireworks(true);
      setTimeout(() => setShowFireworks(false), 4000); // Stop after 4s

    }, 1200);
  };

  // --- Calendar & Stats ---
  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfWeek = new Date(year, month, 1).getDay();
      return { daysInMonth, firstDayOfWeek, year, month };
  };

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

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

  const selectedDateTasks = useMemo(() => {
      return tasks.filter(t => t.date === selectedDate);
  }, [tasks, selectedDate]);

  const isSelectedDateToday = selectedDate === todayStr;
  const passedCountForSelectedDate = selectedDateTasks.filter(t => 
    submissions.find(s => s.taskId === t.id && s.status === 'Passed')
  ).length;
  const isSelectedDateAllDone = selectedDateTasks.length > 0 && passedCountForSelectedDate === selectedDateTasks.length;

  const totalAcCount = useMemo(() => {
      const uniqueSolvedTaskIds = new Set(submissions.filter(s => s.status === 'Passed').map(s => s.taskId));
      return uniqueSolvedTaskIds.size;
  }, [submissions]);

  const handleDailyCheckIn = () => {
    if (isGuest) return;
    if (!isSelectedDateToday) return;
    if (!isSelectedDateAllDone) return;
    
    const content = `## 每日算法打卡 💻\n\n**今日成就：**\n我完成了 ${selectedDate} 的 ${selectedDateTasks.length} 道算法挑战！使用语言：${LANGUAGES[language].name}\n\n**题目列表：**\n${selectedDateTasks.map(t => `- [AC] ${t.title}`).join('\n')}\n\n代码已提交通过，坚持就是胜利！🚀`;
    onCheckIn(SubjectCategory.ALGORITHM, content);
  };

  const renderCalendar = () => {
      const { daysInMonth, firstDayOfWeek, year, month } = getDaysInMonth(currentMonth);
      const cells = [];
      const monthStr = String(month + 1).padStart(2, '0');

      for (let i = 0; i < firstDayOfWeek; i++) {
          cells.push(<div key={`empty-${i}`} className="h-7 w-7"></div>);
      }

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
                    <CheckCircle className="w-4 h-4 text-green-500 fill-green-100" />
                ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-200"></div>
                )}
            </div>
            <div className="flex justify-between items-center mt-2">
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    task.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                    task.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                }`}>
                    {task.difficulty}
                </span>
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
      
      {/* Fireworks Overlay */}
      <Fireworks active={showFireworks} />

      {/* Header Stats */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
                  <Terminal className="w-6 h-6" />
              </div>
              <div>
                  <h1 className="text-xl font-bold text-gray-800">算法训练营</h1>
                  <p className="text-xs text-gray-500 mt-1">Daily Algorithm Challenge</p>
              </div>
          </div>
          <div className="flex items-center gap-6">
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
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
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
        
        {/* Left Sidebar: Mission Control */}
        <div className="w-full lg:w-80 bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col overflow-hidden shrink-0">
            {/* Calendar */}
            <div className="p-4 border-b border-gray-200 bg-white">
                <div className="flex justify-between items-center mb-3">
                    <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronLeft className="w-4 h-4" /></button>
                    <div className="text-sm font-bold text-gray-800">
                        {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
                    </div>
                    <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronRight className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 place-items-center">
                    {renderCalendar()}
                </div>
            </div>

            {/* Task List Header */}
            <div className="px-4 py-3 flex justify-between items-center bg-gray-100/50 border-b border-gray-200">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <Layout className="w-3 h-3" /> 任务列表
                </div>
                <span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                    {selectedDateTasks.length}
                </span>
            </div>
            
            {/* Task List */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-gray-50/50">
                {isLoading ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-400"/></div> 
                ) : (
                    <>
                        {selectedDateTasks.length > 0 ? (
                            selectedDateTasks.map(renderTaskItem)
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2 opacity-60">
                                <Cpu className="w-8 h-8" />
                                <p className="text-xs">休整日</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Check-in Action */}
            {isSelectedDateToday && selectedDateTasks.length > 0 && (
                <div className="p-3 bg-white border-t border-gray-200">
                    <button
                        disabled={!isSelectedDateAllDone || isGuest}
                        onClick={handleDailyCheckIn}
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

        {/* Right Editor: Coding Deck */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden relative">
            {activeTask ? (
            <>
                {/* Task Details Header */}
                <div className="h-1/3 min-h-[150px] flex flex-col border-b border-gray-200">
                     <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/30">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-gray-800">{tasks.find(t => t.id === activeTask)?.title}</h3>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">Description</span>
                        </div>
                        
                        <div className="relative group">
                            <select 
                                value={language}
                                onChange={(e) => setLanguage(e.target.value as any)}
                                className="appearance-none bg-white border border-gray-200 text-gray-700 text-xs font-bold py-1.5 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm hover:border-indigo-300 transition-colors"
                            >
                                {Object.entries(LANGUAGES).map(([key, conf]) => (
                                    <option key={key} value={key}>{conf.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-white prose prose-sm max-w-none prose-indigo">
                        <MarkdownText content={tasks.find(t => t.id === activeTask)?.description || ''} />
                    </div>
                </div>
                
                {/* Code Editor Area */}
                <div className="flex-1 flex flex-col relative bg-white">
                    {/* Toolbar */}
                    <div className="h-8 bg-gray-50 border-b border-gray-200 flex items-center px-4 gap-4 text-xs text-gray-500 select-none">
                        <span className="flex items-center gap-1.5"><FileCode className="w-3 h-3"/> main.{language === 'python' ? 'py' : language === 'javascript' ? 'js' : language === 'java' ? 'java' : 'cpp'}</span>
                        <span className="text-gray-300">|</span>
                        <span>UTF-8</span>
                        <span className="ml-auto text-green-600 flex items-center gap-1"><Zap className="w-3 h-3"/> Auto-saved</span>
                    </div>

                    <div className="flex-1 relative overflow-hidden flex text-sm font-mono">
                        {/* Line Numbers */}
                        <div className="w-10 bg-gray-50 border-r border-gray-100 text-gray-400 text-right py-4 pr-2 select-none shrink-0 leading-6">
                            {code.split('\n').map((_, i) => (
                                <div key={i}>{i + 1}</div>
                            ))}
                        </div>

                        {/* Editor Container */}
                        <div className="flex-1 relative">
                            {/* Syntax Highlight Layer (Bottom) */}
                            <div className="absolute inset-0 p-4 pointer-events-none leading-6 whitespace-pre overflow-hidden text-gray-800" aria-hidden="true">
                                {highlightCode(code)}
                            </div>

                            {/* Textarea Layer (Top, Transparent Text, Visible Caret) */}
                            <textarea
                                ref={editorRef}
                                value={code}
                                onChange={e => !isGuest && setCode(e.target.value)}
                                readOnly={isGuest}
                                spellCheck={false}
                                className={`absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-black resize-none focus:outline-none leading-6 selection:bg-indigo-100 selection:text-transparent ${isGuest ? 'cursor-not-allowed opacity-50' : ''}`}
                                style={{fontFamily: 'inherit'}}
                            />
                        </div>

                        {/* Guest Overlay */}
                        {isGuest && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px] z-20">
                                <div className="bg-white px-6 py-4 rounded-xl border border-gray-200 shadow-xl flex flex-col items-center text-gray-500">
                                    <Lock className="w-8 h-8 mb-2 text-gray-300" />
                                    <p className="font-bold text-sm">访客模式不可编辑</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-3 border-t border-gray-200 bg-white flex justify-end items-center gap-3">
                    <button
                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                        onClick={() => setCode(LANGUAGES[language].template)}
                    >
                        重置代码
                    </button>
                    <button
                        onClick={handleSubmitCode}
                        disabled={isRunning || !code.trim() || isGuest}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2 shadow-md shadow-indigo-100 disabled:opacity-50 disabled:shadow-none"
                    >
                        {isRunning ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4 fill-current" />}
                        <span>{isRunning ? '运行中...' : '提交运行'}</span>
                    </button>
                </div>
            </>
            ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-gray-50/30">
                <Code className="w-20 h-20 mb-6 opacity-20" />
                <p className="font-medium text-gray-400">请从左侧选择一道题目开始编码</p>
            </div>
            )}
        </div>
      </div>
    </div>
  );
};
