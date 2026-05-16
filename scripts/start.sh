#!/bin/bash
# Mission: Zero Noise — EC2 시작 스크립트
#
# 사용법: bash /home/ec2-user/game/scripts/start.sh
# 동작:
#   1) 기존 서버 프로세스 종료 (있으면)
#   2) Bedrock 모드(USE_BEDROCK=1)로 nohup 백그라운드 기동
#   3) 로그는 server.log 로 영구 저장 (장애 시 원인 파악용)
#   4) 시작 후 로그 마지막 10줄 + 프로세스 표시
#
# 환경 변수(.env 로드는 dotenv가 처리):
#   - ADMIN_KEY: /api/admin/* 인증 키 (필수, 미설정 시 admin 503)
#   - BEDROCK_REGION, BEDROCK_MODEL_ID: Bedrock 호출 설정
#   - GEMINI_API_KEY: Bedrock 장애 시 fallback 호출용
#   - GROQ_API_KEY, GROK_API_KEY: (일반 모드 시 사용)
#
# Gemini API key 교체 절차:
#   1) vim /home/ec2-user/game/.env 로 GEMINI_API_KEY 수정 후 저장
#   2) bash /home/ec2-user/game/scripts/start.sh  (이 스크립트 재실행)
#   다운타임 약 1~2초.

set -e

GAME_DIR="/home/ec2-user/game"
LOG_FILE="$GAME_DIR/server.log"
ENTRY="server/index_bedrock.js"   # Bedrock 모드 기본. 일반 모드면 server/index.js로 변경.

cd "$GAME_DIR"

echo "--- 기존 서버 중지 ---"
sudo pkill -f 'node server/index' 2>/dev/null || echo "  (떠있는 서버 없음)"
sleep 1

echo "--- Bedrock 모드로 시작 (로그: $LOG_FILE) ---"
sudo nohup "$(which node)" "$ENTRY" > "$LOG_FILE" 2>&1 < /dev/null &
sleep 2

echo "--- 최근 로그 ---"
tail -n 10 "$LOG_FILE"

echo ""
echo "--- 실행 중 프로세스 ---"
pgrep -af 'node server/index' || echo "  (프로세스 못 찾음 — 시작 실패 가능. 위 로그 확인)"

echo ""
echo "--- /api/health 응답 ---"
sleep 1
curl -s -m 3 http://localhost/api/health | head -c 200 && echo
echo ""
echo "✓ 완료. 외부 접속: http://$(curl -s -m 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo '54.226.10.78')/"
