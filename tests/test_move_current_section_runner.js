(() => {
  const results = [];
  const assert = (name, cond, detail = '') => {
    results.push({ name, pass: Boolean(cond), detail });
  };

  try {
    // 1. UI Check: Button existence and position in task context menu
    const btn = document.getElementById('ctx-task-move-current-section');
    assert('Button exists in DOM (#ctx-task-move-current-section)', Boolean(btn));
    
    const tomorrowBtn = document.getElementById('ctx-task-defer-tomorrow');
    assert('Tomorrow button exists (#ctx-task-defer-tomorrow)', Boolean(tomorrowBtn));
    assert('Button is immediately before tomorrow button', btn && tomorrowBtn && btn.nextElementSibling === tomorrowBtn);
    assert('Button contains icon ⚡', btn && btn.innerHTML.includes('⚡'));
    assert('Button default label', btn && btn.textContent.includes('今日の現在のセクションに移動'));

    // 2. Function existence
    assert('moveTaskToCurrentSection is a function', typeof moveTaskToCurrentSection === 'function');

    // 3. Setup test tasks
    const todayKey = typeof getTodayKey === 'function' ? getTodayKey() : new Date().toISOString().split('T')[0];
    const curSec = typeof detectCurrentSection === 'function' ? detectCurrentSection() : '第1セッション';
    const diffSec = curSec === '第1セッション' ? '第2セッション' : '第1セッション';

    const testTask1 = {
      id: 'test-diff-sec-1',
      title: 'Task in Other Section',
      scheduledDate: todayKey,
      bucket: 'today',
      section: diffSec,
      timingType: 'section',
      status: 'uncompleted'
    };

    const testTask2 = {
      id: 'test-skipped-inbox-2',
      title: 'Task Skipped in Inbox',
      scheduledDate: '2026-10-15',
      bucket: 'inbox',
      section: diffSec,
      timingType: 'anytime',
      status: 'skipped',
      skippedDateKey: todayKey,
      skippedDates: [todayKey]
    };

    const testTaskAlreadyCurrent = {
      id: 'test-already-cur-3',
      title: 'Task Already Current Section',
      scheduledDate: todayKey,
      bucket: 'today',
      section: curSec,
      timingType: 'section',
      status: 'uncompleted'
    };

    state.tasks = state.tasks || [];
    state.tasks.push(testTask1, testTask2, testTaskAlreadyCurrent);

    // 4. Test showTaskContextMenu visibility & dynamic label
    const fakeEvent = { preventDefault: () => {}, clientX: 100, clientY: 100 };
    
    // For testTask1 (in different section) -> should be displayed
    showTaskContextMenu(fakeEvent, testTask1.id);
    assert('Move button displayed for task in different section', btn.style.display !== 'none');
    assert('Dynamic label includes current section name', btn.textContent.includes(curSec), `Expected label with "${curSec}", got "${btn.textContent}"`);

    // For testTaskAlreadyCurrent (in current section, today, timingType===section) -> should be hidden
    showTaskContextMenu(fakeEvent, testTaskAlreadyCurrent.id);
    assert('Move button hidden for task already in current section', btn.style.display === 'none');

    // 5. Test moveTaskToCurrentSection execution on testTask2
    moveTaskToCurrentSection(testTask2.id);
    const updated = state.tasks.find(t => String(t.id) === String(testTask2.id));
    assert('Task scheduledDate updated to today', updated && updated.scheduledDate === todayKey, `Got ${updated?.scheduledDate}`);
    assert('Task bucket updated to today', updated && updated.bucket === 'today', `Got ${updated?.bucket}`);
    assert('Task section updated to current section', updated && updated.section === curSec, `Got ${updated?.section}`);
    assert('Task timingType updated to section', updated && updated.timingType === 'section', `Got ${updated?.timingType}`);
    assert('Task status restored to uncompleted', updated && updated.status === 'uncompleted', `Got ${updated?.status}`);
    assert('Task skippedDates cleaned', updated && (!updated.skippedDates || !updated.skippedDates.includes(todayKey)));

    // 6. Verify task placed at section end
    const curSecTasks = state.tasks.filter(t => t.scheduledDate === todayKey && t.section === curSec && t.bucket !== 'inbox');
    const lastTask = curSecTasks[curSecTasks.length - 1];
    assert('Task placed at end of current section', lastTask && lastTask.id === testTask2.id);

    // 7. Verify Undo functionality
    const toastEl = document.getElementById('undo-toast') || document.querySelector('.undo-toast');
    assert('Toast notification exists or was triggered', Boolean(toastEl));

    // Execute Undo
    if (typeof executeUndo === 'function') {
      executeUndo();
      const reverted = state.tasks.find(t => String(t.id) === String(testTask2.id));
      assert('Undo: scheduledDate reverted', reverted && reverted.scheduledDate === '2026-10-15', `Got ${reverted?.scheduledDate}`);
      assert('Undo: bucket reverted', reverted && reverted.bucket === 'inbox', `Got ${reverted?.bucket}`);
      assert('Undo: section reverted', reverted && reverted.section === diffSec, `Got ${reverted?.section}`);
      assert('Undo: status reverted to skipped', reverted && reverted.status === 'skipped', `Got ${reverted?.status}`);
      assert('Undo: skippedDates reverted', reverted && reverted.skippedDates && reverted.skippedDates.includes(todayKey));
    }

    // Cleanup test tasks
    state.tasks = state.tasks.filter(t => !['test-diff-sec-1', 'test-skipped-inbox-2', 'test-already-cur-3'].includes(t.id));

  } catch (err) {
    assert('Unexpected error during test execution', false, err.message + '\n' + err.stack);
  }

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  return JSON.stringify({
    total: results.length,
    passed,
    failed,
    results
  });
})();
