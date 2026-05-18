// ========== 数据状态 ==========
let state = {
  cars: [],                // { id, name, totalRuns, oils: { frontShock:{number}, ... } }
  places: [],              // { id, name }
  runLogs: [],             // { id, date, place, carName, count, damage }
  oilLogs: [],             // { id, date, carName, oilType, newNumber }
  currentCarId: null,
  nickName: localStorage.getItem('rc_nick') || ''
};

// 从本地加载
const saved = localStorage.getItem('rc_state');
if (saved) {
  const parsed = JSON.parse(saved);
  state = { ...state, ...parsed };
  // 确保车辆有oils结构
  state.cars.forEach(c => {
    if (!c.oils) {
      c.oils = {
        frontShock: { number: '' },
        rearShock: { number: '' },
        frontDiff: { number: '' },
        centerDiff: { number: '' },
        rearDiff: { number: '' }
      };
    }
  });
}
if (!state.nickName) {
  state.nickName = prompt('输入你的昵称');
  localStorage.setItem('rc_nick', state.nickName);
}

function save() {
  localStorage.setItem('rc_state', JSON.stringify(state));
}

// 默认组数
const runCountInput = document.getElementById('run-count');
if (runCountInput) {
  runCountInput.value = localStorage.getItem('rc_lastRunCount') || 4;
  runCountInput.addEventListener('input', () => {
    localStorage.setItem('rc_lastRunCount', runCountInput.value);
  });
}
// 日期默认今天
const dateInput = document.getElementById('run-date');
if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

// ========== 渲染 ==========
function render() {
  const car = state.cars.find(c => c.id === state.currentCarId);
  
  // 车辆信息
  document.getElementById('car-name').textContent = car ? car.name : '未选择车辆';
  document.getElementById('total-runs').textContent = car ? car.totalRuns : 0;
  
  // 油液编号
  const oilEls = {
    frontShock: document.getElementById('oil-fs'),
    rearShock: document.getElementById('oil-rs'),
    frontDiff: document.getElementById('oil-fd'),
    centerDiff: document.getElementById('oil-cd'),
    rearDiff: document.getElementById('oil-rd')
  };
  for (let type in oilEls) {
    if (oilEls[type]) {
      oilEls[type].textContent = car && car.oils ? (car.oils[type]?.number || '-') : '-';
    }
  }

  // 提醒条（简单基于跑圈提醒，油液周期可后期扩展）
  const alertDiv = document.getElementById('alert');
  alertDiv.classList.add('hidden');

  // 车库列表
  const ul = document.getElementById('cars-ul');
  ul.innerHTML = '';
  state.cars.forEach(c => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="car-name">${c.name} (总${c.totalRuns}组)</span>
                    <button class="car-delete" data-carid="${c.id}">🗑️</button>`;
    li.querySelector('.car-name').onclick = () => {
      state.currentCarId = c.id;
      save(); render();
    };
    li.querySelector('.car-delete').onclick = (e) => {
      e.stopPropagation();
      if (confirm(`确定删除“${c.name}”？`)) deleteCar(c.id);
    };
    if (c.id === state.currentCarId) li.style.background = '#555';
    ul.appendChild(li);
  });

  // 地点下拉
  const placeSelect = document.getElementById('run-place');
  if (placeSelect) {
    placeSelect.innerHTML = '';
    state.places.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name;
      placeSelect.appendChild(opt);
    });
    if (state.places.length === 0) {
      const opt = document.createElement('option'); opt.value = ''; opt.textContent = '（无地点）';
      placeSelect.appendChild(opt);
    }
  }

  // 更新筛选下拉
  updateFilterOptions('runlog-car-filter');
  updateFilterOptions('oillog-car-filter');

  // 如果面板打开，刷新表格
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
    opt.value = c.name; opt.textContent = c.name;
    sel.appendChild(opt);
  });
  if (currentVal && [...sel.options].some(o => o.value === currentVal)) sel.value = currentVal;
}

function deleteCar(carId) {
  state.cars = state.cars.filter(c => c.id !== carId);
  if (state.currentCarId === carId) state.currentCarId = state.cars[0]?.id || null;
  save(); render();
}

// ========== 跑圈记录 ==========
function addRun(carId, count, date, placeId, damage) {
  const car = state.cars.find(c => c.id === carId);
  if (!car) return;
  car.totalRuns += count;
  const placeName = state.places.find(p => p.id === placeId)?.name || '';
  state.runLogs.push({
    id: Date.now().toString(),
    date: date || new Date().toISOString().split('T')[0],
    place: placeName,
    carName: car.name,
    count,
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
    tr.innerHTML = `<td>${log.date}</td><td>${log.place || '-'}</td><td>${log.carName}</td><td>${log.count}</td><td>${log.damage || '-'}</td>`;
    tbody.appendChild(tr);
  });
}

// ========== 油液更换 ==========
function changeOil(carId, oilType, newNumber) {
  const car = state.cars.find(c => c.id === carId);
  if (!car) return;
  if (!car.oils) car.oils = {};
  if (!car.oils[oilType]) car.oils[oilType] = { number: '' };
  car.oils[oilType].number = newNumber;
  state.oilLogs.push({
    id: Date.now().toString(),
    date: new Date().toISOString().split('T')[0],
    carName: car.name,
    oilType: oilType,
    newNumber: newNumber
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
  const oilNames = {
    frontShock: '前避震', rearShock: '后避震',
    frontDiff: '前差速', centerDiff: '中差速', rearDiff: '后差速'
  };
  tbody.innerHTML = '';
  logs.forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${log.date}</td><td>${log.carName}</td><td>${oilNames[log.oilType] || log.oilType}</td><td>${log.newNumber}</td>`;
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
  let car = state.cars.find(c => lower.includes(c.name.toLowerCase()));
  if (!car) { alert('未找到车辆，请说车名'); return; }
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
  if (!carId) return;
  const count = parseInt(document.getElementById('run-count').value, 10) || 1;
  const date = document.getElementById('run-date').value;
  const placeId = document.getElementById('run-place').value;
  const damage = document.getElementById('damage-input').value;
  addRun(carId, count, date, placeId, damage);
};

// 油液按钮
document.querySelectorAll('.oil-btn').forEach(btn => {
  btn.onclick = () => {
    const carId = state.currentCarId;
    if (!carId) return;
    const oilType = btn.dataset.oil;
    const newNumber = prompt(`输入新的${btn.textContent}油编号：`);
    if (newNumber !== null) changeOil(carId, oilType, newNumber);
  };
});

document.getElementById('btn-add-car').onclick = () => {
  const name = prompt('车辆名称'); if (!name) return;
  const newCar = {
    id: Date.now().toString(),
    name,
    totalRuns: 0,
    oils: {
      frontShock: { number: '' }, rearShock: { number: '' },
      frontDiff: { number: '' }, centerDiff: { number: '' }, rearDiff: { number: '' }
    }
  };
  state.cars.push(newCar);
  state.currentCarId = newCar.id;
  save(); render();
};

document.getElementById('btn-add-place').onclick = () => {
  const name = prompt('新地点名称'); if (!name) return;
  const p = { id: Date.now().toString(), name };
  state.places.push(p);
  save(); render();
  document.getElementById('run-place').value = p.id;
};

// 跑圈记录面板
document.getElementById('btn-toggle-runlog').onclick = () => {
  const panel = document.getElementById('runlog-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) renderRunLog();
};
document.getElementById('runlog-car-filter').onchange = renderRunLog;
document.getElementById('btn-clear-runlog').onclick = () => {
  if (confirm('清空所有跑圈记录？')) { state.runLogs = []; save(); renderRunLog(); }
};

// 油液记录面板
document.getElementById('btn-toggle-oillog').onclick = () => {
  const panel = document.getElementById('oillog-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) renderOilLog();
};
document.getElementById('oillog-car-filter').onchange = renderOilLog;
document.getElementById('btn-clear-oillog').onclick = () => {
  if (confirm('清空所有换油记录？')) { state.oilLogs = []; save(); renderOilLog(); }
};

// 初始渲染
render();