/**
 * Express App Entry Point — Mission: Zero Noise (Bedrock 전용)
 *
 * 동작은 server/index.js 와 100% 동일하지만, AI 호출만 Bedrock(Claude 3 Haiku)
 * 단독 모드로 강제. Groq 폴백은 없고, Bedrock 실패 시 Gemini 1단 fallback만 사용.
 *
 * - USE_BEDROCK=1 환경변수를 require 직전에 set → routes/messages.js가
 *   aiServiceBedrock.js 를 로드함.
 * - EC2 IAM Role(Bedrock 권한)이 attach 되어 있어야 동작.
 *
 * 실행: sudo node server/index_bedrock.js
 */

process.env.USE_BEDROCK = '1';

const { startServer } = require('./index');

if (require.main === module) {
  console.log('[Server] AI mode: BEDROCK ONLY (Claude 3 Haiku)');
  startServer();
}
