require('dotenv').config();

module.exports = {
  // Server
  PORT: parseInt(process.env.PORT, 10) || 80,

  // Database
  DB_PATH: process.env.DB_PATH || './data/game.db',

  // Game settings
  GAME_TIME_LIMIT: parseInt(process.env.GAME_TIME_LIMIT, 10) || 180,

  // AI common
  // 코쓱이 응답은 잡담 20~50자 / 일반 60~120자 강제 → 한국어 약 150토큰 한계.
  // 250으로 여유 두고 자름 (비용 최소화).
  AI_MAX_TOKENS: parseInt(process.env.AI_MAX_TOKENS, 10) || 250,
  AI_TEMPERATURE: parseFloat(process.env.AI_TEMPERATURE) || 0.85,
  AI_TIMEOUT: parseInt(process.env.AI_TIMEOUT, 10) || 15000,
  // 대화 메모리 윈도우 — 현재 user 메시지 제외, 직전 N개 메시지만 모델에 전달.
  // K=4 = 직전 2턴(user+assistant 각 2개). 비용·품질 균형.
  CONVERSATION_WINDOW: parseInt(process.env.CONVERSATION_WINDOW, 10) || 4,

  // /api/admin/* 엔드포인트 인증 키. 미설정 시 admin 라우터 자체 비활성(503).
  // 운영 시 .env 에 ADMIN_KEY=<랜덤 문자열 32자 이상> 설정 후 재시작.
  ADMIN_KEY: process.env.ADMIN_KEY || null,
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
