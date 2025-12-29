
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { CheckIn, User, Goal, SubjectCategory, RatingHistory, getUserStyle, getTitleName } from '../types';
import * as storage from '../services/storageService';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Trophy, Flame, Edit3, CheckSquare, Square, Plus, Trash2, Clock, Send, TrendingUp, ListTodo, AlertCircle, Eye, EyeOff, BrainCircuit, ChevronDown, UserCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, CalendarCheck, Flag, Sparkles, Activity, Maximize2, Filter, X, Grid3X3, Medal } from 'lucide-react';
import { MarkdownText } from './MarkdownText';
import { ToastType } from './Toast';
import { FullScreenEditor } from './FullScreenEditor';
import { ImageViewer } from './ImageViewer';

interface Props {
  checkIns: CheckIn[];
  currentUser: User;
  onUpdateUser: (user: User) => void;
  onShowToast: (message: string, type: ToastType) => void;
  onUpdateCheckIn?: (id: string, content: string) => void;
  initialSelectedUserId?: string | null;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

const formatDateKey = (timestampOrDate: number | Date): string => {
    const date = typeof timestampOrDate === 'number' ? new Date(timestampOrDate) : timestampOrDate;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const Dashboard: React.FC<Props> = ({ checkIns, currentUser, onUpdateUser, onShowToast, initialSelectedUserId }) => {
  const [motto, setMotto] = useState(() => localStorage.getItem('user_motto') || "考研是一场孤独的旅行，但终点是星辰大海。");
  const [isEditingMotto, setIsEditingMotto] = useState(false);
  
  // View State
  const [selectedUserId, setSelectedUserId] = useState<string>(initialSelectedUserId || currentUser.id);
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
  const [logPreview, setLogPreview] = useState(false); 
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Calendar State (Bottom Section)
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // List Filters State
  const [listFilterSubject, setListFilterSubject] = useState<string>('ALL');
  const [listFilterDate, setListFilterDate] = useState<string>('');

  // Chart Filters
  const [pieFilterType, setPieFilterType] = useState<'day' | 'month' | 'year'>('day');
  const [pieDate, setPieDate] = useState(formatDateKey(new Date()));
  const [pieMonth, setPieMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pieYear, setPieYear] = useState(new Date().getFullYear().toString());

  // Pie Chart Custom Date Picker State
  const [showPieDatePicker, setShowPieDatePicker] = useState(false);
  const [piePickerMonth, setPiePickerMonth] = useState(new Date());
  const pieDatePickerRef = useRef<HTMLDivElement>(null);

  const [barDateRange, setBarDateRange] = useState<{start: string, end: string}>({
      start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
  });

  // Heatmap State
  const [heatmapYear, setHeatmapYear] = useState<number>(new Date().getFullYear());

  // Exam Date State
  const defaultTarget = "2025-12-20"; 
  const [targetDateStr, setTargetDateStr] = useState(() => localStorage.getItem('kaoyan_target_date') || defaultTarget);
  const [isEditingTarget, setIsEditingTarget] = useState(false);

  // Image Viewer
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const isAdmin = currentUser.role === 'admin';
  const isViewingSelf = selectedUserId === currentUser.id;

  // React to prop change for selected user (e.g. from Admin Modal)
  useEffect(() => {
      if (initialSelectedUserId) {
          setSelectedUserId(initialSelectedUserId);
      }
  }, [initialSelectedUserId]);

  // Click outside handler for Pie Date Picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (pieDatePickerRef.current && !pieDatePickerRef.current.contains(event.target as Node)) {
            setShowPieDatePicker(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load Users - Updated to refresh when checkIns change (for rating sync)
  useEffect(() => {
    storage.getAllUsers().then(users => {
        const sorted = users.sort((a, b) => {
            if (a.role === 'admin') return -1; // Admin top
            if (b.role === 'admin') return 1;
            return (b.rating ?? 0) - (a.rating ?? 0);
        });
        setAllUsers(sorted);
    });
  }, [currentUser.id, checkIns]); // Added checkIns dependency

  // Load Data
  useEffect(() => {
    const loadData = async () => {
        const rHist = await storage.getRatingHistory(selectedUserId);
        setRatingHistory(rHist);
        const uGoals = await storage.getUserGoals(selectedUserId);
        setDisplayGoals(uGoals);
    };
    loadData();
  }, [selectedUserId, checkIns]); 

  const selectedUser = useMemo(() => {
      if (selectedUserId === currentUser.id) return currentUser;
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
      const uniqueDays = new Set(selectedUserCheckIns.filter(c => !c.isPenalty).map(c => formatDateKey(c.timestamp)));
      return uniqueDays.size;
  }, [selectedUserCheckIns]);

  const totalCheckInCount = useMemo(() => {
      return selectedUserCheckIns.filter(c => !c.isPenalty).length;
  }, [selectedUserCheckIns]);

  const stats = useMemo(() => {
    const subjectDuration: Record<string, number> = {}; 
    const dateDuration: Record<string, number> = {}; 
    let totalStudyMinutes = 0;
    let totalPenaltyMinutes = 0;
    
    const sortedCheckIns = [...selectedUserCheckIns].sort((a, b) => a.timestamp - b.timestamp);

    sortedCheckIns.forEach(c => {
      const dateKey = formatDateKey(c.timestamp);
      const duration = c.duration || 0;

      if (c.isPenalty) {
          totalPenaltyMinutes += duration; 
      } else {
          // Pie Chart Logic
          let includeInPie = false;
          if (pieFilterType === 'day' && dateKey === pieDate) includeInPie = true;
          if (pieFilterType === 'month' && dateKey.startsWith(pieMonth)) includeInPie = true;
          if (pieFilterType === 'year' && dateKey.startsWith(pieYear)) includeInPie = true;

          if (includeInPie) {
             subjectDuration[c.subject] = (subjectDuration[c.subject] || 0) + duration;
          }

          // Bar Chart Logic (Date Range)
          if (dateKey >= barDateRange.start && dateKey <= barDateRange.end) {
              const barKey = new Date(c.timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
              dateDuration[barKey] = (dateDuration[barKey] || 0) + duration;
          }
          
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
  }, [selectedUserCheckIns, pieFilterType, pieDate, pieMonth, pieYear, barDateRange]);

  // --- Heatmap Logic (Updated for Year Selection) ---
  const heatmapData = useMemo(() => {
      const data: Record<string, number> = {};
      selectedUserCheckIns.filter(c => !c.isPenalty).forEach(c => {
          const date = formatDateKey(c.timestamp);
          data[date] = (data[date] || 0) + 1; // Count check-ins
      });
      return data;
  }, [selectedUserCheckIns]);

  const ratingChartData = useMemo(() => {
      const dailyRatings = new Map<string, { rating: number, reason: string }>();
      const sorted = [...ratingHistory].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
      
      sorted.forEach(r => {
          const dateKey = new Date(r.recorded_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
          dailyRatings.set(dateKey, { rating: r.rating, reason: r.change_reason || '' });
      });

      return Array.from(dailyRatings.entries()).map(([date, data]) => ({
          date,
          rating: data.rating,
          reason: data.reason
      }));
  }, [ratingHistory]);

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

  const executeLogStudy = async (contentStr: string, subjectVal: SubjectCategory, durationVal: number) => {
    if (!contentStr.trim()) return;
    setIsLogging(true);
    
    let ratingChange = 0;
    let newRating = currentUser.rating ?? 1200;

    if (logMode === 'study') {
        ratingChange = Math.floor(durationVal / 10) + 1;
        newRating += ratingChange;
    } else {
        ratingChange = -Math.round((durationVal / 10) * 1.5) - 1;
        newRating += ratingChange;
    }

    const newCheckIn: CheckIn = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      userRating: newRating,
      userRole: currentUser.role,
      subject: logMode === 'study' ? subjectVal : SubjectCategory.OTHER,
      content: contentStr,
      duration: durationVal,
      isPenalty: logMode === 'penalty',
      timestamp: Date.now(),
      likedBy: []
    };

    try {
      await storage.addCheckIn(newCheckIn);
      const reason = logMode === 'study' ? `专注学习 ${durationVal} 分钟` : `摸鱼/娱乐 ${durationVal} 分钟 (扣分)`;
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
      console.error(e);
      onShowToast("提交失败，请重试", 'error');
    } finally {
      setIsLogging(false);
    }
  }

  const handleLogStudy = async () => {
      await executeLogStudy(logContent, logSubject, logDuration);
  };

  const saveMotto = () => {
    localStorage.setItem('user_motto', motto);
    setIsEditingMotto(false);
    onShowToast("座右铭已更新", 'success');
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    return { daysInMonth, firstDayOfWeek, year, month };
  };

  const dailyStatusMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    selectedUserCheckIns.forEach(c => {
        const key = formatDateKey(c.timestamp);
        map[key] = true;
    });
    return map;
  }, [selectedUserCheckIns]);

  const displayedCheckIns = useMemo(() => {
      let list = selectedUserCheckIns;
      
      // Default behavior: Show only today's check-ins if no date is selected
      const todayStr = formatDateKey(new Date());

      if (selectedDate) {
          list = list.filter(c => formatDateKey(c.timestamp) === selectedDate);
      } else if (listFilterDate) {
          list = list.filter(c => formatDateKey(c.timestamp) === listFilterDate);
      } else {
          // Default: Today only
          list = list.filter(c => formatDateKey(c.timestamp) === todayStr);
      }

      if (listFilterSubject !== 'ALL') list = list.filter(c => c.subject === listFilterSubject);
      
      // Limit results for "Recent Activity" (Partial view)
      return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }, [selectedUserCheckIns, selectedDate, listFilterSubject, listFilterDate]);

  // --- Calendar Renderers ---

  // 1. Dashboard Main Calendar
  const renderCalendar = () => {
    const { daysInMonth, firstDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const cells = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(<div key={`empty-${i}`} className="h-9 w-9"></div>);
    for (let d = 1; d <= daysInMonth; d++) {
        const currentDay = new Date(year, month, d);
        const dateStr = formatDateKey(currentDay);
        const hasCheckIn = dailyStatusMap[dateStr];
        const isSelected = selectedDate === dateStr;
        const isToday = dateStr === formatDateKey(new Date());
        cells.push(
            <button
                key={dateStr}
                onClick={() => {
                    setSelectedDate(isSelected ? null : dateStr);
                    if (!isSelected) setListFilterDate('');
                }}
                className={`h-9 w-9 rounded-xl flex flex-col items-center justify-center text-xs relative transition-all group
                    ${isSelected ? 'bg-brand-600 text-white shadow-lg shadow-brand-200 scale-105 z-10' : 'text-gray-700 hover:bg-white hover:shadow-sm'}
                    ${isToday && !isSelected ? 'text-brand-600 font-bold border border-brand-200 bg-brand-50' : ''}
                `}
            >
                {d}
                {hasCheckIn && (
                    <div className={`w-1.5 h-1.5 rounded-full mt-0.5 transition-colors ${isSelected ? 'bg-white' : 'bg-brand-500'}`}></div>
                )}
            </button>
        );
    }
    return cells;
  };

  // 2. Pie Chart Popup Calendar
  const renderPiePickerCalendar = () => {
      const { daysInMonth, firstDayOfWeek, year, month } = getDaysInMonth(piePickerMonth);
      const cells = [];
      const monthStr = String(month + 1).padStart(2, '0');

      for (let i = 0; i < firstDayOfWeek; i++) {
          cells.push(<div key={`empty-${i}`} className="h-7 w-7"></div>);
      }

      for (let d = 1; d <= daysInMonth; d++) {
          const dayStr = String(d).padStart(2, '0');
          const dateStr = `${year}-${monthStr}-${dayStr}`;
          const hasCheckIn = dailyStatusMap[dateStr];
          const isSelected = pieDate === dateStr;
          const isToday = dateStr === formatDateKey(new Date());

          cells.push(
              <button
                  key={dateStr}
                  onClick={() => {
                      setPieDate(dateStr);
                      setShowPieDatePicker(false);
                  }}
                  className={`h-7 w-7 rounded-full flex flex-col items-center justify-center text-[10px] relative transition-all
                      ${isSelected ? 'bg-brand-600 text-white shadow-md' : 'text-gray-700 hover:bg-brand-50'}
                      ${isToday && !isSelected ? 'text-brand-600 font-bold border border-brand-200' : ''}
                  `}
              >
                  {d}
                  {hasCheckIn && !isSelected && (
                      <div className="w-1 h-1 rounded-full bg-green-500 mt-0.5"></div>
                  )}
              </button>
          );
      }
      return cells;
  };

  // 3. Heatmap Renderer (Yearly)
  const renderHeatmap = () => {
      // Calculate start and end date of the selected heatmap year
      const startDate = new Date(heatmapYear, 0, 1);
      const endDate = new Date(heatmapYear, 11, 31);
      
      const weeks = [];
      let currentWeek = [];
      
      // Pad beginning based on day of week (0 is Sunday)
      const startDay = startDate.getDay(); 
      for(let i=0; i<startDay; i++) {
          currentWeek.push({ date: null, count: 0 });
      }

      // Loop through all days of the year
      const d = new Date(startDate);
      while (d <= endDate) {
          const dateStr = formatDateKey(d);
          const count = heatmapData[dateStr] || 0;
          
          currentWeek.push({ date: dateStr, count });
          
          if (currentWeek.length === 7) {
              weeks.push(currentWeek);
              currentWeek = [];
          }
          
          d.setDate(d.getDate() + 1);
      }
      
      // Pad end if week is incomplete
      if(currentWeek.length > 0) {
          while (currentWeek.length < 7) {
              currentWeek.push({ date: null, count: 0 });
          }
          weeks.push(currentWeek);
      }

      return (
          <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-2">
              {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1">
                      {week.map((day, dIdx) => (
                          <div 
                            key={dIdx} 
                            className={`w-2.5 h-2.5 rounded-sm ${
                                !day.date ? 'bg-transparent' : 
                                day.count === 0 ? 'bg-gray-100' :
                                day.count === 1 ? 'bg-green-200' :
                                day.count <= 3 ? 'bg-green-400' : 'bg-green-600'
                            }`}
                            title={day.date ? `${day.date}: ${day.count} 次打卡` : ''}
                          ></div>
                      ))}
                  </div>
              ))}
          </div>
      );
  }

  const ratingColorClass = getUserStyle(selectedUser.role, selectedUser.rating ?? 1200);
  const titleName = getTitleName(selectedUser.role, selectedUser.rating ?? 1200);

  // Admin View
  if (isAdmin && selectedUserId === currentUser.id) {
        const leaderboardUsers = [...allUsers].sort((a, b) => (b.rating ?? 1200) - (a.rating ?? 1200));
        return (
          <div className="space-y-6 animate-fade-in pb-20">
               <div className="flex justify-between items-center mb-4">
                   <h1 className="text-2xl font-bold text-gray-800">管理后台看板</h1>
                   <div className="relative">
                       <select 
                           value={selectedUserId}
                           onChange={(e) => setSelectedUserId(e.target.value)}
                           className="appearance-none bg-white border border-gray-200 text-gray-600 py-2 pl-4 pr-10 rounded-full text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
                       >
                           {allUsers.map(u => (
                               <option key={u.id} value={u.id}>
                                   {u.id === currentUser.id ? '🏆 排行榜 (管理员)' : `👀 ${u.name}`}
                               </option>
                           ))}
                       </select>
                       <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                   </div>
               </div>
              <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm overflow-hidden">
                  <h2 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-2">
                      <Trophy className="w-6 h-6 text-yellow-500" /> 全员 Rating 排行榜
                  </h2>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                          <thead>
                              <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                  <th className="pb-3 pl-2">排名</th>
                                  <th className="pb-3">用户</th>
                                  <th className="pb-3">头衔</th>
                                  <th className="pb-3 text-right">Rating</th>
                              </tr>
                          </thead>
                          <tbody className="text-sm">
                              {leaderboardUsers.map((u, idx) => (
                                  <tr key={u.id} className="group hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                      <td className="py-3 pl-2 font-mono text-gray-500 w-12">
                                          {idx < 3 ? <Medal className={`w-5 h-5 ${idx===0?'text-yellow-500':idx===1?'text-gray-400':'text-orange-600'}`} /> : idx + 1}
                                      </td>
                                      <td className="py-3 flex items-center gap-3">
                                          <img src={u.avatar} className="w-8 h-8 rounded-full bg-gray-100" />
                                          <span className={`font-bold ${getUserStyle(u.role, u.rating)}`}>{u.name}</span>
                                          {u.role === 'admin' && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 rounded">Admin</span>}
                                      </td>
                                      <td className="py-3 text-gray-500 text-xs font-medium">
                                          {getTitleName(u.role, u.rating)}
                                      </td>
                                      <td className="py-3 text-right font-black text-gray-800 font-mono">
                                          {u.rating || 1200}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 pb-24 animate-fade-in relative">
      
      <FullScreenEditor 
          isOpen={isFullScreen}
          onClose={() => setIsFullScreen(false)}
          initialContent={logContent}
          initialSubject={logSubject}
          initialDuration={logDuration}
          onSave={executeLogStudy}
      />

      <ImageViewer 
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          images={viewerImages}
          initialIndex={0}
      />

      {/* Greeting Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
            <h1 className="text-3xl font-black text-gray-800">
                {(() => {
                    const h = new Date().getHours();
                    if(h<5) return '深夜好';
                    if(h<11) return '早上好';
                    if(h<13) return '中午好';
                    if(h<18) return '下午好';
                    return '晚上好';
                })()}，<span className="text-brand-600">{currentUser.name}</span>
            </h1>
            <p className="text-gray-500 font-medium mt-1 flex items-center gap-2">
                今天也要加油呀！✨
            </p>
        </div>
        <div className="hidden md:block text-right">
             <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Today</div>
             <div className="text-xl font-bold text-gray-700 font-mono">
                 {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
             </div>
        </div>
      </div>
      
      {/* --- Row 1: Profile & Key Stats --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
           {/* Profile Card */}
           <div className="lg:col-span-6 bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 border border-white shadow-xl shadow-gray-100/50 relative overflow-hidden flex flex-col justify-between group transition-all hover:shadow-2xl hover:shadow-brand-100/50">
               {/* ... Profile Info ... */}
               <div className="absolute top-6 right-6 z-20">
                   <div className="relative">
                       <select 
                           value={selectedUserId}
                           onChange={(e) => setSelectedUserId(e.target.value)}
                           className="appearance-none bg-white/50 border border-gray-200 text-gray-600 py-1.5 pl-3 pr-8 rounded-full text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer hover:bg-white transition-colors"
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
                       <img src={selectedUser.avatar} className="w-20 h-20 rounded-full border-4 border-white shadow-lg shadow-gray-200 bg-gray-100 object-cover" alt="Avatar" />
                       <div className={`absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-full text-[10px] font-black text-white shadow-md border-2 border-white ${
                           selectedUser.rating && selectedUser.rating >= 2100 ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-brand-500 to-blue-600'
                       }`}>
                           Lv.{Math.floor((selectedUser.rating ?? 1200)/100)}
                       </div>
                   </div>
                   <div>
                       <h2 className={`text-2xl ${ratingColorClass}`}>{selectedUser.name}</h2>
                       <div className="flex items-center gap-2 mt-1.5">
                           <span className={`text-xs px-2 py-0.5 rounded-md font-bold border shadow-sm ${ratingColorClass.includes('text-red') ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                               {titleName}
                           </span>
                           <span className="text-gray-400 text-xs font-mono font-bold bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                               R: {selectedUser.rating ?? 1200} <span className="mx-1 text-gray-300">|</span> {totalCheckInCount} 次
                           </span>
                       </div>
                   </div>
               </div>

               <div className="mt-6 relative z-10">
                   {/* Motto Input */}
                   <div className="relative group/motto inline-block max-w-full w-full">
                       {isViewingSelf && isEditingMotto ? (
                           <input 
                               value={motto} 
                               onChange={e => setMotto(e.target.value)}
                               onBlur={saveMotto}
                               onKeyDown={e => e.key === 'Enter' && saveMotto()}
                               autoFocus
                               className="bg-white border-b-2 border-brand-500 text-gray-700 text-sm py-1 px-2 focus:outline-none w-full rounded shadow-sm"
                           />
                       ) : (
                           <div 
                               onClick={() => isViewingSelf && setIsEditingMotto(true)}
                               className={`bg-white/60 backdrop-blur rounded-xl p-3 border border-white/50 text-gray-600 italic text-sm flex items-start gap-2 shadow-sm ${isViewingSelf ? 'cursor-pointer hover:bg-white transition-all' : ''}`}
                           >
                               <Sparkles className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                               <span>{motto || "设置一个座右铭激励自己吧..."}</span>
                           </div>
                       )}
                   </div>
               </div>
               
               <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-brand-50/50 to-purple-50/50 rounded-bl-[100px] -mr-10 -mt-10 -z-0"></div>
           </div>

           {/* Countdown & Streak */}
           <div className="lg:col-span-3 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
               {/* Countdown Content */}
               <div className="relative z-10 h-full flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                       <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-indigo-100 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-white/10">
                           <Flag className="w-3 h-3"/> 考研倒计时
                       </div>
                       {isViewingSelf && (
                           <button onClick={() => setIsEditingTarget(!isEditingTarget)} className="text-white/50 hover:text-white transition-colors bg-white/10 p-1.5 rounded-full hover:bg-white/20">
                               <Edit3 className="w-3.5 h-3.5"/>
                           </button>
                       )}
                   </div>
                   <div className="mt-4">
                       {isEditingTarget ? (
                           <div className="flex flex-col gap-2 animate-fade-in bg-white/10 p-2 rounded-xl">
                                <input 
                                    type="date" 
                                    value={targetDateStr}
                                    onChange={(e) => setTargetDateStr(e.target.value)}
                                    className="text-gray-900 text-xs rounded px-2 py-1 outline-none w-full"
                                />
                                <button onClick={handleSaveTargetDate} className="bg-white text-indigo-600 font-bold text-xs py-1 rounded shadow-sm">保存</button>
                           </div>
                       ) : (
                           <>
                               <div className="text-5xl font-black tracking-tighter drop-shadow-lg">
                                   {daysUntilExam > 0 ? daysUntilExam : 0}
                                   <span className="text-base font-medium opacity-60 ml-1 align-baseline">天</span>
                               </div>
                               <div className="text-[10px] text-indigo-200 mt-2 font-mono opacity-80 bg-black/10 w-fit px-2 py-0.5 rounded">Target: {targetDateStr}</div>
                           </>
                       )}
                   </div>
               </div>
               <CalendarCheck className="absolute -bottom-6 -right-6 w-32 h-32 text-white opacity-5 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
           </div>

           <div className="lg:col-span-3 bg-gradient-to-br from-brand-500 to-cyan-500 rounded-[2rem] p-6 text-white shadow-xl shadow-blue-200 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
               {/* Streak Content */}
               <div className="relative z-10 h-full flex flex-col justify-between">
                   <div className="w-fit bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-blue-100 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-white/10">
                       <Flame className="w-3 h-3"/> 累计打卡
                   </div>
                   <div>
                       <div className="text-5xl font-black tracking-tighter drop-shadow-lg">
                           {totalCheckInDays}
                           <span className="text-base font-medium opacity-60 ml-1 align-baseline">天</span>
                       </div>
                       <div className="text-[10px] text-blue-100 mt-2 font-mono opacity-80 bg-black/10 w-fit px-2 py-0.5 rounded">Keep Going!</div>
                   </div>
               </div>
               <Trophy className="absolute -bottom-6 -right-6 w-32 h-32 text-white opacity-5 -rotate-12 group-hover:rotate-0 transition-transform duration-500" />
           </div>
      </div>

      {/* --- Row 1.5: Contribution Heatmap (Yearly) --- */}
      <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                  <Grid3X3 className="w-5 h-5 text-green-600" /> 年度学习热力图
              </h3>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                  <button 
                    onClick={() => setHeatmapYear(y => y - 1)} 
                    className="p-1 hover:bg-white hover:shadow-sm rounded-md text-gray-500 transition-all"
                  >
                      <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-gray-700 w-12 text-center select-none">{heatmapYear}</span>
                  <button 
                    onClick={() => setHeatmapYear(y => y + 1)} 
                    className="p-1 hover:bg-white hover:shadow-sm rounded-md text-gray-500 transition-all"
                  >
                      <ChevronRight className="w-4 h-4" />
                  </button>
              </div>
          </div>
          {renderHeatmap()}
          <div className="flex items-center gap-2 justify-end text-[10px] text-gray-400 mt-2">
              <span>Less</span>
              <div className="w-2.5 h-2.5 bg-gray-100 rounded-sm"></div>
              <div className="w-2.5 h-2.5 bg-green-200 rounded-sm"></div>
              <div className="w-2.5 h-2.5 bg-green-400 rounded-sm"></div>
              <div className="w-2.5 h-2.5 bg-green-600 rounded-sm"></div>
              <span>More</span>
          </div>
      </div>

      {/* --- Row 2: Actions --- */}
      {/* ... Logger and ToDo ... */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            {isViewingSelf ? (
                <div className={`bg-white rounded-[2rem] p-6 border shadow-lg flex flex-col transition-all duration-300 h-full ${logMode === 'penalty' ? 'border-red-100 shadow-red-50' : 'border-blue-100 shadow-blue-50'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                            <Clock className={`w-5 h-5 ${logMode === 'penalty' ? 'text-red-500' : 'text-blue-500'}`} /> 
                            {logMode === 'study' ? '记录学习成果' : '摸鱼忏悔室'}
                        </h3>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setIsFullScreen(true)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="全屏沉浸模式"><Maximize2 className="w-4 h-4" /></button>
                            <div className="bg-gray-100/80 p-1 rounded-xl flex text-xs font-bold shadow-inner">
                                <button onClick={() => setLogMode('study')} className={`px-4 py-1.5 rounded-lg transition-all ${logMode === 'study' ? 'bg-white text-brand-600 shadow-sm scale-105' : 'text-gray-500 hover:text-gray-700'}`}>🔥 学习</button>
                                <button onClick={() => setLogMode('penalty')} className={`px-4 py-1.5 rounded-lg transition-all ${logMode === 'penalty' ? 'bg-white text-red-600 shadow-sm scale-105' : 'text-gray-500 hover:text-gray-700'}`}>😴 摸鱼</button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="flex gap-3">
                            <div className={`flex-1 relative ${logMode === 'penalty' ? 'opacity-50 pointer-events-none' : ''}`}>
                                <select value={logSubject} onChange={(e) => { setLogMode('study'); setLogSubject(e.target.value as SubjectCategory); }} className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-bold text-gray-700 appearance-none hover:bg-gray-50 transition-colors">
                                    {Object.values(SubjectCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                            <div className="w-32 relative group">
                                <input type="number" value={logDuration} onChange={e => setLogDuration(parseInt(e.target.value))} className="w-full bg-gray-50/50 border border-gray-100 rounded-xl pl-4 pr-10 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-black text-gray-700 group-hover:bg-gray-50 transition-colors" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none font-bold">min</span>
                            </div>
                        </div>
                        <div className="relative">
                            <textarea value={logContent} onChange={e => setLogContent(e.target.value)} className="w-full h-32 bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder-gray-400 leading-relaxed hover:bg-gray-50 transition-colors" placeholder={logMode === 'study' ? "今天学了什么？(支持 Markdown)" : "坦白从宽，为什么摸鱼..."} />
                        </div>
                        <button onClick={handleLogStudy} disabled={isLogging || !logContent.trim()} className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] hover:-translate-y-0.5 ${logMode === 'study' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-200 hover:shadow-blue-300' : 'bg-gradient-to-r from-red-500 to-pink-600 shadow-red-200 hover:shadow-red-300'}`}>{isLogging ? '提交中' : '立即记录'}</button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                    <UserCircle className="w-12 h-12 mb-3 opacity-20" />
                    <p className="font-medium">你正在查看 {selectedUser.name} 的主页</p>
                </div>
            )}
          </div>
          <div className="lg:col-span-4">
            <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm h-full flex flex-col">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                    <CheckSquare className="w-5 h-5 text-brand-500" /> {isViewingSelf ? '今日 To-Do' : 'TA 的 To-Do'}
                </h3>
                <div className="space-y-2 mb-4 flex-1 overflow-y-auto max-h-[220px] custom-scrollbar pr-1">
                    {displayGoals.map(goal => (
                    <div key={goal.id} className="flex items-center gap-3 group p-3 bg-gray-50 hover:bg-white border border-transparent hover:border-gray-100 hover:shadow-sm rounded-xl transition-all cursor-pointer" onClick={() => isViewingSelf && handleToggleGoal(goal.id, goal.is_completed)}>
                        <div className={`transition-colors ${goal.is_completed ? 'text-green-500' : 'text-gray-300 group-hover:text-brand-400'}`}>
                            {goal.is_completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </div>
                        <span className={`flex-1 text-sm font-medium transition-all ${goal.is_completed ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-700'}`}>{goal.title}</span>
                        {isViewingSelf && <button onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                    ))}
                    {displayGoals.length === 0 && <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2"><ListTodo className="w-8 h-8 opacity-20"/><p className="text-xs">暂无目标，添加一个吧！</p></div>}
                </div>
                {isViewingSelf && (
                    <div className="flex gap-2 mt-auto pt-4 border-t border-gray-50">
                        <input className="flex-1 bg-gray-50 border border-transparent hover:border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none" placeholder="输入目标..." value={newGoalText} onChange={e => setNewGoalText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddGoal()} />
                        <button onClick={handleAddGoal} className="bg-brand-600 text-white p-2.5 rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all active:scale-95 shrink-0"><Plus className="w-5 h-5" /></button>
                    </div>
                )}
            </div>
          </div>
      </div>

      {/* --- Row 3: Charts --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                     <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm"><TrendingUp className="w-5 h-5 text-red-500" /> Rating 积分趋势</h3>
                </div>
                <div className="h-64">
                    {ratingChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={ratingChartData}>
                                <defs><linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} minTickGap={30} />
                                <YAxis domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} itemStyle={{color: '#ef4444', fontWeight: 'bold'}} />
                                <Area type="monotone" dataKey="rating" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorRating)" dot={{r: 3, fill: '#ef4444', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs bg-gray-50/50 rounded-2xl border border-dashed border-gray-100"><TrendingUp className="w-8 h-8 mb-2 opacity-20" /><p>坚持打卡，让曲线飙升！</p></div>
                    )}
                </div>
          </div>
          <div className="lg:col-span-4 bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex flex-col">
                <div className="mb-6 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm"><BrainCircuit className="w-5 h-5 text-orange-500" /> 科目时长</h3>
                    </div>
                    {/* Improved Filter Controls */}
                    <div className="bg-gray-100 p-1.5 rounded-xl flex flex-col gap-1">
                        <div className="flex text-[10px] font-bold">
                            <button onClick={() => setPieFilterType('day')} className={`flex-1 py-1 rounded-md transition-all ${pieFilterType === 'day' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'}`}>日</button>
                            <button onClick={() => setPieFilterType('month')} className={`flex-1 py-1 rounded-md transition-all ${pieFilterType === 'month' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'}`}>月</button>
                            <button onClick={() => setPieFilterType('year')} className={`flex-1 py-1 rounded-md transition-all ${pieFilterType === 'year' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'}`}>年</button>
                        </div>
                        {pieFilterType === 'day' && (
                            <div className="relative" ref={pieDatePickerRef}>
                                <button 
                                    onClick={() => setShowPieDatePicker(!showPieDatePicker)}
                                    className="w-full text-xs bg-white rounded-md px-2 py-1 text-center font-mono text-gray-600 font-bold flex items-center justify-center gap-1 shadow-sm border border-transparent hover:border-orange-200"
                                >
                                    {pieDate} <ChevronDown className="w-3 h-3 text-gray-400"/>
                                </button>
                                {showPieDatePicker && (
                                    <div className="absolute top-full left-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-20 p-3 w-56 animate-fade-in">
                                         <div className="flex justify-between items-center mb-2">
                                             <button onClick={() => setPiePickerMonth(new Date(piePickerMonth.getFullYear(), piePickerMonth.getMonth() - 1, 1))} className="p-1 hover:bg-gray-100 rounded text-gray-400"><ChevronLeft className="w-3 h-3" /></button>
                                             <span className="text-xs font-bold text-gray-700">{piePickerMonth.getFullYear()}年 {piePickerMonth.getMonth() + 1}月</span>
                                             <button onClick={() => setPiePickerMonth(new Date(piePickerMonth.getFullYear(), piePickerMonth.getMonth() + 1, 1))} className="p-1 hover:bg-gray-100 rounded text-gray-400"><ChevronRight className="w-3 h-3" /></button>
                                         </div>
                                         <div className="grid grid-cols-7 gap-1 place-items-center">
                                             {['日', '一', '二', '三', '四', '五', '六'].map(d => <span key={d} className="text-[10px] text-gray-400">{d}</span>)}
                                             {renderPiePickerCalendar()}
                                         </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {pieFilterType === 'month' && (
                            <input type="month" value={pieMonth} onChange={e => setPieMonth(e.target.value)} className="w-full text-xs border-0 bg-white rounded-md px-2 py-1 text-center font-mono text-gray-600" />
                        )}
                        {pieFilterType === 'year' && (
                            <div className="w-full text-xs bg-white rounded-md px-2 py-1 text-center font-mono text-gray-600 font-bold">{pieYear}</div>
                        )}
                    </div>
                </div>
                <div className="flex-1 min-h-[200px] relative">
                    {stats.pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label={false} stroke="none">
                            {stats.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value: number) => `${Math.floor(value/60)}h ${value%60}m`} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-xs bg-gray-50/50 rounded-2xl border border-dashed border-gray-100"><Activity className="w-8 h-8 mb-2 opacity-20" /><p>该时间段无记录</p></div>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {stats.pieData.slice(0, 4).map((entry, index) => (
                        <div key={index} className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded-full"><div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>{entry.name}</div>
                    ))}
                </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm h-80">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                        <Clock className="w-5 h-5 text-blue-500" /> 每日时长 (小时)
                    </h3>
                    <div className="flex gap-2 items-center text-xs">
                        <input type="date" value={barDateRange.start} onChange={e => setBarDateRange(p => ({...p, start: e.target.value}))} className="border rounded px-1 text-gray-600" />
                        <span className="text-gray-400">-</span>
                        <input type="date" value={barDateRange.end} onChange={e => setBarDateRange(p => ({...p, end: e.target.value}))} className="border rounded px-1 text-gray-600" />
                    </div>
                </div>
                <div className="h-56">
                    {stats.durationData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.durationData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                                <YAxis tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} cursor={{fill: '#f9fafb'}} />
                                <Bar dataKey="hours" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                         <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs bg-gray-50/50 rounded-2xl border border-dashed border-gray-100"><Clock className="w-8 h-8 mb-2 opacity-20" /><p>暂无数据</p></div>
                    )}
                </div>
          </div>
          <div className="lg:col-span-4 bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm"><CalendarIcon className="w-5 h-5 text-brand-600" /> 学习日历</h3>
                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1 hover:bg-white hover:shadow-sm rounded-md text-gray-500 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-xs font-bold text-gray-700 w-16 text-center select-none">{currentMonth.getMonth() + 1}月</span>
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1 hover:bg-white hover:shadow-sm rounded-md text-gray-500 transition-all"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="text-center text-[10px] text-gray-400 font-bold py-1 uppercase">{d}</div>)}
                    {renderCalendar()}
                </div>
          </div>
      </div>

      <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm"><ListTodo className="w-5 h-5 text-brand-600" /> {selectedDate ? `${selectedDate} 的记录` : '最近动态'}</h3>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div className="relative"><Filter className="w-3 h-3 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><select value={listFilterSubject} onChange={(e) => setListFilterSubject(e.target.value)} className="pl-8 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none hover:bg-gray-100 cursor-pointer"><option value="ALL">全部科目</option>{Object.values(SubjectCategory).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div className="relative"><input type="date" value={listFilterDate} onChange={(e) => { setListFilterDate(e.target.value); if (e.target.value) setSelectedDate(null); }} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 hover:bg-gray-100" /></div>
                    {(selectedDate || listFilterDate || listFilterSubject !== 'ALL') && <button onClick={() => { setSelectedDate(null); setListFilterDate(''); setListFilterSubject('ALL'); }} className="text-xs bg-red-50 text-red-500 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 transition-colors flex items-center gap-1"><X className="w-3 h-3" /> 重置</button>}
                </div>
             </div>
             <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                 {displayedCheckIns.length > 0 ? (
                    displayedCheckIns.map(checkIn => (
                            <div key={checkIn.id} className={`p-4 rounded-2xl border flex gap-4 transition-all hover:shadow-md ${checkIn.isPenalty ? 'bg-red-50/30 border-red-100' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                                <div className={`mt-1 font-bold text-[10px] px-2.5 py-1 rounded-lg h-fit shrink-0 ${checkIn.isPenalty ? 'bg-red-100 text-red-600' : 'bg-brand-50 text-brand-600'}`}>{checkIn.subject}</div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <div className="text-gray-800 text-sm leading-relaxed line-clamp-3"><MarkdownText content={checkIn.content} /></div>
                                        <span className="text-xs text-gray-400 whitespace-nowrap ml-4 font-mono">{new Date(checkIn.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <div className="mt-3 flex items-center gap-3 text-xs">
                                        <span className={`flex items-center gap-1.5 font-bold px-2 py-1 rounded-md ${checkIn.isPenalty ? 'bg-white text-red-500 shadow-sm' : 'bg-gray-50 text-blue-600'}`}><Clock className="w-3 h-3" /> {checkIn.isPenalty ? '摸鱼/惩罚' : '学习'} {checkIn.duration} min</span>
                                        {checkIn.imageUrl && (
                                            <button onClick={(e) => {e.stopPropagation(); setViewerImages([checkIn.imageUrl || '']); setIsViewerOpen(true);}} className="text-indigo-600 hover:underline flex items-center gap-1">
                                                <Eye className="w-3 h-3" /> 查看图片
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                 ) : (
                     <div className="text-center py-12 text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                        <UserCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">
                            {selectedDate || listFilterDate 
                                ? `在该日期，${isViewingSelf ? '你' : 'TA'}似乎在休息` 
                                : `今天暂无动态，${isViewingSelf ? '加油！' : 'TA在潜水？'}`}
                        </p>
                     </div>
                 )}
             </div>
       </div>
    </div>
  );
};
