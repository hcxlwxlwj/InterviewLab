import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '../..');
const packages = ['core_engine', 'backend', 'frontend'] as const;
const dependencies: Record<(typeof packages)[number], string[]> = {
  core_engine: [],
  backend: ['@interviewlab/core'],
  frontend: ['@interviewlab/core', '@interviewlab/backend'],
};

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.next'].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

let checked = 0;
for (const name of packages) {
  const directory = resolve(root, 'code', name);
  for (const file of files(resolve(directory, name === 'frontend' ? '.' : 'src'))) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const check = (specifier: string) => {
      const location = relative(root, file).replaceAll('\\', '/');
      const fail = (message: string) => assert.fail(`${location}: ${message} (${specifier})`);
      const publicContent = location.startsWith('code/backend/src/content/');
      if (specifier.startsWith('.')) {
        const target = relative(directory, resolve(dirname(file), specifier)).replaceAll('\\', '/');
        const contentTarget = relative(
          resolve(directory, 'src/content'),
          resolve(dirname(file), specifier),
        ).replaceAll('\\', '/');
        const knowledgeData =
          target.startsWith('../../docs/algorithm/content/') && specifier.endsWith('.json');
        if (publicContent && contentTarget.startsWith('../') && !knowledgeData)
          fail('公开内容入口不可引用后端服务实现');
        if (target.startsWith('../') && !(publicContent && knowledgeData))
          fail('跨包相对引用应使用工作区入口');
      } else if (specifier.startsWith('@interviewlab/')) {
        if (
          !dependencies[name].some(
            (allowed) => specifier === allowed || specifier.startsWith(`${allowed}/`),
          )
        )
          fail('依赖方向不符合职责边界');
        if (
          name === 'frontend' &&
          specifier.startsWith('@interviewlab/backend') &&
          !['@interviewlab/backend/content', '@interviewlab/backend/content/demo'].includes(
            specifier,
          ) &&
          !location.startsWith('code/frontend/app/api/')
        )
          fail('后端实现只能由服务端 API 路由导入');
        if (publicContent && specifier !== '@interviewlab/core') fail('公开内容入口只依赖领域核心');
      } else if (name === 'core_engine' || publicContent) {
        fail('领域核心与公开内容不可依赖框架、Node 或外部包');
      }
      if (name === 'core_engine' && /\.(json|css)$/.test(specifier))
        fail('领域核心不可读取内容或界面资源');
    };
    const visit = (node: ts.Node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        check(node.moduleSpecifier.text);
      if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      )
        check(node.argument.literal.text);
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      ) {
        const argument = node.arguments[0];
        assert.ok(
          argument && ts.isStringLiteral(argument),
          `${file}: 动态依赖应使用可校验的字面量路径`,
        );
        check(argument.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    checked++;
  }
}
console.log(`依赖边界检查通过：${checked} 个 TypeScript 文件`);
