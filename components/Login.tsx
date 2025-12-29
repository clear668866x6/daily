
import React, { useState, useEffect } from 'react';
import { GraduationCap, ArrowRight, AlertCircle, User as UserIcon, Lock, Coffee, KeyRound } from 'lucide-react';
import { User, getUserStyle } from '../types';
import * as storage from '../services/storageService';

interface Props {
  onLogin: (user: User) => void;
}

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await storage.getAllUsers();
        setRecentUsers(users.filter(u => u.role !== 'admin').slice(0, 3));
      } catch (e) {
      }
    };
    loadUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await storage.loginUser(username.trim(), password, inviteCode.trim());
      onLogin(user);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "登录失败。请检查邀请码或密码是否正确。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      const guest = storage.loginGuest();
      onLogin(guest);
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-brand-600 p-8 text-center">
          <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">KYtracker</h1>
          <p className="text-brand-100">记录考研每一天，上岸终有时</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 ml-1">账号</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-gray-800 placeholder-gray-400"
                  placeholder="设置或输入用户名"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 ml-1">密码</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-gray-800 placeholder-gray-400"
                  placeholder="登录或注册密码"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 ml-1">邀请码 <span className="text-xs text-brand-600 font-normal">(仅新用户注册需要)</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-gray-800 placeholder-gray-400"
                  placeholder="请输入注册邀请码"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-start space-x-2 text-red-500 text-sm bg-red-50 p-3 rounded-lg animate-pulse">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!username.trim() || isLoading}
              className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-brand-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <span>{isLoading ? '处理中...' : '登录 / 注册'}</span>
              {!isLoading && <ArrowRight className="w-5 h-5" />}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-400">或</span>
              </div>
            </div>
            
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={isLoading}
              className="w-full bg-white text-gray-600 border border-gray-200 py-3.5 rounded-xl font-bold hover:bg-gray-50 hover:text-brand-600 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 group"
            >
              <Coffee className="w-5 h-5 text-gray-400 group-hover:text-brand-500 transition-colors" />
              <span>访客试用 (受限模式)</span>
            </button>
          </form>

          {/* Recent Users */}
          {recentUsers.length > 0 && (
            <div className="mt-8">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-400">最近活跃研友</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {recentUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setUsername(u.name);
                      setPassword(''); 
                      setInviteCode('');
                    }}
                    className="flex flex-col items-center p-2 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full bg-gray-100 mb-2 group-hover:ring-2 ring-brand-200 transition-all" />
                    <span className={`text-xs truncate w-full text-center ${getUserStyle('user', u.rating)}`}>{u.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
