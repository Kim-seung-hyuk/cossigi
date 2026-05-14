/**
 * AI Service Tests
 * 
 * Tests for the AI service including prompt building, response truncation,
 * and fallback behavior.
 */

const { buildSystemPrompt, buildPromptMessages, PHASE_INSTRUCTIONS, GLITCH_INSTRUCTIONS } = require('../server/prompts/cosseogi');
const { truncateResponse } = require('../server/services/aiService');

describe('코쓱이 시스템 프롬프트', () => {
  describe('buildSystemPrompt', () => {
    it('should include character settings', () => {
      const prompt = buildSystemPrompt({ phase: 1, noiseLevel: 100 });
      expect(prompt).toContain('코쓱이(Kosseugi)');
      expect(prompt).toContain('차세대통신 메인 서버의 AI');
      expect(prompt).toContain('반말 사용');
    });

    it('should include current noise level', () => {
      const prompt = buildSystemPrompt({ phase: 1, noiseLevel: 70 });
      expect(prompt).toContain('노이즈 레벨: 70%');
    });

    it('should include current phase', () => {
      const prompt = buildSystemPrompt({ phase: 2, noiseLevel: 40 });
      expect(prompt).toContain('현재 미션 페이즈: 2');
    });

    it('should include phase 1 instructions for phase 1', () => {
      const prompt = buildSystemPrompt({ phase: 1, noiseLevel: 100 });
      expect(prompt).toContain('Phase 1: 양자 보안 엔진 가동');
      expect(prompt).toContain('글로벌 기업');
      expect(prompt).toContain('AWS (절대 직접 알려주지 말 것)');
    });

    it('should include phase 2 instructions for phase 2', () => {
      const prompt = buildSystemPrompt({ phase: 2, noiseLevel: 70 });
      expect(prompt).toContain('Phase 2: 특화망 신호 연결');
      expect(prompt).toContain('우리넷 단말');
      expect(prompt).toContain('5G (절대 직접 알려주지 말 것)');
    });

    it('should include phase 3 instructions for phase 3', () => {
      const prompt = buildSystemPrompt({ phase: 3, noiseLevel: 40 });
      expect(prompt).toContain('Phase 3: 시스템 최종 리부트');
      expect(prompt).toContain('차세대OO 사업단');
      expect(prompt).toContain('통신 (절대 직접 알려주지 말 것)');
    });

    it('should include phase 4 (reboot) instructions', () => {
      const prompt = buildSystemPrompt({ phase: 4, noiseLevel: 10 });
      expect(prompt).toContain('리부트 단계');
      expect(prompt).toContain('리부트 코드를 입력해줘');
    });

    it('should include high glitch instructions for noise level 100', () => {
      const prompt = buildSystemPrompt({ phase: 1, noiseLevel: 100 });
      expect(prompt).toContain('노이즈 레벨이 100%로 매우 높습니다');
      expect(prompt).toContain('지지직');
    });

    it('should include medium glitch instructions for noise level 70', () => {
      const prompt = buildSystemPrompt({ phase: 2, noiseLevel: 70 });
      expect(prompt).toContain('노이즈 레벨이 70%');
    });

    it('should include low glitch instructions for noise level 40', () => {
      const prompt = buildSystemPrompt({ phase: 3, noiseLevel: 40 });
      expect(prompt).toContain('노이즈 레벨이 40%');
    });

    it('should include minimal glitch instructions for noise level 10', () => {
      const prompt = buildSystemPrompt({ phase: 4, noiseLevel: 10 });
      expect(prompt).toContain('노이즈 레벨이 10%');
      expect(prompt).toContain('글리치 표현 거의 없음');
    });

    it('should include all 5 rules', () => {
      const prompt = buildSystemPrompt({ phase: 1, noiseLevel: 100 });
      expect(prompt).toContain('응답은 반드시 500자 이내로 작성');
      expect(prompt).toContain('현재 페이즈의 퀴즈와 관련된 방향으로 대화를 유도');
      expect(prompt).toContain('직접적인 정답을 알려주지 말 것');
      expect(prompt).toContain('노이즈 레벨이 높을수록 텍스트에 글리치 표현을 더 많이 포함');
      expect(prompt).toContain('플레이어가 무관한 질문을 하면 자연스럽게 미션으로 유도');
    });
  });

  describe('buildPromptMessages', () => {
    it('should return systemPrompt and messages array', () => {
      const result = buildPromptMessages({
        phase: 1,
        noiseLevel: 100,
        playerMessage: '안녕하세요',
        conversationHistory: []
      });

      expect(result).toHaveProperty('systemPrompt');
      expect(result).toHaveProperty('messages');
      expect(result.systemPrompt).toContain('코쓱이');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'user', content: '안녕하세요' });
    });

    it('should convert conversation history to messages format', () => {
      const result = buildPromptMessages({
        phase: 2,
        noiseLevel: 70,
        playerMessage: '힌트 줘',
        conversationHistory: [
          { role: 'player', content: '안녕' },
          { role: 'cosseogi', content: '지직... 안녕!' },
          { role: 'player', content: '뭐 해야 해?' },
          { role: 'cosseogi', content: '미션을 수행해야 해!' }
        ]
      });

      expect(result.messages).toHaveLength(5); // 4 history + 1 current
      expect(result.messages[0]).toEqual({ role: 'user', content: '안녕' });
      expect(result.messages[1]).toEqual({ role: 'assistant', content: '지직... 안녕!' });
      expect(result.messages[2]).toEqual({ role: 'user', content: '뭐 해야 해?' });
      expect(result.messages[3]).toEqual({ role: 'assistant', content: '미션을 수행해야 해!' });
      expect(result.messages[4]).toEqual({ role: 'user', content: '힌트 줘' });
    });

    it('should skip system messages in conversation history', () => {
      const result = buildPromptMessages({
        phase: 1,
        noiseLevel: 100,
        playerMessage: '테스트',
        conversationHistory: [
          { role: 'player', content: '안녕' },
          { role: 'system', content: '게임 시작' },
          { role: 'cosseogi', content: '반가워!' }
        ]
      });

      expect(result.messages).toHaveLength(3); // player + cosseogi + current
      expect(result.messages[0]).toEqual({ role: 'user', content: '안녕' });
      expect(result.messages[1]).toEqual({ role: 'assistant', content: '반가워!' });
      expect(result.messages[2]).toEqual({ role: 'user', content: '테스트' });
    });

    it('should handle empty conversation history', () => {
      const result = buildPromptMessages({
        phase: 1,
        noiseLevel: 100,
        playerMessage: '첫 메시지',
        conversationHistory: []
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'user', content: '첫 메시지' });
    });

    it('should handle undefined conversation history', () => {
      const result = buildPromptMessages({
        phase: 1,
        noiseLevel: 100,
        playerMessage: '첫 메시지'
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'user', content: '첫 메시지' });
    });
  });

  describe('PHASE_INSTRUCTIONS', () => {
    it('should have instructions for all 4 phases', () => {
      expect(PHASE_INSTRUCTIONS[1]).toBeDefined();
      expect(PHASE_INSTRUCTIONS[2]).toBeDefined();
      expect(PHASE_INSTRUCTIONS[3]).toBeDefined();
      expect(PHASE_INSTRUCTIONS[4]).toBeDefined();
    });
  });

  describe('GLITCH_INSTRUCTIONS', () => {
    it('should have instructions for all noise levels', () => {
      expect(GLITCH_INSTRUCTIONS[100]).toBeDefined();
      expect(GLITCH_INSTRUCTIONS[70]).toBeDefined();
      expect(GLITCH_INSTRUCTIONS[40]).toBeDefined();
      expect(GLITCH_INSTRUCTIONS[10]).toBeDefined();
    });
  });
});

describe('AI 응답 후처리', () => {
  describe('truncateResponse', () => {
    it('should return text as-is if within 500 chars', () => {
      const text = '짧은 응답입니다.';
      expect(truncateResponse(text)).toBe(text);
    });

    it('should return text as-is if exactly 500 chars', () => {
      const text = 'a'.repeat(500);
      expect(truncateResponse(text)).toBe(text);
      expect(truncateResponse(text).length).toBe(500);
    });

    it('should truncate text exceeding 500 chars', () => {
      const text = 'a'.repeat(600);
      const result = truncateResponse(text);
      expect(result.length).toBe(500);
      expect(result).toBe('a'.repeat(500));
    });

    it('should handle empty string', () => {
      expect(truncateResponse('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(truncateResponse(null)).toBe('');
      expect(truncateResponse(undefined)).toBe('');
    });

    it('should truncate Korean text correctly', () => {
      const text = '가'.repeat(600);
      const result = truncateResponse(text);
      expect(result.length).toBe(500);
    });
  });
});
