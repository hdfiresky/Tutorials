import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DocumentTextIcon, FastForwardIcon, PlayIcon as RsvpPlayIcon, PauseIcon as RsvpPauseIcon, ArrowDownTrayIcon, MagicWandIcon } from './Icons'; 
import { agent5SimplifyText } from '../services/geminiService';
import type { FormattedTutorialPart } from '../types';

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

interface FullScreenTutorialViewProps {
  parts: FormattedTutorialPart[]; 
  topic: string;
  audience: string;
  onClose: () => void;
}

// Sub-component for paragraphs that can be simplified
const SimplifiableParagraph: React.FC<{
  line: string;
  audience: string;
}> = ({ line, audience }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [simplifiedText, setSimplifiedText] = useState<string | null>(null);
    const [isSimplifying, setIsSimplifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Only show simplify button for paragraphs with more than 10 words.
    const canSimplify = line.split(' ').length > 10;

    const handleSimplify = async () => {
        if (isSimplifying || simplifiedText) return;
        setIsSimplifying(true);
        setError(null);
        try {
            const result = await agent5SimplifyText(line, audience);
            setSimplifiedText(result);
        } catch (e: any) {
            console.error("Simplification failed:", e);
            setError("Failed to simplify.");
            // Hide error after some time
            setTimeout(() => setError(null), 3000);
        } finally {
            setIsSimplifying(false);
        }
    };

    const handleUndo = () => {
        setSimplifiedText(null);
        setError(null);
    };

    const pClassName = `relative text-slate-200 my-3 leading-relaxed text-base transition-colors duration-300 ${simplifiedText ? 'bg-purple-500/10 p-2 rounded-md' : ''}`;

    return (
        <p
            className={pClassName}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {isSimplifying ? (
                 <span className="flex items-center text-purple-300">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Simplifying...
                 </span>
            ) : simplifiedText ? (
                <>
                    {parseInlineMarkdown(simplifiedText)}
                    <button onClick={handleUndo} className="ml-2 text-xs text-sky-400 hover:underline focus:outline-none focus:ring-1 focus:ring-sky-400 rounded">
                        &larr; Undo
                    </button>
                </>
            ) : error ? (
                 <>
                    {parseInlineMarkdown(line)}
                    <span className="ml-2 text-xs text-red-400">{error}</span>
                </>
            ) : (
                parseInlineMarkdown(line)
            )}

            {isHovered && canSimplify && !isSimplifying && !simplifiedText && (
                <button
                    onClick={handleSimplify}
                    className="absolute top-0 right-0 p-1 bg-slate-600 rounded-full text-purple-300 hover:bg-purple-500 hover:text-white transition-all opacity-80 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    title="Simplify this paragraph"
                    aria-label="Simplify this paragraph"
                >
                    <MagicWandIcon className="h-4 w-4" />
                </button>
            )}
        </p>
    );
};

const getTutorialAsPlainText = (parts: FormattedTutorialPart[]): string => {
    if (!parts || parts.length === 0) return "";
    const fullMarkdownText = parts.map(part => part.fullMarkdownContent).join('\n\n');
    let plainText = fullMarkdownText
        .replace(/^##\s*(.*)/gm, '$1. ') 
        .replace(/^#\s*(.*)/gm, '$1. ')  
        .replace(/\*\*(.*?)\*\*/g, '$1') 
        .replace(/__(.*?)__/g, '$1')   
        .replace(/\*(.*?)\*/g, '$1')   
        .replace(/_(.*?)_/g, '$1')     
        .replace(/`(.*?)`/g, '$1')     
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') 
        .replace(/^\s*[\*\-\+]\s+/gm, '') 
        .replace(/\n\s*\n/g, '. ')     
        .replace(/\n/g, ' ')           
        .replace(/<br\s*\/?>/gi, '. ')
        .replace(/\s+/g, ' ')          
        .trim();
    return plainText;
};

const parseTutorialPartsToWords = (parts: FormattedTutorialPart[]): string[] => {
    if (!parts || parts.length === 0) return [];
    const plainText = getTutorialAsPlainText(parts);
    return plainText.split(' ').filter(word => word.length > 0);
};

export const FullScreenTutorialView: React.FC<FullScreenTutorialViewProps> = ({ parts, topic, audience, onClose }) => {
  const [isRsvpActive, setIsRsvpActive] = useState<boolean>(false);
  const [rsvpSpeedWPM, setRsvpSpeedWPM] = useState<number>(300);
  const [rsvpWords, setRsvpWords] = useState<string[]>([]);
  const [currentRsvpWordIndex, setCurrentRsvpWordIndex] = useState<number>(0);
  const [isRsvpPlaying, setIsRsvpPlaying] = useState<boolean>(false);
  
  const rsvpTimerRef = useRef<number | null>(null);
  const rsvpContainerRef = useRef<HTMLDivElement>(null); 
  const modalContentRef = useRef<HTMLDivElement>(null);

  const renderSinglePartForFullScreen = useCallback((part: FormattedTutorialPart, partIndex: number) => {
    const markdown = part.fullMarkdownContent;
    const lines = markdown.split('\n');
    const elements: (JSX.Element | JSX.Element[])[] = [];
    let inList = false;
    let currentListItems: JSX.Element[] = [];
  
    const closeListIfNeeded = (keySuffix: string) => {
      if (inList) {
        elements.push(<ul key={`fs-ul-${partIndex}-${keySuffix}-${elements.length}`} className="list-disc list-inside pl-5 mb-3 space-y-1">{currentListItems}</ul>);
        currentListItems = [];
        inList = false;
      }
    };
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineKey = `fs-line-${partIndex}-${i}`;
      if (line.startsWith('## ')) {
        closeListIfNeeded(lineKey);
        elements.push(<h2 key={lineKey} className="text-3xl font-bold mt-6 mb-3 text-sky-300 border-b border-slate-700 pb-2">{line.substring(3)}</h2>);
      } else if (line.startsWith('* ') || line.startsWith('- ')) {
        if (!inList) inList = true;
        currentListItems.push(<li key={lineKey} className="text-slate-300 leading-relaxed">{parseInlineMarkdown(line.substring(2))}</li>);
      } else if (line.trim() !== '') {
        closeListIfNeeded(lineKey);
        elements.push(<SimplifiableParagraph key={lineKey} line={line} audience={audience} />);
      } else if (elements.length > 0 && typeof elements[elements.length-1] !== 'string' && line.trim() === '') {
          closeListIfNeeded(lineKey);
      }
    }
    closeListIfNeeded(`fs-end-${partIndex}`);
    
    if (part.sources && part.sources.length > 0) {
      elements.push(
        <div key={`fs-sources-div-${partIndex}`} className="mt-4 mb-3 pt-3 border-t border-slate-600">
          <h3 key={`fs-sources-h3-${partIndex}`} className="text-lg font-semibold text-purple-300 mb-2">Sources:</h3>
          <ul key={`fs-sources-ul-${partIndex}`} className="list-disc list-inside pl-5 space-y-1">
            {part.sources.map((source, sourceIndex) => (
              <li key={`fs-source-${partIndex}-${sourceIndex}`} className="text-sm text-slate-400">
                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="hover:text-purple-400 underline hover:no-underline" title={source.uri}>
                  {source.title || source.uri}
                </a>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    return elements.filter(el => el !== null);
  }, [audience]);

  const handleExitRsvp = useCallback(() => {
    setIsRsvpActive(false);
    setIsRsvpPlaying(false);
    if (rsvpTimerRef.current) clearTimeout(rsvpTimerRef.current);
    const startRsvpButton = document.getElementById('start-rsvp-button') as HTMLElement | null;
    if (startRsvpButton && startRsvpButton.offsetParent !== null) {
        startRsvpButton.focus();
    } else {
        const saveButton = document.getElementById('save-md-button') as HTMLElement | null;
         if (saveButton && saveButton.offsetParent !== null) {
            saveButton.focus();
        } else {
            const mainCloseButton = document.querySelector('#fullscreen-tutorial-modal button[aria-label~="Close"]') as HTMLElement | null;
            if (mainCloseButton && mainCloseButton.offsetParent !== null) mainCloseButton.focus();
        }
    }
  }, []);

  useEffect(() => {
    const focusableElementsString = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const modal = document.getElementById('fullscreen-tutorial-modal');
    if (!modal) return;

    let firstElement: HTMLElement | null = null;
    let lastElement: HTMLElement | null = null;
    let activeContainer: HTMLElement | null = modal;

    if (isRsvpActive && rsvpContainerRef.current) {
        activeContainer = rsvpContainerRef.current;
    }
    
    if (activeContainer) {
        const focusableInContainer = activeContainer.querySelectorAll(focusableElementsString) as NodeListOf<HTMLElement>;
        const visibleFocusableElements = Array.from(focusableInContainer).filter(el => {
           const inRsvpContainer = rsvpContainerRef.current?.contains(el);
            if (isRsvpActive) { 
                return !!(inRsvpContainer && el.offsetParent !== null);
            }
            return !inRsvpContainer && el.offsetParent !== null;
        });

        if (visibleFocusableElements.length > 0) {
            firstElement = visibleFocusableElements[0];
            lastElement = visibleFocusableElements[visibleFocusableElements.length - 1];
        }
    }
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isRsvpActive) {
            handleExitRsvp();
        } else {
            onClose();
        }
        return;
      }
      if (event.key === 'Tab') {
         if (!firstElement || !lastElement || !document.activeElement || !activeContainer?.contains(document.activeElement)) {
             firstElement?.focus();
             event.preventDefault();
             return;
         }
         
        if (event.shiftKey) { 
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else { 
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    if (firstElement && (document.activeElement === null || !activeContainer?.contains(document.activeElement))) {
      firstElement.focus();
    }
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalBodyOverflow;
      if (rsvpTimerRef.current) clearTimeout(rsvpTimerRef.current);
    };
  }, [onClose, isRsvpActive, handleExitRsvp]); 

  useEffect(() => {
    if (isRsvpPlaying && rsvpWords.length > 0) {
      if (rsvpTimerRef.current) clearTimeout(rsvpTimerRef.current);
      rsvpTimerRef.current = window.setTimeout(() => {
        if (currentRsvpWordIndex < rsvpWords.length - 1) {
          setCurrentRsvpWordIndex(prevIndex => prevIndex + 1);
        } else {
          setIsRsvpPlaying(false); 
        }
      }, (60 * 1000) / rsvpSpeedWPM);
    } else if (rsvpTimerRef.current) clearTimeout(rsvpTimerRef.current);
    
    return () => { if (rsvpTimerRef.current) clearTimeout(rsvpTimerRef.current); };
  }, [isRsvpPlaying, currentRsvpWordIndex, rsvpSpeedWPM, rsvpWords]);

  const handleStartRsvp = () => {
    const allTutorialWords = parseTutorialPartsToWords(parts);
    if (allTutorialWords.length === 0) return;

    let startIndex = 0;
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0 && modalContentRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
        const range = selection.getRangeAt(0);
        const selectedTextContent = selection.toString().trim();
        if (selectedTextContent) { 
            const textBeforeSelectionRange = document.createRange();
            textBeforeSelectionRange.selectNodeContents(modalContentRef.current);
            textBeforeSelectionRange.setEnd(range.startContainer, range.startOffset);
            const textBeforeSelection = textBeforeSelectionRange.toString();
            
            const cleanedTextBeforeSelection = getTutorialAsPlainText([{heading: "", fullMarkdownContent: textBeforeSelection}]);
            const wordsBeforeSelection = cleanedTextBeforeSelection.split(' ').filter(w => w.length > 0);
            startIndex = wordsBeforeSelection.length;
            if (startIndex >= allTutorialWords.length) startIndex = 0; 
        }
    }
    
    setRsvpWords(allTutorialWords); 
    setCurrentRsvpWordIndex(startIndex); 
    setIsRsvpPlaying(true); 
    setIsRsvpActive(true);
  };

  const handlePlayPauseRsvp = () => setIsRsvpPlaying(p => !p);
  const handleSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => setRsvpSpeedWPM(Number(event.target.value));

  const handleSaveAsMarkdown = () => {
    if (!parts || parts.length === 0 || parts.every(p => p.fullMarkdownContent.trim() === "")) return;
    const fullMarkdown = parts.map(part => part.fullMarkdownContent).join(''); 
    let filename = topic.toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]+/g, '').replace(/_{2,}/g, '_').replace(/^-+|-+$/g, ''); 
    if (!filename) filename = 'tutorial';
    filename += '.md';
    const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isContentAvailable = parts && parts.length > 0 && !parts.every(p => p.fullMarkdownContent.trim() === "");
  const buttonBaseClasses = "flex items-center justify-center px-4 py-2 font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

  return (
    <div id="fullscreen-tutorial-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="fullscreen-tutorial-title">
      <div className="bg-slate-800 w-full max-w-3xl h-[90vh] max-h-[1000px] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-700">
        <header className="p-5 bg-slate-700/50 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center min-w-0">
            <DocumentTextIcon className="h-7 w-7 mr-3 text-sky-400 flex-shrink-0" />
            <h1 id="fullscreen-tutorial-title" className="text-2xl font-bold text-sky-300 truncate" title={topic}>
              Tutorial: {topic || "Generated Content"}
            </h1>
          </div>
          <button onClick={isRsvpActive ? handleExitRsvp : onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-600 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-colors flex-shrink-0" aria-label={isRsvpActive ? "Exit RSVP mode" : "Close tutorial view"}>
            <XMarkIcon className="h-7 w-7" />
          </button>
        </header>

        {isRsvpActive ? (
          <main ref={rsvpContainerRef} className="flex-grow flex flex-col items-center justify-center p-6 bg-slate-850 relative">
            <div className="absolute top-4 right-4 z-10">
                 <button onClick={handleExitRsvp} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md shadow-md text-xs sm:text-sm" title="Exit RSVP mode">Exit RSVP</button>
            </div>
            <div className="w-full max-w-md h-32 sm:h-40 bg-slate-900 rounded-lg flex items-center justify-center text-3xl sm:text-4xl md:text-5xl font-semibold text-sky-300 p-4 shadow-xl mb-6" aria-live="polite" aria-atomic="true">
              {rsvpWords[currentRsvpWordIndex] || " "}
            </div>
            <div className="w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center space-y-4">
              <button onClick={handlePlayPauseRsvp} className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-full shadow-md flex items-center justify-center text-base sm:text-lg w-32" aria-label={isRsvpPlaying ? "Pause RSVP" : "Play RSVP"}>
                {isRsvpPlaying ? <RsvpPauseIcon className="h-5 w-5 sm:h-6 sm:w-6 mr-2" /> : <RsvpPlayIcon className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />}
                {isRsvpPlaying ? 'Pause' : 'Play'}
              </button>
              <div className="w-full flex items-center space-x-2 sm:space-x-3">
                <label htmlFor="rsvp-speed" className="text-xs sm:text-sm text-slate-400 whitespace-nowrap">Speed:</label>
                <input type="range" id="rsvp-speed" min="100" max="600" step="10" value={rsvpSpeedWPM} onChange={handleSpeedChange} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500" aria-label="RSVP Speed Control" />
                <span className="text-xs sm:text-sm text-slate-300 font-medium w-20 text-right">{rsvpSpeedWPM} WPM</span>
              </div>
               <p className="text-xs text-slate-500">Word {rsvpWords.length > 0 ? currentRsvpWordIndex + 1 : 0} of {rsvpWords.length}</p>
            </div>
          </main>
        ) : (
          <main ref={modalContentRef} className="flex-grow overflow-y-auto p-6 md:p-8 custom-scrollbar prose-base prose-invert max-w-none tutorial-fullscreen-content">
            {parts.map((part, index) => (
                <React.Fragment key={`part-fs-fragment-${index}`}>
                    {renderSinglePartForFullScreen(part, index)}
                </React.Fragment>
            ))}
          </main>
        )}
        
        {!isRsvpActive && (
         <footer className="p-4 bg-slate-700/50 border-t border-slate-700 flex-shrink-0 flex justify-end items-center flex-wrap gap-3">
            <button 
              id="save-md-button" 
              onClick={handleSaveAsMarkdown} 
              disabled={!isContentAvailable} 
              className={`${buttonBaseClasses} bg-violet-600 hover:bg-violet-700 focus:ring-violet-500 text-white`} 
              title="Save tutorial as Markdown file"
            >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Save MD
            </button>
            <button 
              id="start-rsvp-button" 
              onClick={handleStartRsvp} 
              disabled={!isContentAvailable} 
              className={`${buttonBaseClasses} bg-teal-600 hover:bg-teal-700 focus:ring-teal-500 text-white`} 
              title="Start Rapid Serial Visual Presentation (from selection or beginning)"
            >
                <FastForwardIcon className="h-5 w-5 mr-2" />
                Start RSVP
            </button>
            <button 
              onClick={onClose}
              className={`${buttonBaseClasses} bg-slate-600 hover:bg-slate-700 focus:ring-sky-500 text-white`} 
              aria-label="Close tutorial view"
            >
                Close
            </button>
        </footer>
        )}
      </div>
    </div>
  );
};

const fsStyle = document.createElement('style');
fsStyle.textContent = `
  .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; border-radius: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
  .tutorial-fullscreen-content h2 { font-size: 1.875rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #7dd3fc; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
  .tutorial-fullscreen-content p { color: #e2e8f0; margin-top: 0.75rem; margin-bottom: 0.75rem; line-height: 1.625; font-size: 1rem; }
  .tutorial-fullscreen-content ul { list-style-type: disc; list-style-position: inside; padding-left: 1.25rem; margin-bottom: 0.75rem; }
  .tutorial-fullscreen-content ul > li + li { margin-top: 0.25rem; }
  .tutorial-fullscreen-content li { color: #cbd5e1; line-height: 1.625; }
  .tutorial-fullscreen-content strong { color: #f8fafc; font-weight: bold; }
  .tutorial-fullscreen-content em { font-style: italic; }
  .tutorial-fullscreen-content code { background-color: #1e293b; color: #fb7185; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.9em; }
  .tutorial-fullscreen-content h3 { font-size: 1.125rem; font-weight: 600; color: #c4b5fd; margin-bottom: 0.5rem; }
  input[type="range"].accent-sky-500::-webkit-slider-thumb { background-color: #0ea5e9; }
  input[type="range"].accent-sky-500::-moz-range-thumb { background-color: #0ea5e9; }
  .bg-slate-850 { background-color: #161e2b; }
`;
document.head.append(fsStyle);

const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 ${className}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);