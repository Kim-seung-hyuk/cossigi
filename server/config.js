require('dotenv').config();

module.exports = {
  // Server
  PORT: parseInt(process.env.PORT, 10) || 80,

  // Database
  DB_PATH: process.env.DB_PATH || './data/game.db',

  // Game settings
  GAME_TIME_LIMIT: parseInt(process.env.GAME_TIME_LIMIT, 10) || 180,

  // AI common
  AI_MAX_TOKENS: parseInt(process.env.AI_MAX_TOKENS, 10) || 450,
  AI_TEMPERATURE: parseFloat(process.env.AI_TEMPERATURE) || 0.85,
  AI_TIMEOUT: parseInt(process.env.AI_TIMEOUT, 10) || 15000,
  MAX_RESPONSE_LENGTH: parseInt(process.env.MAX_RESPONSE_LENGTH, 10) || 280,

  // Groq (Primary) — fastest LPU inference, OpenAI-compatible
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_BASE_URL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  GROQ_MODEL_FALLBACK: process.env.GROQ_MODEL_FALLBACK || 'openai/gpt-oss-120b',
  GROQ_MODEL_BACKUP: process.env.GROQ_MODEL_BACKUP || 'llama-3.1-8b-instant',

  // Google Gemini (Secondary fallback)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  GEMINI_BASE_URL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',

  // Amazon Bedrock (Optional fallback)
  BEDROCK_REGION: process.env.BEDROCK_REGION || 'us-east-1',
  BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',

  // Grok / xAI (Optional fallback)
  GROK_BASE_URL: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
  GROK_API_KEY: process.env.GROK_API_KEY || '',
  GROK_MODEL: process.env.GROK_MODEL || 'grok-3-mini'
};
