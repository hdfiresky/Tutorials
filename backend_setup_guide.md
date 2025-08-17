# Backend Setup Guide

This guide explains how to set up a secure backend service for the Multi-Agent Tutorial Generator. Moving the Gemini API calls to a backend is a critical security measure to avoid exposing your `API_KEY` in the browser.

The backend is built with **FastAPI** and designed to be run easily using **Docker and Docker Compose**.

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

This file stores your secret API key. It will be loaded by Docker Compose but will not be included in your Docker image, keeping it secure.

Create a file named `.env` and add your Gemini API key:

```env
# backend/.env

API_KEY=your_gemini_api_key_here
```

## Step 3: Create `requirements.txt`

This file lists the Python dependencies for the project.

```txt
# backend/requirements.txt

fastapi
uvicorn[standard]
gunicorn
pydantic
google-generativeai
python-dotenv
```

## Step 4: Create `main.py` (FastAPI App)

This is the core of your backend. It defines the API endpoints that your frontend will call. These endpoints then securely call the Gemini API on the server.

```python
# backend/main.py

import os
import json
import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Any

# Load environment variables from .env file
load_dotenv()

# --- Pydantic Models for Request Bodies ---
# These models validate the data sent from the frontend.

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
    description="A secure backend to proxy requests to the Gemini API.",
    version="1.0.0"
)

# Configure CORS (Cross-Origin Resource Sharing)
# This allows your frontend (running on a different domain/port) to communicate with this backend.
origins = [
    "http://localhost",
    "http://localhost:3000", # Example: for a typical React dev server
    "https://your-frontend-domain.com" # Add your production domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development, can be restrictive in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Gemini API Configuration ---

api_key = os.getenv("API_KEY")
if not api_key:
    raise ValueError("API_KEY environment variable not set!")

genai.configure(api_key=api_key)
model_name = "gemini-2.5-flash"


# --- API Endpoints ---

@app.post("/generate-outline", response_model=List[str])
async def generate_outline(req: OutlineRequest):
    """Agent 1: Generates a tutorial outline."""
    try:
        model = genai.GenerativeModel(model_name)
        language_instruction = (
            f'The language of the headings in the JSON array must match the language of the input topic "{req.topic}".'
            if req.language == 'auto'
            else f'The language of the headings in the JSON array must be {req.language}.'
        )
        prompt = f"""You are an expert curriculum designer.
Generate a concise tutorial outline for the topic: "{req.topic}".
{language_instruction}
Respond ONLY with a JSON array of strings, where each string is a main section heading.
The array should contain exactly {req.numSections} unique and logically sequenced headings.
For each heading, if you strongly believe it requires very recent information, append the marker "(requires_search)" to that heading string.
Example for topic "Latest Advancements in AI (2024)": ["Overview of AI in 2024", "Breakthroughs in LLMs (requires_search)", "New Applications in Healthcare (requires_search)", "Ethical Debates", "Future Trends (requires_search)"]
Do not include any introductory phrases, explanations, or markdown formatting outside the JSON array itself."""

        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json", "temperature": 0.4}
        )
        
        json_str = response.text.strip()
        if json_str.startswith("```json"):
            json_str = json_str[7:].strip()
        if json_str.endswith("```"):
            json_str = json_str[:-3].strip()
            
        return json.loads(json_str)
    except Exception as e:
        print(f"Error in /generate-outline: {e}")
        raise HTTPException(status_code=500, detail=f"Agent 1 (Outliner): Failed to generate outline. {str(e)}")


@app.post("/generate-content", response_model=str)
async def generate_content(req: ContentRequest):
    """Agent 2: Generates content for a specific outline heading."""
    try:
        model = genai.GenerativeModel(model_name)
        language_instruction = (
            f'The response must be written entirely in the same language as the topic "{req.topic}".'
            if req.language == 'auto'
            else f'The response must be written entirely in {req.language}.'
        )
        prompt = f"""You are an expert technical writer for a tutorial on "{req.topic}".
{language_instruction}
The overall outline is: {req.allHeadings}.
Your target audience is: "{req.audience}". Adapt your style accordingly.
You are writing the content for the section: "{req.currentHeading}".
Context from previous section: {req.previousSectionContext}
{f'Relevant info from an internet search: <search_results>{req.internetSearchContext}</search_results>' if req.internetSearchContext else ''}
Instructions:
1. Provide detailed text for this section. Aim for 2-5 paragraphs.
2. Use Markdown for formatting (e.g., `*`, `**`, ` `` `). Do NOT use H1 (#) or H2 (##) headings.
3. Focus ONLY on the content for "{req.currentHeading}".
4. Dive straight into the subject matter.
5. Ensure the content flows logically.
"""
        response = model.generate_content(prompt, generation_config={"temperature": 0.65})
        return response.text
    except Exception as e:
        print(f"Error in /generate-content: {e}")
        raise HTTPException(status_code=500, detail=f"Agent 2 (Content Writer): Failed to generate content. {str(e)}")


@app.post("/fetch-from-internet")
async def fetch_from_internet(req: FetchRequest):
    """Agent 4: Fetches information from the internet using Google Search grounding."""
    try:
        model = genai.GenerativeModel(model_name, tools=[{'google_search': {}}])
        language_instruction = (
            f'Respond in the same language as the query.'
            if req.language == 'auto'
            else f'Respond in {req.language}.'
        )
        prompt = f"""Provide a concise summary and key information about: "{req.query}".
{language_instruction}
Focus on recent developments, data, or facts if the query implies it.
Extract key information relevant to this query."""
        
        response = model.generate_content(prompt)
        
        sources: List[dict[str, Any]] = []
        if response.candidates and response.candidates[0].grounding_metadata:
            grounding_metadata = response.candidates[0].grounding_metadata
            if grounding_metadata.grounding_chunks:
                for chunk in grounding_metadata.grounding_chunks:
                    if chunk.web and chunk.web.uri:
                        sources.append({
                            "uri": chunk.web.uri,
                            "title": chunk.web.title or chunk.web.uri,
                        })

        return {"summaryText": response.text, "sources": sources}
    except Exception as e:
        print(f"Error in /fetch-from-internet: {e}")
        raise HTTPException(status_code=500, detail=f"Agent 4 (Researcher): Failed to fetch internet data. {str(e)}")


@app.post("/simplify-text", response_model=str)
async def simplify_text(req: SimplifyRequest):
    """Agent 5: Simplifies a piece of text for a specific audience."""
    try:
        model = genai.GenerativeModel(model_name)
        language_instruction = (
            f'The rewritten text must be in the same language as the original text.'
            if req.language == 'auto'
            else f'The rewritten text must be in {req.language}.'
        )
        prompt = f"""You are an expert at simplifying complex topics.
Rewrite the following text to be easily understandable for the target audience: "{req.audience}".
{language_instruction}
- For "Curious Kid (8-12)", use simple words, short sentences, and a fun tone.
- For "Beginner (13+)", explain jargon and focus on clarity.
- For "Expert", rephrase for conciseness, removing fluff.
Just provide the rewritten text directly.
Original Text:
\"\"\"
{req.textToSimplify}
\"\"\""""
        response = model.generate_content(prompt, generation_config={"temperature": 0.5})
        return response.text
    except Exception as e:
        print(f"Error in /simplify-text: {e}")
        raise HTTPException(status_code=500, detail=f"Agent 5 (Simplifier): Failed to simplify text. {str(e)}")

```

## Step 5: Create `Dockerfile`

This file contains the instructions for Docker to build a container image for your application.

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

Docker Compose is a tool for defining and running multi-container Docker applications. This file makes it simple to start your backend with a single command.

```yaml
# backend/docker-compose.yml

version: '3.8'

services:
  backend-api:
    build: .
    container_name: tutorial_generator_backend
    ports:
      - "8000:8000"
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
    docker-compose up --build
    ```

Your secure backend API will now be running and accessible at `http://localhost:8000`.

## Step 8: Frontend Integration

Your frontend code has already been prepared for this backend.

1.  Open the file `src/services/geminiService.ts`.
2.  Inside each function (e.g., `agent1GenerateOutline`), you will find two blocks of code:
    *   The current implementation that calls the Gemini API directly.
    *   A commented-out block labeled `--- BACKEND INTEGRATION ---`.
3.  To switch, simply **comment out the current implementation** and **uncomment the backend integration block** for each function you want to route through your backend.
4.  Once you have switched all functions, you can remove the `@google/genai` dependency from your frontend project entirely.
