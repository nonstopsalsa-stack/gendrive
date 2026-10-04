// tests/test_tag_bar_v1924.js
// Verification suite for Tag Bar Refactoring & Bug Fixes

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failCount++;
  }
}

console.log('=== Test Suite: Tag Bar Refactoring & Bug Fixes ===\n');

// 1. Static File Content Verification (Encoding / Mojibake / Closing Tag Check)
console.log('1. Static Code & Mojibake Check:');
const appJsPath = path.resolve(__dirname, '../app.js');
const modalServiceJsPath = path.resolve(__dirname, '../js/components/modalService.js');

const appJsContent = fs.readFileSync(appJsPath, 'utf8');
const modalJsContent = fs.readFileSync(modalServiceJsPath, 'utf8');

// Check no '笨' exists in app.js
assert(!appJsContent.includes('笨'), 'app.js does not contain garbled character "笨"');

// Check renderSmartTagBar icon strings
assert(appJsContent.includes('icon = \'<span class="chip-state-icon">✓</span>\';'), 'app.js has correctly closed checkmark icon for include state');
assert(appJsContent.includes('icon = \'<span class="chip-state-icon">🚫</span>\';'), 'app.js has standard 🚫 emoji icon for exclude state');

// Check renderSmartTagBar tooltip hints
assert(appJsContent.includes("hint = '左クリック: 非表示 / 右クリック: 削除・名前変更';"), 'Default hint guides to "非表示"');
assert(appJsContent.includes("hint = '左クリック: それのみ表示 / 右クリック: 削除・名前変更';"), 'Exclude hint guides to "それのみ表示"');
assert(appJsContent.includes("hint = '左クリック: 解除 / 右クリック: 削除・名前変更';"), 'Include hint guides to "解除"');

// Check renderTagSuggestions checkmark
assert(appJsContent.includes("${isSelected ? '✓ ' : '+ '}#${name}"), 'renderTagSuggestions uses "✓ " for selected chips');

// Check modalService.js explanation text
assert(modalJsContent.includes('1回目: 🚫 非表示（赤）'), 'modalService.js guide has 1回目: 🚫 非表示（赤）');
assert(modalJsContent.includes('2回目: ✓ それのみ表示（青）'), 'modalService.js guide has 2回目: ✓ それのみ表示（青）');
assert(modalJsContent.includes('3回目: ⚪ 解除（指定なし）'), 'modalService.js guide has 3回目: ⚪ 解除（指定なし）');

// 2. Syntax & Functional Execution Test for toggleTagFilter
console.log('\n2. Functional Logic Test (toggleTagFilter Transition Cycle):');

// Minimal mock environment
const context = {
  console,
  state: {
    filters: {
      includeTags: [],
      excludeTags: []
    }
  },
  renderApp: () => {
    // mock renderApp
  }
};

// Extract toggleTagFilter function definition from app.js
const toggleFuncMatch = appJsContent.match(/function toggleTagFilter\(tag\) \{[\s\S]*?\n\}/);
if (!toggleFuncMatch) {
  assert(false, 'Failed to extract toggleTagFilter from app.js');
} else {
  vm.createContext(context);
  vm.runInContext(toggleFuncMatch[0], context);

  // Initial State: neither included nor excluded
  assert(context.state.filters.includeTags.length === 0 && context.state.filters.excludeTags.length === 0, 'Initial state: empty filters');

  // Step 1: 1st click on 'urgent' -> Should EXCLUDE (非表示 / 赤)
  context.toggleTagFilter('urgent');
  assert(context.state.filters.excludeTags.includes('urgent') && !context.state.filters.includeTags.includes('urgent'),
    '1st Click: "urgent" is moved to excludeTags (非表示)');

  // Step 2: 2nd click on 'urgent' -> Should INCLUDE (それのみ表示 / 青)
  context.toggleTagFilter('urgent');
  assert(!context.state.filters.excludeTags.includes('urgent') && context.state.filters.includeTags.includes('urgent'),
    '2nd Click: "urgent" is moved from excludeTags to includeTags (それのみ表示)');

  // Step 3: 3rd click on 'urgent' -> Should RESET (解除 / 未選択)
  context.toggleTagFilter('urgent');
  assert(!context.state.filters.excludeTags.includes('urgent') && !context.state.filters.includeTags.includes('urgent'),
    '3rd Click: "urgent" is removed from all tag filters (解除)');

  // Step 4: Test with hashtag prefix '#work'
  context.toggleTagFilter('#work');
  assert(context.state.filters.excludeTags.includes('work'), '1st Click with hashtag "#work": normalized to "work" in excludeTags');
  context.toggleTagFilter('#work');
  assert(context.state.filters.includeTags.includes('work'), '2nd Click with hashtag "#work": switched to includeTags');
  context.toggleTagFilter('#work');
  assert(!context.state.filters.includeTags.includes('work') && !context.state.filters.excludeTags.includes('work'), '3rd Click with hashtag "#work": reset');
}

// 3. Syntax Verification for modified files
console.log('\n3. Syntax Validation:');
try {
  new vm.Script(appJsContent);
  assert(true, 'app.js syntax is 100% valid (No syntax errors)');
} catch (e) {
  assert(false, `app.js syntax error: ${e.message}`);
}

try {
  new vm.Script(modalJsContent);
  assert(true, 'modalService.js syntax is 100% valid (No syntax errors)');
} catch (e) {
  assert(false, `modalService.js syntax error: ${e.message}`);
}

console.log(`\n===================================`);
console.log(`Test Results: ${passCount} Passed, ${failCount} Failed`);
console.log(`===================================`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
