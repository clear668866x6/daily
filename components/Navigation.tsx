
import React from 'react';
import { LayoutDashboard, BookOpen, Users, LogOut, GraduationCap, Cpu } from 'lucide-react';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

export const Navigation: React.FC<Props> = ({ activeTab, onTabChange, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: '总览', icon: LayoutDashboard }, // Renamed
    { id: 'feed', label: '研友圈', icon: Users },
    { id: 'algorithm', label: '算法训练', icon: Cpu },
    { id: 'english', label: 'AI英语', icon: BookOpen },
  ];

  return (
    <div className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center space-x-3 border-b border-gray-100">
        <div className="bg-brand-600 p-2 rounded-lg">
          <GraduationCap className="text-white w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-gray-800">KaoyanMate</h1>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-brand-50 text-brand-600 font-medium shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-brand-600' : 'text-gray-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button 
          onClick={onLogout}
          className="flex items-center space-x-3 px-4 py-2 text-gray-400 hover:text-red-500 w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm">退出登录</span>
        </button>
      </div>
    </div>
  );
};
