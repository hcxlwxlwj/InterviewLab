const fs = require('node:fs');
const path = require('node:path');
const work = process.argv[2];
const toolsRoot = process.argv[3];
const { createCoverageMap } = require(path.join(toolsRoot,'c8-tools/node_modules/istanbul-lib-coverage'));
const map = createCoverageMap(JSON.parse(fs.readFileSync(path.join(work,'final-report/coverage-final.json'),'utf8')));
const lines = Object.fromEntries(map.files().map(file=>[file,map.fileCoverageFor(file).getLineCoverage()]));
fs.writeFileSync(path.join(work,'line-coverage.json'),JSON.stringify(lines));
