

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckIn, SubjectCategory, User, getUserStyle } from '../types'; 
import { MarkdownText } from './MarkdownText';
import { Image as ImageIcon, Send, ThumbsUp, X, Filter, Eye, Edit2, Lock, Megaphone, Clock, Search, User as UserIcon, Calendar as CalendarIcon, ArrowLeft, Pin, Trash2, Users, Coffee, Check, XCircle, Maximize2, ShieldCheck, Plus, PenTool } from 'lucide-react';
import { FullScreenEditor } from './FullScreenEditor';
import { FILTER_GROUPS } from '../constants';
import { compressImage } from '../services/imageUtils';
import { ImageViewer } from './ImageViewer';
import { updateLeaveStatus } from '../services/storageService';

interface Props {
  checkIns: CheckIn[];
  user: User;
  onAddCheckIn: (checkIn: CheckIn) => void;
  onLike: (id: string) => void;
  onDeleteCheckIn: (id: string) => void;
  onUpdateCheckIn: (id: string, content: string) => void;
  onViewUserProfile: (userId: string) => void;
  onExemptPenalty?: (id: string) => void;
}

export const Feed: React.FC<Props> = ({ checkIns, user, onAddCheckIn, onLike, onDeleteCheckIn, onUpdateCheckIn, onViewUserProfile, onExemptPenalty }) => {
  // New Post Modal State
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState<SubjectCategory>(SubjectCategory.MATH);
  const [image, setImage] = useState<string | null>(null);
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

  // Viewer State
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const isGuest = user.role === 'guest';
  const isAdmin = user.role === 'admin';

  // Load Draft from LocalStorage
  useEffect(() => {
      const savedContent = localStorage.getItem('ky_feed_draft_content');
      const savedSubject = localStorage.getItem('ky_feed_draft_subject');
      
      if (savedContent) setContent(savedContent);
      if (savedSubject) setSubject(savedSubject as SubjectCategory);
  }, []);

  // Save Draft to LocalStorage
  useEffect(() => {
      if (isPostModalOpen) {
          localStorage.setItem('ky_feed_draft_content', content);
          localStorage.setItem('ky_feed_draft_subject', subject);
      }
  }, [content, subject, isPostModalOpen]);

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
    
    // Reset and Close
    setContent('');
    setImage(null);
    setIsAnnouncement(false);
    setIsPostModalOpen(false);
    
    // Clear draft
    localStorage.removeItem('ky_feed_draft_content');
    localStorage.removeItem('ky_feed_draft_subject');

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveEdit = (newContent: string) => {
      if (editingCheckIn) {
          onUpdateCheckIn(editingCheckIn.id, newContent);
          setEditingCheckIn(null);
      }
  }

  const openImageViewer = (imgUrl: string) => {
      setViewerImages([imgUrl]);
      setIsViewerOpen(true);
  }

  // Admin Approval
  const handleApproveLeave = async (checkIn: CheckIn) => {
      if (!isAdmin) return;
      const makeup = parseInt(prompt("请输入需要偿还的补习时长(分钟):", "60") || "0");
      await updateLeaveStatus(checkIn.id, 'approved', makeup);
      // Optimistic update via onUpdateCheckIn logic or refresh
      const newContent = checkIn.content.replace('⏳ 超过2天，等待管理员审批...', `✅ 已批准 (需补时 ${makeup} 分钟)`);
      onUpdateCheckIn(checkIn.id, newContent);
  }

  const handleRejectLeave = async (checkIn: CheckIn) => {
      if (!isAdmin) return;
      if (!confirm("确定驳回该请假申请吗？")) return;
      await updateLeaveStatus(checkIn.id, 'rejected', 0);
      const newContent = checkIn.content.replace('⏳ 超过2天，等待管理员审批...', `❌ 申请被驳回`);
      onUpdateCheckIn(checkIn.id, newContent);
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
    const isLeave = checkIn.isLeave;
    const isPenalty = checkIn.isPenalty;

    const nameStyle = getUserStyle(checkIn.userRole || 'user', checkIn.userRating ?? 1200);
    const subjectTheme = isLeave ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : getSubjectTheme(checkIn.subject);

    return (
        <div 
          key={checkIn.id} 
          className={`bg-white rounded-3xl p-5 md:p-6 shadow-sm border transition-all hover:shadow-md relative overflow-hidden group
              ${isPinned 
                  ? 'border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30 ring-1 ring-indigo-100' 
                  : isLeave 
                    ? 'border-yellow-200 bg-yellow-50/10'
                    : isPenalty 
                        ? 'border-red-200 bg-red-50/10'
                        : 'border-gray-100 hover:border-gray-200'
              }
          `}
        >
            {/* ... Pin Badge ... */}
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

            {/* Header */}
            <div className="flex justify-between items-start mb-3 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="relative cursor-pointer group/avatar" onClick={() => onViewUserProfile(checkIn.userId)}>
                        <img 
                          src={checkIn.userAvatar || 'https://api.dicebear.com/7.x/notionists/svg?seed=Unknown'} 
                          alt={checkIn.userName || 'User'} 
                          className={`w-10 h-10 rounded-full bg-gray-50 object-cover border-2 transition-transform group-hover/avatar:scale-110 ${isOfficial ? 'border-indigo-200' : 'border-white shadow-sm'}`} 
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
                                className={`text-sm font-bold hover:underline cursor-pointer ${nameStyle}`}
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
                            {isLeave && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                    checkIn.leaveStatus === 'approved' ? 'bg-green-100 text-green-700' :
                                    checkIn.leaveStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                }`}>
                                    {checkIn.leaveStatus === 'approved' ? '已通过' : 
                                     checkIn.leaveStatus === 'rejected' ? '已驳回' : '审核中'}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 font-mono">
                            <span>{new Date(checkIn.timestamp).toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}</span>
                            {/* Tags */}
                            {!isPinned && (
                                <>
                                    <span>•</span>
                                    <span className={`text-[10px] font-bold ${isLeave ? 'text-yellow-600' : 'text-gray-500'}`}>
                                        {isLeave ? '请假条' : checkIn.subject}
                                    </span>
                                </>
                            )}
                            {checkIn.duration > 0 && !isLeave && (
                                <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1 text-gray-500 font-bold">
                                        <Clock className="w-3 h-3" /> {checkIn.duration}m
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className={`mb-3 text-sm leading-relaxed relative z-10 pl-1 text-gray-800 break-words`}>
                <MarkdownText content={checkIn.content} />
            </div>

            {/* Admin Controls for Pending Leave */}
            {isLeave && checkIn.leaveStatus === 'pending' && isAdmin && (
                <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 mb-4 flex items-center justify-between">
                    <span className="text-xs font-bold text-yellow-700">请假审批</span>
                    <div className="flex gap-2">
                        <button onClick={() => handleApproveLeave(checkIn)} className="bg-green-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-600 flex items-center gap-1"><Check className="w-3 h-3"/> 批准</button>
                        <button onClick={() => handleRejectLeave(checkIn)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded text-xs font-bold hover:bg-red-100 flex items-center gap-1"><XCircle className="w-3 h-3"/> 驳回</button>
                    </div>
                </div>
            )}

            {checkIn.imageUrl && (
                <div className="mb-4 relative z-10 rounded-2xl overflow-hidden border border-gray-100 max-w-sm cursor-zoom-in group/image" onClick={() => openImageViewer(checkIn.imageUrl || '')}>
                    <img 
                      src={checkIn.imageUrl} 
                      alt="Post" 
                      className="w-full h-auto object-cover transition-transform duration-500 group-hover/image:scale-105" 
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors flex items-center justify-center">
                        <div className="bg-black/50 p-2 rounded-full text-white opacity-0 group-hover/image:opacity-100 transition-opacity backdrop-blur-sm">
                            <Maximize2 className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            )}

            {/* Footer Actions */}
            <div className={`flex items-center justify-between pt-3 border-t ${isPinned ? 'border-indigo-100' : 'border-gray-50'} relative z-10`}>
                <button 
                    onClick={() => onLike(checkIn.id)}
                    disabled={isGuest}
                    className={`flex items-center gap-1.5 text-xs font-bold transition-all px-2 py-1 rounded-lg ${
                        isLiked ? 'text-rose-500 bg-rose-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                    } ${isGuest ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                    <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                    <span>{likeCount > 0 ? likeCount : '赞'}</span>
                </button>
                
                <div className="flex items-center gap-1">
                    {/* Admin Exempt Button */}
                    {isAdmin && isPenalty && onExemptPenalty && (
                        <button 
                            onClick={() => onExemptPenalty(checkIn.id)}
                            className="text-indigo-500 bg-indigo-50 hover:bg-indigo-100 transition-colors px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                            title="免除扣分"
                        >
                            <ShieldCheck className="w-3 h-3" /> 豁免
                        </button>
                    )}
                    
                    {canEdit && (
                        <button 
                            onClick={() => setEditingCheckIn(checkIn)}
                            className="text-gray-400 hover:text-brand-600 transition-colors p-1.5 rounded-lg hover:bg-gray-50"
                            title="编辑"
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {canDelete && (
                        <button 
                            onClick={() => onDeleteCheckIn(checkIn.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-gray-50"
                            title="删除"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
  };

  // --- Main Layout ---
  
  if (isSearchOpen) {
      // Use portal to escape parent transforms
      return createPortal(
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
          </div>,
          document.body
      );
  }

  return (
    <div className="max-w-3xl mx-auto pb-24 relative">
      
      <ImageViewer 
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          images={viewerImages}
          initialIndex={0}
      />

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

      {/* Floating Action Button for New Post - Wrapped in Portal */}
      {createPortal(
          <button
            onClick={() => {
                if(isGuest) {
                    alert('访客模式无法发布动态，请登录');
                    return;
                }
                setIsPostModalOpen(true);
            }}
            className="fixed bottom-8 right-8 bg-brand-600 text-white w-14 h-14 rounded-full shadow-2xl shadow-brand-500/50 hover:bg-brand-700 hover:scale-110 transition-all duration-300 z-[9999] active:scale-90 flex items-center justify-center group"
            title="发布动态"
          >
              <PenTool className="w-6 h-6 fill-transparent stroke-2" />
          </button>,
          document.body
      )}

      {/* New Post Modal - Wrapped in Portal */}
      {isPostModalOpen && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setIsPostModalOpen(false)}>
              <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                          <Edit2 className="w-4 h-4 text-brand-500" /> 发布动态
                      </h3>
                      <button onClick={() => setIsPostModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto custom-scrollbar">
                      <div className="mb-4">
                         <select 
                            value={subject} 
                            onChange={(e) => setSubject(e.target.value as SubjectCategory)}
                            className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-brand-500 transition-shadow cursor-pointer"
                         >
                            <optgroup label="基础学科">
                                <option value={SubjectCategory.MATH}>数学</option>
                                <option value={SubjectCategory.ENGLISH}>英语</option>
                                <option value={SubjectCategory.POLITICS}>政治</option>
                            </optgroup>
                            <optgroup label="专业课 (408)">
                                <option value={SubjectCategory.CS_DS}>数据结构</option>
                                <option value={SubjectCategory.CS_CO}>计组</option>
                                <option value={SubjectCategory.CS_OS}>操作系统</option>
                                <option value={SubjectCategory.CS_CN}>计网</option>
                            </optgroup>
                            <optgroup label="其他">
                                <option value={SubjectCategory.ALGORITHM}>算法训练</option>
                                <option value={SubjectCategory.DAILY}>日常/生活</option>
                                <option value={SubjectCategory.OTHER}>其他学习</option>
                            </optgroup>
                         </select>
                     </div>

                     <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="记录今天的进步..."
                        className="w-full p-4 bg-gray-50 border-0 rounded-xl text-gray-800 min-h-[150px] focus:ring-2 focus:ring-brand-500 resize-none placeholder-gray-400 text-sm leading-relaxed mb-4"
                        autoFocus
                     />

                     {image && (
                        <div className="relative mb-4 group w-fit">
                            <img src={image} alt="Preview" className="h-40 rounded-xl object-cover border border-gray-100 shadow-sm" />
                            <button 
                                onClick={() => setImage(null)}
                                className="absolute -top-2 -right-2 bg-white text-gray-500 rounded-full p-1 shadow-md hover:text-red-500 border border-gray-100 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                     )}

                     <div className="flex items-center gap-2">
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 text-sm font-medium transition-colors"
                        >
                            <ImageIcon className="w-4 h-4" /> 
                            {image ? '更换图片' : '添加图片'}
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        
                        {isAdmin && (
                             <label className="flex items-center space-x-2 text-xs text-indigo-700 font-bold cursor-pointer bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors ml-auto">
                                 <input 
                                    type="checkbox" 
                                    checked={isAnnouncement} 
                                    onChange={(e) => setIsAnnouncement(e.target.checked)} 
                                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                 />
                                 <span className="flex items-center gap-1"><Megaphone className="w-3 h-3"/> 置顶公告</span>
                             </label>
                         )}
                     </div>
                  </div>

                  <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                      <button 
                        onClick={handleSubmit}
                        disabled={!content.trim()}
                        className="bg-brand-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-lg shadow-brand-200 transition-all active:scale-95"
                    >
                        <Send className="w-4 h-4" />
                        <span>发布</span>
                    </button>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-brand-500 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-brand-200 text-white">
                  <Users className="w-6 h-6" />
              </div>
              <div>
                  <h1 className="text-2xl font-black text-gray-800">研友圈</h1>
                  <p className="text-xs text-gray-500 font-medium">交流心得，共同进步</p>
              </div>
          </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-0 z-20 mb-6 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="bg-white/90 backdrop-blur-md border border-white/40 shadow-sm rounded-2xl p-3 flex justify-between items-start gap-2">
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
              
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="bg-brand-50 text-brand-600 p-2 rounded-xl hover:bg-brand-100 transition-colors shadow-sm border border-brand-100 shrink-0"
                title="高级筛选"
              >
                  <Search className="w-5 h-5" />
              </button>
          </div>
      </div>

      {/* Feed List */}
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