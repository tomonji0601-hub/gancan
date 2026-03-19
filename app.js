const STORAGE_KEYS = {
  water: 'soil-app-water-history',
  adjust: 'soil-app-adjust-history'
};

const tabs = {
  water: document.getElementById('tab-water'),
  adjust: document.getElementById('tab-adjust')
};

const panels = {
  water: document.getElementById('mode-water'),
  adjust: document.getElementById('mode-adjust')
};

function setActiveMode(mode) {
  Object.keys(tabs).forEach((key) => {
    tabs[key].classList.toggle('active', key === mode);
    panels[key].classList.toggle('active', key === mode);
  });
}

tabs.water.addEventListener('click', () => setActiveMode('water'));
tabs.adjust.addEventListener('click', () => setActiveMode('adjust'));

function getNumber(id) {
  const value = document.getElementById(id).value;
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}`;
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function readHistory(mode) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS[mode]) || '[]');
  } catch {
    return [];
  }
}

function writeHistory(mode, data) {
  localStorage.setItem(STORAGE_KEYS[mode], JSON.stringify(data));
}

function calculateWaterContent() {
  const ma = getNumber('ma');
  const mb = getNumber('mb');
  const mc = getNumber('mc');

  if ([ma, mb, mc].some((v) => v === null)) {
    return { valid: false, message: '未入力があります。' };
  }

  const denominator = mb - mc;
  if (denominator === 0) {
    return { valid: false, message: 'mb - mc が 0 です。' };
  }

  const w = 100 * (ma - mb) / denominator;
  return { valid: Number.isFinite(w), value: w };
}

function calculateAdjustWater() {
  const w = getNumber('target-w');
  const mi = getNumber('mi');
  const w1 = getNumber('w1');

  if ([w, mi, w1].some((v) => v === null)) {
    return { valid: false, message: '未入力があります。' };
  }

  const dryMass = mi / (1 + w1 / 100);
  const targetWetMass = dryMass * (1 + w / 100);
  const mw = targetWetMass - mi;

  return { valid: Number.isFinite(mw), value: mw };
}

function updateWaterResult() {
  const result = calculateWaterContent();
  document.getElementById('water-result').textContent = result.valid
    ? `${formatNumber(result.value, 2)} %`
    : '—';
}

function updateAdjustResult() {
  const result = calculateAdjustWater();
  document.getElementById('adjust-result').textContent = result.valid
    ? `${formatNumber(result.value, 2)} g`
    : '—';
}

['ma', 'mb', 'mc'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateWaterResult);
});
['target-w', 'mi', 'w1'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateAdjustResult);
});

function renderWaterHistory() {
  const container = document.getElementById('water-history');
  const history = readHistory('water');

  if (history.length === 0) {
    container.innerHTML = '<div class="empty">まだ保存されていません。</div>';
    return;
  }

  container.innerHTML = history.map((item) => `
    <article class="history-item">
      <strong>${escapeHtml(item.sampleName || '名称未設定')}</strong>
      <div class="time">${formatTimestamp(item.timestamp)}</div>
      <div class="details">
        <div>ma: ${formatNumber(item.ma, 2)} g</div>
        <div>mb: ${formatNumber(item.mb, 2)} g</div>
        <div>mc: ${formatNumber(item.mc, 2)} g</div>
        <div>w: ${formatNumber(item.w, 2)} %</div>
      </div>
    </article>
  `).join('');
}

function renderAdjustHistory() {
  const container = document.getElementById('adjust-history');
  const history = readHistory('adjust');

  if (history.length === 0) {
    container.innerHTML = '<div class="empty">まだ保存されていません。</div>';
    return;
  }

  container.innerHTML = history.map((item) => `
    <article class="history-item">
      <strong>${escapeHtml(item.sampleName || '名称未設定')}</strong>
      <div class="time">${formatTimestamp(item.timestamp)}</div>
      <div class="details">
        <div>目標w: ${formatNumber(item.w, 2)} %</div>
        <div>mi: ${formatNumber(item.mi, 2)} g</div>
        <div>w1: ${formatNumber(item.w1, 2)} %</div>
        <div>mw: ${formatNumber(item.mw, 2)} g</div>
      </div>
    </article>
  `).join('');
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function saveWater() {
  const sampleName = document.getElementById('water-sample').value.trim();
  const result = calculateWaterContent();
  const ma = getNumber('ma');
  const mb = getNumber('mb');
  const mc = getNumber('mc');

  if (!result.valid) {
    alert('保存できません。入力値を確認してください。');
    return;
  }

  const history = readHistory('water');
  history.unshift({
    sampleName,
    timestamp: new Date().toISOString(),
    ma,
    mb,
    mc,
    w: result.value
  });
  writeHistory('water', history);
  renderWaterHistory();
}

function saveAdjust() {
  const sampleName = document.getElementById('adjust-sample').value.trim();
  const result = calculateAdjustWater();
  const w = getNumber('target-w');
  const mi = getNumber('mi');
  const w1 = getNumber('w1');

  if (!result.valid) {
    alert('保存できません。入力値を確認してください。');
    return;
  }

  const history = readHistory('adjust');
  history.unshift({
    sampleName,
    timestamp: new Date().toISOString(),
    w,
    mi,
    w1,
    mw: result.value
  });
  writeHistory('adjust', history);
  renderAdjustHistory();
}

function exportCsv(mode) {
  const history = readHistory(mode);
  if (history.length === 0) {
    alert('出力するデータがありません。');
    return;
  }

  let headers = [];
  let rows = [];

  if (mode === 'water') {
    headers = ['sample_name', 'timestamp', 'ma_g', 'mb_g', 'mc_g', 'w_percent'];
    rows = history.map((item) => [
      item.sampleName || '',
      formatTimestamp(item.timestamp),
      item.ma,
      item.mb,
      item.mc,
      item.w
    ]);
  } else {
    headers = ['sample_name', 'timestamp', 'target_w_percent', 'mi_g', 'w1_percent', 'mw_g'];
    rows = history.map((item) => [
      item.sampleName || '',
      formatTimestamp(item.timestamp),
      item.w,
      item.mi,
      item.w1,
      item.mw
    ]);
  }

  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');

  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${mode}-history.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function clearHistory(mode) {
  const message = mode === 'water'
    ? '含水比計算モードの履歴を削除します。'
    : '試料調整モードの履歴を削除します。';

  if (!confirm(message)) return;
  writeHistory(mode, []);
  if (mode === 'water') renderWaterHistory();
  if (mode === 'adjust') renderAdjustHistory();
}

document.getElementById('save-water').addEventListener('click', saveWater);
document.getElementById('save-adjust').addEventListener('click', saveAdjust);
document.getElementById('export-water').addEventListener('click', () => exportCsv('water'));
document.getElementById('export-adjust').addEventListener('click', () => exportCsv('adjust'));
document.getElementById('clear-water').addEventListener('click', () => clearHistory('water'));
document.getElementById('clear-adjust').addEventListener('click', () => clearHistory('adjust'));

renderWaterHistory();
renderAdjustHistory();
updateWaterResult();
updateAdjustResult();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
