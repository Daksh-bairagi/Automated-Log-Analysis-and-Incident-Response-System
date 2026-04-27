const fs = require('fs');
const path = require('path');

class FileRepository {
  constructor(dir = './output') {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
  }

  async saveReport(report, context = {}) {
    const { entries = [], incidents = [], ownerId = null } = context;
    const file = `report-${Date.now()}.json`;
    const filePath = path.join(this.dir, file);
    
    const dataToSave = {
      ...report,
      ownerId,
      reportId: file,
      createdAt: new Date(),
      incidents,
      log_entries: entries
    };
    
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
    
    return { reportId: file, reportPath: filePath };
  }

  async getLatestReport(options = {}) {
    const { ownerId = null } = options;
    if (!fs.existsSync(this.dir)) return null;
    
    const files = fs.readdirSync(this.dir).filter(f => f.startsWith('report-')).sort().reverse();
    if (files.length === 0) return null;

    const reports = files
      .map((file) => JSON.parse(fs.readFileSync(path.join(this.dir, file), 'utf-8')))
      .filter((report) => !ownerId || report.ownerId === ownerId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return reports[0] || null;
  }

  async getReportById(id, options = {}) {
    const { ownerId = null } = options;
    if (!id) return null;
    const filePath = path.join(this.dir, id);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const report = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (ownerId && report.ownerId !== ownerId) {
      return null;
    }
    return report;
  }

  async saveSourceDocument(metadata) {
    const file = `source-doc-${Date.now()}-${Math.floor(Math.random() * 1000)}.json`;
    const filePath = path.join(this.dir, file);
    fs.writeFileSync(filePath, JSON.stringify({ ...metadata, uploadedAt: new Date() }, null, 2));
    return { id: file, filePath };
  }

  async listSourceDocuments(options = {}) {
    const { ownerId = null } = options;
    if (!fs.existsSync(this.dir)) return [];

    return fs.readdirSync(this.dir)
      .filter((file) => file.startsWith('source-doc-') && file.endsWith('.json'))
      .sort()
      .reverse()
      .map((file) => {
        const fullPath = path.join(this.dir, file);
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        return {
          id: file,
          ...parsed,
        };
      })
      .filter((doc) => !ownerId || doc.ownerId === ownerId);
  }
}

module.exports = FileRepository;
