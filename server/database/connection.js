const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let db = null;

/**
 * Get or create the database connection.
 * Initializes the schema on first connection.
 */
function getDatabase() {
  if (db) return db;

  const dbDir = path.dirname(path.resolve(config.DB_PATH));
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(path.resolve(config.DB_PATH));

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initializeSchema(db);

  return db;
}

/**
 * Initialize database schema from schema.sql file.
 * For existing DBs, also adds missing columns added in later versions.
 */
function initializeSchema(database) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  database.exec(schema);

  // sessions 테이블에 후속 추가된 컬럼이 없으면 ALTER로 추가 (기존 game.db 호환)
  const sessionCols = database.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  const addSessionColIfMissing = (name, ddl) => {
    if (!sessionCols.includes(name)) {
      database.exec(`ALTER TABLE sessions ADD COLUMN ${ddl}`);
    }
  };
  addSessionColIfMissing('bedrock_input_tokens',  'bedrock_input_tokens INTEGER NOT NULL DEFAULT 0');
  addSessionColIfMissing('bedrock_output_tokens', 'bedrock_output_tokens INTEGER NOT NULL DEFAULT 0');
  addSessionColIfMissing('bedrock_call_count',    'bedrock_call_count INTEGER NOT NULL DEFAULT 0');

  // players 테이블 후속 컬럼
  const playerCols = database.prepare("PRAGMA table_info(players)").all().map(c => c.name);
  if (!playerCols.includes('student_id')) {
    database.exec('ALTER TABLE players ADD COLUMN student_id TEXT DEFAULT NULL');
  }

  // players.name UNIQUE 제거 마이그레이션
  // SQLite는 컬럼 제약 변경 불가 → 테이블 재생성 방식.
  // sessions가 players(id)를 FK로 참조하므로 마이그레이션 동안 foreign_keys OFF.
  const playersDDL = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='players'"
  ).get();
  if (playersDDL && /name\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(playersDDL.sql)) {
    database.pragma('foreign_keys = OFF');
    try {
      database.exec(`
        BEGIN TRANSACTION;
        CREATE TABLE players_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT DEFAULT NULL,
          student_id TEXT DEFAULT NULL,
          consent_at TEXT DEFAULT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO players_new (id, name, phone, student_id, consent_at, created_at)
          SELECT id, name, phone, student_id, consent_at, created_at FROM players;
        DROP TABLE players;
        ALTER TABLE players_new RENAME TO players;
        COMMIT;
      `);
    } finally {
      database.pragma('foreign_keys = ON');
    }
  }

  // 🏷️ 시간초과 재도전 허용 마이그레이션 (2026-05-17~):
  //   phone/student_id UNIQUE를 제거한다. 대신 application 레벨에서
  //   "성공한 sessions가 있는 phone/student_id"만 중복으로 본다.
  //   - 처음 도전 → 시간초과 → 재도전 가능 (새 player row 생성)
  //   - 성공한 후 재도전 → 차단 (precheck에서 409)
  database.exec('DROP INDEX IF EXISTS idx_players_phone');
  database.exec('DROP INDEX IF EXISTS idx_players_student_id');
  // 비-UNIQUE 보조 인덱스: 성공 세션 조회 시 phone/student_id 빠른 lookup
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_players_phone_lookup      ON players(phone)      WHERE phone IS NOT NULL'
  );
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_players_student_id_lookup ON players(student_id) WHERE student_id IS NOT NULL'
  );

  // messages 테이블 후속 컬럼
  const messageCols = database.prepare("PRAGMA table_info(messages)").all().map(c => c.name);
  if (!messageCols.includes('phase')) {
    database.exec('ALTER TABLE messages ADD COLUMN phase INTEGER DEFAULT NULL');
  }
}

/**
 * Close the database connection.
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDatabase, closeDatabase };
