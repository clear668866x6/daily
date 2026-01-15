
import React, { useState, useEffect } from 'react';
import { User, RatingHistory, AlgorithmSubmission, AlgorithmTask } from '../types';
import * as storage from '../services/storageService';
import { ACHIEVEMENTS } from '../constants';
import { Award, History, TrendingUp, TrendingDown, CheckCircle, Lock } from 'lucide-react';

interface Props {
  user: User;
}

export const AchievementsHistory: React.FC<Props> = ({ user }) => {
  const [history, setHistory] = useState<RatingHistory[]>([]);
  const [submissions, setSubmissions] = useState<AlgorithmSubmission[]>([]);
  const [tasks, setTasks] = useState<AlgorithmTask[]>([]);

  useEffect(() => {
    const loadData = async () => {
        const h = await storage.getRatingHistory(user.id);
        setHistory(h);
        const s = await storage.getAlgorithmSubmissions(user.id);
        setSubmissions(s);
        const t = await storage.getAlgorithmTasks();
        setTasks(t);
    };
    loadData();
  }, [user.id]);

  // Helper to extract the true delta from text description if possible
  const getDisplayDelta = (record: RatingHistory, prevRecord: RatingHistory | undefined): number => {
      const reason = record.change_reason || '';
      
      // 1. Try parsing "R: 1350->1354" pattern (Most accurate for all logs)
      const rangeMatch = reason.match(/R:\s*(\d+)\s*->\s*(\d+)/);
      if (rangeMatch) {
          return parseInt(rangeMatch[2]) - parseInt(rangeMatch[1]);
      }

      // 2. Try parsing "扣分 20" pattern (For older penalties)
      const penaltyMatch = reason.match(/扣分\s*-?(\d+)/);
      if (penaltyMatch) {
          return -parseInt(penaltyMatch[1]);
      }

      // 3. Try parsing "Rating +XX" pattern (For exemptions/bonuses)
      const bonusMatch = reason.match(/Rating \+(\d+)/);
      if (bonusMatch) {
          return parseInt(bonusMatch[1]);
      }

      // 4. Fallback to mathematical difference (for manual adjustments or unknown formats)
      // Note: This might show weird jumps if recalculation happened, but it's the fallback.
      return prevRecord ? record.rating - prevRecord.rating : 0;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
        {/* Achievements Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
                <Award className="w-6 h-6 text-brand-600" /> 成就展示柜
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ACHIEVEMENTS.map(ach => {
                    const unlocked = ach.id === 'night_owl' 
                        ? !!localStorage.getItem(`ach_shown_${user.id}_night_owl`)
                        : ach.condition(submissions, tasks);
                    
                    return (
                        <div key={ach.id} className={`p-4 rounded-2xl border flex items-center gap-4 transition-all relative overflow-hidden ${
                            unlocked 
                            ? 'bg-gradient-to-br from-white to-gray-50 border-gray-200 shadow-sm' 
                            : 'bg-gray-50 border-gray-100 grayscale opacity-60'
                        }`}>
                            <div className={`p-3 rounded-full shrink-0 ${unlocked ? ach.color : 'bg-gray-200 text-gray-400'}`}>
                                <ach.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800">{ach.title}</h4>
                                <p className="text-xs text-gray-500 mt-1">{ach.description}</p>
                                <div className="mt-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                    {unlocked ? <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> 已获得</span> : <span className="text-gray-400 flex items-center gap-1"><Lock className="w-3 h-3"/> 未解锁</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Rating History Log */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
                <History className="w-6 h-6 text-gray-500" /> 积分流水日志
            </h2>
            <div className="space-y-0 relative">
                <div className="absolute left-[27px] top-4 bottom-4 w-px bg-gray-100"></div>
                {history.length > 0 ? (
                    history.map((record, idx) => {
                        const prevRecord = history[idx + 1];
                        const delta = getDisplayDelta(record, prevRecord);
                        
                        const isPositive = delta > 0;
                        const isNeutral = delta === 0;

                        return (
                            <div key={record.id} className="flex gap-4 relative py-3 group hover:bg-gray-50 rounded-xl px-2 transition-colors">
                                <div className={`relative z-10 w-14 text-center shrink-0 flex flex-col items-center justify-center rounded-lg border text-xs font-bold py-1 ${
                                    isPositive ? 'bg-red-50 text-red-600 border-red-100' : 
                                    (isNeutral ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-green-50 text-green-600 border-green-200')
                                }`}>
                                    {isNeutral ? '-' : (isPositive ? `+${delta}` : `${delta}`)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm font-bold text-gray-800">{record.change_reason || '未知变动'}</p>
                                        <span className="text-xs text-gray-400 font-mono">{new Date(record.recorded_at).toLocaleString()}</span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                        <span className="bg-gray-100 px-1.5 rounded">当前 Rating: {record.rating}</span>
                                        {isPositive && <TrendingUp className="w-3 h-3 text-red-500"/>}
                                        {!isPositive && !isNeutral && <TrendingDown className="w-3 h-3 text-green-500"/>}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-10 text-gray-400">暂无积分记录</div>
                )}
            </div>
        </div>
    </div>
  );
};
