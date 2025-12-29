
import React, { useState, useRef, useMemo } from 'react';
import { CheckIn, SubjectCategory, User, getUserStyle } from '../types'; 
import { MarkdownText } from './MarkdownText';
import { Image as ImageIcon, Send, ThumbsUp, X, Filter, Eye, Edit2, Lock, Megaphone, Clock, Search, User as UserIcon, Calendar as CalendarIcon, ArrowLeft, Pin, Trash2 } from 'lucide-react';
import { FullScreenEditor } from './FullScreenEditor';
import { FILTER_GROUPS } from '../constants';
import { compressImage } from '../services/imageUtils';

interface Props {
  checkIns: CheckIn[];
  user: User;
  onAddCheckIn: (checkIn: CheckIn) => void;
  onLike: (id: string) => void;
  onDeleteCheckIn: (id: string) => void;
  onUpdateCheckIn: (id: string, content: string) => void;
  onViewUserProfile: (userId: string) => void;
}

export const Feed: React.FC<Props> = ({ checkIns, user, onAddCheckIn, onLike, onDeleteCheckIn, onUpdateCheckIn, onViewUserProfile }) => {
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState<SubjectCategory>(SubjectCategory.MATH);
  const [image, setImage] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [isAnnouncement, setIsAnnouncement] = useState(false); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFilterId, setActiveFilterId] = useState('ALL');

  // Advanced Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchSubject, setSearchSubject] = useState<string>('ALL');

  // Edit State
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | null>(null);

  const isGuest = user.role === 'guest';
  const isAdmin = user.role === 'admin';

  const getSubjectTheme = (sub: string) => {
    if (sub === SubjectCategory.MATH) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (sub === SubjectCategory.ENGLISH) return 'bg-violet-50 text-violet-700 border-violet-200';
    if (sub === SubjectCategory.POLITICS) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (sub === SubjectCategory.ALGORITHM) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (sub === SubjectCategory.DAILY) return 'bg-slate-50 text-slate-700 border-slate-200';
    if ([SubjectCategory.CS_DS, SubjectCategory.CS_CO, SubjectCategory.CS_OS, SubjectCategory.CS_CN].includes(sub as any)) {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
          const compressed = await compressImage(file);
          setImage(compressed);
      } catch (err) {
          console.error("Compression failed", err);
          // Fallback if needed, or show toast
      }
    }
  };

  const handleSubmit = () => {
    if (isGuest) return; 
    if (!content.trim()) return;

    const newCheckIn: CheckIn = {
      id: Date.now().toString(),
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      userRating: user.rating, 
      userRole: user.role,
      subject,
      content,
      imageUrl: image || undefined,
      isAnnouncement: isAdmin && isAnnouncement, 
      timestamp: Date.now(),
      likedBy: []
    };

    onAddCheckIn(newCheckIn);
    setContent('');
    setImage(null);
    setIsPreview(false);
    setIsAnnouncement(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveEdit = (newContent: string) => {
      if (editingCheckIn) {
          onUpdateCheckIn(editingCheckIn.id, newContent);
          setEditingCheckIn(null);
      }
  }

  // Regular Feed Filtering
  const { announcements, regularPosts } = useMemo(() => {
    const pinned = checkIns.filter(c => !!c.isAnnouncement);
    const regular = checkIns.filter(c => !c.isAnnouncement);
    
    if (activeFilterId === 'ANNOUNCEMENT') {
        return { announcements: [], regularPosts: pinned };
    }

    let filteredRegular = regular;
    if (activeFilterId !== 'ALL') {
        const group = FILTER_GROUPS.find(g => g.id === activeFilterId);
        if (group && group.subjects) {
            filteredRegular = regular.filter(c => group.subjects?.includes(c.subject));
        }
    }
    
    return { announcements: pinned, regularPosts: filteredRegular };
  }, [activeFilterId, checkIns]);

  // Advanced Search Filtering
  const searchResults = useMemo(() => {
      if (!isSearchOpen) return [];
      
      return checkIns.filter(c => {
          let matchUser = true;
          let matchDate = true;
          let matchSubject = true;

          if (searchUser) {
              matchUser = c.userName.toLowerCase().includes(searchUser.toLowerCase());
          }
          if (searchDate) {
              const dateStr = new Date(c.timestamp).toISOString().split('T')[0];
              matchDate = dateStr === searchDate;
          }
          if (searchSubject !== 'ALL') {
              matchSubject = c.subject === searchSubject;
          }

          return matchUser && matchDate && matchSubject;
      }).sort((a, b) => b.timestamp - a.timestamp);
  }, [checkIns, isSearchOpen, searchUser, searchDate, searchSubject]);

  const renderCard = (checkIn: CheckIn, isPinned: boolean = false) => {
    const isLiked = checkIn.likedBy.includes(user.id);
    const likeCount = checkIn.likedBy.length;
    const isOfficial = checkIn.userRole === 'admin';
    const isOwner = user.id === checkIn.userId;
    const canDelete = isOwner || isAdmin;
    const canEdit = isOwner || isAdmin;

    const nameStyle = getUserStyle(checkIn.userRole || 'user', checkIn.userRating ?? 1200);
    const subjectTheme = getSubjectTheme(checkIn.subject);

    return (
        <div 
          key={checkIn.id} 
          className={`bg-white rounded-3xl p-6 shadow-sm border transition-all hover:shadow-md relative overflow-hidden group
              ${isPinned 
                  ? 'border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30 ring-1 ring-indigo-100' 
                  : 'border-gray-100 hover:border-gray-200'
              }
          `}
        >
            {isPinned && (
                <>
                    <div className="absolute top-0 right-0 p-3 z-20">
                         <div className="bg-indigo-600 text-white p-1.5 rounded-full shadow-lg shadow-indigo-200 transform rotate-12">
                             <Pin className="w-4 h-4 fill-current" />
                         </div>
                    </div>
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-indigo-100 rounded-full opacity-50 blur-xl pointer-events-none"></div>
                </>
            )}

            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="relative cursor-pointer group/avatar" onClick={() => onViewUserProfile(checkIn.userId)}>
                        <img 
                          src={checkIn.userAvatar || 'https://api.dicebear.com/7.x/notionists/svg?seed=Unknown'} 
                          alt={checkIn.userName || 'User'} 
                          className={`w-11 h-11 rounded-full bg-gray-50 object-cover border-2 transition-transform group-hover/avatar:scale-110 ${isOfficial ? 'border-indigo-200' : 'border-white shadow-sm'}`} 
                        />
                        {isOfficial && (
                          <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white rounded-full p-0.5 border-2 border-white">
                              <Megaphone className="w-2.5 h-2.5" />
                          </div>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => onViewUserProfile(checkIn.userId)}
                                className={`text-base font-bold hover:underline cursor-pointer ${nameStyle}`}
                            >
                                {checkIn.userName || '未知研友'}
                            </button>
                            {isOfficial && (
                                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded">官方</span>
                            )}
                            {isPinned && (
                                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                    公告
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 font-mono">
                            <span>{new Date(checkIn.timestamp).toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}</span>
                            {checkIn.duration > 0 && (
                                <span className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded text-gray-500 border border-gray-100">
                                    <Clock className="w-3 h-3" /> {checkIn.duration}m
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                
                {!isPinned && (
                    <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${subjectTheme} flex items-center gap-1.5`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50"></span>
                        {checkIn.subject}
                    </div>
                )}
            </div>

            <div className={`mb-4 text-sm leading-relaxed relative z-10 pl-1 ${isPinned ? 'text-gray-900 font-medium' : 'text-gray-800'}`}>
                <MarkdownText content={checkIn.content} />
            </div>

            {checkIn.imageUrl && (
                <div className="mb-5 relative z-10 rounded-2xl overflow-hidden border border-gray-100 max-w-sm">
                    <img 
                      src={checkIn.imageUrl} 
                      alt="Post" 
                      className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                </div>
            )}

            <div className={`flex items-center gap-6 pt-4 border-t ${isPinned ? 'border-indigo-100' : 'border-gray-50'} relative z-10`}>
                <button 
                onClick={() => onLike(checkIn.id)}
                disabled={isGuest}
                className={`flex items-center gap-2 text-sm font-medium transition-all group/btn ${
                    isLiked ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'
                } ${isGuest ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                    <div className={`p-1.5 rounded-full transition-colors ${isLiked ? 'bg-rose-50' : 'group-hover/btn:bg-gray-100'}`}>
                    <ThumbsUp className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                    </div>
                    <span>{likeCount || '赞'}</span>
                </button>
                
                <div className="ml-auto flex items-center gap-2">
                    {canEdit && (
                        <button 
                            onClick={() => setEditingCheckIn(checkIn)}
                            className="text-gray-300 hover:text-brand-500 transition-colors p-1.5 rounded-full hover:bg-brand-50"
                            title="编辑"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    )}
                    {canDelete && (
                        <button 
                            onClick={() => onDeleteCheckIn(checkIn.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1.5 rounded-full hover:bg-red-50"
                            title="删除"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
  };

  // Full Screen Search Modal Content
  if (isSearchOpen) {
      return (
          <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col animate-fade-in overflow-hidden">
              {/* Search Header */}
              <div className="bg-white border-b border-gray-200 p-4 shadow-sm flex flex-col gap-4 sticky top-0 z-20">
                  <div className="flex items-center gap-3">
                      <button onClick={() => setIsSearchOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                          <ArrowLeft className="w-6 h-6 text-gray-600" />
                      </button>
                      <h2 className="text-xl font-bold text-gray-800">全站日志检索</h2>
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                      <div className="flex-1 min-w-[150px] relative">
                          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input 
                              placeholder="搜索用户名..." 
                              value={searchUser}
                              onChange={e => setSearchUser(e.target.value)}
                              className="w-full pl-9 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:ring-2 focus:ring-brand-500 text-sm font-medium"
                          />
                      </div>
                      <div className="relative">
                          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input 
                              type="date"
                              value={searchDate}
                              onChange={e => setSearchDate(e.target.value)}
                              className="pl-9 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:ring-2 focus:ring-brand-500 text-sm font-medium text-gray-600"
                          />
                      </div>
                      <select 
                          value={searchSubject}
                          onChange={e => setSearchSubject(e.target.value)}
                          className="px-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:ring-2 focus:ring-brand-500 text-sm font-medium text-gray-600"
                      >
                          <option value="ALL">全部科目</option>
                          {Object.values(SubjectCategory).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  </div>
              </div>

              {/* Results List */}
              <div className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full space-y-4 pb-20 custom-scrollbar">
                  <div className="flex justify-between items-center text-xs text-gray-400 px-2">
                      <span>搜索结果: {searchResults.length} 条</span>
                      {(searchUser || searchDate || searchSubject !== 'ALL') && (
                          <button 
                            onClick={() => { setSearchUser(''); setSearchDate(''); setSearchSubject('ALL'); }}
                            className="text-brand-600 font-bold hover:underline"
                          >
                              重置筛选
                          </button>
                      )}
                  </div>
                  {searchResults.length > 0 ? (
                      searchResults.map(c => renderCard(c))
                  ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-gray-400 opacity-60">
                          <Search className="w-16 h-16 mb-4" />
                          <p>暂无符合条件的记录</p>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 relative">
      
      <FullScreenEditor 
          isOpen={!!editingCheckIn}
          onClose={() => setEditingCheckIn(null)}
          initialContent={editingCheckIn?.content || ''}
          initialSubject={editingCheckIn?.subject}
          initialDuration={editingCheckIn?.duration || 0}
          allowDurationEdit={false}
          onSave={handleSaveEdit}
          title="修改打卡日志"
          submitLabel="保存修改"
      />

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-1 mb-8">
        {isGuest ? (
            <div className="py-8 flex flex-col items-center justify-center text-center text-gray-400">
                <div className="bg-gray-100 p-3 rounded-full mb-3"><Lock className="w-6 h-6"/></div>
                <p className="font-bold text-gray-600">访客模式 · 仅浏览</p>
                <p className="text-xs mt-1">登录后即可分享你的学习动态</p>
            </div>
        ) : (
            <div className="p-4 md:p-6">
                 <div className="flex justify-between items-center mb-4">
                     <div className="flex items-center gap-3">
                         <img src={user.avatar} className="w-10 h-10 rounded-full bg-gray-100 border border-gray-100" alt="Avatar"/>
                         <div>
                             <div className="font-bold text-gray-800 text-sm">分享今日所学</div>
                             <div className="text-xs text-gray-400">积跬步，至千里</div>
                         </div>
                     </div>
                     <button 
                        onClick={() => setIsPreview(!isPreview)}
                        className="text-xs flex items-center space-x-1 text-gray-500 hover:text-brand-600 transition-colors bg-gray-50 hover:bg-brand-50 px-3 py-1.5 rounded-full font-medium"
                     >
                        {isPreview ? <><Edit2 className="w-3 h-3"/><span>编辑</span></> : <><Eye className="w-3 h-3"/><span>预览</span></>}
                     </button>
                 </div>

                 <div className="mb-4">
                     <select 
                        value={subject} 
                        onChange={(e) => setSubject(e.target.value as SubjectCategory)}
                        className="w-full bg-gray-50 border-0 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-brand-500 transition-shadow cursor-pointer hover:bg-gray-100"
                     >
                        <optgroup label="基础学科">
                            <option value={SubjectCategory.MATH}>数学 (高等数学/线代/概率论)</option>
                            <option value={SubjectCategory.ENGLISH}>英语 (阅读/写作/新题型)</option>
                            <option value={SubjectCategory.POLITICS}>政治 (马原/毛中特/史纲)</option>
                        </optgroup>
                        <optgroup label="专业课 (408)">
                            <option value={SubjectCategory.CS_DS}>数据结构</option>
                            <option value={SubjectCategory.CS_CO}>计算机组成原理</option>
                            <option value={SubjectCategory.CS_OS}>操作系统</option>
                            <option value={SubjectCategory.CS_CN}>计算机网络</option>
                        </optgroup>
                        <optgroup label="其他">
                            <option value={SubjectCategory.ALGORITHM}>算法训练</option>
                            <option value={SubjectCategory.DAILY}>日常/生活</option>
                            <option value={SubjectCategory.OTHER}>其他学习</option>
                        </optgroup>
                     </select>
                 </div>

                 {isPreview ? (
                     <div className="w-full p-4 bg-gray-50 rounded-xl min-h-[120px] prose prose-sm max-w-none border border-transparent">
                        {content ? <MarkdownText content={content} /> : <span className="text-gray-400 italic">暂无内容...</span>}
                     </div>
                 ) : (
                     <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="支持 Markdown 语法。今天复习了什么？有什么心得？..."
                        className="w-full p-4 bg-gray-50 border-0 rounded-xl text-gray-800 min-h-[120px] focus:ring-2 focus:ring-brand-500 resize-none placeholder-gray-400 text-sm leading-relaxed"
                     />
                 )}

                 {image && (
                    <div className="relative mt-4 group w-fit">
                        <img src={image} alt="Preview" className="h-40 rounded-xl object-cover border border-gray-100 shadow-sm" />
                        <button 
                        onClick={() => setImage(null)}
                        className="absolute -top-2 -right-2 bg-white text-gray-500 rounded-full p-1 shadow-md hover:text-red-500 border border-gray-100 transition-colors"
                        >
                        <X className="w-4 h-4" />
                        </button>
                    </div>
                 )}
                 
                 {isAdmin && (
                     <div className="mt-4 flex items-center">
                         <label className="flex items-center space-x-2 text-sm text-indigo-700 font-bold cursor-pointer bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors">
                             <input 
                                type="checkbox" 
                                checked={isAnnouncement} 
                                onChange={(e) => setIsAnnouncement(e.target.checked)} 
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                             />
                             <span className="flex items-center gap-1"><Megaphone className="w-4 h-4"/> 发布为置顶公告</span>
                         </label>
                     </div>
                 )}

                 <div className="flex justify-between items-center mt-4 pt-2 border-t border-gray-50">
                    <div className="flex space-x-2">
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"
                            title="上传图片"
                        >
                            <ImageIcon className="w-5 h-5" />
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </div>
                    <button 
                        onClick={handleSubmit}
                        disabled={!content.trim()}
                        className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-lg shadow-brand-200 transition-all active:scale-95"
                    >
                        <Send className="w-4 h-4" />
                        <span>发布</span>
                    </button>
                 </div>
            </div>
        )}
      </div>

      {/* 5. 筛选栏 (Fixed Layout: Wrap for better accessibility + Search Button) */}
      <div className="sticky top-0 z-20 mb-6 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="bg-white/90 backdrop-blur-md border border-white/40 shadow-sm rounded-2xl p-3 flex justify-between items-start gap-2">
              {/* Filter Chips - Use Flex Wrap to avoid hidden overflow issues on small screens */}
              <div className="flex flex-wrap gap-2 flex-1">
                  {FILTER_GROUPS.map(group => {
                      const isActive = activeFilterId === group.id;
                      const Icon = group.icon;
                      return (
                          <button
                            key={group.id}
                            onClick={() => setActiveFilterId(group.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none
                                ${isActive 
                                    ? 'bg-gray-900 text-white shadow-md' 
                                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 bg-transparent border border-transparent'
                                }
                            `}
                          >
                              <Icon className={`w-3 h-3 ${isActive ? 'text-white' : group.color}`} />
                              <span>{group.label}</span>
                          </button>
                      );
                  })}
              </div>
              
              {/* Advanced Search Button */}
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="bg-brand-50 text-brand-600 p-2 rounded-xl hover:bg-brand-100 transition-colors shadow-sm border border-brand-100 shrink-0"
                title="高级筛选"
              >
                  <Search className="w-5 h-5" />
              </button>
          </div>
      </div>

      {/* 6. Feed List */}
      <div className="space-y-6">
          {announcements.length > 0 && (
              <div className="space-y-4 mb-8">
                  {announcements.map(checkIn => renderCard(checkIn, true))}
                  <div className="flex items-center gap-2 text-gray-300 text-xs px-2">
                      <div className="h-px bg-gray-200 flex-1"></div>
                      <span>最新动态</span>
                      <div className="h-px bg-gray-200 flex-1"></div>
                  </div>
              </div>
          )}

          {regularPosts.length > 0 ? (
              regularPosts.map(checkIn => renderCard(checkIn, checkIn.isAnnouncement))
          ) : (
              <div className="py-20 flex flex-col items-center justify-center text-gray-300 bg-white rounded-3xl border border-dashed border-gray-200">
                  <Filter className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">暂无该科目的动态</p>
              </div>
          )}
      </div>
    </div>
  );
};
