
import React from 'react';
import { Rocket, Zap, Bug, GitBranch, AlertCircle, CheckCircle2 } from 'lucide-react';

export const About: React.FC = () => {
  const version = "1.2.0";
  const changelogs = [
    {
        version: "1.2.0",
        date: "2024-03-20",
        title: "数据透视与扣分机制上线",
        features: [
            "🔥 新增【摸鱼扣分】机制：记录无效时长并反向扣除 Rating，增加备考紧迫感。",
            "📊 图表升级：科目饼图现在基于【真实学习时长】而非打卡次数。",
            "👀 研友透视：Dashboard 支持切换查看他人的详细数据面板。",
            "📝 算法历史：算法训练营支持查看和练习历史题目。"
        ]
    },
    {
        version: "1.1.0",
        date: "2024-03-15",
        title: "AI 英语与多人互动",
        features: [
            "🧠 集成 DeepSeek AI：根据考研大纲生成每日英语阅读与生词表。",
            "🌍 研友圈：发布动态、点赞互动、查看实时学习流。",
            "📈 基础 Rating 系统：根据打卡行为计算积分等级。"
        ]
    },
    {
        version: "1.0.0",
        date: "2024-03-01",
        title: "KaoyanMate 诞生",
        features: [
            "✅ 基础打卡功能：支持数学、408、英语等科目。",
            "🎯 每日目标管理：To-Do List 功能上线。",
            "💻 算法训练营：基础 OJ 判题模拟。"
        ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
      
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                KaoyanMate 考研助手
                <span className="bg-white/20 text-sm font-mono px-2 py-1 rounded-lg border border-white/30">v{version}</span>
            </h1>
            <p className="text-brand-100 max-w-xl text-lg">
                一个专为计算机考研人打造的极简打卡与辅助学习平台。拒绝焦虑，记录每一次进步。
            </p>
        </div>
        <Rocket className="absolute -bottom-6 -right-6 w-40 h-40 text-white opacity-10 rotate-12" />
      </div>

      {/* Current Version Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
              <div className="bg-green-100 p-3 rounded-full mb-4"><Zap className="w-6 h-6 text-green-600"/></div>
              <h3 className="font-bold text-gray-800">极速响应</h3>
              <p className="text-sm text-gray-500 mt-2">基于 Supabase 的实时数据库，打卡数据毫秒级同步。</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
              <div className="bg-blue-100 p-3 rounded-full mb-4"><GitBranch className="w-6 h-6 text-blue-600"/></div>
              <h3 className="font-bold text-gray-800">开源共建</h3>
              <p className="text-sm text-gray-500 mt-2">代码完全开源，欢迎提交 PR 贡献新功能。</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
              <div className="bg-purple-100 p-3 rounded-full mb-4"><AlertCircle className="w-6 h-6 text-purple-600"/></div>
              <h3 className="font-bold text-gray-800">摸鱼预警</h3>
              <p className="text-sm text-gray-500 mt-2">独创的【扣分模式】，让你直面时间黑洞。</p>
          </div>
      </div>

      {/* Changelog */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">更新日志</h2>
          </div>
          <div className="divide-y divide-gray-100">
              {changelogs.map((log, index) => (
                  <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${index === 0 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>
                                  v{log.version}
                              </span>
                              <h3 className="font-bold text-gray-800">{log.title}</h3>
                          </div>
                          <span className="text-sm text-gray-400 mt-2 md:mt-0 font-mono">{log.date}</span>
                      </div>
                      <ul className="space-y-2">
                          {log.features.map((feat, fIndex) => (
                              <li key={fIndex} className="flex items-start gap-2 text-sm text-gray-600 leading-relaxed">
                                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                  <span>{feat}</span>
                              </li>
                          ))}
                      </ul>
                  </div>
              ))}
          </div>
      </div>
      
      <div className="text-center text-gray-400 text-sm">
        <p>Built with React, Supabase & Love by 考研人</p>
      </div>
    </div>
  );
};
