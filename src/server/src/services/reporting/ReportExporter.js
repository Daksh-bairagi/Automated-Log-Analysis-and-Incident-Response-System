/**
 * Handles exporting a report to PDF or CSV format.
 */

class ReportExporter {
  exportToCsv(report) {
    const incidents = Array.isArray(report?.incidents) ? report.incidents : [];

    const headers = ['ID', 'Severity', 'Type', 'Source', 'Timestamp', 'Message', 'Playbook'];
    const lines = [headers.join(',')];

    for (const inc of incidents) {
      const row = [
        this._escapeCsvValue(inc.id),
        this._escapeCsvValue(inc.severity),
        this._escapeCsvValue(inc.type),
        this._escapeCsvValue(inc.source),
        this._escapeCsvValue(inc.timestamp),
        this._escapeCsvValue(inc.message),
        this._escapeCsvValue(inc.playbook),
      ];
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  exportToPdf(report) {
    const incidents = Array.isArray(report?.incidents) ? report.incidents : [];
    const lines = [
      `Log Analysis Report: ${report?.reportId || report?.id || report?._id || 'latest'}`,
      `Generated: ${report?.generatedAt || report?.createdAt || new Date().toISOString()}`,
      `Entries: ${report?.processedEntries || 0}`,
      `Incidents: ${report?.detectedIncidents ?? incidents.length}`,
      `Parse Errors: ${report?.parseErrors || 0}`,
      '',
      'Incident Summary',
    ];

    const maxIncidentLines = 28;
    for (const incident of incidents.slice(0, maxIncidentLines)) {
      lines.push(
        `[${incident.severity || 'UNKNOWN'}] ${incident.source || 'unknown'} | ` +
        `${incident.timestamp || 'unknown'} | ${incident.message || ''}`
      );
    }

    if (incidents.length > maxIncidentLines) {
      lines.push(`... ${incidents.length - maxIncidentLines} more incidents omitted`);
    }

    return this._buildSimplePdf(lines);
  }

  _escapeCsvValue(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  _buildSimplePdf(lines) {
    const safeLines = Array.isArray(lines) ? lines : [];
    const contentStream = this._buildPdfTextStream(safeLines);
    const objects = [
      null,
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    for (let index = 1; index < objects.length; index += 1) {
      offsets[index] = Buffer.byteLength(pdf, 'utf8');
      pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length}\n`;
    pdf += '0000000000 65535 f \n';

    for (let index = 1; index < objects.length; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'utf8');
  }

  _buildPdfTextStream(lines) {
    const maxLines = 40;
    const commands = ['BT', '/F1 12 Tf', '72 750 Td'];

    lines.slice(0, maxLines).forEach((line, index) => {
      if (index > 0) {
        commands.push('0 -16 Td');
      }
      commands.push(`(${this._escapePdfText(line)}) Tj`);
    });

    commands.push('ET');
    return commands.join('\n');
  }

  _escapePdfText(value) {
    return String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E]/g, ' ');
  }
}

module.exports = ReportExporter;
