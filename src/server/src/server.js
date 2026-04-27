/**
 * HTTP server entry point.
 */

const http = require('http');
const config = require('./config/env');
const createApp = require('./app');
const MongoDatabase = require('./db/MongoDatabase');
const MongoRepository = require('./repositories/MongoRepository');
const FileRepository = require('./repositories/FileRepository');

async function startServer() {
  let repository;

  if (config.MONGO_URI) {
    try {
      console.log('Connecting to MongoDB...');
      const db = new MongoDatabase(config.MONGO_URI, config.DB_NAME);
      await db.connect();
      console.log('MongoDB connected successfully');
      repository = new MongoRepository(db);
    } catch (error) {
      console.warn(`MongoDB connection failed: ${error.message}`);
      console.warn('Falling back to file-based storage');
      repository = new FileRepository(config.OUTPUT_DIR || './output');
    }
  } else {
    console.log('No MONGO_URI configured, using file-based storage');
    repository = new FileRepository(config.OUTPUT_DIR || './output');
  }



  const app = createApp({ repository });
  const server = http.createServer(app);



  const PORT = config.PORT;
  server.listen(PORT, () => {
    console.log('');
    console.log('Log Analysis & Incident Response System');
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API:        http://localhost:${PORT}/api/health`);
    console.log(`Storage:    ${config.MONGO_URI ? 'MongoDB' : 'File System'}`);
    console.log(`CORS:       localhost:5173, localhost:3000`);
    console.log(`ENV:        ${config.NODE_ENV}`);
    console.log('');
  });

  let shuttingDown = false;
  const gracefulShutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log('\nShutting down gracefully...');



    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => {
    gracefulShutdown().catch((error) => {
      console.error(`Shutdown failed: ${error.message}`);
      process.exit(1);
    });
  });
  process.on('SIGINT', () => {
    gracefulShutdown().catch((error) => {
      console.error(`Shutdown failed: ${error.message}`);
      process.exit(1);
    });
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});
