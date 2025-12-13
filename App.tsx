
import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { Feed } from './components/Feed';
import { EnglishTutor } from './components/EnglishTutor';
import { AlgorithmTutor } from './components/AlgorithmTutor';
import { About } from './components/About';
import { Login } from './components/Login';
import { CheckIn, SubjectCategory, User } from './types';
import * as storage from './services/storageService';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Date.now().toString() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const refreshData = async () => {
    try {
      const data = await storage.getCheckIns();
      const mappedData: CheckIn[] = data.map((item: any) => ({
        id: item.id,
        userId: item.user_id,
        userName: item.user_name,
        userAvatar: item.user_avatar,
        userRating: item.user_rating, 
        userRole: item.user_role, 
        subject: item.subject,
        content: item.content,
        imageUrl: item.image_url,
        duration: item.duration,
        isPenalty: item.is_penalty, // 映射数据库字段
        timestamp: item.timestamp,
        likedBy: item.liked_by || []
      }));
      setCheckIns(mappedData);
    } catch (e) {
      console.error("Failed to load checkins", e);
      // Optional: showToast("数据加载失败", 'error'); 
    }
  };

  useEffect(() => {
    const init = async () => {
      const currentUser = storage.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
      await refreshData();
      setIsInitializing(false);
    };
    init();

    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    showToast(`欢迎回来，${loggedInUser.name}！`, 'success');
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
    } catch (e) {
      showToast("打卡上传失败，请检查网络", 'error');
    }

    if (activeTab === 'english' || activeTab === 'algorithm') {
      setActiveTab('feed');
    }
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

  const handleAutoCheckIn = (subject: SubjectCategory, content: string) => {
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
      timestamp: Date.now(),
      likedBy: []
    };
    handleAddCheckIn(newCheckIn);
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
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      <Navigation 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onLogout={handleLogout}
      />
      
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen relative">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="animate-fade-in">
              <div className="mb-6 flex justify-between items-end">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    欢迎回来，{user.name} {user.role === 'guest' && '(访客)'} 👋
                  </h1>
                  <p className="text-gray-500">距离考研还有一段时间，今天也要加油！</p>
                </div>
                <button onClick={refreshData} className="text-sm text-brand-600 hover:underline">
                  刷新数据
                </button>
              </div>
              <Dashboard 
                checkIns={checkIns} 
                currentUser={user} 
                onUpdateUser={handleUpdateUser} 
                onShowToast={showToast}
              />
            </div>
          )}

          {activeTab === 'feed' && (
            <div className="animate-fade-in">
              <div className="mb-6 text-center md:text-left flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">研友圈</h1>
                  <p className="text-gray-500">看看大家都在卷什么</p>
                </div>
                <div className="text-xs text-gray-400">自动同步中...</div>
              </div>
              <Feed 
                checkIns={checkIns} 
                user={user} 
                onAddCheckIn={handleAddCheckIn}
                onLike={handleLike}
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
                <h1 className="text-2xl font-bold text-gray-900">算法训练营</h1>
                <p className="text-gray-500">每日精选算法题，AC 才是硬道理</p>
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
          animation: fade-in 0.3s ease-out forwards;
        }
        .animate-slide-in {
            animation: slide-in 0.3s cubic-bezier(0.2, 0, 0.2, 1) forwards;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
      `}</style>
    </div>
  );
};

export default App;
