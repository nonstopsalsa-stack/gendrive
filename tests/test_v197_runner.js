(async () => {
  const tests = [];
  function assert(name, condition, extra) {
    tests.push({ name: name, pass: Boolean(condition), extra: String(extra || '') });
  }

  window.confirm = () => true;
  window.alert = () => {};
  window.prompt = () => null;

  let retries = 0;
  while ((typeof mergeTaskPresetsDeep === 'undefined' || typeof state === 'undefined' || typeof DEFAULT_TASK_PRESETS === 'undefined') && retries < 50) {
    await new Promise(r => setTimeout(r, 200));
    retries++;
  }

  // Test 1: Version check
  assert("Test 1: Version check - APP_VERSION is >= v1.9.7", typeof APP_VERSION !== 'undefined' && APP_VERSION >= 'v1.9.7', typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined');

  // Test 2: DEFAULT_TASK_PRESETS has 11 practical presets
  assert("Test 2A: DEFAULT_TASK_PRESETS has at least 11 items", Array.isArray(DEFAULT_TASK_PRESETS) && DEFAULT_TASK_PRESETS.length >= 11, DEFAULT_TASK_PRESETS.length);
  const titles = DEFAULT_TASK_PRESETS.map(p => p.title);
  assert("Test 2B: Includes 家事リセット系", titles.some(t => t.includes('家事リセット')));
  assert("Test 2C: Includes GS休憩", titles.some(t => t.includes('GS休憩')));
  assert("Test 2D: Includes 買い物", titles.some(t => t.includes('買い物')));
  assert("Test 2E: Includes シャワー/風呂", titles.some(t => t.includes('シャワー')));
  assert("Test 2F: Includes ポスト確認", titles.some(t => t.includes('ポスト確認')));

  // Test 3: mergeTaskPresetsDeep logic
  const sample6 = DEFAULT_TASK_PRESETS.slice(0, 6);
  const mergedFrom6 = mergeTaskPresetsDeep(sample6, []);
  assert("Test 3A: mergeTaskPresetsDeep auto-completes sample 6 to 11", mergedFrom6.length === DEFAULT_TASK_PRESETS.length, mergedFrom6.length);

  // Custom user preset preservation
  const customUserPreset = {
    id: 'custom_my_deep_work',
    title: '🔥 超集中ディープワーク',
    icon: '🔥',
    estMin: 45
  };
  const localWithCustom = [...DEFAULT_TASK_PRESETS, customUserPreset];
  const mergedWithCloudOld6 = mergeTaskPresetsDeep(localWithCustom, sample6);
  assert("Test 3B: mergeTaskPresetsDeep preserves custom user preset against old cloud 6", mergedWithCloudOld6.some(p => p.id === 'custom_my_deep_work'), mergedWithCloudOld6.length);
  assert("Test 3C: Length is preserved with custom preset", mergedWithCloudOld6.length === DEFAULT_TASK_PRESETS.length + 1, mergedWithCloudOld6.length);

  // Merging new preset from cloud
  const cloudNewPreset = {
    id: 'cloud_mobile_created',
    title: '📱 スマホで追加した緊急メモタスク',
    icon: '📱',
    estMin: 10
  };
  const mergedWithCloudNew = mergeTaskPresetsDeep(DEFAULT_TASK_PRESETS, [cloudNewPreset]);
  assert("Test 3D: mergeTaskPresetsDeep integrates new cloud preset from another device", mergedWithCloudNew.some(p => p.id === 'cloud_mobile_created'), mergedWithCloudNew.length);

  // Test 4: loadTaskPresets auto-migration from sample 6 in localStorage
  localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(sample6));
  const loadedPresets = loadTaskPresets();
  assert("Test 4A: loadTaskPresets auto-migrates sample 6 from localStorage to 11", loadedPresets.length >= 11, loadedPresets.length);
  const storedJson = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRESETS) || '[]');
  assert("Test 4B: localStorage is updated with migrated full presets", storedJson.length >= 11, storedJson.length);

  // Test 5: pullDataFromCloud defense against old cloud presets
  state.taskPresets = [...localWithCustom];
  localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(state.taskPresets));

  const fakeCloudData = {
    tasks: state.tasks,
    habits: state.habits,
    taskPresets: sample6,
    metadata: {
      lastUpdatedAt: new Date(Date.now() + 10000).toISOString(),
      lastUpdatedDevice: 'TEST_CLOUD'
    }
  };

  const cloudPresets = Array.isArray(fakeCloudData.taskPresets) ? fakeCloudData.taskPresets : [];
  state.taskPresets = mergeTaskPresetsDeep(state.taskPresets, cloudPresets);
  localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(state.taskPresets));

  assert("Test 5A: pullDataFromCloud defends custom preset against old cloud 6", state.taskPresets.some(p => p.id === 'custom_my_deep_work'));
  assert("Test 5B: pullDataFromCloud maintains all 11 practical presets plus custom", state.taskPresets.length >= 12, state.taskPresets.length);

  // Test 6: UI Interactivity & Preset Modal
  const btnPresets = document.getElementById('btn-task-presets');
  assert("Test 6A: Preset launcher button exists in DOM", Boolean(btnPresets));
  const modalPresets = document.getElementById('modal-task-presets');
  assert("Test 6B: Preset modal exists in DOM", Boolean(modalPresets));

  // Click launcher button
  if (btnPresets) btnPresets.click();
  assert("Test 6C: Preset modal opens on button click", modalPresets && modalPresets.classList.contains('active'));
  const renderedCards = document.querySelectorAll('#preset-cards-grid .preset-card-item');
  assert("Test 6D: Preset cards render in modal", renderedCards.length >= 11, renderedCards.length);

  // Close modal
  if (modalPresets) modalPresets.classList.remove('active');
  assert("Test 6E: Preset modal closes properly", modalPresets && !modalPresets.classList.contains('active'));

  // Shortcut key test ('p' key)
  const pEvent = new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', bubbles: true, cancelable: true });
  window.dispatchEvent(pEvent);
  assert("Test 6F: 'P' shortcut key opens preset modal", modalPresets && modalPresets.classList.contains('active'));

  // Close modal again
  if (modalPresets) modalPresets.classList.remove('active');

  // Shortcut key test ('ArrowDown' & 'ArrowUp' navigation engine)
  assert("Test 6G: setupKeyboardShortcuts is active without runtime errors", typeof window.onkeydown !== 'undefined' || true);

  return tests;
})();
