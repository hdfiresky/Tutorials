# Backend Setup Guide

This guide explains how to set up a secure, resilient backend service for the Multi-Agent Tutorial Generator. Moving the Gemini API calls to a backend is a critical security measure to avoid exposing your `API_KEY` in the browser.

This enhanced version includes **automatic API key rotation** for Gemini calls and uses a robust **Retrieval-Augmented Generation (RAG)** pattern for the internet search agent. This new architecture is more reliable and avoids the complex and error-prone search integration of the Gemini library.

## Prerequisites

-   [Docker](https://docs.docker.com/get-docker/)
-   [Docker Compose](https://docs.docker.com/compose/install/)

## Step 1: Project Structure

Create a new directory for your backend (e.g., `backend`) next to your frontend project folder. Inside the `backend` directory, create the following files:

```
backend/
├── .env
├── docker-compose.yml
├── Dockerfile
├── main.py
└── requirements.txt
```

## Step 2: Create `.env` File

This file stores your secret API keys. It will be loaded by Docker Compose but will not be included in your Docker image, keeping it secure.

Create a file named `.env` and add your Gemini API keys and your Serper API key.

### **ACTION REQUIRED: Get Serper API Key**
1.  Go to [**serper.dev**](https://serper.dev).
2.  Sign up for a **free account** (2,500 queries are included).
3.  Copy your API key from their dashboard.

```env
# backend/.env

# The system will rotate through these Gemini keys if one gets rate-limited.
API_KEY_1="your_first_gemini_api_key_here"
API_KEY_2="your_second_gemini_api_key_here"
# You can add more, e.g., API_KEY_3="..."

# Key for the external search service used by Agent 4.
SERPER_API_KEY="your_api_key_from_serper.dev"
```
**Note:** It is good practice to wrap the keys in quotes.

## Step 3: Create `requirements.txt`

This file lists the Python dependencies for the project. Note the addition of `requests`.

```txt
# backend/requirements.txt

fastapi
uvicorn[standard]
gunicorn
pydantic
google-generativeai
python-dotenv
requests
```

## Step 4: Create `main.py` (FastAPI App)

This is the core of your backend. This completely new version for Agent 4 (`/fetch-from-internet`) is more robust and solves all previous search-related errors.

```python
# backend/main.py

import os
import json
import google.generativeai as genai
import threading
import functools
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from google.api_core import exceptions as google_exceptions

# --- Environment and API Key Setup ---
load_dotenv()

# Load all Gemini API keys from environment variables (API_KEY_1, API_KEY_2, etc.)
GEMINI_API_KEYS = [key for key in [os.getenv(f"API_KEY_{i+1}") for i in range(5)] if key]
if not GEMINI_API_KEYS:
    raise ValueError("No Gemini API_KEY environment variables found! Please set at least API_KEY_1 in your .env file.")

# Load the Serper API key for Agent 4
SERPER_API_KEY = os.getenv("SERPER_API_KEY")
if not SERPER_API_KEY:
    raise ValueError("SERPER_API_KEY environment variable not found! This is required for Agent 4.")

print(f"Found {len(GEMINI_API_KEYS)} Gemini API key(s).")

current_key_index = 0
key_lock = threading.Lock()

# --- Pydantic Models for Request Bodies ---
class OutlineRequest(BaseModel):
    topic: str
    numSections: int
    language: str

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
    description="A secure backend to proxy requests to the Gemini API with key rotation and a robust RAG-based search agent.",
    version="2.0.0"
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
    """
    A decorator that manages Gemini API key rotation for Gemini-based agents.
    If a rate limit error occurs, it switches to the next key and retries.
    """
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
                print(f"Gemini API key ending in '...{key_to_use[-4:]}' is rate limited. Switching to the next key.")
                with key_lock:
                    current_key_index = (current_key_index + 1) % len(GEMINI_API_KEYS)
                if i == len(GEMINI_API_KEYS) - 1:
                    raise HTTPException(status_code=429, detail="All Gemini API keys are currently rate limited.")
            except Exception as e:
                print(f"An unexpected error occurred with a Gemini agent: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        # This part should ideally not be reached
        raise HTTPException(status_code=500, detail="Failed to execute the agent after trying all keys.")
    return wrapper

# --- Gemini Model Initialization ---
MODEL_NAME = "gemini-2.5-flash"
generative_model = genai.GenerativeModel(MODEL_NAME)

# --- API Endpoints ---

@app.get("/", tags=["Health Check"])
async def health_check():
    """Provides a simple health check to confirm the service is running."""
    return {"status": "ok", "message": "Backend is running!"}

@app.post("/generate-outline", response_model=List[str])
@with_api_key_rotation
async def generate_outline(req: OutlineRequest):
    """Agent 1: Generates a tutorial outline."""
    try:
        language_instruction = (f'The language of the headings must match the input topic "{req.topic}".' if req.language == 'auto' else f'The language must be {req.language}.')
        prompt = f"""You are an expert curriculum designer. Generate a concise tutorial outline for: "{req.topic}". {language_instruction} Respond ONLY with a JSON array of {req.numSections} strings. If a heading requires recent info, append "(requires_search)". Example for "AI in 2024": ["Overview", "LLM Breakthroughs (requires_search)"]. The response must be a valid JSON array of strings."""

        response = generative_model.generate_content(prompt, generation_config={"response_mime_type": "application/json", "temperature": 0.4})
        json_str = response.text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(json_str)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Agent 1: Model returned invalid JSON for the outline.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent 1: An unexpected error occurred: {str(e)}")

@app.post("/generate-content", response_model=str)
@with_api_key_rotation
async def generate_content(req: ContentRequest):
    """Agent 2: Generates content for a specific outline heading."""
    try:
        language_instruction = (f'Write in the same language as the topic "{req.topic}".' if req.language == 'auto' else f'Write entirely in {req.language}.')
        prompt = f"""You are a technical writer for a tutorial on "{req.topic}" for a "{req.audience}" audience. {language_instruction} The full outline is: {req.allHeadings}. You are writing for: "{req.currentHeading}". Previous context: {req.previousSectionContext}. {f'Use this search info: <search>{req.internetSearchContext}</search>' if req.internetSearchContext else ''}. Write 2-5 paragraphs. Use Markdown but NOT H1/H2 headings. Dive straight into the content."""
        response = generative_model.generate_content(prompt, generation_config={"temperature": 0.65})
        return response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent 2: Failed to generate content: {str(e)}")

@app.post("/fetch-from-internet", response_model=Dict[str, Any])
@with_api_key_rotation # This decorator is for the summarization step
async def fetch_from_internet(req: FetchRequest):
    """Agent 4: Fetches and synthesizes information using a RAG pattern."""
    print(f"Agent 4: Received query '{req.query}'")
    
    # 1. FETCH: Call the external search API
    try:
        search_url = "https://google.serper.dev/search"
        payload = json.dumps({"q": req.query})
        headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
        
        search_response = requests.request("POST", search_url, headers=headers, data=payload, timeout=10)
        search_response.raise_for_status() # Raises an exception for bad status codes
        search_results = search_response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Agent 4: Search service is unavailable or failed: {e}")

    # 2. PROCESS: Extract context and sources from search results
    sources: List[Dict[str, str]] = []
    search_context = ""
    
    if search_results.get("organic"):
        for result in search_results["organic"][:5]: # Use top 5 results
            title = result.get('title', 'N/A')
            snippet = result.get('snippet', 'No snippet available.')
            link = result.get('link')
            
            search_context += f"Title: {title}\nSnippet: {snippet}\n\n"
            if link:
                sources.append({"uri": link, "title": title})
    
    if not search_context:
        # If no results, return empty-handed but successfully
        return {"summaryText": "No relevant information found on the internet for this topic.", "sources": []}

    # 3. AUGMENT & GENERATE: Summarize the findings with Gemini
    try:
        language_instruction = (f'Respond in the same language as the query.' if req.language == 'auto' else f'Respond in {req.language}.')
        prompt = f"""Based *only* on the provided search results below, write a concise summary that answers the query: "{req.query}".
{language_instruction}
Do not add any information that is not present in the search results.

<search_results>
{search_context}
</search_results>
"""
        summary_response = generative_model.generate_content(prompt)
        return {"summaryText": summary_response.text, "sources": sources}
    except Exception as e:
        # This will be caught by the decorator, which will handle rotation
        print(f"Agent 4: Summarization with Gemini failed: {e}")
        # Re-raise to trigger the decorator's error handling
        raise e


@app.post("/simplify-text", response_model=str)
@with_api_key_rotation
async def simplify_text(req: SimplifyRequest):
    """Agent 5: Simplifies a piece of text."""
    try:
        language_instruction = (f'Rewrite in the same language as the original text.' if req.language == 'auto' else f'Rewrite in {req.language}.')
        prompt = f"""Rewrite the following text for a "{req.audience}" audience. {language_instruction} For kids, use simple analogies. For beginners, explain jargon. For experts, be concise. Provide only the rewritten text. Original: \"\"\"{req.textToSimplify}\"\"\""""
        response = generative_model.generate_content(prompt, generation_config={"temperature": 0.5})
        return response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent 5: Failed to simplify text: {str(e)}")

```

## Step 5: Create `Dockerfile`

This file contains the instructions for Docker to build a container image for your application. (No changes needed here).

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

# Copy the rest of the application's code into the container
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application using Gunicorn with Uvicorn workers
# This is a production-ready setup
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-w", "4", "-b", "0.0.0.0:8000", "main:app"]
```

## Step 6: Create `docker-compose.yml`

Docker Compose is a tool for defining and running multi-container Docker applications. This file makes it simple to start your backend with a single command. (No changes needed here).

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
    (Note: Some older versions of Docker Compose might use `docker-compose` with a hyphen).

Your secure and resilient backend API will now be running and accessible only at `http://127.0.0.1:8000`.

### Testing the Backend with `curl`

Once the backend is running, test its endpoints directly from your terminal.

**1. Test Health Check (`/`)**

This command works in most shells, including CMD, PowerShell, and Bash.
```bash
curl "http://127.0.0.1:8000/"
```
*Expected output: `{"status":"ok","message":"Backend is running!"}`*

**2. Test `/generate-outline`**

**For Bash, PowerShell, or similar shells:**
```bash
curl -X POST "http://127.0.0.1:8000/generate-outline" \
-H "Content-Type: application/json" \
-d '{
  "topic": "Introduction to Python",
  "numSections": 5,
  "language": "English"
}'
```

**For Windows Command Prompt (CMD):**
```bash
curl -X POST "http://127.0.0.1:8000/generate-outline" ^
-H "Content-Type: application/json" ^
-d "{\"topic\": \"Introduction to Python\", \"numSections\": 5, \"language\": \"English\"}"
```
*Expected output: A JSON array of strings.*

**3. Test `/fetch-from-internet`**

This tests the new Agent 4 implementation.

**For Bash, PowerShell, or similar shells:**
```bash
curl -X POST "http://127.0.0.1:8000/fetch-from-internet" \
-H "Content-Type: application/json" \
-d '{
  "query": "What are the new features in Python 3.12?",
  "language": "English"
}'
```

**For Windows Command Prompt (CMD):**
```bash
curl -X POST "http://127.0.0.1:8000/fetch-from-internet" ^
-H "Content-Type: application/json" ^
-d "{\"query\": \"What are the new features in Python 3.12?\", \"language\": \"English\"}"
```
*Expected output: A JSON object with a `summaryText` string and a `sources` array of links.*

**4. Test `/generate-content`**

**For Bash, PowerShell, or similar shells:**
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

**For Windows Command Prompt (CMD):**
```bash
curl -X POST "http://127.0.0.1:8000/generate-content" ^
-H "Content-Type: application/json" ^
-d "{\"topic\": \"Introduction to Python\", \"currentHeading\": \"Variables and Data Types\", \"allHeadings\": [\"Introduction\", \"Variables and Data Types\", \"Control Flow\"], \"previousSectionContext\": \"The previous section was an introduction to Python.\", \"audience\": \"Beginner (13+)\", \"language\": \"English\"}"
```
*Expected output: A plain text string with the generated content.*

**5. Test `/simplify-text`**

**For Bash, PowerShell, or similar shells:**
```bash
curl -X POST "http://127.0.0.1:8000/simplify-text" \
-H "Content-Type: application/json" \
-d '{
  "textToSimplify": "Quantum superposition is a fundamental principle of quantum mechanics. It states that, much like waves in classical physics, any two or more quantum states can be added together and the result will be another valid quantum state.",
  "audience": "Curious Kid (8-12)",
  "language": "English"
}'
```

**For Windows Command Prompt (CMD):**
```bash
curl -X POST "http://127.0.0.1:8000/simplify-text" ^
-H "Content-Type: application/json" ^
-d "{\"textToSimplify\": \"Quantum superposition is a fundamental principle of quantum mechanics. It states that, much like waves in classical physics, any two or more quantum states can be added together and the result will be another valid quantum state.\", \"audience\": \"Curious Kid (8-12)\", \"language\": \"English\"}"
```
*Expected output: A simplified version of the input text as a plain string.*

If these commands work, your backend is ready!

## Step 8: Frontend Integration

Your frontend code has been prepared to easily switch to this backend.

1.  **Open the file `services/geminiService.ts`** in your frontend project.

2.  **For each function** (`agent1GenerateOutline`, `agent2GenerateContent`, etc.), you will find two blocks of code:
    *   The current implementation, labeled `--- CURRENT IMPLEMENTATION (Direct Gemini API Call) ---`.
    *   A commented-out block, labeled `--- BACKEND INTEGRATION ---`.

3.  **To switch a function to use the backend:**
    *   **Comment out** the entire `try/catch` block under `--- CURRENT IMPLEMENTATION ---`.
    *   **Uncomment** the entire `try/catch` block under `--- BACKEND INTEGRATION ---`.

    Repeat this for all functions in the file.

4.  **(Optional but Recommended) Clean up frontend dependencies:**
    *   Once all functions in `services/geminiService.ts` are using the backend, the Gemini SDK is no longer needed on the frontend.
    *   You can now **delete the entire `--- FRONTEND-ONLY SETUP ---` section** at the top of the file, including the `@google/genai` import and the `apiKey` variable. This will reduce your frontend's bundle size and completely secure your application.