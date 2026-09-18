/**
 * Gendrive - Task Clone & Recurring Deduplication Helper
 * 哲生 (AI Company OS & Personal OS Engine)
 * 
 * 責務:
 * 1. 定期タスク完了時の「完了済み単発タスク」クローン自動生成
 * 2. 定期タスク未完了戻し（Undo / トグル / ログ削除）時の連動削除
 * 3. デイリー集計・ダッシュボード・将来の分析機能における二重カウント防止判定
 */

// 1. 定期タスク判定
function isRecurringTaskItem(t) {
  if (!t) return false;
  return t.taskType === 'recurring' || t.type === 'recurring' || Boolean(t.recType) || (Boolean(t.recurrence) && t.recurrence.type && t.recurrence.type !== 'none');
}

// 2. 純粋な単発タスク判定（定期由来のクローンインスタンスを除く）
function isPureSingleTask(t) {
  if (!t) return false;
  return !isRecurringTaskItem(t) && !t.isRecurringInstance;
}

// 3. 定期タスク由来のクローンインスタンス判定
function isRecurringInstanceTask(t) {
  if (!t) return false;
  return !isRecurringTaskItem(t) && Boolean(t.isRecurringInstance);
}

// 4. クローン単発タスク生成
function createRecurringSingleTaskClone(recurringTask, options = {}) {
  if (!recurringTask) return null;

  const now = options.now || new Date();
  const dateKey = options.dateKey || (typeof getSelectedDateKey === 'function' ? getSelectedDateKey() : now.toISOString().split('T')[0]);
  const completedAt = options.completedAt || now.toISOString();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const actualDurationMin = (options.userDurationMin !== undefined && options.userDurationMin !== null)
    ? Number(options.userDurationMin)
    : (recurringTask.actMin || recurringTask.estMin || 15);

  const cloneId = 'st_rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const logId = options.logId || ('tlog_inst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));

  const noteText = (options.userNote !== undefined && options.userNote !== null && options.userNote.trim() !== '')
    ? options.userNote.trim()
    : (recurringTask.note || recurringTask.memo || '');

  const matrixObj = recurringTask.matrix ? JSON.parse(JSON.stringify(recurringTask.matrix)) : {};

  const cloneTask = {
    id: cloneId,
    title: recurringTask.title || recurringTask.name || '定期タスク実行',
    type: 'single',
    taskType: 'single',
    status: 'completed',
    scheduledDate: dateKey,
    dateKey: dateKey,
    completedAt: completedAt,
    actStart: recurringTask.actStart || null,
    actEnd: recurringTask.actEnd || nowTimeStr,
    actMin: actualDurationMin,
    estMin: recurringTask.estMin || actualDurationMin || 15,
    section: recurringTask.section || '',
    bucket: 'today',
    timingType: recurringTask.timingType || 'section',
    eisenhower: recurringTask.eisenhower || 'q2',
    priority: recurringTask.priority || 'medium',
    label: recurringTask.label || 'none',
    tags: Array.isArray(recurringTask.tags) ? [...recurringTask.tags] : [],
    note: noteText,
    memo: recurringTask.memo || '',
    obsidianNote: recurringTask.obsidianNote || '',

    // ドメイン・部門・プロジェクト（大分類 / 小分類）
    domain: recurringTask.domain || recurringTask.domainMajor || '',
    domainMajor: recurringTask.domainMajor || recurringTask.domain || '',
    domainMinor: recurringTask.domainMinor || recurringTask.domainDetail || '',
    domainDetail: recurringTask.domainDetail || recurringTask.domainMinor || '',
    dept: recurringTask.dept || recurringTask.deptMajor || '',
    deptMajor: recurringTask.deptMajor || recurringTask.dept || '',
    deptMinor: recurringTask.deptMinor || recurringTask.deptDetail || '',
    deptDetail: recurringTask.deptDetail || recurringTask.deptMinor || '',
    proj: recurringTask.proj || recurringTask.projMajor || '',
    projMajor: recurringTask.projMajor || recurringTask.proj || '',
    projMinor: recurringTask.projMinor || recurringTask.projDetail || '',
    projDetail: recurringTask.projDetail || recurringTask.projMinor || '',

    // 6軸マトリクス
    matrix: matrixObj,
    importance: recurringTask.importance || matrixObj.importance || null,
    urgency: recurringTask.urgency || matrixObj.urgency || null,
    cognition: recurringTask.cognition || matrixObj.cognition || null,
    physical: recurringTask.physical || matrixObj.physical || null,
    frog: recurringTask.frog || matrixObj.frog || null,
    spark: recurringTask.spark || matrixObj.spark || null,

    // ★重要識別子: 二重カウント防止 & Undo連動
    isRecurringInstance: true,
    recurringSourceId: String(recurringTask.id),
    recurringLogId: options.logId || null,

    // 単発タスク自身の履歴・実行ログ
    history: [{
      date: dateKey,
      durationMin: actualDurationMin,
      completedAt: completedAt,
      note: noteText
    }],
    executionLogs: [{
      id: logId,
      dateKey: dateKey,
      completedAt: completedAt,
      durationMin: actualDurationMin,
      note: noteText
    }]
  };

  return cloneTask;
}

// 5. 定期タスク由来のクローン単発タスクを配列から削除（Undo連動・未完了戻し連動）
function removeRecurringInstanceSingleTasks(sourceTaskId, dateKey = null, logId = null, taskList = null) {
  const targetList = taskList || (typeof state !== 'undefined' && state.tasks) || [];
  if (!Array.isArray(targetList)) return targetList;

  const targetSourceId = String(sourceTaskId);
  let removedCount = 0;

  for (let i = targetList.length - 1; i >= 0; i--) {
    const t = targetList[i];
    if (!t || !t.isRecurringInstance || String(t.recurringSourceId) !== targetSourceId) {
      continue;
    }

    // ログIDが指定されている場合はログIDで完全一致削除
    if (logId && t.recurringLogId) {
      if (t.recurringLogId === logId) {
        targetList.splice(i, 1);
        removedCount++;
      }
      continue;
    }

    // 日付キーが指定されている場合は当該日のインスタンスを削除
    if (dateKey) {
      const tDate = t.scheduledDate || t.dateKey || (t.completedAt ? t.completedAt.split('T')[0] : null);
      if (tDate === dateKey) {
        targetList.splice(i, 1);
        removedCount++;
      }
      continue;
    }

    // いずれも未指定の場合は全該当インスタンスを削除
    targetList.splice(i, 1);
    removedCount++;
  }

  return targetList;
}

// 6. 将来の分析用共通API: 重複のない完了タスクログの取得
function getDeduplicatedTaskLogs(dateKey = null, tasks = null) {
  const targetTasks = tasks || (typeof state !== 'undefined' && state.tasks) || [];
  const logs = [];

  targetTasks.forEach(t => {
    if (t.isDisabled) return;

    if (isRecurringTaskItem(t)) {
      // 定期タスクは親の executionLogs から集計（クローン単発タスク側は無視）
      if (Array.isArray(t.executionLogs)) {
        t.executionLogs.forEach(l => {
          if (!dateKey || l.dateKey === dateKey) {
            logs.push({
              source: 'recurring_parent',
              taskId: t.id,
              taskTitle: t.title,
              isRecurring: true,
              log: l
            });
          }
        });
      }
    } else if (isPureSingleTask(t)) {
      // 純粋な単発タスクのみを集計（isRecurringInstance は定期タスクログと重複するためここでは集計しない）
      if (t.status === 'completed') {
        const tDate = t.scheduledDate || t.dateKey || (t.completedAt ? t.completedAt.split('T')[0] : null);
        if (!dateKey || tDate === dateKey) {
          logs.push({
            source: 'pure_single',
            taskId: t.id,
            taskTitle: t.title,
            isRecurring: false,
            log: {
              dateKey: tDate,
              durationMin: t.actMin || t.estMin || 15,
              completedAt: t.completedAt || '',
              note: t.note || ''
            }
          });
        }
      }
    }
  });

  return logs;
}
