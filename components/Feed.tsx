
import React, { useState, useRef } from 'react';
import { CheckIn, SubjectCategory, User } from '../types';
import { MarkdownText } from './MarkdownText';
import { Image as ImageIcon, Send, ThumbsUp, X, Filter, Eye, Edit2, Lock } from 'lucide-react';

interface Props {
  checkIns: CheckIn[];
  user: User;
  onAddCheckIn: (checkIn: CheckIn) => void;
  onLike: (id: string) => void;
}

export const Feed: React.FC<Props> = ({ checkIns, user, onAddCheckIn, onLike }) => {
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState<SubjectCategory>(SubjectCategory.MATH);
  const [image, setImage] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterSubject, setFilterSubject] = useState<string>('ALL');

  const isGuest = user.role === 'guest';

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (isGuest) return; // 安全拦截
    if (!content.trim()) return;

    const newCheckIn: CheckIn = {
      id: Date.now().toString(),
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      subject,
      content,
      imageUrl: image || undefined,
      timestamp: Date.now(),
      likedBy: []
    };

    onAddCheckIn(newCheckIn);
    setContent('');
    setImage(null);
    setIsPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLikeClick = (id: string) => {
    if (isGuest) {
      alert("👀 访客模式仅供预览，请注册账号后参与互动。");
      return;
    }
    onLike(id);
  };

  const filteredCheckIns = filterSubject === 'ALL' 
    ? checkIns 
    : checkIns.filter(c => c.subject === filterSubject);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Input Area / Guest Banner */}
      {isGuest ? (
        <div className="bg-gray-100 p-6 rounded-2xl border border-gray-200 flex flex-col items-center justify-center text-center space-y-2">
          <Lock className="w-8 h-8 text-gray-400" />
          <h3 className="font-bold text-gray-700">访客模式 · 仅浏览</h3>
          <p className="text-sm text-gray-500">你需要登录或注册账号才能发布打卡动态。</p>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">今天学了什么？</h2>
            <button 
              onClick={() => setIsPreview(!isPreview)}
              className="text-xs flex items-center space-x-1 text-gray-600 hover:text-brand-600 transition-colors bg-gray-100 px-3 py-1.5 rounded-full"
            >
              {isPreview ? <><Edit2 className="w-3 h-3"/><span>切换编辑</span></> : <><Eye className="w-3 h-3"/><span>预览效果</span></>}
            </button>
          </div>
          
          <div className="space-y-4">
            <select 
              value={subject} 
              onChange={(e) => setSubject(e.target.value as SubjectCategory)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <optgroup label="基础学科">
                <option value={SubjectCategory.MATH}>{SubjectCategory.MATH}</option>
                <option value={SubjectCategory.ENGLISH}>{SubjectCategory.ENGLISH}</option>
                <option value={SubjectCategory.POLITICS}>{SubjectCategory.POLITICS}</option>
                <option value={SubjectCategory.ALGORITHM}>{SubjectCategory.ALGORITHM}</option>
              </optgroup>
              <optgroup label="408 计算机综合">
                <option value={SubjectCategory.CS_DS}>{SubjectCategory.CS_DS}</option>
                <option value={SubjectCategory.CS_CO}>{SubjectCategory.CS_CO}</option>
                <option value={SubjectCategory.CS_OS}>{SubjectCategory.CS_OS}</option>
                <option value={SubjectCategory.CS_CN}>{SubjectCategory.CS_CN}</option>
              </optgroup>
            </select>
            
            {isPreview ? (
              <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl min-h-[120px] prose prose-sm max-w-none">
                {content ? <MarkdownText content={content} /> : <span className="text-gray-400 italic">暂无内容，请切换到编辑模式输入...</span>}
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="支持 Markdown 语法：&#10;# 一级标题  ## 二级标题&#10;**加粗文字**&#10;- 列表项&#10;```代码块```"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none font-mono text-sm leading-relaxed"
              />
            )}

            {image && (
              <div className="relative inline-block">
                <img src={image} alt="Preview" className="h-32 rounded-lg object-cover border border-gray-200" />
                <button 
                  onClick={() => setImage(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <div className="flex space-x-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  title="上传图片"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                />
              </div>
              <button 
                onClick={handleSubmit}
                disabled={!content.trim()}
                className="bg-brand-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-md hover:shadow-lg transition-all"
              >
                <Send className="w-4 h-4" />
                <span>发布动态</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />
        <button 
          onClick={() => setFilterSubject('ALL')}
          className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${filterSubject === 'ALL' ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
        >
          全部
        </button>
        {Object.values(SubjectCategory).map(cat => (
          <button
            key={cat}
            onClick={() => setFilterSubject(cat)}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${filterSubject === cat ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-6">
        {filteredCheckIns.map(checkIn => {
          const isLiked = checkIn.likedBy.includes(user.id);
          const likeCount = checkIn.likedBy.length;
          
          return (
            <div key={checkIn.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <img src={checkIn.userAvatar} alt={checkIn.userName} className="w-10 h-10 rounded-full bg-gray-200" />
                  <div>
                    <h3 className="font-bold text-gray-900">{checkIn.userName}</h3>
                    <p className="text-xs text-gray-500">
                      {new Date(checkIn.timestamp).toLocaleString('zh-CN')} · <span className="text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">{checkIn.subject}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <MarkdownText content={checkIn.content} />
              </div>

              {checkIn.imageUrl && (
                <div className="mb-4">
                  <img src={checkIn.imageUrl} alt="Check-in" className="rounded-xl max-h-96 object-cover w-full border border-gray-100" />
                </div>
              )}

              <div className="flex items-center space-x-6 border-t border-gray-50 pt-4">
                <button 
                  onClick={() => handleLikeClick(checkIn.id)}
                  className={`flex items-center space-x-2 transition-colors group ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'} ${isGuest ? 'cursor-not-allowed opacity-60' : ''}`}
                  title={isGuest ? "访客无法点赞" : (isLiked ? "取消点赞" : "点赞")}
                >
                  <ThumbsUp className={`w-5 h-5 ${isLiked ? 'fill-current' : 'group-hover:scale-110'}`} />
                  <span>{likeCount > 0 ? likeCount : '赞'}</span>
                </button>
              </div>
            </div>
          );
        })}
        {filteredCheckIns.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            暂无该科目的打卡记录，快来抢沙发！
          </div>
        )}
      </div>
    </div>
  );
};
