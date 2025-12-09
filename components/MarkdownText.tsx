import React from 'react';

interface Props {
  content: string;
}

// A simplified renderer to avoid complex dependencies while supporting basic MD
export const MarkdownText: React.FC<Props> = ({ content }) => {
  // Simple processing: Split by newlines
  // Bold: **text**
  // Quote: > text
  
  const lines = content.split('\n');

  return (
    <div className="text-gray-800 text-sm leading-relaxed space-y-1">
      {lines.map((line, idx) => {
        if (line.startsWith('> ')) {
          return (
            <blockquote key={idx} className="border-l-4 border-gray-300 pl-2 text-gray-500 italic my-2">
              {line.substring(2)}
            </blockquote>
          );
        }
        
        // Very basic bold parsing
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={idx} className="min-h-[1.2em]">
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
};