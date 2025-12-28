
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Columns, Send, Edit3, Clock, Eye, EyeOff } from 'lucide-react';
import { MarkdownText } from './MarkdownText';
import { SubjectCategory } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialContent: string;
  initialSubject?: SubjectCategory;
  initialDuration?: number;
  allowDurationEdit?: boolean; // If false, duration is hidden or read-only
  onSave: (content: string, subject: SubjectCategory, duration: number) => void;
  title?: string;
  submitLabel?: string;
}

export const FullScreenEditor: React.FC<Props> = ({
  isOpen,
  onClose,
  initialContent,
  initialSubject = SubjectCategory.OTHER,
  initialDuration = 45,
  allowDurationEdit = true,
  onSave,
  title = "全屏沉浸编辑",
  submitLabel = "提交"
}) => {
  const [content, setContent] = useState(initialContent);
  const [subject, setSubject] = useState(initialSubject);
  const [duration, setDuration] = useState(initialDuration);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when props change (re-opening)
  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
      setSubject(initialSubject);
      setDuration(initialDuration);
      setIsSaving(false);
    }
  }, [isOpen, initialContent, initialSubject, initialDuration]);

  if (!isOpen) return null;

  const handleSave = () => {
      setIsSaving(true);
      // Simulate small delay for UX
      setTimeout(() => {
          onSave(content, subject, duration);
          setIsSaving(false);
          onClose();
      }, 500);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col animate-fade-in">
      {/* Header */}
      <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-gray-50/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-brand-600" />
            {title}
          </h2>
          <div className="h-6 w-px bg-gray-300 mx-2"></div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {allowDurationEdit ? (
                <>
                    <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value as SubjectCategory)}
                        className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 outline-none shadow-sm"
                    >
                        {Object.values(SubjectCategory).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="flex items-center bg-white border border-gray-300 rounded-lg px-2 overflow-hidden shadow-sm group focus-within:ring-2 ring-blue-500">
                        <input
                            type="number"
                            value={duration}
                            onChange={e => setDuration(parseInt(e.target.value) || 0)}
                            className="w-16 py-1.5 text-sm text-center font-bold text-gray-700 outline-none"
                        />
                        <span className="text-xs text-gray-400 pr-2 font-bold bg-white select-none">min</span>
                    </div>
                </>
            ) : (
                <div className="flex items-center gap-2 text-gray-500 text-xs font-mono bg-gray-200/50 px-3 py-1.5 rounded-lg border border-gray-200">
                    <Clock className="w-3 h-3" />
                    时长不可变 ({duration} min)
                </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1.5 text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg select-none">
            <Columns className="w-4 h-4" /> 双栏预览
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-200 rounded-full transition-colors group"
            title="关闭 (ESC)"
          >
            <X className="w-6 h-6 text-gray-400 group-hover:text-gray-600" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Input */}
        <div className="w-full md:w-1/2 h-full flex flex-col border-r border-gray-200 bg-white relative">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="flex-1 w-full p-8 resize-none outline-none text-gray-800 text-base md:text-lg leading-relaxed font-mono selection:bg-brand-100"
            placeholder="# 今日学习笔记...\n\n支持 Markdown 语法"
            autoFocus
          />
          <div className="absolute bottom-4 left-6 text-xs text-gray-300 pointer-events-none font-bold tracking-wider">
            MARKDOWN SUPPORTED
          </div>
        </div>

        {/* Right: Preview (Hidden on mobile) */}
        <div className="hidden md:block w-1/2 h-full bg-gray-50/50 overflow-y-auto p-8 prose prose-slate max-w-none custom-scrollbar">
          {content ? (
            <MarkdownText content={content} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2 select-none">
              <Eye className="w-8 h-8 opacity-50"/>
              <span className="italic text-sm">实时预览区域</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="h-16 border-t border-gray-200 flex items-center justify-end px-6 bg-white gap-4">
          <span className="text-xs text-gray-400 font-medium hidden md:inline-block">
              {content.length} 字符
          </span>
          <button
            onClick={handleSave}
            disabled={isSaving || !content.trim()}
            className="bg-brand-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-brand-200 transition-all active:scale-95"
          >
            {isSaving ? '提交中...' : <><Send className="w-4 h-4" /> {submitLabel}</>}
          </button>
      </div>
    </div>,
    document.body
  );
};
