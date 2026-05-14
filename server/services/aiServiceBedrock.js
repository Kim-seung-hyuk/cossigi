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
      return responseBody.content[0].text;
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
    2: [/5G/gi, /5세대/g, /오지(?![는를을이가에])/g, /파이브\s*지/gi, /fifth generation/gi],
    3: [/통신(?![사대학원망])/g]
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
 * AI 응답 생성 — Bedrock 단독 호출.
 * 실패 시 즉시 에러 throw (운영자가 즉시 인지하도록).
 */
async function generateResponse(context) {
  const { systemPrompt, messages } = buildPromptMessages(context);

  try {
    const response = await callBedrock(systemPrompt, messages);
    return censorKeywords(truncateResponse(response), context.phase);
  } catch (err) {
    console.error('[AI Service Bedrock] Bedrock 호출 실패:', err.message);
    throw new Error('AI 응답 생성에 실패했습니다. 다시 시도해주세요.');
  }
}

module.exports = {
  generateResponse,
  truncateResponse,
  censorKeywords,
  callBedrock
};
