'use strict';

const STORAGE_KEY = 'calc_history';
const MAX_HISTORY = 100;
const OP_MAP = { '÷': '/', '×': '*', '−': '-', '+': '+' };

const state = {
  currentValue: '0',
  expression: '',
  operator: null,
  prevValue: null,
  justCalculated: false,
  waitingForOperand: false,
};

let history = loadHistory();

// ── DOM ──────────────────────────────────────────────
const elExpression   = document.getElementById('expression');
const elResult       = document.getElementById('result');
const elHistoryList  = document.getElementById('history-list');
const elClearHistory = document.getElementById('clear-history');

// ── 初期化 ───────────────────────────────────────────
renderHistory();
updateDisplay();

document.getElementById('buttons').addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn) return;

  const action = btn.dataset.action;
  if (action === 'num')  handleNumber(btn.dataset.num);
  if (action === 'op')   handleOperator(btn.dataset.op);
  if (action === 'eq')   handleEqual();
  if (action === 'ac')   handleAC();
  if (action === 'sign') handlePlusMinus();
  if (action === 'pct')  handlePercent();
  if (action === 'dot')  handleDot();
});

elClearHistory.addEventListener('click', clearHistory);

// ── シェアボタン ──────────────────────────────────────
const elShareBtn = document.getElementById('share-btn');
elShareBtn.addEventListener('click', async () => {
  const shareData = {
    title: '計算履歴電卓',
    text: '計算式が履歴として残せる無料Web電卓🧮 勉強に超便利！インストール不要です',
    url: 'https://kakekue0322-cyber.github.io/calculator/',
  };
  if (navigator.share) {
    await navigator.share(shareData);
  } else {
    await navigator.clipboard.writeText(shareData.url);
    elShareBtn.textContent = 'コピー完了！';
    setTimeout(() => { elShareBtn.textContent = 'シェア'; }, 2000);
  }
});

// ── 入力ハンドラ ──────────────────────────────────────
function handleNumber(n) {
  setActiveOperator(null);

  if (state.justCalculated || state.waitingForOperand) {
    state.currentValue = n;
    if (state.justCalculated) state.expression = '';
    state.justCalculated = false;
    state.waitingForOperand = false;
  } else {
    state.currentValue =
      state.currentValue === '0' ? n : state.currentValue + n;
  }
  updateDisplay();
}

function handleDot() {
  setActiveOperator(null);

  if (state.justCalculated || state.waitingForOperand) {
    state.currentValue = '0.';
    if (state.justCalculated) state.expression = '';
    state.justCalculated = false;
    state.waitingForOperand = false;
  } else if (!state.currentValue.includes('.')) {
    state.currentValue += '.';
  }
  updateDisplay();
}

function handleOperator(op) {
  if (state.waitingForOperand) {
    // 2つ目の数字未入力のまま演算子を変えた → 計算せず演算子だけ上書き
    state.operator = op;
    state.expression = formatNum(state.prevValue) + ' ' + op + ' ';
    setActiveOperator(op);
    updateDisplay();
    return;
  }

  if (state.operator && !state.justCalculated) {
    const result = calculate(state.prevValue, state.currentValue, state.operator);
    state.prevValue = String(result);
    state.expression = formatNum(result) + ' ' + op + ' ';
  } else {
    state.prevValue = state.currentValue;
    state.expression = formatNum(state.currentValue) + ' ' + op + ' ';
  }

  state.operator = op;
  state.justCalculated = false;
  state.waitingForOperand = true;
  setActiveOperator(op);
  updateDisplay();
}

function handleEqual() {
  if (!state.operator || state.prevValue === null) return;

  const expr = formatNum(state.prevValue) + ' ' + state.operator + ' ' + formatNum(state.currentValue);
  const result = calculate(state.prevValue, state.currentValue, state.operator);
  const resultStr = String(result);

  addToHistory(expr, resultStr);

  state.currentValue = resultStr;
  state.expression = expr + ' =';
  state.operator = null;
  state.prevValue = null;
  state.justCalculated = true;
  setActiveOperator(null);
  updateDisplay();
}

function handleAC() {
  state.currentValue = '0';
  state.expression = '';
  state.operator = null;
  state.prevValue = null;
  state.justCalculated = false;
  state.waitingForOperand = false;
  setActiveOperator(null);
  updateDisplay();
}

function handlePlusMinus() {
  if (state.currentValue === '0') return;
  state.currentValue = state.currentValue.startsWith('-')
    ? state.currentValue.slice(1)
    : '-' + state.currentValue;
  updateDisplay();
}

function handlePercent() {
  const val = parseFloat(state.currentValue);
  if (isNaN(val)) return;
  state.currentValue = String(val / 100);
  updateDisplay();
}

// ── 計算 ──────────────────────────────────────────────
function calculate(a, b, op) {
  const fa = parseFloat(a);
  const fb = parseFloat(b);
  if (isNaN(fa) || isNaN(fb)) return 0;

  let result;
  switch (OP_MAP[op]) {
    case '+': result = fa + fb; break;
    case '-': result = fa - fb; break;
    case '*': result = fa * fb; break;
    case '/':
      if (fb === 0) return 'エラー';
      result = fa / fb;
      break;
    default: return fb;
  }
  return parseFloat(result.toPrecision(12));
}

// ── 表示更新 ──────────────────────────────────────────
function updateDisplay() {
  // 大エリア：リアルタイムで計算式を表示
  let bigText;
  if (state.justCalculated) {
    // expression が空（履歴タップ時）はそのまま currentValue を大エリアに出す
    bigText = state.expression || formatNum(state.currentValue);
  } else if (state.operator && !state.waitingForOperand) {
    bigText = state.expression + formatNum(state.currentValue); // "1 + 2"
  } else {
    bigText = state.expression || formatNum(state.currentValue); // "1"
  }

  elResult.textContent = bigText;
  elResult.classList.remove('shrink', 'shrink-more');
  if (bigText.length > 14)     elResult.classList.add('shrink-more');
  else if (bigText.length > 9) elResult.classList.add('shrink');

  // 小エリア：= 押下後（式あり）のみ結果を表示。履歴タップ時は空
  elExpression.textContent = (state.justCalculated && state.expression)
    ? formatNum(state.currentValue)
    : '';

  const acBtn = document.querySelector('[data-action="ac"]');
  acBtn.textContent = state.currentValue === '0' && !state.expression ? 'AC' : 'C';
}

function formatNum(val) {
  if (val === 'エラー') return 'エラー';
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (Number.isInteger(n) && !String(val).endsWith('.')) {
    return n.toLocaleString('ja-JP');
  }
  return val;
}

// ── 演算子ボタンのアクティブ表示 ─────────────────────
function setActiveOperator(op) {
  document.querySelectorAll('.btn-operator').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.op === op);
  });
}

// ── 履歴管理 ──────────────────────────────────────────
function addToHistory(expression, result) {
  const item = {
    expression,
    result,
    timestamp: new Date().toISOString(),
  };
  history.unshift(item);
  if (history.length > MAX_HISTORY) history.pop();
  saveHistory();
  renderHistory();
}

function clearHistory() {
  history = [];
  saveHistory();
  renderHistory();
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function renderHistory() {
  elHistoryList.innerHTML = '';

  if (history.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = '計算履歴がここに表示されます';
    elHistoryList.appendChild(empty);
    elClearHistory.style.display = 'none';
    return;
  }

  history.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML =
      `<div class="hist-expr">${escapeHtml(item.expression)}</div>` +
      `<div class="hist-result">= ${escapeHtml(item.result)}</div>`;
    div.addEventListener('click', () => {
      state.currentValue = item.result;
      state.expression = '';
      state.operator = null;
      state.prevValue = null;
      state.justCalculated = true;
      setActiveOperator(null);
      updateDisplay();
    });
    elHistoryList.appendChild(div);
  });

  elClearHistory.style.display = 'block';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
