import React, { useState } from 'react';
import { PlayIcon, LightBulbIcon, AcademicCapIcon, ListBulletIcon, LanguageIcon } from './Icons';

interface TopicInputProps {
  onSubmit: (topic: string, audience: string, numSections: number, language: string) => void;
  isLoading: boolean;
}

export const TopicInput: React.FC<TopicInputProps> = React.memo(({ onSubmit, isLoading }) => {
  const [topic, setTopic] = useState<string>('');
  const [audience, setAudience] = useState<string>('Beginner (13+)');
  const [numSections, setNumSections] = useState<number>(5);
  const [language, setLanguage] = useState<string>('auto');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Clamp the value on submit as a final safeguard
    const validNumSections = Math.max(3, Math.min(10, numSections || 3));
    if (topic.trim() && !isLoading) {
      onSubmit(topic.trim(), audience, validNumSections, language);
    }
  };

  const handleNumSectionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Update state with the parsed number. Fallback to 0 for empty input.
    // This allows the user to type freely without immediate clamping.
    const value = parseInt(e.target.value, 10);
    setNumSections(isNaN(value) ? 0 : value);
  };

  const handleNumSectionsBlur = () => {
    // When the user clicks away, clamp the value to the allowed range [3, 10].
    const clampedValue = Math.max(3, Math.min(10, numSections || 3));
    setNumSections(clampedValue);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="topic" className="block text-sm font-medium text-slate-300 mb-1">
          <LightBulbIcon className="h-5 w-5 inline mr-1 text-yellow-400" />
          Enter Tutorial Topic
        </label>
        <input
          type="text"
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., Introduction to Quantum Computing, or മലയാളത്തിലെ അടിസ്ഥാന പാചകം"
          className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-500 text-slate-100 transition duration-150 ease-in-out"
          disabled={isLoading}
          aria-label="Tutorial Topic Input"
        />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="audience" className="block text-sm font-medium text-slate-300 mb-1">
            <AcademicCapIcon className="h-5 w-5 inline mr-1 text-sky-400" />
            Choose Target Audience
          </label>
          <select
            id="audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100 transition duration-150 ease-in-out"
            disabled={isLoading}
            aria-label="Target Audience Selector"
          >
            <option>Beginner (13+)</option>
            <option>Curious Kid (8-12)</option>
            <option>Expert</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="numSections" className="block text-sm font-medium text-slate-300 mb-1">
            <ListBulletIcon className="h-5 w-5 inline mr-1 text-teal-400" />
            Number of Sections
          </label>
          <input
            type="number"
            id="numSections"
            value={numSections || ''} // Show empty string if value is 0 for better UX
            onChange={handleNumSectionsChange}
            onBlur={handleNumSectionsBlur}
            min="3"
            max="10"
            className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100 transition duration-150 ease-in-out"
            disabled={isLoading}
            aria-label="Number of tutorial sections"
          />
        </div>
        
        <div>
          <label htmlFor="language" className="block text-sm font-medium text-slate-300 mb-1">
            <LanguageIcon className="h-5 w-5 inline mr-1 text-green-400" />
            Output Language
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100 transition duration-150 ease-in-out"
            disabled={isLoading}
            aria-label="Output Language Selector"
          >
            <option value="auto">Auto-detect from Topic</option>
            <option value="English">English</option>
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
            <option value="German">German</option>
            <option value="Chinese (Simplified)">Chinese (Simplified)</option>
            <option value="Japanese">Japanese</option>
            <option value="Korean">Korean</option>
            <option value="Hindi">Hindi</option>
            <option value="Malayalam">Malayalam</option>
            <option value="Arabic">Arabic</option>
            <option value="Russian">Russian</option>
            <option value="Portuguese">Portuguese</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !topic.trim()}
        className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
        aria-label={isLoading ? "Processing tutorial generation" : "Generate tutorial for the entered topic"}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          <>
            <PlayIcon className="h-5 w-5 mr-2" />
            Generate Tutorial
          </>
        )}
      </button>
    </form>
  );
});

TopicInput.displayName = 'TopicInput';