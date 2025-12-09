import React, { useState, useEffect } from 'react';
import { GraduationCap, ArrowRight, AlertCircle } from 'lucide-react';
import { User } from '../types';
import * as storage from '../services/storageService';

interface Props {
  onLogin: (user: User) => void;
}

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await storage.getAllUsers();
        setRecentUsers(users.slice(0, 3));
      } catch (e) {
        // Silent fail on load users if db not connected
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
      const user = await storage.loginUser(username.trim());
      onLogin(user);
    } catch (error) {
      console.error(error);
      setErrorMsg("登录失败。请检查网络或确认 Supabase 数据库已正确连接 (VITE_SUPABASE_URL)。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (name: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await storage.loginUser(name);
      onLogin(user);
    } catch (error) {
      console.error(error);
      setErrorMsg("登录失败。请检查数据库连接。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-brand-600 p-8 text-center">
          <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">KaoyanMate</h1>
          <p className="text-brand-100">记录考研每一天，上岸终有时</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                请输入你的昵称
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-gray-800 placeholder-gray-400"
                placeholder="例如：数学满分选手"
                autoFocus
              />
            </div>

            {errorMsg && (
              <div className="flex items-start space-x-2 text-red-500 text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!username.trim() || isLoading}
              className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-brand-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <span>{isLoading ? '登录中...' : '开始打卡'}</span>
              {!isLoading && <ArrowRight className="w-5 h-5" />}
            </button>
          </form>

          {/* Quick Login */}
          {recentUsers.length > 0 && (
            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-400">活跃研友</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {recentUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleQuickLogin(u.name)}
                    className="flex flex-col items-center p-2 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full bg-gray-100 mb-2 group-hover:ring-2 ring-brand-200 transition-all" />
                    <span className="text-xs text-gray-600 truncate w-full text-center">{u.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <p className="mt-6 text-center text-sm text-gray-400">
        输入新昵称将自动创建新账号
      </p>
    </div>
  );
};