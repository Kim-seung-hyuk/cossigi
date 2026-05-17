CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT DEFAULT NULL,
    student_id TEXT DEFAULT NULL,
    consent_at TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- 이름·전화번호·학번 모두 중복 허용 (2026-05-17~).
-- 중복 차단은 application 레벨 (precheck/createPlayer): "성공 세션 보유 여부"로 판단.
-- 시간초과 재도전이 정책상 허용되므로 같은 phone/student_id의 새 player row가 정상 생성됨.
CREATE INDEX IF NOT EXISTS idx_players_phone_lookup      ON players(phone)      WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_student_id_lookup ON players(student_id) WHERE student_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    player_id INTEGER NOT NULL,
    phase INTEGER NOT NULL DEFAULT 1,
    noise_level INTEGER NOT NULL DEFAULT 100,
    turn_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'in_progress',
    score INTEGER DEFAULT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT DEFAULT NULL,
    elapsed_seconds INTEGER DEFAULT NULL,
    phase1_completed INTEGER NOT NULL DEFAULT 0,
    phase2_completed INTEGER NOT NULL DEFAULT 0,
    phase3_completed INTEGER NOT NULL DEFAULT 0,
    phase1_turns INTEGER NOT NULL DEFAULT 0,
    phase2_turns INTEGER NOT NULL DEFAULT 0,
    phase3_turns INTEGER NOT NULL DEFAULT 0,
    keywords_collected TEXT NOT NULL DEFAULT '[]',
    bedrock_input_tokens INTEGER NOT NULL DEFAULT 0,
    bedrock_output_tokens INTEGER NOT NULL DEFAULT 0,
    bedrock_call_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('player', 'cosseogi', 'system')),
    content TEXT NOT NULL,
    turn_number INTEGER,
    phase INTEGER DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_score ON sessions(score DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
