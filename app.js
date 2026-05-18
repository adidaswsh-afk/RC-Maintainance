// ========== 基础配置 ==========
const OIL_NAMES = {
  frontShock: '前避震',
  rearShock: '后避震',
  frontDiff: '前差速',
  centerDiff: '中差速',
  rearDiff: '后差速'
};

const SHOCK_TYPES = ['frontShock', 'rearShock'];
const DIFF_TYPES = ['frontDiff', 'centerDiff', 'rearDiff'];

// 新车默认周期：避震油和差速油分开设置
const DEFAULT_SHOCK_INTERVAL = 20;
const DEFAULT_DIFF_INTERVAL = 30;
const DEFAULT_OIL_INTERVAL = DEFAULT_SHOCK_INTERVAL; // 兼容旧数据

function todayString() {
  return new Date().toISOString().split('T')[0];
}

function isShockOil(type) {
  return SHOCK_TYPES.includes(type);
}

function getOilGroup(type) {
  return isShockOil(type) ? 'shock' : 'diff';
}

function getDefaultInterval(type, car) {
  const group = getOilGroup(type);

  if (car?.oilIntervals && Number(car.oilIntervals[group]) > 0) {
    return Number(car.oilIntervals[group]);
  }

  if (group === 'shock' && Number(car?.shockInterval) > 0) {
    return Number(car.shockInterval);
  }

  if (group === 'diff' && Number(car?.diffInterval) > 0) {
    return Number(car.diffInterval);
  }

  // 兼容上一版：如果旧车只有 oilInterval，就沿用旧周期
  if (Number(car?.oilInterval) > 0) {
    return Number(car.oilInterval);
  }

  return group === 'shock' ? DEFAULT_SHOCK_INTERVAL : DEFAULT_DIFF_INTERVAL;
}

function createOilState(shockInterval = DEFAULT_SHOCK_INTERVAL, diffInterval = DEFAULT_DIFF_INTERVAL) {
  const safeShockInterval = Number(shockInterval) > 0 ? Number(shockInterval) : DEFAULT_SHOCK_INTERVAL;
  const safeDiffInterval = Number(diffInterval) > 0 ? Number(diffInterval) : DEFAULT_DIFF_INTERVAL;

  return {
    frontShock: { number: '', interval: safeShockInterval, lastChangedRuns: 0 },
    rearShock: { number: '', interval: safeShockInterval, lastChangedRuns: 0 },
    frontDiff: { number: '', interval: safeDiffInterval, lastChangedRuns: 0 },
    centerDiff: { number: '', interval: safeDiffInterval, lastChangedRuns: 0 },
    rearDiff: { number: '', interval: safeDiffInterval, lastChangedRuns: 0 }
  };
}

function normalizeOilState(car) {
  if (!car) return;

  car.totalRuns = Number(car.totalRuns) || 0;

  const shockInterval = getDefaultInterval('frontShock', car);
  const diffInterval = getDefaultInterval('frontDiff', car);

  car.oilIntervals = {
    shock: shockInterval,
    diff: diffInterval
  };

  if (!car.oils) {
    car.oils = createOilState(shockInterval, diffInterval);
  }

  Object.keys(OIL_NAMES).forEach(type => {
    const defaultInterval = getDefaultInterval(type, car);

    if (!car.oils[type]) {
      car.oils[type] = {
        number: '',
        interval: defaultInterval,
        lastChangedRuns: 0
      };
    }

    if (car.oils[type].number === undefined || car.oils[type].number === null) {
      car.oils[type].number = '';
    }

    if (!Number(car.oils[type].interval)) {
      car.oils[type].interval = defaultInterval;
    }

    if (car.oils[type].lastChangedRuns === undefined || car.oils[type].lastChangedRuns === null) {
      car.oils[type].lastChangedRuns = 0;
    }

    car.oils[type].interval = Number(car.oils[type].interval) || defaultInterval;
    car.oils[type].lastChangedRuns = Number(car.oils[type].lastChangedRuns) || 0;
  });
}

function getDueOils(car) {
  if (!car) return [];
  normalizeOilState(car);

  return Object.keys(OIL_NAMES)
    .map(type => {
      const oil = car.oils[type];
      const used = Math.max(0, car.totalRuns - oil.lastChangedRuns);
      return {
        type,
        name: OIL_NAMES[type],
        used,
        interval: oil.interval
      };
    })
    .filter(item => item.interval > 0 && item.used >= item.interval);
}

function escapeText(value) {
  return value === undefined || value === null ? '' : String(value);
}

// ========== 数据状态 ==========
let state = {
  cars: [],
  places: [],
  runLogs: [],
  oilLogs: [],
  currentCarId: null,
  nickName: localStorage.getItem('rc_nick') || ''
};

// 从本地加载旧数据，并自动升级旧版数据结构
try {
  const saved = localStorage.getItem('rc_state');
  if (saved) {
    const parsed = JSON.parse(saved);
    state = { ...state, ...parsed };
  }
} catch (error) {
  console.warn('读取本地数据失败，将使用空数据。', error);
}

state.cars = Array.isArray(state.cars) ? state.cars : [];
state.places = Array.isArray(state.places) ? state.places : [];
state.runLogs = Array.isArray(state.runLogs) ? state.runLogs : [];
state.oilLogs = Array.isArray(state.oilLogs) ? state.oilLogs : [];
state.cars.forEach(normalizeOilState);

if (state.currentCarId && !state.cars.some(c => c.id === state.currentCarId)) {
  state.currentCarId = state.cars[0]?.id || null;
}

function save() {
  localStorage.setItem('rc_state', JSON.stringify(state));
}

save();

// ========== 初始化输入框 ==========
const runCountInput = document.getElementById('run-count');
if (runCountInput) {
  runCountInput.value = localStorage.getItem('rc_lastRunCount') || 4;
  runCountInput.addEventListener('input', () => {
    localStorage.setItem('rc_lastRunCount', runCountInput.value);
  });
}

const dateInput = document.getElementById('run-date');
if (dateInput) dateInput.value = todayString();

// ========== 渲染 ==========
function render() {
  const car = state.cars.find(c => c.id === state.currentCarId) || null;
  if (car) normalizeOilState(car);

  // 车辆信息
  document.getElementById('car-name').textContent = car ? car.name : '未选择车辆';
  document.getElementById('total-runs').textContent = car ? car.totalRuns : 0;

  // 油液信息：油号 + 已跑/周期
  const oilEls = {
    frontShock: document.getElementById('oil-fs'),
    rearShock: document.getElementById('oil-rs'),
    frontDiff: document.getElementById('oil-fd'),
    centerDiff: document.getElementById('oil-cd'),
    rearDiff: document.getElementById('oil-rd')
  };

  Object.keys(oilEls).forEach(type => {
    const el = oilEls[type];
    if (!el) return;

    if (!car) {
      el.textContent = '-';
      return;
    }

    const oil = car.oils[type];
    const used = Math.max(0, car.totalRuns - oil.lastChangedRuns);
    const number = oil.number ? oil.number : '未记录';
    el.textContent = `${number}｜${used}/${oil.interval}组电`;
  });

  // 顶部换油提醒
  const alertDiv = document.getElementById('alert');
  alertDiv.classList.add('hidden');
  alertDiv.textContent = '';

  if (car) {
    const dueOils = getDueOils(car);
    if (dueOils.length > 0) {
      const message = dueOils.map(item => `${item.name} ${item.used}/${item.interval}组电`).join('、');
      alertDiv.textContent = `⚠️ ${car.name} 需要检查/更换油液：${message}`;
      alertDiv.classList.remove('hidden');
    }
  }

  // 车库列表
  const ul = document.getElementById('cars-ul');
  ul.innerHTML = '';

  state.cars.forEach(c => {
    normalizeOilState(c);

    const li = document.createElement('li');
    if (c.id === state.currentCarId) li.classList.add('active-car');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'car-name';
    nameSpan.textContent = `${c.name}（总${c.totalRuns}组）`;
    nameSpan.onclick = () => {
      state.currentCarId = c.id;
      save();
      render();
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'car-delete';
    deleteBtn.textContent = '🗑️';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`确定删除“${c.name}”？`)) deleteCar(c.id);
    };

    li.onclick = () => {
      state.currentCarId = c.id;
      save();
      render();
    };

    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    ul.appendChild(li);
  });

  // 地点下拉
  const placeSelect = document.getElementById('run-place');
  if (placeSelect) {
    const oldValue = placeSelect.value;
    placeSelect.innerHTML = '';

    if (state.places.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '（无地点）';
      placeSelect.appendChild(opt);
    } else {
      state.places.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        placeSelect.appendChild(opt);
      });
    }

    if ([...placeSelect.options].some(o => o.value === oldValue)) {
      placeSelect.value = oldValue;
    }
  }

  updateFilterOptions('runlog-car-filter');
  updateFilterOptions('oillog-car-filter');

  if (!document.getElementById('runlog-panel').classList.contains('hidden')) renderRunLog();
  if (!document.getElementById('oillog-panel').classList.contains('hidden')) renderOilLog();
}

function updateFilterOptions(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  const currentVal = sel.value;
  sel.innerHTML = '<option value="">全部</option>';

  state.cars.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });

  if (currentVal && [...sel.options].some(o => o.value === currentVal)) {
    sel.value = currentVal;
  }
}

function deleteCar(carId) {
  state.cars = state.cars.filter(c => c.id !== carId);
  if (state.currentCarId === carId) state.currentCarId = state.cars[0]?.id || null;
  save();
  render();
}

// ========== 跑圈记录 ==========
function addRun(carId, count, date, placeId, damage) {
  const car = state.cars.find(c => c.id === carId);
  if (!car) return;

  const safeCount = Number(count);
  if (!Number.isFinite(safeCount) || safeCount < 1) {
    alert('请输入正确的组数');
    return;
  }

  normalizeOilState(car);
  car.totalRuns += safeCount;

  const placeName = state.places.find(p => p.id === placeId)?.name || '';

  state.runLogs.push({
    id: Date.now().toString(),
    date: date || todayString(),
    place: placeName,
    carName: car.name,
    count: safeCount,
    damage: damage || ''
  });

  save();
  render();
}

function renderRunLog() {
  const tbody = document.getElementById('runlog-tbody');
  const filter = document.getElementById('runlog-car-filter').value;
  let logs = state.runLogs;

  if (filter) logs = logs.filter(l => l.carName === filter);
  logs = [...logs].reverse();
  tbody.innerHTML = '';

  logs.forEach(log => {
    const tr = document.createElement('tr');
    [
      log.date,
      log.place || '-',
      log.carName,
      log.count,
      log.damage || '-'
    ].forEach(value => {
      const td = document.createElement('td');
      td.textContent = escapeText(value);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// ========== 油液更换 ==========
function changeOil(carId, oilType, newNumber, newInterval) {
  const car = state.cars.find(c => c.id === carId);
  if (!car) return;

  normalizeOilState(car);

  if (!car.oils[oilType]) {
    car.oils[oilType] = { number: '', interval: DEFAULT_OIL_INTERVAL, lastChangedRuns: 0 };
  }

  if (Number(newInterval) > 0) {
    car.oils[oilType].interval = Number(newInterval);
  }

  car.oils[oilType].number = newNumber;
  car.oils[oilType].lastChangedRuns = car.totalRuns;

  state.oilLogs.push({
    id: Date.now().toString(),
    date: todayString(),
    carName: car.name,
    oilType,
    newNumber,
    interval: car.oils[oilType].interval,
    totalRunsWhenChanged: car.totalRuns
  });

  save();
  render();
}

function renderOilLog() {
  const tbody = document.getElementById('oillog-tbody');
  const filter = document.getElementById('oillog-car-filter').value;
  let logs = state.oilLogs;

  if (filter) logs = logs.filter(l => l.carName === filter);
  logs = [...logs].reverse();
  tbody.innerHTML = '';

  logs.forEach(log => {
    const intervalText = log.interval ? `${log.newNumber}｜${log.interval}组电` : log.newNumber;
    const tr = document.createElement('tr');
    [
      log.date,
      log.carName,
      OIL_NAMES[log.oilType] || log.oilType,
      intervalText
    ].forEach(value => {
      const td = document.createElement('td');
      td.textContent = escapeText(value);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// ========== 语音 ==========
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.interimResults = false;
  recognition.onresult = (e) => {
    parseVoiceCommand(e.results[0][0].transcript);
  };
}

function parseVoiceCommand(text) {
  const lower = text.toLowerCase();
  const car = state.cars.find(c => lower.includes(c.name.toLowerCase()));

  if (!car) {
    alert('未找到车辆，请说车名，例如“小白 跑5组”');
    return;
  }

  const runMatch = lower.match(/(\d+)\s*组/);
  let count = runMatch ? parseInt(runMatch[1], 10) : 1;
  if (isNaN(count) || count < 1) count = 1;

  if (lower.includes('跑') || lower.includes('加')) {
    const date = document.getElementById('run-date').value;
    const placeId = document.getElementById('run-place').value;
    const damage = document.getElementById('damage-input').value;
    addRun(car.id, count, date, placeId, damage);
    alert(`已为 ${car.name} 增加 ${count} 组`);
  } else {
    alert('可说“台风 跑5组”');
  }
}

// ========== 事件绑定 ==========
document.getElementById('btn-speak').onclick = () => {
  if (recognition) recognition.start();
  else alert('浏览器不支持语音，请用 Chrome');
};

document.getElementById('btn-manual').onclick = () => {
  const carId = state.currentCarId;

  if (!carId) {
    alert('请先选择一辆车');
    return;
  }

  const count = parseInt(document.getElementById('run-count').value, 10);
  if (isNaN(count) || count < 1) {
    alert('请输入正确的组数');
    return;
  }

  const date = document.getElementById('run-date').value;
  const placeId = document.getElementById('run-place').value;
  const damage = document.getElementById('damage-input').value;

  addRun(carId, count, date, placeId, damage);
  alert(`已记录 ${count} 组`);
};

// 油液按钮：输入新油号，并可更新该部位的提醒周期（会覆盖该部位当前周期）
document.querySelectorAll('.oil-btn').forEach(btn => {
  btn.onclick = () => {
    const carId = state.currentCarId;

    if (!carId) {
      alert('请先选择一辆车');
      return;
    }

    const car = state.cars.find(c => c.id === carId);
    normalizeOilState(car);

    const oilType = btn.dataset.oil;
    const currentOil = car.oils[oilType];
    const newNumber = prompt(`请输入新的${btn.textContent}油编号，例如 500、7000、15000：`, currentOil.number || '');

    if (newNumber === null) return;
    if (newNumber.trim() === '') {
      alert('油液编号不能为空');
      return;
    }

    const intervalInput = prompt(`多少组电后提醒再次更换${btn.textContent}？`, String(currentOil.interval || DEFAULT_OIL_INTERVAL));
    if (intervalInput === null) return;

    const newInterval = parseInt(intervalInput, 10);
    if (isNaN(newInterval) || newInterval < 1) {
      alert('请输入正确的换油周期，例如 20');
      return;
    }

    changeOil(carId, oilType, newNumber.trim(), newInterval);
    alert(`已记录${btn.textContent}：${newNumber.trim()}，${newInterval}组电后提醒`);
  };
});

document.getElementById('btn-add-car').onclick = () => {
  const name = prompt('车辆名称');
  if (!name || name.trim() === '') return;

  const shockIntervalInput = prompt('避震油多少组电后提醒更换？例如 20', String(DEFAULT_SHOCK_INTERVAL));
  if (shockIntervalInput === null) return;

  const shockInterval = parseInt(shockIntervalInput, 10);
  if (isNaN(shockInterval) || shockInterval < 1) {
    alert('请输入正确的避震油周期，例如 20');
    return;
  }

  const diffIntervalInput = prompt('差速油多少组电后提醒更换？例如 30', String(DEFAULT_DIFF_INTERVAL));
  if (diffIntervalInput === null) return;

  const diffInterval = parseInt(diffIntervalInput, 10);
  if (isNaN(diffInterval) || diffInterval < 1) {
    alert('请输入正确的差速油周期，例如 30');
    return;
  }

  const newCar = {
    id: Date.now().toString(),
    name: name.trim(),
    totalRuns: 0,
    oilIntervals: {
      shock: shockInterval,
      diff: diffInterval
    },
    oils: createOilState(shockInterval, diffInterval)
  };

  state.cars.push(newCar);
  state.currentCarId = newCar.id;

  save();
  render();
};

document.getElementById('btn-add-place').onclick = () => {
  const name = prompt('新地点名称');
  if (!name || name.trim() === '') return;

  const p = { id: Date.now().toString(), name: name.trim() };
  state.places.push(p);

  save();
  render();

  const placeSelect = document.getElementById('run-place');
  if (placeSelect) placeSelect.value = p.id;
};

// 跑圈记录面板
document.getElementById('btn-toggle-runlog').onclick = () => {
  const panel = document.getElementById('runlog-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) renderRunLog();
};

document.getElementById('runlog-car-filter').onchange = renderRunLog;

document.getElementById('btn-clear-runlog').onclick = () => {
  if (confirm('清空所有跑圈记录？')) {
    state.runLogs = [];
    save();
    renderRunLog();
  }
};

// 油液记录面板
document.getElementById('btn-toggle-oillog').onclick = () => {
  const panel = document.getElementById('oillog-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) renderOilLog();
};

document.getElementById('oillog-car-filter').onchange = renderOilLog;

document.getElementById('btn-clear-oillog').onclick = () => {
  if (confirm('清空所有换油记录？')) {
    state.oilLogs = [];
    save();
    renderOilLog();
  }
};

// 初始渲染
render();
