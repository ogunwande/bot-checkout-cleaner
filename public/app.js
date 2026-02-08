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
const themeToggle = document.getElementById('themeToggle');

// Load saved theme
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
  themeToggle.textContent = '☀️';
}

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');

  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');

  themeToggle.textContent = isDark ? '☀️' : '🌙';
});
