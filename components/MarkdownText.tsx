

import React from 'react';
import katex from 'katex';

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

    // --- Horizontal Rule ---
    if (line.trim() === '---') {
        elements.push(<hr key={idx} className="my-4 border-gray-200" />);
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

    // Images (![alt](url)) - Basic support
    const imgMatch = line.match(/!\[(.*?)\]\((.*?)\)/);
    if (imgMatch) {
        const alt = imgMatch[1];
        const url = imgMatch[2];
        elements.push(
            <div key={idx} className="my-3">
                <img src={url} alt={alt} className="max-w-full h-auto rounded-lg border border-gray-100 shadow-sm" />
                {line.replace(imgMatch[0], '').trim() && <p className="mt-1 text-gray-700">{parseInline(line.replace(imgMatch[0], ''))}</p>}
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

// Helper for inline styles (bold, code, math)
const parseInline = (text: string) => {
  // Regex to split by bold (**text**), code (`text`), inline math ($...$) and block math ($$...$$)
  // Note: Simple split might be fragile for complex nesting, but works for basic cases.
  // We prioritize Math first.
  
  // Split by $$...$$ first (Block Math)
  const blockParts = text.split(/(\$\$.*?\$\$)/g);
  
  return blockParts.map((blockPart, bIdx) => {
      if (blockPart.startsWith('$$') && blockPart.endsWith('$$')) {
          const math = blockPart.slice(2, -2);
          try {
              const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
              return <div key={bIdx} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch(e) {
              return <code key={bIdx} className="text-red-500">{blockPart}</code>;
          }
      }

      // Split by $...$ (Inline Math)
      const inlineParts = blockPart.split(/(\$.*?\$)/g);
      return inlineParts.map((part, pIdx) => {
          if (part.startsWith('$') && part.endsWith('$') && !part.startsWith('$$')) {
              const math = part.slice(1, -1);
              try {
                  const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
                  return <span key={`${bIdx}-${pIdx}`} dangerouslySetInnerHTML={{ __html: html }} />;
              } catch (e) {
                  return <code key={`${bIdx}-${pIdx}`} className="text-red-500">{part}</code>;
              }
          }

          // Split by Bold
          const boldParts = part.split(/(\*\*.*?\*\*)/g);
          return boldParts.map((subPart, sIdx) => {
              if (subPart.startsWith('**') && subPart.endsWith('**')) {
                  return <strong key={`${bIdx}-${pIdx}-${sIdx}`} className="font-bold text-gray-900">{subPart.slice(2, -2)}</strong>;
              }
              
              // Split by Code
              const codeParts = subPart.split(/(`.*?`)/g);
              return codeParts.map((finalPart, cIdx) => {
                  if (finalPart.startsWith('`') && finalPart.endsWith('`')) {
                      return <code key={`${bIdx}-${pIdx}-${sIdx}-${cIdx}`} className="bg-gray-100 text-red-500 px-1.5 py-0.5 rounded font-mono text-xs border border-gray-200 mx-0.5">{finalPart.slice(1, -1)}</code>;
                  }
                  return finalPart;
              });
          });
      });
  });
};