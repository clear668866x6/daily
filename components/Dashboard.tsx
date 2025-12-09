import React, { useMemo } from 'react';
import { CheckIn } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Calendar, Trophy, Flame } from 'lucide-react';

interface Props {
  checkIns: CheckIn[];
  currentUserId: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

export const Dashboard: React.FC<Props> = ({ checkIns, currentUserId }) => {
  const myCheckIns = useMemo(() => checkIns.filter(c => c.userId === currentUserId), [checkIns, currentUserId]);

  const stats = useMemo(() => {
    const subjectCount: Record<string, number> = {};
    const dateCount: Record<string, number> = {};
    
    myCheckIns.forEach(c => {
      // Subject Stats
      subjectCount[c.subject] = (subjectCount[c.subject] || 0) + 1;
      
      // Date Stats (Last 7 days simplified)
      const date = new Date(c.timestamp).toLocaleDateString('zh-CN', { weekday: 'short' });
      dateCount[date] = (dateCount[date] || 0) + 1;
    });

    const pieData = Object.entries(subjectCount).map(([name, value]) => ({ name, value }));
    const barData = Object.entries(dateCount).map(([name, value]) => ({ name, value }));

    return { pieData, barData };
  }, [myCheckIns]);

  const streak = 3; // Mock streak logic for visual appeal
  const totalDays = new Set(myCheckIns.map(c => new Date(c.timestamp).toDateString())).size;

  return (
    <div className="space-y-6">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl p-6 text-white shadow-lg shadow-brand-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-2 rounded-lg">
              <Trophy className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium bg-white/20 px-2 py-1 rounded-full">总打卡</span>
          </div>
          <h3 className="text-3xl font-bold">{myCheckIns.length}</h3>
          <p className="text-brand-100 text-sm mt-1">坚持就是胜利</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
              <Flame className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-500">连续天数</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-800">{streak} <span className="text-sm text-gray-400 font-normal">天</span></h3>
          <p className="text-gray-400 text-sm mt-1">保持火热状态</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 p-2 rounded-lg text-green-600">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-500">累计天数</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-800">{totalDays} <span className="text-sm text-gray-400 font-normal">天</span></h3>
          <p className="text-gray-400 text-sm mt-1">一步一个脚印</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-80">
          <h3 className="text-lg font-bold text-gray-800 mb-4">科目分布</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {stats.pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Activity */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-80">
          <h3 className="text-lg font-bold text-gray-800 mb-4">本周活跃</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.barData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} />
              <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};