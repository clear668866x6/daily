
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Columns, Send, Edit3, Clock, Eye, EyeOff, Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Code, CheckSquare, Link as LinkIcon, Image as ImageIcon, Loader2 } from 'lucide-react';
import { MarkdownText } from './MarkdownText';
import { SubjectCategory } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialContent: string;
  initialSubject?: SubjectCategory;
  initialDuration?: number;
  allowDurationEdit?: boolean; // If false, duration is hidden or read-only
  onSave: (content: string, subject: SubjectCategory, duration: number) => Promise<void> | void;
  onChange?: (data: { content: string; subject: SubjectCategory; duration: number }) => void;
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
  onChange,
  title = "全屏沉浸编辑",
  submitLabel = "提交"
}) => {
  const [content, setContent] = useState(initialContent);
  const [subject, setSubject] = useState(initialSubject);
  const [duration, setDuration] = useState(initialDuration);
  const [isSaving, setIsSaving] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize state when opening. 
  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
      setSubject(initialSubject || SubjectCategory.OTHER);
      setDuration(initialDuration || 45);
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); 

  // Sync changes back to parent if onChange is provided
  useEffect(() => {
      if (isOpen && onChange) {
          onChange({ content, subject, duration });
      }
  }, [content, subject, duration, isOpen, onChange]);

  if (!isOpen) return null;

  const handleSave = async () => {
      if (isSaving) return;
      setIsSaving(true);
      
      try {
          // Await the parent's save operation (DB call)
          await onSave(content, subject, duration);
          // Only close if successful (parent usually handles errors, but we assume success if no error thrown)
          onClose(); 
      } catch (e) {
          console.error("Save failed inside editor", e);
          // If error, stop saving state so user can try again
      } finally {
          setIsSaving(false);
      }
  };

  const insertFormat = (prefix: string, suffix: string = '') => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const selected = text.substring(start, end);

      const before = text.substring(0, start);
      const after = text.substring(end);

      const newText = before + prefix + selected + suffix + after;
      setContent(newText);

      // Restore focus and set cursor position
      setTimeout(() => {
          textarea.focus();
          // If text was selected, keep selection inside tags. If not, cursor is inside tags.
          const newCursorPos = start + prefix.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos + selected.length);
      }, 0);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col animate-fade-in">
      {/* Header */}
      <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-gray-50/80 backdrop-blur-sm shrink-0">
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
            disabled={isSaving}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors group disabled:opacity-50"
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
          
          {/* Formatting Toolbar */}
          <div className="flex items-center gap-1 p-2 border-b border-gray-100 bg-white overflow-x-auto no-scrollbar shrink-0">
              <ToolbarButton icon={Bold} label="加粗" onClick={() => insertFormat('**', '**')} />
              <ToolbarButton icon={Italic} label="斜体" onClick={() => insertFormat('*', '*')} />
              <div className="w-px h-4 bg-gray-200 mx-1"></div>
              <ToolbarButton icon={Heading1} label="大标题" onClick={() => insertFormat('# ')} />
              <ToolbarButton icon={Heading2} label="小标题" onClick={() => insertFormat('## ')} />
              <div className="w-px h-4 bg-gray-200 mx-1"></div>
              <ToolbarButton icon={List} label="无序列表" onClick={() => insertFormat('- ')} />
              <ToolbarButton icon={ListOrdered} label="有序列表" onClick={() => insertFormat('1. ')} />
              <ToolbarButton icon={CheckSquare} label="任务列表" onClick={() => insertFormat('- [ ] ')} />
              <div className="w-px h-4 bg-gray-200 mx-1"></div>
              <ToolbarButton icon={Quote} label="引用" onClick={() => insertFormat('> ')} />
              <ToolbarButton icon={Code} label="代码块" onClick={() => insertFormat('```\n', '\n```')} />
              <div className="w-px h-4 bg-gray-200 mx-1"></div>
              <ToolbarButton icon={LinkIcon} label="链接" onClick={() => insertFormat('[', '](url)')} />
              <ToolbarButton icon={ImageIcon} label="图片" onClick={() => insertFormat('![alt](', ')')} />
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={isSaving}
            className="flex-1 w-full p-8 resize-none outline-none text-gray-800 text-base md:text-lg leading-relaxed font-mono selection:bg-brand-100 disabled:opacity-50 disabled:bg-gray-50"
            placeholder="# 今日学习笔记...\n\n支持 Markdown 语法，也可点击上方工具栏排版"
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
      <div className="h-16 border-t border-gray-200 flex items-center justify-end px-6 bg-white gap-4 shrink-0">
          <span className="text-xs text-gray-400 font-medium hidden md:inline-block">
              {content.length} 字符
          </span>
          <button
            onClick={handleSave}
            disabled={isSaving || !content.trim()}
            className="bg-brand-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-brand-200 transition-all active:scale-95"
          >
            {isSaving ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    正在提交...
                </>
            ) : (
                <>
                    <Send className="w-4 h-4" /> 
                    {submitLabel}
                </>
            )}
          </button>
      </div>
    </div>,
    document.body
  );
};

// Helper Component for Toolbar Buttons
const ToolbarButton: React.FC<{ icon: React.ElementType, label: string, onClick: () => void }> = ({ icon: Icon, label, onClick }) => (
    <button
        onClick={onClick}
        className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
        title={label}
    >
        <Icon className="w-4 h-4" />
    </button>
);
