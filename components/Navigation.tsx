
import React, { useState } from 'react';
import { LayoutDashboard, BookOpen, Users, LogOut, GraduationCap, Cpu, Info, Shield, Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { User } from '../types';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  currentUser: User | null;
  onOpenAdmin: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
}

export const Navigation: React.FC<Props> = ({ 
  activeTab, 
  onTabChange, 
  onLogout, 
  currentUser, 
  onOpenAdmin,
  isCollapsed,
  setIsCollapsed
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: '总览', icon: LayoutDashboard }, 
    { id: 'feed', label: '研友圈', icon: Users },
    { id: 'algorithm', label: '算法训练', icon: Cpu },
    { id: 'english', label: 'AI英语', icon: BookOpen },
    { id: 'about', label: '关于', icon: Info },
  ];

  const sidebarContent = (
    <div className={`flex flex-col h-full bg-white border-r border-gray-100 transition-all duration-300 shadow-sm relative ${isCollapsed ? 'w-20' : 'w-64'}`}>
      
      {/* 折叠切换图标 - 在角落 */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 bg-white border border-gray-100 rounded-full p-1 shadow-sm text-gray-400 hover:text-brand-600 hover:shadow-md transition-all z-50 hidden md:flex items-center justify-center"
      >
        {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </button>

      <div className={`flex items-center gap-3 mb-10 px-6 pt-8 group cursor-pointer overflow-hidden ${isCollapsed ? 'justify-center' : ''}`} onClick={() => onTabChange('dashboard')}>
        <div className="bg-brand-600 p-2 rounded-xl shadow-lg shadow-brand-100 shrink-0 group-hover:rotate-12 transition-transform">
          <GraduationCap className="text-white w-6 h-6" />
        </div>
        {!isCollapsed && (
          <div className="animate-fade-in whitespace-nowrap">
            <h1 className="text-xl font-black text-gray-800 tracking-tight">KaoyanMate</h1>
            <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Success Journey</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                setIsMobileOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all relative group ${
                isActive 
                  ? 'bg-brand-600 text-white shadow-xl shadow-brand-100' 
                  : 'text-gray-400 hover:bg-brand-50 hover:text-brand-600'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
              title={isCollapsed ? item.label : ''}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'group-hover:scale-110 transition-transform'}`} />
              {!isCollapsed && <span className="animate-fade-in">{item.label}</span>}
              {!isCollapsed && isActive && <div className="absolute right-3 w-1.5 h-1.5 bg-white rounded-full"></div>}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-8 mt-8 space-y-4">
        <div className={`flex items-center gap-3 mb-6 p-2 rounded-2xl bg-gray-50/50 ${isCollapsed ? 'justify-center' : ''}`}>
            <img src={currentUser?.avatar} className="w-10 h-10 rounded-full border-2 border-white shadow-sm shrink-0" alt="Avatar" />
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-fade-in">
                  <p className="text-sm font-black text-gray-800 truncate">{currentUser?.name}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{currentUser?.role}</p>
              </div>
            )}
            {!isCollapsed && currentUser?.role === 'admin' && (
                <button onClick={onOpenAdmin} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all" title="管理后台">
                    <Shield className="w-5 h-5" />
                </button>
            )}
        </div>

        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all group ${isCollapsed ? 'justify-center' : ''}`}
        >
          <LogOut className={`w-5 h-5 group-hover:translate-x-1 transition-transform shrink-0`} />
          {!isCollapsed && <span className="animate-fade-in">退出登录</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:block fixed h-screen z-50">
        {sidebarContent}
      </div>
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-2">
          <GraduationCap className="text-brand-600 w-6 h-6" />
          <span className="font-black text-gray-800">KaoyanMate</span>
        </div>
        <button onClick={() => setIsMobileOpen(true)} className="p-2 text-gray-600">
          <Menu className="w-6 h-6" />
        </button>
      </div>
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-[100] flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)}></div>
          <div className="relative w-72 h-full">
            {sidebarContent}
            <button 
              onClick={() => setIsMobileOpen(false)}
              className="absolute top-6 right-[-48px] p-2 bg-white rounded-full shadow-lg"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
