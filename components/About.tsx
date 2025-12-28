
import React from 'react';
import { Rocket, Zap, Bug, GitBranch, AlertCircle, CheckCircle2 } from 'lucide-react';

export const About: React.FC = () => {
  const version = "1.6.0";
  const changelogs = [
    {
        version: "1.6.0",
        date: "2025-12-15",
        title: "正向激励与全屏沉浸",
        features: [
            "🏆 连续打卡成就：连续打卡 7/14/21 天将触发全屏庆祝动画，保持 Momentum！",
            "🛑 私密缺勤提醒：未打卡不再公开发布，改为全屏强提醒，保护隐私同时拒绝摆烂。",
            "🛡️ 管理员豁免：管理员账号不再受扣分逻辑影响。",
            "💅 UI 细节优化：侧边栏显示当前 Rating 与昵称，Dashboard 新增总打卡次数统计。",
            "📝 全屏编辑器重构：算法训练与打卡日志均支持沉浸式全屏编辑。"
        ]
    },
    {
        version: "1.5.0",
        date: "2025-12-10",
        title: "AI 智能进化与管理增强",
        features: [
            "🧠 AI 英语去重：生成文章时会自动避让用户近期已背诵的单词，记忆效率翻倍。",
            "🎨 更多文章风格：新增【科技前沿】、【经典文学】、【日常对话】等多种题材。",
            "👁️ 沉浸式背词：单词释义默认模糊，鼠标悬停时才清晰显示，强化主动回忆。",
            "📊 精准数据：Dashboard 的科目分布图现在专注于展示【今日】的学习情况。",
            "🛡️ 超级管理员：后台支持直接创建新用户与删除违规用户。"
        ]
    },
    {
        version: "1.4.0",
        date: "2025-12-05",
        title: "交互体验优化与删除回滚",
        features: [
            "✨ Dashboard 布局重构：将【学习记录】与【To-Do List】置顶，操作更顺手。",
            "🔙 Rating 智能回滚：删除打卡记录时，会自动撤销当时产生的 Rating 变化。",
            "🗑️ 安全删除：新增删除确认弹窗，防止手滑误删。",
            "📝 Markdown 预览：学习记录输入框现已支持即时 Markdown 预览。"
        ]
    },
    {
        version: "1.3.0",
        date: "2025-12",
        title: "考研冲刺与 UI 重构",
        features: [
            "🎨 Dashboard 全新改版：采用 Bento Grid 风格，视觉更清爽，数据更直观。",
            "⏳ 考研倒计时：主页新增倒计时组件，时刻提醒自己珍惜时间。",
            "📚 AI 英语升级：新增词书选择（考研/四级/六级/雅思）。"
        ]
    },
    {
        version: "1.2.0",
        date: "2024-03-20",
        title: "数据透视与扣分机制上线",
        features: [
            "🔥 新增【摸鱼扣分】机制：记录无效时长并反向扣除 Rating。",
            "👀 研友透视：Dashboard 支持切换查看他人的详细数据面板。"
        ]
    },
    {
        version: "1.0.0",
        date: "2024-03-01",
        title: "KaoyanMate 诞生",
        features: [
            "✅ 基础打卡功能：支持数学、408、英语等科目。",
            "🧠 集成 DeepSeek AI：生成每日英语阅读。"
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
