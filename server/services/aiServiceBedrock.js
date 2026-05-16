/**
 * AI Service (Bedrock 전용) — server/index_bedrock.js 진입점에서만 사용.
 *
 * 설계 원칙:
 *  - Anthropic Claude 3 Haiku (anthropic.claude-3-haiku-20240307-v1:0) 단독 사용
 *  - 폴백 없음. Bedrock 실패 시 즉시 에러 (운영 중 한도/장애 즉시 노출)
 *  - 자격 증명: EC2 IAM Role 자동 인식 (env 키 설정 불필요)
 *  - 키워드 검열 + 한자 차단 후처리는 default aiService.js와 동일
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const config = require('../config');
const { buildPromptMessages } = require('../prompts/cosseogi');
// Gemini fallback — Bedrock 일시 장애 시 사용. callGemini는 호출 시점에
// process.env.GEMINI_API_KEY 를 읽으므로 .env 갱신 후 서버 재시작(start.sh)만으로 키 교체 가능.
const { callGemini } = require('./aiService');

// Claude 3 Haiku (Bedrock) 공식 가격 — us-east-1, 2024-03 기준
// https://aws.amazon.com/bedrock/pricing/
const HAIKU_INPUT_PRICE_PER_1K_USD = 0.00025;
const HAIKU_OUTPUT_PRICE_PER_1K_USD = 0.00125;

function calculateBedrockCostUsd(inputTokens, outputTokens) {
  return (inputTokens  / 1000) * HAIKU_INPUT_PRICE_PER_1K_USD
       + (outputTokens / 1000) * HAIKU_OUTPUT_PRICE_PER_1K_USD;
}

let bedrockClient = null;

function getBedrockClient() {
  if (!bedrockClient) {
    // region만 지정. credentials는 IAM Role(IMDS)에서 자동 로드.
    bedrockClient = new BedrockRuntimeClient({ region: config.BEDROCK_REGION });
  }
  return bedrockClient;
}

/**
 * Anthropic Messages API 규칙에 맞게 messages 정제:
 *  1. 첫 메시지는 반드시 'user' (코쓱이 인사말이 첫 항목이면 잘라냄)
 *  2. 같은 role이 연속되지 않게 정리 (Anthropic은 user/assistant 교대만 허용)
 */
function sanitizeForAnthropic(messages) {
  // 1. 앞에서 assistant 메시지 제거 (user가 처음 나올 때까지)
  let i = 0;
  while (i < messages.length && messages[i].role !== 'user') i++;
  let cleaned = messages.slice(i);

  // 2. 연속된 같은 role은 합치기 (마지막 것 채택)
  const merged = [];
  for (const msg of cleaned) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1] = msg; // 같은 role 연속 → 마지막 것으로 덮음
    } else {
      merged.push(msg);
    }
  }
  return merged;
}

/**
 * Bedrock Claude 3 Haiku 호출.
 */
async function callBedrock(systemPrompt, messages) {
  const client = getBedrockClient();

  const sanitized = sanitizeForAnthropic(messages);
  if (sanitized.length === 0) {
    throw new Error('Anthropic용 messages 정제 후 내용 없음 (user 메시지 부재)');
  }

  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: config.AI_MAX_TOKENS,
    temperature: config.AI_TEMPERATURE,
    system: systemPrompt,
    messages: sanitized
  };

  const command = new InvokeModelCommand({
    modelId: config.BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody)
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.AI_TIMEOUT);

  try {
    const response = await client.send(command, { abortSignal: controller.signal });
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    if (responseBody.content && responseBody.content.length > 0) {
      const usage = responseBody.usage || {};
      return {
        text: responseBody.content[0].text,
        usage: {
          input_tokens:  usage.input_tokens  || 0,
          output_tokens: usage.output_tokens || 0
        }
      };
    }
    throw new Error('Bedrock response has no content');
  } finally {
    clearTimeout(timeoutId);
  }
}

function truncateResponse(text) {
  if (!text) return '';
  if (text.length <= config.MAX_RESPONSE_LENGTH) return text;
  return text.slice(0, config.MAX_RESPONSE_LENGTH);
}

/**
 * 정답 키워드가 응답에 노출되면 글리치로 가린다 (안전망).
 * default aiService.js와 동일한 정책.
 */
function censorKeywords(text, phase) {
  if (!text) return text;
  const censorMap = {
    1: [/AWS/gi, /Amazon Web Services/gi, /Amazon/gi, /아마존/g],
    2: [/양자/g, /quantum/gi],
    3: [/보안/g, /security/gi]
  };
  const patterns = censorMap[phase] || [];
  let out = text;
  for (const p of patterns) {
    out = out.replace(p, '지지직');
  }
  // 한자 (CJK) 자동 글리치 — Claude는 거의 안 섞이지만 보험으로 유지
  out = out.replace(/[一-鿿㐀-䶿]+/g, '...');
  return out;
}

/**
 * AI 응답 생성 — Bedrock 우선, 실패 시 Gemini 1단 fallback.
 *
 * Bedrock throttle / 일시 장애 / IAM Role drop 시 Gemini로 자동 전환되어
 * 부스 운영 중 사용자가 "응답 생성 실패" 메시지를 보는 빈도를 낮춤.
 * Gemini 호출은 토큰 카운트 없음(0 반환) — cost-stats는 Bedrock 호출분만 집계.
 *
 * @returns {Promise<{text: string, usage: {input_tokens: number, output_tokens: number}, provider: 'bedrock'|'gemini'}>}
 */
async function generateResponse(context) {
  const { systemPrompt, messages } = buildPromptMessages(context);

  // 1) Bedrock 우선
  try {
    const { text, usage } = await callBedrock(systemPrompt, messages);
    return {
      text: censorKeywords(truncateResponse(text), context.phase),
      usage,
      provider: 'bedrock'
    };
  } catch (err) {
    console.error('[AI Service Bedrock] Bedrock 호출 실패 — Gemini fallback 시도:', err.message);
  }

  // 2) Gemini 1단 fallback (key 미설정 시 즉시 에러)
  if (!process.env.GEMINI_API_KEY) {
    console.error('[AI Service Bedrock] GEMINI_API_KEY 미설정 — fallback 불가');
    throw new Error('AI 응답 생성에 실패했습니다. 다시 시도해주세요.');
  }
  try {
    const text = await callGemini(systemPrompt, messages);
    return {
      text: censorKeywords(truncateResponse(text), context.phase),
      usage: { input_tokens: 0, output_tokens: 0 }, // Gemini는 토큰 측정 안 함 (cost-stats 영향 없음)
      provider: 'gemini'
    };
  } catch (err) {
    console.error('[AI Service Bedrock] Gemini fallback도 실패:', err.message);
    throw new Error('AI 응답 생성에 실패했습니다. 다시 시도해주세요.');
  }
}

module.exports = {
  generateResponse,
  truncateResponse,
  censorKeywords,
  callBedrock,
  calculateBedrockCostUsd,
  HAIKU_INPUT_PRICE_PER_1K_USD,
  HAIKU_OUTPUT_PRICE_PER_1K_USD
};
