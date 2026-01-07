
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { CheckIn, User, Goal, SubjectCategory, RatingHistory, getUserStyle, getTitleName } from '../types';
import * as storage from '../services/storageService';
import { AreaChart, Area, XAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, YAxis } from 'recharts';
import { Trophy, Edit3, CheckSquare, Square, Plus, Trash2, Clock, Send, TrendingUp, ListTodo, AlertCircle, Eye, ChevronDown, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Flag, Activity, Maximize2, Filter, X, Grid3X3, Medal, Coffee, Save, Shield, CalendarOff, UserPlus, Search, MoreHorizontal, LogOut, CheckCircle2, ChevronUp, ShieldCheck, KeyRound, Users, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { MarkdownText } from './MarkdownText';
import { ToastType } from './Toast';
import { FullScreenEditor } from './FullScreenEditor';
import { ImageViewer } from './ImageViewer';
import { Modal } from './Modal';
import { AdminUserModal } from './AdminUserModal'; 

interface Props {
  checkIns: CheckIn[];
  currentUser: User;
  onUpdateUser: (user: User) => void;
  onShowToast: (message: string, type: ToastType) => void;
  onUpdateCheckIn?: (id: string, content: string) => void;
  onAddCheckIn?: (checkIn: CheckIn) => void; 
  initialSelectedUserId?: string | null;
  onNavigateToUser?: (userId: string) => void; // New prop for admin nav
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

const SUBJECT_WEIGHTS: Record<string, number> = {
    [SubjectCategory.MATH]: 1.2,
    [SubjectCategory.CS_DS]: 1.2,
    [SubjectCategory.CS_CO]: 1.2,
    [SubjectCategory.CS_OS]: 1.2,
    [SubjectCategory.CS_CN]: 1.2,
    [SubjectCategory.ENGLISH]: 1.0,
    [SubjectCategory.POLITICS]: 0.8,
    [SubjectCategory.DAILY]: 0.8,
    [SubjectCategory.OTHER]: 0.8,
    [SubjectCategory.ALGORITHM]: 1.0, 
};

// Updated: Business Day Logic (4 AM cut-off) - Strictly Local Time
const formatDateKey = (timestampOrDate: number | Date): string => {
    const d = typeof timestampOrDate === 'number' ? new Date(timestampOrDate) : new Date(timestampOrDate);
    if (d.getHours() < 4) {
        d.setDate(d.getDate() - 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper for dynamic rating background
const getRatingBackground = (rating: number) => {
    if (rating < 1200) return 'from-gray-600 to-gray-500';
    if (rating < 1400) return 'from-green-600 to-green-500';
    if (rating < 1600) return 'from-cyan-600 to-cyan-500';
    if (rating < 1900) return 'from-blue-600 to-blue-500';
    if (rating < 2100) return 'from-violet-600 to-violet-500';
    if (rating < 2400) return 'from-orange-600 to-orange-500';
    return 'from-red-600 to-rose-600';
};

// Helper to aggregate rating history by day (take the last value of the day)
const getDailyAggregatedRatings = (history: RatingHistory[]) => {
    const sorted = [...history].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    const dailyMap = new Map<string, { rating: number, fullDate: string, reason: string }>();

    sorted.forEach(h => {
        const dateKey = new Date(h.recorded_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
        // Always overwrite, so we keep the LAST rating of that day
        dailyMap.set(dateKey, { 
            rating: h.rating, 
            fullDate: new Date(h.recorded_at).toLocaleString(),
            reason: h.change_reason || ''
        });
    });

    return Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        rating: data.rating,
        fullDate: data.fullDate,
        reason: data.reason
    }));
};

export const Dashboard: React.FC<Props> = ({ checkIns, currentUser, onUpdateUser, onShowToast, initialSelectedUserId, onAddCheckIn, onNavigateToUser }) => {
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
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Filters
  const [showFilterModal, setShowFilterModal] = useState(false);
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

  // Daily Goal Edit State
  const [isEditingDailyGoal, setIsEditingDailyGoal] = useState(false);
  const [tempDailyGoal, setTempDailyGoal] = useState(currentUser.dailyGoal || 90);

  // Image Viewer
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Leave Modal State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveDays, setLeaveDays] = useState(1);
  const [leaveReason, setLeaveReason] = useState('');
  
  // Rule Modal
  const [showRules, setShowRules] = useState(false);

  // Admin Specific
  const [sysAbsentStartDate, setSysAbsentStartDate] = useState('');
  const [allPenalties, setAllPenalties] = useState<CheckIn[]>([]);
  const [showAdminUserModal, setShowAdminUserModal] = useState(false);
  
  // Admin Expandable Rows
  const [expandedUserIds, setExpandedUserIds] = useState<string[]>([]);
  const [userPenaltyMap, setUserPenaltyMap] = useState<Record<string, CheckIn[]>>({});
  const [editingUserRating, setEditingUserRating] = useState<{id: string, rating: number} | null>(null);
  const [editingUserPassword, setEditingUserPassword] = useState<{id: string, password: string} | null>(null);

  const isAdmin = currentUser.role === 'admin';
  const isViewingSelf = selectedUserId === currentUser.id;

  // React to prop change for selected user
  useEffect(() => {
      if (initialSelectedUserId) {
          setSelectedUserId(initialSelectedUserId);
      }
  }, [initialSelectedUserId]);

  // Sync Calendar Click to Chart Filter
  useEffect(() => {
      if (selectedDate) {
          setPieDate(selectedDate);
          setPieFilterType('day');
      }
  }, [selectedDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (pieDatePickerRef.current && !pieDatePickerRef.current.contains(event.target as Node)) {
            setShowPieDatePicker(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load Users
  useEffect(() => {
    storage.getAllUsers().then(users => {
        const sorted = users.sort((a, b) => {
            if (a.role === 'admin') return -1; 
            if (b.role === 'admin') return 1;
            return (b.rating ?? 0) - (a.rating ?? 0);
        });
        setAllUsers(sorted);
    });
  }, [currentUser.id, checkIns]); 

  // Load Data
  useEffect(() => {
    const loadData = async () => {
        const rHist = await storage.getRatingHistory(selectedUserId);
        setRatingHistory(rHist);
        const uGoals = await storage.getUserGoals(selectedUserId);
        setDisplayGoals(uGoals);
        if (isAdmin) {
            const config = storage.getSystemConfig();
            setSysAbsentStartDate(config.absentStartDate);
            const pens = await storage.getAllPenalties();
            setAllPenalties(pens);
        }
    };
    loadData();
  }, [selectedUserId, checkIns, isAdmin]); 

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

  const stats = useMemo(() => {
    const subjectDuration: Record<string, number> = {}; 
    const dateDuration: Record<string, number> = {}; 
    let totalStudyMinutes = 0; // Lifetime Total
    let filteredPieMinutes = 0; // Filtered Total for Pie Chart
    let todayStudyMinutes = 0; // Strictly Today's Business Day Minutes
    let totalPenaltyMinutes = 0;
    
    const todayStr = formatDateKey(new Date());

    const sortedCheckIns = [...selectedUserCheckIns].sort((a, b) => a.timestamp - b.timestamp);

    sortedCheckIns.forEach(c => {
      const dateKey = formatDateKey(c.timestamp);
      const duration = c.duration || 0;

      if (c.isPenalty) {
          totalPenaltyMinutes += duration; 
      } else {
          totalStudyMinutes += duration; // Add to lifetime regardless of filter

          // Pie Chart Logic
          let includeInPie = false;
          if (pieFilterType === 'day' && dateKey === pieDate) includeInPie = true;
          if (pieFilterType === 'month' && dateKey.startsWith(pieMonth)) includeInPie = true;
          if (pieFilterType === 'year' && dateKey.startsWith(pieYear)) includeInPie = true;

          if (includeInPie) {
             subjectDuration[c.subject] = (subjectDuration[c.subject] || 0) + duration;
             filteredPieMinutes += duration; // Sum up only valid pie chart entries
          }

          // Bar Chart Logic (Date Range)
          if (dateKey >= barDateRange.start && dateKey <= barDateRange.end) {
              const label = dateKey.substring(5).replace('-', '/');
              dateDuration[label] = (dateDuration[label] || 0) + duration;
          }
          
          if (dateKey === todayStr) {
              todayStudyMinutes += duration;
          }
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

    return { pieData, durationData, totalStudyMinutes, filteredPieMinutes, todayStudyMinutes, totalPenaltyMinutes };
  }, [selectedUserCheckIns, pieFilterType, pieDate, pieMonth, pieYear, barDateRange]);

  const heatmapData = useMemo(() => {
      const data: Record<string, number> = {};
      selectedUserCheckIns.filter(c => !c.isPenalty).forEach(c => {
          const date = formatDateKey(c.timestamp);
          data[date] = (data[date] || 0) + 1; 
      });
      return data;
  }, [selectedUserCheckIns]);

  const ratingChartData = useMemo(() => {
      return getDailyAggregatedRatings(ratingHistory);
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

  const handleSaveDailyGoal = async () => {
    // Constraint 1: Time cannot be less than 40 mins
    if (tempDailyGoal < 40) {
        onShowToast("每日目标不能少于 40 分钟", 'error');
        return;
    }

    // Constraint 2: Only editable once per day (unless admin)
    const todayStr = formatDateKey(new Date());
    if (currentUser.lastGoalEditDate === todayStr && !isAdmin) {
        onShowToast("每日目标每天只能修改一次", 'error');
        return;
    }

    const updated = { 
        ...currentUser, 
        dailyGoal: tempDailyGoal,
        lastGoalEditDate: todayStr
    };

    try {
        await storage.adminUpdateUser(currentUser.id, { 
            dailyGoal: tempDailyGoal,
            lastGoalEditDate: todayStr
        });
        onUpdateUser(updated);
        storage.updateUserLocal(updated);
        setIsEditingDailyGoal(false);
        onShowToast("每日目标已更新", 'success');
    } catch (e) {
        console.error(e);
        onShowToast("更新失败", 'error');
    }
  }

  // --- Admin Functions ---
  const handleSaveSysConfig = () => {
      storage.setSystemConfig('absentStartDate', sysAbsentStartDate);
      onShowToast("系统配置已保存", 'success');
  };

  const calculateUserStats = (user: User) => {
      const todayStr = formatDateKey(new Date());
      // Calculate today's duration
      const todayCheckIns = checkIns.filter(c => c.userId === user.id && formatDateKey(c.timestamp) === todayStr && !c.isPenalty);
      const todayDuration = todayCheckIns.reduce((acc, c) => acc + (c.duration || 0), 0);
      
      // Calculate total absent counts based on penalty records
      const penalties = allPenalties.filter(p => p.userId === user.id);
      const absentCount = penalties.filter(p => p.content.includes('缺勤') || p.content.includes('时长不足')).length;
      
      // Leave Status
      const activeLeave = checkIns.find(c => c.userId === user.id && c.isLeave && (c.leaveStatus === 'pending' || c.leaveStatus === 'approved'));
      const isLeaveToday = activeLeave ? true : false;

      return { todayDuration, absentCount, isLeaveToday, activeLeave };
  }

  const toggleRowExpand = async (userId: string) => {
      if (expandedUserIds.includes(userId)) {
          setExpandedUserIds(prev => prev.filter(id => id !== userId));
      } else {
          setExpandedUserIds(prev => [...prev, userId]);
          // Fetch specific penalty/checkin details for this user if not already fetched optimally
          // For simplicity, we use client side filtered checkIns which are already loaded in `checkIns` prop
          const penalties = checkIns.filter(c => c.userId === userId && c.isPenalty).sort((a, b) => b.timestamp - a.timestamp);
          setUserPenaltyMap(prev => ({ ...prev, [userId]: penalties }));
      }
  };

  const handleExemptPenalty = async (checkInId: string, userId: string) => {
      try {
          const { ratingDelta } = await storage.exemptPenalty(checkInId);
          onShowToast(`已豁免，Rating +${ratingDelta}`, 'success');
          // Refresh local state
          const updatedPenalties = userPenaltyMap[userId].map(p => 
              p.id === checkInId ? { ...p, isPenalty: false, content: p.content + ' [已豁免]' } : p
          );
          setUserPenaltyMap(prev => ({ ...prev, [userId]: updatedPenalties }));
          // Ideally refresh user rating too
          const updatedUser = await storage.getUserById(userId);
          if (updatedUser) {
              setAllUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
          }
      } catch (e) {
          console.error(e);
          onShowToast("操作失败", 'error');
      }
  };

  const handleUpdateUserRating = async (userId: string) => {
      if (!editingUserRating || editingUserRating.id !== userId) return;
      try {
          await storage.adminUpdateUser(userId, { rating: editingUserRating.rating });
          onShowToast("Rating 已更新", 'success');
          setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, rating: editingUserRating.rating } : u));
          setEditingUserRating(null);
      } catch (e) {
          onShowToast("更新失败", 'error');
      }
  };

  const handleUpdateUserPassword = async (userId: string) => {
      if (!editingUserPassword || editingUserPassword.id !== userId || !editingUserPassword.password) return;
      try {
          await storage.adminUpdateUser(userId, { password: editingUserPassword.password });
          onShowToast("密码已修改", 'success');
          setEditingUserPassword(null);
      } catch (e) {
          onShowToast("修改失败", 'error');
      }
  };

  const handleDeleteUser = async (userId: string) => {
      if (!confirm("⚠️ 高危操作：确定要彻底删除该用户吗？\n所有打卡记录和数据将无法恢复！")) return;
      try {
          await storage.adminDeleteUser(userId);
          onShowToast("用户已删除", 'success');
          setAllUsers(prev => prev.filter(u => u.id !== userId));
      } catch (e) {
          onShowToast("删除失败", 'error');
      }
  };

  const getAdminStats = () => {
      const todayStr = formatDateKey(new Date());
      
      // Basic Stats
      const totalDuration = checkIns.reduce((acc, c) => acc + (c.isPenalty ? 0 : (c.duration || 0)), 0);
      const activeUsersToday = new Set(checkIns.filter(c => formatDateKey(c.timestamp) === todayStr && !c.isPenalty).map(c => c.userId)).size;
      const totalUsers = allUsers.filter(u => u.role !== 'admin').length;
      const absentUsersToday = Math.max(0, totalUsers - activeUsersToday);
      const totalPenalties = checkIns.filter(c => c.isPenalty).length;
      
      // Calculate Average Rating
      const totalRating = allUsers.filter(u => u.role !== 'admin').reduce((acc, u) => acc + (u.rating || 1200), 0);
      const avgRating = totalUsers > 0 ? Math.round(totalRating / totalUsers) : 1200;

      // Calculate Pending Leaves
      const pendingLeaves = checkIns.filter(c => c.isLeave && c.leaveStatus === 'pending').length;

      // Subject Distribution Data
      const subjectMap: Record<string, number> = {};
      const subjectCheckIns = checkIns.filter(c => !c.isPenalty && !c.isLeave);
      subjectCheckIns.forEach(c => {
          subjectMap[c.subject] = (subjectMap[c.subject] || 0) + (c.duration || 0);
      });
      const subjectData = Object.entries(subjectMap)
          .map(([name, value]) => ({ name, value: Math.round(value/60) }))
          .sort((a,b) => b.value - a.value)
          .slice(0, 6); // Top 6

      // Activity Trend (Last 7 Days)
      const trendMap: Record<string, number> = {};
      const dates = [];
      for(let i=6; i>=0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const k = formatDateKey(d);
          trendMap[k] = 0;
          dates.push(k);
      }
      checkIns.forEach(c => {
          if (c.isPenalty || c.isLeave) return;
          const k = formatDateKey(c.timestamp);
          if (trendMap[k] !== undefined) {
              trendMap[k] += (c.duration || 0);
          }
      });
      const trendData = dates.map(date => ({
          date: date.slice(5).replace('-', '/'),
          hours: Math.round(trendMap[date] / 60)
      }));

      return { totalDuration, activeUsersToday, absentUsersToday, totalPenalties, avgRating, pendingLeaves, subjectData, trendData };
  };

  // --- Please Leave Logic ---
  const handleSubmitLeave = async () => {
      if (!onAddCheckIn) return;
      if (!leaveReason.trim()) {
          onShowToast("请填写请假理由", 'error');
          return;
      }
      if (leaveDays <= 0) {
           onShowToast("请假天数必须大于0", 'error');
           return;
      }

      // Logic: > 2 days = Pending, <= 2 days = Approved (with auto makeup)
      const isPending = leaveDays > 2;
      const makeup = isPending ? 0 : 30 * leaveDays; // 默认每天补30分钟

      const leaveCheckIn: CheckIn = {
          id: Date.now().toString(),
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          userRating: currentUser.rating,
          userRole: currentUser.role,
          subject: SubjectCategory.OTHER,
          content: `📜 **请假申请**\n\n**天数**: ${leaveDays} 天\n**理由**: ${leaveReason}\n\n${isPending ? '⏳ 超过2天，等待管理员审批...' : `✅ 系统自动批准 (需补时 ${makeup} 分钟)`}`,
          duration: 0,
          isLeave: true,
          leaveDays: leaveDays,
          leaveReason: leaveReason,
          leaveStatus: isPending ? 'pending' : 'approved',
          makeupMinutes: makeup,
          timestamp: Date.now(),
          likedBy: []
      };
      
      try {
          await storage.addCheckIn(leaveCheckIn); 
          if (onAddCheckIn) onAddCheckIn(leaveCheckIn); 
          setShowLeaveModal(false);
          setLeaveReason('');
          setLeaveDays(1);
      } catch(e) {
          onShowToast("申请提交失败", 'error');
      }
  };

  const executeLogStudy = async (contentStr: string, subjectVal: SubjectCategory, durationVal: number) => {
    if (!contentStr.trim()) return;
    setIsLogging(true);
    
    let ratingChange = 0;
    let newRating = currentUser.rating ?? 1200;

    if (logMode === 'study') {
        const basePoints = Math.floor(durationVal / 10);
        const multiplier = SUBJECT_WEIGHTS[subjectVal] || 1.0;
        
        let tierMultiplier = 1.0;
        if (newRating < 1200) tierMultiplier = 1.2;
        else if (newRating < 1400) tierMultiplier = 1.0;
        else if (newRating < 1600) tierMultiplier = 0.9;
        else if (newRating < 1800) tierMultiplier = 0.8;
        else if (newRating < 2000) tierMultiplier = 0.7;
        else tierMultiplier = 0.5;

        ratingChange = Math.ceil(basePoints * multiplier * tierMultiplier) + 1; 
        newRating += ratingChange;
    } else {
        let penaltyMultiplier = 1.5;
        if (newRating > 1800) penaltyMultiplier = 2.0;
        
        ratingChange = -Math.round((durationVal / 10) * penaltyMultiplier) - 1;
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
      const reason = logMode === 'study' 
        ? `学习 ${subjectVal} ${durationVal}m (R:${currentUser.rating}->${newRating})` 
        : `摸鱼/娱乐 ${durationVal} 分钟 (扣分 ${ratingChange})`;
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
      const todayStr = formatDateKey(new Date());

      if (selectedDate) {
          list = list.filter(c => formatDateKey(c.timestamp) === selectedDate);
      } else if (listFilterDate) {
          list = list.filter(c => formatDateKey(c.timestamp) === listFilterDate);
      } else {
          list = list.filter(c => formatDateKey(c.timestamp) === todayStr);
      }

      if (listFilterSubject !== 'ALL') list = list.filter(c => c.subject === listFilterSubject);
      
      return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }, [selectedUserCheckIns, selectedDate, listFilterSubject, listFilterDate]);

  // --- Calendar Renderers ---
  const renderCalendar = () => {
    const { daysInMonth, firstDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const cells = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(<div key={`empty-${i}`} className="h-9 w-9"></div>);
    for (let d = 1; d <= daysInMonth; d++) {
        const currentDay = new Date(year, month, d);
        const yearStr = currentDay.getFullYear();
        const monthStr = String(currentDay.getMonth() + 1).padStart(2, '0');
        const dayStr = String(currentDay.getDate()).padStart(2, '0');
        const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
        
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

  const renderHeatmap = () => {
      const startDate = new Date(heatmapYear, 0, 1);
      const endDate = new Date(heatmapYear, 11, 31);
      const weeks = [];
      let currentWeek = [];
      const startDay = startDate.getDay(); 
      for(let i=0; i<startDay; i++) {
          currentWeek.push({ date: null, count: 0 });
      }
      const d = new Date(startDate);
      while (d <= endDate) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dayVal = String(d.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${dayVal}`;
          const count = heatmapData[dateStr] || 0;
          currentWeek.push({ date: dateStr, count });
          if (currentWeek.length === 7) {
              weeks.push(currentWeek);
              currentWeek = [];
          }
          d.setDate(d.getDate() + 1);
      }
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
  const ratingGradient = getRatingBackground(currentUser.rating || 1200);

  // --- Admin Dashboard View ---
  if (isAdmin) {
        const usersList = allUsers.filter(u => u.role !== 'admin'); // Hide other admins from list
        const adminStats = getAdminStats();

        return (
          <div className="space-y-6 animate-fade-in pb-20">
               {/* Admin Header & Config */}
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                   <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                       <Shield className="w-7 h-7 text-indigo-600" /> 管理后台
                   </h1>
                   <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
                       <CalendarOff className="w-4 h-4 text-red-500" />
                       <span className="text-xs font-bold text-gray-500">缺勤惩罚生效起始日:</span>
                       <input 
                           type="date" 
                           value={sysAbsentStartDate} 
                           onChange={e => setSysAbsentStartDate(e.target.value)}
                           className="text-xs font-bold text-gray-800 outline-none border-b border-dashed border-gray-300 focus:border-indigo-500"
                       />
                       <button onClick={handleSaveSysConfig} className="ml-2 text-indigo-600 hover:text-indigo-800"><Save className="w-4 h-4"/></button>
                   </div>
               </div>

               {/* Admin Stats Cards */}
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                   <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                       <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">打卡总时长</div>
                       <div className="text-xl font-black text-gray-800">{Math.round(adminStats.totalDuration / 60)} <span className="text-xs font-medium text-gray-400">h</span></div>
                   </div>
                   <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                       <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">今日打卡</div>
                       <div className="text-xl font-black text-green-600">{adminStats.activeUsersToday} <span className="text-xs font-medium text-gray-400">人</span></div>
                   </div>
                   <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                       <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">今日缺勤</div>
                       <div className="text-xl font-black text-red-500">{adminStats.absentUsersToday} <span className="text-xs font-medium text-gray-400">人</span></div>
                   </div>
                   <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                       <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">累计违规</div>
                       <div className="text-xl font-black text-orange-500">{adminStats.totalPenalties} <span className="text-xs font-medium text-gray-400">次</span></div>
                   </div>
                   <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                       <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">待审批请假</div>
                       <div className={`text-xl font-black ${adminStats.pendingLeaves > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{adminStats.pendingLeaves} <span className="text-xs font-medium text-gray-400">条</span></div>
                   </div>
                   <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                       <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">平均 Rating</div>
                       <div className="text-xl font-black text-indigo-600">{adminStats.avgRating}</div>
                   </div>
               </div>

               {/* Visual Analytics Charts */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Subject Distribution */}
                   <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col">
                       <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-4">
                           <PieChartIcon className="w-5 h-5 text-indigo-500" /> 全站学习科目分布
                       </h3>
                       <div className="flex-1 h-64 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                   <Pie
                                       data={adminStats.subjectData}
                                       cx="50%"
                                       cy="50%"
                                       innerRadius={60}
                                       outerRadius={80}
                                       paddingAngle={5}
                                       dataKey="value"
                                   >
                                       {adminStats.subjectData.map((entry, index) => (
                                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                       ))}
                                   </Pie>
                                   <Tooltip contentStyle={{borderRadius: '12px'}} itemStyle={{fontSize:'12px', fontWeight:'bold'}} />
                                   <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '10px'}}/>
                               </PieChart>
                           </ResponsiveContainer>
                       </div>
                   </div>

                   {/* Activity Trend */}
                   <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col">
                       <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-4">
                           <BarChart3 className="w-5 h-5 text-green-500" /> 近 7 日学习时长趋势 (小时)
                       </h3>
                       <div className="flex-1 h-64 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                               <BarChart data={adminStats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                   <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                                   <YAxis tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                                   <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '12px'}} />
                                   <Bar dataKey="hours" name="总时长" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                               </BarChart>
                           </ResponsiveContainer>
                       </div>
                   </div>
               </div>

               {/* Combined Leaderboard & Management Table */}
               <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm overflow-hidden">
                   <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                            <ListTodo className="w-6 h-6 text-indigo-500" /> 用户管理 & Rating 排行榜
                        </h2>
                        <button 
                            onClick={() => setShowAdminUserModal(true)}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                        >
                            <UserPlus className="w-4 h-4" /> 新增用户
                        </button>
                   </div>
                   
                   <div className="overflow-x-auto">
                       <table className="w-full text-left border-collapse">
                           <thead>
                               <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                                   <th className="py-3 pl-4 rounded-tl-xl w-16">Rank</th>
                                   <th className="py-3">用户 (点击头像访问)</th>
                                   <th className="py-3">Rating</th>
                                   <th className="py-3">今日时长</th>
                                   <th className="py-3">缺勤次数</th>
                                   <th className="py-3">状态</th>
                                   <th className="py-3 pr-4 text-right rounded-tr-xl">管理</th>
                               </tr>
                           </thead>
                           <tbody className="text-sm">
                               {usersList.map((u, index) => {
                                   const stats = calculateUserStats(u);
                                   const isExpanded = expandedUserIds.includes(u.id);
                                   
                                   return (
                                       <React.Fragment key={u.id}>
                                           <tr className={`group transition-colors border-b border-gray-50 last:border-0 ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-gray-50'}`}>
                                               <td className="py-3 pl-4 font-mono text-gray-400 font-bold">
                                                   {index < 3 ? <Medal className={`w-5 h-5 ${index===0?'text-yellow-500':index===1?'text-gray-400':'text-orange-600'}`} /> : index + 1}
                                               </td>
                                               <td className="py-3">
                                                   <div className="flex items-center gap-3"> 
                                                       <img 
                                                            src={u.avatar} 
                                                            className="w-9 h-9 rounded-full bg-gray-100 border border-gray-100 cursor-pointer hover:scale-110 transition-transform hover:ring-2 hover:ring-indigo-200" 
                                                            onClick={() => onNavigateToUser && onNavigateToUser(u.id)}
                                                            title="点击访问个人主页"
                                                       />
                                                       <div>
                                                           <div className={`font-bold text-sm ${getUserStyle(u.role, u.rating)}`}>{u.name}</div>
                                                           <div className="text-[10px] text-gray-400 font-mono">ID: {u.id.substring(0,6)}</div>
                                                       </div>
                                                   </div>
                                               </td>
                                               <td className={`py-3 font-bold ${u.rating && u.rating >= 2000 ? 'text-red-600' : 'text-indigo-600'}`}>
                                                   {u.rating || 1200}
                                               </td>
                                               <td className="py-3 font-mono font-bold text-gray-600">
                                                   {stats.todayDuration} <span className="text-xs font-normal text-gray-400">min</span>
                                               </td>
                                               <td className="py-3">
                                                   {stats.absentCount > 0 ? (
                                                       <span className="bg-red-50 text-red-600 px-2 py-1 rounded-lg text-xs font-bold">{stats.absentCount} 次</span>
                                                   ) : (
                                                       <span className="text-gray-300 text-xs">-</span>
                                                   )}
                                               </td>
                                               <td className="py-3">
                                                   {stats.activeLeave ? (
                                                       <span className="bg-yellow-50 text-yellow-600 px-2 py-1 rounded-lg text-xs font-bold flex items-center w-fit gap-1">
                                                           <Coffee className="w-3 h-3"/> 请假中
                                                       </span>
                                                   ) : (
                                                       <span className="bg-green-50 text-green-600 px-2 py-1 rounded-lg text-xs font-bold flex items-center w-fit gap-1">
                                                           <CheckCircle2 className="w-3 h-3"/> 正常
                                                       </span>
                                                   )}
                                               </td>
                                               <td className="py-3 pr-4 text-right">
                                                   <button 
                                                       onClick={() => toggleRowExpand(u.id)} 
                                                       className={`text-gray-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-600' : ''}`}
                                                   >
                                                       {isExpanded ? <ChevronUp className="w-4 h-4" /> : <MoreHorizontal className="w-4 h-4" />}
                                                   </button>
                                               </td>
                                           </tr>
                                           
                                           {/* Expandable Details Row */}
                                           {isExpanded && (
                                               <tr className="bg-indigo-50/30 animate-fade-in">
                                                   <td colSpan={7} className="p-4 pt-0">
                                                       <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                                                           {/* Left: Quick Actions */}
                                                           <div className="space-y-4">
                                                               <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                                                                   <Edit3 className="w-3 h-3" /> 快速编辑
                                                               </h4>
                                                               <div className="flex gap-3">
                                                                   <div className="flex-1">
                                                                       <label className="text-[10px] text-gray-500 font-bold block mb-1">修改 Rating</label>
                                                                       <div className="flex">
                                                                           <input 
                                                                               type="number" 
                                                                               className="w-full text-xs border border-gray-200 rounded-l-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                               placeholder={`${u.rating}`}
                                                                               value={editingUserRating?.id === u.id ? editingUserRating.rating : ''}
                                                                               onChange={(e) => setEditingUserRating({id: u.id, rating: parseInt(e.target.value)})}
                                                                           />
                                                                           <button 
                                                                               onClick={() => handleUpdateUserRating(u.id)}
                                                                               className="bg-indigo-600 text-white px-3 py-1.5 rounded-r-lg text-xs font-bold hover:bg-indigo-700"
                                                                           >
                                                                               保存
                                                                           </button>
                                                                       </div>
                                                                   </div>
                                                                   <div className="flex-1">
                                                                       <label className="text-[10px] text-gray-500 font-bold block mb-1">重置密码</label>
                                                                       <div className="flex">
                                                                           <input 
                                                                               type="text" 
                                                                               className="w-full text-xs border border-gray-200 rounded-l-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                               placeholder="新密码"
                                                                               value={editingUserPassword?.id === u.id ? editingUserPassword.password : ''}
                                                                               onChange={(e) => setEditingUserPassword({id: u.id, password: e.target.value})}
                                                                           />
                                                                           <button 
                                                                               onClick={() => handleUpdateUserPassword(u.id)}
                                                                               className="bg-gray-600 text-white px-3 py-1.5 rounded-r-lg text-xs font-bold hover:bg-gray-700"
                                                                           >
                                                                               修改
                                                                           </button>
                                                                       </div>
                                                                   </div>
                                                               </div>
                                                               <div className="pt-2">
                                                                   <button 
                                                                       onClick={() => handleDeleteUser(u.id)}
                                                                       className="text-red-500 text-xs font-bold flex items-center gap-1 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded w-fit transition-colors"
                                                                   >
                                                                       <Trash2 className="w-3 h-3" /> 删除该用户
                                                                   </button>
                                                               </div>
                                                           </div>

                                                           {/* Right: Penalty Records */}
                                                           <div className="space-y-2">
                                                               <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-2">
                                                                   <AlertCircle className="w-3 h-3 text-red-500" /> 缺勤/违规记录
                                                               </h4>
                                                               <div className="bg-gray-50 rounded-lg p-2 max-h-40 overflow-y-auto custom-scrollbar border border-gray-100">
                                                                   {userPenaltyMap[u.id] && userPenaltyMap[u.id].length > 0 ? (
                                                                       userPenaltyMap[u.id].map(p => (
                                                                           <div key={p.id} className="flex justify-between items-center p-2 mb-1 bg-white rounded border border-gray-100 last:mb-0">
                                                                               <div>
                                                                                   <div className="text-xs font-bold text-gray-700 truncate max-w-[150px]">{p.content.split('\n')[0].replace(/\*/g, '')}</div>
                                                                                   <div className="text-[10px] text-gray-400 font-mono">{new Date(p.timestamp).toLocaleDateString()}</div>
                                                                               </div>
                                                                               {!p.content.includes('已豁免') ? (
                                                                                   <button 
                                                                                       onClick={() => handleExemptPenalty(p.id, u.id)}
                                                                                       className="text-[10px] bg-green-50 text-green-600 px-2 py-1 rounded border border-green-100 hover:bg-green-100 font-bold flex items-center gap-1"
                                                                                   >
                                                                                       <ShieldCheck className="w-3 h-3" /> 豁免
                                                                                   </button>
                                                                               ) : (
                                                                                   <span className="text-[10px] text-gray-400 italic">已豁免</span>
                                                                               )}
                                                                           </div>
                                                                       ))
                                                                   ) : (
                                                                       <div className="text-center text-xs text-gray-400 py-4">无违规记录</div>
                                                                   )}
                                                               </div>
                                                           </div>
                                                       </div>
                                                   </td>
                                               </tr>
                                           )}
                                       </React.Fragment>
                                   );
                               })}
                           </tbody>
                       </table>
                   </div>
               </div>

               <AdminUserModal 
                  isOpen={showAdminUserModal} 
                  onClose={() => setShowAdminUserModal(false)} 
                  currentUser={currentUser} 
                  onShowToast={onShowToast} 
               />
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

      {/* Filter Modal */}
      {showFilterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowFilterModal(false)}>
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-800">筛选日志</h3>
                      <button onClick={() => setShowFilterModal(false)}><X className="w-5 h-5 text-gray-400"/></button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">按科目</label>
                          <select 
                              value={listFilterSubject}
                              onChange={(e) => setListFilterSubject(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-brand-500"
                          >
                              <option value="ALL">全部科目</option>
                              {Object.values(SubjectCategory).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">按日期</label>
                          <input 
                              type="date"
                              value={listFilterDate}
                              onChange={(e) => setListFilterDate(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-brand-500"
                          />
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button 
                              onClick={() => { setListFilterSubject('ALL'); setListFilterDate(''); setShowFilterModal(false); }}
                              className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200"
                          >
                              重置
                          </button>
                          <button 
                              onClick={() => setShowFilterModal(false)}
                              className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 shadow-lg shadow-brand-200"
                          >
                              应用
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 请假申请 Modal */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${showLeaveModal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all duration-300 ${showLeaveModal ? 'scale-100 translate-y-0' : 'scale-95 translate-y-10'}`}>
              <div className="bg-yellow-50 p-6 border-b border-yellow-100 flex items-center gap-3 relative">
                  <div className="bg-yellow-100 p-2 rounded-xl text-yellow-600"><Coffee className="w-6 h-6"/></div>
                  <div>
                      <h3 className="text-xl font-black text-gray-800">申请请假</h3>
                      <p className="text-xs text-yellow-700 font-bold opacity-80 uppercase tracking-wider">Leave Application</p>
                  </div>
                  <button onClick={() => setShowLeaveModal(false)} className="absolute top-4 right-4 p-2 bg-white/50 hover:bg-white rounded-full text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="p-6 space-y-4">
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">请假天数</label>
                      <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min="1" 
                            max="7" 
                            value={leaveDays} 
                            onChange={e => setLeaveDays(parseInt(e.target.value))} 
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                          <span className="text-sm font-bold text-gray-400 shrink-0">天</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 ml-1">
                          {leaveDays > 2 ? '⚠️ 超过2天需管理员审批' : '✅ 2天以内系统自动批准'}
                      </p>
                  </div>
                  
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">请假理由 (必填)</label>
                      <textarea 
                        value={leaveReason}
                        onChange={e => setLeaveReason(e.target.value)}
                        placeholder="身体不适 / 突发状况 / 调整休息..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 h-24 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                  </div>

                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-xs text-blue-700 leading-relaxed">
                      💡 <strong>规则提示：</strong><br/>
                      1. 请假期间免除每日目标考核。<br/>
                      2. 假期结束后，次日目标可能包含补习时长。<br/>
                      3. 申请将公示在研友圈，接受研友监督。
                  </div>
              </div>

              <div className="p-6 pt-0 flex gap-3">
                  <button onClick={() => setShowLeaveModal(false)} className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">取消</button>
                  <button onClick={handleSubmitLeave} className="flex-1 py-3 rounded-xl font-bold text-white bg-yellow-500 hover:bg-yellow-600 shadow-lg shadow-yellow-200 transition-transform active:scale-95">提交申请</button>
              </div>
          </div>
      </div>

      <Modal 
          isOpen={showRules}
          onClose={() => setShowRules(false)}
          onConfirm={() => setShowRules(false)}
          title="奖惩机制说明"
          message={`1. 每日目标: ${currentUser.dailyGoal || 90} 分钟。\n2. 每日结算: 凌晨4点。未达标扣 15 分，缺勤扣 50 分。\n3. 加分公式: 时长/10 * 科目权重 * 分段系数 + 1。\n4. 权重: 数学/专业课 1.2，英语 1.0，政治 0.8。\n5. 分段系数: \n   <1200分 x1.2\n   1200-1400分 x1.0\n   1400-1600分 x0.9\n   1600-1800分 x0.8\n   >2000分 x0.5 (高分段冲分更难)\n6. 连胜: 每7天连胜奖励 14~50 分。\n7. 请假: >2天需审批，批准后免除惩罚但需补时。`}
          confirmText="我明白了"
          cancelText="关闭"
      />

      {/* Greeting Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
            <div className="text-xs font-bold text-gray-400 mb-1 font-mono">{new Date().toLocaleDateString('zh-CN', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</div>
            <h1 className="text-3xl font-black text-gray-800">
                {(() => {
                    const h = new Date().getHours();
                    if(h<5) return '深夜好';
                    if(h<11) return '早上好';
                    if(h<13) return '中午好';
                    if(h<18) return '下午好';
                    return '晚上好';
                })()}，<span className={`${getUserStyle(currentUser.role, currentUser.rating ?? 1200)}`}>{currentUser.name}</span>
            </h1>
            <div className="text-gray-500 font-medium mt-1 flex items-center gap-2 text-sm">
                今天也要加油呀！✨ 目标: 
                {isEditingDailyGoal ? (
                    <div className="flex items-center gap-1">
                        <input 
                            type="number" 
                            className="w-12 border border-brand-300 rounded px-1 py-0.5 text-center text-brand-600 font-bold bg-white" 
                            value={tempDailyGoal}
                            onChange={(e) => setTempDailyGoal(parseInt(e.target.value))}
                            autoFocus
                        />
                        <button onClick={handleSaveDailyGoal} className="text-green-600 hover:text-green-700 bg-green-50 p-1 rounded"><Save className="w-3 h-3"/></button>
                        <button onClick={() => { setIsEditingDailyGoal(false); setTempDailyGoal(currentUser.dailyGoal || 90); }} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-3 h-3"/></button>
                    </div>
                ) : (
                    <span onClick={() => setIsEditingDailyGoal(true)} className="font-bold text-gray-700 cursor-pointer hover:bg-gray-100 px-1 rounded transition-colors flex items-center gap-1 group/goal">
                        {currentUser.dailyGoal || 90} min <Edit3 className="w-3 h-3 opacity-0 group-hover/goal:opacity-100 text-gray-400"/>
                    </span>
                )}
            </div>
        </div>
        
        <div className="flex items-center gap-3">
             {/* Countdown */}
             <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                 <div className="bg-red-50 p-2 rounded-lg text-red-500">
                     <CalendarIcon className="w-5 h-5" />
                 </div>
                 <div>
                     <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">倒计时</div>
                     {isEditingTarget ? (
                         <input 
                            type="date" 
                            value={targetDateStr} 
                            onChange={(e) => setTargetDateStr(e.target.value)}
                            onBlur={handleSaveTargetDate}
                            className="text-sm font-bold text-gray-800 bg-transparent outline-none w-28"
                            autoFocus
                         />
                     ) : (
                         <div onClick={() => setIsEditingTarget(true)} className="text-xl font-black text-gray-800 cursor-pointer hover:text-brand-600 transition-colors">
                             {daysUntilExam} <span className="text-xs font-medium text-gray-400">天</span>
                         </div>
                     )}
                 </div>
             </div>
             
             {/* Rating Card */}
             <div 
                className={`bg-gradient-to-br ${ratingGradient} text-white px-5 py-2 rounded-xl shadow-lg flex items-center gap-4 relative overflow-hidden group cursor-pointer transition-all hover:scale-105`} 
                onClick={() => setShowRules(true)}
             >
                 <div className="absolute right-0 top-0 w-20 h-20 bg-white opacity-10 rounded-full -mr-10 -mt-10 blur-xl group-hover:opacity-20 transition-opacity"></div>
                 <div>
                     <div className="text-[10px] text-white/80 font-bold uppercase tracking-wider mb-0.5">Rating</div>
                     <div className="text-2xl font-black tracking-tight">{currentUser.rating || 1200}</div>
                 </div>
                 <div className="text-right text-white/90">
                     <div className="text-xs opacity-60">Rank</div>
                     <div className="font-bold text-sm">{titleName}</div>
                 </div>
             </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Quick Actions & Stats */}
          <div className="lg:col-span-2 space-y-6">
              
              {/* Quick Check-in Input */}
              <div className="bg-white p-1 rounded-[2rem] shadow-sm border border-gray-100 flex items-center p-2 relative group hover:shadow-md transition-shadow">
                   <div className="bg-brand-50 p-3 rounded-full text-brand-600 ml-1">
                       <Clock className="w-6 h-6" />
                   </div>
                   <input 
                      type="text" 
                      value={logContent}
                      onChange={(e) => setLogContent(e.target.value)}
                      placeholder="记录当下的专注 (e.g., 复习数学全书 45分钟)"
                      className="flex-1 bg-transparent border-none focus:ring-0 text-gray-700 placeholder-gray-400 px-4 font-medium"
                      onKeyDown={(e) => e.key === 'Enter' && handleLogStudy()}
                   />
                   
                   {/* Subject Select */}
                   <div className="relative border-l border-gray-100 pl-2">
                       <select 
                          value={logSubject}
                          onChange={(e) => setLogSubject(e.target.value as SubjectCategory)}
                          className="appearance-none bg-transparent font-bold text-sm text-gray-600 py-2 pl-2 pr-8 focus:outline-none cursor-pointer hover:text-brand-600 transition-colors"
                       >
                           {Object.values(SubjectCategory).map(cat => (
                               <option key={cat} value={cat}>{cat}</option>
                           ))}
                       </select>
                       <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                   </div>

                   {/* Duration Select */}
                   <div className="relative border-l border-gray-100 pl-2 w-24">
                       <input 
                           type="number"
                           value={logDuration}
                           onChange={(e) => setLogDuration(parseInt(e.target.value) || 0)}
                           className="w-full bg-transparent font-bold text-sm text-gray-600 py-2 text-center focus:outline-none"
                       />
                       <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">min</span>
                   </div>

                   <button 
                      onClick={() => setIsFullScreen(true)}
                      className="p-3 text-gray-400 hover:text-brand-600 transition-colors"
                      title="全屏编辑"
                   >
                       <Maximize2 className="w-5 h-5" />
                   </button>

                   <button 
                      onClick={handleLogStudy}
                      disabled={isLogging || !logContent.trim()}
                      className="bg-brand-600 text-white p-3 rounded-full shadow-lg shadow-brand-200 hover:bg-brand-700 hover:scale-105 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 ml-2"
                   >
                       <Send className="w-5 h-5 ml-0.5" />
                   </button>
              </div>

              {/* Action Buttons Row */}
              <div className="flex gap-4">
                  <button 
                      onClick={() => { setLogMode('study'); setIsFullScreen(true); }}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-2xl shadow-lg shadow-blue-100 hover:-translate-y-1 transition-transform flex items-center justify-center gap-2 font-bold"
                  >
                      <Edit3 className="w-5 h-5" /> 写日记 / 复盘
                  </button>
                  <button 
                      onClick={() => { setLogMode('penalty'); setLogContent('摸鱼 / 休息'); setIsFullScreen(true); }}
                      className="flex-1 bg-white text-gray-600 border border-gray-200 p-4 rounded-2xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 font-bold"
                  >
                      <Coffee className="w-5 h-5 text-gray-400" /> 记录摸鱼 (扣分)
                  </button>
                  <button 
                      onClick={() => setShowLeaveModal(true)}
                      className="flex-1 bg-yellow-50 text-yellow-700 border border-yellow-100 p-4 rounded-2xl hover:bg-yellow-100 transition-colors flex items-center justify-center gap-2 font-bold"
                  >
                      <Flag className="w-5 h-5 text-yellow-500" /> 请假申请
                  </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">今日时长</div>
                      <div className="text-3xl font-black text-gray-800">
                          {Math.floor(stats.todayStudyMinutes / 60)}<span className="text-sm font-medium text-gray-400">h</span>
                          {stats.todayStudyMinutes % 60}<span className="text-sm font-medium text-gray-400">m</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${Math.min((stats.todayStudyMinutes / (currentUser.dailyGoal || 90)) * 100, 100)}%` }}></div>
                      </div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">打卡天数</div>
                      <div className="text-3xl font-black text-gray-800">{totalCheckInDays}</div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">总计投入</div>
                      <div className="text-3xl font-black text-gray-800">{Math.floor(stats.totalStudyMinutes/60)}<span className="text-sm text-gray-400 font-medium">h</span></div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Current Rating</div>
                        <div className={`text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r ${ratingGradient}`}>{currentUser.rating || 1200}</div>
                  </div>
              </div>

              {/* Rating Chart (Restored) */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 h-64 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-red-500" /> Rating 趋势
                      </h3>
                  </div>
                  <div className="h-full w-full pb-6">
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={ratingChartData}>
                              <defs>
                                  <linearGradient id="chartColor" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} minTickGap={30} />
                              <Tooltip 
                                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}} 
                                itemStyle={{color: '#f43f5e', fontWeight: 'bold'}}
                                labelStyle={{color: '#9ca3af', marginBottom: '4px'}}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="rating" 
                                stroke="#f43f5e" 
                                strokeWidth={3} 
                                fillOpacity={1} 
                                fill="url(#chartColor)" 
                                dot={{r: 4, fill: '#fff', stroke: '#f43f5e', strokeWidth: 2}} 
                                activeDot={{r: 6, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2}}
                              />
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* Heatmap & Recent Activity */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                          <Activity className="w-5 h-5 text-green-500" /> 学习热力图
                      </h3>
                      <select 
                          value={heatmapYear}
                          onChange={(e) => setHeatmapYear(parseInt(e.target.value))}
                          className="bg-gray-50 border border-gray-200 rounded-lg text-xs px-2 py-1 outline-none"
                      >
                          <option value={2024}>2024</option>
                          <option value={2025}>2025</option>
                          <option value={2026}>2026</option>
                          <option value={2027}>2027</option>
                      </select>
                  </div>
                  {renderHeatmap()}
              </div>

               {/* Recent Logs List */}
               <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                          <ListTodo className="w-5 h-5 text-brand-500" /> 近期记录
                      </h3>
                      
                      <button 
                        className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-colors flex items-center gap-1 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm`}
                        onClick={() => setShowFilterModal(true)}
                      >
                         <Filter className="w-3 h-3" />
                         {listFilterSubject !== 'ALL' || listFilterDate ? '已筛选' : '筛选'}
                      </button>
                  </div>
                  
                  <div className="divide-y divide-gray-50">
                      {displayedCheckIns.length > 0 ? displayedCheckIns.map(c => (
                          <div key={c.id} className="p-4 hover:bg-gray-50/80 transition-colors group">
                              <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${c.isPenalty ? 'bg-red-50 text-red-600 border-red-100' : (c.isLeave ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-blue-50 text-blue-600 border-blue-100')}`}>
                                          {c.isLeave ? '请假' : c.subject}
                                      </span>
                                      <span className="text-xs text-gray-400 font-mono">
                                          {new Date(c.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour:'2-digit', minute:'2-digit' })}
                                      </span>
                                  </div>
                                  {!c.isLeave && !c.isPenalty && (
                                      <span className="font-bold text-gray-400 text-xs flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                                          <Clock className="w-3 h-3"/> {c.duration}m
                                      </span>
                                  )}
                              </div>
                              <div className="text-sm text-gray-700 leading-relaxed line-clamp-2">
                                  {c.content}
                              </div>
                              {c.isLeave && (
                                  <div className="mt-2 text-xs flex gap-2">
                                      <span className={`font-bold ${c.leaveStatus === 'approved' ? 'text-green-600' : c.leaveStatus === 'pending' ? 'text-yellow-600' : 'text-red-600'}`}>
                                          ● {c.leaveStatus === 'approved' ? '已通过' : c.leaveStatus === 'pending' ? '审核中' : '已驳回'}
                                      </span>
                                      {c.leaveStatus === 'approved' && c.makeupMinutes > 0 && (
                                          <span className="text-gray-500">需补时: {c.makeupMinutes} min</span>
                                      )}
                                  </div>
                              )}
                          </div>
                      )) : (
                          <div className="p-8 text-center text-gray-400 text-sm">暂无记录</div>
                      )}
                  </div>
                  {displayedCheckIns.length > 0 && (
                      <div className="p-3 text-center border-t border-gray-50">
                          <button className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors">查看更多</button>
                      </div>
                  )}
               </div>

          </div>

          {/* Right Column: Charts & Goals */}
          <div className="space-y-6">
              
              {/* Calendar Card (Restored) */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                          <CalendarIcon className="w-5 h-5 text-brand-500" /> 打卡日历
                      </h3>
                      <div className="flex items-center gap-1">
                           <input 
                              type="month" 
                              value={`${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`}
                              onChange={(e) => {
                                  const [y, m] = e.target.value.split('-');
                                  setCurrentMonth(new Date(parseInt(y), parseInt(m) - 1, 1));
                              }}
                              className="text-xs font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200 outline-none"
                           />
                      </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 place-items-center mb-2">
                      {['日', '一', '二', '三', '四', '五', '六'].map(d => <span key={d} className="text-[10px] text-gray-400 font-bold">{d}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1 place-items-center">
                      {renderCalendar()}
                  </div>
              </div>

              {/* Pie Chart */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 relative">
                  <div className="flex justify-between items-start mb-6">
                      <div>
                          <h3 className="font-bold text-gray-800 flex items-center gap-2">
                              <Grid3X3 className="w-5 h-5 text-indigo-500" /> 科目分布
                          </h3>
                      </div>
                      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg" ref={pieDatePickerRef}>
                          <button onClick={() => setPieFilterType('day')} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${pieFilterType === 'day' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>日</button>
                          <button onClick={() => setPieFilterType('month')} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${pieFilterType === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>月</button>
                          <button onClick={() => setPieFilterType('year')} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${pieFilterType === 'year' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>年</button>
                      </div>
                  </div>

                  {/* Filter Inputs */}
                  <div className="mb-4 flex justify-end">
                      {pieFilterType === 'day' && (
                          <div className="relative">
                              <button 
                                  onClick={() => setShowPieDatePicker(!showPieDatePicker)}
                                  className="text-xs font-bold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 flex items-center gap-2 hover:bg-gray-100 transition-colors"
                              >
                                  <CalendarIcon className="w-3 h-3" /> {pieDate}
                              </button>
                              {showPieDatePicker && (
                                  <div className="absolute top-full right-0 mt-2 bg-white border border-gray-100 shadow-xl rounded-2xl p-3 z-20 w-64 animate-fade-in">
                                      <div className="flex justify-between items-center mb-2">
                                          <button onClick={() => setPiePickerMonth(new Date(piePickerMonth.getFullYear(), piePickerMonth.getMonth() - 1, 1))}><ChevronLeft className="w-4 h-4 text-gray-400"/></button>
                                          <span className="text-xs font-bold">{piePickerMonth.getFullYear()}年 {piePickerMonth.getMonth()+1}月</span>
                                          <button onClick={() => setPiePickerMonth(new Date(piePickerMonth.getFullYear(), piePickerMonth.getMonth() + 1, 1))}><ChevronRight className="w-4 h-4 text-gray-400"/></button>
                                      </div>
                                      <div className="grid grid-cols-7 gap-1 place-items-center">
                                          {renderPiePickerCalendar()}
                                      </div>
                                  </div>
                              )}
                          </div>
                      )}
                      {pieFilterType === 'month' && (
                          <input type="month" value={pieMonth} onChange={(e) => setPieMonth(e.target.value)} className="text-xs font-bold text-gray-600 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200 outline-none" />
                      )}
                      {pieFilterType === 'year' && (
                          <select value={pieYear} onChange={(e) => setPieYear(e.target.value)} className="text-xs font-bold text-gray-600 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200 outline-none">
                              <option value="2024">2024</option>
                              <option value="2025">2025</option>
                              <option value="2026">2026</option>
                          </select>
                      )}
                  </div>
                  
                  <div className="h-48 w-full relative">
                      {stats.pieData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie
                                      data={stats.pieData}
                                      innerRadius={50}
                                      outerRadius={70}
                                      paddingAngle={5}
                                      dataKey="value"
                                      stroke="none"
                                  >
                                      {stats.pieData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <Tooltip 
                                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                                      itemStyle={{fontWeight: 'bold'}}
                                  />
                              </PieChart>
                          </ResponsiveContainer>
                      ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-xs">无数据</div>
                      )}
                      {stats.filteredPieMinutes > 0 && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-2xl font-black text-gray-800">{Math.floor(stats.filteredPieMinutes / 60)}h</span>
                              <span className="text-[10px] text-gray-400 font-bold uppercase">Total</span>
                          </div>
                      )}
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                      {stats.pieData.map((entry, index) => (
                          <div key={index} className="flex items-center gap-2 text-xs">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                              <span className="text-gray-600 truncate flex-1">{entry.name}</span>
                              <span className="font-bold text-gray-800">{entry.label}</span>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Goals Checklist */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col h-[400px]">
                  <div className="flex justify-between items-center mb-4 shrink-0">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                          <Flag className="w-5 h-5 text-red-500" /> 阶段目标
                      </h3>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">{displayGoals.filter(g => g.is_completed).length}/{displayGoals.length}</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mb-4 pr-1">
                      {displayGoals.length > 0 ? (
                          displayGoals.map(goal => (
                              <div key={goal.id} className="group flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                  <button 
                                      onClick={() => handleToggleGoal(goal.id, goal.is_completed)}
                                      className={`shrink-0 transition-transform active:scale-90 ${goal.is_completed ? 'text-green-500' : 'text-gray-300 hover:text-gray-400'}`}
                                  >
                                      {goal.is_completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                  </button>
                                  <span className={`flex-1 text-sm font-medium transition-all ${goal.is_completed ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-700'}`}>
                                      {goal.title}
                                  </span>
                                  <button 
                                      onClick={() => handleDeleteGoal(goal.id)}
                                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                      <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                              </div>
                          ))
                      ) : (
                          <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2 opacity-60">
                              <TargetIcon className="w-8 h-8" />
                              <span className="text-xs">暂无目标</span>
                          </div>
                      )}
                  </div>
                  
                  <div className="relative shrink-0 mt-auto">
                      <input 
                          type="text" 
                          value={newGoalText}
                          onChange={(e) => setNewGoalText(e.target.value)}
                          placeholder="添加新目标 (e.g. 刷完1000题)..."
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
                          onKeyDown={(e) => e.key === 'Enter' && handleAddGoal()}
                      />
                      <button 
                          onClick={handleAddGoal}
                          disabled={!newGoalText.trim()}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white text-brand-600 rounded-lg shadow-sm hover:bg-brand-50 disabled:opacity-50 transition-colors border border-gray-100"
                      >
                          <Plus className="w-4 h-4" />
                      </button>
                  </div>
              </div>

          </div>
      </div>
    </div>
  );
};

// Simple Icon Component for Empty State
const TargetIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);
