# Multi-Agent AI Tutorial Generator

This project is a sophisticated web application that leverages a multi-agent AI system to automatically generate complete, well-structured tutorials on any given topic. Users can specify a topic, target audience, language, and the number of sections, and then watch in real-time as a team of specialized AI agents collaborates to build the content.

The application is built with a production-ready architecture, featuring a React/TypeScript frontend and a secure, resilient FastAPI backend designed to run in Docker.

**(Link to Live Demo - Placeholder)**

---

## Key Features

-   **Multi-Agent Workflow**: Utilizes a coordinated system of AI agents, each with a specific role (Outliner, Researcher, Content Writer, Simplifier), to produce high-quality content.
-   **Dynamic & Customizable**: Generate tutorials tailored to different topics, audiences (from kids to experts), languages, and lengths.
-   **Resilient Internet Search**: Agent 4 uses a **dual-method search strategy** for maximum reliability. It first attempts a high-speed, direct scrape using `requests` and `lxml`. If that fails, it automatically falls back to the robust Serper API, ensuring the system can always gather up-to-date information and sources.
-   **Real-Time Logging**: An activity log displays the step-by-step process of the AI agents, providing transparency into the generation workflow.
-   **Interactive Full-Screen View**: A polished, full-screen reader mode for the generated tutorial.
-   **On-Demand Simplification**: Within the reader, users can select complex paragraphs and have an AI agent simplify them for the chosen audience.
-   **RSVP Speed Reader**: Includes a "Rapid Serial Visual Presentation" feature to help users read the generated content quickly.
-   **Markdown Export**: Easily save the final tutorial as a `.md` file.
-   **Secure Backend Architecture**: All API calls are routed through a secure backend that protects API keys and includes automatic key rotation to handle rate limits gracefully.
-   **Responsive UI/UX**: A modern, clean, and responsive interface built with Tailwind CSS.

---

## Screenshots

*(Placeholder for an animated GIF showing the app in action)*

*(Placeholder for screenshots of the main UI, the full-screen view, and the RSVP reader)*

---

## Architecture Overview

The application is divided into a frontend client and a backend service to ensure security and scalability.

### The Multi-Agent System

The core logic simulates a team of experts working on a document:

1.  **Agent 0 (The Query Analyzer)**: Analyzes the user's topic to determine if it is time-sensitive and requires global internet searches.
2.  **Agent 1 (The Outliner)**: Receives the user's topic and Agent 0's analysis. It designs a logical curriculum and outputs a structured outline, flagging headings that require internet research.
3.  **Agent 4 (The Internet Researcher)**: When a heading is flagged, this agent uses its **resilient dual-method search tool**. It first attempts a fast, direct scrape. If that fails, it automatically falls back to the Serper API to guarantee results. It then passes a summary of its findings to the Content Writer.
4.  **Agent 2 (The Content Writer)**: For each heading, this agent writes the main body content, incorporating context from previous sections and Agent 4's research to ensure a smooth, logical flow adapted to the target audience.
5.  **Agent 3 (The Formatter)**: This role is handled by the frontend, which assembles the raw markdown from Agent 2 into the progressively building tutorial.
6.  **Agent 5 (The Simplifier)**: An on-demand agent in the full-screen view that rewrites selected text to be simpler and more accessible.

### Client-Server Model

-   **Frontend**: A React SPA (Single Page Application) built with TypeScript and styled with Tailwind CSS. It handles all user interactions and renders the UI.
-   **Backend**: A Python FastAPI server that acts as a secure proxy to the Google Gemini API.
    -   **Security**: It keeps API keys completely hidden from the browser.
    -   **Resilience**: It manages a pool of Gemini API keys and automatically rotates them to handle rate limits. It also features the primary/fallback search system for high availability.
    -   **Containerized**: The backend is designed to be run with Docker and Gunicorn for a production-ready, scalable deployment.

---

## Tech Stack

-   **Frontend**: React, TypeScript, Tailwind CSS
-   **AI API**: Google Gemini (`gemini-2.5-flash`)
-   **Backend**: Python, FastAPI
-   **Web Search**: Python `requests`, `lxml`, Serper API
-   **Deployment**: Docker, Docker Compose, Gunicorn

---

## Getting Started

Follow these instructions to get the project running on your local machine.

### Prerequisites

-   Node.js & npm
-   Docker & Docker Compose

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/multi-agent-tutorial-generator.git
cd multi-agent-tutorial-generator
```

### 2. Frontend Setup

The frontend can be run in two modes: standalone (for quick testing) or connected to the secure backend (recommended).

**A) Standalone Mode (API Key in Browser - Development Only)**

1.  **Navigate to the frontend directory** (this is the root of the project).
2.  **Create an environment file**:
    ```bash
    # This step might not be necessary if you are using a modern dev server
    # that reads .env files by default.
    # Check your project setup. For Vite, a `.env.local` is often used.
    echo "API_KEY=your_gemini_api_key_here" > .env
    ```
3.  **Install dependencies and run**:
    ```bash
    npm install
    npm start
    ```
    The application will be available at `http://localhost:5173`.

**B) Connected to Backend (Secure Mode - Production)**

Follow the backend setup first, then proceed here.

1.  **Open `services/geminiService.ts`**.
2.  In each function (`agent1GenerateOutline`, `agent2GenerateContent`, etc.), **comment out** the `try/catch` block under `--- CURRENT IMPLEMENTATION ---` and **uncomment** the block under `--- BACKEND INTEGRATION ---`.
3.  **Cleanup**: Once all functions are switched, you can safely delete the `--- FRONTEND-ONLY SETUP ---` section at the top of `services/geminiService.ts` to remove the Gemini SDK from the frontend bundle entirely.
4.  Start the frontend as usual: `npm install && npm start`. It will now make requests to your local backend server.

### 3. Backend Setup

For detailed instructions, see the **`backend_setup_guide.md`** file.

1.  **Navigate to the backend directory**:
    ```bash
    cd backend
    ```
2.  **Create an environment file** named `.env`. Add your Gemini and Serper API keys:
    ```env
    # backend/.env
    API_KEY_1="your_first_gemini_api_key_here"
    API_KEY_2="your_second_gemini_api_key_here"
    SERPER_API_KEY="your_serper_api_key_here"
    ```
3.  **Build and run with Docker Compose**:
    ```bash
    docker compose up --build
    ```
    The secure backend API will be running at `http://localhost:8000`.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.