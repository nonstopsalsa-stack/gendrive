/**
 * Mojibake Guard Test Suite (tests/test_mojibake_guard.js)
 * 
 * Verifies that:
 * 1. No double-encoded CP932/UTF-8 mojibake patterns exist in any .js, .css, .html files.
 * 2. No corrupted template literals without $ exist (e.g. {task.title}, {item.id}).
 */

const fs = require('fs');
const path = require('path');

// 二重エンコード文字（CP932解釈文字群および代表的な化け文字）
const MOJIBAKE_REGEX = /[縺繧譌蜿驕螳笞邂縲遘蜍縹縸縴縵繝蟶骭雜襍隴蜻遲譏謖驛驥蝨蝗蛻竢筐竍]|[\uFF61-\uFF9F]/;

// $ を伴わないテンプレート変数破壊パターン（例: {task.title}, {item.name}, {deletedTask.title}）
const CORRUPTED_TEMPLATE_REGEX = /(?<!\$)\{(?:task|item|newTask|deletedTask|newHabit|habit|log)\.[a-zA-Z0-9_]+\}/;

// 除外対象
const EXCLUDED_PATHS = [
  'tests/test_banner_utf8_runner.js',
  'tests/test_mojibake_guard.js',
  '.git',
  'node_modules',
  'scratch'
];

function scanFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (EXCLUDED_PATHS.some(ex => item === ex)) continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanFiles(fullPath, fileList);
    } else {
      const ext = path.extname(item).toLowerCase();
      if (['.js', '.css', '.html'].includes(ext)) {
        const norm = fullPath.replace(/\\/g, '/');
        if (!EXCLUDED_PATHS.some(ex => norm.includes(ex))) {
          fileList.push(fullPath);
        }
      }
    }
  }
  return fileList;
}

function runGuardCheck(rootDir = '.') {
  const files = scanFiles(rootDir);
  let totalErrors = 0;
  const failureDetails = [];

  for (const file of files) {
    const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const hasMojibake = MOJIBAKE_REGEX.test(line);
      const hasCorruptTemplate = CORRUPTED_TEMPLATE_REGEX.test(line);

      if (hasMojibake || hasCorruptTemplate) {
        totalErrors++;
        failureDetails.push({
          file: relPath,
          lineNum,
          line: line.trim(),
          hasMojibake,
          hasCorruptTemplate
        });
      }
    });
  }

  return {
    totalFiles: files.length,
    totalErrors,
    failureDetails
  };
}

if (require.main === module) {
  const targetDir = process.argv[2] || '.';
  console.log(`[Mojibake Guard] Scanning target: ${targetDir}`);
  const result = runGuardCheck(targetDir);
  console.log(`[Mojibake Guard] Scanned ${result.totalFiles} files.`);

  if (result.totalErrors === 0) {
    console.log(`[Mojibake Guard] [PASS] Clean! 0 mojibake or corrupt templates detected.`);
    process.exit(0);
  } else {
    console.error(`[Mojibake Guard] [FAIL] Found ${result.totalErrors} violation(s):`);
    result.failureDetails.forEach(d => {
      const type = [
        d.hasMojibake ? 'MOJIBAKE' : null,
        d.hasCorruptTemplate ? 'CORRUPT_TEMPLATE' : null
      ].filter(Boolean).join(' & ');
      console.error(`  - ${d.file}:${d.lineNum} [${type}]: ${d.line.slice(0, 100)}`);
    });
    process.exit(1);
  }
}

module.exports = {
  runGuardCheck,
  MOJIBAKE_REGEX,
  CORRUPTED_TEMPLATE_REGEX
};
