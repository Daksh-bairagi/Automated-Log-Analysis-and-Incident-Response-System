const { ObjectId } = require('mongodb');

class MongoRepository {
  constructor(db) {
    this.db = db;
    this.reports = db.getCollection('reports');
    this.incidents = db.getCollection('incidents');
    this.logEntries = db.getCollection('log_entries');
    this.sourceDocs = db.getCollection('source_documents');
  }

  // Follows Flow 7 requirement
  async saveReport(report, context = {}) {
    const { entries = [], incidents = [], ownerId = null } = context;
    
    const result = await this.reports.insertOne({ ...report, ownerId, createdAt: new Date() });
    
    if (incidents.length > 0) {
      await this.incidents.insertMany(incidents.map(i => ({ ...i, ownerId, reportId: result.insertedId })));
    }
    
    if (entries.length > 0) {
      await this.logEntries.insertMany(entries.map(e => ({ ...e, ownerId, reportId: result.insertedId })));
    }
    
    return { reportId: result.insertedId };
  }

  // Follows Flow 7 requirement
  async getLatestReport(options = {}) {
    const { ownerId = null } = options;
    const query = ownerId ? { ownerId } : {};
    const report = await this.reports.findOne(query, { sort: { createdAt: -1 } });
    if (report) {
      report.incidents = await this.incidents.find({ reportId: report._id, ...(ownerId ? { ownerId } : {}) }).toArray();
    }
    return report;
  }

  async getReportById(id, options = {}) {
    const { ownerId = null } = options;
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const report = await this.reports.findOne({ _id: new ObjectId(id), ...(ownerId ? { ownerId } : {}) });
    if (!report) {
      return null;
    }

    report.incidents = await this.incidents.find({ reportId: report._id, ...(ownerId ? { ownerId } : {}) }).toArray();
    return report;
  }

  async saveSourceDocument(metadata) {
    const result = await this.sourceDocs.insertOne({ ...metadata, uploadedAt: new Date() });
    return { id: result.insertedId };
  }

  async listSourceDocuments(options = {}) {
    const { ownerId = null } = options;
    const query = ownerId ? { ownerId } : {};
    return this.sourceDocs.find(query).sort({ uploadedAt: -1 }).limit(100).toArray();
  }
}

module.exports = MongoRepository;
