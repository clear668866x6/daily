
import React, { useMemo, useState, useEffect } from 'react';
import { CheckIn, User, Goal, SubjectCategory, RatingHistory, getUserStyle, getTitleName } from '../types';
import * as storage from '../services/storageService';
import { getBusinessDate } from '../utils/dateUtils';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { Trophy, Clock, Send, TrendingUp, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Sparkles, Zap, Loader2, ListTodo, Target, Settings2, BarChart3, Activity, User as UserIcon } from 'lucide-react';
import { ToastType } from './Toast';
import { MarkdownText } from './MarkdownText';

interface Props {
  checkIns: CheckIn[];
  currentUser: User;
  onUpdateUser: (user: User) => void;
  onShowToast: (message: string, type: ToastType) => void;
}

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1', '#EF4444'];

export const Dashboard: React.FC<Props> = ({ checkIns, currentUser, onUpdateUser, onShowToast }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [ratingHistory, setRatingHistory] = useState<RatingHistory[]>([]);
  const [logSubject, setLogSubject] = useState<SubjectCategory>(SubjectCategory.MATH);
  const [logContent, setLogContent] = useState('');
  const [logDuration, setLogDuration] = useState(45); 
  const [isLogging, setIsLogging] = useState(false);
  const [logMode, setLogMode] = useState<'study' | 'penalty'>('study');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState(() => getBusinessDate(Date.now()));
  const [studyTarget, setStudyTarget] = useState(() => parseInt(localStorage.getItem(`study_target_${currentUser.id}`) || '60'));

  useEffect(() => {
    storage.getAllUsers().then(users => {
        setAllUsers(users.sort((a,b) => (b.rating||0) - (a.rating||0)));
    });
  }, [currentUser.id, checkIns]);

  useEffect(() => {
    const loadData = async () => {
        const [rHist, uGoals] = await Promise.all([
            storage.getRatingHistory(selectedUserId),
            storage.getUserGoals(selectedUserId)
        ]);
        setRatingHistory(rHist);
        setGoals(uGoals);
    };
    loadData();
  }, [selectedUserId, checkIns]); 

  const saveTarget = () => {
      localStorage.setItem(`study_target_${currentUser.id}`, studyTarget.toString());
      onShowToast(`每日目标已更新为 ${studyTarget} 分钟`, 'info');
  };

  const selectedUser = useMemo(() => allUsers.find(u => u.id === selectedUserId) || currentUser, [allUsers, selectedUserId, currentUser]);
  const selectedUserCheckIns = useMemo(() => checkIns.filter(c => c.userId === selectedUserId), [checkIns, selectedUserId]);

  // 1. Rating 趋势数据
  const ratingChartData = useMemo(() => {
    const sorted = [...ratingHistory].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    if (sorted.length === 0) return [{ date: 'Start', rating: 1200 }];
    return sorted.map(r => ({
        date: new Date(r.recorded_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
        rating: r.rating
    }));
  }, [ratingHistory]);

  // 2. 选定日期的科目分布统计
  const selectedDateStats = useMemo(() => {
    const subjectDuration: Record<string, number> = {};
    const dailyCheckIns = selectedUserCheckIns.filter(c => getBusinessDate(c.timestamp) === selectedDate && !c.isPenalty);
    
    dailyCheckIns.forEach(c => {
        subjectDuration[c.subject] = (subjectDuration[c.subject] || 0) + (c.duration || 0);
    });

    return {
        pieData: Object.entries(subjectDuration).map(([name, value]) => ({ name, value })),
        checkIns: dailyCheckIns
    };
  }, [selectedUserCheckIns, selectedDate]);

  // 3. 总时长历史数据 (最近14天)
  const durationHistoryData = useMemo(() => {
      const history: Record<string, number> = {};
      const now = Date.now();
      for (let i = 13; i >= 0; i--) {
          const d = getBusinessDate(now - i * 24 * 60 * 60 * 1000);
          history[d] = 0;
      }
      selectedUserCheckIns.forEach(c => {
          if (!c.isPenalty) {
              const d = getBusinessDate(c.timestamp);
              if (history[d] !== undefined) history[d] += (c.duration || 0);
          }
      });
      return Object.entries(history).map(([date, duration]) => ({
          date: date.substring(5), // 只显示 MM-DD
          duration
      }));
  }, [selectedUserCheckIns]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim() || selectedUserId !== currentUser.id) return;
    const goal = await storage.addGoal(currentUser, newGoalTitle.trim());
    if (goal) { setGoals(prev => [...prev, goal]); setNewGoalTitle(''); }
  };

  const handleToggleGoal = async (id: number, completed: boolean) => {
    if (selectedUserId !== currentUser.id) return;
    setGoals(prev => prev.map(g => g.id === id ? { ...g, is_completed: completed } : g));
    await storage.toggleGoal(id, completed);
  };

  const handleLogStudy = async () => {
    if (!logContent.trim()) return;
    setIsLogging(true);
    let ratingChange = logMode === 'study' ? Math.floor(logDuration / 10) + 1 : -Math.round((logDuration / 10) * 1.5) - 1;
    let newRating = (currentUser.rating || 1200) + ratingChange;
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
      await storage.updateRating(currentUser.id, newRating, logMode === 'study' ? `专注 ${logDuration}min` : `摸鱼 ${logDuration}min`);
      onUpdateUser({ ...currentUser, rating: newRating });
      storage.updateUserLocal({ ...currentUser, rating: newRating });
      setLogContent(''); setLogMode('study');
      onShowToast(`记录成功！Rating ${ratingChange > 0 ? '+' : ''}${ratingChange}`, 'success');
    } finally { setIsLogging(false); }
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const cells = [];
    
    const dayStats: Record<string, number> = {};
    selectedUserCheckIns.forEach(c => {
        if(!c.isPenalty) {
          const dStr = getBusinessDate(c.timestamp);
          dayStats[dStr] = (dayStats[dStr] || 0) + (c.duration || 0);
        }
    });

    const userTarget = selectedUserId === currentUser.id 
        ? studyTarget 
        : parseInt(localStorage.getItem(`study_target_${selectedUserId}`) || '60');

    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} className="h-6 w-6"></div>);
    for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const duration = dayStats[dStr] || 0;
        const isToday = getBusinessDate(Date.now()) === dStr;
        const isSelected = selectedDate === dStr;
        
        let dotColor = "bg-transparent";
        if (duration > 0) {
            dotColor = duration >= userTarget ? "bg-green-500" : "bg-yellow-400";
        }

        cells.push(
          <div key={d} className="flex flex-col items-center justify-center relative">
            <button 
              onClick={() => setSelectedDate(dStr)}
              className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] transition-all
              ${isSelected ? 'ring-2 ring-brand-500 bg-brand-50 text-brand-600 font-black' : ''}
              ${isToday ? 'bg-brand-600 text-white font-bold shadow-lg shadow-brand-100' : 'text-gray-500 hover:bg-gray-100'}
            `}>
              {d}
            </button>
            <div className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
          </div>
        );
    }
    return cells;
  };

  // 管理员专属排行榜视图
  if (currentUser.role === 'admin' && selectedUserId === currentUser.id) {
    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            <div className="bg-white rounded-[32px] p-8 border shadow-sm">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Trophy className="text-yellow-500"/> 全员 Rating 排行榜</h2>
                        <p className="text-gray-400 text-sm mt-1">管理员视角：实时监控研友表现</p>
                    </div>
                    <div className="bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
                        <span className="text-xs font-black text-indigo-600 uppercase">Admin Mode</span>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allUsers.filter(u => u.role !== 'admin').map((u, idx) => (
                        <button 
                            key={u.id} 
                            onClick={() => setSelectedUserId(u.id)}
                            className="bg-gray-50/50 border border-transparent hover:border-brand-500 hover:bg-white p-6 rounded-[24px] flex items-center gap-4 transition-all group"
                        >
                            <div className="text-lg font-black text-gray-300 group-hover:text-brand-600 w-6">#{idx + 1}</div>
                            <img src={u.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" alt={u.name} />
                            <div className="flex-1 text-left min-w-0">
                                <div className={`font-black truncate ${getUserStyle(u.role, u.rating)}`}>{u.name}</div>
                                <div className="text-[10px] text-gray-400 font-bold uppercase">{getTitleName(u.role, u.rating)}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-black text-gray-800">{u.rating}</div>
                                <div className="text-[8px] text-gray-400 font-black uppercase">Points</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-fade-in">
      {/* 1. Header Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 bg-white rounded-[32px] p-8 border shadow-sm flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
              <div className="absolute top-4 right-6 z-10 flex gap-2">
                  <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="appearance-none bg-gray-50 border border-gray-100 px-4 py-2 pr-8 rounded-full text-xs font-bold focus:outline-none cursor-pointer hover:bg-white transition-all">
                      {allUsers.map(u => <option key={u.id} value={u.id}>{u.id === currentUser.id ? '👤 ' + u.name : `👀 ${u.name}`}</option>)}
                  </select>
              </div>
              <div className="relative">
                  <img src={selectedUser.avatar} className="w-24 h-24 rounded-full border-4 border-white shadow-xl ring-2 ring-brand-50" alt="Avatar" />
                  <div className="absolute -bottom-1 -right-1 bg-brand-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-white">Lv.{Math.floor((selectedUser.rating || 1200) / 100)}</div>
              </div>
              <div className="flex-1">
                  <div className="flex flex-col md:flex-row items-center gap-3 mb-2">
                      <h2 className={`text-2xl font-black truncate ${getUserStyle(selectedUser.role, selectedUser.rating)}`}>{selectedUser.name}</h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-brand-50 text-brand-600 uppercase">{getTitleName(selectedUser.role, selectedUser.rating)}</span>
                  </div>
                  <p className="text-xs text-gray-400 italic font-medium">Rating: {selectedUser.rating || 1200} · {selectedUser.role.toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-6 divide-x divide-gray-100 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                  <div className="flex flex-col items-center px-4">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">今日时长</span>
                      <div className="text-3xl font-black text-brand-600">{selectedUserCheckIns.filter(c => getBusinessDate(c.timestamp) === getBusinessDate(Date.now())).reduce((a,b)=>a+(b.duration||0), 0)}<span className="text-xs ml-0.5">m</span></div>
                  </div>
                  <div className="flex flex-col items-center px-4">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">累计打卡</span>
                      <div className="text-3xl font-black text-orange-500">{new Set(selectedUserCheckIns.map(c => getBusinessDate(c.timestamp))).size}<span className="text-xs ml-0.5">天</span></div>
                  </div>
              </div>
          </div>
          <div className="bg-brand-600 rounded-[32px] p-8 text-white shadow-xl flex flex-col justify-between relative overflow-hidden group">
              <Sparkles className="absolute top-[-20px] right-[-20px] w-32 h-32 text-white/10 rotate-12" />
              <h4 className="text-sm font-black mb-1 opacity-80 flex items-center gap-2 text-white/80"><Target className="w-4 h-4"/> 考研倒计时</h4>
              <div className="text-3xl font-black italic">{Math.max(0, Math.ceil((new Date("2025-12-21").getTime() - new Date().setHours(0,0,0,0))/(1000*3600*24)))}<span className="text-sm ml-1 not-italic">DAYS</span></div>
              <div className="text-[10px] font-bold opacity-60 tracking-wider">SUCCESS JOURNEY 2025</div>
          </div>
      </div>

      {/* 2. Charts & Calendar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Calendar & Selected Date Records */}
          <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-[32px] p-8 border shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-black text-gray-800 text-lg flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-indigo-500"/> 打卡日历</h3>
                    <div className="flex gap-1">
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><ChevronLeft className="w-4 h-4" /></button>
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-y-4 text-center mb-4">
                      {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-[10px] font-black text-gray-300 uppercase">{d}</div>)}
                      {renderCalendar()}
                  </div>
              </div>

              {/* Selected Date Details */}
              <div className="bg-white rounded-[32px] p-8 border shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                      <h3 className="font-black text-gray-800 text-sm flex items-center gap-2">
                          <Activity className="w-4 h-4 text-brand-600"/> {selectedDate} 详情
                      </h3>
                      <span className="text-[10px] bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-black">
                          {selectedDateStats.checkIns.reduce((a,b)=>a+(b.duration||0), 0)} min
                      </span>
                  </div>
                  
                  {/* Pie Chart for selected date */}
                  <div className="h-[200px] w-full">
                      {selectedDateStats.pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={selectedDateStats.pieData} 
                                    innerRadius={50} 
                                    outerRadius={80} 
                                    paddingAngle={5} 
                                    dataKey="value"
                                    animationDuration={1000}
                                >
                                    {selectedDateStats.pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-[10px] text-gray-300 font-bold uppercase tracking-widest italic">无学习记录</div>
                      )}
                  </div>

                  {/* Check-in list for selected date */}
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {selectedDateStats.checkIns.map((c, i) => (
                          <div key={i} className="bg-gray-50/50 border border-gray-100 p-4 rounded-2xl">
                              <div className="flex justify-between items-center mb-2">
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-white text-gray-500 border">{c.subject}</span>
                                  <span className="text-[10px] font-black text-brand-600">{c.duration}min</span>
                              </div>
                              <div className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">
                                  <MarkdownText content={c.content} />
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>

          {/* Data Trends & Logs */}
          <div className="lg:col-span-8 space-y-6">
              
              {/* Duration Bar Chart */}
              <div className="bg-white rounded-[32px] p-8 border shadow-sm">
                  <h3 className="font-black text-gray-800 text-lg flex items-center gap-2 mb-8"><BarChart3 className="w-5 h-5 text-orange-500"/> 近14日总时长统计</h3>
                  <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={durationHistoryData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 600}} dy={10} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} />
                              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                              <Bar dataKey="duration" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* Rating Curve */}
              <div className="bg-white rounded-[32px] p-8 border shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                      <h3 className="font-black text-gray-800 text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-brand-500"/> Rating 积分趋势</h3>
                  </div>
                  <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={ratingChartData}>
                              <defs>
                                  <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} dy={10} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} domain={['auto', 'auto']} />
                              <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                              <Area type="monotone" dataKey="rating" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorRating)" animationDuration={1500} />
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* Quick Log Form */}
              {selectedUserId === currentUser.id && (
                  <div className="bg-white rounded-[32px] p-8 border shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="font-black text-gray-800 text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-brand-500"/> 快速记录</h3>
                        <div className="bg-gray-100 p-1 rounded-2xl flex text-[10px] font-bold">
                            <button onClick={() => setLogMode('study')} className={`px-5 py-2 rounded-xl transition-all ${logMode==='study'?'bg-white text-brand-600 shadow-sm':'text-gray-400'}`}>高效学习</button>
                            <button onClick={() => setLogMode('penalty')} className={`px-5 py-2 rounded-xl transition-all ${logMode==='penalty'?'bg-white text-red-600 shadow-sm':'text-gray-400'}`}>摸鱼忏悔</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <select value={logSubject} onChange={e => setLogSubject(e.target.value as any)} className="bg-gray-50 border-gray-100 border rounded-2xl px-5 py-3.5 text-sm font-bold outline-none cursor-pointer">
                            {Object.values(SubjectCategory).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="relative">
                            <input type="number" value={logDuration} onChange={e => setLogDuration(parseInt(e.target.value))} className="w-full bg-gray-50 border-gray-100 border rounded-2xl px-5 py-3.5 text-sm font-bold outline-none" placeholder="时长" />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">MIN</span>
                        </div>
                    </div>
                    <textarea value={logContent} onChange={e => setLogContent(e.target.value)} className="w-full bg-gray-50 border-gray-100 border rounded-2xl p-6 text-sm min-h-[120px] focus:ring-2 focus:ring-brand-500 transition-all outline-none resize-none mb-6" placeholder="复习内容总结..." />
                    <button onClick={handleLogStudy} className={`w-full py-4 rounded-2xl font-black text-white shadow-xl active:scale-[0.98] transition-all ${logMode==='study'?'bg-brand-600 hover:bg-brand-700 shadow-brand-100':'bg-red-500 hover:bg-red-600 shadow-red-100'}`}>
                        {isLogging ? <Loader2 className="animate-spin w-5 h-5 mx-auto"/> : <div className="flex items-center justify-center gap-2"><Send className="w-4 h-4"/> 立即记录打卡</div>}
                    </button>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};
