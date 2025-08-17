import React, { useState, useCallback, useEffect } from 'react';
import { TopicInput } from './components/TopicInput';
import { LogDisplay } from './components/LogDisplay';
import { TutorialOutput } from './components/TutorialOutput';
import { agent1GenerateOutline, agent2GenerateContent, agent4FetchFromInternet } from './services/geminiService';
import type { FormattedTutorialPart, LogEntry, Agent4Response } from './types';
import { LoadingSpinnerIcon, PlayIcon, DocumentTextIcon, LightBulbIcon, CogIcon, EyeIcon, CheckCircleIcon } from './components/Icons';
import { FullScreenTutorialView } from './components/FullScreenTutorialView';

const App: React.FC = () => {
  const [topic, setTopic] = useState<string>('');
  const [audience, setAudience] = useState<string>('Beginner (13+)');
  const [outlineHeadings, setOutlineHeadings] = useState<string[]>([]); // Will store cleaned headings
  const [completedTutorialParts, setCompletedTutorialParts] = useState<FormattedTutorialPart[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isTutorialComplete, setIsTutorialComplete] = useState<boolean>(false);
  const [currentAgentActivity, setCurrentAgentActivity] = useState<string | null>(null);
  const [showFullScreenTutorial, setShowFullScreenTutorial] = useState<boolean>(false);

  const addLog = useCallback((message: string, agent?: string) => {
    setLogs(prevLogs => [...prevLogs, { timestamp: new Date(), message, agent }]);
  }, []);

  const startFullGenerationProcess = useCallback(async (currentTopic: string, selectedAudience: string, numSections: number) => {
    if (!currentTopic.trim()) {
      setError("Please enter a tutorial topic.");
      addLog("Validation Error: Tutorial topic cannot be empty.", "System");
      return;
    }

    addLog(`Process started for topic: "${currentTopic}" with audience: "${selectedAudience}" and ${numSections} sections.`, "System");
    setTopic(currentTopic);
    setAudience(selectedAudience); // Set the audience state
    setOutlineHeadings([]);
    setCompletedTutorialParts([]);
    setError(null);
    setIsLoading(true);
    setIsTutorialComplete(false);
    setShowFullScreenTutorial(false);
    setCurrentAgentActivity("Initializing workflow...");

    try {
      // Agent 1: Generate Outline
      setCurrentAgentActivity("Agent 1 (Outliner): Generating tutorial outline...");
      addLog(`Requesting outline for ${numSections} sections from Agent 1 (Outliner).`, "Agent 1");
      const rawOutlineWithMarkers = await agent1GenerateOutline(currentTopic, numSections);
      if (rawOutlineWithMarkers.length === 0) {
        throw new Error("Agent 1 (Outliner): Generated an empty outline. Cannot proceed.");
      }
      addLog(`Raw outline received: [${rawOutlineWithMarkers.join(", ")}]`, "Agent 1");
      
      const cleanedHeadings: string[] = [];
      const processingPlan: Array<{ raw: string; cleaned: string; requiresSearch: boolean }> = [];

      rawOutlineWithMarkers.forEach(rawHeading => {
        const requiresSearch = rawHeading.includes("(requires_search)");
        const cleaned = rawHeading.replace("(requires_search)", "").trim();
        cleanedHeadings.push(cleaned);
        processingPlan.push({ raw: rawHeading, cleaned, requiresSearch });
      });
      
      setOutlineHeadings(cleanedHeadings);
      addLog(`Cleaned outline for processing: [${cleanedHeadings.join(", ")}]`, "System");


      let accumulatedParts: FormattedTutorialPart[] = [];
      let previousSectionContext = "This is the first section of the tutorial.";

      for (let i = 0; i < processingPlan.length; i++) {
        const { cleaned: heading, requiresSearch } = processingPlan[i];
        addLog(`Preparing for section ${i + 1}/${processingPlan.length}: "${heading}"`, "System");

        let internetSearchContext: string | undefined = undefined;
        let sourcesForSection: Agent4Response['sources'] | undefined = undefined;

        if (requiresSearch) {
          setCurrentAgentActivity(`Agent 4 (Internet Researcher): Searching for "${heading}"...`);
          addLog(`Requesting internet search for "${heading}" from Agent 4.`, "Agent 4");
          try {
            const agent4Data = await agent4FetchFromInternet(`${currentTopic} - ${heading}`);
            internetSearchContext = agent4Data.summaryText;
            sourcesForSection = agent4Data.sources;
            addLog(`Agent 4 found: "${internetSearchContext.substring(0,100)}..." and ${sourcesForSection.length} sources for "${heading}".`, "Agent 4");
          } catch (e: any) {
            addLog(`Agent 4 Warning: Failed to fetch internet results for "${heading}". Proceeding without. Error: ${e.message}`, "Agent 4");
          }
        }

        // Agent 2: Generate Content
        setCurrentAgentActivity(`Agent 2 (Content Writer): Generating content for "${heading}"...`);
        addLog(`Requesting content for "${heading}" from Agent 2. Audience: ${selectedAudience}. Context: ${previousSectionContext === "This is the first section of the tutorial." ? "First section." : "Flowing from previous content."}${internetSearchContext ? " Includes internet search results." : ""}`, "Agent 2");
        
        const rawContent = await agent2GenerateContent(currentTopic, heading, cleanedHeadings, previousSectionContext, selectedAudience, internetSearchContext);
        addLog(`Raw content received for "${heading}".`, "Agent 2");

        // Agent 3: Format and Store
        setCurrentAgentActivity(`Agent 3 (Formatter): Formatting and storing content for "${heading}"...`);
        addLog(`Agent 3 (Formatter): Processing content for "${heading}".`, "Agent 3");
        
        const cleanedContent = rawContent.trim().startsWith(`## ${heading}`) 
            ? rawContent.trim().substring(`## ${heading}`.length).trim()
            : rawContent.trim();

        const formattedSection = `## ${heading}\n\n${cleanedContent}\n\n`;
        const newPart: FormattedTutorialPart = { 
            heading, 
            fullMarkdownContent: formattedSection,
            sources: sourcesForSection 
        };
        
        accumulatedParts = [...accumulatedParts, newPart];
        setCompletedTutorialParts([...accumulatedParts]); 
        addLog(`Content for "${heading}" formatted and stored. Display updated.`, "Agent 3");

        previousSectionContext = `The previous section was "${heading}" with content starting: "${cleanedContent.substring(0, 100)}${cleanedContent.length > 100 ? '...' : ''}". The next section should logically follow.`;
      }

      addLog("All sections processed. Tutorial generation complete!", "System");
      setIsTutorialComplete(true);

    } catch (e: any) {
      const errorMessage = e.message || "An unknown error occurred during generation.";
      addLog(`Error: ${errorMessage}`, "System");
      setError(`${errorMessage}`);
      console.error("Generation process error:", e);
    } finally {
      setIsLoading(false);
      setCurrentAgentActivity(null);
    }
  }, [addLog]);


  return (
    <>
      <div className={`min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-slate-100 p-4 sm:p-8 flex flex-col items-center transition-opacity duration-300 ${showFullScreenTutorial ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <header className="mb-8 text-center w-full max-w-4xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
            Multi-Agent Tutorial Generator
          </h1>
          <p className="mt-2 text-slate-400 max-w-2xl mx-auto">
            Enter a topic and select an audience. Agent 1 drafts an outline, Agent 4 fetches data, Agent 2 writes, and Agent 3 formats.
          </p>
        </header>

        <div className="w-full max-w-4xl bg-slate-800 shadow-2xl rounded-lg p-6 sm:p-8 space-y-8">
          <TopicInput onSubmit={startFullGenerationProcess} isLoading={isLoading} />

          {isLoading && currentAgentActivity && (
            <div className="flex items-center justify-center p-4 bg-slate-700/80 rounded-md text-slate-300 shadow">
              <LoadingSpinnerIcon className="h-5 w-5 mr-3 text-indigo-400" />
              <span>{currentAgentActivity}</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-800/60 border border-red-600 text-red-200 rounded-md shadow">
              <p className="font-semibold text-red-100">Generation Error:</p>
              <p>{error}</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-700/50 p-4 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-3 text-indigo-400 flex items-center">
                <CogIcon className="h-6 w-6 mr-2" />
                Agent Activity Log
              </h2>
              <LogDisplay logs={logs} />
            </div>

            <div className="bg-slate-700/50 p-4 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-3 text-teal-400 flex items-center">
                <DocumentTextIcon className="h-6 w-6 mr-2" />
                Generated Tutorial
              </h2>
              <TutorialOutput parts={completedTutorialParts} isLoading={isLoading} isComplete={isTutorialComplete} />
            </div>
          </div>

          {isTutorialComplete && completedTutorialParts.length > 0 && !error && (
            <div className="mt-8 p-6 bg-green-800/40 border border-green-600 rounded-lg text-center flex flex-col sm:flex-row items-center justify-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4 shadow-xl">
              <div className="flex items-center">
                <CheckCircleIcon className="h-8 w-8 text-green-400 mr-3"/>
                <div>
                  <h3 className="text-2xl font-bold text-green-300">Tutorial Ready!</h3>
                  <p className="text-slate-300 mt-1">The AI agents have completed the tutorial generation.</p>
                </div>
              </div>
              <button
                onClick={() => setShowFullScreenTutorial(true)}
                className="flex items-center justify-center px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 transition duration-150 ease-in-out"
                aria-label="View Full Tutorial"
              >
                <EyeIcon className="h-5 w-5 mr-2" />
                View Full Tutorial
              </button>
            </div>
          )}
        </div>
        <footer className="mt-12 text-center text-slate-500 text-sm">
          <p>Powered by Gemini API & React. Designed with Tailwind CSS.</p>
        </footer>
      </div>

      {showFullScreenTutorial && completedTutorialParts.length > 0 && (
        <FullScreenTutorialView
          parts={completedTutorialParts}
          topic={topic}
          audience={audience}
          onClose={() => setShowFullScreenTutorial(false)}
        />
      )}
    </>
  );
};

export default App;