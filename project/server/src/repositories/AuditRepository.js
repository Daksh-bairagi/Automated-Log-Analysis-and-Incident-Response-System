class AuditRepository {
  constructor(db) {
    // If using mongo:
    if (db && typeof db.collection === 'function') {
      this.auditLogs = db.collection('audit_logs');
      this.isMongo = true;
    } else {
      // Fallback to File if needed
      const fs = require('fs');
      this.dir = './output/audit_logs';
      fs.mkdirSync(this.dir, { recursive: true });
      this.isMongo = false;
    }
  }

  async log(entry) {
    if (this.isMongo) {
      await this.auditLogs.insertOne(entry);
    } else {
      const fs = require('fs');
      const path = require('path');
      const file = `audit-${Date.now()}.json`;
      fs.writeFileSync(path.join(this.dir, file), JSON.stringify(entry, null, 2));
    }
  }
}

module.exports = AuditRepository;
