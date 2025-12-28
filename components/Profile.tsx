
import React, { useState, useMemo, useEffect } from 'react';
import { User, CheckIn, SubjectCategory, getUserStyle, getTitleName, RatingHistory } from '../types';
import { MarkdownText } from './MarkdownText';
import { Calendar, Filter, Clock, MapPin, X, Search, User as UserIcon, TrendingUp, ChevronLeft, ArrowLeft, History, Trash2, Edit2, Sparkles } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as storage from '../services/storageService';
import { FullScreenEditor } from './FullScreenEditor';

interface Props {
  user: User; 
  currentUser: User; 
  checkIns: CheckIn[];
  onSearchUser?: (userId: string) => void; 
  onBack?: () => void; 
  onDeleteCheckIn: (id: string) => void; // New prop
  onUpdateCheckIn: (id: string, content: string) => void; // New prop
}

export const Profile: React.FC<Props> = ({ user, currentUser, checkIns, onSearchUser, onBack, onDeleteCheckIn, onUpdateCheckIn }) => {
  const [filterSubject, setFilterSubject] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');
  const [ratingHistory, setRatingHistory] = useState<RatingHistory[]>([]);
  
  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchHistory, setSearchHistory] = useState<User[]>([]);

  // Edit State
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | null>(null);

  // Load Data
  useEffect(() => {
      const loadData = async () => {
          const history = await storage.getRatingHistory(user.id);
          setRatingHistory(history);
          
          if (isSearchOpen) {
              const users = await storage.getAllUsers();
              setAllUsers(users);
              
              // Load search history
              const savedHistory = localStorage.getItem('kaoyan_search_history');
              if (savedHistory) {
                  setSearchHistory(JSON.parse(savedHistory));
              }
          }
      };
      loadData();
  }, [user.id, isSearchOpen]);

  const handleSearchSelect = (targetUser: User) => {
      // Save to history (Keep top 5, remove duplicates)
      const newHistory = [targetUser, ...searchHistory.filter(u => u.id !== targetUser.id)].slice(0, 5);
      setSearchHistory(newHistory);
      localStorage.setItem('kaoyan_search_history', JSON.stringify(newHistory));

      if (onSearchUser) onSearchUser(targetUser.id);
      setIsSearchOpen(false);
      setSearchQuery('');
  };

  const clearSearchHistory = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSearchHistory([]);
      localStorage.removeItem('kaoyan_search_history');
  }

  const handleSaveEdit = (newContent: string) => {
      if (editingCheckIn) {
          onUpdateCheckIn(editingCheckIn.id, newContent);
          setEditingCheckIn(null);
      }
  }

  const myCheckIns = useMemo(() => {
    return checkIns.filter(c => c.userId === user.id).sort((a, b) => b.timestamp - a.timestamp);
  }, [checkIns, user.id]);

  const filteredCheckIns = useMemo(() => {
    let list = myCheckIns;
    if (filterSubject !== 'ALL') {
      list = list.filter(c => c.subject === filterSubject);
    }
    if (filterDate) {
      list = list.filter(c => {
        const dateStr = new Date(c.timestamp).toISOString().split('T')[0];
        return dateStr === filterDate;
      });
    }
    return list;
  }, [myCheckIns, filterSubject, filterDate]);

  const totalDays = new Set(myCheckIns.map(c => new Date(c.timestamp).toDateString())).size;
  const totalDuration = myCheckIns.reduce((acc, curr) => acc + (curr.duration || 0), 0);

  const chartData = useMemo(() => {
      const data = [...ratingHistory].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
      return data.map(r => ({
          date: new Date(r.recorded_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
          rating: r.rating,
          fullDate: new Date(r.recorded_at).toLocaleString()
      }));
  }, [ratingHistory]);

  // Filter users for search list
  const displaySearchUsers = useMemo(() => {
      if (!searchQuery.trim()) {
          // If empty query, show "Recommended" (random subset of all users excluding history)
          // For simplicity, just show top 10 rated users
          const historyIds = new Set(searchHistory.map(u => u.id));
          return allUsers.filter(u => !historyIds.has(u.id)).slice(0, 10);
      }
      return allUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allUsers, searchQuery, searchHistory]);

  return (
    <div className="min-h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-slide-up relative">
        
        {/* Editor Modal */}
        <FullScreenEditor 
            isOpen={!!editingCheckIn}
            onClose={() => setEditingCheckIn(null)}
            initialContent={editingCheckIn?.content || ''}
            initialSubject={editingCheckIn?.subject}
            initialDuration={editingCheckIn?.duration || 0}
            allowDurationEdit={false} // Duration immutable in edit mode usually
            onSave={handleSaveEdit}
            title="修改打卡日志"
            submitLabel="保存修改"
        />

        {/* Full Screen User Search Overlay */}
        {isSearchOpen && (
            <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-xl p-6 flex flex-col animate-fade-in">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setIsSearchOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-6 h-6 text-gray-600"/></button>
                    <div className="flex-1 relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                            autoFocus
                            placeholder="输入用户名查找研友..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-100 border-none rounded-xl py-3 pl-12 pr-4 text-gray-800 font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                    {/* Search History Section */}
                    {!searchQuery && searchHistory.length > 0 && (
                        <div>
                            <div className="flex justify-between items-center px-2 mb-2">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <History className="w-3 h-3" /> 最近搜索
                                </h3>
                                <button onClick={clearSearchHistory} className="text-xs text-red-400 hover:text-red-600">清空</button>
                            </div>
                            <div className="space-y-1">
                                {searchHistory.map(u => (
                                    <button 
                                        key={u.id}
                                        onClick={() => handleSearchSelect(u)}
                                        className="w-full flex items-center gap-4 p-2 hover:bg-gray-50 rounded-xl transition-colors group"
                                    >
                                        <img src={u.avatar} className="w-8 h-8 rounded-full bg-gray-200 border border-transparent group-hover:border-gray-200" />
                                        <div className="text-left flex-1">
                                            <div className="font-bold text-sm text-gray-700">{u.name}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Main User List */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-2 flex items-center gap-1">
                            {!searchQuery ? <><Sparkles className="w-3 h-3"/> 活跃研友</> : '搜索结果'}
                        </h3>
                        <div className="space-y-2">
                            {displaySearchUsers.map(u => (
                                <button 
                                    key={u.id}
                                    onClick={() => handleSearchSelect(u)}
                                    className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100"
                                >
                                    <img src={u.avatar} className="w-10 h-10 rounded-full bg-gray-200" />
                                    <div className="text-left">
                                        <div className={`font-bold text-sm ${getUserStyle(u.role, u.rating)}`}>{u.name}</div>
                                        <div className="text-xs text-gray-400 font-mono">Rating: {u.rating ?? 1200}</div>
                                    </div>
                                </button>
                            ))}
                            {displaySearchUsers.length === 0 && searchQuery && (
                                <div className="text-center py-10 text-gray-400 text-sm">未找到用户</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Header Background */}
        <div className="h-48 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 relative">
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            
            {/* Top Actions */}
            <div className="absolute top-6 left-6 z-10">
                {onBack && user.id !== currentUser.id && (
                    <button 
                        onClick={onBack}
                        className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-white/30 transition-colors border border-white/20"
                    >
                        <ChevronLeft className="w-4 h-4" /> 返回
                    </button>
                )}
            </div>
            <div className="absolute top-6 right-6 z-10">
                <button 
                    onClick={() => setIsSearchOpen(true)}
                    className="bg-white/20 backdrop-blur-md p-2.5 rounded-xl text-white hover:bg-white/30 transition-colors border border-white/20 shadow-lg"
                    title="搜索用户"
                >
                    <Search className="w-5 h-5" />
                </button>
            </div>

            <div className="absolute -bottom-16 left-8">
                <img 
                    src={user.avatar} 
                    className="w-32 h-32 rounded-full border-4 border-white shadow-xl bg-gray-100 object-cover"
                    alt={user.name} 
                />
            </div>
        </div>

        {/* User Info & Stats */}
        <div className="pt-20 px-4 md:px-8 pb-6">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div>
                    <h1 className={`text-3xl font-black ${getUserStyle(user.role, user.rating)}`}>{user.name}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold font-mono">
                            ID: {user.id.substring(0, 8)}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            (user.rating || 1200) >= 2000 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>
                            {getTitleName(user.role, user.rating)} (R: {user.rating || 1200})
                        </span>
                        {user.id === currentUser.id && (
                            <span className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold border border-green-100">
                                🟢 当前在线
                            </span>
                        )}
                    </div>
                </div>
                
                {/* Stat Cards */}
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="flex-1 md:flex-none text-center p-3 bg-gray-50 rounded-2xl min-w-[80px] border border-gray-100">
                        <div className="text-2xl font-black text-gray-800">{totalDays}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">打卡天数</div>
                    </div>
                    <div className="flex-1 md:flex-none text-center p-3 bg-gray-50 rounded-2xl min-w-[80px] border border-gray-100">
                        <div className="text-2xl font-black text-gray-800">{myCheckIns.length}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">总记录</div>
                    </div>
                    <div className="flex-1 md:flex-none text-center p-3 bg-gray-50 rounded-2xl min-w-[80px] border border-gray-100">
                        <div className="text-2xl font-black text-gray-800">{Math.round(totalDuration/60)}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">小时</div>
                    </div>
                </div>
            </div>

            {/* Rating Chart */}
            <div className="mt-8 mb-2 h-64 w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm relative overflow-hidden">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Rating 积分走势
                </h3>
                {chartData.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorRatingProfile" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis 
                                dataKey="date" 
                                tick={{fontSize: 10, fill: '#9ca3af'}} 
                                tickLine={false} 
                                axisLine={false} 
                                minTickGap={30} 
                            />
                            <YAxis 
                                domain={['auto', 'auto']} 
                                tick={{fontSize: 10, fill: '#9ca3af'}} 
                                tickLine={false} 
                                axisLine={false} 
                            />
                            <Tooltip 
                                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                                itemStyle={{color: '#4f46e5', fontWeight: 'bold'}}
                                labelStyle={{color: '#9ca3af', marginBottom: '4px'}}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="rating" 
                                stroke="#4f46e5" 
                                strokeWidth={3} 
                                fillOpacity={1} 
                                fill="url(#colorRatingProfile)" 
                                dot={{r: 3, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff'}} 
                                activeDot={{r: 6}}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-xs">
                        数据不足，多打卡几次来看看吧
                    </div>
                )}
            </div>
        </div>

        {/* Filter Bar */}
        <div className="px-4 md:px-8 py-4 bg-gray-50/80 border-y border-gray-100 flex flex-wrap gap-3 items-center sticky top-0 z-20 backdrop-blur-md">
            <div className="flex items-center gap-2 text-gray-500 font-bold text-sm mr-2">
                <Filter className="w-4 h-4" /> 筛选日志
            </div>
            <select 
                value={filterSubject}
                onChange={e => setFilterSubject(e.target.value)}
                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
            >
                <option value="ALL">全部科目</option>
                {Object.values(SubjectCategory).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input 
                type="date" 
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
            />
            {(filterSubject !== 'ALL' || filterDate) && (
                <button 
                    onClick={() => { setFilterSubject('ALL'); setFilterDate(''); }}
                    className="text-red-500 text-xs font-bold hover:underline ml-auto"
                >
                    清除筛选
                </button>
            )}
        </div>

        {/* Timeline Content */}
        <div className="px-4 md:px-8 py-8 space-y-0 bg-white min-h-[500px]">
            {filteredCheckIns.length > 0 ? (
                filteredCheckIns.map((checkIn, index) => {
                    const isLast = index === filteredCheckIns.length - 1;
                    const dateObj = new Date(checkIn.timestamp);
                    const timeStr = dateObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                    const dateStr = dateObj.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
                    
                    const canEdit = currentUser.id === checkIn.userId || currentUser.role === 'admin';

                    return (
                        <div key={checkIn.id} className="flex gap-4 md:gap-6 group">
                            {/* Timeline Column */}
                            <div className="flex flex-col items-center shrink-0 w-16 pt-1">
                                <span className="text-xs font-black text-gray-800">{timeStr}</span>
                                <span className="text-[10px] text-gray-400 font-mono mb-2">{dateStr}</span>
                                <div className={`w-3 h-3 rounded-full border-2 z-10 bg-white ${checkIn.isPenalty ? 'border-red-500 ring-2 ring-red-100' : 'border-brand-500 ring-2 ring-brand-100'}`}></div>
                                {!isLast && <div className="w-0.5 flex-1 bg-gray-100 group-hover:bg-brand-100 transition-colors my-2 rounded-full"></div>}
                            </div>
                            
                            {/* Card Column */}
                            <div className="flex-1 pb-8 max-w-2xl">
                                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group-hover:border-brand-100 relative">
                                    {/* Duration Badge & Actions */}
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1.5 ${
                                                checkIn.isPenalty 
                                                ? 'bg-red-50 text-red-600 border-red-100' 
                                                : 'bg-brand-50 text-brand-600 border-brand-100'
                                            }`}>
                                                <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60"></div>
                                                {checkIn.subject}
                                            </span>
                                            {checkIn.duration > 0 && (
                                                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${
                                                    checkIn.isPenalty ? 'text-red-500 bg-white border-red-100' : 'text-gray-500 bg-gray-50 border-gray-100'
                                                }`}>
                                                    <Clock className="w-3 h-3"/> {checkIn.duration} min
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Edit/Delete Actions */}
                                        {canEdit && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => setEditingCheckIn(checkIn)}
                                                    className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                                    title="编辑"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                    onClick={() => onDeleteCheckIn(checkIn.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="删除"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-gray-800 text-sm leading-relaxed">
                                        <MarkdownText content={checkIn.content} />
                                    </div>
                                    
                                    {checkIn.imageUrl && (
                                        <div className="mt-4">
                                            <img src={checkIn.imageUrl} alt="Log" className="rounded-xl max-h-64 w-full object-cover border border-gray-100" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Search className="w-12 h-12 mb-4 opacity-20" />
                    <p>没有找到相关记录</p>
                </div>
            )}
        </div>

        <style>{`
            .animate-slide-up {
                animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            @keyframes slideUp {
                from { transform: translateY(50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `}</style>
    </div>
  );
};
