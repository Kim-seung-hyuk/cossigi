# Claude Code 작업 인수인계 문서

## 프로젝트 개요

**Mission: Zero Noise – 시스템 리부트 챌린지**
- 대학교 축제 부스에서 노트북 3대로 운영하는 대화형 웹 게임
- AI NPC "코쓱이"와 대화하며 3단계 퀴즈를 풀어 시스템을 복구하는 게임
- AWS EC2에 배포 완료, 현재 `http://32.197.64.211`에서 접속 가능

---

## 현재 완료된 작업

### 백엔드 (100% 완료)
- Express.js 서버 (`server/index.js`)
- SQLite DB (`better-sqlite3`) — players, sessions, messages 테이블
- REST API: 세션 생성, 메시지 전송, 리부트 코드 검증, 랭킹 조회
- AI 서비스: Amazon Bedrock (Claude) + Grok API 폴백
- 게임 로직: 키워드 검증, 점수 산정, 타이머, 노이즈 레벨 관리
- 코쓱이 시스템 프롬프트 (`server/prompts/cosseogi.js`)

### 프론트엔드 (기본 구조 완료, 수정 필요)
- Vanilla JS SPA (Hash Router)
- 페이지: 랜딩, 게임, 결과, 랭킹
- 글리치 CSS 효과 (3단계)
- 타이머, 노이즈 게이지 컴포넌트

### 배포 (완료)
- EC2: t3.small, Amazon Linux 2023 (nxtcloud-ami-v1.0.1)
- IP: 32.197.64.211, 포트 80
- 실행: `sudo nohup $(which node) server/index.js > /dev/null 2>&1 &`
- 배포 가이드: `DEPLOYMENT_GUIDE.md` 참조

---

## 지금 해야 할 작업 (미완료)

### 1. 코쓱이 프롬프트 재설계 (핵심)

**현재 문제**: 사용자가 정답 키워드를 입력하지 않으면 게임이 진행되지 않음. 코쓱이가 자동 매크로처럼 동일한 힌트만 반복.

**목표**: 사용자의 질문/대화 맥락을 파악해서 자연스럽게 힌트를 흘리는 대화형 AI로 변경.

**참고 프롬프트 스타일** (환자-의사 게임에서 가져온 구조):
- 코쓱이는 차세대통신 메인 서버의 AI 캐릭터
- 사용자가 무엇을 물어보느냐에 따라 단계적으로 힌트 수준을 조절
- 절대 정답을 직접 말하지 않지만, 사용자가 올바른 방향으로 질문하면 점점 더 구체적인 힌트를 제공
- 사용자가 엉뚱한 질문을 하면 자연스럽게 미션 방향으로 유도
- 1~3문장으로 짧게 답변, 글리치 표현 포함

**Phase별 코쓱이 동작**:
- Phase 1: 정답 "AWS" — 교육과정, 글로벌 기업 협력, 양자통신 융합전공 관련 힌트
- Phase 2: 정답 "5G" — 우리넷 단말, 전용 통신망, 숫자+영어 조합 관련 힌트
- Phase 3: 정답 "통신" — 국민대학교 차세대OO 사업단, 사업단 이름 관련 힌트
- 리부트: "AWS 5G 통신" 조합 안내

### 2. UI 분리 (대화 영역 + 정답 입력란)

**현재**: 메시지 입력란 하나에서 대화도 하고 정답도 입력
**목표**: 
- 상단: 코쓱이와 자유 대화하는 채팅 영역 (여기서 힌트를 얻음)
- 하단: 정답 키워드를 입력하는 별도 입력란 (여기서 "AWS", "5G", "통신" 제출)
- 대화에서 뭘 입력하든 코쓱이가 맥락에 맞게 응답하고, 정답은 별도 칸에서만 검증

### 3. 배경 이미지 적용

이미지 파일이 `public/assets/images/`에 저장되어야 함:
- `bg-phase1.jpg` — 빨간 경고등, "시스템 잠김" (노이즈 100%)
- `bg-phase2.jpg` — 빨간+초록 혼합, "시스템 잠김" + 복구 시작 (노이즈 70%)
- `bg-phase3.jpg` — 초록 위주, "시스템 가동" (노이즈 40%)
- `bg-success.jpg` — 완전 초록, "SYSTEM ONLINE" (노이즈 0%)

각 Phase 전환 시 배경 이미지가 바뀌어야 함.

### 4. 코쓱이 캐릭터 이미지 활용

- `public/assets/images/cosseogi.png` — 기본 코쓱이 이미지 (이미 존재)
- Phase별로 다른 코쓱이 이미지를 사용하거나, CSS 효과로 상태 변화 표현
- 채팅 영역에서 코쓱이 아바타로 표시

### 5. 결과 페이지에 혜택 정보 (이미 코드에 추가됨)

게임 완료 시 AWS 양자통신융합전공 이수자 혜택 6가지 표시:
1. 학위증에 AWS 양자통신융합전공 취득사항 기재
2. AWS 파트너사 인턴십 프로그램 연계
3. JOB Fair 진행(AWS 파트너사 및 고객사 참여)
4. 연 2회 AWS 직무 멘토링
5. 우수 학생 대상 AWS 공식 행사 초대
6. AWS 리쿠르팅 팀 방문

---

## 게임 규칙 요약

- 제한시간: 180초
- 키워드 매칭: 대소문자 무관, 단독 텍스트만 정답 (다른 문자 포함 시 오답)
- 리부트 코드: "AWS 5G 통신" (대문자만 허용, 정확 일치)
- 점수: `Score = 1000 - (Turn × 10) - (소요시간(초) × 0.5)`
- 시간초과: 완료된 Phase의 Turn만 합산 + 180초 고정
- 포기: Score = 0
- 닉네임: 한번 사용하면 재사용 불가 (1~20자)

---

## 기술 스택

- Backend: Node.js + Express.js + better-sqlite3
- Frontend: Vanilla JS SPA (Hash Router, 프레임워크 없음)
- AI: Amazon Bedrock (Claude 3 Haiku) primary, Grok API (xAI) fallback
- 배포: AWS EC2 (t3.small, Amazon Linux 2023)

---

## 파일 구조

```
server/
├── index.js              # Express 앱 진입점
├── config.js             # 환경 설정
├── routes/
│   ├── sessions.js       # 세션 API
│   ├── messages.js       # 메시지/리부트 API
│   └── rankings.js       # 랭킹 API
├── services/
│   ├── gameManager.js    # 게임 핵심 로직
│   ├── aiService.js      # AI 응답 (Bedrock + Grok)
│   └── timerService.js   # 타이머
├── models/
│   ├── player.js         # 플레이어 CRUD
│   ├── session.js        # 세션 CRUD
│   └── message.js        # 메시지 CRUD
├── database/
│   ├── connection.js     # SQLite 연결
│   └── schema.sql        # 테이블 스키마
└── prompts/
    └── cosseogi.js       # 코쓱이 프롬프트 (수정 필요)

public/
├── index.html
├── css/ (main.css, game.css, glitch.css)
├── js/
│   ├── app.js            # SPA 라우터
│   ├── pages/ (landing.js, game.js, result.js, ranking.js)
│   ├── components/ (timer.js, noiseGauge.js, chatArea.js, leaderboard.js)
│   └── services/api.js
└── assets/images/        # 코쓱이 + 배경 이미지
```

---

## EC2 배포/재배포 명령어

```powershell
# 로컬에서 EC2로 코드 업로드 (프로젝트 폴더에서)
scp -i C:\Users\kimse\Downloads\pj-kmuai-00.pem -r server public package.json .env.example ec2-user@32.197.64.211:/home/ec2-user/game/

# SSH 접속
ssh -i C:\Users\kimse\Downloads\pj-kmuai-00.pem ec2-user@32.197.64.211

# EC2에서 서버 재시작
cd /home/ec2-user/game
sudo kill $(pgrep -f "node server/index.js")
sudo nohup $(which node) server/index.js > /dev/null 2>&1 &
```

---

## 주의사항

- `sudo node`는 root의 Node.js(v18)를 사용해서 에러남 → 반드시 `sudo $(which node)` 사용
- data/ 폴더 권한: `sudo chown ec2-user:ec2-user /home/ec2-user/game/data`
- 보안그룹: 새로 만들기 권한 없음, 기존 것만 사용 가능
- better-sqlite3는 네이티브 모듈이라 EC2(Linux)에서 npm install 해야 함
