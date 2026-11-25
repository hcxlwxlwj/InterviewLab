"""Recompute inserted-line counts after extract-lines.cjs, without changing sources."""
import difflib
import hashlib
import json
from pathlib import Path
import subprocess
import sys

work = Path(sys.argv[1])
baseline = json.loads((work / 'baseline.json').read_text(encoding='utf-8'))
root = Path(baseline['root'])
raw = json.loads((work / 'line-coverage.json').read_text(encoding='utf-8'))
result = json.loads((work / 'coverage.json').read_text(encoding='utf-8'))
files = []
for filename, hits in raw.items():
    relative = Path(filename).relative_to(root).as_posix()
    current = (root / relative).read_text(encoding='utf-8').splitlines()
    command = subprocess.run(['git', 'show', f"{baseline['head']}:{relative}"], cwd=root,
                             capture_output=True, text=True, encoding='utf-8')
    head = command.stdout.splitlines() if command.returncode == 0 else []
    snapshot = work / 'task-start' / relative
    task = snapshot.read_text(encoding='utf-8').splitlines() if snapshot.exists() else []
    coverage = {int(line): count for line, count in hits.items()}
    item = {'file': relative, 'sha256': hashlib.sha256((root / relative).read_bytes()).hexdigest()}
    for label, before in [('head', head), ('taskStart', task)]:
        changes = difflib.SequenceMatcher(None, before, current, autojunk=False).get_opcodes()
        inserted = [line + 1 for tag, _, _, start, end in changes
                    if tag in ['insert', 'replace'] for line in range(start, end)]
        mapped = [line for line in inserted if line in coverage]
        covered = [line for line in mapped if coverage[line] > 0]
        item[label] = {'inserted': len(inserted), 'mapped': len(mapped), 'covered': len(covered),
                       'unmapped': [line for line in inserted if line not in coverage],
                       'uncovered': [line for line in mapped if not coverage[line]]}
    files.append(item)
result['files'] = files
for label in ['head', 'taskStart']:
    mapped = sum(item[label]['mapped'] for item in files)
    covered = sum(item[label]['covered'] for item in files)
    result[label].update(inserted=sum(item[label]['inserted'] for item in files),
                         mapped=mapped, covered=covered, percentage=100 * covered / mapped)
(work / 'coverage.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({label: result[label] for label in ['head', 'taskStart']}, indent=2))
