
import React, { useState } from 'react';
import { LayoutDashboard, BookOpen, Users, LogOut, GraduationCap, Cpu, Info, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { User, getUserStyle } from '../types';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  currentUser: User | null;
  onOpenAdmin: () => void;
}

export const Navigation: React.FC<Props> = ({ activeTab, onTabChange, onLogout, currentUser, onOpenAdmin }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { id: 'dashboard', label: '总览', icon: LayoutDashboard }, 
    { id: 'feed', label: '研友圈', icon: Users },
    { id: 'algorithm', label: '算法训练', icon: Cpu },
    { id: 'english', label: 'AI英语', icon: BookOpen },
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
                KaoyanMate
            </h1>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden">
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
              
              {!isCollapsed && (
                  <span className="whitespace-nowrap transition-opacity duration-200">
                      {item.label}
                  </span>
              )}

              {/* Tooltip for collapsed mode */}
              {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      {item.label}
                  </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 space-y-2">
        {/* User Info Widget (Visible only when expanded) */}
        {!isCollapsed && currentUser && (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 mb-2">
                <div className={`text-sm font-bold truncate ${getUserStyle(currentUser.role, currentUser.rating)}`}>
                    {currentUser.name}
                </div>
                <div className="text-xs text-gray-400 mt-1 font-mono font-medium flex justify-between items-center">
                    <span>Rating:</span>
                    <span className="text-gray-600">{currentUser.rating ?? 1200}</span>
                </div>
            </div>
        )}

        {currentUser?.role === 'admin' && (
            <button 
                onClick={onOpenAdmin}
                title={isCollapsed ? '后台管理' : ''}
                className={`flex items-center rounded-xl px-4 py-2 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 w-full transition-colors ${
                    isCollapsed ? 'justify-center' : 'space-x-3'
                }`}
            >
                <Shield className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="text-sm font-bold">后台管理</span>}
            </button>
        )}

        <button 
          onClick={onLogout}
          title={isCollapsed ? '退出登录' : ''}
          className={`flex items-center rounded-xl px-4 py-2 text-gray-400 hover:text-red-500 w-full transition-colors ${
              isCollapsed ? 'justify-center' : 'space-x-3'
          }`}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="text-sm">退出登录</span>}
        </button>
      </div>
    </div>
  );
};
