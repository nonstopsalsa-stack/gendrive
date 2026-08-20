/**
 * Gendrive - Master Table View & Multi-Key Sorting Engine
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Multi-Column & Multi-Key Sorting Engine
// =========================================================================

function sortHabits(habits, sortKey, sortOrder = 'asc') {
  const list = [...habits];
  const mult = sortOrder === 'asc' ? 1 : -1;

  const getTimeVal = (h) => {
    if (h.displayType === 'anytime') return 99;
    if (h.displayType === 'custom' && h.customStart) {
      const [hh, mm] = h.customStart.split(':').map(Number);
      return hh + mm / 60;
    }
    const s = SECTIONS_CONFIG.find(sec => sec.name === h.section);
    return s ? s.start : 50;
  };

  const getCreatedTime = (h) => {
    if (!h.createdAt) return 0;
    return new Date(h.createdAt).getTime() || 0;
  };

  list.sort((a, b) => {
    // 0. Creation Date Sorts
    if (sortKey === 'created_desc') {
      return (getCreatedTime(b) - getCreatedTime(a)) * mult;
    }
    if (sortKey === 'created_asc' || sortKey === 'created') {
      return (getCreatedTime(a) - getCreatedTime(b)) * mult;
    }

    // 1. Default: 1st=Domain, 2nd=Proj, 3rd=Dept, 4th=Time, 5th=CreatedAt
    if (sortKey === 'default') {
      const domA = (a.domainMajor || '') + (a.domain || '');
      const domB = (b.domainMajor || '') + (b.domain || '');
      const domCmp = domA.localeCompare(domB, 'ja');
      if (domCmp !== 0) return domCmp * mult;

      const projA = (a.projMajor || '') + (a.proj || '');
      const projB = (b.projMajor || '') + (b.proj || '');
      const projCmp = projA.localeCompare(projB, 'ja');
      if (projCmp !== 0) return projCmp * mult;

      const deptA = (a.deptMajor || '') + (a.dept || '');
      const deptB = (b.deptMajor || '') + (b.dept || '');
      const deptCmp = deptA.localeCompare(deptB, 'ja');
      if (deptCmp !== 0) return deptCmp * mult;

      const timeCmp = getTimeVal(a) - getTimeVal(b);
      if (timeCmp !== 0) return timeCmp * mult;

      return (getCreatedTime(a) - getCreatedTime(b)) * mult;
    }

    // 2. Domain Sort
    if (sortKey === 'domain') {
      const domA = (a.domainMajor || '') + (a.domain || '');
      const domB = (b.domainMajor || '') + (b.domain || '');
      const domCmp = domA.localeCompare(domB, 'ja');
      if (domCmp !== 0) return domCmp * mult;
      return (getTimeVal(a) - getTimeVal(b)) * mult;
    }

    // 3. Project Sort
    if (sortKey === 'proj') {
      const projA = (a.projMajor || '') + (a.proj || '');
      const projB = (b.projMajor || '') + (b.proj || '');
      const projCmp = projA.localeCompare(projB, 'ja');
      if (projCmp !== 0) return projCmp * mult;
      return (getTimeVal(a) - getTimeVal(b)) * mult;
    }

    // 4. Dept Sort
    if (sortKey === 'dept') {
      const deptA = (a.deptMajor || '') + (a.dept || '');
      const deptB = (b.deptMajor || '') + (b.dept || '');
      const deptCmp = deptA.localeCompare(deptB, 'ja');
      if (deptCmp !== 0) return deptCmp * mult;
      return (getTimeVal(a) - getTimeVal(b)) * mult;
    }

    // 5. Start Time Sort
    if (sortKey === 'time') {
      return (getTimeVal(a) - getTimeVal(b)) * mult;
    }

    // 6. Name Sort
    if (sortKey === 'name') {
      return a.name.localeCompare(b.name, 'ja') * mult;
    }

    // 7. Rate 7d Sort
    if (sortKey === 'rate7') {
      return (getHabitRate(a, 7) - getHabitRate(b, 7)) * mult;
    }

    // 8. Rate 30d Sort
    if (sortKey === 'rate30') {
      return (getHabitRate(a, 30) - getHabitRate(b, 30)) * mult;
    }

    return (getCreatedTime(a) - getCreatedTime(b)) * mult;
  });

  return list;
}

function selectTableRow(index) {
  state.selectedIndex = index;
  renderApp();
}

// =========================================================================
// 2. Render Table View (Master Management View)
// =========================================================================

function getSingleTaskDateBadge(task) {
  const isCompleted = task.status === 'completed';
  const todayKey = typeof getTodayKey === 'function' ? getTodayKey() : new Date().toISOString().split('T')[0];
  let dateKey = task.scheduledDate;

  if (isCompleted) {
    if (Array.isArray(task.executionLogs) && task.executionLogs[0]?.dateKey) {
      dateKey = task.executionLogs[0].dateKey;
    } else if (Array.isArray(task.history) && task.history[task.history.length - 1]?.date) {
      dateKey = task.history[task.history.length - 1].date;
    } else if (task.completedAt) {
      dateKey = task.completedAt.split('T')[0];
    } else if (!dateKey && task.createdAt) {
      dateKey = task.createdAt.split('T')[0];
    }
  }

  if (!dateKey) {
    return `<span class="col-date-badge nodate">📅 日付未定</span>`;
  }

  const parts = dateKey.split('-');
  const shortDate = parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateKey;

  if (isCompleted) {
    return `<span class="col-date-badge completed-date" title="完了日: ${dateKey}">✓ ${shortDate}</span>`;
  } else if (dateKey === todayKey) {
    return `<span class="col-date-badge today-date" title="本日予定: ${dateKey}">⚡ 今日</span>`;
  } else if (dateKey > todayKey) {
    return `<span class="col-date-badge future-date" title="実行予定日: ${dateKey}">📅 ${shortDate}</span>`;
  } else {
    return `<span class="col-date-badge today-date" title="予定日: ${dateKey}">⏳ ${shortDate}</span>`;
  }
}

function sortSingleTasks(tasks) {
  const getTaskDateInfo = (t) => {
    const isCompleted = t.status === 'completed';
    let dateKey = t.scheduledDate;

    if (isCompleted) {
      if (Array.isArray(t.executionLogs) && t.executionLogs[0]?.dateKey) {
        dateKey = t.executionLogs[0].dateKey;
      } else if (Array.isArray(t.history) && t.history[t.history.length - 1]?.date) {
        dateKey = t.history[t.history.length - 1].date;
      } else if (t.completedAt) {
        dateKey = t.completedAt.split('T')[0];
      } else if (!dateKey && t.createdAt) {
        dateKey = t.createdAt.split('T')[0];
      }
    }

    dateKey = dateKey || (isCompleted ? '1970-01-01' : '9999-12-31');
    return { dateKey, isCompleted };
  };

  return [...tasks].sort((a, b) => {
    const infoA = getTaskDateInfo(a);
    const infoB = getTaskDateInfo(b);

    // 1. 日付降順 (未来 ➔ 今日 ➔ 過去)
    const cmp = infoB.dateKey.localeCompare(infoA.dateKey);
    if (cmp !== 0) return cmp;

    // 2. 同一日付内: 未完了が上、完了が下
    if (infoA.isCompleted !== infoB.isCompleted) {
      return infoA.isCompleted ? 1 : -1;
    }

    // 3. 作成日時降順
    return (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0));
  });
}

function renderTableView() {
  const habitsView = document.getElementById('master-habits-view');
  const tasksView = document.getElementById('master-tasks-view');
  const singleTasksView = document.getElementById('master-single-tasks-view');

  const subtabHabits = document.getElementById('subtab-habits');
  const subtabTasks = document.getElementById('subtab-tasks');
  const subtabSingleTasks = document.getElementById('subtab-single-tasks');

  // Always ensure all stats and tiers are freshly computed
  state.habits.forEach(recalculateHabitRates);

  // Normalize subtab value
  const curSubtab = state.masterSubtab || 'habits';

  // Toggle subviews
  if (habitsView) habitsView.classList.toggle('hidden', curSubtab !== 'habits');
  if (tasksView) tasksView.classList.toggle('hidden', curSubtab !== 'tasks' && curSubtab !== 'recurring_tasks');
  if (singleTasksView) singleTasksView.classList.toggle('hidden', curSubtab !== 'single_tasks');

  // Toggle subtab buttons
  if (subtabHabits) subtabHabits.classList.toggle('active', curSubtab === 'habits');
  if (subtabTasks) subtabTasks.classList.toggle('active', curSubtab === 'tasks' || curSubtab === 'recurring_tasks');
  if (subtabSingleTasks) subtabSingleTasks.classList.toggle('active', curSubtab === 'single_tasks');

  // 1. Habits Master Table
  if (curSubtab === 'habits') {
    const container = document.getElementById('habit-table-body');
    const filtered = getFilteredHabits('table');
    const sorted = sortHabits(filtered, state.tableSort.key, state.tableSort.order);

    document.getElementById('table-total-count').textContent = `${sorted.length} 件（全件）`;

    if (sorted.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>該当するハビットがありません</p></div>`;
      return;
    }

    container.innerHTML = sorted.map((habit, index) => {
      let timingStr = '🌐 終日';
      if (habit.displayType === 'section') {
        timingStr = habit.section ? `⏱️ ${habit.section}` : '未定';
      } else if (habit.displayType === 'custom') {
        timingStr = `⏰ ${habit.customStart || '--'}~${habit.customEnd || '--'}`;
      }

      return `
        <div class="habit-row-compact" data-id="${habit.id}" onclick="openEditModal('${habit.id}')" title="${habit.name} - クリックして編集">
          <div class="row-num">${index + 1}</div>
          <div class="row-name"><span>${habit.name}</span></div>
          <div>${habit.domain ? `<span class="row-tag domain">${habit.domain}</span>` : '<span class="row-tag none">-</span>'}</div>
          <div>${habit.proj ? `<span class="row-tag proj">${habit.proj}</span>` : '<span class="row-tag none">-</span>'}</div>
          <div>${habit.dept ? `<span class="row-tag dept">${habit.dept}</span>` : '<span class="row-tag none">-</span>'}</div>
          <div>${getRecurrenceBadgeHtml(habit)}</div>
          <div class="row-timing">${timingStr}</div>
          <div class="row-min">${habit.targetMin}分</div>
          <div class="row-load">🐸${habit.frogLevel}/🧠${habit.mentalLoad}</div>
          <div class="row-stats-grid">
            <span class="rate-badge ${getRateClass(getHabitRate(habit, 3))}">${getHabitRate(habit, 3)}%</span>
            <span class="rate-badge ${getRateClass(getHabitRate(habit, 7))}">${getHabitRate(habit, 7)}%</span>
            <span class="rate-badge ${getRateClass(getHabitRate(habit, 30))}">${getHabitRate(habit, 30)}%</span>
            <span class="rate-badge ${getRateClass(getHabitRate(habit, 90))}">${getHabitRate(habit, 90)}%</span>
          </div>
        </div>
      `;
    }).join('');

  } else if (curSubtab === 'tasks' || curSubtab === 'recurring_tasks') {
    // 2. Recurring Tasks Master Table
    const container = document.getElementById('recurring-task-table-body');
    const recurringTasks = state.tasks.filter(t => t.type === 'recurring');
    document.getElementById('table-recurring-tasks-count').textContent = `${recurringTasks.length} 件`;

    if (recurringTasks.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>登録されている定期タスクはありません。「➕ 定期タスク登録」から作成できます。</p></div>`;
      return;
    }

    container.innerHTML = recurringTasks.map((task, index) => {
      const labelBadge = getEisenhowerLabelBadge(task.label);
      return `
        <div class="task-row-compact" data-id="${task.id}" onclick="openEditTaskModal('${task.id}')" title="${task.title} - クリックして編集">
          <div class="row-num">${index + 1}</div>
          <div class="row-name"><span>${task.title}</span></div>
          <div>${labelBadge ? `<span class="badge-eisenhower ${labelBadge.cls}">${labelBadge.text}</span>` : '-'}</div>
          <div><span class="row-tag domain">${task.domainMinor || task.domainMajor || '-'}</span></div>
          <div>${getRecurrenceBadgeHtml(task)}</div>
          <div class="row-timing">⏱️ ${task.section || '終日'}</div>
          <div class="row-min">${task.estMin || 15}分</div>
          <div class="row-load">🐸${task.frog || 3}</div>
        </div>
      `;
    }).join('');

  } else if (curSubtab === 'single_tasks') {
    // 3. Single Tasks Master Table
    const container = document.getElementById('single-task-table-body');
    const singleTasks = state.tasks.filter(t => t.type !== 'recurring');
    const countBadge = document.getElementById('table-single-tasks-count');
    if (countBadge) countBadge.textContent = `${singleTasks.length} 件`;

    if (singleTasks.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>登録されている単発タスクはありません。「➕ 単発タスク登録」から作成できます。</p></div>`;
      return;
    }

    const sortedTasks = sortSingleTasks(singleTasks);

    container.innerHTML = sortedTasks.map((task, index) => {
      const isCompleted = task.status === 'completed';
      const labelBadge = getEisenhowerLabelBadge(task.label);
      const dateBadgeHtml = getSingleTaskDateBadge(task);

      let statusHtml = '<span style="color: var(--text-dim);">⏳ 待機</span>';
      if (task.status === 'in_progress') {
        statusHtml = '<span style="color: #38bdf8; font-weight: 700;">● 実行中</span>';
      } else if (task.status === 'paused') {
        statusHtml = '<span style="color: #f59e0b; font-weight: 700;">⏸️ 中断</span>';
      } else if (isCompleted) {
        statusHtml = '<span style="color: #34d399; font-weight: 700;">✓ 完了</span>';
      } else if (task.status === 'skipped') {
        statusHtml = '<span style="color: var(--text-dim); text-decoration: line-through;">スキップ</span>';
      }

      const durationDisplay = isCompleted
        ? `<span style="color: #34d399; font-weight: 700;">${task.actMin || task.estMin || 15}分</span> <span style="font-size: 10.5px; color: var(--text-dim);">/ 予:${task.estMin || 15}m</span>`
        : `<span>${task.estMin || 15}分</span>`;

      return `
        <div class="single-task-row-compact ${isCompleted ? 'is-completed' : ''}" 
             data-id="${task.id}" 
             onclick="openEditTaskModal('${task.id}')" 
             title="${task.title} - クリックして編集">
          <div>${dateBadgeHtml}</div>
          <div class="row-num">${index + 1}</div>
          <div class="row-name"><span>${task.title}</span></div>
          <div>${labelBadge ? `<span class="badge-eisenhower ${labelBadge.cls}">${labelBadge.text}</span>` : '<span style="color: var(--text-dim);">-</span>'}</div>
          <div><span class="row-tag domain">${task.domainMinor || task.domainMajor || '-'}</span></div>
          <div class="row-timing">⏱️ ${task.section || (task.timingType === 'anytime' ? '終日' : '未定')}</div>
          <div class="row-min">${durationDisplay}</div>
          <div>${statusHtml}</div>
        </div>
      `;
    }).join('');

    // Auto-scroll to show the latest completed row at the bottom of the visible viewport
    setTimeout(() => {
      const wrapper = document.getElementById('single-task-table-wrapper');
      if (!wrapper) return;
      
      const latestCompletedRow = wrapper.querySelector('.single-task-row-compact.is-completed');
      if (latestCompletedRow) {
        const rowTop = latestCompletedRow.offsetTop;
        const rowHeight = latestCompletedRow.offsetHeight || 40;
        const wrapperHeight = wrapper.clientHeight;
        const targetScrollTop = Math.max(0, rowTop + rowHeight - wrapperHeight + 10);
        wrapper.scrollTop = targetScrollTop;
      }
    }, 40);
  }
}

