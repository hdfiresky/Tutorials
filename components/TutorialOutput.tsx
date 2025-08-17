
import React from 'react';
import type { FormattedTutorialPart } from '../types';
import { LoadingSpinnerIcon } from './Icons';

// Helper function to apply a specific markdown pattern
const applyPattern = (nodes: React.ReactNode[], regex: RegExp, tag: 'strong' | 'em' | 'code', keyPrefix: string): React.ReactNode[] => {
  const result: React.ReactNode[] = [];
  nodes.forEach((node, nodeIndex) => {
    if (typeof node === 'string') {
      const text = node;
      let lastIndex = 0;
      let match;
      regex.lastIndex = 0; 

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          result.push(text.substring(lastIndex, match.index));
        }
        result.push(React.createElement(tag, { key: `${keyPrefix}-${nodeIndex}-${match.index}` }, match[1]));
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) {
        result.push(text.substring(lastIndex));
      }
    } else {
      result.push(node);
    }
  });
  return result;
};

const parseInlineMarkdown = (text: string): React.ReactNode[] => {
  let nodes: React.ReactNode[] = [text];
  nodes = applyPattern(nodes, /\*\*(.*?)\*\*/g, 'strong', 'bold-star');
  nodes = applyPattern(nodes, /__(.*?)__/g, 'strong', 'bold-under');
  nodes = applyPattern(nodes, /\*(.*?)\*/g, 'em', 'italic-star');
  nodes = applyPattern(nodes, /_(.*?)_/g, 'em', 'italic-under');
  nodes = applyPattern(nodes, /`(.*?)`/g, 'code', 'code');
  return nodes;
};

interface TutorialOutputProps {
  parts: FormattedTutorialPart[];
  isLoading: boolean;
  isComplete: boolean;
}

const renderSinglePartContent = (part: FormattedTutorialPart, partIndex: number) => {
  const markdown = part.fullMarkdownContent;
  const lines = markdown.split('\n');
  const elements: (JSX.Element | JSX.Element[])[] = [];
  let inList = false;
  let currentListItems: JSX.Element[] = [];

  const closeListIfNeeded = (keySuffix: string) => {
    if (inList) {
        elements.push(<ul key={`ul-${partIndex}-${keySuffix}-${elements.length}`} className="list-disc list-inside pl-4 mb-2 space-y-1">{currentListItems}</ul>);
        currentListItems = [];
        inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineKey = `line-${partIndex}-${i}`;
    if (line.startsWith('## ')) {
      closeListIfNeeded(lineKey);
      elements.push(<h2 key={lineKey} className="text-2xl font-semibold mt-4 mb-2 text-teal-300 border-b border-slate-600 pb-1">{line.substring(3)}</h2>);
    } else if (line.startsWith('* ') || line.startsWith('- ')) {
      if (!inList) {
        inList = true;
      }
      currentListItems.push(<li key={lineKey} className="ml-4 text-slate-300 leading-relaxed">{parseInlineMarkdown(line.substring(2))}</li>);
    } else if (line.trim() !== '') {
      closeListIfNeeded(lineKey);
      elements.push(<p key={lineKey} className="text-slate-200 my-2 leading-relaxed">{parseInlineMarkdown(line)}</p>);
    } else if (line.trim() === '' && elements.length > 0 && typeof elements[elements.length-1] !== 'string') {
        closeListIfNeeded(lineKey);
    }
  }
  closeListIfNeeded(`end-${partIndex}`);

  // Render sources if they exist for this part
  if (part.sources && part.sources.length > 0) {
    elements.push(
      <div key={`sources-div-${partIndex}`} className="mt-3 mb-2 pt-2 border-t border-slate-600/50">
        <h4 key={`sources-h4-${partIndex}`} className="text-sm font-semibold text-purple-300 mb-1">Sources:</h4>
        <ul key={`sources-ul-${partIndex}`} className="list-disc list-inside pl-4 space-y-0.5">
          {part.sources.map((source, sourceIndex) => (
            <li key={`source-${partIndex}-${sourceIndex}`} className="text-xs text-slate-400">
              <a 
                href={source.uri} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-purple-400 underline hover:no-underline"
                title={source.uri}
              >
                {source.title || source.uri}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return elements.filter(el => el !== null);
};


export const TutorialOutput: React.FC<TutorialOutputProps> = ({ parts, isLoading, isComplete }) => {
  if (isLoading && parts.length === 0) {
    return (
      <div className="h-96 max-h-[calc(60vh_-_theme(spacing.12))] flex flex-col items-center justify-center text-slate-400 p-4">
        <LoadingSpinnerIcon className="h-8 w-8 mb-4 text-teal-500" />
        <p className="text-lg">Generating tutorial content...</p>
        <p className="text-sm">Please wait while the AI agents work their magic.</p>
      </div>
    );
  }
  
  if (!isLoading && parts.length === 0 && isComplete) {
     return <p className="text-slate-400 text-sm italic p-4 text-center h-96 max-h-[calc(60vh_-_theme(spacing.12))] flex items-center justify-center">No content was generated for the tutorial. Try a different topic or check logs for errors.</p>;
  }
  
  if (parts.length === 0) {
    return <p className="text-slate-400 text-sm italic p-4 text-center h-96 max-h-[calc(60vh_-_theme(spacing.12))] flex items-center justify-center">Generated tutorial content will appear here progressively...</p>;
  }

  return (
    <div 
        className="h-96 max-h-[calc(60vh_-_theme(spacing.12))] overflow-y-auto bg-slate-800/70 p-4 rounded-md border border-slate-700 custom-scrollbar prose-sm prose-invert max-w-none"
        aria-live="polite" 
        aria-atomic="false"
        aria-relevant="additions text"
    >
      {isComplete && parts.length > 0 && (
        <div className="mb-4 p-3 bg-green-700/30 border border-green-600 rounded-md">
          <h3 className="text-lg font-semibold text-green-300">Final Tutorial Preview:</h3>
        </div>
      )}
      <div className="prose prose-sm prose-invert max-w-none tutorial-content">
        {parts.map((part, index) => (
          <React.Fragment key={`part-fragment-${index}`}>
            {renderSinglePartContent(part, index)}
          </React.Fragment>
        ))}
      </div>
      {isLoading && parts.length > 0 && (
        <div className="flex items-center justify-center mt-4 text-slate-400">
          <LoadingSpinnerIcon className="h-5 w-5 mr-2 text-teal-500" />
          <span>Loading next section...</span>
        </div>
      )}
    </div>
  );
};

const tutorialStyle = document.createElement('style');
tutorialStyle.textContent = `
  .tutorial-content h2 {
    font-size: 1.5em; 
    font-weight: 600; 
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    color: #5eead4; /* teal-300 */
    border-bottom: 1px solid #475569; /* slate-600 */
    padding-bottom: 0.25rem;
  }
  .tutorial-content p {
    color: #e2e8f0; /* slate-200 */
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
    line-height: 1.625; 
  }
  .tutorial-content ul {
    list-style-type: disc;
    list-style-position: inside;
    padding-left: 1rem; 
    margin-bottom: 0.5rem; 
  }
  .tutorial-content ul > li + li {
    margin-top: 0.25rem; 
  }
  .tutorial-content li {
    margin-left: 1rem; 
    color: #cbd5e1; /* slate-300 */
    line-height: 1.625;
  }
  .tutorial-content strong {
    color: #f1f5f9; /* slate-100 */
    font-weight: bold;
  }
  .tutorial-content em {
    font-style: italic;
  }
  .tutorial-content code {
    background-color: #334155; /* slate-700 */
    color: #f87171; /* red-400 */
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.875em;
  }
  .tutorial-content h4 { /* For sources heading */
    color: #c4b5fd; /* purple-300 */
    /* Other styles for h4 if needed */
  }
`;
document.head.append(tutorialStyle);
