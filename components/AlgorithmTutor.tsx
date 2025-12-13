
import React, { useState, useEffect, useMemo } from 'react';
import { User, AlgorithmTask, AlgorithmSubmission, SubjectCategory } from '../types';
import * as storage from '../services/storageService';
import { Code, CheckCircle, Send, Play, Lock, FileCode, Loader2, ChevronDown, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Megaphone, PlusCircle } from 'lucide-react';
import { MarkdownText } from './MarkdownText';
import { ToastType } from './Toast';

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
  const [code, setCode] = useState(LANGUAGES['cpp'].template);

  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Admin State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(true);

  const isGuest = user.role === 'guest';
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    refreshData();
  }, [user]);

  // 当选择的日期改变时，自动选中当天的第一题（如果有）
  useEffect(() => {
      const tasksForDay = tasks.filter(t => t.date === selectedDate);
      if (tasksForDay.length > 0) {
          // 如果当前选中的任务不在今天的列表里，切换到今天的第一个
          if (!activeTask || !tasksForDay.find(t => t.id === activeTask)) {
              setActiveTask(tasksForDay[0].id);
          }
      } else {
          setActiveTask(null);
      }
  }, [selectedDate, tasks]);

  const handleLanguageChange = (lang: keyof typeof LANGUAGES) => {
      setLanguage(lang);
      setCode(LANGUAGES[lang].template);
  };

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const allTasks = await storage.getAlgorithmTasks();
      setTasks(allTasks);
      
      // 初始选中
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
      // 刷新数据，确保新题目立即显示在下方列表中
      await refreshData();
      // 自动选中新题目
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
      onShowToast("✅ AC！测试用例全部通过。", 'success');
    }, 1500);
  };

  // --- Calendar Logic ---
  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sunday
      return { daysInMonth, firstDayOfWeek, year, month };
  };

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  // 计算每一天的状态 (全部完成、部分完成、未完成)
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

  // 当前选中日期的任务
  const selectedDateTasks = useMemo(() => {
      return tasks.filter(t => t.date === selectedDate);
  }, [tasks, selectedDate]);

  // Check-in logic (Only for today)
  const isSelectedDateToday = selectedDate === todayStr;
  const passedCountForSelectedDate = selectedDateTasks.filter(t => 
    submissions.find(s => s.taskId === t.id && s.status === 'Passed')
  ).length;
  const isSelectedDateAllDone = selectedDateTasks.length > 0 && passedCountForSelectedDate === selectedDateTasks.length;

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

      // Empty slots for start of month
      for (let i = 0; i < firstDayOfWeek; i++) {
          cells.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
      }

      // Days
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
                  className={`h-8 w-8 rounded-full flex flex-col items-center justify-center text-xs relative transition-all
                      ${isSelected ? 'bg-brand-600 text-white shadow-md z-10' : 'text-gray-700 hover:bg-gray-100'}
                      ${isToday && !isSelected ? 'text-brand-600 font-bold border border-brand-200' : ''}
                  `}
              >
                  {d}
                  {/* Status Dot */}
                  {status && (
                      <div className={`w-1 h-1 rounded-full mt-0.5
                          ${status === 'all' ? 'bg-green-500' : status === 'partial' ? 'bg-yellow-400' : 'bg-gray-300'}
                          ${isSelected ? 'bg-white' : ''}
                      `}></div>
                  )}
              </button>
          );
      }
      return cells;
  };

  // 渲染题目列表项辅助函数
  const renderTaskItem = (task: AlgorithmTask) => {
    const isDone = submissions.some(s => s.taskId === task.id && s.status === 'Passed');
    const isActive = activeTask === task.id;
    return (
        <button
            key={task.id}
            onClick={() => { setActiveTask(task.id); }}
            className={`w-full text-left p-3 rounded-xl transition-all border relative overflow-hidden group mb-2 ${isActive ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-transparent hover:bg-gray-50'}`}
        >
            <div className="flex justify-between items-center relative z-10">
                <span className={`font-bold text-sm ${isActive ? 'text-brand-700' : 'text-gray-700'}`}>{task.title}</span>
                {isDone && <CheckCircle className="w-4 h-4 text-green-500 fill-green-50" />}
            </div>
            <div className="flex justify-between items-center mt-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    task.difficulty === 'Easy' ? 'bg-green-50 text-green-600 border-green-100' :
                    task.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                    'bg-red-50 text-red-600 border-red-100'
                }`}>
                    {task.difficulty}
                </span>
            </div>
            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500"></div>}
        </button>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-10">
      
      {/* Admin Panel (Merged) */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
             <div 
                className="bg-indigo-50 px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-indigo-100 transition-colors"
                onClick={() => setShowAdminPanel(!showAdminPanel)}
             >
                 <div className="flex items-center gap-3">
                     <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
                        <Megaphone className="w-5 h-5" />
                     </div>
                     <div>
                         <h3 className="font-bold text-indigo-900">管理员发布控制台</h3>
                         <p className="text-xs text-indigo-600">发布题目后，下方列表将立即更新</p>
                     </div>
                 </div>
                 <ChevronDown className={`w-5 h-5 text-indigo-400 transition-transform ${showAdminPanel ? 'rotate-180' : ''}`} />
             </div>
             
             {showAdminPanel && (
                 <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-4 bg-white border-t border-indigo-100">
                     <div className="md:col-span-8 space-y-3">
                         <input 
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                            placeholder="题目名称 (例如: LeetCode 1. 两数之和)" 
                            value={newTaskTitle} 
                            onChange={e => setNewTaskTitle(e.target.value)} 
                        />
                         <textarea 
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none" 
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
                            <span>{isPublishing ? '发布中...' : '立即发布题目'}</span>
                         </button>
                     </div>
                 </div>
             )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-280px)] min-h-[600px]">
        {/* Sidebar with Calendar */}
        <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            {/* Calendar Widget */}
            <div className="p-4 border-b border-gray-100 bg-white z-10">
                <div className="flex justify-between items-center mb-4 px-1">
                    <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-full text-gray-500"><ChevronLeft className="w-4 h-4" /></button>
                    <div className="text-sm font-bold text-gray-800">
                        {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
                    </div>
                    <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-full text-gray-500"><ChevronRight className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                    {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                        <div key={d} className="text-[10px] text-gray-400 font-medium h-6 flex items-center justify-center">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1 place-items-center">
                    {renderCalendar()}
                </div>
            </div>

            {/* Task List Header */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                <FileCode className="w-4 h-4 text-brand-600" /> 
                {isSelectedDateToday ? '今日挑战' : `${selectedDate} 题目`}
            </h2>
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{selectedDateTasks.length} 题</span>
            </div>
            
            {/* Task List */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-white">
            {isLoading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-brand-500"/></div> 
            ) : (
                <>
                    {selectedDateTasks.length > 0 ? (
                        selectedDateTasks.map(renderTaskItem)
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                            <CalendarIcon className="w-8 h-8 opacity-20" />
                            <p className="text-xs">当日暂无训练题目</p>
                        </div>
                    )}
                </>
            )}
            </div>

            {/* Check-in Button */}
            {isSelectedDateToday && selectedDateTasks.length > 0 && (
                <div className="p-4 border-t border-gray-100 bg-gray-50">
                <button
                    disabled={!isSelectedDateAllDone || isGuest}
                    onClick={handleDailyCheckIn}
                    className={`w-full py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg ${isSelectedDateAllDone && !isGuest ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                    {isGuest ? <Lock className="w-4 h-4"/> : <Send className="w-4 h-4" />}
                    {isGuest ? '访客不可打卡' : (isSelectedDateAllDone ? '一键算法打卡' : '完成今日题目以打卡')}
                </button>
                </div>
            )}
        </div>

        {/* Editor */}
        <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden relative">
            {activeTask ? (
            <>
                <div className="p-6 border-b border-gray-100 max-h-[25vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xl font-bold text-gray-800">{tasks.find(t => t.id === activeTask)?.title}</h3>
                    
                    <div className="relative">
                        <select 
                            value={language}
                            onChange={(e) => handleLanguageChange(e.target.value as any)}
                            className="appearance-none bg-gray-100 border border-gray-200 text-gray-700 text-sm font-mono py-1.5 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                        >
                            {Object.entries(LANGUAGES).map(([key, conf]) => (
                                <option key={key} value={key}>{conf.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl text-gray-700 text-sm leading-relaxed border border-gray-100">
                    <MarkdownText content={tasks.find(t => t.id === activeTask)?.description || ''} />
                </div>
                </div>
                
                <div className="flex-1 bg-[#1e1e1e] p-4 font-mono text-sm relative group">
                <textarea
                    value={code}
                    onChange={e => !isGuest && setCode(e.target.value)}
                    readOnly={isGuest}
                    className={`w-full h-full bg-transparent text-gray-200 resize-none focus:outline-none leading-relaxed ${isGuest ? 'cursor-not-allowed opacity-70' : ''}`}
                    spellCheck={false}
                />
                {isGuest && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none">
                    <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-xl border border-white/20 flex flex-col items-center text-white shadow-2xl">
                        <Lock className="w-8 h-8 mb-2" />
                        <p className="font-bold">访客模式</p>
                    </div>
                    </div>
                )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end items-center">
                <button
                    onClick={handleSubmitCode}
                    disabled={isRunning || !code.trim() || isGuest}
                    className="bg-brand-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-md"
                >
                    {isRunning ? '运行中...' : <><Play className="w-4 h-4 fill-current" /> 提交运行</>}
                </button>
                </div>
            </>
            ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                <Code className="w-16 h-16 text-gray-200 mb-4" />
                <p>请选择题目</p>
            </div>
            )}
        </div>
      </div>
    </div>
  );
};
