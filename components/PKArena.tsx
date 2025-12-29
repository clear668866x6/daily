
import React, { useState, useEffect, useMemo } from 'react';
import { User, CheckIn } from '../types';
import * as storage from '../services/storageService';
import { Swords, Trophy, Clock, Zap, Target, User as UserIcon, Search, Percent } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';

interface Props {
  currentUser: User;
  checkIns: CheckIn[];
}

export const PKArena: React.FC<Props> = ({ currentUser, checkIns }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [opponent, setOpponent] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    storage.getAllUsers().then(u => setUsers(u.filter(x => x.id !== currentUser.id && x.role !== 'admin')));
  }, [currentUser.id]);

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // Stats Calculation
  const getStats = (userId: string) => {
      const userCheckIns = checkIns.filter(c => c.userId === userId && !c.isPenalty);
      const totalTime = userCheckIns.reduce((acc, c) => acc + (c.duration || 0), 0);
      const totalDays = new Set(userCheckIns.map(c => new Date(c.timestamp).toDateString())).size;
      const todayStr = new Date().toDateString();
      const todayTime = userCheckIns.filter(c => new Date(c.timestamp).toDateString() === todayStr).reduce((acc, c) => acc + (c.duration || 0), 0);
      
      // Subject Distribution for Radar
      const subMap: Record<string, number> = {};
      userCheckIns.forEach(c => {
          subMap[c.subject] = (subMap[c.subject] || 0) + (c.duration || 0);
      });
      
      return { totalTime, totalDays, todayTime, subMap };
  }

  const myStats = getStats(currentUser.id);
  const oppStats = opponent ? getStats(opponent.id) : null;

  // Simple Win Rate Mock based on Rating difference
  const winRate = useMemo(() => {
      if(!opponent) return 50;
      const diff = (currentUser.rating || 1200) - (opponent.rating || 1200);
      const prob = 1 / (1 + Math.pow(10, -diff / 400));
      return Math.round(prob * 100);
  }, [currentUser, opponent]);

  const comparisonData = opponent ? [
      { name: 'Rating', me: currentUser.rating || 1200, opp: opponent.rating || 1200 },
      { name: '总时长(h)', me: Math.round(myStats.totalTime/60), opp: Math.round(oppStats!.totalTime/60) },
      { name: '打卡天数', me: myStats.totalDays, opp: oppStats!.totalDays },
      { name: '今日(min)', me: myStats.todayTime, opp: oppStats!.todayTime },
  ] : [];

  const radarData = useMemo(() => {
      if (!opponent) return [];
      const allSubs = new Set([...Object.keys(myStats.subMap), ...Object.keys(oppStats!.subMap)]);
      return Array.from(allSubs).map(sub => ({
          subject: sub,
          me: myStats.subMap[sub] || 0,
          opp: oppStats!.subMap[sub] || 0,
      })).slice(0, 6);
  }, [opponent, myStats, oppStats]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
                <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
                    <Swords className="w-8 h-8" /> PK 竞技场
                </h1>
                <p className="text-indigo-100">狭路相逢勇者胜，选择对手一决高下！</p>
            </div>
            <Target className="absolute -right-6 -bottom-6 w-40 h-40 text-white opacity-10 rotate-45" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Opponent Selector */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col h-[600px]">
                <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="搜索对手..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {filteredUsers.map(u => (
                        <button 
                            key={u.id}
                            onClick={() => setOpponent(u)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${
                                opponent?.id === u.id 
                                ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' 
                                : 'bg-white border-transparent hover:bg-gray-50'
                            }`}
                        >
                            <img src={u.avatar} className="w-10 h-10 rounded-full bg-gray-200" />
                            <div className="text-left flex-1">
                                <div className="font-bold text-gray-800 text-sm">{u.name}</div>
                                <div className="text-xs text-gray-400">Rating: {u.rating || 1200}</div>
                            </div>
                            {opponent?.id === u.id && <Swords className="w-4 h-4 text-indigo-500" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Arena Display */}
            <div className="lg:col-span-8 space-y-6">
                {opponent ? (
                    <>
                        {/* Head to Head Header */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col md:flex-row justify-between items-center relative overflow-hidden gap-6">
                            <div className="text-center z-10 flex-1">
                                <img src={currentUser.avatar} className="w-20 h-20 rounded-full border-4 border-indigo-100 mx-auto mb-2" />
                                <h3 className="font-black text-gray-800">{currentUser.name}</h3>
                                <div className="text-indigo-600 font-bold text-lg">{currentUser.rating || 1200}</div>
                            </div>
                            
                            <div className="text-center z-10 flex flex-col items-center">
                                <div className="text-4xl font-black text-gray-200 italic mb-2">VS</div>
                                <div className="bg-indigo-50 px-3 py-1 rounded-full text-indigo-600 text-xs font-bold flex items-center gap-1">
                                    <Percent className="w-3 h-3"/> 胜率预测: {winRate}%
                                </div>
                            </div>

                            <div className="text-center z-10 flex-1">
                                <img src={opponent.avatar} className="w-20 h-20 rounded-full border-4 border-rose-100 mx-auto mb-2" />
                                <h3 className="font-black text-gray-800">{opponent.name}</h3>
                                <div className="text-rose-600 font-bold text-lg">{opponent.rating || 1200}</div>
                            </div>
                            
                            {/* Bg Decoration */}
                            <div className="absolute top-0 left-0 w-1/2 h-full bg-indigo-50/20 skew-x-12 -ml-16 pointer-events-none"></div>
                            <div className="absolute top-0 right-0 w-1/2 h-full bg-rose-50/20 -skew-x-12 -mr-16 pointer-events-none"></div>
                        </div>

                        {/* Bar Chart Comparison */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h4 className="font-bold text-gray-700 mb-6 flex items-center gap-2"><Trophy className="w-4 h-4" /> 核心数据对比</h4>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={comparisonData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12, fontWeight: 'bold'}} />
                                        <Tooltip cursor={{fill: 'transparent'}} />
                                        <Bar dataKey="me" name="我" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
                                        <Bar dataKey="opp" name="对手" fill="#e11d48" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-6 text-xs font-bold mt-2">
                                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-600 rounded"></div> 我</div>
                                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-rose-600 rounded"></div> 对手</div>
                            </div>
                        </div>

                        {/* Radar Chart Preference */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Zap className="w-4 h-4" /> 科目偏好 (累计时长)</h4>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                        <PolarGrid />
                                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} />
                                        <Radar name="我" dataKey="me" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.4} />
                                        <Radar name="对手" dataKey="opp" stroke="#e11d48" fill="#e11d48" fillOpacity={0.4} />
                                        <Legend />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
                        <UserIcon className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-bold">请从左侧选择一位对手</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};