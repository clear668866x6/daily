
import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div className="p-6">
          <div className="flex items-start gap-4">
             <div className={`p-3 rounded-full shrink-0 ${type === 'danger' ? 'bg-red-100' : 'bg-blue-100'}`}>
                <AlertTriangle className={`w-6 h-6 ${type === 'danger' ? 'text-red-600' : 'text-blue-600'}`} />
             </div>
             <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {message}
                </p>
             </div>
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-6 py-2 rounded-xl text-white font-bold text-sm shadow-md transition-transform active:scale-95 ${
                type === 'danger' 
                ? 'bg-red-600 hover:bg-red-700 shadow-red-200' 
                : 'bg-brand-600 hover:bg-brand-700 shadow-brand-200'
            }`}
          >
            {confirmText}
          </button>
        </div>
        
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
            <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
