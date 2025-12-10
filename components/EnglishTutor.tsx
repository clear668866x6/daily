
import React, { useState, useEffect } from 'react';
import { EnglishDailyContent, SubjectCategory, User } from '../types';
import { generateEnglishDaily } from '../services/geminiService';
import { BookOpen, RefreshCw, Send, Loader2, Languages, Lock, Sparkles, Coffee, Clock } from 'lucide-react';

interface Props {
  user: User;
  onCheckIn: (subject: SubjectCategory, content: string) => void;
}

export const EnglishTutor: React.FC<Props> = ({ user, onCheckIn }) => {
  const [content, setContent] = useState<EnglishDailyContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [cooldown, setCooldown] = useState(false); // 冷却状态，防止短时间连续点击

  const isGuest = user.role === 'guest';
  const todayStr = new Date().toISOString().split('T')[0];
  const storageKey = `kaoyan_english_daily_${todayStr}`;

  useEffect(() => {
    // 1. 初始化时仅读取缓存，绝不自动调用 API
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      try {
        setContent(JSON.parse(cached));
      } catch (e) {
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  const fetchDaily = async () => {
    if (isGuest || cooldown) return;
    
    setLoading(true);
    setCooldown(true); // 开启冷却，防止重复点击
    
    // 调用 Gemini API
    const data = await generateEnglishDaily();
    
    if (data) {
        setContent(data);
        localStorage.setItem(storageKey, JSON.stringify(data)); // 覆盖更新今日缓存
    }
    
    setLoading(false);
    setShowTranslation(false);

    // 10秒后才允许再次点击，防止触发 API 429 速率限制
    setTimeout(() => {
        setCooldown(false);
    }, 10000);
  };

  const handleQuickCheckIn = () => {
    if (isGuest) return;
    if (!content) return;
    // 打卡内容包含当前时间，区分多次打卡
    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const checkInText = `## 每日AI英语阅读打卡 (${timeStr})\n\n学习了关于 "${content.article.substring(0, 20)}..." 的文章。\n\n**核心词汇：**\n${content.vocabList.slice(0, 5).map(v => `- ${v.word}: ${v.definition}`).join('\n')}\n\n感悟：文章生词较多，但逻辑清晰，已背诵！`;
    onCheckIn(SubjectCategory.ENGLISH, checkInText);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-500" />
            Gemini 每日英语
          </h2>
          <p className="text-gray-500 text-sm">AI 精选考研高频词生成的阅读理解</p>
        </div>
        
        {/* 右上角按钮：只要有内容就显示，允许用户多次生成 */}
        {content && (
            <button 
            onClick={fetchDaily} 
            disabled={loading || isGuest || cooldown}
            className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
                cooldown 
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-brand-600'
            }`}
            title="生成新的文章进行练习"
            >
            {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : cooldown ? (
                <Clock className="w-4 h-4 animate-pulse" />
            ) : (
                <RefreshCw className="w-4 h-4" />
            )}
            <span>
                {loading ? '生成中...' : cooldown ? '请稍候...' : '换一篇练习'}
            </span>
            </button>
        )}
      </div>

      {isGuest && !content && (
        <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-gray-400 h-64">
           <Lock className="w-10 h-10 mb-4 opacity-50"/>
           <p>访客模式下无法调用 AI 生成新文章</p>
        </div>
      )}

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm animate-pulse">
          <Loader2 className="w-12 h-12 text-brand-600 animate-spin mb-6" />
          <h3 className="text-lg font-bold text-gray-800">Gemini 正在思考中...</h3>
          <p className="text-gray-500 mt-2">正在从考研大纲中抽取词汇编写文章</p>
        </div>
      ) : content ? (
        // --- 已有文章内容的视图 ---
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-brand-50 text-brand-700 text-xs font-bold px-2 py-1 rounded-full">Reading Comprehension</span>
                <span className="text-gray-400 text-sm">{content.date}</span>
              </div>
              <article className="prose prose-slate max-w-none mb-6">
                <p className="text-lg leading-relaxed text-gray-800 font-serif whitespace-pre-line">
                  {content.article}
                </p>
              </article>
              
              <div className="border-t border-gray-100 pt-4">
                <button 
                  onClick={() => setShowTranslation(!showTranslation)}
                  className="flex items-center space-x-2 text-brand-600 hover:text-brand-700 text-sm font-medium"
                >
                  <Languages className="w-4 h-4" />
                  <span>{showTranslation ? '隐藏翻译' : '查看全文翻译'}</span>
                </button>
                {showTranslation && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                    {content.translation}
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl p-6 text-white flex items-center justify-between shadow-lg shadow-brand-200">
              <div>
                <h3 className="font-bold text-lg">完成阅读了？</h3>
                <p className="text-brand-100 text-sm">{isGuest ? '注册账号以记录你的进步' : '一键打卡到动态圈，记录你的进步'}</p>
              </div>
              <button 
                onClick={handleQuickCheckIn}
                disabled={isGuest}
                className="bg-white text-brand-600 px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-brand-50 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGuest ? <Lock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                <span>{isGuest ? '访客不可打卡' : '一键打卡'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-6">
              <div className="flex items-center space-x-2 mb-4">
                <BookOpen className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-gray-800">核心词汇</h3>
              </div>
              <ul className="space-y-3">
                {content.vocabList.map((item, idx) => (
                  <li key={idx} className="group p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="font-bold text-gray-800 group-hover:text-brand-600 transition-colors">
                      {item.word}
                    </div>
                    <div className="text-sm text-gray-500">{item.definition}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        // --- 还没有生成文章时的空状态视图 (默认显示这个) ---
        !isGuest && (
            <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-sm flex flex-col items-center">
                <div className="bg-brand-50 p-4 rounded-full mb-6">
                    <Coffee className="w-12 h-12 text-brand-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">准备好开始今天的阅读了吗？</h3>
                <p className="text-gray-500 max-w-md mb-8 leading-relaxed">
                    点击下方按钮，Gemini 将为你生成一篇包含 30-50 个考研大纲词汇的短文。坚持每天一篇，轻松搞定长难句。
                </p>
                <button 
                    onClick={fetchDaily}
                    disabled={loading || cooldown}
                    className={`text-white text-lg font-bold px-8 py-4 rounded-xl shadow-xl shadow-brand-200 transition-all flex items-center gap-3 ${
                        loading || cooldown 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-brand-600 hover:bg-brand-700 hover:-translate-y-1'
                    }`}
                >
                    <Sparkles className="w-5 h-5" />
                    {loading ? '生成中...' : '立即生成今日文章'}
                </button>
            </div>
        )
      )}
    </div>
  );
};
