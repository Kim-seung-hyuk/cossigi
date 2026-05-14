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
  const existingCols = database.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  const addColumnIfMissing = (name, ddl) => {
    if (!existingCols.includes(name)) {
      database.exec(`ALTER TABLE sessions ADD COLUMN ${ddl}`);
    }
  };
  addColumnIfMissing('bedrock_input_tokens',  'bedrock_input_tokens INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('bedrock_output_tokens', 'bedrock_output_tokens INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('bedrock_call_count',    'bedrock_call_count INTEGER NOT NULL DEFAULT 0');
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
