# PIMFeeder Backend

This is the backend service for the PIMFeeder application. It provides PDF processing and attribute extraction services using OpenAI's GPT-4.

## Environment Variables

Create a `.env` file with the following variables:

```
PORT=5000
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=production
```

## Installation

```bash
npm install
```

## Running Locally

```bash
npm run dev
```

## Production Deployment

The service is configured to be deployed on Render.com. Required environment variables must be set in the deployment platform. 