async function loadStats() {
  const res = await fetch('/api/stats');
  const stats = await res.json();

  document.getElementById('totalScanned').textContent = stats.totalScanned;
  document.getElementById('botsDetected').textContent = stats.botsDetected;
  document.getElementById('botsDeleted').textContent = stats.botsDeleted;

  const clean = stats.totalScanned - stats.botsDetected;
  document.getElementById('cleanCheckouts').textContent = clean > 0 ? clean : 0;

  document.getElementById('lastScan').textContent =
    stats.lastScan ? new Date(stats.lastScan).toLocaleString() : 'Never';
}

document.getElementById('runScanBtn').addEventListener('click', async () => {
  document.getElementById('runScanBtn').textContent = 'Scanning...';

  await fetch('/api/scan', { method: 'POST' });

  await loadStats();
  document.getElementById('runScanBtn').textContent = '▶ Run Scan';
});

loadStats();
