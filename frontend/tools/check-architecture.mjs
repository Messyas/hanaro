import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/app');
const violations = [];

function* typescriptFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* typescriptFiles(fullPath);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) yield fullPath;
  }
}

function relativeParts(filePath) {
  const relative = path.relative(appRoot, filePath);
  return relative.startsWith('..') ? null : relative.split(path.sep);
}

function checkImport(source, specifier) {
  if (!specifier.startsWith('.')) return;
  const sourceParts = relativeParts(source);
  const targetParts = relativeParts(path.resolve(path.dirname(source), specifier));
  if (!sourceParts || !targetParts) return;

  const [fromArea, fromFeature] = sourceParts;
  const [toArea, toFeature] = targetParts;
  const publicApi = specifier.endsWith('.public-api');
  const authEntryPoint =
    toArea === 'modules' &&
    toFeature === 'auth' &&
    ['login-dialog', 'login-page'].includes(path.basename(specifier));
  let allowed = true;

  if (fromArea === 'shared') allowed = toArea === 'shared';
  if (fromArea === 'core') allowed = toArea === 'core' || toArea === 'shared';
  if (fromArea === 'layouts') {
    allowed =
      toArea === 'layouts' ||
      toArea === 'core' ||
      toArea === 'shared' ||
      (toArea === 'modules' && toFeature === 'auth' && (publicApi || authEntryPoint));
  }
  if (fromArea === 'modules' && toArea === 'modules' && fromFeature !== toFeature) {
    allowed = publicApi || authEntryPoint;
  }

  if (!allowed) {
    violations.push(`${path.relative(appRoot, source)} -> ${specifier}`);
  }
}

for (const filePath of typescriptFiles(appRoot)) {
  const source = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      checkImport(filePath, node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      checkImport(filePath, node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

if (violations.length) {
  console.error('Frontend architecture violations:\n' + violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Frontend architecture boundaries: OK');
}
