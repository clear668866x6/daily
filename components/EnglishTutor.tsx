
import React, { useState, useEffect } from 'react';
import { EnglishDailyContent, SubjectCategory, User } from '../types';
import { generateEnglishDaily } from '../services/geminiService';
import { BookOpen, RefreshCw, Send, Loader2, Sparkles, History, Clock, X, ArrowRight, Book, Palette, Hash } from 'lucide-react';

interface Props {
  user: User;
  onCheckIn: (subject: SubjectCategory, content: string, duration?: number) => void;
}

export const EnglishTutor: React.FC<Props> = ({ user, onCheckIn }) => {
  const [content, setContent] = useState<EnglishDailyContent | null>(() => {
      const cached = localStorage.getItem('kaoyan_english_cache');
      return cached ? JSON.parse(cached) : null;
  });
  const [history, setHistory] = useState<EnglishDailyContent[]>(() => {
      const cached = localStorage.getItem('kaoyan_english_history');
      return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);
  const [wordCount, setWordCount] = useState(15); 
  const [selectedBook, setSelectedBook] = useState('kaoyan');
  const [selectedStyle, setSelectedStyle] = useState('academic'); 
  const [checkInModal, setCheckInModal] = useState<{ open: boolean, duration: number }>({ open: false, duration: 20 });
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
      if (content) localStorage.setItem('kaoyan_english_cache', JSON.stringify(content));
      localStorage.setItem('kaoyan_english_history', JSON.stringify(history));
  }, [content, history]);

  const fetchDaily = async () => {
    if (user.role === 'guest') return;
    setLoading(true);
    const data = await generateEnglishDaily(wordCount, selectedBook, selectedStyle);
    if (data) {
        setContent(data);
        setHistory(prev => [data, ...prev.filter(h => h.article !== data.article).slice(0, 9)]); 
    }
    setLoading(false);
  };

  const confirmCheckIn = () => {
    if (!content) return;
    const checkInText = `## AI 英语精读打卡 📖\n词数: ${content.vocabList.length}\n\n**核心词汇:**\n${content.vocabList.map(v => `- ${v.word}: ${v.definition}`).join('\n')}`;
    onCheckIn(SubjectCategory.ENGLISH, checkInText, checkInModal.duration);
    setCheckInModal({ open: false, duration: 20 });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {checkInModal.open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-80 border-t-4 border-brand-600">
                <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-brand-600" /> 阅读统计</h3>
                <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl mb-6">
                    <input type="number" value={checkInModal.duration} onChange={e => setCheckInModal({...checkInModal, duration: parseInt(e.target.value)||0})} className="w-full bg-transparent font-black text-2xl text-center" />
                    <span className="font-bold text-gray-400 text-[10px] uppercase">分钟</span>
                </div>
                <button onClick={confirmCheckIn} className="w-full bg-brand-600 text-white py-4 rounded-xl font-black shadow-lg shadow-brand-100">确认打卡</button>
            </div>
        </div>
      )}

      <div className="bg-white rounded-3xl p-8 border shadow-sm">
          <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                  <div className="bg-brand-600 p-3 rounded-2xl text-white shadow-lg shadow-brand-100"><Sparkles className="w-6 h-6" /></div>
                  <div><h1 className="text-xl font-black text-gray-800">AI 智能文章生成</h1><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">个性化英语精读</p></div>
              </div>
              <div className="flex gap-4">
                  <button onClick={() => setShowHistory(!showHistory)} className="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:text-brand-600 transition-colors"><History className="w-5 h-5"/></button>
                  <button onClick={fetchDaily} disabled={loading || user.role === 'guest'} className="bg-brand-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-brand-100 hover:bg-brand-700 flex items-center gap-3">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}立即生成
                  </button>
              </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t">
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Book className="w-3 h-3"/> 选择词书</label>
                  <select value={selectedBook} onChange={e => setSelectedBook(e.target.value)} className="w-full bg-gray-50 border px-4 py-3 rounded-2xl text-sm font-bold appearance-none cursor-pointer">
                      <option value="kaoyan">考研英语核心</option>
                      <option value="cet4">大学英语四级</option>
                      <option value="cet6">大学英语六级</option>
                      <option value="ielts">雅思学术词汇</option>
                  </select>
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Palette className="w-3 h-3"/> 文章风格</label>
                  <select value={selectedStyle} onChange={e => setSelectedStyle(e.target.value)} className="w-full bg-gray-50 border px-4 py-3 rounded-2xl text-sm font-bold appearance-none cursor-pointer">
                      <option value="academic">学术论文风格</option>
                      <option value="news">新闻报道风格</option>
                      <option value="science">科普前沿风格</option>
                      <option value="literature">文学名著风格</option>
                      <option value="daily">生活口语风格</option>
                      <option value="opinion">观点评论风格</option>
                      <option value="biography">人物传记风格</option>
                      <option value="travel">地理游记风格</option>
                      <option value="economics">经济学人风格</option>
                      <option value="technology">硅谷科技风格</option>
                  </select>
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Hash className="w-3 h-3"/> 生词数量</label>
                  <input type="number" value={wordCount} onChange={e => setWordCount(parseInt(e.target.value))} className="w-full bg-gray-50 border px-4 py-3 rounded-2xl text-sm font-bold" min="5" max="30" />
              </div>
          </div>
      </div>

      {showHistory ? (
        <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4 animate-fade-in">
            <div className="flex justify-between items-center mb-4"><h3 className="font-black text-gray-700">历史生成记录</h3><button onClick={() => setShowHistory(false)}><X className="w-5 h-5 text-gray-400"/></button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {history.map((h, i) => (
                    <button key={i} onClick={() => {setContent(h); setShowHistory(false);}} className="text-left p-6 rounded-2xl border hover:border-brand-500 hover:bg-brand-50 transition-all">
                        <p className="text-sm font-black text-gray-600 truncate mb-2">{h.article.substring(0, 50)}...</p>
                        <span className="text-[10px] text-gray-400 font-bold">{h.date} · {h.vocabList.length} 单词</span>
                    </button>
                ))}
            </div>
        </div>
      ) : content && (
        <div className="bg-white p-10 rounded-[40px] shadow-sm border space-y-10">
            <article className="prose prose-slate max-w-none"><p className="text-xl leading-[2] text-gray-800 font-serif whitespace-pre-line">{content.article}</p></article>
            <div className="mt-8 pt-8 border-t">
              <h3 className="font-black text-gray-800 mb-4">中文参考翻译</h3>
              <p className="text-gray-600 leading-relaxed italic">{content.translation}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-8 bg-gray-50/50 rounded-3xl border">
                {content.vocabList.map((v, i) => (
                    <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-[10px] font-black text-brand-600">{i+1}</div>
                        <div><div className="font-black text-sm text-gray-800">{v.word}</div><div className="text-[10px] text-gray-400 font-bold">{v.definition}</div></div>
                    </div>
                ))}
            </div>
            <div className="flex justify-end pt-6 border-t"><button onClick={() => setCheckInModal({open: true, duration: 20})} className="bg-brand-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-brand-100 hover:bg-brand-700 active:scale-95 transition-all">确认今日打卡</button></div>
        </div>
      )}
    </div>
  );
};
