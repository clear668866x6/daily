
import React, { useMemo } from 'react';
import { Megaphone, AlertCircle, Code2, ArrowRight } from 'lucide-react';
import { CheckIn, AlgorithmTask, User } from '../types';

interface Props {
  user: User;
  checkIns: CheckIn[];
  algoTasks: AlgorithmTask[];
  onNavigate: (tab: string) => void;
}

export const GlobalAlerts: React.FC<Props> = ({ user, checkIns, algoTasks, onNavigate }) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  // 1. 获取所有置顶公告，只显示最新的一个
  const latestAnnouncement = useMemo(() => {
    const all = checkIns.filter(c => c.isAnnouncement);
    if (all.length === 0) return null;
    return all.sort((a, b) => b.timestamp - a.timestamp)[0];
  }, [checkIns]);

  // 2. 检查今天是否已打卡
  const hasCheckedInToday = useMemo(() => {
    return checkIns.some(c => {
      const cDate = new Date(c.timestamp);
      return c.userId === user.id && 
             cDate.getDate() === today.getDate() &&
             cDate.getMonth() === today.getMonth() &&
             cDate.getFullYear() === today.getFullYear();
    });
  }, [checkIns, user.id]);

  // 3. 检查今天是否有算法题 (仅对被分配的人显示)
  const todaysAlgoTask = useMemo(() => {
    const task = algoTasks.find(t => t.date === todayStr);
    if (!task) return null;
    if (user.role === 'admin') return task; // Admins see all
    if (task.assignedTo && task.assignedTo.length > 0 && !task.assignedTo.includes(user.id)) {
        return null;
    }
    return task;
  }, [algoTasks, todayStr, user.id, user.role]);

  if (user.role === 'guest' || user.role === 'admin') return null; // Admins don't need basic alerts

  return (
    <div className="space-y-4 mb-6">
      
      {/* 1. 全站公告区域 (只显示最新一条) */}
      {latestAnnouncement && (
        <div key={latestAnnouncement.id} className="bg-gradient-to-r from-red-500 to-pink-600 text-white p-4 rounded-2xl shadow-lg shadow-red-200 flex items-start gap-3 animate-fade-in relative overflow-hidden">
             <div className="bg-white/20 p-2 rounded-lg shrink-0 backdrop-blur-sm">
                <Megaphone className="w-5 h-5 text-white" />
             </div>
             <div className="flex-1 min-w-0">
                 <div className="font-bold text-sm mb-0.5 flex items-center gap-2">
                    官方公告
                    <span className="text-[10px] bg-white/20 px-1.5 rounded font-mono font-normal">
                        {new Date(latestAnnouncement.timestamp).toLocaleDateString()}
                    </span>
                 </div>
                 <p className="text-sm text-white/90 line-clamp-2 leading-relaxed">{latestAnnouncement.content}</p>
             </div>
             <div className="absolute -right-4 -bottom-4 bg-white/10 w-24 h-24 rounded-full blur-xl"></div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 2. 未打卡提醒 */}
        {!hasCheckedInToday && (
            <div className="bg-white border-l-4 border-yellow-400 p-4 rounded-xl shadow-sm flex items-center justify-between gap-4 group hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                    <div className="bg-yellow-50 p-2 rounded-full text-yellow-500">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm">今天还没有打卡哟</h4>
                        <p className="text-xs text-gray-500 mt-0.5">记录点滴进步，哪怕只是背了一个单词</p>
                    </div>
                </div>
                <button 
                    onClick={() => onNavigate('feed')}
                    className="text-xs bg-yellow-400 text-yellow-900 px-3 py-1.5 rounded-lg font-bold hover:bg-yellow-500 transition-colors flex items-center gap-1"
                >
                    去打卡 <ArrowRight className="w-3 h-3" />
                </button>
            </div>
        )}

        {/* 3. 今日算法提醒 */}
        {todaysAlgoTask && (
             <div className="bg-white border-l-4 border-brand-500 p-4 rounded-xl shadow-sm flex items-center justify-between gap-4 group hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-50 p-2 rounded-full text-brand-600">
                        <Code2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm">今日算法挑战已更新</h4>
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[150px]">{todaysAlgoTask.title}</p>
                    </div>
                </div>
                <button 
                    onClick={() => onNavigate('algorithm')}
                    className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-brand-700 transition-colors flex items-center gap-1"
                >
                    去AC <ArrowRight className="w-3 h-3" />
                </button>
            </div>
        )}
      </div>
    </div>
  );
};
