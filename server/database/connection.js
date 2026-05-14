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
  const playersDDL = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='players'"
  ).get();
  if (playersDDL && /name\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(playersDDL.sql)) {
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
  }

  // 전화번호·학번 partial UNIQUE 인덱스 (NULL 다수 허용)
  database.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_players_phone      ON players(phone)      WHERE phone IS NOT NULL'
  );
  database.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_players_student_id ON players(student_id) WHERE student_id IS NOT NULL'
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
