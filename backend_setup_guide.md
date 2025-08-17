# Backend Setup Guide

This guide explains how to set up a secure, resilient backend service for the Multi-Agent Tutorial Generator. Moving the Gemini API calls to a backend is a critical security measure to avoid exposing your `API_KEY` in the browser.

This backend architecture includes a new **Agent 0 (Query Analyzer)**, **automatic API key rotation**, a **custom web scraping tool**, and **persistent file-based logging**. Agent 0 first determines if a topic is time-sensitive. Agent 4 then fetches live search results, which are summarized by a Gemini model to provide relevant, up-to-date information.

## Prerequisites

-   [Docker](https://docs.docker.com/get-docker/)
-   [Docker Compose](https://docs.docker.com/compose/install/)

## Step 1: Project Structure

Create a new directory for your backend (e.g., `backend`) next to your frontend project folder. Inside the `backend` directory, create the following files. The `logs` directory will be created automatically when you run the application.

```
backend/
├── .env
├── docker-compose.yml
├── Dockerfile
├── main.py
├── requirements.txt
└── logs/ (auto-generated)
    └── multi_agent_app.log
```

## Step 2: Create `.env` File

This file stores your secret API keys. It will be loaded by Docker Compose but will not be included in your Docker image, keeping it secure.

Create a file named `.env` and add your Gemini API keys. You no longer need a Serper API key.

```env
# backend/.env

# The system will rotate through these Gemini keys if one gets rate-limited.
API_KEY_1="your_first_gemini_api_key_here"
API_KEY_2="your_second_gemini_api_key_here"
# You can add more, e.g., API_KEY_3="..."
```
**Note:** It is good practice to wrap the keys in quotes.

## Step 3: Create `requirements.txt`

This file lists the Python dependencies for the project. Note the addition of `playwright` for the robust, browser-based search functionality.

```txt
# backend/requirements.txt

fastapi
uvicorn[standard]
gunicorn
pydantic
google-generativeai
python-dotenv
playwright
beautifulsoup4
lxml
```

## Step 4: Create `main.py` (FastAPI App)

This is the core of your backend. Agent 4 (`/fetch-from-internet`) now uses **Playwright** to drive a real browser, making it highly resistant to anti-bot measures. The code is now asynchronous to support Playwright. The system includes professional logging that outputs to both the console (with color) and a persistent log file.

```python
# backend/main.py

import os
import re
import sys
import json
import asyncio
import logging
import threading
import functools
import google.generativeai as genai
from logging.handlers import TimedRotatingFileHandler
from bs4 import BeautifulSoup
from urllib.parse import quote_plus, unquote
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from google.api_core import exceptions as google_exceptions
from playwright.async_api import async_playwright

# --- Beautiful Logging Setup ---
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

class ColorFormatter(logging.Formatter):
    """A custom log formatter to add color to terminal output for better readability."""
    ORANGE = "\033[38;5;208m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD_RED = "\033[1;91m"
    RESET = "\033[0m"
    
    FORMATS = {
        logging.INFO: f"%(asctime)s - {GREEN}INFO{RESET}    - %(message)s",
        logging.WARNING: f"%(asctime)s - {YELLOW}WARNING{RESET} - %(message)s",
        logging.ERROR: f"%(asctime)s - {RED}ERROR{RESET}   - %(message)s",
        logging.CRITICAL: f"%(asctime)s - {BOLD_RED}CRITICAL{RESET}- %(message)s",
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt, datefmt='%Y-%m-%d %H:%M:%S')
        # Custom color for Agent 0
        if "Agent 0" in record.getMessage():
             colored_message = record.getMessage().replace("Agent 0", f"{self.ORANGE}Agent 0{self.RESET}")
             return f"%(asctime)s - {self.GREEN}INFO{self.RESET}    - {colored_message}"
        return formatter.format(record)

# Configure logger
logger = logging.getLogger("MultiAgentAppLogger")
logger.setLevel(logging.INFO)

if not logger.handlers:
    # Console handler for beautiful, color-coded output
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(ColorFormatter())
    logger.addHandler(console_handler)

    # File handler for persistent, parsable logs
    file_handler = TimedRotatingFileHandler(
        os.path.join(LOG_DIR, "multi_agent_app.log"),
        when='midnight',
        interval=1,
        backupCount=7,
        encoding='utf-8'
    )
    file_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)


# --- Environment and API Key Setup ---
load_dotenv()

GEMINI_API_KEYS = [key for key in [os.getenv(f"API_KEY_{i+1}") for i in range(5)] if key]
if not GEMINI_API_KEYS:
    raise ValueError("No Gemini API_KEY environment variables found! Please set at least API_KEY_1 in your .env file.")

logger.info(f"System: Found {len(GEMINI_API_KEYS)} Gemini API key(s).")

current_key_index = 0
key_lock = threading.Lock()

# --- Pydantic Models for Request Bodies ---
class AnalyzeRequest(BaseModel):
    topic: str

class OutlineRequest(BaseModel):
    topic: str
    numSections: int
    language: str
    isTopicTimeSensitive: bool

class ContentRequest(BaseModel):
    topic: str
    currentHeading: str
    allHeadings: List[str]
    previousSectionContext: str
    audience: str
    language: str
    internetSearchContext: Optional[str] = None

class FetchRequest(BaseModel):
    query: str
    language: str

class SimplifyRequest(BaseModel):
    textToSimplify: str
    audience: str
    language: str

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Multi-Agent Tutorial Generator Backend",
    description="A secure backend with Agent 0 (Query Analyzer), key rotation, a robust Playwright-based web scraper, and file logging.",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Reusable Decorator for Gemini API Key Rotation ---
def with_api_key_rotation(func):
    """A decorator that manages Gemini API key rotation and error handling for Gemini agents."""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        global current_key_index
        for i in range(len(GEMINI_API_KEYS)):
            with key_lock:
                key_to_use = GEMINI_API_KEYS[current_key_index]
            try:
                genai.configure(api_key=key_to_use)
                return await func(*args, **kwargs)
            except google_exceptions.ResourceExhausted:
                logger.warning(f"System: Gemini API key ending in '...{key_to_use[-4:]}' is rate limited. Switching to the next key.")
                with key_lock:
                    current_key_index = (current_key_index + 1) % len(GEMINI_API_KEYS)
                if i == len(GEMINI_API_KEYS) - 1:
                    logger.critical("System: All Gemini API keys are currently rate limited.")
                    raise HTTPException(status_code=429, detail="All Gemini API keys are currently rate limited.")
            except Exception as e:
                logger.error(f"System: An unexpected error occurred with a Gemini agent: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        raise HTTPException(status_code=500, detail="Failed to execute the agent after trying all keys.")
    return wrapper

# --- Gemini Model Initialization ---
MODEL_NAME = "gemini-2.5-flash"

# --- API Endpoints ---
@app.get("/", tags=["Health Check"])
async def health_check():
    """Provides a simple health check to confirm the service is running."""
    return {"status": "ok", "message": "Backend is running!"}

@app.post("/analyze-query", response_model=Dict[str, bool])
@with_api_key_rotation
async def analyze_query(req: AnalyzeRequest):
    """Agent 0: Analyzes the user's query to determine if it is time-sensitive."""
    try:
        logger.info(f"Agent 0: Analyzing topic '{req.topic}' for time-sensitivity.")
        model = genai.GenerativeModel(MODEL_NAME)
        prompt = f"""You are a query analysis agent. Determine if a tutorial on "{req.topic}" requires up-to-date internet information. Respond ONLY with a valid JSON object: {{"requires_search": boolean}}. Set to true for current events, latest tech, stats, etc. Set to false for evergreen topics like 'How to bake bread' or 'History of Rome'."""
        response = await model.generate_content_async(prompt, generation_config={"response_mime_type": "application/json", "temperature": 0.0})
        json_str = response.text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(json_str)
    except json.JSONDecodeError:
        logger.error("Agent 0: Failed to parse JSON response from model.")
        raise HTTPException(status_code=500, detail="Agent 0: Model returned invalid JSON for query analysis.")
    except Exception as e:
        logger.error(f"Agent 0: An unexpected error occurred: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Agent 0: An unexpected error occurred: {str(e)}")

@app.post("/generate-outline", response_model=List[str])
@with_api_key_rotation
async def generate_outline(req: OutlineRequest):
    """Agent 1: Generates a tutorial outline."""
    try:
        logger.info(f"Agent 1: Generating outline for topic '{req.topic}'. Time-sensitive: {req.isTopicTimeSensitive}")
        model = genai.GenerativeModel(MODEL_NAME)
        language_instruction = (f'The language of the headings must match the input topic "{req.topic}".' if req.language == 'auto' else f'The language must be {req.language}.')
        search_instruction = "MUST append '(requires_search)' to EVERY heading." if req.isTopicTimeSensitive else "Append '(requires_search)' only to headings you believe need recent info."
        
        prompt = f"""You are an expert curriculum designer. Generate a tutorial outline for: "{req.topic}". {language_instruction} Respond ONLY with a JSON array of {req.numSections} strings. {search_instruction} Example for "AI in 2024": ["Overview", "LLM Breakthroughs (requires_search)"]. The response must be a valid JSON array of strings."""
        response = await model.generate_content_async(prompt, generation_config={"response_mime_type": "application/json", "temperature": 0.4})
        json_str = response.text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(json_str)
    except json.JSONDecodeError:
        logger.error("Agent 1: Failed to parse JSON response from model.")
        raise HTTPException(status_code=500, detail="Agent 1: Model returned invalid JSON for the outline.")
    except Exception as e:
        logger.error(f"Agent 1: An unexpected error occurred: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Agent 1: An unexpected error occurred: {str(e)}")

@app.post("/generate-content", response_model=str)
@with_api_key_rotation
async def generate_content(req: ContentRequest):
    """Agent 2: Generates content for a specific outline heading."""
    try:
        logger.info(f"Agent 2: Generating content for heading '{req.currentHeading}'.")
        model = genai.GenerativeModel(MODEL_NAME)
        language_instruction = (f'Write in the same language as the topic "{req.topic}".' if req.language == 'auto' else f'Write entirely in {req.language}.')
        prompt = f"""You are a technical writer for a tutorial on "{req.topic}" for a "{req.audience}" audience. {language_instruction} The full outline is: {req.allHeadings}. You are writing for: "{req.currentHeading}". Previous context: {req.previousSectionContext}. {f'Use this search info: <search>{req.internetSearchContext}</search>' if req.internetSearchContext else ''}. Write 2-5 paragraphs. Use Markdown but NOT H1/H2 headings. Dive straight into the content."""
        response = await model.generate_content_async(prompt, generation_config={"temperature": 0.65})
        return response.text
    except Exception as e:
        logger.error(f"Agent 2: Failed to generate content for '{req.currentHeading}': {e}")
        raise HTTPException(status_code=500, detail=f"Agent 2: Failed to generate content: {str(e)}")

@app.post("/fetch-from-internet", response_model=Dict[str, Any])
async def fetch_from_internet(req: FetchRequest):
    """Agent 4: Fetches and summarizes internet search results using Playwright."""
    logger.info(f"Agent 4: Received search query '{req.query}'. Launching browser.")
    
    search_results_json = []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            url = f"https://html.duckduckgo.com/html/?q={quote_plus(req.query)}"
            await page.goto(url, wait_until='domcontentloaded')
            
            raw_html = await page.content()
            await browser.close()

        soup = BeautifulSoup(raw_html, 'lxml')
        results = soup.find_all('div', class_='result')

        if not results:
            logger.warning("Agent 4: Playwright found 0 elements with class 'result'. Page structure may have changed.")
            debug_path = os.path.join(LOG_DIR, "scraper_debug.html")
            with open(debug_path, "w", encoding="utf-8") as f:
                f.write(raw_html)
            logger.info(f"Agent 4: Saved raw HTML to {debug_path} for analysis.")
        
        for item in results:
            if 'result--ad' in item.get('class', []):
                logger.info("Agent 4: Skipping ad result based on class.")
                continue
            
            title_tag = item.find('a', class_='result__a')
            snippet_tag = item.find('a', class_='result__snippet')
            
            if title_tag and snippet_tag:
                raw_link = title_tag.get('href', '')
                clean_link = raw_link
                if raw_link.startswith('/l/'):
                    match = re.search(r'uddg=([^&]+)', raw_link)
                    if match:
                        clean_link = unquote(match.group(1))
                    else:
                        logger.warning(f"Agent 4: Could not parse redirect link: {raw_link}")
                        continue
                
                title = title_tag.get_text(strip=True)
                snippet = snippet_tag.get_text(strip=True)
                search_results_json.append({"title": title, "link": clean_link, "snippet": snippet})

            if len(search_results_json) >= 8: # Limit to 8 results
                break
        
        if not search_results_json:
            logger.warning("Agent 4: Web scraper found no organic results after parsing.")
            return {"summaryText": "No relevant information could be found for this topic.", "sources": []}

    except Exception as e:
        logger.error(f"Agent 4: An error occurred during web scraping with Playwright: {e}")
        raise HTTPException(status_code=500, detail="Agent 4: Error fetching search results from the web.")
        
    @with_api_key_rotation
    async def get_summary_from_gemini(search_context: str):
        logger.info("Agent 4: Sending scraped results to Gemini for summarization.")
        model = genai.GenerativeModel(MODEL_NAME)
        language_instruction = (f'Respond in the same language as the query.' if req.language == 'auto' else f'Respond in {req.language}.')
        prompt = f"""You are a research assistant. Synthesize the information from the provided web search results to answer the user's query.
User Query: "{req.query}".
{language_instruction}
Use the snippets to construct a concise, accurate summary. Do not mention "Based on the search results...". Provide the summary directly.

Search Results (JSON):
{search_context}
"""
        response = await model.generate_content_async(prompt, generation_config={"temperature": 0.5})
        return response.text

    try:
        summary_text = await get_summary_from_gemini(json.dumps(search_results_json, indent=2))
        sources = [{"uri": item["link"], "title": item["title"]} for item in search_results_json]
        return {"summaryText": summary_text.strip(), "sources": sources}
    except Exception as e:
        logger.error(f"Agent 4: An error occurred during Gemini summarization: {e}")
        raise HTTPException(status_code=500, detail="Agent 4: Failed to summarize search results.")

@app.post("/simplify-text", response_model=str)
@with_api_key_rotation
async def simplify_text(req: SimplifyRequest):
    """Agent 5: Simplifies a piece of text."""
    try:
        logger.info(f"Agent 5: Simplifying text for audience '{req.audience}'.")
        model = genai.GenerativeModel(MODEL_NAME)
        language_instruction = (f'Rewrite in the same language as the original text.' if req.language == 'auto' else f'Rewrite in {req.language}.')
        prompt = f"""Rewrite the following text for a "{req.audience}" audience. {language_instruction} For kids, use simple analogies. For beginners, explain jargon. For experts, be concise. Provide only the rewritten text. Original: \"\"\"{req.textToSimplify}\"\"\""""
        response = await model.generate_content_async(prompt, generation_config={"temperature": 0.5})
        return response.text
    except Exception as e:
        logger.error(f"Agent 5: Failed to simplify text: {e}")
        raise HTTPException(status_code=500, detail=f"Agent 5: Failed to simplify text: {str(e)}")
```

## Step 5: Create `Dockerfile`

This file contains the instructions for Docker to build a container image for your application. It has been updated to install the Playwright browser dependencies.

```dockerfile
# backend/Dockerfile

# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers and their dependencies
RUN playwright install --with-deps chromium

# Copy the rest of the application's code into the container
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application using Gunicorn with Uvicorn workers
# This is a production-ready setup
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-w", "4", "-b", "0.0.0.0:8000", "main:app"]
```

## Step 6: Create `docker-compose.yml`

Docker Compose is a tool for defining and running multi-container Docker applications. This file has been updated to include a **volume mapping**, which ensures that the log files generated inside the Docker container are saved to a `logs` directory on your computer for persistence.

```yaml
# backend/docker-compose.yml

version: '3.8'

services:
  backend-api:
    build: .
    container_name: tutorial_generator_backend
    ports:
      - "127.0.0.1:8000:8000"
    env_file:
      - .env
    # This volume mapping saves logs to a ./logs directory on your host machine
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

## Step 7: Running the Backend

With all the files in place, starting the backend is easy:

1.  Open your terminal.
2.  Navigate into the `backend` directory: `cd backend`
3.  Run the following command:
    ```bash
    docker compose up --build
    ```
    (Note: Some older versions of Docker Compose might use `docker-compose` with a hyphen). The first build will take a bit longer as it downloads the Playwright browser.

Your secure and resilient backend API will now be running and accessible only at `http://127.0.0.1:8000`. You will see structured, color-coded logs directly in this terminal window.

### Checking the Log Files

After running the backend and making some API requests, you will find a new `logs` directory inside your `backend` folder. It will contain a file named `multi_agent_app.log`, which you can open to view the persistent, timestamped logs for auditing or debugging.

### Testing the Backend with `curl`

Once the backend is running, test its endpoints directly from your terminal.

**1. Test Health Check (`/`)**
```bash
curl "http://127.0.0.1:8000/"
```
*Expected output: `{"status":"ok","message":"Backend is running!"}`*

**2. Test `/analyze-query` (Agent 0)**
This tests the new Agent 0.

**For Bash, PowerShell, etc.:**
```bash
curl -X POST "http://127.0.0.1:8000/analyze-query" \
-H "Content-Type: application/json" \
-d '{
  "topic": "Latest advancements in AI in 2024"
}'
```
*Expected output: `{"requires_search":true}`*

**For Windows CMD:**
```bash
curl -X POST "http://127.0.0.1:8000/analyze-query" ^
-H "Content-Type: application/json" ^
-d "{\"topic\": \"Latest advancements in AI in 2024\"}"
```
*Expected output: `{"requires_search":true}`*

**3. Test `/generate-outline` (Agent 1)**
This tests the updated Agent 1.

**For Bash, PowerShell, etc.:**
```bash
curl -X POST "http://127.0.0.1:8000/generate-outline" \
-H "Content-Type: application/json" \
-d '{
  "topic": "Introduction to Python",
  "numSections": 5,
  "language": "English",
  "isTopicTimeSensitive": false
}'
```

**For Windows CMD:**
```bash
curl -X POST "http://127.0.0.1:8000/generate-outline" ^
-H "Content-Type: application/json" ^
-d "{\"topic\": \"Introduction to Python\", \"numSections\": 5, \"language\": \"English\", \"isTopicTimeSensitive\": false}"
```
*Expected output: A JSON array of strings, likely without `(requires_search)`.*

**4. Test `/fetch-from-internet` (Agent 4)**
This tests Agent 4 using the custom web scraper.

**For Bash, PowerShell, etc.:**
```bash
curl -X POST "http://127.0.0.1:8000/fetch-from-internet" \
-H "Content-Type: application/json" \
-d '{
  "query": "What is the current status of ChatGPT 5?",
  "language": "English"
}'
```
*Expected output: A JSON object with a `summaryText` string and a `sources` array of links.*

**5. Test `/generate-content` (Agent 2)**
**For Bash, PowerShell, etc.:**
```bash
curl -X POST "http://127.0.0.1:8000/generate-content" \
-H "Content-Type: application/json" \
-d '{
  "topic": "Introduction to Python",
  "currentHeading": "Variables and Data Types",
  "allHeadings": ["Introduction", "Variables and Data Types", "Control Flow"],
  "previousSectionContext": "The previous section was an introduction to Python.",
  "audience": "Beginner (13+)",
  "language": "English"
}'
```
*Expected output: A plain text string with the generated content.*

**6. Test `/simplify-text` (Agent 5)**
**For Bash, PowerShell, etc.:**
```bash
curl -X POST "http://127.0.0.1:8000/simplify-text" \
-H "Content-Type: application/json" \
-d '{
  "textToSimplify": "Quantum superposition is a fundamental principle of quantum mechanics.",
  "audience": "Curious Kid (8-12)",
  "language": "English"
}'
```
*Expected output: A simplified version of the input text as a plain string.*

If these commands work, your backend is ready!

## Step 8: Frontend Integration

Your frontend code has been prepared to easily switch to this backend.

1.  **Open the file `services/geminiService.ts`** in your frontend project.

2.  **For each function** (`agent0AnalyzeQuery`, `agent1GenerateOutline`, etc.), you will find two blocks of code:
    *   The current implementation, labeled `--- CURRENT IMPLEMENTATION (Direct Gemini API Call) ---`.
    *   A commented-out block, labeled `--- BACKEND INTEGRATION ---`.

3.  **To switch a function to use the backend:**
    *   **Comment out** the entire `try/catch` block under `--- CURRENT IMPLEMENTATION ---`.
    *   **Uncomment** the entire `try/catch` block under `--- BACKEND INTEGRATION ---`.

    Repeat this for all functions in the file.

4.  **(Optional but Recommended) Clean up frontend dependencies:**
    *   Once all functions in `services/geminiService.ts` are using the backend, the Gemini SDK is no longer needed on the frontend.
    *   You can now **delete the entire `--- FRONTEND-ONLY SETUP ---` section** at the top of the file, including the `@google/genai` import and the `apiKey` variable. This will reduce your frontend's bundle size and completely secure your application.