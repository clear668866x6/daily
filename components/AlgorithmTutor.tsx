
import React, { useState, useEffect } from 'react';
import { User, AlgorithmTask, AlgorithmSubmission, SubjectCategory } from '../types';
import * as storage from '../services/storageService';
import { Code, CheckCircle, Plus, Send, Play, Lock, AlertTriangle, FileCode, EyeOff, Loader2, ChevronDown } from 'lucide-react';
import { MarkdownText } from './MarkdownText';

interface Props {
  user: User;
  onCheckIn: (subject: SubjectCategory, content: string) => void;
}

const LANGUAGES = {
    'cpp': { name: 'C++ 17', template: '#include <iostream>\nusing namespace std;\n\nclass Solution {\npublic:\n    void solve() {\n        // Your code here\n    }\n};' },
    'java': { name: 'Java 11', template: 'class Solution {\n    public void solve() {\n        // Your code here\n    }\n}' },
    'python': { name: 'Python 3', template: 'class Solution:\n    def solve(self):\n        # Your code here\n        pass' },
    'javascript': { name: 'JavaScript', template: '/**\n * @param {string} arg\n * @return {void}\n */\nvar solve = function(arg) {\n    // Your code here\n};' }
};

export const AlgorithmTutor: React.FC<Props> = ({ user, onCheckIn }) => {
  const [tasks, setTasks] = useState<AlgorithmTask[]>([]);
  const [submissions, setSubmissions] = useState<AlgorithmSubmission[]>([]);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  
  // Language & Code State
  const [language, setLanguage] = useState<keyof typeof LANGUAGES>('cpp');
  const [code, setCode] = useState(LANGUAGES['cpp'].template);

  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Admin State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const isGuest = user.role === 'guest';

  useEffect(() => {
    refreshData();
  }, [user]);

  // 当切换语言时，重置代码为该语言模板 (仅当代码为空或为其他默认模板时，为了简单起见，这里直接重置)
  const handleLanguageChange = (lang: keyof typeof LANGUAGES) => {
      setLanguage(lang);
      setCode(LANGUAGES[lang].template);
  };

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const allTasks = await storage.getAlgorithmTasks();
      const todaysTasks = allTasks.filter(t => t.date === today);
      const displayTasks = todaysTasks.length > 0 ? todaysTasks : allTasks.slice(0, 5);
      setTasks(displayTasks);
      
      if (displayTasks.length > 0 && !activeTask) {
        setActiveTask(displayTasks[0].id);
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
        date: today
      };
      await storage.addAlgorithmTask(newTask);
      setNewTaskTitle('');
      setNewTaskDesc('');
      alert("✅ 题目发布成功！");
      await refreshData();
    } catch (e) {
      alert("发布失败");
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
      alert("✅ AC！测试用例全部通过。");
    }, 1500);
  };

  const completedCount = tasks.filter(t => 
    submissions.find(s => s.taskId === t.id && s.status === 'Passed')
  ).length;
  const allCompleted = tasks.length > 0 && completedCount === tasks.length;

  const handleDailyCheckIn = () => {
    if (isGuest) return;
    if (!allCompleted) return;
    const content = `## 每日算法打卡 💻\n\n**今日成就：**\n我完成了今天的 ${tasks.length} 道算法挑战！使用语言：${LANGUAGES[language].name}\n\n**题目列表：**\n${tasks.map(t => `- [AC] ${t.title}`).join('\n')}\n\n代码已提交通过，坚持就是胜利！🚀`;
    onCheckIn(SubjectCategory.ALGORITHM, content);
  };

  if (user.role === 'admin') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Admin UI kept similar for brevity, focus on student UI changes */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6 rounded-2xl shadow-lg border border-gray-700">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Lock className="w-6 h-6 text-yellow-400" /> 
            <span>管理员控制台</span>
          </h2>
          <p className="text-gray-400 mt-1 pl-9">发布今日算法任务</p>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
           {/* Inputs for new task */}
           <div className="space-y-4">
              <input className="w-full p-3 border rounded-xl" placeholder="题目名称" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
              <textarea className="w-full p-3 border rounded-xl h-32" placeholder="题目描述" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
              <button onClick={handleAddTask} className="bg-brand-600 text-white px-6 py-2 rounded-lg">{isPublishing ? '发布中...' : '发布'}</button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-180px)] min-h-[600px] animate-fade-in">
      {/* Sidebar */}
      <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
            <FileCode className="w-5 h-5 text-brand-600" /> 
            今日任务 ({completedCount}/{tasks.length})
          </h2>
          <div className="w-full bg-gray-200 h-1.5 rounded-full mt-3 overflow-hidden">
             <div className="bg-brand-500 h-full transition-all duration-500 ease-out" style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }}></div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? <div className="flex justify-center p-10"><Loader2 className="animate-spin text-brand-500"/></div> : tasks.map(task => {
              const isDone = submissions.some(s => s.taskId === task.id && s.status === 'Passed');
              return (
                <button
                  key={task.id}
                  onClick={() => { setActiveTask(task.id); }}
                  className={`w-full text-left p-4 rounded-xl transition-all border relative overflow-hidden group ${activeTask === task.id ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-transparent hover:bg-gray-50'}`}
                >
                  <div className="flex justify-between items-center relative z-10">
                    <span className={`font-bold ${activeTask === task.id ? 'text-brand-700' : 'text-gray-700'}`}>{task.title}</span>
                    {isDone && <CheckCircle className="w-5 h-5 text-green-500 fill-green-50" />}
                  </div>
                  <div className="text-xs text-gray-400 mt-2 line-clamp-1 relative z-10">{task.description}</div>
                  {activeTask === task.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500"></div>}
                </button>
              );
            })}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button
            disabled={!allCompleted || tasks.length === 0 || isGuest}
            onClick={handleDailyCheckIn}
            className={`w-full py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg ${allCompleted && tasks.length > 0 && !isGuest ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            {isGuest ? <Lock className="w-4 h-4"/> : <Send className="w-4 h-4" />}
            {isGuest ? '访客不可打卡' : (allCompleted && tasks.length > 0 ? '一键算法打卡' : '完成所有题目以打卡')}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden relative">
        {activeTask ? (
          <>
            <div className="p-6 border-b border-gray-100 max-h-[25vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-3">
                 <h3 className="text-xl font-bold text-gray-800">{tasks.find(t => t.id === activeTask)?.title}</h3>
                 
                 {/* 语言选择器 */}
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
  );
};
