
import React from 'react';

interface Props {
  content: string;
}

export const MarkdownText: React.FC<Props> = ({ content }) => {
  if (!content) return null;
  
  // Basic splitting by lines for simple parsing
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  const elements: React.ReactNode[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // --- Handle Code Blocks Start/End ---
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of block
        inCodeBlock = false;
        const code = codeBlockContent.join('\n');
        elements.push(
          <div key={`code-${idx}`} className="bg-gray-800 text-gray-100 font-mono text-sm p-3 rounded-lg overflow-x-auto my-3 shadow-inner">
            <pre>{code}</pre>
          </div>
        );
        codeBlockContent = [];
      } else {
        // Start of block
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // --- Standard Markdown parsing ---
    
    // Headers
    if (line.startsWith('# ')) {
      elements.push(<h1 key={idx} className="text-2xl font-bold text-gray-900 mt-6 mb-3 border-b pb-2">{parseInline(line.substring(2))}</h1>);
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={idx} className="text-xl font-bold text-gray-800 mt-5 mb-2">{parseInline(line.substring(3))}</h2>);
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={idx} className="text-lg font-bold text-gray-800 mt-4 mb-2">{parseInline(line.substring(4))}</h3>);
      continue;
    }

    // Quotes
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={idx} className="border-l-4 border-brand-300 pl-4 text-gray-500 italic my-3 bg-gray-50 py-2 rounded-r">
          {parseInline(line.substring(2))}
        </blockquote>
      );
      continue;
    }

    // Lists (Unordered)
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(
        <div key={idx} className="flex items-start ml-2 my-1.5">
          <span className="mr-2 text-brand-500 mt-1.5 w-1.5 h-1.5 bg-brand-500 rounded-full shrink-0"></span>
          <span className="leading-relaxed">{parseInline(line.replace(/^[-*]\s/, ''))}</span>
        </div>
      );
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      elements.push(<div key={idx} className="h-2"></div>);
      continue;
    }

    // Standard Paragraph
    elements.push(
      <p key={idx} className="min-h-[1em] leading-relaxed mb-2 text-gray-700">
        {parseInline(line)}
      </p>
    );
  }

  // Close any open code block at EOF
  if (inCodeBlock && codeBlockContent.length > 0) {
     const code = codeBlockContent.join('\n');
     elements.push(
        <div key="code-eof" className="bg-gray-800 text-gray-100 font-mono text-sm p-3 rounded-lg overflow-x-auto my-3">
          <pre>{code}</pre>
        </div>
     );
  }

  return (
    <div className="text-gray-800 text-sm break-words">
      {elements}
    </div>
  );
};

// Helper for inline styles (bold, code, image, link)
const parseInline = (text: string) => {
  // Regex Breakdown:
  // 1. Images: !\[(.*?)\]\((.*?)\)
  // 2. Links: \[((?:\[[^\]]*\]|[^\[\]])*)\]\((.*?)\)  <-- Simplified: \[([^\]]+)\]\(([^)]+)\)
  // 3. Bold: \*\*.*?\*\*
  // 4. Code: `.*?`
  
  // We split by capturing groups.
  const regex = /(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\)|(\*\*.*?\*\*|`.*?`))/g;
  
  const parts = text.split(regex).filter(p => p); // filter empty strings

  return parts.map((part, pIdx) => {
    // Image: ![alt](url)
    if (part.match(/^!\[(.*?)\]\((.*?)\)$/)) {
        const match = part.match(/^!\[(.*?)\]\((.*?)\)$/);
        if (match) {
            return (
                <img 
                    key={pIdx} 
                    src={match[2]} 
                    alt={match[1]} 
                    className="max-w-full h-auto rounded-lg border border-gray-100 my-2 shadow-sm"
                />
            );
        }
    }

    // Link: [text](url)
    if (part.match(/^\[(.*?)\]\((.*?)\)$/)) {
        const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
        if (match) {
            return (
                <a 
                    key={pIdx} 
                    href={match[2]} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline font-medium break-all"
                >
                    {match[1]}
                </a>
            );
        }
    }

    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={pIdx} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
    }

    // Code: `text`
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={pIdx} className="bg-gray-100 text-red-500 px-1.5 py-0.5 rounded font-mono text-xs border border-gray-200 mx-0.5">{part.slice(1, -1)}</code>;
    }

    return part;
  });
};
