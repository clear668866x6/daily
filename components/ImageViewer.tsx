
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  images: string[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageViewer: React.FC<Props> = ({ images, initialIndex, isOpen, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScale(1);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, initialIndex]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!isOpen) return;
          if (e.key === 'Escape') onClose();
          if (e.key === 'ArrowRight') handleNext();
          if (e.key === 'ArrowLeft') handlePrev();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex]); // Add dependencies

  const handleNext = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (currentIndex < images.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setScale(1);
      }
  };

  const handlePrev = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
          setScale(1);
      }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/95 flex flex-col animate-fade-in" onClick={onClose}>
        {/* Toolbar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 text-white/80 bg-gradient-to-b from-black/50 to-transparent">
            <span className="font-mono text-sm">{currentIndex + 1} / {images.length}</span>
            <div className="flex gap-4">
                <button onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(0.5, s - 0.2)); }} className="hover:text-white"><ZoomOut className="w-5 h-5"/></button>
                <button onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(3, s + 0.2)); }} className="hover:text-white"><ZoomIn className="w-5 h-5"/></button>
                <button onClick={onClose} className="hover:text-white bg-white/10 p-1 rounded-full"><X className="w-6 h-6"/></button>
            </div>
        </div>

        {/* Main Image Area */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <img 
                src={images[currentIndex]} 
                className="max-w-full max-h-full object-contain transition-transform duration-200 cursor-grab active:cursor-grabbing"
                style={{ transform: `scale(${scale})` }}
                onClick={(e) => e.stopPropagation()}
                alt="Fullscreen"
            />
            
            {currentIndex > 0 && (
                <button 
                    onClick={handlePrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-colors z-20"
                >
                    <ChevronLeft className="w-8 h-8" />
                </button>
            )}
            
            {currentIndex < images.length - 1 && (
                <button 
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-colors z-20"
                >
                    <ChevronRight className="w-8 h-8" />
                </button>
            )}
        </div>

        {/* Thumbnails (if multiple) */}
        {images.length > 1 && (
            <div className="h-20 bg-black/50 backdrop-blur-sm flex items-center justify-center gap-2 p-2 z-50 overflow-x-auto">
                {images.map((img, idx) => (
                    <img 
                        key={idx}
                        src={img}
                        onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); setScale(1); }}
                        className={`h-14 w-14 object-cover rounded-md cursor-pointer border-2 transition-all ${idx === currentIndex ? 'border-brand-500 opacity-100 scale-110' : 'border-transparent opacity-50 hover:opacity-80'}`}
                    />
                ))}
            </div>
        )}
    </div>,
    document.body
  );
};
