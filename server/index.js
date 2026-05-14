/**
 * Express App Entry Point - Mission: Zero Noise
 * 
 * Initializes Express app, middleware, routes, database,
 * and error handling.
 */

const express = require('express');
const path = require('path');
const config = require('./config');
const { getDatabase, closeDatabase } = require('./database/connection');

// Import route modules
const sessionsRouter = require('./routes/sessions');
const messagesRouter = require('./routes/messages');
const rankingsRouter = require('./routes/rankings');
const adminRouter = require('./routes/admin');
const playersRouter = require('./routes/players');

const app = express();

// --- Middleware ---

// JSON body parsing
app.use(express.json());

// Static file serving from 'public/' directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Routes ---

// Session management
app.use('/api/sessions', sessionsRouter);

// Message/game progression (nested under sessions)
app.use('/api/sessions', messagesRouter);

// Rankings
app.use('/api/rankings', rankingsRouter);

// Admin (Bedrock 토큰/비용 통계)
app.use('/api/admin', adminRouter);

// Players (precheck 등)
app.use('/api/players', playersRouter);

// --- Error Handling Middleware ---

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: '요청한 API 엔드포인트를 찾을 수 없습니다' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  console.error(err.stack);
  res.status(500).json({ error: '서버 내부 오류가 발생했습니다. 다시 시도해주세요' });
});

// --- Database Initialization & Server Start ---

function startServer() {
  // Initialize database on startup
  try {
    getDatabase();
    console.log('[Server] Database initialized successfully');
  } catch (err) {
    console.error('[Server] Failed to initialize database:', err.message);
    process.exit(1);
  }

  const server = app.listen(config.PORT, () => {
    console.log(`[Server] Mission: Zero Noise running on port ${config.PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down...');
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[Server] SIGINT received, shutting down...');
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  });

  return server;
}

// Only start server if this file is run directly (not imported for testing)
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
