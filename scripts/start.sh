#!/bin/bash
# Mission: Zero Noise — EC2 (재)시작 스크립트
#
# 사용법: bash /home/ec2-user/game/scripts/start.sh
# 동작  : systemd unit `cosseogi.service` 재시작 + 상태 확인.
#
# 처음 설치 / 변경: scripts/install-systemd.sh 참고.
# 라이프사이클은 systemd가 관리 — process crash·OOM·재부팅 시 자동 복구.
# 환경변수(.env)는 dotenv가 로드. TZ=Asia/Seoul 은 unit 파일에서 주입.
#
# Gemini API key 교체 절차:
#   1) vim /home/ec2-user/game/.env 로 GEMINI_API_KEY 수정 후 저장
#   2) bash /home/ec2-user/game/scripts/start.sh  (이 스크립트 재실행)
#   다운타임 ~1초.

set -e

echo "--- systemctl restart cosseogi ---"
sudo systemctl restart cosseogi

# 첫 로그 라인이 나올 때까지 잠깐 대기
sleep 2

echo ""
echo "--- systemctl status (head) ---"
sudo systemctl status cosseogi --no-pager -n 0 | head -8

echo ""
echo "--- 최근 로그 ---"
sudo journalctl -u cosseogi -n 5 --no-pager 2>/dev/null || tail -n 5 /home/ec2-user/game/server.log

echo ""
echo "--- /api/health 응답 ---"
curl -s -m 3 http://localhost/api/health | head -c 200 && echo

echo ""
echo "✓ 완료. 외부 접속: http://$(curl -s -m 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo '54.226.10.78')/"
