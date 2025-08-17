// --- FRONTEND-ONLY SETUP ---
// The API key is currently used directly in the browser.
// This is suitable for development but not for production.
//
// ---> ACTION REQUIRED FOR BACKEND <---
// Once you have switched all functions below to use the backend, you can
// safely REMOVE this entire "FRONTEND-ONLY SETUP" section,
// including the "@google/genai" import. This will completely remove
// the Gemini SDK from your frontend bundle.
{/*
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { Agent0Response, Agent4Response } from '../types';

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("CRITICAL: API_KEY environment variable not set. Application functionality will be severely impaired.");
}

const ai = new GoogleGenAI({ apiKey: apiKey as string });

const modelName = "gemini-2.5-flash";
*/}
// --- END OF FRONTEND-ONLY SETUP ---


// --- BACKEND SETUP ---
// The URL for your secure backend server.
// Ensure this matches the address where your FastAPI backend is running.
const BACKEND_URL = 'https://problembuddy.com/tutorial/api/';


/**
 * Agent 0: Analyzes the user's query to determine if it is time-sensitive.
 */
export const agent0AnalyzeQuery = async (topic: string): Promise<Agent0Response> => {
  // --- CURRENT IMPLEMENTATION (Direct Gemini API Call) ---
  /*
  try {
    const prompt = `You are a query analysis agent. Your task is to determine if a user's topic for a tutorial inherently requires up-to-date, recent information from the internet to be accurate and comprehensive.
Topics that need this include current events, the latest technological advancements, recent discoveries, statistics, or anything that has changed significantly in the last year.
Topics that DO NOT need this include evergreen subjects, historical events, fundamental concepts, or established knowledge.

Analyze the following topic: "${topic}"

Respond ONLY with a valid JSON object in the format: {"requires_search": boolean}.
- Set "requires_search" to true if the topic is time-sensitive.
- Set "requires_search" to false otherwise.

Examples:
- Topic: "Latest advancements in AI 2024" -> {"requires_search": true}
- Topic: "What is the capital of France?" -> {"requires_search": false}
- Topic: "Beginner's guide to baking bread" -> {"requires_search": false}
- Topic: "Review of the new iPhone model" -> {"requires_search": true}
- Topic: "How does photosynthesis work?" -> {"requires_search": false}
- Topic: "US Presidential Election 2024 Results" -> {"requires_search": true}`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.0,
      }
    });

    const jsonStr = response.text.trim();
    const result = JSON.parse(jsonStr);
    
    if (typeof result.requires_search !== 'boolean') {
      console.error("Agent 0 (Query Analyzer): Invalid response format.", result);
      return { requires_search: false }; // Default to false on error
    }
    
    return result;

  } catch (error: any) {
    console.error("Error in agent0AnalyzeQuery:", error);
    throw new Error(`Agent 0 (Query Analyzer): Failed to analyze topic. ${error.message}`);
  }
  */

  // --- BACKEND INTEGRATION ---
  
  try {
    const response = await fetch(`${BACKEND_URL}/analyze-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: `Backend request failed with status ${response.status}` }));
      throw new Error(errorData.detail || `Agent 0 (Query Analyzer): Backend request failed.`);
    }

    return await response.json();
  } catch (error: any) {
    console.error("Error in agent0AnalyzeQuery (backend call):", error);
    throw new Error(`Agent 0 (Query Analyzer): Failed to analyze topic via backend. ${error.message}`);
  }
  
};


/**
 * Agent 0: Analyzes the user's query to determine if it is time-sensitive.
 */
export const agent0AnalyzeQuery = async (topic: string): Promise<Agent0Response> => {
  // --- CURRENT IMPLEMENTATION (Direct Gemini API Call) ---
  try {
    const prompt = `You are a query analysis agent. Your task is to determine if a user's topic for a tutorial inherently requires up-to-date, recent information from the internet to be accurate and comprehensive.
Topics that need this include current events, the latest technological advancements, recent discoveries, statistics, or anything that has changed significantly in the last year.
Topics that DO NOT need this include evergreen subjects, historical events, fundamental concepts, or established knowledge.

Analyze the following topic: "${topic}"

Respond ONLY with a valid JSON object in the format: {"requires_search": boolean}.
- Set "requires_search" to true if the topic is time-sensitive.
- Set "requires_search" to false otherwise.

Examples:
- Topic: "Latest advancements in AI 2024" -> {"requires_search": true}
- Topic: "What is the capital of France?" -> {"requires_search": false}
- Topic: "Beginner's guide to baking bread" -> {"requires_search": false}
- Topic: "Review of the new iPhone model" -> {"requires_search": true}
- Topic: "How does photosynthesis work?" -> {"requires_search": false}
- Topic: "US Presidential Election 2024 Results" -> {"requires_search": true}`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.0,
      }
    });

    const jsonStr = response.text.trim();
    const result = JSON.parse(jsonStr);
    
    if (typeof result.requires_search !== 'boolean') {
      console.error("Agent 0 (Query Analyzer): Invalid response format.", result);
      return { requires_search: false }; // Default to false on error
    }
    
    return result;

  } catch (error: any) {
    console.error("Error in agent0AnalyzeQuery:", error);
    throw new Error(`Agent 0 (Query Analyzer): Failed to analyze topic. ${error.message}`);
  }

  // --- BACKEND INTEGRATION ---
  /*
  try {
    const response = await fetch(`${BACKEND_URL}/analyze-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: `Backend request failed with status ${response.status}` }));
      throw new Error(errorData.detail || `Agent 0 (Query Analyzer): Backend request failed.`);
    }

    return await response.json();
  } catch (error: any) {
    console.error("Error in agent0AnalyzeQuery (backend call):", error);
    throw new Error(`Agent 0 (Query Analyzer): Failed to analyze topic via backend. ${error.message}`);
  }
  */
};


/**
 * Agent 1: Generates a tutorial outline.
 */
export const agent1GenerateOutline = async (topic: string, numSections: number, language: string, isTopicTimeSensitive: boolean): Promise<string[]> => {
  // --- CURRENT IMPLEMENTATION (Direct Gemini API Call) ---
  // To use the backend, comment out this entire try/catch block.
  /**
  try {
    const languageInstruction = language === 'auto'
      ? `The language of the headings in the JSON array must match the language of the input topic "${topic}".`
      : `The language of the headings in the JSON array must be ${language}.`;

    const searchInstruction = isTopicTimeSensitive
        ? `The topic has been identified as time-sensitive, so you MUST append the marker "(requires_search)" to EVERY heading string you generate.`
        : `For each heading, if you strongly believe it requires very recent information (e.g., current events, latest statistics, rapidly evolving tech that changes yearly/monthly), append the marker "(requires_search)" to that heading string.`;

    const prompt = `You are an expert curriculum designer.
Generate a concise tutorial outline for the topic: "${topic}".
${languageInstruction}
Respond ONLY with a JSON array of strings, where each string is a main section heading.
The array should contain exactly ${numSections} unique and logically sequenced headings.
${searchInstruction}
Example for topic "Latest Advancements in AI (2024)" with 5 sections: ["Overview of AI in 2024", "Breakthroughs in Large Language Models (requires_search)", "New Applications in Healthcare (requires_search)", "Ethical Debates and Regulations", "Future Trends in AI (requires_search)"]
Example for topic "Learning Basic Python" with 7 sections: ["Introduction to Python", "Setting Up Your Environment", "Variables and Data Types", "Control Flow (If/Else, Loops)", "Functions", "Basic Data Structures (Lists, Dictionaries)", "Next Steps & Resources"]

Do not include any introductory phrases, explanations, or markdown formatting outside the JSON array itself.
The response must be a valid JSON array of strings.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.4,
        topK: 32,
        topP: 0.9,
      }
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
    }
    
    const outline = JSON.parse(jsonStr);
    if (!Array.isArray(outline) || !outline.every(item => typeof item === 'string' && item.trim() !== '')) {
      console.error("API returned an invalid outline format. Raw response:", response.text);
      throw new Error("Agent 1 (Outliner): Received an invalid outline format. Expected a non-empty array of strings.");
    }
    if (outline.length === 0) {
        throw new Error("Agent 1 (Outliner): Generated an empty outline array.");
    }
    return outline.filter(heading => heading.length > 0);

  } catch (error: any) {
    console.error("Error in agent1GenerateOutline:", error, "Raw response text:", error.response?.text);
    let message = `Agent 1 (Outliner): Failed to generate outline.`;
    if (error.message.includes("JSON.parse")) {
        message += " Could not parse the response as valid JSON.";
    } else {
        message += ` ${error.message}`;
    }
    throw new Error(message);
  }
  */

  // --- BACKEND INTEGRATION ---
  // To use the backend, first ensure your FastAPI backend is running.
  // Then, uncomment the following try/catch block.
  
  try {
    const response = await fetch(`${BACKEND_URL}/generate-outline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, numSections, language, isTopicTimeSensitive }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: `Backend request failed with status ${response.status}` }));
      throw new Error(errorData.detail || `Agent 1 (Outliner): Backend request failed.`);
    }

    const outline = await response.json();
    if (!Array.isArray(outline) || !outline.every(item => typeof item === 'string')) {
      throw new Error("Agent 1 (Outliner): Received an invalid outline format from the backend.");
    }
    return outline.filter(heading => heading.length > 0);
  } catch (error: any) {
    console.error("Error in agent1GenerateOutline (backend call):", error);
    throw new Error(`Agent 1 (Outliner): Failed to generate outline via backend. ${error.message}`);
  }
  
};

/**
 * Agent 2: Generates content for a specific outline heading.
 */
export const agent2GenerateContent = async (
  topic: string,
  currentHeading: string,
  allHeadings: string[],
  previousSectionContext: string,
  audience: string,
  language: string,
  internetSearchContext?: string
): Promise<string> => {
  const localPreviousSectionContext = previousSectionContext;
  
  // --- CURRENT IMPLEMENTATION (Direct Gemini API Call) ---
  // To use the backend, comment out this entire try/catch block.
  /*
  try {
    const currentIndex = allHeadings.indexOf(currentHeading);
    const nextHeading = currentIndex !== -1 && currentIndex < allHeadings.length - 1 ? allHeadings[currentIndex + 1] : null;

    const languageInstruction = language === 'auto'
        ? `The response must be written entirely in the same language as the topic "${topic}" and the current heading "${currentHeading}".`
        : `The response must be written entirely in ${language}.`;

    let prompt = `You are an expert technical writer and educator, creating content for a tutorial on "${topic}".
${languageInstruction}

The overall tutorial outline is: ${JSON.stringify(allHeadings)}.
Your target audience is: "${audience}". Adapt your writing style, tone, examples, and complexity accordingly. For a "Curious Kid", use simple analogies and engaging language. For a "Beginner", be clear and avoid jargon where possible. For an "Expert", be concise and technically deep.

You are currently writing the body content for the section titled: "${currentHeading}".

Context from previous section: ${localPreviousSectionContext}
${internetSearchContext ? `\n\nAdditionally, here is some relevant information obtained from a recent internet search related to "${currentHeading}":\n<search_results>\n${internetSearchContext}\n</search_results>\nIncorporate this information naturally where appropriate, but ensure your main focus remains on explaining the core concepts of "${currentHeading}". Do not directly quote the search results unless stylistically appropriate (e.g. citing a statistic and its source).\n` : ''}
${nextHeading ? `The next section will be: "${nextHeading}". Ensure your content flows smoothly towards it but primarily focuses on the current heading.` : 'This is the last section of the tutorial. Provide a good concluding feel if appropriate for the topic, or summarize key takeaways related to this final heading.'}

Instructions for your response:
1.  Provide detailed, informative, and easy-to-understand text for this section's body, tailored for the specified audience.
2.  The content should be substantial (aim for 2-5 paragraphs, or equivalent detail with lists/code snippets if appropriate for the heading).
3.  Use clear language. Explain complex terms if necessary.
4.  You MAY use Markdown for formatting (e.g., bullet points using '*' or '-', bold text using '**text**', inline code with \`code\`). Do NOT use H1 (#) or H2 (##) Markdown headings, as the main section heading ("${currentHeading}") is already handled.
5.  Focus ONLY on the content for "${currentHeading}". Do NOT repeat the section title in your response.
6.  Do NOT write "In this section..." or similar meta-commentary about the section structure. Dive straight into the subject matter.
7.  Ensure the content is distinct and relevant to "${currentHeading}" and flows logically from the \`localPreviousSectionContext\`. If internet search context was provided, integrate it smoothly.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.65, 
        topK: 40,
        topP: 0.95,
      }
    });
    
    return response.text.trim();

  } catch (error: any) {
    console.error(`Error in agent2GenerateContent for heading "${currentHeading}":`, error);
    throw new Error(`Agent 2 (Content Writer): Failed to generate content for "${currentHeading}". ${error.message}`);
  }
  */

  // --- BACKEND INTEGRATION ---
  // To use the backend, uncomment the following try/catch block.
  
  try {
    const response = await fetch(`${BACKEND_URL}/generate-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        currentHeading,
        allHeadings,
        previousSectionContext: localPreviousSectionContext,
        audience,
        language,
        internetSearchContext,
      }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `Backend request failed with status ${response.status}` }));
        throw new Error(errorData.detail || `Agent 2 (Content Writer): Backend request failed.`);
    }

    return await response.json(); // FastAPI returns the string directly in the body
  } catch (error: any) {
      console.error(`Error in agent2GenerateContent for heading "${currentHeading}" (backend call):`, error);
      throw new Error(`Agent 2 (Content Writer): Failed to generate content for "${currentHeading}" via backend. ${error.message}`);
  }
  
};

/**
 * Agent 4: Fetches information from the internet using Google Search grounding.
 */
export const agent4FetchFromInternet = async (query: string, language: string): Promise<Agent4Response> => {
  // --- CURRENT IMPLEMENTATION (Direct Gemini API Call) ---
  // To use the backend, comment out this entire try/catch block.
  /*
  try {
     const languageInstruction = language === 'auto'
        ? `Respond in the same language as the query.`
        : `Respond in ${language}.`;

    const prompt = `Provide a concise summary and key information about: "${query}".
${languageInstruction}
Focus on recent developments, data, or facts if the query implies it.
Extract key information relevant to this query.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
        temperature: 0.5,
      },
    });

    const summaryText = response.text.trim();
    const sources: Array<{ title: string; uri: string }> = [];

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata && groundingMetadata.groundingChunks) {
      groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web && chunk.web.uri) {
          sources.push({
            uri: chunk.web.uri,
            title: chunk.web.title || chunk.web.uri,
          });
        }
      });
    }

    return { summaryText, sources };

  } catch (error: any) {
    console.error(`Error in agent4FetchFromInternet for query "${query}":`, error);
    throw new Error(`Agent 4 (Internet Researcher): Failed to fetch information for "${query}". ${error.message}`);
  }
  */

  // --- BACKEND INTEGRATION ---
  // To use the backend, uncomment the following try/catch block.
  
  try {
    const response = await fetch(`${BACKEND_URL}/fetch-from-internet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, language }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `Backend request failed with status ${response.status}` }));
        throw new Error(errorData.detail || `Agent 4 (Internet Researcher): Backend request failed.`);
    }

    return await response.json();
  } catch (error: any) {
      console.error(`Error in agent4FetchFromInternet for query "${query}" (backend call):`, error);
      throw new Error(`Agent 4 (Internet Researcher): Failed to fetch information for "${query}" via backend. ${error.message}`);
  }
  
};

/**
 * Agent 5: Simplifies a piece of text for a specific audience.
 */
export const agent5SimplifyText = async (textToSimplify: string, audience: string, language: string): Promise<string> => {
  // --- CURRENT IMPLEMENTATION (Direct Gemini API Call) ---
  // To use the backend, comment out this entire try/catch block.
  /*
  try {
    const languageInstruction = language === 'auto'
        ? `The rewritten text must be in the same language as the original text.`
        : `The rewritten text must be in ${language}.`;

    const prompt = `You are an expert at simplifying complex topics.
Rewrite the following text to be easily understandable for the target audience: "${audience}".
${languageInstruction}
- If the audience is a "Curious Kid (8-12)", use very simple words, short sentences, and a fun, encouraging tone. Use an analogy if it helps.
- If the audience is a "Beginner (13+)", explain jargon and focus on clarity and foundational concepts.
- If the audience is an "Expert", rephrase for maximum clarity and conciseness, removing any fluff.

Do not add any conversational introductions like "Sure, here's the simplified text:". Just provide the rewritten text directly.

Original Text:
"""
${textToSimplify}
"""`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.5,
      }
    });
    
    return response.text.trim();

  } catch (error: any) {
    console.error(`Error in agent5SimplifyText:`, error);
    throw new Error(`Agent 5 (Simplifier): Failed to simplify text. ${error.message}`);
  }
  */

  // --- BACKEND INTEGRATION ---
  // To use the backend, uncomment the following try/catch block.
  
  try {
    const response = await fetch(`${BACKEND_URL}/simplify-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textToSimplify, audience, language }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `Backend request failed with status ${response.status}` }));
        throw new Error(errorData.detail || `Agent 5 (Simplifier): Backend request failed.`);
    }

    return await response.json();
  } catch (error: any) {
      console.error(`Error in agent5SimplifyText (backend call):`, error);
      throw new Error(`Agent 5 (Simplifier): Failed to simplify text via backend. ${error.message}`);
  }
  
};
