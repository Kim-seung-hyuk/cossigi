/**
 * Admin API — 관리자 전용 (ADMIN_KEY 인증 필수).
 *
 * GET /api/admin/cost-stats?limit=10
 *   최근 N개(기본 10) 게임의 Bedrock 토큰 사용량과 USD/KRW 비용 평균.
 * GET /api/admin/players?limit=50&offset=0&q=
 *   플레이어 목록 + 시도 횟수/베스트 점수 집계 (관리자 DB 페이지용).
 *
 * 인증: 헤더 `x-admin-key: <KEY>` 또는 쿼리 `?key=<KEY>`. ADMIN_KEY 미설정 시 503.
 */

const express = require('express');
const router = express.Router();
const config = require('../config');
const sessionModel = require('../models/session');
const playerModel = require('../models/player');
const {
  calculateBedrockCostUsd,
  HAIKU_INPUT_PRICE_PER_1K_USD,
  HAIKU_OUTPUT_PRICE_PER_1K_USD
} = require('../services/aiServiceBedrock');

// 인증 미들웨어 — ADMIN_KEY 미설정이면 admin 자체 비활성.
// 인증 방법: 헤더 `x-admin-key: <KEY>` 또는 쿼리 `?key=<KEY>`.
router.use((req, res, next) => {
  if (!config.ADMIN_KEY) {
    return res.status(503).json({ error: 'admin endpoints disabled (ADMIN_KEY not configured)' });
  }
  const key = req.header('x-admin-key') || req.query.key;
  if (key !== config.ADMIN_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

// 한화 환산용 환율 (env 미지정 시 1380 KRW/USD 가정).
// 정확한 청구 금액은 AWS 콘솔 기준, 여기는 어림셈용.
const USD_KRW_RATE = parseFloat(process.env.USD_KRW_RATE) || 1380;

function round(n, decimals) {
  const m = Math.pow(10, decimals);
  return Math.round(n * m) / m;
}

router.get('/cost-stats', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const rows = sessionModel.getRecentBedrockSessions(limit);

    const games = rows.map(r => {
      const costUsd = calculateBedrockCostUsd(
        r.bedrock_input_tokens,
        r.bedrock_output_tokens
      );
      return {
        sessionId: r.id,
        playerName: r.player_name,
        status: r.status,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        turnCount: r.turn_count,
        bedrockCallCount: r.bedrock_call_count,
        inputTokens: r.bedrock_input_tokens,
        outputTokens: r.bedrock_output_tokens,
        costUsd: round(costUsd, 6),
        costKrw: round(costUsd * USD_KRW_RATE, 2)
      };
    });

    const gameCount = games.length;
    const sum = games.reduce((acc, g) => {
      acc.input  += g.inputTokens;
      acc.output += g.outputTokens;
      acc.calls  += g.bedrockCallCount;
      acc.usd    += g.costUsd;
      return acc;
    }, { input: 0, output: 0, calls: 0, usd: 0 });

    const summary = gameCount === 0 ? null : {
      gameCount,
      totalBedrockCalls: sum.calls,
      totalInputTokens:  sum.input,
      totalOutputTokens: sum.output,
      totalCostUsd:      round(sum.usd, 6),
      totalCostKrw:      round(sum.usd * USD_KRW_RATE, 2),
      avgCallsPerGame:        round(sum.calls  / gameCount, 2),
      avgInputTokensPerGame:  round(sum.input  / gameCount, 1),
      avgOutputTokensPerGame: round(sum.output / gameCount, 1),
      avgCostPerGameUsd:      round(sum.usd    / gameCount, 6),
      avgCostPerGameKrw:      round((sum.usd / gameCount) * USD_KRW_RATE, 2)
    };

    res.json({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      pricing: {
        input_per_1k_usd:  HAIKU_INPUT_PRICE_PER_1K_USD,
        output_per_1k_usd: HAIKU_OUTPUT_PRICE_PER_1K_USD,
        usd_krw_rate_used: USD_KRW_RATE
      },
      windowSize: limit,
      games,
      summary
    });
  } catch (err) {
    console.error('[Admin] cost-stats error:', err.message);
    res.status(500).json({ error: 'cost-stats 조회 중 오류가 발생했습니다' });
  }
});

router.get('/players', (req, res) => {
  try {
    const limit  = Math.min(Math.max(parseInt(req.query.limit, 10)  || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const q      = (req.query.q || '').toString().slice(0, 50);

    const { total, players } = playerModel.listPlayersWithStats({ limit, offset, q });
    res.json({ total, limit, offset, q, players });
  } catch (err) {
    console.error('[Admin] players error:', err.message);
    res.status(500).json({ error: 'players 조회 중 오류가 발생했습니다' });
  }
});

module.exports = router;
