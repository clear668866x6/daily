
import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<Props> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000); // 4秒后自动消失
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const styles = {
    success: 'bg-white border-green-500 text-green-700 shadow-green-100',
    error: 'bg-white border-red-500 text-red-700 shadow-red-100',
    info: 'bg-white border-blue-500 text-blue-700 shadow-blue-100'
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  };

  return (
    <div 
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border-l-4 shadow-lg min-w-[300px] max-w-sm transform transition-all animate-slide-in ${styles[toast.type]}`}
    >
      <div className="shrink-0">{icons[toast.type]}</div>
      <p className="text-sm font-medium flex-1 text-gray-700 leading-tight">{toast.message}</p>
      <button 
        onClick={() => onDismiss(toast.id)} 
        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
