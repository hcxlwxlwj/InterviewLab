const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
const ts = require(path.join(root, 'node_modules/typescript'));
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
const files = cp.execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'code'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter((name) => /\.(?:ts|tsx)$/.test(name));
const unique = [...new Set(files)].sort();
function leaves(node) {
  if (ts.isParenthesizedExpression(node)) return leaves(node.expression);
  if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(node.operatorToken.kind))
    return leaves(node.left) + leaves(node.right);
  return 1;
}
const conditions = [], manifest = [];
for (const file of unique) {
  const buffer = fs.readFileSync(path.join(root, file));
  manifest.push({ file, sha256: hash(buffer) });
  const source = ts.createSourceFile(file, buffer.toString('utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if (ts.isIfStatement(node)) {
      const point = source.getLineAndCharacterOfPosition(node.expression.getStart(source));
      conditions.push({ file, line: point.line + 1, column: point.character + 1, boolean_leaves: leaves(node.expression) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
const findings = conditions.filter((condition) => condition.boolean_leaves > 3)
  .sort((a, b) => b.boolean_leaves - a.boolean_leaves || a.file.localeCompare(b.file) || a.line - b.line);
const changed = manifest.filter((entry) => hash(fs.readFileSync(path.join(root, entry.file))) !== entry.sha256).map((entry) => entry.file);
const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  git_head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  tool: { name: 'TypeScript AST', typescript_version: ts.version, script_sha256: hash(fs.readFileSync(__filename)) },
  scope: 'Current tracked and nonignored untracked code/**/*.ts and code/**/*.tsx source contents; generated/ignored files outside Git inventory excluded.',
  rule: {
    id: 'TH-07',
    threshold: 3,
    ast: 'Visit IfStatement nodes only. Recursively unwrap ParenthesizedExpression; for BinaryExpression with && or || sum left/right leaves; every other expression is one leaf.',
    nullish_coalescing: '?? is a nonlogical leaf; do not descend into it.',
    other_nonlogical_expressions: 'Calls, comparisons, unary expressions and ternary expressions each count as one leaf; their contents are not flattened into the surrounding logical tree.',
    conditional_expressions: 'Ternary conditions, loop conditions and JSX conditions are not independently scanned as if statements.',
  },
  summary: { files: unique.length, if_statements: conditions.length, exceeding_threshold: findings.length, maximum_boolean_leaves: Math.max(0, ...conditions.map((condition) => condition.boolean_leaves)) },
  findings,
  file_manifest: manifest,
  snapshot_stable_during_audit: changed.length === 0,
  changed_during_audit: changed,
  limitations: ['Candidate screening only; business semantics and necessity of each condition are not judged automatically.', 'No source text or sensitive condition values are stored.', 'This metric does not measure every logical operation nested inside nonlogical expression leaves.'],
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, ...report.summary, snapshot_stable: report.snapshot_stable_during_audit, largest: findings.slice(0, 8) }, null, 2));
