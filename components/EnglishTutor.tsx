
import React, { useState, useEffect } from 'react';
import { EnglishDailyContent, SubjectCategory, User } from '../types';
import { generateEnglishDaily } from '../services/geminiService';
import { BookOpen, RefreshCw, Send, Loader2, Languages, Lock } from 'lucide-react';

interface Props {
  user: User;
  onCheckIn: (subject: SubjectCategory, content: string) => void;
}

export const EnglishTutor: React.FC<Props> = ({ user, onCheckIn }) => {
  const [content, setContent] = useState<EnglishDailyContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const isGuest = user.role === 'guest';

  const fetchDaily = async () => {
    if (isGuest) return;
    setLoading(true);
    const data = await generateEnglishDaily();
    setContent(data);
    setLoading(false);
    setShowTranslation(false);
  };

  useEffect(() => {
    // Load on mount if not exists
    if (!content && !isGuest) fetchDaily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuickCheckIn = () => {
    if (isGuest) return;
    if (!content) return;
    const checkInText = `## 每日AI英语阅读打卡\n\n学习了关于 "${content.article.substring(0, 20)}..." 的文章。\n\n**核心词汇：**\n${content.vocabList.slice(0, 5).map(v => `- ${v.word}: ${v.definition}`).join('\n')}\n\n感悟：文章生词较多，但逻辑清晰，已背诵！`;
    onCheckIn(SubjectCategory.ENGLISH, checkInText);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gemini 每日英语</h2>
          <p className="text-gray-500 text-sm">AI 为你精选 30-50 个考研高频词生成的阅读理解</p>
        </div>
        <button 
          onClick={fetchDaily} 
          disabled={loading || isGuest}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title={isGuest ? "访客无法生成" : "生成新文章"}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span>{isGuest ? '访客无法生成' : '生成新文章'}</span>
        </button>
      </div>

      {isGuest && !content && (
        <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-gray-400">
           <Lock className="w-10 h-10 mb-2 opacity-50"/>
           <p>访客模式下无法调用 AI 生成新文章</p>
        </div>
      )}

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-4" />
          <p className="text-gray-500">Gemini 正在思考并生成今日考研阅读文章...</p>
        </div>
      ) : content ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-brand-50 text-brand-700 text-xs font-bold px-2 py-1 rounded-full">Reading Comprehension</span>
                <span className="text-gray-400 text-sm">{content.date}</span>
              </div>
              <article className="prose prose-slate max-w-none mb-6">
                <p className="text-lg leading-relaxed text-gray-800 font-serif">
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
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl text-gray-600 text-sm leading-relaxed">
                    {content.translation}
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl p-6 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">完成今日阅读了？</h3>
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
                  <li key={idx} className="group">
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
      ) : null}
    </div>
  );
};
