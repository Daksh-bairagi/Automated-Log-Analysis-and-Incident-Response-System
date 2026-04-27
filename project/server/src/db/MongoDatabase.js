/**
 * ============================================================================
 * MONGO DATABASE — MongoDB Connection Wrapper
 * ============================================================================
 * Manages the MongoDB connection lifecycle and provides access to the
 * database and collection objects. Encapsulates the MongoDB native driver
 * to keep connection logic centralized.
 *
 * RESPONSIBILITIES:
 *   - Connect to MongoDB using the native driver
 *   - Provide collection accessors
 *   - Auto-create collections and indexes on first connect
 *   - Handle graceful disconnection
 *
 * COLLECTIONS CREATED:
 *   - reports          (indexed on createdAt)
 *   - incidents        (indexed on reportId, severity)
 *   - log_entries      (indexed on reportId)
 *   - source_documents (indexed on reportId)
 *
 * USAGE:
 *   const db = new MongoDatabase('mongodb://localhost:27017', 'log_analyzer');
 *   await db.connect();
 *   const reportsCol = db.getCollection('reports');
 * ============================================================================
 */

const { MongoClient } = require('mongodb');
const { COLLECTIONS } = require('../../../shared/constants');
const retry = require('../utils/retry');

class MongoDatabase {
  /**
   * @param {string} uri - MongoDB connection URI
   * @param {string} dbName - Database name
   */
  constructor(uri, dbName) {
    this.uri = uri;
    this.dbName = dbName;
    this.client = null;
    this.db = null;
  }

  /**
   * Establishes a connection to MongoDB and initializes collections/indexes.
   *
   * @returns {Promise<void>}
   * @throws {Error} If connection fails
   */
  async connect() {
    // Create a new MongoClient with connection pooling
    this.client = new MongoClient(this.uri, {
      maxPoolSize: 50,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
    });

    // Connect to the server
    await retry(() => this.client.connect(), {
      retries: 3,
      delayMs: 1000,
      backoff: 'exponential',
    });

    // Get the database reference
    this.db = this.client.db(this.dbName);

    // Create collections and indexes
    await this._initializeCollections();
  }

  /**
   * Creates collections and indexes if they don't already exist.
   * Runs on first connection to ensure the schema is ready.
   *
   * @private
   */
  async _initializeCollections() {
    // ---- Reports collection ----
    const reports = this.getCollection(COLLECTIONS.REPORTS);
    await reports.createIndex({ createdAt: -1 }); // Most recent first
    await reports.createIndex({ ownerId: 1, createdAt: -1 });

    // ---- Incidents collection ----
    const incidents = this.getCollection(COLLECTIONS.INCIDENTS);
    await incidents.createIndex({ reportId: 1 });     // Lookup by report
    await incidents.createIndex({ ownerId: 1, reportId: 1 });
    await incidents.createIndex({ severity: 1 });     // Filter by severity
    await incidents.createIndex({ incidentId: 1 });   // Lookup by incident ID

    // ---- Log entries collection ----
    const logEntries = this.getCollection(COLLECTIONS.LOG_ENTRIES);
    await logEntries.createIndex({ reportId: 1 });    // Lookup by report
    await logEntries.createIndex({ ownerId: 1, reportId: 1 });
    await logEntries.createIndex({ level: 1 });       // Filter by level

    // ---- Source documents collection ----
    const sourceDocs = this.getCollection(COLLECTIONS.SOURCE_DOCUMENTS);
    await sourceDocs.createIndex({ reportId: 1 });    // Lookup by report
    await sourceDocs.createIndex({ ownerId: 1, uploadedAt: -1 });
    await sourceDocs.createIndex({ uploadedAt: -1 }); // Most recent first
  }

  /**
   * Gets a MongoDB collection by name.
   *
   * @param {string} name - Collection name (use COLLECTIONS constants)
   * @returns {import('mongodb').Collection} MongoDB collection object
   * @throws {Error} If database is not connected
   */
  getCollection(name) {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db.collection(name);
  }

  /**
   * Closes the MongoDB connection gracefully.
   *
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  /**
   * Checks if the database connection is active.
   *
   * @returns {boolean} True if connected
   */
  isConnected() {
    return this.client !== null && this.db !== null;
  }
}

module.exports = MongoDatabase;
