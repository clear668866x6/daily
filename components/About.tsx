
import React from 'react';
import { Rocket, Zap, Bug, GitBranch, AlertCircle, CheckCircle2 } from 'lucide-react';

export const About: React.FC = () => {
  const version = "1.8.0";
  const changelogs = [
    {
        version: "1.8.0",
        date: "2026-01-05",
        title: "管理后台重构与体验优化",
        features: [
            "🛡️ 管理员专属后台：合并了管理功能至主页，支持一键查看用户状态、缺勤统计及请假审批。",
            "📊 数据可视化升级：优化了 Rating 曲线算法，使其更平滑；热力图支持 2026 年。",
            "🎯 目标设定修复：修复了每日目标无法修改的问题，优化了防误触机制。",
            "🧹 界面净化：为管理员移除了冗余的个人打卡模块，让管理更专注。",
            "🤖 智能通知：算法题仅通知被分配的成员，减少干扰。"
        ]
    },
    {
        version: "1.7.0",
        date: "2025-12-25",
        title: "视觉盛宴与数据洞察",
        features: [
            "🖼️ 图片浏览升级：支持全屏查看打卡图片，支持手势缩放与多图切换。",
            "🔥 年度热力图：Dashboard 新增 Github 风格学习热力图，点亮你的每一天。",
            "📊 数据透视 Pro：科目分布支持按日/月/年筛选，每日时长支持自定义日期范围。",
            "🏆 成就系统扩容：新增连续打卡、累计时长等重磅成就。",
            "📜 算法历史：算法训练营新增“我的提交记录”面板，支持日期筛选与代码回溯。"
        ]
    },
    {
        version: "1.6.0",
        date: "2025-12-15",
        title: "正向激励与全屏沉浸",
        features: [
            "🏆 连续打卡成就：连续打卡 7/14/21 天将触发全屏庆祝动画，保持 Momentum！",
            "🛑 私密缺勤提醒：未打卡不再公开发布，改为全屏强提醒，保护隐私同时拒绝摆烂。",
            "📝 全屏编辑器重构：算法训练与打卡日志均支持沉浸式全屏编辑。"
        ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
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
