
import React, { useState, useEffect } from 'react';
import { EnglishDailyContent, SubjectCategory, User } from '../types';
import { generateEnglishDaily } from '../services/geminiService';
import { getUserCheckIns } from '../services/storageService';
import { BookOpen, RefreshCw, Send, Loader2, Languages, Lock, Sparkles, Coffee, ChevronDown, Library, Palette, Eye } from 'lucide-react';

interface Props {
  user: User;
  onCheckIn: (subject: SubjectCategory, content: string) => void;
}

export const EnglishTutor: React.FC<Props> = ({ user, onCheckIn }) => {
  // Persistence: Initialize state from localStorage if available
  const [content, setContent] = useState<EnglishDailyContent | null>(() => {
      const cached = localStorage.getItem('kaoyan_english_cache');
      return cached ? JSON.parse(cached) : null;
  });
  
  const [loading, setLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  
  // Settings
  const [wordCount, setWordCount] = useState(5); 
  const [selectedBook, setSelectedBook] = useState('kaoyan');
  const [selectedStyle, setSelectedStyle] = useState('academic'); 
  const [selectedWord, setSelectedWord] = useState<string | null>(null); 
  
  // Stats
  const [learnedWordsCount, setLearnedWordsCount] = useState(0);

  const isGuest = user.role === 'guest';

  // Persistence: Save to localStorage whenever content changes
  useEffect(() => {
      if (content) {
          localStorage.setItem('kaoyan_english_cache', JSON.stringify(content));
      }
  }, [content]);

  // Load stats just for display/logic
  useEffect(() => {
      const loadHistory = async () => {
          if (isGuest) return;
          const checkIns = await getUserCheckIns(user.id);
          const engCheckIns = checkIns.filter(c => c.subject === SubjectCategory.ENGLISH);
          // 简单的估算：每个打卡按5个词算，或者之后可以解析内容
          setLearnedWordsCount(engCheckIns.length * 5); 
      }
      loadHistory();
  }, [user.id, isGuest]);

  const fetchDaily = async () => {
    if (isGuest) return;
    setLoading(true);
    setSelectedWord(null); 
    
    // 1. 获取历史打卡记录进行去重
    let excludeList: string[] = [];
    try {
        const checkIns = await getUserCheckIns(user.id);
        const engCheckIns = checkIns.filter(c => c.subject === SubjectCategory.ENGLISH).slice(0, 20); // 只取最近20条
        
        // 解析打卡内容中的单词: 格式通常为 "- word: definition"
        const regex = /- ([a-zA-Z\s]+):/g;
        engCheckIns.forEach(c => {
            let match;
            while ((match = regex.exec(c.content)) !== null) {
                if (match[1] && match[1].trim().length > 2) {
                    excludeList.push(match[1].trim());
                }
            }
        });
        // 去重
        excludeList = [...new Set(excludeList)];
        console.log("Excluding words:", excludeList);
    } catch (e) {
        console.warn("Failed to fetch history for dedup", e);
    }

    // 2. 调用 API, 传入自定义参数
    const data = await generateEnglishDaily(wordCount, selectedBook, selectedStyle, excludeList);
    
    if (data) {
        setContent(data);
    }
    
    setLoading(false);
    setShowTranslation(false);
  };

  const handleQuickCheckIn = () => {
    if (isGuest) return;
    if (!content) return;
    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const checkInText = `## 每日AI英语阅读打卡 (${timeStr})\n\n学习了关于 "${content.article.substring(0, 20)}..." 的文章，重点背诵了 ${content.vocabList.length} 个单词。\n\n**今日新词：**\n${content.vocabList.map(v => `- ${v.word}: ${v.definition}`).join('\n')}\n\n感悟：DeepSeek 出题很有深度，上下文释义功能很好用！`;
    onCheckIn(SubjectCategory.ENGLISH, checkInText);
  };

  // 自定义渲染文章，解析 {{word}} 格式
  const renderArticle = (text: string) => {
    const parts = text.split(/(\{\{.*?\}\})/g);
    return parts.map((part, index) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        const word = part.slice(2, -2);
        const isSelected = selectedWord === word;
        return (
          <span 
            key={index}
            onClick={() => setSelectedWord(word)}
            className={`cursor-pointer px-1 rounded transition-all font-semibold border-b-2 ${
                isSelected 
                ? 'bg-brand-100 border-brand-500 text-brand-700' 
                : 'border-brand-300 hover:bg-brand-50 text-gray-800'
            }`}
            title="点击查看上下文释义"
          >
            {word}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const getCurrentDefinition = () => {
      if (!selectedWord || !content) return null;
      const found = content.vocabList.find(v => 
          selectedWord.toLowerCase().includes(v.word.toLowerCase()) || 
          v.word.toLowerCase().includes(selectedWord.toLowerCase())
      );
      return found ? found.definition : "暂无释义，请参考下方完整单词表";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-500" />
            AI 英语阅读教练
          </h2>
          <p className="text-gray-500 text-sm">已累计学习约 {learnedWordsCount} 个单词，智能去重已开启</p>
        </div>
        
        {/* Settings Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
             <div className="flex items-center gap-2 px-2 border-r border-gray-100">
                <Library className="w-4 h-4 text-gray-400" />
                <select 
                    value={selectedBook}
                    onChange={(e) => setSelectedBook(e.target.value)}
                    className="text-sm text-gray-700 bg-transparent focus:outline-none cursor-pointer font-medium max-w-[80px]"
                >
                    <option value="kaoyan">考研</option>
                    <option value="cet4">四级</option>
                    <option value="cet6">六级</option>
                    <option value="ielts">雅思</option>
                </select>
            </div>

            <div className="flex items-center gap-2 px-2 border-r border-gray-100">
                <Palette className="w-4 h-4 text-gray-400" />
                <select 
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="text-sm text-gray-700 bg-transparent focus:outline-none cursor-pointer font-medium max-w-[80px]"
                >
                    <option value="academic">学术</option>
                    <option value="news">新闻</option>
                    <option value="narrative">记叙</option>
                    <option value="philosophy">哲理</option>
                    <option value="science">科技</option>
                    <option value="literature">文学</option>
                    <option value="dialogue">对话</option>
                </select>
            </div>

            <div className="flex items-center gap-2 px-2">
                <span className="text-sm text-gray-600">词数:</span>
                <input 
                    type="number" 
                    min="3" 
                    max="20" 
                    value={wordCount}
                    onChange={(e) => setWordCount(parseInt(e.target.value) || 5)}
                    className="w-12 border border-gray-300 rounded px-1 text-center text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
            </div>

            <button 
                onClick={fetchDaily} 
                disabled={loading || isGuest}
                className="flex items-center space-x-2 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors text-sm font-medium ml-1"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>{content ? '换一篇' : '生成'}</span>
            </button>
        </div>
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
          <h3 className="text-lg font-bold text-gray-800">AI 正在为您编写文章...</h3>
          <p className="text-gray-500 mt-2">基于 {selectedBook.toUpperCase()} 词汇库构建 {selectedStyle} 语境 (智能避让生词)</p>
        </div>
      ) : content ? (
        <div className="space-y-6 animate-fade-in">
            {/* 文章卡片 */}
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <BookOpen className="w-40 h-40" />
              </div>

              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex gap-2">
                    <span className="bg-brand-50 text-brand-700 text-xs font-bold px-2 py-1 rounded-full border border-brand-100 uppercase">
                        {selectedBook === 'kaoyan' ? 'Postgraduate' : selectedBook}
                    </span>
                    <span className="bg-purple-50 text-purple-700 text-xs font-bold px-2 py-1 rounded-full border border-purple-100 uppercase">
                        {selectedStyle}
                    </span>
                </div>
                <span className="text-gray-400 text-sm font-mono">{content.date}</span>
              </div>
              
              <article className="prose prose-slate max-w-none mb-8 relative z-10">
                <p className="text-lg leading-loose text-gray-800 font-serif whitespace-pre-line">
                  {renderArticle(content.article)}
                </p>
              </article>

              {/* 动态单词释义条 */}
              <div className={`transition-all duration-300 overflow-hidden relative z-10 ${selectedWord ? 'max-h-32 opacity-100 mb-6' : 'max-h-0 opacity-0'}`}>
                  <div className="bg-brand-50 border border-brand-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center gap-3 shadow-sm">
                      <div className="bg-brand-500 text-white font-bold px-3 py-1 rounded-lg w-fit">
                          {selectedWord}
                      </div>
                      <div className="text-gray-700 font-medium text-sm md:text-base">
                          {getCurrentDefinition()}
                      </div>
                  </div>
              </div>
              
              <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-4 justify-between items-center relative z-10">
                <div className="flex gap-4">
                    <button 
                        onClick={() => setShowTranslation(!showTranslation)}
                        className="flex items-center space-x-2 text-gray-500 hover:text-brand-600 text-sm font-medium transition-colors"
                    >
                        <Languages className="w-4 h-4" />
                        <span>{showTranslation ? '隐藏全文翻译' : '查看全文翻译'}</span>
                    </button>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> 鼠标悬停单词即可查看释义
                    </span>
                </div>

                <button 
                    onClick={handleQuickCheckIn}
                    className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-brand-700 flex items-center gap-2"
                >
                    <Send className="w-4 h-4" /> 打卡
                </button>
              </div>

              {showTranslation && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl text-gray-600 text-sm leading-relaxed whitespace-pre-line animate-fade-in relative z-10 border border-gray-200">
                    <h4 className="font-bold text-gray-700 mb-2 text-xs uppercase">Reference Translation</h4>
                    {content.translation}
                  </div>
              )}
            </div>

            {/* 底部单词表 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <details className="group" open>
                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors list-none select-none">
                        <div className="flex items-center gap-2 font-bold text-gray-700">
                            <BookOpen className="w-5 h-5 text-brand-500" />
                            <span>核心词汇 ({content.vocabList.length})</span>
                            <span className="text-xs font-normal text-gray-400 ml-2">结合语境记忆</span>
                        </div>
                        <div className="text-gray-400 group-open:rotate-180 transition-transform">
                            <ChevronDown className="w-5 h-5" />
                        </div>
                    </summary>
                    <div className="p-4 pt-0 border-t border-gray-50 bg-gray-50/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                            {content.vocabList.map((item, idx) => (
                                <div key={idx} className="flex flex-col p-3 bg-white rounded-xl border border-gray-100 hover:border-brand-200 transition-colors group/word relative overflow-hidden">
                                    <span className="font-bold text-gray-800 text-lg group-hover/word:text-brand-600 transition-colors">{item.word}</span>
                                    {/* 默认模糊，Hover时清晰 */}
                                    <div className="mt-1 transition-all duration-300 filter blur-[4px] group-hover/word:blur-0 select-none group-hover/word:select-text">
                                        <span className="text-sm text-gray-500">
                                            {item.definition}
                                        </span>
                                    </div>
                                    <div className="absolute bottom-2 right-2 opacity-100 group-hover/word:opacity-0 transition-opacity pointer-events-none">
                                        <Eye className="w-4 h-4 text-gray-300" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </details>
            </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-sm flex flex-col items-center">
            <div className="bg-blue-50 p-4 rounded-full mb-6">
                <Coffee className="w-12 h-12 text-blue-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">准备好开始今天的阅读了吗？</h3>
            <p className="text-gray-500 max-w-md mb-8 leading-relaxed">
                上次阅读的内容已为您保存。点击生成，获取全新的上下文定制文章。
            </p>
            <button 
                onClick={fetchDaily}
                disabled={loading}
                className={`text-white text-lg font-bold px-8 py-4 rounded-xl shadow-xl shadow-blue-200 transition-all flex items-center gap-3 ${
                    loading
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1'
                }`}
            >
                <Sparkles className="w-5 h-5" />
                {loading ? '生成中...' : `开始生成`}
            </button>
        </div>
      )}
    </div>
  );
};
