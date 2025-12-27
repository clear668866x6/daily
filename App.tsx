
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
import { getBusinessDate, getPreviousBusinessDate } from './utils/dateUtils';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('kaoyan_active_tab') || 'dashboard');
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('kaoyan_sidebar_collapsed') === 'true');
  const [user, setUser] = useState<User | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [algoTasks, setAlgoTasks] = useState<AlgorithmTask[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [checkInToDelete, setCheckInToDelete] = useState<string | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Date.now().toString() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const refreshData = async () => {
    try {
      const [fetchedCheckIns, fetchedTasks] = await Promise.all([
        storage.getCheckIns(),
        storage.getAlgorithmTasks()
      ]);
      setCheckIns(fetchedCheckIns);
      setAlgoTasks(fetchedTasks);
      
      // 用户状态同步
      if (user && user.role !== 'guest') {
         const freshUser = await storage.getUserById(user.id);
         if (freshUser && freshUser.rating !== user.rating) {
             const mergedUser = { ...user, rating: freshUser.rating };
             setUser(mergedUser);
             storage.updateUserLocal(mergedUser);
         }
      }
    } catch (e) { console.error(e); }
  };

  // 每日自动化稽核 ( Rating 惩罚逻辑 )
  const runDailyAudit = async (currentUser: User, allCheckIns: CheckIn[]) => {
      if (currentUser.role === 'guest') return;
      
      const todayBusinessDate = getBusinessDate(Date.now());
      const lastAuditDate = localStorage.getItem(`last_audit_${currentUser.id}`);
      
      // 如果今天还没稽核过
      if (lastAuditDate !== todayBusinessDate) {
          const yesterdayBusinessDate = getPreviousBusinessDate(Date.now());
          
          // 计算昨天的总学习时长
          const yesterdayCheckIns = allCheckIns.filter(c => 
              c.userId === currentUser.id && 
              getBusinessDate(c.timestamp) === yesterdayBusinessDate &&
              !c.isPenalty
          );
          
          const totalDuration = yesterdayCheckIns.reduce((acc, curr) => acc + (curr.duration || 0), 0);
          const targetDuration = parseInt(localStorage.getItem(`study_target_${currentUser.id}`) || '60');
          
          let penalty = 0;
          let reason = "";

          if (yesterdayCheckIns.length === 0) {
              penalty = -15;
              reason = `昨日(${yesterdayBusinessDate})未打卡惩罚`;
          } else if (totalDuration < targetDuration) {
              penalty = -10;
              reason = `昨日(${yesterdayBusinessDate})学习时长未达标(${totalDuration}/${targetDuration}min)`;
          }

          if (penalty !== 0) {
              const newRating = (currentUser.rating || 1200) + penalty;
              await storage.updateRating(currentUser.id, newRating, reason);
              showToast(`${reason}，Rating ${penalty}`, 'error');
              
              // 更新本地状态
              const updatedUser = { ...currentUser, rating: newRating };
              setUser(updatedUser);
              storage.updateUserLocal(updatedUser);
          }

          localStorage.setItem(`last_audit_${currentUser.id}`, todayBusinessDate);
      }
  };

  useEffect(() => {
    const init = async () => {
      const currentUser = storage.getCurrentUser();
      if (currentUser) setUser(currentUser);
      
      const fetchedCheckIns = await storage.getCheckIns();
      const fetchedTasks = await storage.getAlgorithmTasks();
      setCheckIns(fetchedCheckIns);
      setAlgoTasks(fetchedTasks);
      
      if (currentUser) {
          await runDailyAudit(currentUser, fetchedCheckIns);
      }
      
      setIsInitializing(false);
    };
    init();
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, []);

  // 监听导航
  useEffect(() => { localStorage.setItem('kaoyan_active_tab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('kaoyan_sidebar_collapsed', String(isCollapsed)); }, [isCollapsed]);

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    showToast(`上岸在望，${loggedInUser.name}！`, 'success');
    const fetched = await storage.getCheckIns();
    setCheckIns(fetched);
    await runDailyAudit(loggedInUser, fetched);
  };

  const handleLogout = () => {
    storage.logoutUser(); setUser(null); setActiveTab('dashboard');
    showToast("已安全退出", 'info');
  };

  const handleAddCheckIn = async (newCheckIn: CheckIn) => {
    if (user?.role === 'guest') return;
    setCheckIns(prev => [newCheckIn, ...prev]);
    try {
      await storage.addCheckIn(newCheckIn);
      if (newCheckIn.userId === user?.id) {
          const fresh = await storage.getUserById(user.id);
          if (fresh) {
              setUser(fresh);
              storage.updateUserLocal(fresh);
          }
      }
      showToast("打卡成功，Rating 已同步！", 'success');
    } catch (e) { showToast("发布失败，请检查网络", 'error'); }
    if (activeTab === 'english' || activeTab === 'algorithm') setActiveTab('feed');
  };

  const confirmDeleteCheckIn = async () => {
      if (!user || !checkInToDelete) return;
      try {
          const ratingDelta = await storage.deleteCheckIn(checkInToDelete);
          setCheckIns(prev => prev.filter(c => c.id !== checkInToDelete));
          if (ratingDelta !== 0) {
              const fresh = await storage.getUserById(user.id);
              if (fresh) { setUser(fresh); storage.updateUserLocal(fresh); }
              showToast(`记录已撤销，Rating 变动：${ratingDelta > 0 ? '+' : ''}${ratingDelta}`, 'info');
          }
      } catch(e) { showToast("删除失败", 'error'); }
  };

  const handleLike = async (id: string) => {
    if (!user || user.role === 'guest') return;
    setCheckIns(prev => prev.map(c => c.id === id ? { ...c, likedBy: c.likedBy.includes(user.id) ? c.likedBy.filter(u => u !== user.id) : [...c.likedBy, user.id] } : c));
    await storage.toggleLike(id, user.id);
  };

  const handleAutoCheckIn = async (subject: SubjectCategory, content: string, duration?: number) => {
    if (!user || user.role === 'guest') return;
    const dur = duration || 0;
    const ratingChange = Math.floor(dur / 10) + 1;
    const newRating = (user.rating || 1200) + ratingChange;
    const newCheckIn: CheckIn = { 
        id: Date.now().toString(), 
        userId: user.id, 
        userName: user.name, 
        userAvatar: user.avatar, 
        userRating: newRating, 
        userRole: user.role, 
        subject, 
        content, 
        duration: dur, 
        timestamp: Date.now(), 
        likedBy: [] 
    };
    
    await storage.updateRating(user.id, newRating, `系统打卡: ${subject}`);
    handleAddCheckIn(newCheckIn);
  };

  if (isInitializing) return <div className="min-h-screen flex items-center justify-center bg-gray-50 font-black text-brand-600 animate-pulse">KaoyanMate Loading...</div>;
  if (!user) return <><Login onLogin={handleLogin} /><ToastContainer toasts={toasts} onDismiss={dismissToast} /></>;

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans overflow-x-hidden">
      <Navigation 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onLogout={handleLogout} 
        currentUser={user} 
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      
      <main className={`flex-1 transition-all duration-300 ${isCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'}`}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <GlobalAlerts user={user} checkIns={checkIns} algoTasks={algoTasks} onNavigate={setActiveTab} />
          <div className="animate-fade-in">
            {activeTab === 'dashboard' && <Dashboard checkIns={checkIns} currentUser={user} onUpdateUser={setUser} onShowToast={showToast} />}
            {activeTab === 'feed' && <Feed checkIns={checkIns} user={user} onAddCheckIn={handleAddCheckIn} onDeleteCheckIn={id => { setCheckInToDelete(id); setIsDeleteModalOpen(true); }} onLike={handleLike} />}
            {activeTab === 'english' && <EnglishTutor user={user} onCheckIn={handleAutoCheckIn} />}
            {activeTab === 'algorithm' && <AlgorithmTutor user={user} onCheckIn={handleAutoCheckIn} onShowToast={showToast} />}
            {activeTab === 'about' && <About />}
          </div>
        </div>
      </main>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={confirmDeleteCheckIn} title="确认删除" message="确定要删除这条打卡记录吗？Rating 变动将自动撤销。" confirmText="确认删除" type="danger" />
      <AdminUserModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} currentUser={user} onShowToast={showToast} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
      `}</style>
    </div>
  );
};

export default App;
