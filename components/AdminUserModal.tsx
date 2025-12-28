
import React, { useState, useEffect } from 'react';
import { X, User as UserIcon, Shield, Search, Save, AlertTriangle, UserPlus, Trash2, Eye, CalendarOff, Edit3, Undo2 } from 'lucide-react';
import { User, getUserStyle, RatingHistory } from '../types';
import * as storage from '../services/storageService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onViewUser?: (userId: string) => void;
}

export const AdminUserModal: React.FC<Props> = ({ isOpen, onClose, currentUser, onShowToast, onViewUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  
  // Edit User State
  const [editRating, setEditRating] = useState<number>(0);
  const [editPassword, setEditPassword] = useState<string>('');
  
  // Penalty Management State
  const [userPenalties, setUserPenalties] = useState<RatingHistory[]>([]);
  const [isLoadingPenalties, setIsLoadingPenalties] = useState(false);
  const [editingPenaltyId, setEditingPenaltyId] = useState<number | null>(null);
  const [editPenaltyReason, setEditPenaltyReason] = useState('');

  // Create State
  const [isCreating, setIsCreating] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRating, setNewRating] = useState(1200);

  useEffect(() => {
    if (isOpen) {
        loadUsers();
    }
  }, [isOpen]);

  // Load penalties when editing a user
  useEffect(() => {
      if (editingUserId) {
          loadPenalties(editingUserId);
      } else {
          setUserPenalties([]);
      }
  }, [editingUserId]);

  const loadUsers = async () => {
      const all = await storage.getAllUsers();
      setUsers(all);
  };

  const loadPenalties = async (userId: string) => {
      setIsLoadingPenalties(true);
      // Fetch full rating history
      const history = await storage.getRatingHistory(userId);
      // Filter for negative changes (penalties) OR explicitly marked penalties
      // Since we store current rating, we can assume records with reason containing "惩罚" or "扣分" or "Undo"
      // Or simply filter where we can infer a drop. But simpler is to list all NEGATIVE impact events.
      // However, `rating` in history is the SNAPSHOT value, not the delta.
      // We must infer delta or just list all history for Admin to decide.
      // Let's list ALL history but highlight those that seem like penalties (dropped rating compared to previous).
      // Or better: List all history so Admin can revert *any* mistake.
      // But user requested "Penalty Management". Let's show all but styling penalties red.
      setUserPenalties(history);
      setIsLoadingPenalties(false);
  }

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

  const startEdit = (user: User) => {
      setEditingUserId(user.id);
      setEditRating(user.rating ?? 1200);
      setEditPassword(user.password || '');
  };

  const saveEdit = async () => {
      if (!editingUserId) return;
      try {
          await storage.adminUpdateUser(editingUserId, {
              rating: editRating,
              password: editPassword || undefined 
          });
          onShowToast("用户信息已更新", 'success');
          setEditingUserId(null);
          loadUsers();
      } catch (e) {
          console.error(e);
          onShowToast("更新失败", 'error');
      }
  };

  const handleCreateUser = async () => {
      if (!newUsername || !newPassword) return;
      try {
          await storage.adminCreateUser(newUsername, newPassword, newRating);
          onShowToast("用户创建成功", 'success');
          setIsCreating(false);
          setNewUsername('');
          setNewPassword('');
          setNewRating(1200);
          loadUsers();
      } catch (e: any) {
          onShowToast(`创建失败: ${e.message}`, 'error');
      }
  }

  const handleDeleteUser = async (userId: string) => {
      if (!confirm("确定要删除该用户吗？所有相关数据（打卡、记录）都将被永久删除！")) return;
      try {
          await storage.adminDeleteUser(userId);
          onShowToast("用户已删除", 'info');
          loadUsers();
      } catch (e: any) {
          onShowToast(`删除失败: ${e.message}`, 'error');
      }
  }

  const handleDeleteHistoryRecord = async (record: RatingHistory, prevRating: number) => {
      const delta = record.rating - prevRating; 
      // If delta was negative (penalty), refundAmount should be positive to reverse it.
      // refundAmount = -delta.
      // BUT WAIT: The history table stores the RESULTING rating.
      // Reverting a specific history record in a chain is complex.
      // Simplified Logic requested by user: "Delete penalty record and refund".
      // We will assume the Admin knows what they are doing.
      // We will ask the admin to confirm the "Refund Amount".
      // Actually, easier heuristic:
      // Calculate implied delta. If current rating is 1150, prev was 1200. Delta is -50.
      // Deleting this record implies we want to give back 50.
      
      // Let's just ask for confirmation with a calculated guess, or just simple delete.
      // The requirement says "modify or delete penalty record".
      
      // Better approach for "Delete": Just delete the row. 
      // And separately provide a "Refund/Adjust" function?
      // No, user said "delete record and it modifies the score".
      
      // Let's implement a smart delete:
      // If we delete a record where rating dropped, we assume we should add points back.
      // We can't easily know the "previous" rating without scanning all history.
      // Let's simplisticly assume Admin manually fixes rating in the input above if needed,
      // OR we just provide a "Delete Only" and "Delete & Revert" button.
      
      // Let's stick to the previous implementation logic: `deleteCheckIn` calculated delta from duration.
      // Here we have `change_reason`.
      
      // WORKAROUND: Just allow deleting the record. And allow Admin to manually edit the user's rating in the form above.
      // That is safest.
      // BUT user said "can modify or delete penalty record... if delete, return score".
      
      // Let's try to parse the delta from the reason if possible, or just ask user.
      // Actually, `storageService` has `deleteRatingHistoryRecord(id, userId, refundAmount)`.
      // We will prompt for refund amount.
      
      const refundStr = prompt("请输入要返还/扣除的分数 (正数返还，负数扣除，0不处理):", "0");
      if (refundStr === null) return;
      const refund = parseInt(refundStr);
      if (isNaN(refund)) {
          onShowToast("请输入有效数字", 'error');
          return;
      }

      try {
          await storage.deleteRatingHistoryRecord(record.id, record.user_id, refund);
          onShowToast(`记录已删除${refund !== 0 ? `，Rating 修正 ${refund}` : ''}`, 'success');
          if (editingUserId) {
              loadPenalties(editingUserId);
              // Also refresh the main user list to show updated rating
              loadUsers(); 
              // Update local edit state
              const u = users.find(u => u.id === editingUserId);
              if (u) setEditRating((u.rating || 1200) + refund);
          }
      } catch (e) {
          onShowToast("删除失败", 'error');
      }
  }

  const handleUpdateReason = async (id: number) => {
      if (!editPenaltyReason.trim()) return;
      try {
          await storage.updateRatingHistoryRecord(id, { change_reason: editPenaltyReason });
          onShowToast("记录已更新", 'success');
          setEditingPenaltyId(null);
          if (editingUserId) loadPenalties(editingUserId);
      } catch (e) {
          onShowToast("更新失败", 'error');
      }
  }

  if (!isOpen || currentUser.role !== 'admin') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                    <Shield className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-800">用户管理控制台</h2>
                    <p className="text-xs text-gray-500">创建、修改与删除用户</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        {/* Toolbar & Create */}
        <div className="p-4 border-b border-gray-100 space-y-4">
            {isCreating ? (
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 animate-fade-in">
                    <h3 className="text-sm font-bold text-indigo-800 mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4"/> 新增用户</h3>
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex-1 min-w-[150px]">
                            <label className="text-xs text-indigo-500 font-bold block mb-1">用户名</label>
                            <input value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full px-3 py-2 rounded border border-indigo-200 text-sm" placeholder="User01"/>
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="text-xs text-indigo-500 font-bold block mb-1">密码</label>
                            <input value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 rounded border border-indigo-200 text-sm" placeholder="***"/>
                        </div>
                        <div className="w-24">
                            <label className="text-xs text-indigo-500 font-bold block mb-1">Rating</label>
                            <input type="number" value={newRating} onChange={e => setNewRating(parseInt(e.target.value))} className="w-full px-3 py-2 rounded border border-indigo-200 text-sm" />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleCreateUser} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold text-sm hover:bg-indigo-700">确认创建</button>
                            <button onClick={() => setIsCreating(false)} className="px-4 py-2 bg-white text-gray-600 rounded font-bold text-sm hover:bg-gray-100">取消</button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="搜索用户名..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                    </div>
                    <button 
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <UserPlus className="w-4 h-4" /> 新增用户
                    </button>
                    <div className="flex items-center text-xs text-gray-400 px-3 bg-gray-50 rounded-lg">
                        共 {users.length} 人
                    </div>
                </div>
            )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/50">
            {filteredUsers.map(user => (
                <div key={user.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col group hover:border-indigo-200 transition-colors">
                    <div className="flex items-center justify-between">
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
                            <div className="flex gap-1 ml-2">
                                <button onClick={saveEdit} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700" title="保存"><Save className="w-4 h-4"/></button>
                                <button onClick={() => setEditingUserId(null)} className="p-1.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300" title="取消"><X className="w-4 h-4"/></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <div className="text-xs text-gray-400">Rating</div>
                                    <div className="font-bold text-gray-800">{user.rating}</div>
                                </div>
                                {user.role !== 'admin' && (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => onViewUser && onViewUser(user.id)}
                                            className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="查看主页"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => startEdit(user)}
                                            className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                        >
                                            管理
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="删除用户"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Edit Panel & History Management */}
                    {editingUserId === user.id && (
                        <div className="mt-4 pt-4 border-t border-dashed border-gray-200 animate-fade-in">
                            <div className="flex flex-wrap gap-4 items-end mb-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-indigo-400 font-bold uppercase">Rating</label>
                                    <input 
                                        type="number" 
                                        value={editRating} 
                                        onChange={e => setEditRating(parseInt(e.target.value))}
                                        className="w-24 px-3 py-1.5 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-indigo-50/50"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-indigo-400 font-bold uppercase">Password</label>
                                    <input 
                                        type="text" 
                                        value={editPassword} 
                                        onChange={e => setEditPassword(e.target.value)}
                                        className="w-32 px-3 py-1.5 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-indigo-50/50"
                                        placeholder="Keep empty"
                                    />
                                </div>
                            </div>

                            {/* Penalty/History List */}
                            <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-200">
                                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <CalendarOff className="w-3 h-3" /> Rating 历史记录 (最近20条)
                                </div>
                                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
                                    {isLoadingPenalties ? (
                                        <div className="text-xs text-gray-400 p-2">加载记录中...</div>
                                    ) : userPenalties.length === 0 ? (
                                        <div className="text-xs text-gray-400 p-2">无历史记录</div>
                                    ) : (
                                        userPenalties.slice(0, 20).map((p, idx) => {
                                            // Heuristic to detect drops. We don't know "prev" easily here.
                                            // Just style by reason content keywords for visual aid
                                            const isPenalty = p.change_reason?.includes('惩罚') || p.change_reason?.includes('扣分') || p.change_reason?.includes('撤销');
                                            
                                            return (
                                                <div key={p.id} className={`flex justify-between items-center p-2 rounded border text-xs ${isPenalty ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                                                    <div className="flex-1 mr-2 overflow-hidden">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-mono text-gray-400">{new Date(p.recorded_at).toLocaleDateString()}</span>
                                                            <span className={`font-bold px-1.5 rounded ${isPenalty ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                                {p.rating}
                                                            </span>
                                                        </div>
                                                        
                                                        {editingPenaltyId === p.id ? (
                                                            <div className="flex gap-2">
                                                                <input 
                                                                    value={editPenaltyReason} 
                                                                    onChange={e => setEditPenaltyReason(e.target.value)}
                                                                    className="flex-1 border rounded px-1 text-xs"
                                                                    autoFocus
                                                                />
                                                                <button onClick={() => handleUpdateReason(p.id)} className="text-green-600"><Save className="w-3 h-3"/></button>
                                                                <button onClick={() => setEditingPenaltyId(null)} className="text-gray-400"><X className="w-3 h-3"/></button>
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-600 truncate" title={p.change_reason}>
                                                                {p.change_reason}
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button 
                                                            onClick={() => {
                                                                setEditingPenaltyId(p.id);
                                                                setEditPenaltyReason(p.change_reason || '');
                                                            }}
                                                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded"
                                                            title="修改原因"
                                                        >
                                                            <Edit3 className="w-3 h-3" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteHistoryRecord(p, userPenalties[idx+1]?.rating || 1200)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                            title="删除记录 (可返还分数)"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};
