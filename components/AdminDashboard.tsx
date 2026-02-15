
import React, { useMemo, useState, useEffect } from 'react';
import { CheckIn, User, SubjectCategory, RatingHistory, getUserStyle, AlgorithmTask, LeaveStatus } from '../types';
import * as storage from '../services/storageService';
import { AreaChart, Area, XAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, YAxis, Legend } from 'recharts';
import { Shield, CalendarOff, Save, ListTodo, UserPlus, Medal, Coffee, CheckCircle2, ChevronUp, MoreHorizontal, Edit3, Trash2, AlertCircle, ShieldCheck, BarChart3, PieChart as PieChartIcon, Search, X, History, TrendingUp, TrendingDown, Clock, BookOpen, Send, PlusCircle, Loader2, Calendar as CalendarIcon, Filter, RotateCcw, Users, XCircle, Check } from 'lucide-react';
import { ToastType } from './Toast';
import { AdminUserModal } from './AdminUserModal';
import { MarkdownText } from './MarkdownText';

interface Props {
  checkIns: CheckIn[];
  currentUser: User;
  allUsers: User[]; 
  onUpdateUser: (user: User) => void;
  onShowToast: (message: string, type: ToastType) => void;
  onNavigateToUser?: (userId: string) => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

// Use strict date formatting (4 AM Cut-off)
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

// Helper to extract the true delta from text description if possible
const getDisplayDelta = (record: RatingHistory, prevRecord: RatingHistory | undefined): number => {
    const reason = record.change_reason || '';
    const rMatch = reason.match(/R:\s*(\d+)\s*->\s*(\d+)/);
    if (rMatch) return parseInt(rMatch[2]) - parseInt(rMatch[1]);
    
    const penaltyMatch = reason.match(/扣分\s*-?(\d+)/);
    if (penaltyMatch) return -parseInt(penaltyMatch[1]);

    const bonusMatch = reason.match(/Rating \+(\d+)/);
    if (bonusMatch) return parseInt(bonusMatch[1]);

    return prevRecord ? record.rating - prevRecord.rating : 0;
};

export const AdminDashboard: React.FC<Props> = ({ checkIns, currentUser, allUsers: propAllUsers, onUpdateUser, onShowToast, onNavigateToUser }) => {
  const [allUsers, setAllUsers] = useState<User[]>(propAllUsers);
  const [sysAbsentStartDate, setSysAbsentStartDate] = useState('');
  const [showAdminUserModal, setShowAdminUserModal] = useState(false);
  const [expandedUserIds, setExpandedUserIds] = useState<string[]>([]);
  const [userPenaltyMap, setUserPenaltyMap] = useState<Record<string, CheckIn[]>>({});
  const [userLeaveMap, setUserLeaveMap] = useState<Record<string, CheckIn[]>>({}); // New: Store leaves per user
  
  // Analysis Modal State
  const [analyzingUser, setAnalyzingUser] = useState<User | null>(null);
  const [userRatingHistory, setUserRatingHistory] = useState<RatingHistory[]>([]);
  const [analysisTab, setAnalysisTab] = useState<'charts' | 'logs' | 'rating'>('charts');
  
  // Analysis Date Filter State
  const [analysisDateRange, setAnalysisDateRange] = useState({
      start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
  });

  // Algorithm Assignment State
  const [showAlgoModal, setShowAlgoModal] = useState(false);
  const [algoTitle, setAlgoTitle] = useState('');
  const [algoDesc, setAlgoDesc] = useState('');
  const [algoDate, setAlgoDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPublishingAlgo, setIsPublishingAlgo] = useState(false);

  // Edit States
  const [editingUserRating, setEditingUserRating] = useState<{id: string, rating: number} | null>(null);
  const [editingUserPassword, setEditingUserPassword] = useState<{id: string, password: string} | null>(null);
  const [editingUserGoal, setEditingUserGoal] = useState<{id: string, goal: number} | null>(null);

  // Recalculate Modal State
  const [recalcModalOpen, setRecalcModalOpen] = useState(false);
  const [recalcUserId, setRecalcUserId] = useState<string | null>(null);
  const [recalcStartDate, setRecalcStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [recalcEndDate, setRecalcEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [recalcBaseScore, setRecalcBaseScore] = useState<string>(''); // NEW: Allow manual base score
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState(0);
  const [isGlobalRecalc, setIsGlobalRecalc] = useState(false); // NEW: Toggle between single user and all users

  // Leave Management State
  const [creatingLeaveForUser, setCreatingLeaveForUser] = useState<string | null>(null);
  const [newLeaveDate, setNewLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [newLeaveDays, setNewLeaveDays] = useState(1);
  const [newLeaveReason, setNewLeaveReason] = useState('');
  
  // Edit Leave Modal State
  const [leaveEditModalOpen, setLeaveEditModalOpen] = useState(false);
  const [leaveEditId, setLeaveEditId] = useState<string | null>(null);
  const [leaveEditDate, setLeaveEditDate] = useState('');
  const [leaveEditDays, setLeaveEditDays] = useState(1);
  const [leaveEditUser, setLeaveEditUser] = useState<string>('');

  // Trigger re-render when checkIns change (important for status updates)
  const [localCheckIns, setLocalCheckIns] = useState<CheckIn[]>(checkIns);
  useEffect(() => {
      setLocalCheckIns(checkIns);
  }, [checkIns]);

  useEffect(() => {
      setAllUsers(propAllUsers);
  }, [propAllUsers]);

  useEffect(() => {
      const init = () => {
          const config = storage.getSystemConfig();
          setSysAbsentStartDate(config.absentStartDate);
      }
      init();
  }, []);

  const usersList = useMemo(() => allUsers.filter(u => u.role !== 'admin').sort((a,b) => (b.rating||0) - (a.rating||0)), [allUsers]);

  // --- Calculations ---
  const adminStats = useMemo(() => {
      const todayStr = formatDateKey(new Date());
      
      const totalDuration = localCheckIns.reduce((acc, c) => acc + (c.isPenalty ? 0 : (c.duration || 0)), 0);
      const activeUsersToday = new Set(localCheckIns.filter(c => formatDateKey(c.timestamp) === todayStr && !c.isPenalty).map(c => c.userId)).size;
      const totalUsers = usersList.length;
      const absentUsersToday = Math.max(0, totalUsers - activeUsersToday);
      const totalPenalties = localCheckIns.filter(c => c.isPenalty).length;
      
      const totalRating = usersList.reduce((acc, u) => acc + (u.rating || 1200), 0);
      const avgRating = totalUsers > 0 ? Math.round(totalRating / totalUsers) : 1200;
      const pendingLeaves = localCheckIns.filter(c => c.isLeave && c.leaveStatus === 'pending').length;

      // Global Subject Distribution
      const subjectMap: Record<string, number> = {};
      localCheckIns.filter(c => !c.isPenalty && !c.isLeave).forEach(c => {
          subjectMap[c.subject] = (subjectMap[c.subject] || 0) + (c.duration || 0);
      });
      const subjectData = Object.entries(subjectMap)
          .map(([name, value]) => ({ name, value: Math.round(value/60) }))
          .sort((a,b) => b.value - a.value).slice(0, 6);

      // Global Trend (Last 14 Days for better visuals)
      const trendMap: Record<string, number> = {};
      const dates = [];
      for(let i=13; i>=0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const k = formatDateKey(d);
          trendMap[k] = 0;
          dates.push(k);
      }
      localCheckIns.forEach(c => {
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
  }, [localCheckIns, usersList]);

  // --- Actions ---
  const handleSaveSysConfig = () => {
      storage.setSystemConfig('absentStartDate', sysAbsentStartDate);
      onShowToast("系统配置已保存", 'success');
  };

  const calculateUserStats = (user: User) => {
      const todayStr = formatDateKey(new Date());
      const todayCheckIns = localCheckIns.filter(c => c.userId === user.id && formatDateKey(c.timestamp) === todayStr && !c.isPenalty);
      const todayDuration = todayCheckIns.reduce((acc, c) => acc + (c.duration || 0), 0);
      const penalties = localCheckIns.filter(p => p.userId === user.id && p.isPenalty);
      const absentCount = penalties.filter(p => p.content.includes('缺勤') || p.content.includes('时长不足')).length;
      
      // FIXED: Strictly check if TODAY falls within the leave range
      const activeLeave = localCheckIns.find(c => {
          if (c.userId !== user.id || !c.isLeave || c.leaveStatus === 'rejected') return false;
          
          const days = c.leaveDays || 1;
          const startBusinessDateStr = formatDateKey(c.timestamp);
          const [y, m, d] = startBusinessDateStr.split('-').map(Number);
          
          // Check if todayStr matches any date in the leave range
          for (let i = 0; i < days; i++) {
              // Create date at Noon to avoid boundary issues
              const checkDate = new Date(y, m - 1, d + i, 12, 0, 0);
              if (formatDateKey(checkDate) === todayStr) return true;
          }
          return false;
      });

      return { todayDuration, absentCount, isLeaveToday: !!activeLeave };
  }

  const toggleRowExpand = (userId: string) => {
      if (expandedUserIds.includes(userId)) {
          setExpandedUserIds(prev => prev.filter(id => id !== userId));
          setCreatingLeaveForUser(null); // Close leave form if open
      } else {
          setExpandedUserIds(prev => [...prev, userId]);
          // Load Penalties
          const penalties = localCheckIns.filter(c => c.userId === userId && c.isPenalty).sort((a, b) => b.timestamp - a.timestamp);
          setUserPenaltyMap(prev => ({ ...prev, [userId]: penalties }));
          // Load Leaves
          const leaves = localCheckIns.filter(c => c.userId === userId && c.isLeave).sort((a, b) => b.timestamp - a.timestamp);
          setUserLeaveMap(prev => ({ ...prev, [userId]: leaves }));
      }
  };

  const handleExempt = async (checkInId: string, userId: string) => {
      try {
          const { ratingDelta } = await storage.exemptPenalty(checkInId);
          onShowToast(`已豁免，Rating +${ratingDelta}`, 'success');
          // Update local state to reflect change immediately
          const updatedPenalties = userPenaltyMap[userId].map(p => p.id === checkInId ? { ...p, isPenalty: false, content: p.content + ' [已豁免]' } : p);
          setUserPenaltyMap(prev => ({ ...prev, [userId]: updatedPenalties }));
          
          // Update global checkins for charts/stats
          setLocalCheckIns(prev => prev.map(c => c.id === checkInId ? { ...c, isPenalty: false } : c));

          const updatedUser = await storage.getUserById(userId);
          if (updatedUser) {
              setAllUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
          }
      } catch(e) {
          console.error(e);
          onShowToast("操作失败", 'error');
      }
  }

  const handleUpdateLeaveStatus = async (checkInId: string, userId: string, status: LeaveStatus) => {
      try {
          const makeup = status === 'approved' ? 60 : 0; // Default makeup
          await storage.updateLeaveStatus(checkInId, status, makeup);
          
          let toastMsg = `请假状态已更新为: ${status === 'approved' ? '批准' : '驳回'}`;

          // --- Auto-Exempt Penalties Logic ---
          if (status === 'approved') {
              const leaveRecord = localCheckIns.find(c => c.id === checkInId);
              if (leaveRecord) {
                  const days = leaveRecord.leaveDays || 1;
                  // Get the business start date of the leave
                  const startString = formatDateKey(leaveRecord.timestamp);
                  const [y, m, d] = startString.split('-').map(Number);
                  
                  const coveredDates = new Set<string>();
                  for (let i = 0; i < days; i++) {
                      const dateIter = new Date(y, m - 1, d + i, 12, 0, 0); 
                      coveredDates.add(formatDateKey(dateIter));
                  }

                  const penalties = localCheckIns.filter(c => 
                      c.userId === userId && 
                      c.isPenalty && 
                      coveredDates.has(formatDateKey(c.timestamp)) &&
                      !c.content.includes('已豁免')
                  );

                  if (penalties.length > 0) {
                      let exemptCount = 0;
                      for (const p of penalties) {
                          await storage.exemptPenalty(p.id);
                          exemptCount++;
                      }
                      
                      setLocalCheckIns(prev => prev.map(c => {
                          if (c.userId === userId && c.isPenalty && coveredDates.has(formatDateKey(c.timestamp))) {
                              return { ...c, isPenalty: false, content: c.content + ' [请假自动豁免]' };
                          }
                          return c;
                      }));
                      
                      setUserPenaltyMap(prev => {
                          const userPenalties = prev[userId] || [];
                          return {
                              ...prev,
                              [userId]: userPenalties.map(p => 
                                  coveredDates.has(formatDateKey(p.timestamp)) 
                                  ? { ...p, isPenalty: false, content: p.content + ' [请假自动豁免]' } 
                                  : p
                              )
                          };
                      });

                      toastMsg += ` (自动豁免 ${exemptCount} 条期间违规)`;
                  }
              }
          }
          // -----------------------------------

          onShowToast(toastMsg, status === 'approved' ? 'success' : 'info');
          
          // Update local map for leave status
          const updatedLeaves = userLeaveMap[userId].map(l => l.id === checkInId ? { ...l, leaveStatus: status, makeupMinutes: makeup } : l);
          setUserLeaveMap(prev => ({ ...prev, [userId]: updatedLeaves }));
          
          // Update global checkins 
          setLocalCheckIns(prev => prev.map(c => c.id === checkInId ? { ...c, leaveStatus: status, makeupMinutes: makeup } : c));

      } catch (e) {
          console.error(e);
          onShowToast("更新失败", 'error');
      }
  }

  const handleAdminCreateLeave = async (userId: string) => {
      if (!newLeaveReason.trim()) { onShowToast("请输入请假理由", 'error'); return; }
      
      const targetUser = allUsers.find(u => u.id === userId);
      if (!targetUser) return;

      const dailyMakeup = 60;
      const makeup = dailyMakeup * newLeaveDays;
      const startTimestamp = new Date(newLeaveDate).setHours(12, 0, 0, 0);

      const leaveCheckIn: CheckIn = {
          id: Date.now().toString(),
          userId: targetUser.id,
          userName: targetUser.name,
          userAvatar: targetUser.avatar,
          userRating: targetUser.rating,
          userRole: targetUser.role,
          subject: SubjectCategory.OTHER,
          content: `📜 **请假申请 (管理员代办)**\n\n**开始日期**: ${newLeaveDate}\n**天数**: ${newLeaveDays} 天\n**理由**: ${newLeaveReason}\n\n✅ 已批准 (需补时 ${makeup} 分钟)`,
          duration: 0,
          isLeave: true,
          leaveDays: newLeaveDays,
          leaveReason: newLeaveReason,
          leaveStatus: 'approved',
          makeupMinutes: makeup,
          timestamp: startTimestamp,
          likedBy: []
      };

      try {
          await storage.addCheckIn(leaveCheckIn);
          onShowToast("代请假成功", 'success');
          setCreatingLeaveForUser(null);
          setNewLeaveReason('');
          setNewLeaveDays(1);
          setNewLeaveDate(new Date().toISOString().split('T')[0]);
          
          // Reload leaves for this user
          const leaves = await storage.getUserCheckIns(userId);
          const filteredLeaves = leaves.filter(c => c.isLeave).sort((a, b) => b.timestamp - a.timestamp);
          setUserLeaveMap(prev => ({ ...prev, [userId]: filteredLeaves }));
          setLocalCheckIns(prev => [leaveCheckIn, ...prev]);

      } catch(e) {
          console.error(e);
          onShowToast("创建失败", 'error');
      }
  }

  const openLeaveEdit = (leave: CheckIn, userId: string) => {
      setLeaveEditId(leave.id);
      setLeaveEditDate(formatDateKey(leave.timestamp));
      setLeaveEditDays(leave.leaveDays || 1);
      setLeaveEditUser(userId);
      setLeaveEditModalOpen(true);
  }

  const handleSaveLeaveEdit = async () => {
      if (!leaveEditId || !leaveEditUser) return;
      
      try {
          const newTs = new Date(leaveEditDate).setHours(12, 0, 0, 0);
          
          // Fetch existing to get base content
          const currentLeave = userLeaveMap[leaveEditUser].find(l => l.id === leaveEditId);
          let newContent = currentLeave?.content || '';
          
          // Update Text Content with Regex
          // Replace Date
          newContent = newContent.replace(/\*\*开始日期\*\*: \d{4}-\d{2}-\d{2}/, `**开始日期**: ${leaveEditDate}`);
          // Replace Days
          newContent = newContent.replace(/\*\*天数\*\*: \d+ 天/, `**天数**: ${leaveEditDays} 天`);

          await storage.updateLeaveDetails(leaveEditId, newTs, leaveEditDays, newContent);
          
          onShowToast("请假信息已更新", 'success');
          setLeaveEditModalOpen(false);
          
          // Update local state
          const updatedLeaves = userLeaveMap[leaveEditUser].map(l => 
              l.id === leaveEditId 
              ? { ...l, timestamp: newTs, leaveDays: leaveEditDays, content: newContent } 
              : l
          );
          setUserLeaveMap(prev => ({ ...prev, [leaveEditUser]: updatedLeaves }));
          setLocalCheckIns(prev => prev.map(c => 
              c.id === leaveEditId 
              ? { ...c, timestamp: newTs, leaveDays: leaveEditDays, content: newContent } 
              : c
          ));

      } catch(e) {
          onShowToast("修改失败", 'error');
      }
  }

  // Trigger Modal
  const openRecalcModal = (userId: string) => {
      setRecalcUserId(userId);
      setIsGlobalRecalc(false);
      setRecalcProgress(0);
      setRecalcBaseScore('');
      setRecalcModalOpen(true);
  }

  const openGlobalRecalcModal = () => {
      setRecalcUserId(null);
      setIsGlobalRecalc(true);
      setRecalcProgress(0);
      setRecalcBaseScore('');
      setRecalcModalOpen(true);
  }

  const performRecalculation = async () => {
      if (!isGlobalRecalc && !recalcUserId) return;
      
      const baseRatingVal = recalcBaseScore ? parseInt(recalcBaseScore) : undefined;
      setIsRecalculating(true);
      setRecalcProgress(0);
      
      try {
          if (isGlobalRecalc) {
             // Global Mode
             await storage.recalculateAllUsersRating(
                 recalcStartDate,
                 recalcEndDate,
                 currentUser,
                 baseRatingVal,
                 (current, total, currentUserName) => {
                     const pct = Math.round((current / total) * 100);
                     setRecalcProgress(pct);
                 }
             );
             onShowToast(`全员积分重算完成！`, 'success');
             // Refresh all users
             const refreshedUsers = await storage.getAllUsers();
             setAllUsers(refreshedUsers);
             
             // Sync current user if changed
             const myself = refreshedUsers.find(u => u.id === currentUser.id);
             if (myself) {
                 onUpdateUser(myself);
                 storage.updateUserLocal(myself);
             }

          } else if (recalcUserId) {
              // Single User Mode
              const newRating = await storage.recalculateUserRatingByRange(
                  recalcUserId, 
                  recalcStartDate, 
                  recalcEndDate, 
                  currentUser,
                  (current, total) => {
                      setRecalcProgress(Math.round((current / total) * 100));
                  },
                  baseRatingVal
              );
              
              onShowToast(`积分重算成功，当前 Rating: ${newRating}`, 'success');
              setAllUsers(prev => prev.map(u => u.id === recalcUserId ? { ...u, rating: newRating } : u));
              
              if (recalcUserId === currentUser.id) {
                  const updatedUser = { ...currentUser, rating: newRating };
                  onUpdateUser(updatedUser);
                  storage.updateUserLocal(updatedUser);
              }
          }
          
          setRecalcProgress(100);
          setTimeout(() => {
              setRecalcModalOpen(false);
              setIsRecalculating(false);
          }, 800);

      } catch(e) {
          console.error(e);
          onShowToast("重算失败", 'error');
          setIsRecalculating(false);
      }
  }

  const handleQuickUpdate = async (type: 'rating'|'password'|'goal', userId: string) => {
      try {
          if (type === 'rating' && editingUserRating) {
              await storage.adminUpdateUser(userId, { rating: editingUserRating.rating });
              onShowToast("Rating 已更新", 'success');
              const newUser = { ...allUsers.find(u => u.id === userId)!, rating: editingUserRating.rating };
              setAllUsers(prev => prev.map(u => u.id === userId ? newUser : u));
              
              // Sync if self
              if (userId === currentUser.id) {
                  onUpdateUser(newUser);
                  storage.updateUserLocal(newUser);
              }
              setEditingUserRating(null);
          } else if (type === 'password' && editingUserPassword) {
              await storage.adminUpdateUser(userId, { password: editingUserPassword.password });
              onShowToast("密码已修改", 'success');
              setEditingUserPassword(null);
          } else if (type === 'goal' && editingUserGoal) {
              await storage.adminUpdateUser(userId, { dailyGoal: editingUserGoal.goal });
              onShowToast("每日目标已更新", 'success');
              setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, dailyGoal: editingUserGoal.goal } : u));
              setEditingUserGoal(null);
          }
      } catch(e) {
          onShowToast("更新失败", 'error');
      }
  }

  const handleDeleteUser = async (userId: string) => {
      if (!confirm("⚠️ 确定要彻底删除该用户吗？数据无法恢复！")) return;
      try {
          await storage.adminDeleteUser(userId);
          onShowToast("用户已删除", 'success');
          setAllUsers(prev => prev.filter(u => u.id !== userId));
      } catch(e) { onShowToast("删除失败", 'error'); }
  }

  // ... (Keep existing Analysis logic same as previous) ...
  const openAnalysis = async (user: User) => {
      setAnalyzingUser(user);
      setAnalysisTab('charts');
      setAnalysisDateRange({
          start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
      });
      const rh = await storage.getRatingHistory(user.id);
      setUserRatingHistory(rh);
  };

  const getUserAnalysisData = () => {
      if (!analyzingUser) return { pieData: [] };
      const userCheckIns = localCheckIns.filter(c => {
          if (c.userId !== analyzingUser.id || c.isPenalty || c.isLeave) return false;
          const date = formatDateKey(c.timestamp);
          return date >= analysisDateRange.start && date <= analysisDateRange.end;
      });
      const subMap: Record<string, number> = {};
      userCheckIns.forEach(c => subMap[c.subject] = (subMap[c.subject] || 0) + (c.duration || 0));
      const pieData = Object.entries(subMap).map(([name, value]) => ({ name, value: Math.round(value/60) }));
      return { pieData, totalLogs: userCheckIns.length };
  }

  const getFilteredLogs = () => {
      if (!analyzingUser) return [];
      return localCheckIns.filter(c => {
          if (c.userId !== analyzingUser.id) return false;
          const date = formatDateKey(c.timestamp);
          return date >= analysisDateRange.start && date <= analysisDateRange.end;
      });
  }

  const getFilteredRatingHistory = () => {
      if (!analyzingUser) return [];
      return userRatingHistory.filter(h => {
          const date = formatDateKey(new Date(h.recorded_at));
          return date >= analysisDateRange.start && date <= analysisDateRange.end;
      });
  }

  const handleDeleteHistory = async (recordId: number, refundAmount: number) => {
      if (!analyzingUser) return;
      if (!confirm("确定删除这条记录吗？分数将自动回滚。")) return;
      try {
          await storage.deleteRatingHistoryRecord(recordId, analyzingUser.id, -refundAmount); 
          onShowToast("记录已删除，分数已回滚", 'success');
          
          const updatedRH = await storage.getRatingHistory(analyzingUser.id);
          setUserRatingHistory(updatedRH);
          const updatedUser = await storage.getUserById(analyzingUser.id);
          if (updatedUser) {
              setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
              setAnalyzingUser(updatedUser);
              
              // Sync if self
              if (updatedUser.id === currentUser.id) {
                  onUpdateUser(updatedUser);
                  storage.updateUserLocal(updatedUser);
              }
          }
      } catch(e) {
          console.error(e);
          onShowToast("删除失败", 'error');
      }
  }

  const handlePublishAlgo = async () => {
      if (!algoTitle.trim() || !algoDesc.trim()) return;
      setIsPublishingAlgo(true);
      try {
          const task: AlgorithmTask = {
              id: Date.now().toString(),
              title: algoTitle,
              description: algoDesc,
              difficulty: 'Medium',
              date: algoDate
          };
          await storage.addAlgorithmTask(task);
          onShowToast("算法题发布成功", 'success');
          setShowAlgoModal(false);
          setAlgoTitle(''); setAlgoDesc('');
      } catch(e) {
          onShowToast("发布失败", 'error');
      } finally {
          setIsPublishingAlgo(false);
      }
  }

  return (
    <div className="space-y-6 pb-20 animate-fade-in relative">
      
      {/* --- Edit Leave Modal --- */}
      {leaveEditModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setLeaveEditModalOpen(false)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-yellow-50">
                      <h3 className="font-bold text-yellow-900 flex items-center gap-2">
                          <Edit3 className="w-5 h-5 text-yellow-600" /> 修改请假信息
                      </h3>
                      <button onClick={() => setLeaveEditModalOpen(false)}><X className="w-5 h-5 text-gray-400"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">开始日期</label>
                          <input 
                              type="date" 
                              value={leaveEditDate}
                              onChange={e => setLeaveEditDate(e.target.value)}
                              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">请假天数</label>
                          <div className="flex items-center gap-2">
                              <input 
                                  type="number" 
                                  min="1"
                                  value={leaveEditDays}
                                  onChange={e => setLeaveEditDays(parseInt(e.target.value) || 1)}
                                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-yellow-500"
                              />
                              <span className="text-gray-400 font-bold text-xs shrink-0">天</span>
                          </div>
                      </div>
                  </div>
                  <div className="p-4 border-t border-gray-100 flex gap-3">
                      <button onClick={() => setLeaveEditModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-gray-500 font-bold hover:bg-gray-100 transition-colors">取消</button>
                      <button onClick={handleSaveLeaveEdit} className="flex-1 py-2.5 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-600 shadow-lg shadow-yellow-200 transition-all flex items-center justify-center gap-2 active:scale-95">
                          <Save className="w-4 h-4"/> 保存修改
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- Recalculate Modal --- */}
      {recalcModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4" onClick={() => !isRecalculating && setRecalcModalOpen(false)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-orange-50">
                      <h3 className="font-bold text-orange-900 flex items-center gap-2">
                          <RotateCcw className="w-5 h-5 text-orange-600" /> {isGlobalRecalc ? '全员积分重算' : '单人积分重算'}
                      </h3>
                      {!isRecalculating && <button onClick={() => setRecalcModalOpen(false)}><X className="w-5 h-5 text-gray-400"/></button>}
                  </div>
                  
                  <div className="p-6 space-y-4">
                      {isRecalculating ? (
                          <div className="flex flex-col items-center justify-center py-6">
                              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                                  <div className="h-full bg-orange-500 transition-all duration-300 ease-out" style={{ width: `${recalcProgress}%` }}></div>
                              </div>
                              <span className="text-orange-600 font-black text-2xl">{recalcProgress}%</span>
                              <span className="text-gray-400 text-xs font-medium mt-1">
                                  {isGlobalRecalc ? '正在处理所有用户，请稍候...' : '正在重演历史记录，请勿关闭窗口...'}
                              </span>
                          </div>
                      ) : (
                          <>
                              <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                                  ⚠️ <strong>{isGlobalRecalc ? '高风险操作 (影响全员)' : '高风险操作'}：</strong><br/>
                                  系统将以“开始日期”前的积分为基准（或使用指定基础分），<strong>重新模拟计算</strong>直到【今天】的所有历史记录。此操作不可撤销。
                              </p>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">重算起点日期</label>
                                  <input type="date" className="w-full border rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-orange-500" value={recalcStartDate} onChange={e => setRecalcStartDate(e.target.value)} />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">指定基础分 (选填)</label>
                                  <input 
                                      type="number" 
                                      placeholder="留空则使用起点前的历史分数" 
                                      className="w-full border rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-orange-500 placeholder:font-normal" 
                                      value={recalcBaseScore} 
                                      onChange={e => setRecalcBaseScore(e.target.value)} 
                                  />
                              </div>
                          </>
                      )}
                  </div>
                  
                  <div className="p-4 border-t border-gray-100 flex gap-3">
                      <button onClick={() => setRecalcModalOpen(false)} disabled={isRecalculating} className="flex-1 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-100 transition-colors disabled:opacity-50">取消</button>
                      <button onClick={performRecalculation} disabled={isRecalculating} className="flex-1 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 disabled:opacity-80">
                          {isRecalculating ? <Loader2 className="w-4 h-4 animate-spin"/> : <RotateCcw className="w-4 h-4"/>}
                          {isRecalculating ? '计算中...' : '确认重算'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ... (Existing Analysis Modal, Algo Modal, Header, Stats, Charts, Table) ... */}
      
      {/* ... Analysis Modal ... */}
      {analyzingUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setAnalyzingUser(null)}>
              <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                  {/* ... same as before ... */}
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                      <div className="flex items-center gap-4">
                          <img src={analyzingUser.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                          <div>
                              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                  {analyzingUser.name} <span className="text-xs font-normal text-gray-500 bg-white px-2 py-0.5 rounded border font-mono">ID: {analyzingUser.id.substring(0,6)}</span>
                              </h2>
                              <div className="flex items-center gap-3 text-sm mt-1">
                                  <span className="font-bold text-indigo-600 bg-indigo-50 px-2 rounded">R: {analyzingUser.rating}</span>
                                  <span className="text-gray-600">目标: {analyzingUser.dailyGoal} min</span>
                              </div>
                          </div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
                              <CalendarIcon className="w-4 h-4 text-gray-400" />
                              <input 
                                  type="date" 
                                  value={analysisDateRange.start}
                                  onChange={e => setAnalysisDateRange(prev => ({...prev, start: e.target.value}))}
                                  className="text-xs font-bold text-gray-700 outline-none w-24"
                              />
                              <span className="text-gray-400">-</span>
                              <input 
                                  type="date" 
                                  value={analysisDateRange.end}
                                  onChange={e => setAnalysisDateRange(prev => ({...prev, end: e.target.value}))}
                                  className="text-xs font-bold text-gray-700 outline-none w-24"
                              />
                          </div>
                          <button onClick={() => setAnalyzingUser(null)} className="p-2 hover:bg-gray-200 rounded-full"><X className="w-6 h-6 text-gray-500"/></button>
                      </div>
                  </div>
                  {/* ... tabs and content ... */}
                  <div className="flex border-b border-gray-100 px-6 gap-6 bg-white shrink-0">
                      <button onClick={() => setAnalysisTab('charts')} className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${analysisTab === 'charts' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><PieChartIcon className="w-4 h-4"/> 图表分析</button>
                      <button onClick={() => setAnalysisTab('rating')} className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${analysisTab === 'rating' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><History className="w-4 h-4"/> 积分管理</button>
                      <button onClick={() => setAnalysisTab('logs')} className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${analysisTab === 'logs' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><ListTodo className="w-4 h-4"/> 打卡日志</button>
                  </div>
                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/50">
                      {analysisTab === 'charts' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-80 relative">
                                  <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 z-10"><PieChartIcon className="w-4 h-4 text-indigo-500"/> 科目分布 (小时)</h4>
                                  <div className="flex-1 w-full h-full">
                                      {getUserAnalysisData().pieData.length > 0 ? (
                                          <ResponsiveContainer width="100%" height="100%">
                                              <PieChart>
                                                  <Pie data={getUserAnalysisData().pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                      {getUserAnalysisData().pieData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                  </Pie>
                                                  <Tooltip contentStyle={{borderRadius: '12px'}} itemStyle={{fontSize:'12px', fontWeight:'bold'}} />
                                                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{fontSize: '10px'}}/>
                                              </PieChart>
                                          </ResponsiveContainer>
                                      ) : (
                                          <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm">该时段无数据</div>
                                      )}
                                  </div>
                              </div>
                              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center text-gray-400">
                                  <BarChart3 className="w-12 h-12 mb-3 opacity-20" />
                                  <p className="font-medium">筛选时段内日志数: {getUserAnalysisData().totalLogs}</p>
                              </div>
                          </div>
                      )}
                      {analysisTab === 'rating' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {getFilteredRatingHistory().map((h, idx) => {
                                  // Use getDisplayDelta helper to fix jump issues
                                  const prev = userRatingHistory[userRatingHistory.findIndex(r => r.id === h.id) + 1];
                                  const delta = getDisplayDelta(h, prev);
                                  
                                  return (
                                      <div key={h.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
                                          <div className="flex justify-between items-start mb-3">
                                              <div className="flex items-center gap-3">
                                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${delta > 0 ? 'bg-green-50 text-green-600' : delta < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                                      {delta > 0 ? `+${delta}` : delta === 0 ? '-' : delta}
                                                  </div>
                                                  <div>
                                                      <div className="font-bold text-gray-800 text-sm line-clamp-1">{h.change_reason || '未知变动'}</div>
                                                      <div className="text-xs text-gray-400 font-mono flex items-center gap-1">
                                                          <Clock className="w-3 h-3"/> {new Date(h.recorded_at).toLocaleString()}
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                                              <span className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded">
                                                  Rating: {h.rating}
                                              </span>
                                              <button onClick={() => handleDeleteHistory(h.id, delta)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="删除并回滚分数">
                                                  <Trash2 className="w-4 h-4" />
                                              </button>
                                          </div>
                                      </div>
                                  )
                              })}
                              {getFilteredRatingHistory().length === 0 && <div className="col-span-full text-center py-10 text-gray-400">该时段无积分记录</div>}
                          </div>
                      )}
                      {analysisTab === 'logs' && (
                          <div className="grid grid-cols-1 gap-4">
                              {getFilteredLogs().map(c => (
                                  <div key={c.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
                                      <div className="flex justify-between items-center">
                                          <div className="flex items-center gap-2">
                                              <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${c.isPenalty ? 'bg-red-50 text-red-600 border-red-100' : (c.isLeave ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-brand-50 text-brand-600 border-brand-100')}`}>{c.isPenalty ? '⚠️ 惩罚' : c.subject}</span>
                                              <span className="text-xs text-gray-400 font-mono">{new Date(c.timestamp).toLocaleString()}</span>
                                          </div>
                                          {!c.isPenalty && !c.isLeave && <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {c.duration} min</span>}
                                      </div>
                                      <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-50"><MarkdownText content={c.content} /></div>
                                  </div>
                              ))}
                              {getFilteredLogs().length === 0 && <div className="text-center py-10 text-gray-400">该时段无打卡记录</div>}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* ... Algo Modal ... */}
      {showAlgoModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center"><h3 className="text-lg font-bold text-gray-800">发布算法题</h3><button onClick={() => setShowAlgoModal(false)}><X className="w-5 h-5 text-gray-400"/></button></div>
                  <div className="p-6 space-y-4">
                      <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">题目名称</label><input className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={algoTitle} onChange={e => setAlgoTitle(e.target.value)} /></div>
                      <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">题目日期</label><input type="date" className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={algoDate} onChange={e => setAlgoDate(e.target.value)} /></div>
                      <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">描述 (Markdown)</label><textarea className="w-full border rounded-xl px-3 py-2 h-32 resize-none outline-none focus:ring-2 focus:ring-indigo-500" value={algoDesc} onChange={e => setAlgoDesc(e.target.value)} placeholder="题目详情..." /></div>
                  </div>
                  <div className="p-4 bg-gray-50 flex justify-end gap-3"><button onClick={() => setShowAlgoModal(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-200 rounded-lg">取消</button><button onClick={handlePublishAlgo} disabled={isPublishingAlgo} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2">{isPublishingAlgo ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>} 发布</button></div>
              </div>
          </div>
      )}

      {/* --- Header --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
               <Shield className="w-7 h-7 text-indigo-600" /> 管理控制台
           </h1>
           <div className="flex gap-2">
               <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
                   <CalendarOff className="w-4 h-4 text-red-500" />
                   <span className="text-xs font-bold text-gray-500">惩罚起始日:</span>
                   <input type="date" value={sysAbsentStartDate} onChange={e => setSysAbsentStartDate(e.target.value)} className="text-xs font-bold text-gray-800 outline-none border-b border-dashed border-gray-300 focus:border-indigo-500 w-24"/>
                   <button onClick={handleSaveSysConfig} className="text-indigo-600 hover:text-indigo-800"><Save className="w-4 h-4"/></button>
               </div>
               <button onClick={openGlobalRecalcModal} className="bg-orange-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg shadow-orange-200 hover:bg-orange-600 flex items-center gap-1"><RotateCcw className="w-4 h-4" /> 全员重算</button>
               <button onClick={() => setShowAlgoModal(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 flex items-center gap-1"><PlusCircle className="w-4 h-4" /> 发布算法题</button>
           </div>
      </div>

      {/* --- Stats Cards --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
           <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"><div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">打卡总时长</div><div className="text-xl font-black text-gray-800">{Math.round(adminStats.totalDuration / 60)} <span className="text-xs font-medium text-gray-400">h</span></div></div>
           <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"><div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">今日打卡</div><div className="text-xl font-black text-green-600">{adminStats.activeUsersToday} <span className="text-xs font-medium text-gray-400">人</span></div></div>
           <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"><div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">今日缺勤</div><div className="text-xl font-black text-red-500">{adminStats.absentUsersToday} <span className="text-xs font-medium text-gray-400">人</span></div></div>
           <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"><div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">累计违规</div><div className="text-xl font-black text-orange-500">{adminStats.totalPenalties} <span className="text-xs font-medium text-gray-400">次</span></div></div>
           <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"><div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">待审批请假</div><div className={`text-xl font-black ${adminStats.pendingLeaves > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{adminStats.pendingLeaves} <span className="text-xs font-medium text-gray-400">条</span></div></div>
           <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"><div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">平均 Rating</div><div className="text-xl font-black text-indigo-600">{adminStats.avgRating}</div></div>
      </div>

      {/* --- Charts --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col h-[320px]">
               <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-4"><PieChartIcon className="w-5 h-5 text-indigo-500" /> 全站科目分布</h3>
               <div className="flex-1 w-full relative">
                   {adminStats.subjectData.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={adminStats.subjectData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{adminStats.subjectData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{borderRadius: '12px'}} itemStyle={{fontSize:'12px', fontWeight:'bold'}} /><Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '10px'}}/></PieChart></ResponsiveContainer>
                   ) : <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm">暂无数据</div>}
               </div>
           </div>
           <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col h-[320px]">
               <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-4"><BarChart3 className="w-5 h-5 text-green-500" /> 近 14 日总时长 (小时)</h3>
               <div className="flex-1 w-full relative">
                   <ResponsiveContainer width="100%" height="100%"><BarChart data={adminStats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" /><XAxis dataKey="date" tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} /><YAxis tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} /><Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '12px'}} /><Bar dataKey="hours" name="总时长" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} /></BarChart></ResponsiveContainer>
               </div>
           </div>
      </div>

      {/* --- User Table --- */}
      <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm overflow-hidden">
           <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                    <ListTodo className="w-6 h-6 text-indigo-500" /> 用户管理
                </h2>
                <button onClick={() => setShowAdminUserModal(true)} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-gray-200">
                    <UserPlus className="w-4 h-4" /> 新增用户
                </button>
           </div>
           
           <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                   <thead>
                       <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                           <th className="py-3 pl-4 rounded-tl-xl w-16">Rank</th>
                           <th className="py-3">用户</th>
                           <th className="py-3">Rating</th>
                           <th className="py-3">目标/今日</th>
                           <th className="py-3">缺勤</th>
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
                                       <td className="py-3 pl-4 font-mono text-gray-400 font-bold">{index < 3 ? <Medal className={`w-5 h-5 ${index===0?'text-yellow-500':index===1?'text-gray-400':'text-orange-600'}`} /> : index + 1}</td>
                                       <td className="py-3">
                                           <div className="flex items-center gap-3"> 
                                               <img src={u.avatar} className="w-9 h-9 rounded-full bg-gray-100 border border-gray-100 cursor-pointer hover:scale-110 transition-transform" onClick={() => onNavigateToUser && onNavigateToUser(u.id)}/>
                                               <div><div className={`font-bold text-sm ${getUserStyle(u.role, u.rating)}`}>{u.name}</div><div className="text-[10px] text-gray-400 font-mono">ID: {u.id.substring(0,6)}</div></div>
                                           </div>
                                       </td>
                                       <td className={`py-3 font-bold ${u.rating && u.rating >= 2000 ? 'text-red-600' : 'text-indigo-600'}`}>{u.rating || 1200}</td>
                                       <td className="py-3 text-xs"><span className="font-bold text-gray-700">{u.dailyGoal || 90}</span> / <span className="text-gray-500">{stats.todayDuration}m</span></td>
                                       <td className="py-3">{stats.absentCount > 0 ? <span className="bg-red-50 text-red-600 px-2 py-1 rounded text-xs font-bold">{stats.absentCount}</span> : <span className="text-gray-300 text-xs">-</span>}</td>
                                       <td className="py-3">{stats.isLeaveToday ? <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-bold">请假</span> : <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded font-bold">正常</span>}</td>
                                       <td className="py-3 pr-4 text-right">
                                           <button onClick={() => toggleRowExpand(u.id)} className={`p-2 rounded-full hover:bg-indigo-50 transition-colors ${isExpanded ? 'text-indigo-600 bg-indigo-100' : 'text-gray-400'}`}>
                                               {isExpanded ? <ChevronUp className="w-4 h-4" /> : <MoreHorizontal className="w-4 h-4" />}
                                           </button>
                                       </td>
                                   </tr>
                                   
                                   {isExpanded && (
                                       <tr className="bg-indigo-50/30 animate-fade-in">
                                           <td colSpan={7} className="p-4 pt-0">
                                               <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                   <div className="space-y-4">
                                                       <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2"><Edit3 className="w-3 h-3" /> 快速编辑 & 分析</h4>
                                                       <div className="grid grid-cols-2 gap-3">
                                                           <div className="flex"><input type="number" className="w-full text-xs border rounded-l px-2 py-1.5 outline-none" placeholder="Rating" value={editingUserRating?.id === u.id ? editingUserRating.rating : ''} onChange={(e) => setEditingUserRating({id: u.id, rating: parseInt(e.target.value)})} /><button onClick={() => handleQuickUpdate('rating', u.id)} className="bg-indigo-600 text-white px-2 py-1.5 rounded-r text-xs font-bold">保存</button></div>
                                                           <div className="flex"><input type="text" className="w-full text-xs border rounded-l px-2 py-1.5 outline-none" placeholder="密码" value={editingUserPassword?.id === u.id ? editingUserPassword.password : ''} onChange={(e) => setEditingUserPassword({id: u.id, password: e.target.value})} /><button onClick={() => handleQuickUpdate('password', u.id)} className="bg-gray-600 text-white px-2 py-1.5 rounded-r text-xs font-bold">重置</button></div>
                                                           <div className="flex"><input type="number" className="w-full text-xs border rounded-l px-2 py-1.5 outline-none" placeholder="每日目标" value={editingUserGoal?.id === u.id ? editingUserGoal.goal : ''} onChange={(e) => setEditingUserGoal({id: u.id, goal: parseInt(e.target.value)})} /><button onClick={() => handleQuickUpdate('goal', u.id)} className="bg-blue-600 text-white px-2 py-1.5 rounded-r text-xs font-bold">目标</button></div>
                                                       </div>
                                                       <div className="flex justify-between pt-2">
                                                           <button onClick={() => openRecalcModal(u.id)} className="text-xs font-bold text-orange-600 flex items-center gap-1 hover:underline"><RotateCcw className="w-3 h-3"/> 重算/回滚 Rating</button>
                                                           <button onClick={() => openAnalysis(u)} className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline"><Search className="w-3 h-3"/> 深度分析/管理记录</button>
                                                           <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 text-xs font-bold flex items-center gap-1 hover:text-red-700"><Trash2 className="w-3 h-3" /> 删除用户</button>
                                                       </div>
                                                   </div>
                                                   {/* Leaves Section */}
                                                   <div className="space-y-2">
                                                       <div className="flex justify-between items-center">
                                                           <h4 className="text-xs font-bold text-yellow-700 uppercase tracking-wider flex items-center gap-2"><Coffee className="w-3 h-3 text-yellow-600" /> 请假管理</h4>
                                                           <button onClick={() => setCreatingLeaveForUser(creatingLeaveForUser === u.id ? null : u.id)} className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold hover:bg-yellow-200 transition-colors flex items-center gap-1"><PlusCircle className="w-3 h-3"/> 代为请假</button>
                                                       </div>
                                                       
                                                       {/* Creating Leave Form */}
                                                       {creatingLeaveForUser === u.id && (
                                                           <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-200 space-y-2 animate-fade-in">
                                                               <div className="flex gap-2">
                                                                   <input type="date" value={newLeaveDate} onChange={e => setNewLeaveDate(e.target.value)} className="w-24 text-xs p-1 rounded border border-yellow-300" />
                                                                   <input type="number" min="1" max="7" value={newLeaveDays} onChange={e => setNewLeaveDays(parseInt(e.target.value))} className="w-12 text-xs p-1 rounded border border-yellow-300" placeholder="天" />
                                                                   <button onClick={() => handleAdminCreateLeave(u.id)} className="bg-yellow-600 text-white text-xs px-2 rounded font-bold hover:bg-yellow-700 flex-1">提交</button>
                                                               </div>
                                                               <input placeholder="请假理由..." value={newLeaveReason} onChange={e => setNewLeaveReason(e.target.value)} className="w-full text-xs p-1 rounded border border-yellow-300" />
                                                           </div>
                                                       )}

                                                       <div className="bg-gray-50 rounded-lg p-2 max-h-40 overflow-y-auto custom-scrollbar border border-gray-100">
                                                           {userLeaveMap[u.id] && userLeaveMap[u.id].length > 0 ? (
                                                               userLeaveMap[u.id].map(l => (
                                                                   <div key={l.id} className="flex flex-col p-2 mb-1 bg-white rounded border border-gray-100 last:mb-0 gap-1.5">
                                                                       <div className="flex justify-between items-center">
                                                                           <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1 group/date">
                                                                               {new Date(l.timestamp).toLocaleDateString()} ({l.leaveDays || 1}天)
                                                                               <Edit3 
                                                                                   className="w-3 h-3 text-gray-300 opacity-0 group-hover/date:opacity-100 cursor-pointer hover:text-indigo-500" 
                                                                                   onClick={() => openLeaveEdit(l, u.id)} 
                                                                               />
                                                                           </div>
                                                                           <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                                                               l.leaveStatus === 'approved' ? 'bg-green-50 text-green-600' : 
                                                                               l.leaveStatus === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
                                                                           }`}>
                                                                               {l.leaveStatus === 'approved' ? '已批准' : l.leaveStatus === 'rejected' ? '已驳回' : '待审核'}
                                                                           </span>
                                                                       </div>
                                                                       <div className="text-xs font-medium text-gray-700 truncate" title={l.leaveReason}>{l.leaveReason}</div>
                                                                       <div className="flex justify-end gap-2 pt-1">
                                                                           {l.leaveStatus !== 'rejected' && (
                                                                               <button onClick={() => handleUpdateLeaveStatus(l.id, u.id, 'rejected')} className="text-[10px] text-red-500 border border-red-100 bg-red-50 px-2 py-0.5 rounded hover:bg-red-100 flex items-center gap-1">
                                                                                   <XCircle className="w-3 h-3" /> {l.leaveStatus === 'pending' ? '驳回' : '撤销'}
                                                                               </button>
                                                                           )}
                                                                           {l.leaveStatus === 'pending' && (
                                                                               <button onClick={() => handleUpdateLeaveStatus(l.id, u.id, 'approved')} className="text-[10px] text-green-600 border border-green-100 bg-green-50 px-2 py-0.5 rounded hover:bg-green-100 flex items-center gap-1">
                                                                                   <CheckCircle2 className="w-3 h-3" /> 批准
                                                                               </button>
                                                                           )}
                                                                       </div>
                                                                   </div>
                                                               ))
                                                           ) : <div className="text-center text-xs text-gray-400 py-4">无请假记录</div>}
                                                       </div>
                                                   </div>
                                                   {/* Penalties Section */}
                                                   <div className="space-y-2">
                                                       <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-2"><AlertCircle className="w-3 h-3 text-red-500" /> 待处理违规</h4>
                                                       <div className="bg-gray-50 rounded-lg p-2 max-h-40 overflow-y-auto custom-scrollbar border border-gray-100">
                                                           {userPenaltyMap[u.id] && userPenaltyMap[u.id].length > 0 ? (
                                                               userPenaltyMap[u.id].map(p => (
                                                                   <div key={p.id} className="flex justify-between items-center p-2 mb-1 bg-white rounded border border-gray-100 last:mb-0">
                                                                       <div><div className="text-xs font-bold text-gray-700 truncate max-w-[150px]">{p.content.split('\n')[0].replace(/\*/g, '')}</div><div className="text-[10px] text-gray-400 font-mono">{new Date(p.timestamp).toLocaleDateString()}</div></div>
                                                                       {!p.content.includes('已豁免') ? (
                                                                           <button onClick={() => handleExempt(p.id, u.id)} className="text-[10px] bg-green-50 text-green-600 px-2 py-1 rounded border border-green-100 hover:bg-green-100 font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> 豁免</button>
                                                                       ) : <span className="text-[10px] text-gray-400 italic">已豁免</span>}
                                                                   </div>
                                                               ))
                                                           ) : <div className="text-center text-xs text-gray-400 py-4">无违规记录</div>}
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
};
