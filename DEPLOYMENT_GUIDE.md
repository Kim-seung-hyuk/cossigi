# Mission: Zero Noise — EC2 배포 가이드

## 개요

이 문서는 "Mission: Zero Noise" 게임을 AWS EC2에 배포하는 전체 과정을 정리한 것입니다.
실제 배포 시 겪었던 문제점과 해결 방법을 포함합니다.

---

## 환경 정보

| 항목 | 값 |
|------|-----|
| AWS 계정 | nxtcloud (IAM: pj-kmuai-00) |
| 리전 | us-east-1 (버지니아 북부) |
| 인스턴스 타입 | t3.small |
| AMI | nxtcloud-ami-v1.0.1 (Amazon Linux 2023 기반) |
| 퍼블릭 IP | 32.197.64.211 |
| 키 페어 | pj-kmuai-00.pem |
| Node.js 버전 | v22.21.1 (AMI에 사전 설치됨) |

---

## 배포 순서 (정상 흐름)

### 1. EC2 인스턴스 생성

- AWS 콘솔 → EC2 → 인스턴스 시작
- AMI: Nxtcloud AMI 선택
- 인스턴스 타입: t3.small
- 키 페어: 새로 생성 또는 기존 것 선택
- 보안그룹: SSH(22) + HTTP(80) 인바운드 허용된 기존 보안그룹 선택
  - ⚠️ "Create security group"은 권한 문제로 실패함 → 반드시 "Select existing security group" 사용

### 2. SSH 접속

```bash
ssh -i C:\Users\kimse\Downloads\pj-kmuai-00.pem ec2-user@32.197.64.211
```

### 3. 코드 업로드 (로컬 PowerShell에서)

```powershell
cd "C:\Users\kimse\OneDrive\Desktop\대학교\07_AWS AI 기초\09_코쓱이의 비밀"
scp -i C:\Users\kimse\Downloads\pj-kmuai-00.pem -r server public package.json .env.example ec2-user@32.197.64.211:/home/ec2-user/game/
```

### 4. 서버 환경 설정 (SSH에서)

```bash
cd /home/ec2-user/game

# data 폴더 생성 및 권한 설정
mkdir -p data
sudo chown ec2-user:ec2-user data

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에서 PORT=80, DB_PATH=/home/ec2-user/game/data/game.db 확인
```

### 5. 서버 실행

```bash
cd /home/ec2-user/game
sudo nohup $(which node) server/index.js > /dev/null 2>&1 &
```

### 6. 접속 확인

브라우저에서 `http://32.197.64.211` 접속

---

## 겪었던 문제와 해결

### 문제 1: 보안그룹 생성 권한 없음

**증상**: "You are not authorized to perform: ec2:AuthorizeSecurityGroupIngress"

**원인**: IAM 정책 `ControlOnlyOwnResources`가 보안그룹 규칙 추가를 차단

**해결**: 담당자에게 SSH(22) + HTTP(80)이 열린 보안그룹을 만들어달라고 요청. 인스턴스 생성 시 "Select existing security group"으로 선택.

---

### 문제 2: .pem 파일 못 찾음

**증상**: "Identity file zero-noise-key.pem not accessible: No such file or directory"

**원인**: 파일명이 `zero-noise-key.pem`이 아니라 `pj-kmuai-00.pem`이었음

**해결**: 정확한 파일명과 전체 경로 사용
```bash
ssh -i C:\Users\kimse\Downloads\pj-kmuai-00.pem ec2-user@32.197.64.211
```

---

### 문제 3: better-sqlite3 Node.js 버전 불일치

**증상**: "was compiled against a different Node.js version using NODE_MODULE_VERSION 127. This version requires NODE_MODULE_VERSION 108"

**원인**: 
- `ec2-user`의 Node.js = v22 (MODULE_VERSION 127)
- `root`(sudo)의 Node.js = v18 (MODULE_VERSION 108, nodesource로 설치된 것)
- `npm install`은 ec2-user(v22)로 했는데, `sudo node`는 root(v18)를 사용

**해결**: `sudo $(which node)` 사용 — ec2-user의 Node.js 경로를 sudo로 실행
```bash
sudo $(which node) server/index.js
```

---

### 문제 4: DB 파일 열기 실패 (unable to open database file)

**증상**: "[Server] Failed to initialize database: unable to open database file"

**원인**: `data/` 폴더가 root 소유로 생성되어 ec2-user가 쓰기 불가

**해결**:
```bash
sudo chown ec2-user:ec2-user /home/ec2-user/game/data
```

그리고 `.env`에서 DB_PATH를 절대 경로로 설정:
```
DB_PATH=/home/ec2-user/game/data/game.db
```

---

### 문제 5: 포트 3000 접속 불가 (ERR_CONNECTION_TIMED_OUT)

**증상**: `http://IP:3000` 접속 시 타임아웃

**원인**: 보안그룹에 포트 80만 열려있고 3000은 안 열림

**해결**: `.env`에서 `PORT=80`으로 설정하고 `sudo $(which node)`로 실행

---

### 문제 6: SSH 끊으면 서버 종료됨

**증상**: SSH 연결 끊으면 백그라운드 프로세스도 종료

**해결**: `nohup` 사용
```bash
sudo nohup $(which node) server/index.js > /dev/null 2>&1 &
```

---

## 서버 관리 명령어

```bash
# 서버 상태 확인
ps aux | grep node

# 서버 중지
sudo kill $(pgrep -f "node server/index.js")

# 서버 재시작
cd /home/ec2-user/game
sudo nohup $(which node) server/index.js > /dev/null 2>&1 &

# 로그 확인 (nohup 사용 시 로그 없음, 필요하면 아래처럼)
sudo $(which node) server/index.js > /home/ec2-user/game/server.log 2>&1 &
tail -f /home/ec2-user/game/server.log
```

---

## 핵심 교훈

1. **sudo와 일반 사용자의 Node.js 버전이 다를 수 있다** → 항상 `sudo $(which node)` 사용
2. **보안그룹은 미리 확인** → 권한 없으면 담당자에게 요청
3. **폴더 소유권 확인** → root로 만든 폴더는 일반 사용자가 쓸 수 없음
4. **nohup 필수** → SSH 끊어도 서버 유지하려면 반드시 사용
5. **포트 80은 sudo 필요** → 1024 이하 포트는 root 권한 필요
