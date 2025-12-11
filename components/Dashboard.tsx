
import React, { useMemo, useState, useEffect } from 'react';
import { CheckIn, User, Goal, SubjectCategory, RatingHistory, getUserStyle, getTitleName } from '../types';
import * as storage from '../services/storageService';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Trophy, Flame, Edit3, CheckSquare, Square, Plus, Trash2, Clock, Send, TrendingUp, Users, ListTodo, AlertCircle, Gamepad2, BrainCircuit, Filter, ChevronDown, UserCircle } from 'lucide-react';
import { MarkdownText } from './MarkdownText';

interface Props {
  checkIns: CheckIn[];
  currentUser: User;
  onUpdateUser: (user: User) => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

export const Dashboard: React.FC<Props> = ({ checkIns, currentUser, onUpdateUser }) => {
  const [motto, setMotto] = useState(() => localStorage.getItem('user_motto') || "考研是一场孤独的旅行，但终点是星辰大海。");
  const [isEditingMotto, setIsEditingMotto] = useState(false);
  
  // View State
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  // Data State
  const [displayGoals, setDisplayGoals] = useState<Goal[]>([]); // Goals for the selected user
  const [ratingHistory, setRatingHistory] = useState<RatingHistory[]>([]);
  const [newGoalText, setNewGoalText] = useState('');
  
  // Study Log State
  const [logSubject, setLogSubject] = useState<SubjectCategory>(SubjectCategory.MATH);
  const [logContent, setLogContent] = useState('');
  const [logDuration, setLogDuration] = useState(45); 
  const [isLogging, setIsLogging] = useState(false);
  const [logMode, setLogMode] = useState<'study' | 'penalty'>('study');

  const isViewingSelf = selectedUserId === currentUser.id;

  // Load All Users for Selector
  useEffect(() => {
    storage.getAllUsers().then(users => {
        // Sort: Current user first, then by rating
        const sorted = users.sort((a, b) => {
            if (a.id === currentUser.id) return -1;
            if (b.id === currentUser.id) return 1;
            return (b.rating || 0) - (a.rating || 0);
        });
        setAllUsers(sorted);
    });
  }, [currentUser.id]);

  // Load Data dependent on Selected User
  useEffect(() => {
    const loadData = async () => {
        // Fetch rating history for SELECTED user
        const rHist = await storage.getRatingHistory(selectedUserId);
        setRatingHistory(rHist);

        // Fetch goals for SELECTED user
        const uGoals = await storage.getUserGoals(selectedUserId);
        setDisplayGoals(uGoals);
    };
    loadData();
  }, [selectedUserId, checkIns]); // Reload if checkIns update (might affect goals implicitly if we linked them later, but mostly for user switch)

  const selectedUser = useMemo(() => {
      return allUsers.find(u => u.id === selectedUserId) || currentUser;
  }, [allUsers, selectedUserId, currentUser]);

  const handleAddGoal = async () => {
    if (!newGoalText.trim()) return;
    const goal = await storage.addGoal(currentUser, newGoalText);
    if (goal) {
      setDisplayGoals(prev => [...prev, goal]);
      setNewGoalText('');
    }
  };

  const handleToggleGoal = async (id: number, currentStatus: boolean) => {
    if (!isViewingSelf) return; // Read only for others
    setDisplayGoals(prev => prev.map(g => g.id === id ? { ...g, is_completed: !currentStatus } : g));
    await storage.toggleGoal(id, !currentStatus);
  };

  const handleDeleteGoal = async (id: number) => {
    if (!isViewingSelf) return;
    setDisplayGoals(prev => prev.filter(g => g.id !== id));
    await storage.deleteGoal(id);
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
          alert(`✅ 学习记录已提交！\nRating 提升: +${ratingChange} 📈`);
      } else {
          alert(`⚠️ 摸鱼记录已提交！\nRating 扣除: ${ratingChange} 📉`);
      }
      
      // Update history if viewing self
      if (isViewingSelf) {
         const rHist = await storage.getRatingHistory(currentUser.id);
         setRatingHistory(rHist);
      }
      setLogMode('study');

    } catch (e) {
      alert("提交失败，请重试");
    } finally {
      setIsLogging(false);
    }
  };

  const saveMotto = () => {
    localStorage.setItem('user_motto', motto);
    setIsEditingMotto(false);
  };

  // Filter CheckIns for the SELECTED user
  const selectedUserCheckIns = useMemo(() => {
      return checkIns.filter(c => c.userId === selectedUserId);
  }, [checkIns, selectedUserId]);

  // Statistics Calculation (Based on SELECTED user)
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
      return ratingHistory.map(r => ({
          date: new Date(r.recorded_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
          rating: r.rating
      }));
  }, [ratingHistory]);

  const ratingColorClass = getUserStyle(selectedUser.role, selectedUser.rating);
  const titleName = getTitleName(selectedUser.role, selectedUser.rating);

  return (
    <div className="space-y-6 pb-10">
      
      {/* 0. Top Bar: User Selector */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
         <div className="flex items-center gap-3">
             <div className="p-2 bg-brand-50 rounded-lg">
                 <Filter className="w-5 h-5 text-brand-600" />
             </div>
             <div>
                 <h2 className="text-sm font-bold text-gray-800">当前查看视图</h2>
                 <p className="text-xs text-gray-500">切换用户以查看不同研友的数据统计</p>
             </div>
         </div>
         <div className="relative min-w-[200px]">
             <select 
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-800 py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
             >
                 {allUsers.map(u => (
                     <option key={u.id} value={u.id}>
                         {u.id === currentUser.id ? '👤 我自己' : `${u.name} (R:${u.rating})`}
                     </option>
                 ))}
             </select>
             <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Profile & Goals & Logger (4 cols) */}
        <div className="xl:col-span-4 space-y-6">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm relative overflow-hidden">
             <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="relative shrink-0">
                  <img src={selectedUser.avatar} className="w-16 h-16 rounded-full border-4 border-gray-50" alt="Avatar" />
                  <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-white">
                    Lv.{Math.floor((selectedUser.rating || 0)/100)}
                  </div>
                </div>
                <div>
                   <h2 className={`text-xl ${ratingColorClass}`}>{selectedUser.name}</h2>
                   <div className="flex items-center gap-2 text-sm mt-1">
                      <span className={`px-2 py-0.5 rounded border opacity-70 ${ratingColorClass}`}>{titleName}</span>
                      <span className="text-gray-400 font-mono font-bold">R: {selectedUser.rating}</span>
                   </div>
                </div>
             </div>
             
             {/* Motto (Only editable by self) */}
             <div className="relative group bg-gray-50 p-3 rounded-xl border border-dashed border-gray-300 transition-colors z-10">
                {isViewingSelf && isEditingMotto ? (
                  <div className="flex items-center gap-2">
                    <input 
                      value={motto} 
                      onChange={e => setMotto(e.target.value)}
                      className="flex-1 bg-white px-2 py-1 rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                      autoFocus
                      onBlur={saveMotto}
                      onKeyDown={e => e.key === 'Enter' && saveMotto()}
                    />
                    <button onClick={saveMotto} className="text-xs bg-brand-600 text-white px-2 py-1 rounded">保存</button>
                  </div>
                ) : (
                  <div 
                    className={`text-sm text-gray-600 italic flex items-center justify-between ${isViewingSelf ? 'cursor-pointer' : ''}`}
                    onClick={() => isViewingSelf && setIsEditingMotto(true)}
                  >
                    <span>“ {isViewingSelf ? motto : '考研人，加油！'} ”</span>
                    {isViewingSelf && <Edit3 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </div>
                )}
             </div>
          </div>

          {/* Daily Goals */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
             <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-brand-500" /> {isViewingSelf ? '我的今日计划' : 'TA 的今日计划'}
             </h3>
             <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1">
                {displayGoals.map(goal => (
                   <div key={goal.id} className="flex items-center gap-2 group">
                      <button 
                        onClick={() => handleToggleGoal(goal.id, goal.is_completed)}
                        disabled={!isViewingSelf}
                        className={!isViewingSelf ? 'cursor-default' : ''}
                      >
                         {goal.is_completed ? <CheckSquare className="w-5 h-5 text-green-500" /> : <Square className="w-5 h-5 text-gray-300 hover:text-brand-500" />}
                      </button>
                      <span className={`flex-1 text-sm ${goal.is_completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{goal.title}</span>
                      {isViewingSelf && (
                        <button onClick={() => handleDeleteGoal(goal.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity">
                            <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                   </div>
                ))}
                {displayGoals.length === 0 && <p className="text-sm text-gray-400 italic">暂无目标</p>}
             </div>
             
             {isViewingSelf && (
                <div className="flex gap-2">
                    <input 
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="添加新目标..."
                    value={newGoalText}
                    onChange={e => setNewGoalText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddGoal()}
                    />
                    <button onClick={handleAddGoal} className="bg-brand-100 text-brand-600 p-1.5 rounded-lg hover:bg-brand-200">
                    <Plus className="w-5 h-5" />
                    </button>
                </div>
             )}
          </div>

          {/* Study Logger (Only for Self) */}
          {isViewingSelf && (
              <div className={`bg-white rounded-2xl p-6 border shadow-sm flex flex-col transition-colors duration-300 ${logMode === 'penalty' ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Clock className={`w-5 h-5 ${logMode === 'penalty' ? 'text-red-500' : 'text-blue-500'}`} /> 
                        {logMode === 'study' ? '学习记录仪' : '摸鱼忏悔室'}
                    </h3>
                    <div className="bg-gray-100 p-1 rounded-lg flex text-xs font-bold">
                        <button 
                            onClick={() => setLogMode('study')}
                            className={`px-3 py-1.5 rounded-md transition-all ${logMode === 'study' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            🔥 专注
                        </button>
                        <button 
                            onClick={() => setLogMode('penalty')}
                            className={`px-3 py-1.5 rounded-md transition-all ${logMode === 'penalty' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            😴 摸鱼
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className={logMode === 'penalty' ? 'opacity-50 pointer-events-none' : ''}>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">科目</label>
                        <select 
                        value={logSubject} 
                        onChange={(e) => {
                            setLogMode('study');
                            setLogSubject(e.target.value as SubjectCategory);
                        }}
                        className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={logMode === 'penalty'}
                        >
                        {Object.values(SubjectCategory).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">时长 (分钟)</label>
                        <input 
                            type="number" value={logDuration} onChange={e => setLogDuration(parseInt(e.target.value))}
                            className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div>
                    <textarea 
                        value={logContent}
                        onChange={e => setLogContent(e.target.value)}
                        className="w-full h-20 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder={logMode === 'study' ? "例如：完成了张宇1000题第一章..." : "例如：刷了半小时抖音，我有罪..."}
                    />
                </div>

                <button 
                    onClick={handleLogStudy}
                    disabled={isLogging || !logContent.trim()}
                    className={`mt-auto w-full py-2.5 rounded-xl font-bold shadow disabled:opacity-50 flex items-center justify-center gap-2 text-white transition-colors ${
                        logMode === 'study' 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                >
                    {isLogging ? '提交中...' : logMode === 'study' ? <><Send className="w-4 h-4" /> 记录 (+Rating)</> : <><AlertCircle className="w-4 h-4" /> 忏悔 (-Rating)</>}
                </button>
                </div>
            </div>
          )}
        </div>

        {/* Right Column: Statistics & Charts & Content List (8 cols) */}
        <div className="xl:col-span-8 space-y-6">
             
             {/* 1. Daily Check-in Content List (The requested "Top" Section) */}
             <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                 <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <ListTodo className="w-5 h-5 text-brand-600" /> 
                    {isViewingSelf ? '我的详细打卡记录' : `${selectedUser.name} 的打卡记录`}
                 </h3>
                 <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                     {selectedUserCheckIns.length > 0 ? (
                        selectedUserCheckIns
                            .sort((a, b) => b.timestamp - a.timestamp)
                            .slice(0, 20)
                            .map(checkIn => (
                                <div key={checkIn.id} className={`p-4 rounded-xl border flex gap-4 ${checkIn.isPenalty ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                                    <div className={`mt-1 font-bold text-xs px-2 py-1 rounded h-fit shrink-0 ${checkIn.isPenalty ? 'bg-red-200 text-red-700' : 'bg-white text-brand-600 border border-brand-100'}`}>
                                        {checkIn.subject}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <p className="text-gray-800 text-sm leading-relaxed">
                                                <MarkdownText content={checkIn.content} />
                                            </p>
                                            <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                                                {new Date(checkIn.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex items-center gap-4 text-xs">
                                            <span className={`flex items-center gap-1 font-bold ${checkIn.isPenalty ? 'text-red-600' : 'text-blue-600'}`}>
                                                <Clock className="w-3 h-3" /> 
                                                {checkIn.isPenalty ? '摸鱼' : '学习'} {checkIn.duration} min
                                            </span>
                                            <span className="text-gray-400">
                                                {new Date(checkIn.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                     ) : (
                         <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                             <UserCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                             <p>该用户暂无打卡记录</p>
                         </div>
                     )}
                 </div>
             </div>

             {/* 2. Stat Cards */}
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="text-blue-100 text-xs mb-1 font-bold uppercase tracking-wider">有效学习</div>
                        <div className="text-2xl font-bold">{(stats.totalStudyMinutes / 60).toFixed(1)} <span className="text-xs font-normal opacity-80">h</span></div>
                    </div>
                    <BrainCircuit className="absolute -bottom-3 -right-3 w-16 h-16 text-white opacity-20" />
                </div>
                <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="text-red-100 text-xs mb-1 font-bold uppercase tracking-wider">摸鱼时间</div>
                        <div className="text-2xl font-bold">{(stats.totalPenaltyMinutes / 60).toFixed(1)} <span className="text-xs font-normal opacity-80">h</span></div>
                    </div>
                    <Gamepad2 className="absolute -bottom-3 -right-3 w-16 h-16 text-white opacity-20" />
                </div>
            </div>

            {/* 3. Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Subject Distribution */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm h-72 flex flex-col">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                        <Flame className="w-4 h-4 text-orange-500" /> 科目精力分布 (按时长)
                    </h3>
                    {stats.pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={stats.pieData} 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={50} 
                                outerRadius={70} 
                                paddingAngle={5} 
                                dataKey="value" // Based on Minutes
                                label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                            >
                            {stats.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value: number) => `${Math.floor(value/60)}h ${value%60}m`} />
                        </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
                            暂无学习时长数据
                        </div>
                    )}
                </div>

                {/* Rating Curve */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm h-72">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-red-500" /> Rating 变化趋势
                    </h3>
                    {ratingChartData.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={ratingChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                                <YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                <Line type="monotone" dataKey="rating" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{r: 4}} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                            数据不足，加油学习！
                        </div>
                    )}
                </div>

                {/* Study Duration Chart */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm h-72 md:col-span-2">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-blue-500" /> 每日有效学习时长 (小时)
                    </h3>
                    {stats.durationData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.durationData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                                <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                            暂无记录
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
