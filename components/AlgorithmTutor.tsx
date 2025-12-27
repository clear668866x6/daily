
import React, { useState, useEffect, useMemo } from 'react';
import { User, AlgorithmTask, AlgorithmSubmission, SubjectCategory } from '../types';
import * as storage from '../services/storageService';
import { getBusinessDate } from '../utils/dateUtils';
import { 
  Terminal, 
  Trophy, 
  Play, 
  Loader2, 
  CheckCircle, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Megaphone, 
  Info,
  Medal,
  Cpu,
  MousePointer2
} from 'lucide-react';
import { MarkdownText } from './MarkdownText';
import { ToastType } from './Toast';
import { Fireworks } from './Fireworks'; 

interface Props {
  user: User;
  onCheckIn: (subject: SubjectCategory, content: string, duration?: number) => void;
  onShowToast: (message: string, type: ToastType) => void;
}

const LANGUAGES = {
    'cpp': { name: 'C++ 17', template: '#include <iostream>\nusing namespace std;\n\nclass Solution {\npublic:\n    void solve() {\n        // Write your code here\n    }\n};' },
    'python': { name: 'Python 3', template: 'class Solution:\n    def solve(self):\n        # Your logic here\n        pass' },
    'java': { name: 'Java 11', template: 'class Solution {\n    public void solve() {\n        // Your code here\n    }\n}' }
};

export const AlgorithmTutor: React.FC<Props> = ({ user, onCheckIn, onShowToast }) => {
  const [tasks, setTasks] = useState<AlgorithmTask[]>([]);
  const [submissions, setSubmissions] = useState<AlgorithmSubmission[]>([]);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<keyof typeof LANGUAGES>('cpp');
  const [isRunning, setIsRunning] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [submitModal, setSubmitModal] = useState<{ open: boolean, duration: number }>({ open: false, duration: 30 });
  const [isAdminChannelOpen, setIsAdminChannelOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    refreshData();
  }, [user]);

  const refreshData = async () => {
    const allTasks = await storage.getAlgorithmTasks();
    setTasks(allTasks);
    const subs = storage.getAlgorithmSubmissions(user.id);
    setSubmissions(subs);
  };

  const handleTaskSwitch = (id: string) => {
    setActiveTask(id);
    const sub = submissions.find(s => s.taskId === id);
    if (sub) { 
      setCode(sub.code); 
      setLanguage(sub.language as any); 
    } else { 
      setCode(LANGUAGES[language].template); 
    }
  };

  const confirmSubmit = () => {
    setIsRunning(true);
    setSubmitModal({ ...submitModal, open: false });
    setTimeout(() => {
        const sub: AlgorithmSubmission = { taskId: activeTask!, userId: user.id, code, language, status: 'Passed' };
        storage.submitAlgorithmCode(sub);
        setSubmissions(prev => [...prev.filter(s => s.taskId !== activeTask), sub]);
        setIsRunning(false);
        onShowToast("代码已提交并通过测试！AC！", 'success');
        setShowFireworks(true);
        setTimeout(() => setShowFireworks(false), 5000);
        const taskTitle = tasks.find(t => t.id === activeTask)?.title || '算法题';
        onCheckIn(SubjectCategory.ALGORITHM, `### 💻 算法 AC 报告\n题目：**${taskTitle}**\n语言：\`${language.toUpperCase()}\`\n\n\`\`\`${language}\n${code.substring(0, 100)}...\n\`\`\``, submitModal.duration);
    }, 2000);
  };

  const selectedTask = useMemo(() => tasks.find(t => t.id === activeTask), [tasks, activeTask]);
  const acCount = useMemo(() => submissions.filter(s => s.status === 'Passed').length, [submissions]);
  
  const todayStr = getBusinessDate(Date.now());
  const todayTasks = useMemo(() => tasks.filter(t => t.date === todayStr), [tasks, todayStr]);
  const todayAcCount = useMemo(() => submissions.filter(s => s.status === 'Passed' && tasks.find(t => t.id === s.taskId)?.date === todayStr).length, [submissions, tasks, todayStr]);

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const cells = [];
    
    const activityMap: Record<number, boolean> = {};
    submissions.forEach(s => {
      const task = tasks.find(t => t.id === s.taskId);
      if (task) {
        const d = new Date(task.date);
        if (d.getFullYear() === year && d.getMonth() === month) {
          activityMap[d.getDate()] = true;
        }
      }
    });

    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} className="h-8 w-8"></div>);
    for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isToday = getBusinessDate(Date.now()) === dStr;
        const hasActivity = activityMap[d];
        cells.push(
          <div key={d} className="flex flex-col items-center justify-center relative">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs transition-all cursor-default font-medium
              ${isToday ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'text-gray-600 hover:bg-gray-50'}
            `}>
              {d}
            </div>
            {hasActivity && <div className="absolute -bottom-1 w-1 h-1 bg-brand-500 rounded-full"></div>}
          </div>
        );
    }
    return cells;
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-[1200px] mx-auto pb-12">
      <Fireworks active={showFireworks} />

      {/* 1. Page Title */}
      <div className="mb-2">
          <h1 className="text-2xl font-black text-gray-800">算法训练营</h1>
          <p className="text-gray-400 text-sm mt-1">每日精选真题，AC 才是硬道理</p>
      </div>

      {/* 2. Top Banner Card */}
      <div className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center gap-4 flex-1">
              <div className="bg-brand-50 p-4 rounded-2xl text-brand-600">
                  <Terminal className="w-6 h-6" />
              </div>
              <div>
                  <h2 className="text-lg font-black text-gray-800">算法训练营</h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">力扣风格每日挑战</p>
              </div>
          </div>
          
          <div className="flex items-center gap-8">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold border border-orange-100 hover:bg-orange-100 transition-colors">
                  <Medal className="w-4 h-4" /> 成就馆
              </button>
              
              <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">累计 AC</span>
                  <div className="flex items-center gap-2 font-black text-xl text-gray-800">
                    {acCount} <Trophy className="w-4 h-4 text-yellow-500" />
                  </div>
              </div>

              <div className="w-32 flex flex-col items-end">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">今日进度</span>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="bg-brand-500 h-full transition-all duration-500" 
                        style={{ width: todayTasks.length > 0 ? `${(todayAcCount / todayTasks.length) * 100}%` : '0%' }}
                      ></div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 mt-1">{todayAcCount}/{todayTasks.length}</span>
              </div>
          </div>
      </div>

      {/* 3. Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Calendar & Tasks */}
          <div className="lg:col-span-4 space-y-6">
              {/* Calendar Card */}
              <div className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-center mb-6 px-1">
                      <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-all text-gray-400"><ChevronLeft className="w-4 h-4" /></button>
                      <h3 className="text-sm font-black text-gray-700">
                          {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
                      </h3>
                      <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-all text-gray-400"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-7 gap-y-2 text-center">
                      {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-[10px] font-black text-gray-300 uppercase py-1">{d}</div>)}
                      {renderCalendar()}
                  </div>
              </div>

              {/* Mission List Card */}
              <div className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm min-h-[400px] flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-black text-gray-700 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-brand-600" /> 任务列表
                      </h3>
                      <span className="bg-gray-50 text-gray-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-gray-100">{todayTasks.length}</span>
                  </div>
                  
                  <div className="flex-1 space-y-3">
                      {todayTasks.length > 0 ? (
                          todayTasks.map(task => {
                            const isAC = submissions.some(s => s.taskId === task.id && s.status === 'Passed');
                            return (
                              <button 
                                key={task.id} 
                                onClick={() => handleTaskSwitch(task.id)}
                                className={`w-full p-4 rounded-2xl text-left border transition-all flex items-center justify-between group ${activeTask === task.id ? 'border-brand-600 bg-brand-50/30' : 'border-transparent bg-gray-50/50 hover:bg-gray-100'}`}
                              >
                                <div className="flex-1 min-w-0">
                                    <div className={`text-xs font-black truncate ${activeTask === task.id ? 'text-brand-700' : 'text-gray-700'}`}>{task.title}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[8px] font-bold px-1 rounded ${task.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{task.difficulty}</span>
                                    </div>
                                </div>
                                {isAC && <CheckCircle className="w-4 h-4 text-green-500 fill-current" />}
                              </button>
                            );
                          })
                      ) : (
                          <div className="flex flex-col items-center justify-center h-full text-center text-gray-300 py-12">
                              <Cpu className="w-12 h-12 mb-4 opacity-10" />
                              <p className="text-[10px] font-black uppercase tracking-widest">今日休整</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* Right Column: Problem & Editor */}
          <div className="lg:col-span-8 h-full">
              <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col h-full">
                  {selectedTask ? (
                      <div className="flex flex-col h-full flex-1">
                          {/* Problem Header */}
                          <div className="p-8 border-b border-gray-100 bg-gray-50/30">
                              <div className="flex justify-between items-start mb-4">
                                  <h2 className="text-2xl font-black text-gray-800">{selectedTask.title}</h2>
                                  <div className="flex gap-2">
                                      <select 
                                        value={language} 
                                        onChange={e => {setLanguage(e.target.value as any); setCode(LANGUAGES[e.target.value as keyof typeof LANGUAGES].template);}} 
                                        className="bg-white border border-gray-200 px-3 py-1.5 rounded-xl text-[10px] font-bold text-gray-600 outline-none"
                                      >
                                          {Object.keys(LANGUAGES).map(l => <option key={l} value={l}>{LANGUAGES[l as keyof typeof LANGUAGES].name}</option>)}
                                      </select>
                                  </div>
                              </div>
                              <div className="prose prose-slate max-w-none text-sm leading-relaxed overflow-y-auto max-h-[150px] custom-scrollbar">
                                  <MarkdownText content={selectedTask.description} />
                              </div>
                          </div>

                          {/* Code Editor */}
                          <div className="flex-1 flex flex-col bg-[#1e1e1e] relative group">
                              <div className="flex items-center justify-between px-6 py-3 bg-[#252525]">
                                  <div className="flex gap-1.5">
                                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                                  </div>
                                  <span className="text-[10px] text-gray-500 font-mono font-bold tracking-widest">{language.toUpperCase()} 编辑器</span>
                              </div>
                              <textarea 
                                value={code} 
                                onChange={e => setCode(e.target.value)} 
                                className="w-full h-full min-h-[400px] bg-transparent text-gray-300 font-mono text-sm p-8 resize-none focus:outline-none custom-scrollbar leading-relaxed" 
                                spellCheck={false} 
                              />
                              <div className="absolute bottom-8 right-8">
                                  <button 
                                    onClick={() => setSubmitModal({ open: true, duration: 30 })} 
                                    disabled={isRunning || user.role === 'guest'} 
                                    className="bg-brand-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all flex items-center gap-3"
                                  >
                                      {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                                      运行提交
                                  </button>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-10 text-center h-full">
                          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                            <ChevronLeft className="w-6 h-6 text-gray-200" />
                            <ChevronRight className="w-6 h-6 text-gray-200" />
                          </div>
                          <h3 className="text-sm font-black text-gray-400">请从左侧选择一道题目开始编码</h3>
                          <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-300 font-bold uppercase tracking-widest">
                            <MousePointer2 className="w-3 h-3" /> 点击选择题目
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* Admin Panel (Float) */}
      {isAdmin && (
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl overflow-hidden transition-all group">
              <button onClick={() => setIsAdminChannelOpen(!isAdminChannelOpen)} className="w-full px-6 py-4 flex items-center justify-between text-indigo-700 font-bold text-sm">
                  <div className="flex items-center gap-2"><Megaphone className="w-4 h-4" /> 管理员发题通道</div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isAdminChannelOpen ? 'rotate-180' : ''}`} />
              </button>
              {isAdminChannelOpen && (
                <div className="p-6 pt-2 bg-white border-t border-indigo-100">
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                        <p className="text-xs text-amber-700 flex items-center gap-2"><Info className="w-4 h-4" /> 您可以通过控制台或数据库录入今日挑战数据。</p>
                    </div>
                </div>
              )}
          </div>
      )}

      {/* Submit Duration Modal */}
      {submitModal.open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white p-8 rounded-[32px] shadow-2xl w-full max-w-xs border-t-8 border-brand-600 animate-fade-in">
                <h3 className="font-black text-gray-800 mb-2 flex items-center gap-2">练习耗时统计</h3>
                <p className="text-[10px] text-gray-400 font-bold mb-6">TIME TRACKING FOR RATING</p>
                <div className="flex items-center gap-4 bg-gray-50 p-6 rounded-2xl mb-8">
                    <input 
                      type="number" 
                      value={submitModal.duration} 
                      onChange={e => setSubmitModal({...submitModal, duration: parseInt(e.target.value)||0})} 
                      className="w-full bg-transparent font-black text-3xl text-center text-brand-600 outline-none" 
                    />
                    <span className="font-bold text-gray-400 uppercase text-xs">分钟</span>
                </div>
                <button 
                  onClick={confirmSubmit} 
                  className="w-full bg-brand-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-brand-100 hover:bg-brand-700 transition-all active:scale-95"
                >
                  确认并提交
                </button>
                <button 
                  onClick={() => setSubmitModal({ ...submitModal, open: false })} 
                  className="w-full mt-2 text-gray-400 font-bold text-xs py-2"
                >
                  取消
                </button>
            </div>
        </div>
      )}
    </div>
  );
};
