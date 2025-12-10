
import React, { useState, useEffect } from 'react';
import { User, AlgorithmTask, AlgorithmSubmission, SubjectCategory } from '../types';
import * as storage from '../services/storageService';
import { Code, CheckCircle, Plus, Send, Play, Lock, AlertTriangle, FileCode, EyeOff } from 'lucide-react';
import { MarkdownText } from './MarkdownText';

interface Props {
  user: User;
  onCheckIn: (subject: SubjectCategory, content: string) => void;
}

export const AlgorithmTutor: React.FC<Props> = ({ user, onCheckIn }) => {
  const [tasks, setTasks] = useState<AlgorithmTask[]>([]);
  const [submissions, setSubmissions] = useState<AlgorithmSubmission[]>([]);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  
  // Admin State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const isGuest = user.role === 'guest';

  useEffect(() => {
    refreshData();
  }, [user]);

  const refreshData = () => {
    const allTasks = storage.getAlgorithmTasks();
    const todaysTasks = allTasks.filter(t => t.date === today);
    setTasks(todaysTasks);
    
    // 如果今天有题且未选中，默认选第一个
    if (todaysTasks.length > 0 && !activeTask) {
      setActiveTask(todaysTasks[0].id);
    }

    const subs = storage.getAlgorithmSubmissions(user.id);
    setSubmissions(subs);
  };

  const handleAddTask = () => {
    if (!newTaskTitle || !newTaskDesc) return;
    const newTask: AlgorithmTask = {
      id: Date.now().toString(),
      title: newTaskTitle,
      description: newTaskDesc,
      difficulty: 'Medium',
      date: today
    };
    storage.addAlgorithmTask(newTask);
    setNewTaskTitle('');
    setNewTaskDesc('');
    alert("✅ 题目发布成功！学生现在可以看到这道题了。");
    refreshData();
  };

  const handleSubmitCode = async () => {
    if (isGuest) return; // 访客无法触发
    if (!activeTask) return;
    setIsRunning(true);
    
    // 模拟代码编译运行
    setTimeout(() => {
      const submission: AlgorithmSubmission = {
        taskId: activeTask,
        userId: user.id,
        code: code,
        status: 'Passed'
      };
      storage.submitAlgorithmCode(submission);
      setSubmissions(prev => {
        // 更新本地状态以立即反映
        const filtered = prev.filter(s => s.taskId !== activeTask);
        return [...filtered, submission];
      });
      setIsRunning(false);
      setCode('');
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
    const content = `## 每日算法打卡 💻\n\n**今日成就：**\n我完成了今天的 ${tasks.length} 道算法挑战！\n\n**题目列表：**\n${tasks.map(t => `- [AC] ${t.title}`).join('\n')}\n\n代码已提交通过，坚持就是胜利！🚀`;
    onCheckIn(SubjectCategory.ALGORITHM, content);
  };

  // --- Admin View ---
  if (user.role === 'admin') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6 rounded-2xl shadow-lg border border-gray-700">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Lock className="w-6 h-6 text-yellow-400" /> 
            <span>管理员控制台</span>
          </h2>
          <p className="text-gray-400 mt-1 pl-9">发布今日算法任务，当前日期: <span className="text-white font-mono">{today}</span></p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 text-lg">
            <Plus className="w-5 h-5 text-brand-600" />
            发布新题目
          </h3>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">题目名称</label>
              <input
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
                placeholder="例如：LeetCode 206. 反转链表"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">题目描述 (支持 Markdown)</label>
              <textarea
                className="w-full p-4 border border-gray-200 rounded-xl h-40 focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all font-mono text-sm"
                placeholder="请输入题目描述、输入输出示例..."
                value={newTaskDesc}
                onChange={e => setNewTaskDesc(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleAddTask}
                disabled={!newTaskTitle || !newTaskDesc}
                className="bg-brand-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-brand-200"
              >
                <Send className="w-4 h-4" /> 
                立即发布
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-gray-800 ml-1">今日已发布 ({tasks.length})</h3>
          {tasks.length === 0 && <p className="text-gray-400 ml-1">今日暂无题目，快去发布吧！</p>}
          {tasks.map(task => (
            <div key={task.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-lg text-gray-800">{task.title}</h4>
                  <div className="text-gray-500 text-sm mt-2 line-clamp-2">
                     <MarkdownText content={task.description} />
                  </div>
                </div>
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-mono">ID: {task.id.slice(-4)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Student View ---
  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-180px)] min-h-[600px] animate-fade-in">
      {/* Sidebar: Problem List */}
      <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
            <FileCode className="w-5 h-5 text-brand-600" /> 
            今日任务 ({completedCount}/{tasks.length})
          </h2>
          <div className="w-full bg-gray-200 h-1.5 rounded-full mt-3 overflow-hidden">
             <div 
                className="bg-brand-500 h-full transition-all duration-500 ease-out" 
                style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }}
             ></div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tasks.length === 0 ? (
            <div className="text-center p-8 text-gray-400 flex flex-col items-center justify-center h-full">
              <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mb-4 text-gray-300">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <p>今日暂无算法题</p>
              <p className="text-sm mt-1">管理员正在赶来的路上...</p>
            </div>
          ) : (
            tasks.map(task => {
              const isDone = submissions.some(s => s.taskId === task.id && s.status === 'Passed');
              return (
                <button
                  key={task.id}
                  onClick={() => { setActiveTask(task.id); setCode(''); }}
                  className={`w-full text-left p-4 rounded-xl transition-all border relative overflow-hidden group ${
                    activeTask === task.id 
                      ? 'border-brand-500 bg-brand-50 shadow-sm' 
                      : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-center relative z-10">
                    <span className={`font-bold ${activeTask === task.id ? 'text-brand-700' : 'text-gray-700'}`}>
                      {task.title}
                    </span>
                    {isDone && <CheckCircle className="w-5 h-5 text-green-500 fill-green-50" />}
                  </div>
                  <div className="text-xs text-gray-400 mt-2 line-clamp-1 relative z-10">{task.description}</div>
                  {activeTask === task.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500"></div>}
                </button>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button
            disabled={!allCompleted || tasks.length === 0 || isGuest}
            onClick={handleDailyCheckIn}
            className={`w-full py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg ${
               allCompleted && tasks.length > 0 && !isGuest
               ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-200 transform hover:-translate-y-0.5' 
               : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isGuest ? <Lock className="w-4 h-4"/> : <Send className="w-4 h-4" />}
            {isGuest ? '访客不可打卡' : (allCompleted && tasks.length > 0 ? '一键算法打卡 (同步到研友圈)' : '完成所有题目以打卡')}
          </button>
        </div>
      </div>

      {/* Main: Editor */}
      <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden relative">
        {activeTask ? (
          <>
            <div className="p-6 border-b border-gray-100 max-h-[30vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                {tasks.find(t => t.id === activeTask)?.title}
              </h3>
              <div className="bg-gray-50 p-4 rounded-xl text-gray-700 text-sm leading-relaxed border border-gray-100">
                <MarkdownText content={tasks.find(t => t.id === activeTask)?.description || ''} />
              </div>
            </div>
            
            <div className="flex-1 bg-[#1e1e1e] p-4 font-mono text-sm relative group">
              <div className="absolute top-0 left-0 right-0 h-6 bg-[#1e1e1e] border-b border-gray-700 flex items-center px-4 text-xs text-gray-500 select-none">
                solution.js {isGuest && '(只读)'}
              </div>
              
              <textarea
                value={code}
                onChange={e => !isGuest && setCode(e.target.value)}
                readOnly={isGuest}
                className={`w-full h-full bg-transparent text-gray-200 resize-none focus:outline-none pt-6 leading-relaxed ${isGuest ? 'cursor-not-allowed opacity-70' : ''}`}
                placeholder={isGuest ? "// 访客模式下无法编辑代码，请注册后开始刷题..." : "// 在此输入你的解题代码..."}
                spellCheck={false}
              />

              {isGuest && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none">
                  <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-xl border border-white/20 flex flex-col items-center text-white shadow-2xl transform translate-y-8">
                     <Lock className="w-8 h-8 mb-2" />
                     <p className="font-bold">访客模式 · 仅供预览</p>
                     <p className="text-xs text-gray-300 mt-1">登录后即可编写代码并运行</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
               <div className="text-xs text-gray-400">
                 提示: 这是一个演示环境，代码不会真实编译，点击提交即可通过。
               </div>
              <button
                onClick={handleSubmitCode}
                disabled={isRunning || !code.trim() || isGuest}
                className="bg-brand-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-200"
                title={isGuest ? "访客模式无法提交" : "提交代码"}
              >
                {isGuest ? (
                  <><EyeOff className="w-4 h-4"/> 禁止提交</>
                ) : isRunning ? (
                  <>运行测试中...</>
                ) : (
                  <><Play className="w-4 h-4 fill-current" /> 提交代码</>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
            <Code className="w-16 h-16 text-gray-200 mb-4" />
            <p>请从左侧选择一道题目开始挑战</p>
          </div>
        )}
      </div>
    </div>
  );
};
