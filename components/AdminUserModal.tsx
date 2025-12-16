
import React, { useState, useEffect } from 'react';
import { X, User as UserIcon, Shield, Search, Save, AlertTriangle } from 'lucide-react';
import { User, getUserStyle } from '../types';
import * as storage from '../services/storageService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminUserModal: React.FC<Props> = ({ isOpen, onClose, currentUser, onShowToast }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  
  // Edit State
  const [editRating, setEditRating] = useState<number>(0);
  const [editPassword, setEditPassword] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
        loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
      const all = await storage.getAllUsers();
      setUsers(all);
  };

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

  const startEdit = (user: User) => {
      setEditingUserId(user.id);
      setEditRating(user.rating || 1200);
      setEditPassword(user.password || '');
  };

  const saveEdit = async () => {
      if (!editingUserId) return;
      try {
          await storage.adminUpdateUser(editingUserId, {
              rating: editRating,
              password: editPassword || undefined // Keep undefined if empty to not erase existing if logic changes, though here we overwrite
          });
          onShowToast("用户信息已更新", 'success');
          setEditingUserId(null);
          loadUsers();
      } catch (e) {
          console.error(e);
          onShowToast("更新失败", 'error');
      }
  };

  if (!isOpen || currentUser.role !== 'admin') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                    <Shield className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-800">用户管理控制台</h2>
                    <p className="text-xs text-gray-500">修改用户密码与 Rating</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="搜索用户名..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
            </div>
            <div className="flex items-center text-xs text-gray-400 px-2 bg-gray-50 rounded-lg">
                共 {users.length} 名用户
            </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/50">
            {filteredUsers.map(user => (
                <div key={user.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-colors">
                    <div className="flex items-center gap-4">
                        <img src={user.avatar} className="w-10 h-10 rounded-full bg-gray-100" />
                        <div>
                            <div className="flex items-center gap-2">
                                <span className={`font-bold text-sm ${getUserStyle(user.role, user.rating)}`}>{user.name}</span>
                                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 rounded">{user.role}</span>
                            </div>
                            <div className="text-xs text-gray-400 font-mono mt-0.5">ID: {user.id.substring(0,8)}...</div>
                        </div>
                    </div>

                    {editingUserId === user.id ? (
                        <div className="flex items-center gap-3 animate-fade-in bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-indigo-400 font-bold uppercase">Rating</label>
                                <input 
                                    type="number" 
                                    value={editRating} 
                                    onChange={e => setEditRating(parseInt(e.target.value))}
                                    className="w-20 px-2 py-1 text-sm border border-indigo-200 rounded focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-indigo-400 font-bold uppercase">Password</label>
                                <input 
                                    type="text" 
                                    value={editPassword} 
                                    onChange={e => setEditPassword(e.target.value)}
                                    className="w-32 px-2 py-1 text-sm border border-indigo-200 rounded focus:outline-none focus:border-indigo-500"
                                    placeholder="Keep empty"
                                />
                            </div>
                            <div className="flex gap-1 ml-2">
                                <button onClick={saveEdit} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700" title="保存"><Save className="w-4 h-4"/></button>
                                <button onClick={() => setEditingUserId(null)} className="p-1.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300" title="取消"><X className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <div className="text-xs text-gray-400">Rating</div>
                                <div className="font-bold text-gray-800">{user.rating}</div>
                            </div>
                            {user.role !== 'admin' && (
                                <button 
                                    onClick={() => startEdit(user)}
                                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                >
                                    管理
                                </button>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};
