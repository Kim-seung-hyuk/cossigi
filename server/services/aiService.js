/**
 * AI Service — Groq (Primary) + Gemini + Bedrock + Grok (Fallbacks)
 *
 * 폴백 체인 (수백명 부스 운영 대비 다중 모델 합산 capacity ~16,000+ RPD):
 *  1. Groq llama-3.3-70b-versatile  (1,000 RPD, 최고 한국어 품질)
 *  2. Groq openai/gpt-oss-120b      (1,000 RPD, 비슷한 품질)
 *  3. Google Gemini                 (~50 RPD 무료, 폴백)
 *  4. Groq llama-3.1-8b-instant     (14,400 RPD, 비상용 — 검열 약함)
 *
 * Bedrock / Grok(xAI)는 키 있을 때만 시도.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const config = require('../config');
const { buildPromptMessages } = require('../prompts/cosseogi');

let bedrockClient = null;

function getBedrockClient() {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({ region: config.BEDROCK_REGION });
  }
  return bedrockClient;
}

/**
 * Groq API (OpenAI-compatible) 호출.
 * @param {string} model
 */
async function callGroq(systemPrompt, messages, model) {
  if (!config.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const groqMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.AI_TIMEOUT);

  try {
    const response = await fetch(`${config.GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: groqMessages,
        max_tokens: config.AI_MAX_TOKENS,
        temperature: config.AI_TEMPERATURE
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${model}): ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error(`Groq response has no content: ${JSON.stringify(data).slice(0, 200)}`);
    }
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGemini(systemPrompt, messages) {
  if (!config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const requestBody = {
    contents,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      maxOutputTokens: config.AI_MAX_TOKENS,
      temperature: config.AI_TEMPERATURE
    }
  };

  const url = `${config.GEMINI_BASE_URL}/models/${config.GEMINI_MODEL}:generateContent`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.AI_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.GEMINI_API_KEY
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error(`Gemini response has no content: ${JSON.stringify(data).slice(0, 200)}`);
    }
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callBedrock(systemPrompt, messages) {
  const client = getBedrockClient();

  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: config.AI_MAX_TOKENS,
    temperature: config.AI_TEMPERATURE,
    system: systemPrompt,
    messages
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

async function callGrok(systemPrompt, messages) {
  if (!config.GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not configured');
  }

  const grokMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.AI_TIMEOUT);

  try {
    const response = await fetch(`${config.GROK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: config.GROK_MODEL,
        messages: grokMessages,
        max_tokens: config.AI_MAX_TOKENS,
        temperature: config.AI_TEMPERATURE
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grok API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    throw new Error('Grok response has no content');
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
 * 정답 키워드가 응답에 그대로 노출되면 글리치로 가린다 (안전망).
 * AI가 검열 룰을 어겨도 사용자한테 답이 노출되지 않도록 한다.
 *
 * @param {string} text
 * @param {number} phase
 * @returns {string}
 */
function censorKeywords(text, phase) {
  if (!text) return text;
  // 🏷️ v1 검열어 (AWS / 5G / 통신)
  // 정답 첫 글자 단독 누설("5...지직", "통...지직")도 차단 — 일반 단어는 lookahead로 제외
  const censorMap = {
    1: [/AWS/gi, /Amazon Web Services/gi, /Amazon/gi, /아마존/g],
    2: [
      /5G/gi, /5세대/g, /오지(?![는를을이가에])/g, /파이브\s*지/gi, /fifth generation/gi,
      /5(?![G\dg세])/g // 단독 '5' 차단. 단 '5G', '5세대', 다른 숫자(50,500)는 통과
    ],
    3: [
      /통신(?![사대학원망])/g, // 결합어 허용
      /통(?![신사대학원망화과계제일합])/g // 단독 '통' 차단. 통신/통화/통과/통계/통제/통일/통합 등 통과
    ]
  };
  const patterns = censorMap[phase] || [];
  let out = text;
  for (const p of patterns) {
    out = out.replace(p, '지지직');
  }
  // 한자(CJK Unified Ideographs)는 어떤 단어든 글리치로 치환
  // — Llama가 가끔 "什么", "合作" 같은 한자 출력하는 것 차단
  out = out.replace(/[一-鿿㐀-䶿]+/g, '...');
  return out;
}

/**
 * AI 응답 생성 — 다중 폴백 체인.
 *
 * @param {object} context - { phase, noiseLevel, playerMessage, conversationHistory }
 * @returns {Promise<string>}
 */
async function generateResponse(context) {
  const { systemPrompt, messages } = buildPromptMessages(context);

  // 1순위: Groq 70B (최고 품질)
  if (config.GROQ_API_KEY) {
    try {
      const response = await callGroq(systemPrompt, messages, config.GROQ_MODEL);
      return censorKeywords(truncateResponse(response), context.phase);
    } catch (err) {
      console.error('[AI Service] Groq 70B failed, trying gpt-oss-120b:', err.message);
    }

    // 2순위: Groq gpt-oss-120b (같은 키)
    try {
      const response = await callGroq(systemPrompt, messages, config.GROQ_MODEL_FALLBACK);
      return censorKeywords(truncateResponse(response), context.phase);
    } catch (err) {
      console.error('[AI Service] Groq gpt-oss-120b failed, trying Gemini:', err.message);
    }
  }

  // 3순위: Gemini
  if (config.GEMINI_API_KEY) {
    try {
      const response = await callGemini(systemPrompt, messages);
      return censorKeywords(truncateResponse(response), context.phase);
    } catch (err) {
      console.error('[AI Service] Gemini failed, trying Groq 8B:', err.message);
    }
  }

  // 4순위: Groq 8B (한도 넉넉, 비상용)
  if (config.GROQ_API_KEY) {
    try {
      const response = await callGroq(systemPrompt, messages, config.GROQ_MODEL_BACKUP);
      return censorKeywords(truncateResponse(response), context.phase);
    } catch (err) {
      console.error('[AI Service] Groq 8B failed, trying Bedrock:', err.message);
    }
  }

  // 5순위: Bedrock (있을 때만)
  try {
    const response = await callBedrock(systemPrompt, messages);
    return truncateResponse(response);
  } catch (err) {
    console.error('[AI Service] Bedrock failed, trying Grok:', err.message);
  }

  // 6순위: Grok / xAI
  if (config.GROK_API_KEY) {
    try {
      const response = await callGrok(systemPrompt, messages);
      return censorKeywords(truncateResponse(response), context.phase);
    } catch (err) {
      console.error('[AI Service] Grok also failed:', err.message);
    }
  }

  throw new Error('AI 응답 생성에 실패했습니다. 다시 시도해주세요.');
}

module.exports = {
  generateResponse,
  truncateResponse,
  censorKeywords,
  callGroq,
  callGemini,
  callBedrock,
  callGrok
};
