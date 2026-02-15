
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, CheckIn, SubjectCategory, getUserStyle, getTitleName, RatingHistory } from '../types';
import { MarkdownText } from './MarkdownText';
import { Calendar, Filter, Clock, MapPin, X, Search, User as UserIcon, TrendingUp, ChevronLeft, ArrowLeft, History, Trash2, Edit2, Sparkles, ChevronRight, ChevronDown, Save, ShieldCheck, BarChart3, Download, FileText, ChevronDown as ChevronDownIcon } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as storage from '../services/storageService';
import { FullScreenEditor } from './FullScreenEditor';

interface Props {
  user: User; 
  currentUser: User; 
  checkIns: CheckIn[];
  onSearchUser?: (userId: string) => void; 
  onBack?: () => void; 
  onDeleteCheckIn: (id: string) => void; 
  onUpdateCheckIn: (id: string, content: string) => void; 
  onExemptPenalty?: (id: string) => void;
}

// Updated: Business Day Logic (4 AM cut-off)
const formatDateKey = (timestampOrDate: number | Date): string => {
    const date = typeof timestampOrDate === 'number' ? new Date(timestampOrDate) : new Date(timestampOrDate);
    // If hour is before 4 AM, it counts as the previous day
    if (date.getHours() < 4) {
        date.setDate(date.getDate() - 1);
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Helper to aggregate rating history by day
const getDailyAggregatedRatings = (history: RatingHistory[]) => {
    const sorted = [...history].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    const dailyMap = new Map<string, { rating: number, fullDate: string, reason: string, timestamp: number }>();

    sorted.forEach(h => {
        const dateObj = new Date(h.recorded_at);
        const dateKey = dateObj.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
        // Always overwrite, so we keep the LAST rating of that day
        dailyMap.set(dateKey, { 
            rating: h.rating, 
            fullDate: dateObj.toLocaleDateString(), // simplified date
            reason: h.change_reason || '',
            timestamp: dateObj.getTime()
        });
    });

    return Array.from(dailyMap.entries())
        .map(([date, data]) => ({
            date,
            rating: data.rating,
            fullDate: data.fullDate,
            reason: data.reason,
            timestamp: data.timestamp
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
};

// Custom Tooltip Component
const CustomRatingTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const change = data.change;
        const isPositive = change > 0;
        const isNegative = change < 0;
        
        return (
            <div className="bg-white/95 backdrop-blur-md p-4 border border-gray-100 shadow-xl rounded-2xl text-xs max-w-[260px] animate-fade-in z-50">
                <p className="font-bold text-gray-400 mb-2 border-b border-gray-100 pb-1 flex justify-between">
                    <span>{data.fullDate}</span>
                    <span className="font-mono opacity-50">当日结余</span>
                </p>
                <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-black text-gray-800">{data.rating}</span>
                    {change !== 0 && (
                        <span className={`font-bold px-2 py-0.5 rounded-lg text-[10px] flex items-center ${
                            isPositive 
                                ? 'bg-red-50 text-red-600 border border-red-100' 
                                : 'bg-green-50 text-green-600 border border-green-100'
                        }`}>
                            {isPositive ? '▲' : '▼'} {Math.abs(change)}
                        </span>
                    )}
                </div>
                {data.reason && (
                    <div className="text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100 leading-relaxed break-words">
                        <span className="font-bold text-gray-400 block mb-0.5 text-[10px] uppercase">Last Event</span>
                        {data.reason}
                    </div>
                )}
            </div>
        );
    }
    return null;
};

export const Profile: React.FC<Props> = ({ user, currentUser, checkIns, onSearchUser, onBack, onDeleteCheckIn, onUpdateCheckIn, onExemptPenalty }) => {
  const [filterSubject, setFilterSubject] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');
  const [ratingHistory, setRatingHistory] = useState<RatingHistory[]>([]);
  
  // UI States for Popups
  const [showSubjectMenu, setShowSubjectMenu] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Chart Range State
  const [chartRange, setChartRange] = useState<'7days' | '30days' | 'all'>('30days');

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchHistory, setSearchHistory] = useState<User[]>([]);

  // Edit State
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | null>(null);
  
  // Goal Edit State
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState(user.dailyGoal || 90);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d.toISOString().split('T')[0];
  });
  const [exportEndDate, setExportEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Pagination State
  const [visibleCount, setVisibleCount] = useState(20);

  const subjectButtonRef = useRef<HTMLButtonElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);

  // Close popups on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (subjectButtonRef.current && !subjectButtonRef.current.contains(event.target as Node)) {
            setShowSubjectMenu(false);
        }
        if (calendarButtonRef.current && !calendarButtonRef.current.contains(event.target as Node)) {
             // Don't close if clicking inside the calendar itself
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load Data
  useEffect(() => {
      const loadData = async () => {
          const history = await storage.getRatingHistory(user.id);
          setRatingHistory(history);
          setNewGoal(user.dailyGoal || 90);
          
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

  const handleUpdateGoal = async () => {
      if (user.id !== currentUser.id) return;
      try {
          await storage.adminUpdateUser(user.id, { dailyGoal: newGoal });
          user.dailyGoal = newGoal; // Local optimistic update
          setIsEditingGoal(false);
      } catch (e) {
          console.error("Failed to update goal");
      }
  }

  const handleExportMarkdown = () => {
      if (!exportStartDate || !exportEndDate) return;

      const start = new Date(exportStartDate).getTime();
      // Set end date to end of day
      const end = new Date(exportEndDate).setHours(23, 59, 59, 999);

      // Filter Data
      const logs = myCheckIns.filter(c => c.timestamp >= start && c.timestamp <= end);
      
      // Calculate Stats
      let totalDuration = 0;
      const subjectStats: Record<string, number> = {};
      
      logs.forEach(c => {
          if (c.isPenalty) return;
          const dur = c.duration || 0;
          totalDuration += dur;
          subjectStats[c.subject] = (subjectStats[c.subject] || 0) + dur;
      });

      // Build Markdown
      let md = `# 📅 考研复习日志归档 - ${user.name}\n\n`;
      md += `> **导出时间**: ${new Date().toLocaleString()}\n`;
      md += `> **统计范围**: ${exportStartDate} 至 ${exportEndDate}\n\n`;
      
      md += `## 📊 阶段总结\n\n`;
      md += `- **总投入时长**: **${Math.floor(totalDuration / 60)}** 小时 **${totalDuration % 60}** 分钟\n`;
      md += `- **总打卡记录**: **${logs.length}** 条\n`;
      md += `- **当前 Rating**: ${user.rating || 1200}\n\n`;

      md += `### 🍰 科目时间分布\n\n`;
      md += `| 科目 | 总时长 (min) | 占比 |\n`;
      md += `| :--- | :--- | :--- |\n`;
      
      const sortedSubjects = Object.entries(subjectStats).sort((a, b) => b[1] - a[1]);
      
      if (sortedSubjects.length > 0) {
          sortedSubjects.forEach(([sub, dur]) => {
              const percentage = totalDuration > 0 ? ((dur / totalDuration) * 100).toFixed(1) : '0.0';
              md += `| **${sub}** | ${dur} | ${percentage}% |\n`;
          });
      } else {
          md += `| 暂无数据 | - | - |\n`;
      }
      
      md += `\n---\n\n`;
      md += `## 📝 详细记录\n\n`;

      if (logs.length === 0) {
          md += `*该时间段内暂无打卡记录。*\n`;
      } else {
          logs.forEach(c => {
              const dateStr = new Date(c.timestamp).toLocaleString('zh-CN', { 
                  year: 'numeric', month: '2-digit', day: '2-digit', 
                  hour: '2-digit', minute: '2-digit' 
              });
              
              const titlePrefix = c.isPenalty ? '⚠️ [惩罚]' : c.isLeave ? '☕ [请假]' : `✅ [${c.subject}]`;
              const durationText = !c.isPenalty && !c.isLeave ? `(${c.duration} min)` : '';
              
              md += `### ${dateStr} ${titlePrefix} ${durationText}\n\n`;
              if (c.userRating) md += `> **Rating**: ${c.userRating}\n\n`;
              md += `${c.content}\n\n`;
              if (c.imageUrl) md += `![Image](${c.imageUrl})\n\n`;
              md += `---\n\n`;
          });
      }

      // Create Download
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `KyTracker_${user.name}_${exportStartDate}_${exportEndDate}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setShowExportModal(false);
  };

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
        const dateStr = formatDateKey(c.timestamp); // Use business date logic
        return dateStr === filterDate;
      });
    }
    return list;
  }, [myCheckIns, filterSubject, filterDate]);

  // Handle Show More logic
  const handleShowMore = () => {
      const total = filteredCheckIns.length;
      // Increment by 5% of total, but minimum 5 items
      const increment = Math.max(5, Math.ceil(total * 0.05));
      setVisibleCount(prev => prev + increment);
  };

  const displayCheckIns = filteredCheckIns.slice(0, visibleCount);
  const hasMore = visibleCount < filteredCheckIns.length;

  const totalDays = new Set(myCheckIns.map(c => formatDateKey(c.timestamp))).size;
  const totalDuration = myCheckIns.filter(c => !c.isPenalty).reduce((acc, curr) => acc + (curr.duration || 0), 0);

  const chartData = useMemo(() => {
      const dailyData = getDailyAggregatedRatings(ratingHistory);
      
      // Calculate delta
      const dataWithDelta = dailyData.map((item, index) => {
          const prev = dailyData[index - 1];
          const change = prev ? item.rating - prev.rating : 0;
          return { ...item, change };
      });

      // Filter by Range
      const now = new Date();
      let limitDate = new Date(0); // Default all time

      if (chartRange === '7days') {
          limitDate = new Date();
          limitDate.setDate(now.getDate() - 7);
      } else if (chartRange === '30days') {
          limitDate = new Date();
          limitDate.setDate(now.getDate() - 30);
      }

      if (chartRange !== 'all') {
          return dataWithDelta.filter(d => d.timestamp >= limitDate.getTime());
      }

      return dataWithDelta;
  }, [ratingHistory, chartRange]);

  const displaySearchUsers = useMemo(() => {
      if (!searchQuery.trim()) {
          const historyIds = new Set(searchHistory.map(u => u.id));
          return allUsers.filter(u => !historyIds.has(u.id)).slice(0, 10);
      }
      return allUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allUsers, searchQuery, searchHistory]);

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    return { daysInMonth, firstDayOfWeek, year, month };
  };

  const dailyStatusMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    myCheckIns.forEach(c => {
        const key = formatDateKey(c.timestamp);
        map[key] = true;
    });
    return map;
  }, [myCheckIns]);

  const renderCalendar = () => {
    const { daysInMonth, firstDayOfWeek, year, month } = getDaysInMonth(calendarMonth);
    const cells = [];
    const monthStr = String(month + 1).padStart(2, '0');

    for (let i = 0; i < firstDayOfWeek; i++) {
        cells.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;
        const hasCheckIn = dailyStatusMap[dateStr];
        const isSelected = filterDate === dateStr;
        const isToday = dateStr === formatDateKey(new Date());

        cells.push(
            <button
                key={dateStr}
                onClick={() => {
                    setFilterDate(isSelected ? '' : dateStr);
                    if (!isSelected) setShowCalendar(false);
                }}
                className={`h-8 w-8 rounded-full flex flex-col items-center justify-center text-xs relative transition-all
                    ${isSelected ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-700 hover:bg-brand-50'}
                    ${isToday && !isSelected ? 'text-brand-600 font-bold border border-brand-200' : ''}
                `}
            >
                {d}
                {hasCheckIn && !isSelected && (
                    <div className="w-1 h-1 rounded-full bg-brand-500 mt-0.5"></div>
                )}
            </button>
        );
    }
    return cells;
  };


  return (
    <div className="min-h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-slide-up relative">
        
        {/* Export Modal */}
        {showExportModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowExportModal(false)}>
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-brand-600" /> 导出学习日志
                        </h3>
                        <button onClick={() => setShowExportModal(false)}><X className="w-5 h-5 text-gray-400"/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">开始日期</label>
                            <input 
                                type="date" 
                                value={exportStartDate}
                                onChange={e => setExportStartDate(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">结束日期</label>
                            <input 
                                type="date" 
                                value={exportEndDate}
                                onChange={e => setExportEndDate(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed pt-2">
                            * 将导出 Markdown 格式文件，包含所选时间段内的统计摘要、科目占比分析以及详细的打卡内容。
                        </p>
                    </div>
                    <div className="p-4 border-t border-gray-100 flex gap-3">
                        <button onClick={() => setShowExportModal(false)} className="flex-1 py-2.5 rounded-xl text-gray-500 font-bold hover:bg-gray-100 transition-colors">取消</button>
                        <button onClick={handleExportMarkdown} className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 flex items-center justify-center gap-2 transition-transform active:scale-95">
                            <Download className="w-4 h-4" /> 确认导出
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Editor Modal */}
        <FullScreenEditor 
            isOpen={!!editingCheckIn}
            onClose={() => setEditingCheckIn(null)}
            initialContent={editingCheckIn?.content || ''}
            initialSubject={editingCheckIn?.subject}
            initialDuration={editingCheckIn?.duration || 0}
            allowDurationEdit={false} 
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
            <div className="absolute top-6 right-6 z-10 flex gap-2">
                {user.id === currentUser.id && (
                    <button 
                        onClick={() => setShowExportModal(true)}
                        className="bg-white/20 backdrop-blur-md p-2.5 rounded-xl text-white hover:bg-white/30 transition-colors border border-white/20 shadow-lg"
                        title="下载数据"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                )}
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
                    {/* Goal Editor */}
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                        {isEditingGoal ? (
                            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2 py-1">
                                <input 
                                    type="number" 
                                    value={newGoal} 
                                    onChange={e => setNewGoal(parseInt(e.target.value))}
                                    className="w-16 bg-white border border-gray-300 rounded px-1 text-center font-bold text-gray-700 text-xs"
                                />
                                <button onClick={handleUpdateGoal} className="text-green-600"><Save className="w-4 h-4"/></button>
                                <button onClick={() => setIsEditingGoal(false)} className="text-gray-400"><X className="w-4 h-4"/></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => user.id === currentUser.id && setIsEditingGoal(true)}>
                                <span>🎯 每日目标: <span className="font-bold text-gray-700">{user.dailyGoal || 90}</span> min</span>
                                {user.id === currentUser.id && <Edit2 className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />}
                            </div>
                        )}
                    </div>
                </div>
                
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
            <div className="mt-8 mb-2 w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm relative overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-red-500" /> Rating 积分走势
                    </h3>
                    {/* Range Selector */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setChartRange('7days')} 
                            className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all ${chartRange === '7days' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            近7天
                        </button>
                        <button 
                            onClick={() => setChartRange('30days')} 
                            className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all ${chartRange === '30days' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            近30天
                        </button>
                        <button 
                            onClick={() => setChartRange('all')} 
                            className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all ${chartRange === 'all' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            全部
                        </button>
                    </div>
                </div>
                
                <div className="h-64 w-full">
                    {chartData.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorRatingRed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
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
                                    width={30}
                                />
                                <Tooltip content={<CustomRatingTooltip />} />
                                <Area 
                                    type="monotone"
                                    dataKey="rating" 
                                    stroke="#f43f5e" 
                                    strokeWidth={3} 
                                    fillOpacity={1} 
                                    fill="url(#colorRatingRed)" 
                                    dot={{r: 4, fill: '#fff', stroke: '#f43f5e', strokeWidth: 2}} 
                                    activeDot={{r: 6, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2}}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-xs flex-col gap-2">
                            <BarChart3 className="w-8 h-8 opacity-20" />
                            <span>数据不足，多打卡几次来看看吧</span>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Filter Bar */}
        <div className="px-4 md:px-8 py-4 bg-gray-50/80 border-y border-gray-100 flex flex-wrap gap-3 items-center sticky top-0 z-20 backdrop-blur-md">
            <div className="flex items-center gap-2 text-gray-500 font-bold text-sm mr-2">
                <Filter className="w-4 h-4" /> 筛选日志
            </div>
            
            {/* Subject Popup Menu */}
            <div className="relative">
                <button 
                    ref={subjectButtonRef}
                    onClick={() => setShowSubjectMenu(!showSubjectMenu)}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                >
                    {filterSubject === 'ALL' ? '全部科目' : filterSubject}
                    <ChevronDownIcon className="w-3 h-3" />
                </button>
                
                {showSubjectMenu && (
                    <div className="absolute top-full left-0 mt-2 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-30 overflow-hidden animate-fade-in flex flex-col">
                         <button 
                             onClick={() => { setFilterSubject('ALL'); setShowSubjectMenu(false); }}
                             className={`px-4 py-2 text-left text-xs font-bold hover:bg-gray-50 ${filterSubject === 'ALL' ? 'text-brand-600 bg-brand-50' : 'text-gray-600'}`}
                         >
                             全部科目
                         </button>
                         {Object.values(SubjectCategory).map(cat => (
                             <button 
                                 key={cat}
                                 onClick={() => { setFilterSubject(cat); setShowSubjectMenu(false); }}
                                 className={`px-4 py-2 text-left text-xs font-bold hover:bg-gray-50 ${filterSubject === cat ? 'text-brand-600 bg-brand-50' : 'text-gray-600'}`}
                             >
                                 {cat}
                             </button>
                         ))}
                    </div>
                )}
            </div>

            {/* Date Popup Calendar */}
            <div className="relative">
                <button 
                    ref={calendarButtonRef}
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                >
                    <Calendar className="w-3 h-3" />
                    {filterDate || '全部日期'}
                </button>

                {showCalendar && (
                    <div 
                        className="absolute top-full left-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-30 p-4 w-64 animate-fade-in"
                        onMouseDown={e => e.stopPropagation()} 
                    >
                        <div className="flex justify-between items-center mb-3">
                             <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="p-1 hover:bg-gray-100 rounded text-gray-400"><ChevronLeft className="w-4 h-4" /></button>
                             <span className="text-sm font-bold text-gray-700">{calendarMonth.getFullYear()}年 {calendarMonth.getMonth() + 1}月</span>
                             <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="p-1 hover:bg-gray-100 rounded text-gray-400"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 place-items-center mb-1">
                             {['日', '一', '二', '三', '四', '五', '六'].map(d => <span key={d} className="text-[10px] text-gray-400">{d}</span>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1 place-items-center">
                            {renderCalendar()}
                        </div>
                    </div>
                )}
            </div>

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
            {displayCheckIns.length > 0 ? (
                <>
                    {displayCheckIns.map((checkIn, index) => {
                        const isLast = index === displayCheckIns.length - 1;
                        const dateObj = new Date(checkIn.timestamp);
                        const timeStr = dateObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                        // Display calendar date, even if grouped under previous business day
                        const displayDateStr = dateObj.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
                        
                        const canEdit = currentUser.id === checkIn.userId || currentUser.role === 'admin';
                        const isAdmin = currentUser.role === 'admin';
                        const isPenalty = checkIn.isPenalty;

                        return (
                            <div key={checkIn.id} className="flex gap-4 md:gap-6 group">
                                {/* Timeline Column */}
                                <div className="flex flex-col items-center shrink-0 w-16 pt-1">
                                    <span className="text-xs font-black text-gray-800">{timeStr}</span>
                                    <span className="text-[10px] text-gray-400 font-mono mb-2">{displayDateStr}</span>
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
                                                    : (checkIn.isLeave ? 'bg-yellow-100 text-yellow-600 border-yellow-200' : 'bg-brand-50 text-brand-600 border-brand-100')
                                                }`}>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60"></div>
                                                    {checkIn.isLeave ? '请假申请' : checkIn.subject}
                                                </span>
                                                {!checkIn.isLeave && checkIn.duration > 0 && (
                                                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${
                                                        checkIn.isPenalty ? 'text-red-500 bg-white border-red-100' : 'text-gray-500 bg-gray-50 border-gray-100'
                                                    }`}>
                                                        <Clock className="w-3 h-3"/> {checkIn.duration} min
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Edit/Delete Actions */}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* Admin Exempt Button */}
                                                {isAdmin && isPenalty && onExemptPenalty && (
                                                    <button 
                                                        onClick={() => onExemptPenalty(checkIn.id)}
                                                        className="text-indigo-500 bg-indigo-50 hover:bg-indigo-100 transition-colors px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 mr-2"
                                                        title="免除扣分"
                                                    >
                                                        <ShieldCheck className="w-4 h-4" /> 豁免
                                                    </button>
                                                )}
                                            
                                                {canEdit && (
                                                    <>
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
                                                    </>
                                                )}
                                            </div>
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
                    })}
                    
                    {hasMore && (
                        <div className="text-center py-4">
                            <button 
                                onClick={handleShowMore}
                                className="px-6 py-2 bg-gray-50 text-gray-500 rounded-full text-xs font-bold hover:bg-gray-100 transition-colors border border-gray-200"
                            >
                                加载更多记录 ({filteredCheckIns.length - visibleCount})
                            </button>
                        </div>
                    )}
                    {!hasMore && filteredCheckIns.length > 20 && (
                        <div className="text-center py-4 text-xs text-gray-300">
                            已无更多数据
                        </div>
                    )}
                </>
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
