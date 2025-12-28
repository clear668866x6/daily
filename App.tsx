
import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { Feed } from './components/Feed';
import { EnglishTutor } from './components/EnglishTutor';
import { AlgorithmTutor } from './components/AlgorithmTutor';
import { About } from './components/About';
import { Login } from './components/Login';
import { GlobalAlerts } from './components/GlobalAlerts';
import { Modal } from './components/Modal'; 
import { AdminUserModal } from './components/AdminUserModal'; 
import { CheckIn, SubjectCategory, User, AlgorithmTask } from './types';
import * as storage from './services/storageService';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { Fireworks } from './components/Fireworks'; // Import Fireworks
import { X, CalendarOff, Flame, Trophy } from 'lucide-react'; // Icons

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('kaoyan_active_tab') || 'dashboard');
  
  const [user, setUser] = useState<User | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [algoTasks, setAlgoTasks] = useState<AlgorithmTask[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [checkInToDelete, setCheckInToDelete] = useState<string | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Dashboard Target User (for Admin View)
  const [dashboardTargetId, setDashboardTargetId] = useState<string | null>(null);

  // New Full Screen Modals State
  const [penaltyModalData, setPenaltyModalData] = useState<{count: number, date: string} | null>(null);
  const [streakModalData, setStreakModalData] = useState<number | null>(null);

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
         if (freshUser && freshUser.rating !== user.rating) {
             const mergedUser = { ...user, rating: freshUser.rating };
             setUser(mergedUser);
             storage.updateUserLocal(mergedUser);
         }
      }

    } catch (e) {
      console.error("Failed to load data", e);
    }
  };

  // Helper: Get the "Business Day" date string (Switch over at 4:00 AM)
  const getBusinessDate = (date: Date): string => {
      const adjustedDate = new Date(date);
      // If before 4 AM, count as previous day
      if (adjustedDate.getHours() < 4) {
          adjustedDate.setDate(adjustedDate.getDate() - 1);
      }
      return adjustedDate.toISOString().split('T')[0];
  };

  // Helper: Calculate Streak
  const calculateStreak = async (userId: string): Promise<number> => {
      const userCheckIns = await storage.getUserCheckIns(userId);
      // Filter out penalties
      const validDates = userCheckIns
          .filter(c => !c.isPenalty)
          .map(c => getBusinessDate(new Date(c.timestamp)));
      
      const uniqueDates = Array.from(new Set(validDates)).sort().reverse();
      
      if (uniqueDates.length === 0) return 0;

      const today = getBusinessDate(new Date());
      // Logic: If the latest check-in is today or yesterday (since today might not be over), start counting
      // If latest is older than yesterday, streak is broken (0).
      
      const latest = uniqueDates[0];
      const yesterday = new Date();
      if (yesterday.getHours() < 4) yesterday.setDate(yesterday.getDate() - 2);
      else yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (latest !== today && latest !== yesterdayStr) {
          return 0; 
      }

      let streak = 1;
      // Start checking from the gap between 0 and 1
      for (let i = 0; i < uniqueDates.length - 1; i++) {
          const curr = new Date(uniqueDates[i]);
          const prev = new Date(uniqueDates[i+1]);
          const diffTime = Math.abs(curr.getTime() - prev.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          
          if (diffDays === 1) {
              streak++;
          } else {
              break;
          }
      }
      return streak;
  };

  const checkDailyPenalties = async (currentUser: User) => {
      if (currentUser.role === 'guest') return currentUser;
      
      // ADMIN IMMUNITY: Admins do not get penalties
      if (currentUser.role === 'admin') return currentUser;

      const lastCheckedDate = localStorage.getItem(`last_penalty_check_${currentUser.id}`);
      
      // Safety: Only check penalties if it's past 4:05 AM to avoid race conditions with midnight logic
      const now = new Date();
      if (now.getHours() < 4) return currentUser;

      const todayBusinessDate = getBusinessDate(now);

      // If we haven't checked for today's logical date yet
      // Note: "Today's Business Day" checking actually means verifying "Yesterday" was completed.
      // We run this once per Business Day (e.g., sometime on Dec 15 after 4am).
      if (lastCheckedDate && lastCheckedDate !== todayBusinessDate) {
          
          // Determine the "Yesterday Business Day"
          const yesterday = new Date();
          if (yesterday.getHours() < 4) {
             yesterday.setDate(yesterday.getDate() - 2); 
          } else {
             yesterday.setDate(yesterday.getDate() - 1);
          }
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          
          // Only run if the last check was strictly before yesterday (avoid double penalty)
          if (lastCheckedDate < yesterdayStr || lastCheckedDate === yesterdayStr) { 
              console.log(`Running Penalty Check for Business Day: ${yesterdayStr}...`);
              
              const userCheckIns = await storage.getUserCheckIns(currentUser.id);
              const hasCheckInYesterday = userCheckIns.some(c => {
                  const cDate = new Date(c.timestamp);
                  const cBusinessDate = getBusinessDate(cDate);
                  return cBusinessDate === yesterdayStr && !c.isPenalty;
              });

              // Penalty 1: No check-in at all
              if (!hasCheckInYesterday) {
                  const penaltyRating = -50;
                  const newRating = (currentUser.rating || 1200) + penaltyRating;
                  
                  // Update Rating
                  await storage.updateRating(currentUser.id, newRating, `缺勤惩罚 (${yesterdayStr})`);
                  
                  // Track cumulative missed count locally
                  const missedKey = `kaoyan_missed_count_${currentUser.id}`;
                  const currentMissed = parseInt(localStorage.getItem(missedKey) || '0') + 1;
                  localStorage.setItem(missedKey, currentMissed.toString());

                  // Show Full Screen Alert
                  setPenaltyModalData({ count: currentMissed, date: yesterdayStr });
                  
                  // Update local user object immediately
                  currentUser.rating = newRating; 
              }

              // Penalty 2: Algorithm Task Missed
              const tasks = await storage.getAlgorithmTasks();
              const taskYesterday = tasks.find(t => t.date === yesterdayStr);
              
              // New Logic: Only penalize if assigned explicitly
              if (taskYesterday) {
                  // If assignedTo is missing or empty, assume it's optional or open to all (no penalty for now based on request "if not selected, don't count")
                  // Logic: If assignedTo exists AND includes current user ID -> Mandatory.
                  const isAssignedToUser = taskYesterday.assignedTo && taskYesterday.assignedTo.includes(currentUser.id);

                  if (isAssignedToUser) {
                      const subs = storage.getAlgorithmSubmissions(currentUser.id);
                      const isDone = subs.some(s => s.taskId === taskYesterday.id && s.status === 'Passed');
                      
                      if (!isDone) {
                           const algoPenalty = -20;
                           const newAlgoRating = (currentUser.rating || 1200) + algoPenalty;
                           await storage.updateRating(currentUser.id, newAlgoRating, `算法未完成 (${yesterdayStr})`);
                           currentUser.rating = newAlgoRating;
                      }
                  }
              }
          }
      }

      // Update the check date to today
      localStorage.setItem(`last_penalty_check_${currentUser.id}`, todayBusinessDate);
      return currentUser;
  };

  useEffect(() => {
    const init = async () => {
      let currentUser = storage.getCurrentUser();
      
      if (currentUser) {
        // Run Penalty Check logic on load
        currentUser = await checkDailyPenalties(currentUser) || currentUser;
        setUser(currentUser);
        // Sync back to local storage in case rating changed
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
    // Check penalties immediately on login
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

  const handleAddCheckIn = async (newCheckIn: CheckIn) => {
    if (user?.role === 'guest') {
      showToast("访客模式无法发布打卡", 'error');
      return;
    }
    setCheckIns(prev => [newCheckIn, ...prev]);
    try {
      await storage.addCheckIn(newCheckIn);
      showToast("打卡发布成功！", 'success');
      await refreshData();

      // Check for Streak Achievements
      // Need a small delay or refetch to ensure the calculation includes the just-added one
      // Since we added it to local state `prev => [newCheckIn, ...prev]`, local calc might miss it if we rely on storage
      // Let's rely on calculating manually or waiting a bit.
      // Better: Update calculation to include the new one implicitly or fetch fresh.
      setTimeout(async () => {
          const streak = await calculateStreak(user.id);
          // Trigger on multiples of 7
          if (streak > 0 && streak % 7 === 0) {
              setStreakModalData(streak);
          }
      }, 500);

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
      
      // Optimistic update
      setCheckIns(prev => prev.filter(c => c.id !== id));

      try {
          const ratingDelta = await storage.deleteCheckIn(id);
          
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
          refreshData(); // Revert
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
        const newLikedBy = isLiked 
          ? c.likedBy.filter(id => id !== user.id)
          : [...c.likedBy, user.id];
        return { ...c, likedBy: newLikedBy };
      }
      return c;
    }));

    await storage.toggleLike(checkInId, user.id);
  };

  const handleAutoCheckIn = (subject: SubjectCategory, content: string, duration?: number) => {
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
      timestamp: Date.now(),
      likedBy: []
    };
    handleAddCheckIn(newCheckIn);
  };

  const handleAdminViewUser = (userId: string) => {
      setIsAdminModalOpen(false);
      setDashboardTargetId(userId);
      setActiveTab('dashboard');
  };

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
      
      {/* --- Full Screen Penalty Modal --- */}
      {penaltyModalData && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-red-600/95 backdrop-blur-md animate-fade-in text-white p-8 text-center">
              <div className="bg-white/20 p-6 rounded-full mb-6 animate-bounce">
                  <CalendarOff className="w-16 h-16 text-white" />
              </div>
              <h2 className="text-3xl font-black mb-2">昨日未打卡!</h2>
              <p className="text-red-100 text-lg mb-8 max-w-md">
                  考研是一场持久战，请坚持下去。<br/>
                  昨日 ({penaltyModalData.date}) 未检测到打卡记录。
              </p>
              
              <div className="bg-black/20 rounded-2xl p-6 mb-10 w-full max-w-xs border border-white/10">
                  <div className="text-sm text-red-200 uppercase font-bold tracking-widest mb-1">累计缺勤</div>
                  <div className="text-6xl font-black font-mono">{penaltyModalData.count} <span className="text-lg">次</span></div>
              </div>

              <div className="flex gap-4">
                  <button 
                    onClick={() => setPenaltyModalData(null)}
                    className="bg-white text-red-600 px-8 py-3 rounded-xl font-bold hover:bg-red-50 transition-colors shadow-lg"
                  >
                      我已知晓，立即补救
                  </button>
              </div>
          </div>
      )}

      {/* --- Full Screen Streak Achievement Modal --- */}
      {streakModalData && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900 animate-fade-in text-white p-8 text-center cursor-pointer" onClick={() => setStreakModalData(null)}>
              <Fireworks active={true} onClose={() => setStreakModalData(null)} />
              
              <div className="relative z-10 flex flex-col items-center">
                  <div className="mb-6 relative">
                      <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-50 rounded-full"></div>
                      <Trophy className="w-24 h-24 text-yellow-300 relative z-10" />
                  </div>
                  
                  <div className="text-yellow-400 font-black text-lg uppercase tracking-[0.3em] mb-2 animate-pulse">Momentum Streak</div>
                  <h2 className="text-5xl md:text-6xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 to-yellow-500 drop-shadow-sm">
                      连续打卡 {streakModalData} 天!
                  </h2>
                  
                  <p className="text-indigo-200 text-lg max-w-md leading-relaxed mb-12">
                      坚持就是胜利。保持这个节奏，上岸指日可待！
                  </p>

                  <div className="flex items-center gap-2 text-white/50 text-sm animate-bounce">
                      <span>点击任意处关闭</span>
                  </div>
              </div>
          </div>
      )}

      <Navigation 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onLogout={handleLogout}
        currentUser={user}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
      />
      
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen relative bg-[#F8F9FA]">
        <div className="max-w-7xl mx-auto">
          
          <GlobalAlerts 
            user={user} 
            checkIns={checkIns} 
            algoTasks={algoTasks} 
            onNavigate={setActiveTab} 
          />

          {activeTab === 'dashboard' && (
            <div className="animate-fade-in">
              <div className="mb-6 flex justify-between items-end">
                <div>
                  <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                    早安，{user.name} {user.role === 'guest' && '(访客)'} 👋
                  </h1>
                  <p className="text-gray-500 font-medium text-sm mt-1">距离考研还有一段时间，今天也要加油！</p>
                </div>
                <button onClick={refreshData} className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-gray-500 hover:text-brand-600 hover:border-brand-200 transition-all font-bold shadow-sm">
                  刷新数据
                </button>
              </div>
              <Dashboard 
                checkIns={checkIns} 
                currentUser={user} 
                onUpdateUser={handleUpdateUser} 
                onShowToast={showToast}
                onUpdateCheckIn={handleUpdateCheckIn}
                initialSelectedUserId={dashboardTargetId}
              />
            </div>
          )}

          {activeTab === 'feed' && (
            <div className="animate-fade-in">
              <div className="mb-6 text-center md:text-left flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-black text-gray-900 tracking-tight">研友圈</h1>
                  <p className="text-gray-500 font-medium text-sm mt-1">看看大家都在卷什么</p>
                </div>
                <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">自动同步</div>
              </div>
              <Feed 
                checkIns={checkIns} 
                user={user} 
                onAddCheckIn={handleAddCheckIn}
                onDeleteCheckIn={handleDeleteCheckInTrigger}
                onLike={handleLike}
                onUpdateCheckIn={handleUpdateCheckIn}
              />
            </div>
          )}

          {activeTab === 'english' && (
            <div className="animate-fade-in">
              <EnglishTutor user={user} onCheckIn={handleAutoCheckIn} />
            </div>
          )}

          {activeTab === 'algorithm' && (
            <div className="animate-fade-in">
               <div className="mb-6">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">算法训练营</h1>
                <p className="text-gray-500 font-medium text-sm mt-1">每日精选算法题，AC 才是硬道理</p>
              </div>
              <AlgorithmTutor 
                user={user} 
                onCheckIn={handleAutoCheckIn} 
                onShowToast={showToast}
              />
            </div>
          )}

          {activeTab === 'about' && (
             <div className="animate-fade-in">
               <About />
             </div>
          )}
        </div>
      </main>
      
      <Modal 
          isOpen={isDeleteModalOpen} 
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={confirmDeleteCheckIn}
          title="确认删除"
          message="确定要删除这条打卡记录吗？删除后，该记录产生的 Rating 分数变化将被撤销（加分会被扣除，扣分会被返还）。"
          confirmText="确认删除"
          type="danger"
      />

      <AdminUserModal 
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          currentUser={user}
          onShowToast={showToast}
          onViewUser={handleAdminViewUser}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }
        .animate-slide-in {
            animation: slide-in 0.3s cubic-bezier(0.2, 0, 0.2, 1) forwards;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
      `}</style>
    </div>
  );
};

export default App;
