import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const inputPath = 'coverage/frontend/lcov.info';
const outputPath = process.env.SONAR_LCOV_OUTPUT ?? 'coverage/sonar-lcov.info';

const report = await readFile(inputPath, 'utf8');
const normalizedReport = report.replace(/^SF:(.+)$/gm, (_line, filePath) => {
  const normalizedPath = filePath.replaceAll('\\', '/');
  const repositoryPath = normalizedPath.startsWith('src/')
    ? `frontend/${normalizedPath}`
    : normalizedPath;

  return `SF:${repositoryPath}`;
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, normalizedReport, 'utf8');
