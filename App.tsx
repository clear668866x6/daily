import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { Feed } from './components/Feed';
import { EnglishTutor } from './components/EnglishTutor';
import { CheckIn, SubjectCategory, User } from './types';
import * as storage from './services/storageService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);

  useEffect(() => {
    // Load initial data
    setUser(storage.getCurrentUser());
    setCheckIns(storage.getCheckIns());
  }, []);

  const handleAddCheckIn = (newCheckIn: CheckIn) => {
    const updated = storage.addCheckIn(newCheckIn);
    setCheckIns(updated);
    // If check-in happens in English Tutor, optionally switch to feed to see it
    if (activeTab === 'english') {
      setActiveTab('feed');
    }
  };

  const handleLike = (id: string) => {
    const updated = storage.toggleLike(id);
    setCheckIns(updated);
  };

  const handleEnglishCheckIn = (subject: SubjectCategory, content: string) => {
    if (!user) return;
    const newCheckIn: CheckIn = {
      id: Date.now().toString(),
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      subject,
      content,
      timestamp: Date.now(),
      likes: 0
    };
    handleAddCheckIn(newCheckIn);
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">欢迎回来，{user.name} 👋</h1>
                <p className="text-gray-500">距离考研还有一段时间，今天也要加油！</p>
              </div>
              <Dashboard checkIns={checkIns} currentUserId={user.id} />
            </div>
          )}

          {activeTab === 'feed' && (
            <div className="animate-fade-in">
              <div className="mb-6 text-center md:text-left">
                <h1 className="text-2xl font-bold text-gray-900">研友圈</h1>
                <p className="text-gray-500">看看大家都在卷什么</p>
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
              <EnglishTutor onCheckIn={handleEnglishCheckIn} />
            </div>
          )}
        </div>
      </main>

      {/* Mobile styles adjustment helper */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default App;