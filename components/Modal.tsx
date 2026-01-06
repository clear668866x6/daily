
import React from 'react';
import { X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { MarkdownText } from './MarkdownText';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info' | 'success';
}

export const Modal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "确定", 
  cancelText = "取消",
  type = 'info'
}) => {
  if (!isOpen) return null;

  const typeStyles = {
    danger: {
      bg: 'bg-red-50',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      btn: 'bg-red-600 hover:bg-red-700 shadow-red-200',
      icon: AlertTriangle
    },
    info: {
      bg: 'bg-blue-50',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      btn: 'bg-brand-600 hover:bg-brand-700 shadow-brand-200',
      icon: Info
    },
    success: {
      bg: 'bg-green-50',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      btn: 'bg-green-600 hover:bg-green-700 shadow-green-200',
      icon: CheckCircle2
    }
  };

  const style = typeStyles[type];
  const Icon = style.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 border border-gray-100">
        
        {/* Header Area */}
        <div className={`${style.bg} p-6 pb-8 border-b border-gray-100 relative`}>
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl shrink-0 ${style.iconBg} shadow-sm`}>
                    <Icon className={`w-8 h-8 ${style.iconColor}`} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-gray-800">{title}</h3>
                    <p className="text-xs font-bold uppercase tracking-wider opacity-50 mt-1 text-gray-600">System Notification</p>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/50 hover:bg-white rounded-full transition-colors text-gray-500"
            >
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Content Area */}
        <div className="p-6 -mt-4 bg-white rounded-t-3xl relative z-10">
          <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
              {typeof message === 'string' ? (
                  message.includes('**') || message.includes('#') ? <MarkdownText content={message} /> : message
              ) : (
                  message
              )}
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-3.5 rounded-xl text-white font-bold text-sm shadow-lg transition-transform active:scale-95 ${style.btn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
