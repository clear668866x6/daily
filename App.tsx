
import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { Profile } from './components/Profile';
import { Feed } from './components/Feed';
import { EnglishTutor } from './components/EnglishTutor';
import { AlgorithmTutor } from './components/AlgorithmTutor';
import { AchievementsHistory } from './components/AchievementsHistory';
import { PKArena } from './components/PKArena';
import { About } from './components/About';
import { Login } from './components/Login';
import { GlobalAlerts } from './components/GlobalAlerts';
import { Modal } from './components/Modal'; 
import { AdminUserModal } from './components/AdminUserModal'; 
import { CheckIn, SubjectCategory, User, AlgorithmTask } from './types';
import * as storage from './services/storageService';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { Fireworks } from './components/Fireworks'; 
import { X, CalendarOff, Flame, Trophy, Coffee } from 'lucide-react'; 

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('kaoyan_active_tab') || 'dashboard');
  
  const [user, setUser] = useState<User | null>(null);
  const [visitedProfileUser, setVisitedProfileUser] = useState<User | null>(null);

  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [algoTasks, setAlgoTasks] = useState<AlgorithmTask[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [checkInToDelete, setCheckInToDelete] = useState<string | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const [targetProfileId, setTargetProfileId] = useState<string | null>(null);

  const [penaltyModalData, setPenaltyModalData] = useState<{count: number, date: string, type: 'missing' | 'debt'} | null>(null);
  const [streakModalData, setStreakModalData] = useState<{days: number, bonus: number} | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Default daily goal in minutes
  const DEFAULT_DAILY_GOAL = 90;

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Date.now().toString() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    localStorage.setItem('kaoyan_active_tab', activeTab);
  }, [activeTab]);

  const refreshData = async () => {
    try {
      const [fetchedCheckIns, fetchedTasks] = await Promise.all([
        storage.getCheckIns(),
        storage.getAlgorithmTasks()
      ]);
      setCheckIns(fetchedCheckIns);
      setAlgoTasks(fetchedTasks);

      if (user) {
         const freshUser = await storage.getUserById(user.id);
         if (freshUser) {
             // Only update if critical fields changed to avoid jitters, but rating is critical
             if(freshUser.rating !== user.rating || freshUser.dailyGoal !== user.dailyGoal || freshUser.lastGoalEditDate !== user.lastGoalEditDate) {
                 const mergedUser = { ...user, ...freshUser };
                 setUser(mergedUser);
                 storage.updateUserLocal(mergedUser);
             }
         }
      }

    } catch (e) {
      console.error("Failed to load data", e);
    }
  };

  // 获取业务日期 (凌晨4点前算前一天) - Strictly Local Time
  const getBusinessDate = (date: Date): string => {
      const d = new Date(date);
      // If before 4 AM, subtract one day
      if (d.getHours() < 4) {
          d.setDate(d.getDate() - 1);
      }
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  const calculateStreak = async (userId: string): Promise<number> => {
      const userCheckIns = await storage.getUserCheckIns(userId);
      const validDates = userCheckIns
          .filter(c => !c.isPenalty)
          .map(c => getBusinessDate(new Date(c.timestamp)));
      
      const uniqueDates = Array.from(new Set(validDates)).sort().reverse();
      if (uniqueDates.length === 0) return 0;

      const today = getBusinessDate(new Date());
      const yesterdayDate = new Date();
      if (yesterdayDate.getHours() < 4) {
          yesterdayDate.setDate(yesterdayDate.getDate() - 2);
      } else {
          yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      }
      const yesterday = getBusinessDate(yesterdayDate);

      const latest = uniqueDates[0];
      // Streak continues if latest check-in is Today or Yesterday
      if (latest !== today && latest !== yesterday) {
          return 0; 
      }

      let streak = 1;
      for (let i = 0; i < uniqueDates.length - 1; i++) {
          const curr = new Date(uniqueDates[i]);
          const prev = new Date(uniqueDates[i+1]);
          const diffTime = Math.abs(curr.getTime() - prev.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          if (diffDays === 1) streak++; else break;
      }
      return streak;
  };

  // 核心逻辑：检查每日惩罚 & 连胜奖励
  const checkDailyPenalties = async (currentUser: User) => {
      if (currentUser.role === 'guest') return currentUser;
      
      const sysConfig = storage.getSystemConfig();
      const startDateLimit = sysConfig.absentStartDate ? new Date(sysConfig.absentStartDate).getTime() : 0;

      const lastCheckedDate = localStorage.getItem(`last_penalty_check_${currentUser.id}`);
      const now = new Date();
      const todayBusinessDate = getBusinessDate(now);

      // If last check was today, skip
      if (lastCheckedDate === todayBusinessDate) {
          return currentUser;
      }

      let dateIterator: Date;
      if (!lastCheckedDate) {
          // New user or first run: start from yesterday (business day)
          // to avoid penalizing history.
           const y = new Date();
           if(y.getHours() < 4) y.setDate(y.getDate() - 1); // Adjust for business day logic base
           y.setDate(y.getDate() - 1); // Go to yesterday
           dateIterator = y;
      } else {
           dateIterator = new Date(lastCheckedDate);
           dateIterator.setDate(dateIterator.getDate() + 1); // Start checking from the day AFTER last check
      }

      // Fetch fresh checkins to avoid stale data
      const userCheckIns = await storage.getUserCheckIns(currentUser.id);
      let updatedRating = currentUser.rating || 1200;
      let hasUpdated = false;

      // Iterate through all missed business days UP TO (but not including) Today
      // We do NOT check today because the day is not over.
      while (getBusinessDate(dateIterator) < todayBusinessDate) {
          const checkDateStr = getBusinessDate(dateIterator);
          
          // Check if this date is before the system configured start date
          const currentDateMillis = new Date(checkDateStr).getTime();
          if (currentDateMillis < startDateLimit) {
              localStorage.setItem(`last_penalty_check_${currentUser.id}`, checkDateStr);
              dateIterator.setDate(dateIterator.getDate() + 1);
              continue;
          }

          console.log(`Checking penalties for: ${checkDateStr}`);

          // 1. Check Leave Exemptions
          const isLeaveExempt = userCheckIns.some(c => {
              if (!c.isLeave || c.leaveStatus !== 'approved') return false;
              // Check if checkDateStr falls within this leave request
              const leaveStartTimestamp = c.timestamp;
              const leaveStartDate = getBusinessDate(new Date(leaveStartTimestamp));
              
              // Simple range check: start <= checkDate < start + days
              const start = new Date(leaveStartDate).getTime();
              const current = new Date(checkDateStr).getTime();
              const end = start + ((c.leaveDays || 1) * 86400000); 
              
              return current >= start && current < end;
          });

          if (isLeaveExempt) {
              // Skip penalty, but mark this day as checked
              localStorage.setItem(`last_penalty_check_${currentUser.id}`, checkDateStr);
              dateIterator.setDate(dateIterator.getDate() + 1);
              continue; 
          }

          // 2. Check Stats
          const daysCheckIns = userCheckIns.filter(c => getBusinessDate(new Date(c.timestamp)) === checkDateStr);
          const duration = daysCheckIns.filter(c => !c.isPenalty).reduce((sum, c) => sum + (c.duration || 0), 0);
          const dailyGoal = currentUser.dailyGoal || DEFAULT_DAILY_GOAL;

          if (duration < dailyGoal) {
              let penalty = 0;
              let reason = '';
              
              if (duration === 0) {
                  // Random penalty between 45 and 60 for absence
                  penalty = -(Math.floor(Math.random() * (60 - 45 + 1)) + 45);
                  reason = `[系统] 缺勤惩罚 (${checkDateStr}) 扣分 ${Math.abs(penalty)}`;
              } else {
                  // Random penalty between 10 and 20 for missing target
                  penalty = -(Math.floor(Math.random() * (20 - 10 + 1)) + 10);
                  reason = `[系统] 时长不足 (${checkDateStr}): ${duration}/${dailyGoal}min 扣分 ${Math.abs(penalty)}`;
              }

              // Double check we haven't already penalized this specific date
              // (Prevent dups if local storage was cleared but DB remains)
              const alreadyPenalized = daysCheckIns.some(c => c.isPenalty && c.content.includes(checkDateStr));
              
              if (!alreadyPenalized) {
                  const penaltyCheckIn: CheckIn = {
                      id: `sys-pen-${Date.now()}-${Math.random()}`,
                      userId: currentUser.id,
                      userName: currentUser.name,
                      userAvatar: currentUser.avatar,
                      userRating: updatedRating + penalty,
                      userRole: currentUser.role,
                      subject: SubjectCategory.OTHER,
                      content: `⚠️ **${reason}**\n\n根据规则，系统自动执行扣分。请注意保持每日学习节奏！`,
                      duration: 0,
                      isPenalty: true,
                      timestamp: dateIterator.getTime() + 43200000, // Noon of that day
                      likedBy: []
                  };
                  await storage.addCheckIn(penaltyCheckIn);
                  await storage.updateRating(currentUser.id, updatedRating + penalty, reason);
                  updatedRating += penalty;
                  hasUpdated = true;
                  setPenaltyModalData({ count: Math.abs(penalty), date: checkDateStr, type: 'missing' });
              }
          }
          
          // Mark THIS specific date as checked
          localStorage.setItem(`last_penalty_check_${currentUser.id}`, checkDateStr);
          dateIterator.setDate(dateIterator.getDate() + 1);
      }

      if (hasUpdated) {
          currentUser.rating = updatedRating;
      }
      
      return currentUser;
  };

  useEffect(() => {
    const init = async () => {
      let currentUser = storage.getCurrentUser();
      if (currentUser) {
        // Run penalty check first
        currentUser = await checkDailyPenalties(currentUser) || currentUser;
        
        // Then Check Streak Bonus
        const streak = await calculateStreak(currentUser.id);
        const lastBonusDate = localStorage.getItem(`last_streak_bonus_${currentUser.id}`);
        const todayStr = getBusinessDate(new Date());
        
        // If streak is multiple of 7 AND we haven't given bonus today
        if (streak > 0 && streak % 7 === 0 && lastBonusDate !== todayStr) {
            // NO RATING BONUS - Just Celebration
            setStreakModalData({days: streak, bonus: 0});
            localStorage.setItem(`last_streak_bonus_${currentUser.id}`, todayStr);
        }

        setUser(currentUser);
        storage.updateUserLocal(currentUser);
      }
      await refreshData();
      setIsInitializing(false);
    };
    init();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (loggedInUser: User) => {
    const updatedUser = await checkDailyPenalties(loggedInUser) || loggedInUser;
    setUser(updatedUser);
    storage.updateUserLocal(updatedUser);
    showToast(`欢迎回来，${updatedUser.name}！`, 'success');
    await refreshData();
  };

  const handleLogout = () => {
    storage.logoutUser();
    setUser(null);
    setActiveTab('dashboard');
    showToast("已退出登录", 'info');
  };

  const handleUpdateUser = (updatedUser: User) => {
      setUser(updatedUser);
  };

  const handleUpdateCheckIn = async (id: string, newContent: string) => {
    setCheckIns(prev => prev.map(c => c.id === id ? { ...c, content: newContent } : c));
    try {
        await storage.updateCheckIn(id, newContent);
        showToast("已更新", 'success');
    } catch (e) {
        showToast("更新失败", 'error');
        refreshData();
    }
  }

  const handleExemptPenalty = async (id: string) => {
    if (!user || user.role !== 'admin') return;
    try {
      const { ratingDelta, newContent } = await storage.exemptPenalty(id);
      
      // Optimistic update
      setCheckIns(prev => prev.map(c => c.id === id ? { ...c, content: newContent, isPenalty: false } : c));
      
      showToast(`已豁免，返还 ${ratingDelta} 分`, 'success');
      await refreshData(); // Force sync to be sure
    } catch (e) {
      console.error(e);
      showToast("操作失败", 'error');
    }
  }

  const handleAddCheckIn = async (newCheckIn: CheckIn) => {
    if (user?.role === 'guest') {
      showToast("访客模式无法发布打卡", 'error');
      return;
    }
    setCheckIns(prev => [newCheckIn, ...prev]);
    try {
      await storage.addCheckIn(newCheckIn);
      showToast(newCheckIn.isLeave ? "请假已提交" : "打卡发布成功！", 'success');
      await refreshData();
    } catch (e) {
      console.error(e);
      showToast("打卡上传失败，请检查网络", 'error');
    }
    if (activeTab === 'english' || activeTab === 'algorithm') {
      setActiveTab('feed');
    }
  };

  const confirmDeleteCheckIn = async () => {
      if (!user || !checkInToDelete) return;
      const id = checkInToDelete;
      setCheckIns(prev => prev.filter(c => c.id !== id));
      
      const isAdmin = user.role === 'admin';
      
      try {
          // If admin, pass true to skip rating reversal
          const ratingDelta = await storage.deleteCheckIn(id, isAdmin);
          
          if (ratingDelta !== 0) {
              const newRating = (user.rating || 1200) + ratingDelta;
              const updatedUser = { ...user, rating: newRating };
              setUser(updatedUser);
              storage.updateUserLocal(updatedUser);
              showToast(`已删除，Rating 已${ratingDelta > 0 ? '恢复' : '扣除'} ${Math.abs(ratingDelta)} 分`, 'info');
          } else {
              showToast("已删除", 'info');
          }
      } catch(e) {
          console.error(e);
          showToast("删除失败，请重试", 'error');
          refreshData(); 
      }
  };

  const handleDeleteCheckInTrigger = (id: string) => {
      if (!user) return;
      if (user.role === 'guest') {
          showToast("访客模式无法删除", 'error');
          return;
      }
      setCheckInToDelete(id);
      setIsDeleteModalOpen(true);
  };

  const handleLike = async (checkInId: string) => {
    if (!user) return;
    if (user.role === 'guest') return; 
    setCheckIns(prev => prev.map(c => {
      if (c.id === checkInId) {
        const isLiked = c.likedBy.includes(user.id);
        const newLikedBy = isLiked ? c.likedBy.filter(id => id !== user.id) : [...c.likedBy, user.id];
        return { ...c, likedBy: newLikedBy };
      }
      return c;
    }));
    await storage.toggleLike(checkInId, user.id);
  };

  const handleAutoCheckIn = (subject: SubjectCategory, content: string, duration?: number, wordCount?: number) => {
    if (!user) return;
    if (user.role === 'guest') {
      showToast("访客模式无法自动打卡", 'error');
      return;
    }
    const newCheckIn: CheckIn = {
      id: Date.now().toString(),
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      userRating: user.rating,
      userRole: user.role,
      subject,
      content,
      duration: duration || 0,
      wordCount: wordCount, 
      timestamp: Date.now(),
      likedBy: []
    };
    handleAddCheckIn(newCheckIn);
  };

  const handleViewUser = async (userId: string) => {
      if (!user) return;
      if (userId === user.id) {
          setVisitedProfileUser(null);
          setActiveTab('profile');
      } else {
          try {
              const u = await storage.getUserById(userId);
              if (u) {
                  setVisitedProfileUser(u);
                  setActiveTab('profile');
              }
          } catch(e) {
              console.error("User not found", e);
          }
      }
  }

  const handleTabChange = (tab: string) => {
      if (tab === 'dashboard') {
          setTargetProfileId(user?.id || null);
      }
      if (tab === 'profile') {
          setVisitedProfileUser(null);
      }
      setActiveTab(tab);
  };

  const handleProfileBack = () => {
      setVisitedProfileUser(null);
  }

  if (isInitializing) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">正在连接数据库...</div>;
  }

  if (!user) {
    return (
        <>
            <Login onLogin={handleLogin} />
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans relative">
      
      {penaltyModalData && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-red-600/95 backdrop-blur-md animate-fade-in text-white p-8 text-center">
              <div className="bg-white/20 p-6 rounded-full mb-6 animate-bounce">
                  {penaltyModalData.type === 'debt' ? <Coffee className="w-16 h-16 text-white" /> : <CalendarOff className="w-16 h-16 text-white" />}
              </div>
              <h2 className="text-3xl font-black mb-2">
                  {penaltyModalData.type === 'debt' ? '偿还失败！' : '目标未达成!'}
              </h2>
              <p className="text-red-100 text-lg mb-8 max-w-md">
                  {penaltyModalData.type === 'debt' 
                    ? `请假后的双倍偿还日 (${penaltyModalData.date}) 未达标，触发重罚机制。`
                    : `考研是一场持久战。昨日 (${penaltyModalData.date}) 学习时长未达标/缺勤。`
                  }
              </p>
              
              <div className="bg-black/20 rounded-2xl p-6 mb-10 w-full max-w-xs border border-white/10">
                  <div className="text-sm text-red-200 uppercase font-bold tracking-widest mb-1">Rating 扣除</div>
                  <div className="text-6xl font-black font-mono">-{penaltyModalData.count}</div>
              </div>

              <div className="flex gap-4">
                  <button onClick={() => setPenaltyModalData(null)} className="bg-white text-red-600 px-8 py-3 rounded-xl font-bold hover:bg-red-50 transition-colors shadow-lg">我已知晓，立即补救</button>
              </div>
          </div>
      )}

      {streakModalData && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900 animate-fade-in text-white p-8 text-center cursor-pointer" onClick={() => setStreakModalData(null)}>
              <Fireworks active={true} onClose={() => setStreakModalData(null)} />
              <div className="relative z-10 flex flex-col items-center">
                  <div className="mb-6 relative">
                      <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-50 rounded-full"></div>
                      <Trophy className="w-24 h-24 text-yellow-300 relative z-10" />
                  </div>
                  <div className="text-yellow-400 font-black text-lg uppercase tracking-[0.3em] mb-2 animate-pulse">Momentum Streak</div>
                  <h2 className="text-5xl md:text-6xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 to-yellow-500 drop-shadow-sm">连续打卡 {streakModalData.days} 天!</h2>
                  <p className="text-indigo-200 text-lg max-w-md leading-relaxed mb-12">
                      {streakModalData.bonus > 0 ? `坚持就是胜利。获得 ${streakModalData.bonus} 分奖励！` : '坚持就是胜利。保持节奏，继续加油！'}
                  </p>
                  <div className="flex items-center gap-2 text-white/50 text-sm animate-bounce"><span>点击任意处关闭</span></div>
              </div>
          </div>
      )}

      <Navigation activeTab={activeTab} onTabChange={handleTabChange} onLogout={handleLogout} currentUser={user} onOpenAdmin={() => setIsAdminModalOpen(true)} />
      
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen relative bg-[#F8F9FA]">
        <div className="max-w-7xl mx-auto">
          <GlobalAlerts user={user} checkIns={checkIns} algoTasks={algoTasks} onNavigate={setActiveTab} />
          {/* Pass handleViewUser to Dashboard as onNavigateToUser */}
          {activeTab === 'dashboard' && <div className="animate-fade-in"><Dashboard checkIns={checkIns} currentUser={user} onUpdateUser={handleUpdateUser} onShowToast={showToast} onUpdateCheckIn={handleUpdateCheckIn} initialSelectedUserId={targetProfileId} onAddCheckIn={handleAddCheckIn} onNavigateToUser={handleViewUser} /></div>}
          {activeTab === 'profile' && <Profile user={visitedProfileUser || user} currentUser={user} checkIns={checkIns} onSearchUser={handleViewUser} onBack={handleProfileBack} onDeleteCheckIn={handleDeleteCheckInTrigger} onUpdateCheckIn={handleUpdateCheckIn} onExemptPenalty={handleExemptPenalty} />}
          {activeTab === 'feed' && <div className="animate-fade-in"><Feed checkIns={checkIns} user={user} onAddCheckIn={handleAddCheckIn} onDeleteCheckIn={handleDeleteCheckInTrigger} onLike={handleLike} onUpdateCheckIn={handleUpdateCheckIn} onViewUserProfile={handleViewUser} onExemptPenalty={handleExemptPenalty} /></div>}
          {activeTab === 'english' && <div className="animate-fade-in"><EnglishTutor user={user} onCheckIn={handleAutoCheckIn} /></div>}
          {activeTab === 'algorithm' && <div className="animate-fade-in"><AlgorithmTutor user={user} onCheckIn={handleAutoCheckIn} onShowToast={showToast} /></div>}
          {activeTab === 'achievements' && <AchievementsHistory user={user} />}
          {activeTab === 'pk' && <PKArena currentUser={user} checkIns={checkIns} />}
          {activeTab === 'about' && <div className="animate-fade-in"><About /></div>}
        </div>
      </main>
      
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={confirmDeleteCheckIn} title="确认删除" message={user.role === 'admin' ? "管理员删除操作不会扣除用户积分，仅移除记录。" : "确定要删除这条打卡记录吗？删除后，该记录产生的 Rating 分数变化将被撤销。"} confirmText="确认删除" type="danger" />
      <AdminUserModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} currentUser={user} onShowToast={showToast} onViewUser={(userId) => { setIsAdminModalOpen(false); handleViewUser(userId); }} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
      `}</style>
    </div>
  );
};

export default App;
