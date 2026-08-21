/**
 * Gendrive - Google Apps Script (GAS) Cloud Sync Engine & Drive Time-Machine Backup
 * 哲生 (AI Company OS & Personal OS Engine)
 *
 * 【設定手順】
 * 1. Googleドライブで新規「Google スプレッドシート」を作成（名前: 例「Gendrive_Database」）
 * 2. メニュー「拡張機能」>「Apps Script」を開く
 * 3. エディタ内のコードを全消去し、このスクリプトの内容をすべて貼り付ける
 * 4. 右上の「デプロイ」>「新しいデプロイ」をクリック
 * 5. 種類の選択: 「ウェブアプリ」を選択
 * 6. 設定:
 *    - 説明: Gendrive Sync & Time-Machine API v2.0
 *    - 次のユーザーとして実行: 自分（your-email@gmail.com）
 *    - アクセスできるユーザー: 全員（Anyone）
 * 7. 「デプロイ」ボタンを押し、アクセスを承認する
 * 8. 発行された「ウェブアプリの URL」をGendriveアプリの「クラウド同期設定」に入力する
 */

const SHEET_NAME_META = '_sync_meta';
const SHEET_NAME_TASKS = 'Tasks';
const SHEET_NAME_HABITS = 'Habits';

// 5-Sheet Time-Machine Schema
const SHEET_EXPORT_HABITS = 'Habits_Master';
const SHEET_EXPORT_REC_TASKS = 'RecurringTasks_Master';
const SHEET_EXPORT_SINGLE_TASKS = 'SingleTasks';
const SHEET_EXPORT_HABIT_LOGS = 'Habit_Logs';
const SHEET_EXPORT_TASK_LOGS = 'Task_Logs';

/**
 * GETリクエスト処理 (データ取得 / 世代バックアップ一覧取得 / 指定バックアップ読込)
 */
function doGet(e) {
  try {
    const action = e?.parameter?.action;

    // 1. Google Drive フォルダ内のバックアップスプレッドシート一覧取得
    if (action === 'list_backups') {
      const folderId = e.parameter.folderId;
      if (!folderId) throw new Error('folderId is required for list_backups');
      
      const folder = DriveApp.getFolderById(folderId);
      const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
      const list = [];

      while (files.hasNext()) {
        const file = files.next();
        list.push({
          id: file.getId(),
          name: file.getName(),
          created: file.getDateCreated().toISOString(),
          updated: file.getLastUpdated().toISOString(),
          size: file.getSize(),
          url: file.getUrl()
        });
      }

      // 更新日時降順でソート
      list.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        backups: list,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. 指定スプレッドシートからの5シートデータインポート
    if (action === 'import_sheet') {
      const fileId = e.parameter.fileId;
      if (!fileId) throw new Error('fileId is required for import_sheet');

      const restoredData = loadDataFromExportSpreadsheet(fileId);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        data: restoredData,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. 通常のリアルタイム同期データ取得
    const props = PropertiesService.getScriptProperties();
    const rawData = props.getProperty('GENDRIVE_FULL_DATA');

    let payload = null;
    if (rawData) {
      payload = JSON.parse(rawData);
    } else {
      payload = loadDataFromSpreadsheet();
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: payload,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POSTリクエスト処理 (通常同期 / Driveフォルダへの5シート世代エクスポート)
 */
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      throw new Error('No post data received');
    }

    const payload = JSON.parse(e.postData.contents);
    const nowIso = new Date().toISOString();

    // 1. Driveフォルダへの新規世代スプレッドシート作成・エクスポート
    if (payload.action === 'export_to_folder') {
      const folderId = payload.folderId;
      const fileName = payload.fileName || ('HABIT_EXPORT_' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmm'));
      
      if (!folderId) throw new Error('folderId is required for export_to_folder');

      const result = createAndExportSpreadsheetToFolder(folderId, fileName, payload.data);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        spreadsheetId: result.id,
        spreadsheetUrl: result.url,
        fileName: fileName,
        timestamp: nowIso
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. 通常のリアルタイムデータ保存・同期
    payload.metadata = payload.metadata || {};
    payload.metadata.lastUpdatedAt = nowIso;

    // A. プロパティストアに完全なJSONを高速保存（ミリ秒アクセス用）
    const props = PropertiesService.getScriptProperties();
    props.setProperty('GENDRIVE_FULL_DATA', JSON.stringify(payload));

    // B. スプレッドシートの各シートへ行単位で反映（人間用バックアップ＆可視化）
    syncToSpreadsheetSheets(payload);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      lastUpdatedAt: nowIso,
      message: 'Synchronized successfully'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Google Driveの指定フォルダ内に5シート構成の新規スプレッドシートを作成し全属性を出力
 */
function createAndExportSpreadsheetToFolder(folderId, fileName, data) {
  const folder = DriveApp.getFolderById(folderId);
  const ss = SpreadsheetApp.create(fileName);
  const file = DriveApp.getFileById(ss.getId());
  
  // 指定フォルダへ移動
  file.moveTo(folder);

  const habits = Array.isArray(data.habits) ? data.habits : [];
  const allTasks = Array.isArray(data.tasks) ? data.tasks : [];

  const recTasks = allTasks.filter(t => t.taskType === 'recurring' || t.recType || (t.recurrence && t.recurrence.type !== 'none'));
  const singleTasks = allTasks.filter(t => !recTasks.includes(t));

  // 1. Habits_Master シート
  const sheetHabits = ss.getActiveSheet();
  sheetHabits.setName(SHEET_EXPORT_HABITS);
  const habitHeaders = [
    'ID', '名前', '無効(Disabled)', '状態(Status)', 'セクション', '時間種別', '開始時刻', '終了時刻',
    '目標分', '頻度種別', '回数/日', '回数/週', '間隔(日)', '月間隔', '月指定種別', '指定日', '曜日配列',
    'ドメイン大', 'ドメイン小', '部門大', '部門小', 'PJ大', 'PJ小', 'タグ', 'マトリクス(JSON)', '作成日時'
  ];
  const habitRows = [habitHeaders];
  habits.forEach(h => {
    habitRows.push([
      h.id || '',
      h.name || '',
      h.isDisabled ? 'TRUE' : 'FALSE',
      h.status || 'uncompleted',
      h.section || '',
      h.displayType || h.timingType || '',
      h.customStart || '',
      h.customEnd || '',
      h.targetMin || 0,
      h.recType || h.frequency || '',
      h.dailyTimes || '',
      h.weeklyTimes || '',
      h.intervalDays || '',
      h.monthInterval || '',
      h.monthTiming || '',
      h.monthDay || '',
      JSON.stringify(h.weekdays || h.recurrence?.weekdays || []),
      h.domainMajor || h.domain || '',
      h.domainMinor || '',
      h.deptMajor || h.dept || '',
      h.deptMinor || '',
      h.projMajor || h.proj || '',
      h.projMinor || '',
      Array.isArray(h.tags) ? h.tags.join(', ') : (h.tags || ''),
      JSON.stringify(h.matrix || {}),
      h.createdAt || ''
    ]);
  });
  sheetHabits.getRange(1, 1, habitRows.length, habitHeaders.length).setValues(habitRows);

  // 2. RecurringTasks_Master シート
  const sheetRecTasks = ss.insertSheet(SHEET_EXPORT_REC_TASKS);
  const recTaskHeaders = [
    'ID', 'タスク名', '無効(Disabled)', '状態(Status)', 'セクション', '時間種別', '開始時刻', '終了時刻',
    '見積分', '頻度種別', '回数/日', '回数/週', '間隔(日)', '曜日配列',
    'ドメイン大', 'ドメイン小', '部門大', '部門小', 'PJ大', 'PJ小', '優先度', 'タグ', 'マトリクス(JSON)', '作成日時'
  ];
  const recTaskRows = [recTaskHeaders];
  recTasks.forEach(t => {
    recTaskRows.push([
      t.id || '',
      t.title || t.name || '',
      t.isDisabled ? 'TRUE' : 'FALSE',
      t.status || 'uncompleted',
      t.section || '',
      t.timingType || '',
      t.customStart || '',
      t.customEnd || '',
      t.estMin || 0,
      t.recType || '',
      t.dailyTimes || '',
      t.weeklyTimes || '',
      t.intervalDays || '',
      JSON.stringify(t.weekdays || []),
      t.domainMajor || t.domain || '',
      t.domainMinor || '',
      t.deptMajor || t.dept || '',
      t.deptMinor || '',
      t.projMajor || t.proj || '',
      t.projMinor || '',
      t.priority || 'mid',
      Array.isArray(t.tags) ? t.tags.join(', ') : (t.tags || ''),
      JSON.stringify(t.matrix || {}),
      t.createdAt || ''
    ]);
  });
  sheetRecTasks.getRange(1, 1, recTaskRows.length, recTaskHeaders.length).setValues(recTaskRows);

  // 3. SingleTasks シート (予定 ＋ 完了ログ)
  const sheetSingleTasks = ss.insertSheet(SHEET_EXPORT_SINGLE_TASKS);
  const singleTaskHeaders = [
    'ID', 'タスク名', '無効(Disabled)', '状態(Status)', '予定日', '完了日時', 'セクション', '時間種別',
    '開始時刻', '終了時刻', '見積分', '実績分', '実績開始', '実績終了',
    'ドメイン大', 'ドメイン小', '部門大', '部門小', 'PJ大', 'PJ小', '優先度', '箱(Bucket)', 'ラベル', 'タグ', 'マトリクス(JSON)', '作成日時'
  ];
  const singleTaskRows = [singleTaskHeaders];
  singleTasks.forEach(t => {
    singleTaskRows.push([
      t.id || '',
      t.title || t.name || '',
      t.isDisabled ? 'TRUE' : 'FALSE',
      t.status || 'uncompleted',
      t.scheduledDate || '',
      t.completedAt || '',
      t.section || '',
      t.timingType || '',
      t.customStart || '',
      t.customEnd || '',
      t.estMin || 0,
      t.actMin || 0,
      t.actStart || '',
      t.actEnd || '',
      t.domainMajor || t.domain || '',
      t.domainMinor || '',
      t.deptMajor || t.dept || '',
      t.deptMinor || '',
      t.projMajor || t.proj || '',
      t.projMinor || '',
      t.priority || 'mid',
      t.bucket || 'today',
      t.label || 'p1',
      Array.isArray(t.tags) ? t.tags.join(', ') : (t.tags || ''),
      JSON.stringify(t.matrix || {}),
      t.createdAt || ''
    ]);
  });
  sheetSingleTasks.getRange(1, 1, singleTaskRows.length, singleTaskHeaders.length).setValues(singleTaskRows);

  // 4. Habit_Logs シート (定期ハビットの実行履歴)
  const sheetHabitLogs = ss.insertSheet(SHEET_EXPORT_HABIT_LOGS);
  const habitLogHeaders = ['Habit_ID', 'ハビット名', '実行日付', '状態', '実績分', '完了日時', 'メモ'];
  const habitLogRows = [habitLogHeaders];
  habits.forEach(h => {
    const history = Array.isArray(h.history) ? h.history : [];
    const executionLogs = Array.isArray(h.executionLogs) ? h.executionLogs : [];
    
    // 合成ログ
    const dateMap = {};
    history.forEach(item => {
      const d = typeof item === 'string' ? item : item.date;
      if (d) dateMap[d] = { date: d, status: 'completed', actMin: item.actMin || h.targetMin || 0, completedAt: item.completedAt || '', note: item.note || '' };
    });
    executionLogs.forEach(log => {
      const d = log.dateKey || log.date;
      if (d) dateMap[d] = Object.assign(dateMap[d] || {}, { date: d, status: log.status || 'completed', actMin: log.actMin || h.targetMin || 0, completedAt: log.completedAt || '', note: log.note || '' });
    });

    Object.values(dateMap).forEach(log => {
      habitLogRows.push([
        h.id || '',
        h.name || '',
        log.date || '',
        log.status || 'completed',
        log.actMin || 0,
        log.completedAt || '',
        log.note || ''
      ]);
    });
  });
  sheetHabitLogs.getRange(1, 1, habitLogRows.length, habitLogHeaders.length).setValues(habitLogRows);

  // 5. Task_Logs シート (定期タスクの実行履歴)
  const sheetTaskLogs = ss.insertSheet(SHEET_EXPORT_TASK_LOGS);
  const taskLogHeaders = ['Task_ID', 'タスク名', '実行日付', '状態', '見積分', '実績分', '開始時刻', '終了時刻', '完了日時', 'メモ'];
  const taskLogRows = [taskLogHeaders];
  recTasks.forEach(t => {
    const history = Array.isArray(t.history) ? t.history : [];
    const executionLogs = Array.isArray(t.executionLogs) ? t.executionLogs : [];

    const dateMap = {};
    history.forEach(item => {
      const d = typeof item === 'string' ? item : item.date;
      if (d) dateMap[d] = { date: d, status: 'completed', actMin: item.actMin || t.estMin || 0, completedAt: item.completedAt || '', note: item.note || '' };
    });
    executionLogs.forEach(log => {
      const d = log.dateKey || log.date;
      if (d) dateMap[d] = Object.assign(dateMap[d] || {}, { date: d, status: log.status || 'completed', actMin: log.actMin || t.estMin || 0, actStart: log.actStart || '', actEnd: log.actEnd || '', completedAt: log.completedAt || '', note: log.note || '' });
    });

    Object.values(dateMap).forEach(log => {
      taskLogRows.push([
        t.id || '',
        t.title || t.name || '',
        log.date || '',
        log.status || 'completed',
        t.estMin || 0,
        log.actMin || 0,
        log.actStart || '',
        log.actEnd || '',
        log.completedAt || '',
        log.note || ''
      ]);
    });
  });
  sheetTaskLogs.getRange(1, 1, taskLogRows.length, taskLogHeaders.length).setValues(taskLogRows);

  return {
    id: ss.getId(),
    url: ss.getUrl()
  };
}

/**
 * 5シート構成のエクスポートスプレッドシートからデータを復元
 */
function loadDataFromExportSpreadsheet(fileId) {
  const ss = SpreadsheetApp.openById(fileId);
  const generateUUID = () => Utilities.getUuid();

  const habits = [];
  const tasks = [];

  // 1. Habits_Master の読み込み
  const sheetHabits = ss.getSheetByName(SHEET_EXPORT_HABITS) || ss.getSheetByName('Habits');
  if (sheetHabits) {
    const data = sheetHabits.getDataRange().getValues();
    if (data.length > 1) {
      const headers = data[0];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[1] && !row[0]) continue; // 空行スキップ
        
        let weekdays = [];
        try { weekdays = JSON.parse(row[16] || '[]'); } catch (e) {}
        let matrix = {};
        try { matrix = JSON.parse(row[24] || '{}'); } catch (e) {}

        const tags = (row[23] || '').toString().split(',').map(s => s.trim()).filter(Boolean);

        habits.push({
          id: row[0] ? String(row[0]) : generateUUID(),
          name: String(row[1] || '無題ハビット'),
          isDisabled: String(row[2]).toUpperCase() === 'TRUE',
          status: String(row[3] || 'uncompleted'),
          section: String(row[4] || '第2セッション'),
          displayType: String(row[5] || 'section'),
          timingType: String(row[5] || 'section'),
          customStart: String(row[6] || ''),
          customEnd: String(row[7] || ''),
          targetMin: Number(row[8]) || 5,
          recType: String(row[9] || 'everyday'),
          frequency: String(row[9] || 'everyday'),
          dailyTimes: Number(row[10]) || 1,
          weeklyTimes: Number(row[11]) || 3,
          intervalDays: Number(row[12]) || 2,
          monthInterval: Number(row[13]) || 1,
          monthTiming: String(row[14] || 'specific_day'),
          monthDay: Number(row[15]) || 1,
          weekdays: weekdays,
          domainMajor: String(row[17] || 'PN1'),
          domainMinor: String(row[18] || ''),
          domain: String(row[18] || row[17] || 'PN1'),
          deptMajor: String(row[19] || 'CEO直轄'),
          deptMinor: String(row[20] || ''),
          dept: String(row[20] || row[19] || 'CEO直轄'),
          projMajor: String(row[21] || 'ビジネス'),
          projMinor: String(row[22] || ''),
          proj: String(row[22] || row[21] || 'ビジネス'),
          tags: tags,
          matrix: matrix,
          createdAt: row[25] ? new Date(row[25]).toISOString() : new Date().toISOString(),
          history: [],
          executionLogs: []
        });
      }
    }
  }

  // 2. RecurringTasks_Master の読み込み
  const sheetRecTasks = ss.getSheetByName(SHEET_EXPORT_REC_TASKS);
  if (sheetRecTasks) {
    const data = sheetRecTasks.getDataRange().getValues();
    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[1] && !row[0]) continue;

        let weekdays = [];
        try { weekdays = JSON.parse(row[13] || '[]'); } catch (e) {}
        let matrix = {};
        try { matrix = JSON.parse(row[22] || '{}'); } catch (e) {}
        const tags = (row[21] || '').toString().split(',').map(s => s.trim()).filter(Boolean);

        tasks.push({
          id: row[0] ? String(row[0]) : generateUUID(),
          title: String(row[1] || '無題定期タスク'),
          name: String(row[1] || '無題定期タスク'),
          taskType: 'recurring',
          isDisabled: String(row[2]).toUpperCase() === 'TRUE',
          status: String(row[3] || 'uncompleted'),
          section: String(row[4] || '第2セッション'),
          timingType: String(row[5] || 'section'),
          customStart: String(row[6] || ''),
          customEnd: String(row[7] || ''),
          estMin: Number(row[8]) || 15,
          recType: String(row[9] || 'everyday'),
          dailyTimes: Number(row[10]) || 1,
          weeklyTimes: Number(row[11]) || 3,
          intervalDays: Number(row[12]) || 2,
          weekdays: weekdays,
          domainMajor: String(row[14] || 'PN2'),
          domainMinor: String(row[15] || ''),
          domain: String(row[15] || row[14] || 'PN2'),
          deptMajor: String(row[16] || '制作本部'),
          deptMinor: String(row[17] || ''),
          dept: String(row[17] || row[16] || '制作本部'),
          projMajor: String(row[18] || 'ビジネス'),
          projMinor: String(row[19] || ''),
          proj: String(row[19] || row[18] || 'ビジネス'),
          priority: String(row[20] || 'mid'),
          tags: tags,
          matrix: matrix,
          createdAt: row[23] ? new Date(row[23]).toISOString() : new Date().toISOString(),
          history: [],
          executionLogs: []
        });
      }
    }
  }

  // 3. SingleTasks の読み込み
  const sheetSingleTasks = ss.getSheetByName(SHEET_EXPORT_SINGLE_TASKS) || ss.getSheetByName('Tasks');
  if (sheetSingleTasks) {
    const data = sheetSingleTasks.getDataRange().getValues();
    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[1] && !row[0]) continue;

        let matrix = {};
        try { matrix = JSON.parse(row[24] || '{}'); } catch (e) {}
        const tags = (row[23] || '').toString().split(',').map(s => s.trim()).filter(Boolean);

        tasks.push({
          id: row[0] ? String(row[0]) : generateUUID(),
          title: String(row[1] || '無題タスク'),
          name: String(row[1] || '無題タスク'),
          taskType: 'single',
          isDisabled: String(row[2]).toUpperCase() === 'TRUE',
          status: String(row[3] || 'uncompleted'),
          scheduledDate: String(row[4] || ''),
          completedAt: row[5] ? new Date(row[5]).toISOString() : null,
          section: String(row[6] || '第2セッション'),
          timingType: String(row[7] || 'section'),
          customStart: String(row[8] || ''),
          customEnd: String(row[9] || ''),
          estMin: Number(row[10]) || 15,
          actMin: Number(row[11]) || 0,
          actStart: String(row[12] || ''),
          actEnd: String(row[13] || ''),
          domainMajor: String(row[14] || 'PN2'),
          domainMinor: String(row[15] || ''),
          domain: String(row[15] || row[14] || 'PN2'),
          deptMajor: String(row[16] || '制作本部'),
          deptMinor: String(row[17] || ''),
          dept: String(row[17] || row[16] || '制作本部'),
          projMajor: String(row[18] || 'ビジネス'),
          projMinor: String(row[19] || ''),
          proj: String(row[19] || row[18] || 'ビジネス'),
          priority: String(row[20] || 'mid'),
          bucket: String(row[21] || 'today'),
          label: String(row[22] || 'p1'),
          tags: tags,
          matrix: matrix,
          createdAt: row[25] ? new Date(row[25]).toISOString() : new Date().toISOString()
        });
      }
    }
  }

  // 4. Habit_Logs の読み込み・結合
  const sheetHabitLogs = ss.getSheetByName(SHEET_EXPORT_HABIT_LOGS);
  if (sheetHabitLogs) {
    const data = sheetHabitLogs.getDataRange().getValues();
    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const [hid, hname, date, status, actMin, completedAt, note] = data[i];
        if (!hid || !date) continue;
        const targetHabit = habits.find(h => String(h.id) === String(hid) || h.name === hname);
        if (targetHabit) {
          targetHabit.executionLogs = targetHabit.executionLogs || [];
          targetHabit.executionLogs.push({
            dateKey: String(date),
            status: String(status || 'completed'),
            actMin: Number(actMin) || targetHabit.targetMin || 0,
            completedAt: completedAt ? new Date(completedAt).toISOString() : '',
            note: String(note || '')
          });
          targetHabit.history = targetHabit.history || [];
          if (String(status) === 'completed' && !targetHabit.history.includes(String(date))) {
            targetHabit.history.push(String(date));
          }
        }
      }
    }
  }

  // 5. Task_Logs の読み込み・結合
  const sheetTaskLogs = ss.getSheetByName(SHEET_EXPORT_TASK_LOGS);
  if (sheetTaskLogs) {
    const data = sheetTaskLogs.getDataRange().getValues();
    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const [tid, tname, date, status, estMin, actMin, actStart, actEnd, completedAt, note] = data[i];
        if (!tid || !date) continue;
        const targetTask = tasks.find(t => String(t.id) === String(tid) || t.title === tname);
        if (targetTask) {
          targetTask.executionLogs = targetTask.executionLogs || [];
          targetTask.executionLogs.push({
            dateKey: String(date),
            status: String(status || 'completed'),
            actMin: Number(actMin) || targetTask.estMin || 0,
            actStart: String(actStart || ''),
            actEnd: String(actEnd || ''),
            completedAt: completedAt ? new Date(completedAt).toISOString() : '',
            note: String(note || '')
          });
          targetTask.history = targetTask.history || [];
          if (String(status) === 'completed' && !targetTask.history.some(h => (typeof h === 'string' ? h : h.date) === String(date))) {
            targetTask.history.push({ date: String(date), actMin: Number(actMin) || 0 });
          }
        }
      }
    }
  }

  return {
    tasks: tasks,
    habits: habits,
    metadata: {
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedDevice: 'DRIVE_TIME_MACHINE_RESTORE'
    }
  };
}

/**
 * スプレッドシートのシートへ行単位でデータを書き込む（通常同期用）
 */
function syncToSpreadsheetSheets(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // A. メタデータシート
  let metaSheet = ss.getSheetByName(SHEET_NAME_META);
  if (!metaSheet) {
    metaSheet = ss.insertSheet(SHEET_NAME_META);
  }
  metaSheet.clear();
  metaSheet.appendRow(['Key', 'Value', 'Updated At']);
  metaSheet.appendRow(['Last Updated', data.metadata?.lastUpdatedAt || '', new Date()]);
  metaSheet.appendRow(['Last Device', data.metadata?.lastUpdatedDevice || 'UNKNOWN', '']);
  metaSheet.appendRow(['Last Processed Date', data.metadata?.lastProcessedDate || '', '']);
  metaSheet.appendRow(['Tasks Count', (data.tasks || []).length, '']);
  metaSheet.appendRow(['Habits Count', (data.habits || []).length, '']);

  // B. Tasks シート
  let taskSheet = ss.getSheetByName(SHEET_NAME_TASKS);
  if (!taskSheet) {
    taskSheet = ss.insertSheet(SHEET_NAME_TASKS);
  }
  taskSheet.clear();
  taskSheet.appendRow([
    'ID', 'Status', 'Title', 'Scheduled Date', 'Section', 'Timing',
    'Est Min', 'Act Min', 'Act Start', 'Act End', 'Domain', 'Project', 'Priority'
  ]);

  if (Array.isArray(data.tasks)) {
    const taskRows = data.tasks.map(t => [
      t.id || '',
      t.status || 'uncompleted',
      t.title || '',
      t.scheduledDate || '',
      t.section || '',
      t.timingType || '',
      t.estMin || 0,
      t.actMin || 0,
      t.actStart || '',
      t.actEnd || '',
      t.domainMinor || t.domainMajor || '',
      t.projectMinor || t.projectMajor || '',
      t.priority || 'mid'
    ]);
    if (taskRows.length > 0) {
      taskSheet.getRange(2, 1, taskRows.length, taskRows[0].length).setValues(taskRows);
    }
  }

  // C. Habits シート
  let habitSheet = ss.getSheetByName(SHEET_NAME_HABITS);
  if (!habitSheet) {
    habitSheet = ss.insertSheet(SHEET_NAME_HABITS);
  }
  habitSheet.clear();
  habitSheet.appendRow([
    'ID', 'Name', 'Status', 'Section', 'Target Min', 'Category', 'Frequency', 'Recurrence'
  ]);

  if (Array.isArray(data.habits)) {
    const habitRows = data.habits.map(h => [
      h.id || '',
      h.name || '',
      h.status || 'uncompleted',
      h.section || '',
      h.targetMin || 0,
      h.category || '',
      h.frequency || '',
      JSON.stringify(h.recurrence || {})
    ]);
    if (habitRows.length > 0) {
      habitSheet.getRange(2, 1, habitRows.length, habitRows[0].length).setValues(habitRows);
    }
  }
}

/**
 * 初期状態フォールバック
 */
function loadDataFromSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    tasks: [],
    habits: [],
    goals: {},
    manifesto: {},
    taskPresets: [],
    metadata: {
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedDevice: 'GAS_INIT',
      lastProcessedDate: ''
    }
  };
}

/**
 * 【初回必須】Google Drive フルアクセス権限（作成・移動・保存）の承認用テスト関数
 * Apps Script エディタ上部の関数選択で「testAuth」を選び、「▷ 実行」を押して権限を許可してください。
 */
function testAuth() {
  const ss = SpreadsheetApp.create('Gendrive_Auth_Test_Sheet');
  const file = DriveApp.getFileById(ss.getId());
  file.setTrashed(true);
  Logger.log('✅ スプレッドシート作成＆Google Drive完全書き込み権限の検証が成功しました！');
}


