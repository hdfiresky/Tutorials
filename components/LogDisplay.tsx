import React, { useRef, useEffect } from 'react';
import type { LogEntry } from '../types';
import { CpuChipIcon, CogIcon, PencilSquareIcon, UserCircleIcon, InformationCircleIcon, MagnifyingGlassIcon } from './Icons'; 

const getAgentIcon = (agent?: string) => {
  if (!agent) return <InformationCircleIcon className="h-4 w-4 mr-2 text-slate-400 flex-shrink-0" />;
  if (agent.startsWith("Agent 1")) return <CogIcon className="h-4 w-4 mr-2 text-blue-400 flex-shrink-0" />; // Outliner
  if (agent.startsWith("Agent 2")) return <UserCircleIcon className="h-4 w-4 mr-2 text-green-400 flex-shrink-0" />; // Content Writer
  if (agent.startsWith("Agent 3")) return <PencilSquareIcon className="h-4 w-4 mr-2 text-yellow-400 flex-shrink-0" />; // Formatter
  if (agent.startsWith("Agent 4")) return <MagnifyingGlassIcon className="h-4 w-4 mr-2 text-purple-400 flex-shrink-0" />; // Internet Researcher
  return <CpuChipIcon className="h-4 w-4 mr-2 text-sky-400 flex-shrink-0" />; // System or other
};

export const LogDisplay: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) {
    return <p className="text-slate-400 text-sm italic py-4 text-center">Activity logs will appear here...</p>;
  }

  return (
    <div 
      ref={scrollRef} 
      className="h-96 max-h-[calc(60vh_-_theme(spacing.12))] overflow-y-auto bg-slate-800/70 p-3 rounded-md border border-slate-700 space-y-2 text-sm custom-scrollbar"
      aria-live="polite"
      aria-atomic="false" 
      aria-relevant="additions text"
    >
      {logs.map((log, index) => (
        <div 
          key={index} 
          className="flex items-start p-2.5 rounded-md bg-slate-700/60 hover:bg-slate-600/70 transition-colors duration-150 shadow-sm"
          role="listitem"
        >
          <span className="mt-0.5">{getAgentIcon(log.agent)}</span>
          <div className="flex-1">
            <span className="font-mono text-xs text-slate-500 mr-2" aria-hidden="true">
              [{log.timestamp.toLocaleTimeString()}]
            </span>
            {log.agent && <span className={`font-semibold ${
                log.agent.startsWith("Agent 1") ? "text-blue-400" :
                log.agent.startsWith("Agent 2") ? "text-green-400" :
                log.agent.startsWith("Agent 3") ? "text-yellow-400" :
                log.agent.startsWith("Agent 4") ? "text-purple-400" :
                "text-sky-400"
            } mr-1`}>{log.agent}:</span>}
            <span className="text-slate-300 break-words leading-snug">{log.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// Add some CSS for custom scrollbar (optional, but nice)
const style = document.createElement('style');
style.textContent = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #2d3748; /* slate-800 */
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #4a5568; /* slate-600 */
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #718096; /* slate-500 */
  }
`;
document.head.append(style);