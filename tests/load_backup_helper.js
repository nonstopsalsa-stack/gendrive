(async () => {
  const res = await fetch('temp_backup_test.json');
  window.__BACKUP_DATA__ = await res.json();
  return window.__BACKUP_DATA__.habits.length;
})()
