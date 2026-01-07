
import React, { useState } from 'react';
import { X, UserPlus, Shield } from 'lucide-react';
import { User } from '../types';
import * as storage from '../services/storageService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onViewUser?: (userId: string) => void;
}

export const AdminUserModal: React.FC<Props> = ({ isOpen, onClose, currentUser, onShowToast }) => {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRating, setNewRating] = useState(1200);

  if (!isOpen || currentUser.role !== 'admin') return null;

  const handleCreateUser = async () => {
      if (!newUsername || !newPassword) return;
      try {
          await storage.adminCreateUser(newUsername, newPassword, newRating);
          onShowToast("用户创建成功", 'success');
          setNewUsername('');
          setNewPassword('');
          setNewRating(1200);
          onClose(); // Close modal on success
      } catch (e: any) {
          onShowToast(`创建失败: ${e.message}`, 'error');
      }
  }

  return (
    <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose} 
    >
      <div 
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" 
          onClick={e => e.stopPropagation()} // Prevent click from closing modal
      >
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                    <Shield className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-800">新增用户</h2>
                    <p className="text-xs text-gray-500">创建新的考研账号</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
            <div>
                <label className="text-xs text-gray-500 font-bold block mb-1 uppercase">用户名</label>
                <input 
                    value={newUsername} 
                    onChange={e => setNewUsername(e.target.value)} 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="例如: User01"
                />
            </div>
            <div>
                <label className="text-xs text-gray-500 font-bold block mb-1 uppercase">密码</label>
                <input 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="设置初始密码"
                />
            </div>
            <div>
                <label className="text-xs text-gray-500 font-bold block mb-1 uppercase">初始 Rating</label>
                <input 
                    type="number" 
                    value={newRating} 
                    onChange={e => setNewRating(parseInt(e.target.value))} 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50">取消</button>
            <button onClick={handleCreateUser} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" /> 确认创建
            </button>
        </div>
      </div>
    </div>
  );
};
