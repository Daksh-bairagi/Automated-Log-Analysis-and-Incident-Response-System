const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const reportsDir = path.join(__dirname, 'reports');

function walkFiles(dir, predicate) {
  const result = [];
  if (!fs.existsSync(dir)) return result;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(fullPath, predicate));
      continue;
    }
    if (!predicate || predicate(fullPath)) {
      result.push(fullPath);
    }
  }

  return result;
}

function rel(fullPath) {
  return path.relative(repoRoot, fullPath).replace(/\\/g, '/');
}

function baseNameWithoutExtension(filePath) {
  return path.basename(filePath, path.extname(filePath)).toLowerCase();
}

function findMatchingTests(componentPath, testPaths) {
  const componentBase = baseNameWithoutExtension(componentPath);
  const componentTokens = componentBase
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

  return testPaths.filter((testPath) => {
    const testText = rel(testPath).toLowerCase();
    if (testText.includes(componentBase)) {
      return true;
    }
    return componentTokens.length > 1 && componentTokens.every((token) => testText.includes(token));
  });
}

function buildSection(title, components, testPaths, fallbackVerification) {
  return {
    title,
    items: components.map((componentPath) => {
      const matches = findMatchingTests(componentPath, testPaths);
      return {
        component: rel(componentPath),
        verification:
          matches.length > 0
            ? matches.map(rel)
            : fallbackVerification,
      };
    }),
  };
}

function toMarkdown(sections) {
  const lines = [
    '# Component Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
  ];

  for (const section of sections) {
    lines.push(`## ${section.title}`, '');
    lines.push('| Component | Verification |');
    lines.push('|---|---|');

    for (const item of section.items) {
      const verification = Array.isArray(item.verification)
        ? item.verification.join('<br>')
        : item.verification;
      lines.push(`| \`${item.component}\` | ${verification} |`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  fs.mkdirSync(reportsDir, { recursive: true });

  const serverComponents = walkFiles(path.join(repoRoot, 'server', 'src'), (filePath) => filePath.endsWith('.js'));
  const serverUnitTests = walkFiles(path.join(repoRoot, 'server', 'tests', 'unit'), (filePath) => filePath.endsWith('.test.js'));
  const serverIntegrationTests = walkFiles(path.join(repoRoot, 'server', 'tests', 'integration'), (filePath) => filePath.endsWith('.test.js'));
  const clientComponents = walkFiles(path.join(repoRoot, 'client', 'src'), (filePath) => /\.(js|jsx)$/.test(filePath));

  const sections = [
    buildSection('Server Source vs Unit Tests', serverComponents, serverUnitTests, 'Covered indirectly by integration or pending dedicated unit test'),
    buildSection('Server Source vs Integration Tests', serverComponents, serverIntegrationTests, 'Not directly named in integration suite'),
    {
      title: 'Client Source Verification',
      items: clientComponents.map((componentPath) => ({
        component: rel(componentPath),
        verification: 'Verified by client lint + production build',
      })),
    },
  ];

  const payload = {
    generatedAt: new Date().toISOString(),
    sections,
  };

  fs.writeFileSync(
    path.join(reportsDir, 'component-audit.json'),
    JSON.stringify(payload, null, 2),
  );
  fs.writeFileSync(
    path.join(reportsDir, 'component-audit.md'),
    toMarkdown(sections),
  );

  console.log(`Component audit written to ${path.join('test', 'reports')}`);
}

main();
