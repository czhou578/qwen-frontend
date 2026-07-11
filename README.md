# Qwen Frontend - ChatGPT UI Clone

A ChatGPT-like web interface with streaming responses from your vLLM backend.

## Features

- Dark theme with ChatGPT-style UI
- Streaming AI responses
- Server-side API key handling for secure requests
- Responsive design

## Setup

### 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd qwen-frontend
npm install
```

### 2. Configure environment variables

Copy the example environment file and fill in your vLLM details:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual vLLM server URL and API key.

### 3. Run the development server

Start both the Vite dev server and the proxy server:

```bash
npm run dev
```

This will:
- Run the frontend on `http://localhost:5173`
- Run the proxy server on `http://localhost:3001`
- Proxy `/api/*` requests to the backend server

### 4. Build and deploy

```bash
npm run build    # Build for production
npm run preview  # Preview the built app locally
```

## Architecture

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  Frontend   │──────▶│   Proxy     │──────▶│   vLLM      │
│   (React)   │       │  (Express)  │       │  (Backend)  │
└─────────────┘       └─────────────┘       └─────────────┘
                        (holds API key)
```

The proxy server handles all API key authentication, keeping it secure from frontend exposure.

## Deployment

### GitHub Pages

```bash
npm run deploy
```

This builds the app and pushes to the `gh-pages` branch.

### Production Hosting

For production, run the proxy server and frontend together:

```bash
NODE_ENV=production npm run build
cd server
node index.js
```

The proxy will serve static files from the `dist` directory and handle API requests.