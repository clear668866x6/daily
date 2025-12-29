
import React, { useState } from 'react';
import { LayoutDashboard, BookOpen, Users, LogOut, GraduationCap, Cpu, Info, ChevronLeft, ChevronRight, Shield, UserCircle, Award, Swords } from 'lucide-react';
import { User, getUserStyle } from '../types';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  currentUser: User | null;
  onOpenAdmin: () => void;
}

export const Navigation: React.FC<Props> = ({ activeTab, onTabChange, onLogout, currentUser, onOpenAdmin }) => {
  // Default to collapsed
  const [isCollapsed, setIsCollapsed] = useState(true);

  const navItems = [
    { id: 'dashboard', label: '打卡首页', icon: LayoutDashboard }, 
    { id: 'profile', label: '我的主页', icon: UserCircle }, 
    { id: 'feed', label: '研友圈', icon: Users },
    { id: 'algorithm', label: '算法训练', icon: Cpu },
    { id: 'english', label: 'AI英语', icon: BookOpen },
    { id: 'achievements', label: '成就历史', icon: Award }, 
    { id: 'pk', label: 'PK竞技', icon: Swords }, 
    { id: 'about', label: '关于', icon: Info },
  ];

  return (
    <div 
        className={`bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out relative z-30 ${
            isCollapsed ? 'w-20' : 'w-full md:w-64'
        }`}
    >
      {/* Collapse Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 bg-white border border-gray-200 rounded-full p-1 shadow-md text-gray-500 hover:text-brand-600 hidden md:block"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Header */}
      <div className={`p-6 flex items-center border-b border-gray-100 ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
        <div className="bg-brand-600 p-2 rounded-lg shrink-0">
          <GraduationCap className="text-white w-6 h-6" />
        </div>
        {!isCollapsed && (
            <h1 className="text-xl font-bold text-gray-800 truncate transition-opacity duration-300">
                KYtracker
            </h1>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={isCollapsed ? item.label : ''}
              className={`w-full flex items-center rounded-xl transition-all duration-200 group relative ${
                isCollapsed ? 'justify-center px-2 py-3' : 'space-x-3 px-4 py-3'
              } ${
                isActive 
                  ? 'bg-brand-50 text-brand-600 font-medium shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
              {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              {isCollapsed && isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-600 rounded-r-full"></div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / User Info */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        {currentUser && (
            <div className={`flex items-center mb-4 ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
                <img 
                    src={currentUser.avatar} 
                    alt={currentUser.name} 
                    className="w-9 h-9 rounded-full bg-gray-200 border border-white shadow-sm"
                />
                {!isCollapsed && (
                    <div className="overflow-hidden">
                        <div className={`text-sm font-bold truncate ${getUserStyle(currentUser.role, currentUser.rating)}`}>{currentUser.name}</div>
                        <div className="text-xs text-gray-400 truncate">Rating: {currentUser.rating || 1200}</div>
                    </div>
                )}
            </div>
        )}
        
        <div className={`flex gap-2 ${isCollapsed ? 'flex-col items-center' : ''}`}>
             {currentUser?.role === 'admin' && (
                <button 
                    onClick={onOpenAdmin}
                    className={`flex items-center justify-center p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors flex-1 border border-indigo-100 ${isCollapsed ? 'w-full' : ''}`}
                    title="管理后台"
                >
                    <Shield className="w-5 h-5" />
                    {!isCollapsed && <span className="ml-2 text-xs font-bold">后台</span>}
                </button>
             )}
            <button 
                onClick={onLogout}
                className={`flex items-center justify-center p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors flex-1 border border-transparent hover:border-red-100 ${isCollapsed ? 'w-full' : ''}`}
                title="退出登录"
            >
                <LogOut className="w-5 h-5" />
                {!isCollapsed && <span className="ml-2 text-xs font-bold">退出</span>}
            </button>
        </div>
      </div>
    </div>
  );
};