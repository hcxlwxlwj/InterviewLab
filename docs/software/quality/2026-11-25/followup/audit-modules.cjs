const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const root = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3]);
const ts = require(path.join(root, 'node_modules/typescript'));
const started = new Date().toISOString();
const slash = (value) => value.replaceAll('\\', '/');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const gitFiles = (...args) => git('ls-files', '-z', ...args, '--', 'code', '.github', 'tests').split('\0').filter(Boolean);
const tracked = new Set(gitFiles('--cached'));
const untracked = new Set(gitFiles('--others', '--exclude-standard'));
const sourcePattern = /\.(?:[cm]?[jt]sx?)$/i;
const sourceFiles = [...new Set([...tracked, ...untracked])].filter((name) => sourcePattern.test(name)).sort();
const sourceSet = new Set(sourceFiles);
const paths = ['code/core_engine', 'code/backend', 'code/frontend'];
const packages = new Map(paths.map((directory) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, directory, 'package.json'), 'utf8'));
  return [manifest.name, { directory, manifest }];
}));
const configPath = path.join(root, 'tsconfig.json');
const configRead = ts.readConfigFile(configPath, ts.sys.readFile);
if (configRead.error) throw new Error('Cannot read project tsconfig.json');
const parsed = ts.parseJsonConfigFileContent(configRead.config, ts.sys, root);
const compilerOptions = { ...parsed.options, preserveSymlinks: true };
const moduleCache = ts.createModuleResolutionCache(root, (name) => name.toLowerCase(), compilerOptions);

function classifyImport(node) {
  const clause = node.importClause;
  if (!clause) return 'runtime';
  if (clause.isTypeOnly) return 'type-only';
  const names = clause.namedBindings;
  return !clause.name && names && ts.isNamedImports(names) && names.elements.length > 0 &&
    names.elements.every((entry) => entry.isTypeOnly) ? 'type-only' : 'runtime';
}
function classifyExport(node) {
  if (node.isTypeOnly) return 'type-only';
  const names = node.exportClause;
  return names && ts.isNamedExports(names) && names.elements.length > 0 &&
    names.elements.every((entry) => entry.isTypeOnly) ? 'type-only' : 'runtime';
}
function literal(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
}
function dependencies(source) {
  const result = [];
  const add = (node, argument, kind, mode) => {
    const point = source.getLineAndCharacterOfPosition(node.getStart(source));
    result.push({ line: point.line + 1, column: point.character + 1, kind, mode: source.isDeclarationFile ? 'type-only' : mode, specifier: literal(argument) });
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier)
      add(node, node.moduleSpecifier, 'import', classifyImport(node));
    else if (ts.isExportDeclaration(node) && node.moduleSpecifier)
      add(node, node.moduleSpecifier, 'export', classifyExport(node));
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference))
      add(node, node.moduleReference.expression, 'import-equals-require', node.isTypeOnly ? 'type-only' : 'runtime');
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      add(node, node.argument.literal, 'import-type', 'type-only');
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
      add(node, node.arguments[0], 'dynamic-import', 'dynamic-runtime');
    else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require')
      add(node, node.arguments[0], 'require', 'runtime');
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}
function moduleFile(base) {
  const candidates = [base];
  if (/\.(?:js|mjs|cjs)$/i.test(base)) candidates.push(base.replace(/\.(?:js|mjs|cjs)$/i, '.ts'), base.replace(/\.(?:js|mjs|cjs)$/i, '.tsx'));
  candidates.push(...['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.d.ts'].map((ext) => base + ext));
  candidates.push(...['index.ts', 'index.tsx', 'index.js', 'index.mjs', 'index.cjs', 'index.d.ts'].map((name) => path.join(base, name)));
  return candidates.find((name) => fs.existsSync(name) && fs.statSync(name).isFile());
}
function resolveDependency(specifier, from) {
  if (specifier.startsWith('@interviewlab/')) {
    const parts = specifier.split('/');
    const packageName = parts.slice(0, 2).join('/');
    const packageInfo = packages.get(packageName);
    if (!packageInfo) return { resolution: 'unresolved-workspace', target: null };
    const subpath = parts.length > 2 ? './' + parts.slice(2).join('/') : '.';
    const manifest = packageInfo.manifest;
    const mapping = typeof manifest.exports === 'string' && subpath === '.' ? manifest.exports : manifest.exports?.[subpath];
    const target = typeof mapping === 'string' ? moduleFile(path.resolve(root, packageInfo.directory, mapping)) : null;
    return target ? classifyTarget(target) : { resolution: 'unresolved-workspace', target: null };
  }
  if (!specifier.startsWith('.')) return { resolution: 'external', target: null };
  const absolute = path.resolve(root, from);
  const resolved = ts.resolveModuleName(specifier, absolute, compilerOptions, ts.sys, moduleCache).resolvedModule;
  const target = resolved?.resolvedFileName ?? moduleFile(path.resolve(path.dirname(absolute), specifier));
  if (target) return classifyTarget(target);
  if (from === 'code/frontend/next-env.d.ts' && specifier.startsWith('./.next/') && specifier.endsWith('.d.ts'))
    return { resolution: 'expected-generated-declaration', target: null };
  return { resolution: 'unresolved-relative', target: null };
}
function classifyTarget(target) {
  const relative = slash(path.relative(root, target));
  if (relative.startsWith('../') || path.isAbsolute(relative)) return { resolution: 'outside-project', target: null };
  if (sourceSet.has(relative)) return { resolution: 'source', target: relative };
  return { resolution: sourcePattern.test(relative) ? 'source-outside-inventory' : 'asset', target: relative };
}
function stronglyConnected(nodes, references, accept) {
  const adjacent = new Map(nodes.map((node) => [node, new Set()]));
  for (const edge of references)
    if (edge.resolution === 'source' && accept(edge)) adjacent.get(edge.from).add(edge.target);
  let serial = 0;
  const indices = new Map(), low = new Map(), stack = [], onStack = new Set(), components = [];
  const visit = (node) => {
    indices.set(node, serial); low.set(node, serial++); stack.push(node); onStack.add(node);
    for (const target of adjacent.get(node)) {
      if (!indices.has(target)) { visit(target); low.set(node, Math.min(low.get(node), low.get(target))); }
      else if (onStack.has(target)) low.set(node, Math.min(low.get(node), indices.get(target)));
    }
    if (low.get(node) !== indices.get(node)) return;
    const component = [];
    let target;
    do { target = stack.pop(); onStack.delete(target); component.push(target); } while (target !== node);
    if (component.length > 1 || adjacent.get(node).has(node)) components.push(component.sort());
  };
  for (const node of nodes) if (!indices.has(node)) visit(node);
  components.sort((a, b) => a[0].localeCompare(b[0]));
  return {
    node_count: nodes.length,
    unique_edge_count: [...adjacent.values()].reduce((count, targets) => count + targets.size, 0),
    cycle_component_count: components.length,
    cyclic_module_count: components.reduce((count, component) => count + component.length, 0),
    components: components.map((modules) => ({
      modules,
      edges: references.filter((edge) => edge.resolution === 'source' && accept(edge) && modules.includes(edge.from) && modules.includes(edge.target)),
    })),
  };
}
function issueNumbers(line) {
  return [...new Set([
    ...[...line.matchAll(/#(\d+)\b/g)].map((match) => '#' + match[1]),
    ...[...line.matchAll(/\b[A-Z][A-Z0-9]+-(\d+)\b/g)].map((match) => match[0]),
    ...[...line.matchAll(/\/(?:issues|pull)\/(\d+)\b/g)].map((match) => '#' + match[1]),
  ])];
}

// Self-check the syntax distinctions and graph algorithm without reading application data.
const fixture = ts.createSourceFile('fixture.ts', "import type { A } from './a'; import { type B } from './b'; export type * from './c'; import { type D, value } from './d'; import './e'; const later = import('./f'); type G = import('./g').G; const h = require('./h'); export { type I } from './i';", ts.ScriptTarget.Latest, true);
assert.deepEqual(dependencies(fixture).map((edge) => edge.mode), ['type-only', 'type-only', 'type-only', 'runtime', 'runtime', 'dynamic-runtime', 'type-only', 'runtime', 'type-only']);
assert.equal(stronglyConnected(['a', 'b'], [{ from: 'a', target: 'b', resolution: 'source' }], () => true).cycle_component_count, 0);
assert.equal(stronglyConnected(['a', 'b'], [{ from: 'a', target: 'b', resolution: 'source' }, { from: 'b', target: 'a', resolution: 'source' }], () => true).cycle_component_count, 1);
assert.equal(stronglyConnected(['a'], [{ from: 'a', target: 'a', resolution: 'source' }], () => true).cycle_component_count, 1);
assert.deepEqual(issueNumbers('TODO(#123) and https://github.com/owner/repo/issues/456'), ['#123', '#456']);

const references = [], dynamicUnknown = [], manifest = [], syntaxDiagnostics = [];
for (const file of sourceFiles) {
  const buffer = fs.readFileSync(path.join(root, file));
  const source = ts.createSourceFile(file, buffer.toString('utf8'), ts.ScriptTarget.Latest, true);
  manifest.push({ file, sha256: hash(buffer), tracked: tracked.has(file), declaration: source.isDeclarationFile });
  for (const diagnostic of source.parseDiagnostics) {
    const point = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    syntaxDiagnostics.push({ file, line: point.line + 1, column: point.character + 1, code: diagnostic.code });
  }
  for (const item of dependencies(source)) {
    if (item.specifier === null) {
      dynamicUnknown.push({ from: file, line: item.line, column: item.column, kind: item.kind, mode: item.mode });
      continue;
    }
    references.push({ from: file, ...item, ...resolveDependency(item.specifier, file) });
  }
}
const runtimeStatic = (edge) => edge.mode === 'runtime';
const runtimeDynamic = (edge) => edge.mode !== 'type-only';
const all = () => true;
const graphs = {
  runtime_static: stronglyConnected(sourceFiles, references, runtimeStatic),
  runtime_including_literal_dynamic: stronglyConnected(sourceFiles, references, runtimeDynamic),
  all_including_explicit_types: stronglyConnected(sourceFiles, references, all),
};
const changedDuringAudit = manifest.filter((entry) => hash(fs.readFileSync(path.join(root, entry.file))) !== entry.sha256).map((entry) => entry.file);
const base = {
  schema_version: 1,
  started_at: started,
  finished_at: new Date().toISOString(),
  git_head: git('rev-parse', 'HEAD').trim(),
  source: 'Current working-tree file contents; source graph includes tracked and nonignored untracked files under code/.github/tests.',
  tool: { name: 'TypeScript AST and Tarjan strongly connected components', typescript_version: ts.version, script_sha256: hash(fs.readFileSync(__filename)), self_checks: 'passed' },
};
const audit = {
  ...base,
  scope: {
    paths: ['code', '.github', 'tests'],
    source_extensions: ['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'],
    source_files: sourceFiles.length,
    tracked_source_files: sourceFiles.filter((file) => tracked.has(file)).length,
    untracked_source_files: sourceFiles.filter((file) => untracked.has(file)).length,
    graph_nodes: 'Source files; import assets and external package contents are not graph nodes.',
    type_classification: 'Declaration-file dependencies and explicit import type/export type/import() type references are type-only; value or mixed syntax in emitted source is conservatively treated as potentially runtime. Compiler-inferred type elision is not modeled.',
    resolution: 'Relative imports use project TypeScript Bundler options with preserveSymlinks; @interviewlab workspace packages resolve through current package exports. External dependency graphs are excluded.',
  },
  reference_counts: references.reduce((counts, edge) => { counts[edge.mode] = (counts[edge.mode] ?? 0) + 1; counts[edge.resolution] = (counts[edge.resolution] ?? 0) + 1; return counts; }, {}),
  parse_diagnostics: syntaxDiagnostics,
  unresolved_local_dependencies: references.filter((edge) => ['unresolved-relative', 'unresolved-workspace', 'source-outside-inventory', 'outside-project'].includes(edge.resolution)),
  not_applicable_generated_declarations: references.filter((edge) => edge.resolution === 'expected-generated-declaration').map((edge) => ({ ...edge, reason: 'next-env.d.ts references ignored .next generated route declarations; absence before dev/build is not a missing business source module.' })),
  nonliteral_dependencies: dynamicUnknown,
  graphs,
  limitations: [
    'Cycles are strongly connected source-module components, not the number of individual circular paths.',
    'Literal dynamic imports are potential edges; execution order, condition feasibility and laziness are not evaluated.',
    'Computed dependency expressions and aliases for require/loaders are not resolved; nonliteral direct calls are recorded without argument text.',
    'Compiler-inferred type-only references without explicit type syntax may overapproximate runtime edges.',
    'External packages, generated/ignored files, object reference cycles, memory leaks, asynchronous wait chains and database lock ordering are not assessed.',
    'A zero module-cycle result does not establish absence of object cycles, leaks, deadlocks or all missing functionality.',
  ],
  snapshot_stable_during_audit: changedDuringAudit.length === 0,
  changed_during_audit: changedDuringAudit,
  file_manifest: manifest,
  references,
};

const markers = [], scannedText = [], skippedBinary = [], skippedMissing = [];
for (const file of [...tracked].sort()) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) { skippedMissing.push(file); continue; }
  const buffer = fs.readFileSync(absolute);
  if (buffer.includes(0)) { skippedBinary.push(file); continue; }
  const text = buffer.toString('utf8');
  scannedText.push({ file, sha256: hash(buffer) });
  const source = sourcePattern.test(file) ? ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true) : null;
  const commentRanges = [];
  if (source) {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, file.endsWith('tsx') || file.endsWith('jsx') ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard, text);
    let token;
    while ((token = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken)
      if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia)
        commentRanges.push([scanner.getTokenPos(), scanner.getTextPos()]);
  }
  for (const match of text.matchAll(/\b(TODO|FIXME)\b/g)) {
    const position = match.index;
    const prefix = text.slice(0, position);
    const line = prefix.split('\n').length;
    const start = text.lastIndexOf('\n', position - 1) + 1;
    const end = text.indexOf('\n', position);
    const lineText = text.slice(start, end === -1 ? text.length : end);
    const issues = issueNumbers(lineText);
    const isComment = source ? commentRanges.some(([begin, finish]) => position >= begin && position < finish) : null;
    markers.push({ file, line, column: position - start + 1, marker: match[1], issue_references: issues, has_issue_on_same_line: issues.length > 0, syntactic_context: source ? isComment ? 'typescript-or-javascript-comment' : 'noncomment-text' : 'text-occurrence-not-language-classified' });
  }
}
const todoAudit = {
  ...base,
  scope: 'All tracked UTF-8-readable non-NUL files under code/.github/tests; exact uppercase TODO/FIXME word matches; no source lines or message text are stored.',
  issue_rule: 'Issue references are GitHub #number, /issues/number or /pull/number links, and uppercase project-number IDs on the same line; remote existence is not verified.',
  summary: {
    tracked_files_in_scope: tracked.size,
    scanned_text_files: scannedText.length,
    skipped_binary_files: skippedBinary.length,
    skipped_missing_files: skippedMissing.length,
    marker_occurrences: markers.length,
    comment_marker_occurrences: markers.filter((marker) => marker.syntactic_context === 'typescript-or-javascript-comment').length,
    occurrences_with_issue_on_same_line: markers.filter((marker) => marker.has_issue_on_same_line).length,
    occurrences_without_issue_on_same_line: markers.filter((marker) => !marker.has_issue_on_same_line).length,
  },
  markers,
  skipped_binary_files: skippedBinary,
  skipped_missing_files: skippedMissing,
  file_manifest: scannedText,
  limitations: [
    'Absence of TODO/FIXME is not evidence that all incomplete features are documented.',
    'Issue references on adjacent lines or in linked documents are not associated automatically.',
    'Only tracked files are included in this TODO/FIXME audit; new untracked source files are included only in the separate module graph.',
    'TypeScript scanner comment classification is lexical; non-TypeScript/JavaScript occurrences are reported as text matches.',
    'Issue existence, ownership, priority and completion status are not queried.',
  ],
};
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'module-audit.json'), JSON.stringify(audit, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'todo-audit.json'), JSON.stringify(todoAudit, null, 2) + '\n');
console.log(JSON.stringify({
  head: base.git_head,
  typescript: ts.version,
  source_files: sourceFiles.length,
  references: audit.reference_counts,
  graph_cycles: Object.fromEntries(Object.entries(graphs).map(([key, value]) => [key, { components: value.cycle_component_count, modules: value.cyclic_module_count }])),
  unresolved_local: audit.unresolved_local_dependencies.length,
  expected_generated_declarations: audit.not_applicable_generated_declarations.length,
  nonliteral_dependencies: dynamicUnknown.length,
  parse_diagnostics: syntaxDiagnostics.length,
  snapshot_stable: audit.snapshot_stable_during_audit,
  todo: todoAudit.summary,
}, null, 2));
