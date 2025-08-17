
export interface FormattedTutorialPart {
  heading: string;
  fullMarkdownContent: string;
  sources?: Array<{
    title: string;
    uri: string;
  }>;
}

export interface LogEntry {
  timestamp: Date;
  message: string;
  agent?: string; // e.g., "Agent 1", "Agent 2", "System"
}

export interface Agent0Response {
  requires_search: boolean;
}

export interface Agent4Response {
  summaryText: string;
  sources: Array<{
    title: string;
    uri: string;
  }>;
}

// You can define more types here as needed, for example, for API responses if they are complex.