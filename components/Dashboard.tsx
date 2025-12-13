
import React, { useMemo, useState, useEffect } from 'react';
import { CheckIn, User, Goal, SubjectCategory, RatingHistory, getUserStyle, getTitleName } from '../types';
import * as storage from '../services/storageService';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Trophy, Flame, Edit3, CheckSquare, Square, Plus, Trash2, Clock, Send, TrendingUp, ListTodo, AlertCircle, Gamepad2, BrainCircuit, Filter, ChevronDown, UserCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Timer, CalendarCheck, Flag, Sparkles } from 'lucide-react';
import { MarkdownText } from './MarkdownText';
import { ToastType } from './Toast';

interface Props {
  checkIns: CheckIn[];
  currentUser: User;
  onUpdateUser: (user: User) => void;
  onShowToast: (message: string, type: ToastType) => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

// 统一的日期格式化函数，避免时区或补零问题
const formatDateKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const Dashboard: React.FC<Props> = ({ checkIns, currentUser, onUpdateUser, onShowToast }) => {
  const [motto, setMotto] = useState(() => localStorage.getItem('user_motto') || "考研是一场孤独的旅行，但终点是星辰大海。");
  const [isEditingMotto, setIsEditingMotto] = useState(false);
  
  // View State
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  // Data State
  const [displayGoals, setDisplayGoals] = useState<Goal[]>([]); 
  const [ratingHistory, setRatingHistory] = useState<RatingHistory[]>([]);
  const [newGoalText, setNewGoalText] = useState('');
  
  // Study Log State
  const [logSubject, setLogSubject] = useState<SubjectCategory>(SubjectCategory.MATH);
  const [logContent, setLogContent] = useState('');
  const [logDuration, setLogDuration] = useState(45); 
  const [isLogging, setIsLogging] = useState(false);
  const [logMode, setLogMode] = useState<'study' | 'penalty'>('study');

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Exam Date State
  const defaultTarget = "2025-12-20"; 
  const [targetDateStr, setTargetDateStr] = useState(() => localStorage.getItem('kaoyan_target_date') || defaultTarget);
  const [isEditingTarget, setIsEditingTarget] = useState(false);

  const isViewingSelf = selectedUserId === currentUser.id;

  // Load Users
  useEffect(() => {
    storage.getAllUsers().then(users => {
        const sorted = users.sort((a, b) => {
            if (a.id === currentUser.id) return -1;
            if (b.id === currentUser.id) return 1;
            return (b.rating || 0) - (a.rating || 0);
        });
        setAllUsers(sorted);
    });
  }, [currentUser.id]);

  // Load Data
  useEffect(() => {
    const loadData = async () => {
        const rHist = await storage.getRatingHistory(selectedUserId);
        setRatingHistory(rHist);
        const uGoals = await storage.getUserGoals(selectedUserId);
        setDisplayGoals(uGoals);
    };
    loadData();
    // 切换用户时，清空选中的日期，避免混淆
    setSelectedDate(null);
  }, [selectedUserId, checkIns]); 

  const selectedUser = useMemo(() => {
      return allUsers.find(u => u.id === selectedUserId) || currentUser;
  }, [allUsers, selectedUserId, currentUser]);

  const selectedUserCheckIns = useMemo(() => {
      return checkIns.filter(c => c.userId === selectedUserId);
  }, [checkIns, selectedUserId]);

  // --- Calculations ---

  const daysUntilExam = useMemo(() => {
      const target = new Date(targetDateStr);
      const today = new Date();
      target.setHours(0,0,0,0);
      today.setHours(0,0,0,0);
      const diffTime = target.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [targetDateStr]);

  const totalCheckInDays = useMemo(() => {
      const uniqueDays = new Set(selectedUserCheckIns.map(c => formatDateKey(new Date(c.timestamp))));
      return uniqueDays.size;
  }, [selectedUserCheckIns]);

  const stats = useMemo(() => {
    const subjectDuration: Record<string, number> = {}; 
    const dateDuration: Record<string, number> = {}; 
    let totalStudyMinutes = 0;
    let totalPenaltyMinutes = 0;
    
    const sortedCheckIns = [...selectedUserCheckIns].sort((a, b) => a.timestamp - b.timestamp);

    sortedCheckIns.forEach(c => {
      const dateKey = new Date(c.timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
      const duration = c.duration || 0;

      if (c.isPenalty) {
          totalPenaltyMinutes += duration;
      } else {
          subjectDuration[c.subject] = (subjectDuration[c.subject] || 0) + duration;
          dateDuration[dateKey] = (dateDuration[dateKey] || 0) + duration;
          totalStudyMinutes += duration;
      }
    });

    const pieData = Object.entries(subjectDuration).map(([name, value]) => ({ 
        name, 
        value,
        label: `${Math.floor(value/60)}h${value%60}m`
    }));

    const durationData = Object.entries(dateDuration).map(([name, minutes]) => ({ 
        name, 
        hours: parseFloat((minutes / 60).toFixed(1)) 
    }));

    return { pieData, durationData, totalStudyMinutes, totalPenaltyMinutes };
  }, [selectedUserCheckIns]);

  const ratingChartData = useMemo(() => {
      const sorted = [...ratingHistory].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
      return sorted.map(r => ({
          date: new Date(r.recorded_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
          rating: r.rating,
          reason: r.change_reason
      }));
  }, [ratingHistory]);

  // --- Handlers ---
  const handleSaveTargetDate = () => {
      localStorage.setItem('kaoyan_target_date', targetDateStr);
      setIsEditingTarget(false);
      onShowToast("考研日期已更新", 'success');
  }

  const handleAddGoal = async () => {
    if (!newGoalText.trim()) return;
    const goal = await storage.addGoal(currentUser, newGoalText);
    if (goal) {
      setDisplayGoals(prev => [...prev, goal]);
      setNewGoalText('');
      onShowToast("目标已添加", 'success');
    }
  };

  const handleToggleGoal = async (id: number, currentStatus: boolean) => {
    if (!isViewingSelf) return; 
    setDisplayGoals(prev => prev.map(g => g.id === id ? { ...g, is_completed: !currentStatus } : g));
    await storage.toggleGoal(id, !currentStatus);
  };

  const handleDeleteGoal = async (id: number) => {
    if (!isViewingSelf) return;
    setDisplayGoals(prev => prev.filter(g => g.id !== id));
    await storage.deleteGoal(id);
    onShowToast("目标已删除", 'info');
  };

  const handleLogStudy = async () => {
    if (!logContent.trim()) return;
    setIsLogging(true);
    
    let ratingChange = 0;
    let newRating = currentUser.rating || 1200;

    if (logMode === 'study') {
        ratingChange = Math.floor(logDuration / 10) + 1;
        newRating += ratingChange;
    } else {
        ratingChange = -Math.round((logDuration / 10) * 1.5) - 1;
        newRating += ratingChange;
    }

    const newCheckIn: CheckIn = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      userRating: newRating,
      userRole: currentUser.role,
      subject: logMode === 'study' ? logSubject : SubjectCategory.OTHER,
      content: logContent,
      duration: logDuration,
      isPenalty: logMode === 'penalty',
      timestamp: Date.now(),
      likedBy: []
    };

    try {
      await storage.addCheckIn(newCheckIn);
      const reason = logMode === 'study' ? `专注学习 ${logDuration} 分钟` : `摸鱼/娱乐 ${logDuration} 分钟 (扣分)`;
      await storage.updateRating(currentUser.id, newRating, reason);
      
      const updatedUser = { ...currentUser, rating: newRating };
      onUpdateUser(updatedUser);
      storage.updateUserLocal(updatedUser);
      
      setLogContent('');
      if (logMode === 'study') {
          onShowToast(`✅ 学习记录已提交！Rating +${ratingChange}`, 'success');
      } else {
          onShowToast(`⚠️ 摸鱼记录已提交！Rating ${ratingChange}`, 'error');
      }
      
      if (isViewingSelf) {
         const rHist = await storage.getRatingHistory(currentUser.id);
         setRatingHistory(rHist);
      }
      setLogMode('study');

    } catch (e) {
      onShowToast("提交失败，请重试", 'error');
    } finally {
      setIsLogging(false);
    }
  };

  const saveMotto = () => {
    localStorage.setItem('user_motto', motto);
    setIsEditingMotto(false);
    onShowToast("座右铭已更新", 'success');
  };

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    return { daysInMonth, firstDayOfWeek, year, month };
  };

  // 使用 formatDateKey 生成 Map，确保 key 与 calendar 渲染一致
  const dailyStatusMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    selectedUserCheckIns.forEach(c => {
        const key = formatDateKey(new Date(c.timestamp));
        map[key] = true;
    });
    return map;
  }, [selectedUserCheckIns]);

  // 修复：使用 formatDateKey 进行日期匹配
  const displayedCheckIns = useMemo(() => {
      let list = selectedUserCheckIns;
      if (selectedDate) {
          list = list.filter(c => {
              const checkInDate = formatDateKey(new Date(c.timestamp));
              return checkInDate === selectedDate;
          });
      }
      return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20); 
  }, [selectedUserCheckIns, selectedDate]);

  const renderCalendar = () => {
    const { daysInMonth, firstDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const cells = [];
    
    for (let i = 0; i < firstDayOfWeek; i++) {
        cells.push(<div key={`empty-${i}`} className="h-9 w-9"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const currentDay = new Date(year, month, d);
        const dateStr = formatDateKey(currentDay);
        const hasCheckIn = dailyStatusMap[dateStr];
        const isSelected = selectedDate === dateStr;
        const isToday = dateStr === formatDateKey(new Date());

        cells.push(
            <button
                key={dateStr}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`h-9 w-9 rounded-full flex flex-col items-center justify-center text-xs relative transition-all group
                    ${isSelected ? 'bg-brand-600 text-white shadow-md scale-110' : 'text-gray-700 hover:bg-gray-100'}
                    ${isToday && !isSelected ? 'text-brand-600 font-bold border border-brand-200' : ''}
                `}
            >
                {d}
                {hasCheckIn && (
                    <div className={`w-1.5 h-1.5 rounded-full mt-0.5 transition-colors
                        ${isSelected ? 'bg-white' : 'bg-brand-500'}
                    `}></div>
                )}
            </button>
        );
    }
    return cells;
  };

  const ratingColorClass = getUserStyle(selectedUser.role, selectedUser.rating);
  const titleName = getTitleName(selectedUser.role, selectedUser.rating);

  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      
      {/* --- Top Row: Profile & Key Stats --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
           
           {/* 1. Rich Profile Card (Span 6) */}
           <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-100/50 relative overflow-hidden flex flex-col justify-between group">
               {/* User Switcher (Top Right) */}
               <div className="absolute top-6 right-6 z-20">
                   <div className="relative">
                       <select 
                           value={selectedUserId}
                           onChange={(e) => setSelectedUserId(e.target.value)}
                           className="appearance-none bg-gray-50 border border-gray-200 text-gray-600 py-1.5 pl-3 pr-8 rounded-full text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer hover:bg-gray-100 transition-colors"
                       >
                           {allUsers.map(u => (
                               <option key={u.id} value={u.id}>
                                   {u.id === currentUser.id ? '👤 我' : `👀 ${u.name}`}
                               </option>
                           ))}
                       </select>
                       <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                   </div>
               </div>

               <div className="flex items-center gap-5 relative z-10">
                   <div className="relative">
                       <img src={selectedUser.avatar} className="w-20 h-20 rounded-full border-4 border-white shadow-md bg-gray-100 object-cover" alt="Avatar" />
                       <div className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-black text-white shadow border border-white ${
                           selectedUser.rating && selectedUser.rating >= 2100 ? 'bg-orange-500' : 'bg-brand-500'
                       }`}>
                           Lv.{Math.floor((selectedUser.rating || 1200)/100)}
                       </div>
                   </div>
                   <div>
                       <h2 className={`text-2xl ${ratingColorClass}`}>{selectedUser.name}</h2>
                       <div className="flex items-center gap-2 mt-1">
                           <span className={`text-xs px-2 py-0.5 rounded font-bold border ${ratingColorClass.includes('text-red') ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                               {titleName}
                           </span>
                           <span className="text-gray-400 text-xs font-mono font-bold">R: {selectedUser.rating}</span>
                       </div>
                   </div>
               </div>

               <div className="mt-6 relative z-10">
                   <div className="relative group/motto inline-block max-w-full w-full">
                       {isViewingSelf && isEditingMotto ? (
                           <input 
                               value={motto} 
                               onChange={e => setMotto(e.target.value)}
                               onBlur={saveMotto}
                               onKeyDown={e => e.key === 'Enter' && saveMotto()}
                               autoFocus
                               className="bg-gray-50 border-b-2 border-brand-500 text-gray-700 text-sm py-1 px-2 focus:outline-none w-full rounded"
                           />
                       ) : (
                           <div 
                               onClick={() => isViewingSelf && setIsEditingMotto(true)}
                               className={`bg-gray-50/80 rounded-xl p-3 text-gray-600 italic text-sm flex items-start gap-2 ${isViewingSelf ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
                           >
                               <Sparkles className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                               <span>{motto || "设置一个座右铭激励自己吧..."}</span>
                           </div>
                       )}
                   </div>
               </div>
               
               {/* Decor */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-bl-full -mr-10 -mt-10 -z-0 opacity-50"></div>
           </div>

           {/* 2. Countdown Card (Span 3) */}
           <div className="lg:col-span-3 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
               <div className="relative z-10 h-full flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                       <div className="text-indigo-100 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                           <Flag className="w-3 h-3"/> 考研倒计时
                       </div>
                       {isViewingSelf && (
                           <button onClick={() => setIsEditingTarget(!isEditingTarget)} className="text-white/50 hover:text-white transition-colors">
                               <Edit3 className="w-3.5 h-3.5"/>
                           </button>
                       )}
                   </div>
                   
                   <div className="mt-2">
                       {isEditingTarget ? (
                           <div className="flex flex-col gap-2 animate-fade-in">
                                <input 
                                    type="date" 
                                    value={targetDateStr}
                                    onChange={(e) => setTargetDateStr(e.target.value)}
                                    className="text-gray-900 text-xs rounded px-2 py-1 outline-none w-full"
                                />
                                <button onClick={handleSaveTargetDate} className="bg-white/20 hover:bg-white/30 text-white text-xs py-1 rounded">保存</button>
                           </div>
                       ) : (
                           <>
                               <div className="text-4xl font-black tracking-tighter">
                                   {daysUntilExam > 0 ? daysUntilExam : 0}
                                   <span className="text-base font-medium opacity-60 ml-1">天</span>
                               </div>
                               <div className="text-[10px] text-indigo-200 mt-1 font-mono opacity-80">目标: {targetDateStr}</div>
                           </>
                       )}
                   </div>
               </div>
               <CalendarCheck className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-10 rotate-12" />
           </div>

           {/* 3. Streak Card (Span 3) */}
           <div className="lg:col-span-3 bg-gradient-to-br from-brand-500 to-cyan-500 rounded-3xl p-6 text-white shadow-xl shadow-blue-200 relative overflow-hidden">
               <div className="relative z-10 h-full flex flex-col justify-between">
                   <div className="text-blue-100 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                       <Flame className="w-3 h-3"/> 累计打卡
                   </div>
                   <div>
                       <div className="text-4xl font-black tracking-tighter">
                           {totalCheckInDays}
                           <span className="text-base font-medium opacity-60 ml-1">天</span>
                       </div>
                       <div className="text-[10px] text-blue-100 mt-1 font-mono opacity-80">坚持就是胜利！</div>
                   </div>
               </div>
               <Trophy className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-10 -rotate-12" />
           </div>
      </div>

      {/* --- Row 2: Charts Area --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 4. Rating Line Chart (Span 8) */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-red-500" /> Rating 积分趋势
                </h3>
                <div className="h-64">
                    {ratingChartData.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={ratingChartData}>
                                <defs>
                                    <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} minTickGap={30} />
                                <YAxis domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                                    itemStyle={{color: '#ef4444', fontWeight: 'bold'}}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="rating" 
                                    stroke="#ef4444" 
                                    strokeWidth={3} 
                                    dot={{r: 3, fill: '#ef4444', strokeWidth: 2, stroke: '#fff'}} 
                                    activeDot={{r: 6}} 
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs bg-gray-50/50 rounded-2xl border border-dashed border-gray-100">
                            <TrendingUp className="w-8 h-8 mb-2 opacity-20" />
                            <p>多打卡几次就能看到曲线啦</p>
                        </div>
                    )}
                </div>
          </div>

          {/* 5. Subject Distribution Pie (Span 4) */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 text-sm">
                    <BrainCircuit className="w-4 h-4 text-orange-500" /> 科目时长分布
                </h3>
                <div className="flex-1 min-h-[250px]">
                    {stats.pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={stats.pieData} 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={60} 
                                outerRadius={80} 
                                paddingAngle={5} 
                                dataKey="value" 
                                label={false}
                            >
                            {stats.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value: number) => `${Math.floor(value/60)}h ${value%60}m`} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs bg-gray-50/50 rounded-2xl border border-dashed border-gray-100">
                             <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                             <p>暂无数据</p>
                        </div>
                    )}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {stats.pieData.slice(0, 4).map((entry, index) => (
                        <div key={index} className="flex items-center gap-1 text-[10px] text-gray-500">
                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                            {entry.name}
                        </div>
                    ))}
                </div>
          </div>
      </div>

      {/* --- Row 3: Daily Stats & Calendar --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 6. Daily Bar Chart (Span 8) */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm h-80">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-blue-500" /> 每日学习时长 (小时)
                </h3>
                <div className="h-56">
                    {stats.durationData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.durationData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                                <YAxis tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} cursor={{fill: '#f9fafb'}} />
                                <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                         <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs bg-gray-50/50 rounded-2xl border border-dashed border-gray-100">
                             <Clock className="w-8 h-8 mb-2 opacity-20" />
                             <p>暂无数据</p>
                         </div>
                    )}
                </div>
          </div>

          {/* 7. Calendar (Span 4) */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                        <CalendarIcon className="w-4 h-4 text-brand-600" /> 
                        打卡日历
                    </h3>
                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1 hover:bg-white hover:shadow-sm rounded-md text-gray-500 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-xs font-bold text-gray-700 w-16 text-center select-none">
                            {currentMonth.getMonth() + 1}月
                        </span>
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1 hover:bg-white hover:shadow-sm rounded-md text-gray-500 transition-all"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                    {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                        <div key={d} className="text-center text-[10px] text-gray-400 font-medium py-1">{d}</div>
                    ))}
                    {renderCalendar()}
                </div>
          </div>
      </div>

      {/* --- Row 4: Lists & Actions --- */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
           {/* 8. Check-in List (Span 8) */}
           <div className="xl:col-span-8 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                        <ListTodo className="w-4 h-4 text-brand-600" /> 
                        {selectedDate ? `${selectedDate} 的记录` : '最近动态'}
                    </h3>
                    {selectedDate && (
                        <button 
                            onClick={() => setSelectedDate(null)} 
                            className="text-xs bg-brand-50 text-brand-600 px-3 py-1 rounded-full font-bold hover:bg-brand-100 transition-colors"
                        >
                            显示全部
                        </button>
                    )}
                 </div>
                 
                 <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                     {displayedCheckIns.length > 0 ? (
                        displayedCheckIns.map(checkIn => (
                                <div key={checkIn.id} className={`p-4 rounded-2xl border flex gap-4 transition-all hover:shadow-md ${checkIn.isPenalty ? 'bg-red-50/50 border-red-100' : 'bg-white border-gray-100'}`}>
                                    <div className={`mt-1 font-bold text-[10px] px-2.5 py-1 rounded-lg h-fit shrink-0 ${checkIn.isPenalty ? 'bg-red-100 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
                                        {checkIn.subject}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div className="text-gray-800 text-sm leading-relaxed line-clamp-3">
                                                <MarkdownText content={checkIn.content} />
                                            </div>
                                            <span className="text-xs text-gray-400 whitespace-nowrap ml-4 font-mono">
                                                {new Date(checkIn.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex items-center gap-3 text-xs">
                                            <span className={`flex items-center gap-1.5 font-bold px-2 py-1 rounded-md ${checkIn.isPenalty ? 'bg-white text-red-500 shadow-sm' : 'bg-gray-50 text-blue-600'}`}>
                                                <Clock className="w-3 h-3" /> 
                                                {checkIn.isPenalty ? '摸鱼' : '学习'} {checkIn.duration} min
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                     ) : (
                         <div className="text-center py-12 text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                             <UserCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                             <p className="text-sm">暂无打卡记录</p>
                         </div>
                     )}
                 </div>
           </div>

           {/* 9. Action Column (Span 4) */}
           <div className="xl:col-span-4 space-y-6">
                
                {/* To-Do List */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                        <CheckSquare className="w-4 h-4 text-brand-500" /> {isViewingSelf ? '今日 To-Do' : 'TA 的 To-Do'}
                    </h3>
                    <div className="space-y-2 mb-4 min-h-[100px]">
                        {displayGoals.map(goal => (
                        <div key={goal.id} className="flex items-center gap-3 group p-2 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer" onClick={() => isViewingSelf && handleToggleGoal(goal.id, goal.is_completed)}>
                            <div className={`transition-colors ${goal.is_completed ? 'text-green-500' : 'text-gray-300 group-hover:text-brand-400'}`}>
                                {goal.is_completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </div>
                            <span className={`flex-1 text-sm transition-all ${goal.is_completed ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-700'}`}>{goal.title}</span>
                            {isViewingSelf && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }} 
                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        ))}
                        {displayGoals.length === 0 && <p className="text-xs text-gray-400 text-center py-8">暂无目标，添加一个吧！</p>}
                    </div>
                    
                    {isViewingSelf && (
                        <div className="flex gap-2 mt-auto">
                            <input 
                                className="flex-1 bg-gray-50 border-0 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500 transition-shadow"
                                placeholder="输入目标..."
                                value={newGoalText}
                                onChange={e => setNewGoalText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddGoal()}
                            />
                            <button onClick={handleAddGoal} className="bg-brand-600 text-white p-2.5 rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all active:scale-95">
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Logger Card */}
                {isViewingSelf && (
                    <div className={`bg-white rounded-3xl p-6 border shadow-sm flex flex-col transition-all duration-300 ${logMode === 'penalty' ? 'border-red-200 ring-4 ring-red-50' : 'border-blue-200 ring-4 ring-blue-50'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                                <Clock className={`w-4 h-4 ${logMode === 'penalty' ? 'text-red-500' : 'text-blue-500'}`} /> 
                                {logMode === 'study' ? '学习记录' : '摸鱼忏悔'}
                            </h3>
                            <div className="bg-gray-100 p-1 rounded-lg flex text-xs font-bold">
                                <button 
                                    onClick={() => setLogMode('study')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${logMode === 'study' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    🔥 
                                </button>
                                <button 
                                    onClick={() => setLogMode('penalty')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${logMode === 'penalty' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    😴 
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 flex flex-col gap-3">
                            <div className="flex gap-2">
                                <div className={`flex-1 ${logMode === 'penalty' ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <select 
                                        value={logSubject} 
                                        onChange={(e) => {
                                            setLogMode('study');
                                            setLogSubject(e.target.value as SubjectCategory);
                                        }}
                                        className="w-full bg-gray-50 border-0 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
                                    >
                                        {Object.values(SubjectCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="w-24 relative">
                                    <input 
                                        type="number" value={logDuration} onChange={e => setLogDuration(parseInt(e.target.value))}
                                        className="w-full bg-gray-50 border-0 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 text-center font-bold text-gray-700"
                                    />
                                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none font-bold">min</span>
                                </div>
                            </div>

                            <textarea 
                                value={logContent}
                                onChange={e => setLogContent(e.target.value)}
                                className="w-full h-24 bg-gray-50 border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 resize-none placeholder-gray-400"
                                placeholder={logMode === 'study' ? "记录下你的学习成果..." : "坦白从宽..."}
                            />

                            <button 
                                onClick={handleLogStudy}
                                disabled={isLogging || !logContent.trim()}
                                className={`w-full py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 text-white transition-all transform active:scale-[0.98] hover:-translate-y-0.5 ${
                                    logMode === 'study' 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 shadow-blue-200' 
                                    : 'bg-gradient-to-r from-red-500 to-pink-500 shadow-red-200'
                                }`}
                            >
                                {isLogging ? '...' : <Send className="w-4 h-4" />}
                                {isLogging ? '提交中' : '立即记录'}
                            </button>
                        </div>
                    </div>
                )}
           </div>
      </div>
    </div>
  );
};
