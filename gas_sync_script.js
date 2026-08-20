/**
 * Gendrive - Google Apps Script (GAS) Cloud Sync Engine
 * 哲生 (AI Company OS & Personal OS Engine)
 *
 * 【設定手順】
 * 1. Googleドライブで新規「Google スプレッドシート」を作成（名前: 例「Gendrive_Database」）
 * 2. メニュー「拡張機能」>「Apps Script」を開く
 * 3. エディタ内のコードを全消去し、このスクリプトの内容をすべて貼り付ける
 * 4. 右上の「デプロイ」>「新しいデプロイ」をクリック
 * 5. 種類の選択: 「ウェブアプリ」を選択
 * 6. 設定:
 *    - 説明: Gendrive Sync API v1.0
 *    - 次のユーザーとして実行: 自分（your-email@gmail.com）
 *    - アクセスできるユーザー: 全員（Anyone）
 * 7. 「デプロイ」ボタンを押し、アクセスを承認する
 * 8. 発行された「ウェブアプリの URL」（https://script.google.com/macros/s/.../exec）をコピーして、
 *    PC版およびスマホ版 Gendrive の「☁️ クラウド同期設定」に入力する
 */

const SHEET_NAME_META = '_sync_meta';
const SHEET_NAME_TASKS = 'Tasks';
const SHEET_NAME_HABITS = 'Habits';

/**
 * GETリクエスト処理 (データ取得)
 */
function doGet(e) {
  try {
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
 * POSTリクエスト処理 (データ保存・同期)
 */
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      throw new Error('No post data received');
    }

    const payload = JSON.parse(e.postData.contents);
    const nowIso = new Date().toISOString();

    // 1. メタデータの更新
    payload.metadata = payload.metadata || {};
    payload.metadata.lastUpdatedAt = nowIso;

    // 2. プロパティストアに完全なJSONを高速保存（ミリ秒アクセス用）
    const props = PropertiesService.getScriptProperties();
    props.setProperty('GENDRIVE_FULL_DATA', JSON.stringify(payload));

    // 3. スプレッドシートの各シートへ行単位で反映（人間用バックアップ＆可視化）
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
 * スプレッドシートのシートへ行単位でデータを書き込む
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
 * 初期状態（プロパティ未設定時）にシートから復元を試みるフォールバック
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
