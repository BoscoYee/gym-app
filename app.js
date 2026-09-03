const STORAGE_KEY = "hkGymPwaState";
const LCSD_GYMS_URL = "https://www.lcsd.gov.hk/datagovhk/facility/facility-fitrm.json";
const LCSD_EQUIPMENT_URL = "https://www.lcsd.gov.hk/datagovhk/facility/facility-fiteqmt.json";

const defaultState = {
  tab: "home",
  profile: {
    height: "",
    weight: "",
    goals: [],
    level: "新手",
    injury: "無"
  },
  profileComplete: false,
  previousTab: "home",
  selectedGymId: "sample-ssk",
  gyms: [
    {
      id: "sample-ssk",
      name: "石硤尾公園體育館健身室",
      district: "深水埗",
      address: "九龍深水埗南昌街290號",
      openingHours: "請以康文署官方最新資料為準",
      equipment: [
        { name: "跑步機", count: 4, category: "有氧" },
        { name: "推胸練習器", count: 1, category: "胸" },
        { name: "坐姿划船機", count: 1, category: "背" },
        { name: "腿部推蹬機", count: 1, category: "腿" },
        { name: "啞鈴組", count: 1, category: "多用途" }
      ]
    },
    {
      id: "sample-tko",
      name: "將軍澳體育館健身室",
      district: "西貢",
      address: "新界將軍澳運隆路9號",
      openingHours: "請以康文署官方最新資料為準",
      equipment: [
        { name: "健身單車", count: 3, category: "有氧" },
        { name: "高位下拉機", count: 1, category: "背" },
        { name: "肩推機", count: 1, category: "肩" },
        { name: "腹肌訓練椅", count: 1, category: "核心" }
      ]
    }
  ],
  workoutDraft: null,
  manualDraft: null,
  testOptions: null,
  records: [
    {
      id: makeId(),
      date: "2026-08-20",
      gymName: "石硤尾公園體育館健身室",
      bodyPart: "胸",
      duration: 45,
      items: [
        { name: "推胸練習器", sets: [{ weight: 25, reps: 10 }, { weight: 25, reps: 10 }, { weight: 25, reps: 8 }] }
      ]
    }
  ],
  weights: [
    { date: "2026-08-01", value: 71.2 },
    { date: "2026-08-08", value: 70.8 },
    { date: "2026-08-15", value: 70.3 },
    { date: "2026-08-21", value: 70.0 }
  ],
  officialDataInfo: null,
  lastSync: null
};

let state = loadState();

const screen = document.querySelector("#screen");
const title = document.querySelector("#screenTitle");
const todayLabel = document.querySelector("#todayLabel");

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    const loaded = parsed ? { ...clone(defaultState), ...parsed } : clone(defaultState);
    loaded.profile = { ...defaultState.profile, ...(loaded.profile || {}) };
    loaded.profile.goals = normalizeGoals(loaded.profile);
    loaded.profileComplete = parsed ? Boolean(loaded.profileComplete || isProfileComplete(loaded.profile)) : false;
    return loaded;
  } catch {
    return clone(defaultState);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeGoals(profile) {
  if (Array.isArray(profile.goals)) return profile.goals;
  if (profile.goal) return [profile.goal];
  return [];
}

function isProfileComplete(profile) {
  const height = Number(profile?.height);
  const weight = Number(profile?.weight);
  return height > 0 && weight > 0 && normalizeGoals(profile || {}).length > 0;
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function selectedGym() {
  return state.gyms.find((gym) => gym.id === state.selectedGymId) || state.gyms[0];
}

function setTab(tab) {
  if (!state.profileComplete && tab !== "settings") {
    state.previousTab = "home";
    state.tab = "settings";
    saveState();
    render();
    return;
  }
  if (tab === "settings" && state.tab !== "settings") {
    state.previousTab = state.tab;
  }
  state.tab = tab;
  saveState();
  render();
}

function render() {
  const date = new Date();
  const profileReady = Boolean(state.profileComplete && isProfileComplete(state.profile));
  if (!profileReady && state.tab !== "settings") state.tab = "settings";
  document.body.classList.toggle("needs-profile", !profileReady);
  todayLabel.textContent = date.toLocaleDateString("zh-HK", { weekday: "long", month: "short", day: "numeric" });
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.tab);
  });

  const routes = {
    home: renderHome,
    training: renderTraining,
    records: renderRecords,
    recordDetail: renderRecordDetail,
    analytics: renderAnalytics,
    settings: renderSettings,
    testMode: renderTestMode,
    gyms: renderGyms,
    workout: renderWorkout,
    log: renderLog
  };

  routes[state.tab]?.();
}

function renderHome() {
  title.textContent = "HK Gym";
  const gym = selectedGym();
  const activeManualRecord = state.manualDraft?.items?.length;
  const lastRecord = state.records[0];
  const weekCount = weeklyCount()[0]?.count || 0;
  const totalVolume = totalTrainingVolume();
  const equipmentPreview = gym.equipment.slice(0, 4);
  screen.innerHTML = `
    <div class="stack home-dashboard">
      <section class="hero-panel">
        <div class="hero-copy">
          <p class="muted small">${activeManualRecord ? "今日記錄進行中" : "今日"}</p>
          <h2>${activeManualRecord ? "繼續完成訓練紀錄" : "記錄你的訓練"}</h2>
          <p class="muted">${gym.district} · ${gym.name}</p>
        </div>
        <button class="primary-button" type="button" data-action="start-training">${activeManualRecord ? "繼續記錄" : "開始記錄"}</button>
      </section>

      <section class="metric-grid compact-metrics">
        <div class="metric">
          <span class="metric-label">本週</span>
          <strong>${weekCount}</strong>
          <span class="muted">次訓練</span>
        </div>
        <div class="metric">
          <span class="metric-label">紀錄</span>
          <strong>${state.records.length}</strong>
          <span class="muted">全部訓練</span>
        </div>
        <div class="metric">
          <span class="metric-label">體重</span>
          <strong>${state.profile.weight || "-"}</strong>
          <span class="muted">kg</span>
        </div>
        <div class="metric">
          <span class="metric-label">總量</span>
          <strong>${formatVolume(totalVolume)}</strong>
          <span class="muted">重量訓練</span>
        </div>
      </section>

      <section class="card gym-card">
        <div class="card-row">
          <div>
            <p class="muted small">常用健身室</p>
            <h3>${gym.name}</h3>
            <p class="muted small">${gym.address}</p>
          </div>
          <button class="ghost-button" type="button" data-action="choose-gym">更改</button>
        </div>
        <div class="equipment-preview">
          ${equipmentPreview.map((item) => `<span>${item.name} x ${item.count}</span>`).join("")}
        </div>
      </section>

      <section class="card recent-card">
        <div class="card-row">
          <h3>最近一次訓練</h3>
          ${lastRecord ? `<span class="status-badge complete">已記錄</span>` : ""}
        </div>
        ${lastRecord ? recordSummary(lastRecord) : `<p class="muted">未有紀錄</p>`}
      </section>
    </div>
  `;
}
function renderTraining() {
  title.textContent = "今日記錄";
  const draft = currentManualDraft();
  const gym = state.gyms.find((item) => item.id === draft.gymId) || selectedGym();
  const groupedEquipment = groupByCategory(gym.equipment);
  const categories = ["全部", ...Object.keys(groupedEquipment)];
  const selectedCategory = categories.includes(draft.equipmentCategory) ? draft.equipmentCategory : "全部";
  const categoryItems = selectedCategory === "全部" ? gym.equipment : groupedEquipment[selectedCategory] || [];
  const selectedEquipmentName = categoryItems.some((item) => item.name === draft.selectedEquipmentName)
    ? draft.selectedEquipmentName
    : categoryItems[0]?.name || "";
  const selectedEquipment = categoryItems.find((item) => item.name === selectedEquipmentName);
  const alreadyAdded = draft.items.some((item) => item.sourceName === selectedEquipmentName);

  screen.innerHTML = `
    <div class="stack">
      <section class="card stack">
        <div class="card-row">
          <div>
            <p class="muted small">今日健身室</p>
            <h2>${gym.name}</h2>
            <p class="muted">${gym.district} · ${gym.address}</p>
          </div>
        </div>
        <button class="secondary-button" type="button" data-action="choose-gym-for-record">更改健身室</button>
      </section>

      <section class="card stack">
        <h2>場地器材</h2>
        <div class="field">
          <label for="manualEquipmentCategory">分類</label>
          <select id="manualEquipmentCategory" data-manual-picker="category">
            ${categories.map((category) => `<option value="${category}" ${category === selectedCategory ? "selected" : ""}>${category}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="manualEquipmentName">器材</label>
          <select id="manualEquipmentName" data-manual-picker="equipment">
            ${categoryItems.map((item) => `<option value="${item.name}" ${item.name === selectedEquipmentName ? "selected" : ""}>${item.name}${item.nameEn ? ` / ${item.nameEn}` : ""} x ${item.count}</option>`).join("")}
          </select>
        </div>
        ${selectedEquipment ? `<p class="muted small">${selectedEquipment.nameEn ? `英文：${selectedEquipment.nameEn}` : selectedEquipment.category || ""}</p>` : `<p class="muted small">這個分類暫時沒有器材。</p>`}
        <button class="primary-button" type="button" data-action="add-selected-manual-equipment" ${selectedEquipment && !alreadyAdded ? "" : "disabled"}>${alreadyAdded ? "已加入今日記錄" : "加入今日記錄"}</button>
      </section>

      <section class="card stack">
        <div class="card-row">
          <div>
            <h2>今日已做器材</h2>
            <p class="muted small">在這裡輸入重量、次數和組數。</p>
          </div>
          <span class="status-badge pending">${draft.items.length} 項</span>
        </div>
        ${draft.items.length ? draft.items.map((item, index) => manualItemTemplate(item, index)).join("") : `<p class="muted">尚未加入器材。先在上方選擇分類和器材。</p>`}
      </section>

      <div class="field">
        <label for="manualNote">備註</label>
        <textarea id="manualNote" rows="3" placeholder="例如：器材多人、狀態一般、下次想加重量" data-manual-note>${draft.note || ""}</textarea>
      </div>

      <button class="primary-button" type="button" data-action="save-manual-record" ${draft.items.length ? "" : "disabled"}>儲存今日記錄</button>
      ${draft.items.length ? `<button class="secondary-button" type="button" data-action="discard-manual-record">清空今日記錄</button>` : ""}
    </div>
  `;
}
function currentManualDraft() {
  if (!state.manualDraft) {
    state.manualDraft = {
      gymId: state.selectedGymId,
      date: new Date().toISOString().slice(0, 10),
      items: [],
      note: ""
    };
  }
  return state.manualDraft;
}

function groupByCategory(equipment) {
  return equipment.reduce((groups, item) => {
    const category = item.category || "其他";
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
    return groups;
  }, {});
}

function equipmentPickerItem(item, draft) {
  const selected = draft.items.some((draftItem) => draftItem.sourceName === item.name);
  return `
    <button class="equipment-picker ${selected ? "selected" : ""}" type="button" data-action="toggle-manual-equipment" data-equipment-name="${item.name}">
      <span>
        <strong>${item.name}</strong>
        <small>${item.count} 部${item.nameEn ? ` · ${item.nameEn}` : ""}</small>
      </span>
      <b>${selected ? "已加入" : "加入"}</b>
    </button>
  `;
}

function manualDraftItemFromEquipment(equipment) {
  const lastRecord = latestRecordForEquipment(equipment.name);
  return {
    id: makeId(),
    sourceName: equipment.name,
    name: equipment.name,
    nameEn: equipment.nameEn || "",
    category: equipment.category || "未分類",
    sets: equipment.category === "有氧" ? [] : [{ weight: "", reps: "" }],
    cardio: equipment.category === "有氧" ? { minutes: "", speed: "", incline: "", distance: "" } : null,
    lastSets: lastRecord?.sets || [],
    lastCardio: lastRecord?.cardio || null,
    lastDate: lastRecord?.date || ""
  };
}

function latestRecordForEquipment(name) {
  for (const record of state.records) {
    const item = record.items?.find((entry) => entry.name === name);
    if (item) return { ...item, date: record.date };
  }
  return null;
}
function manualItemTemplate(item, index) {
  if (item.category === "有氧") return manualCardioTemplate(item, index);
  return `
    <article class="manual-item">
      <div class="card-row">
        <div>
          <h3>${item.name}</h3>
          <p class="muted small">${item.category || "未分類"}${item.nameEn ? ` · ${item.nameEn}` : ""}</p>
        </div>
        <button class="ghost-button danger" type="button" data-action="remove-manual-item" data-manual-index="${index}">移除</button>
      </div>
      ${lastRecordTemplate(item, index)}
      <div class="inline-log">
        ${item.sets.map((set, setIndex) => manualSetRow(index, setIndex, set)).join("")}
        <div class="set-actions">
          <button class="secondary-button compact-button" type="button" data-action="manual-remove-set" data-manual-index="${index}">- 減一組</button>
          <button class="secondary-button compact-button" type="button" data-action="manual-add-set" data-manual-index="${index}">+ 加一組</button>
        </div>
      </div>
    </article>
  `;
}

function lastRecordTemplate(item, index) {
  if (item.category === "有氧" && item.lastCardio) {
    return `
      <div class="last-record-box">
        <p>上次 ${item.lastDate}：${item.lastCardio.minutes || 0} 分鐘${item.lastCardio.distance ? ` · ${item.lastCardio.distance} km` : ""}</p>
        <button class="ghost-button" type="button" data-action="apply-last-record" data-manual-index="${index}">套用上次紀錄</button>
      </div>
    `;
  }

  if (item.lastSets?.length) {
    return `
      <div class="last-record-box">
        <p>上次 ${item.lastDate}：${item.lastSets.map((set) => `${set.weight || 0}kg x ${set.reps || 0}`).join("、")}</p>
        <button class="ghost-button" type="button" data-action="apply-last-record" data-manual-index="${index}">套用上次紀錄</button>
      </div>
    `;
  }

  return "";
}
function manualSetRow(itemIndex, setIndex, set) {
  return `
    <div class="set-row inline-set-row">
      <strong>第${setIndex + 1}組</strong>
      <div class="field">
        <label>重量 kg</label>
        <input inputmode="decimal" value="${set.weight ?? ""}" data-manual-field="weight" data-manual-index="${itemIndex}" data-set="${setIndex}">
      </div>
      <div class="field">
        <label>次數</label>
        <input inputmode="numeric" value="${set.reps ?? ""}" data-manual-field="reps" data-manual-index="${itemIndex}" data-set="${setIndex}">
      </div>
    </div>
  `;
}

function manualCardioTemplate(item, index) {
  const cardio = item.cardio || {};
  return `
    <article class="manual-item">
      <div class="card-row">
        <div>
          <h3>${item.name}</h3>
          <p class="muted small">有氧${item.nameEn ? ` · ${item.nameEn}` : ""}</p>
        </div>
        <button class="ghost-button danger" type="button" data-action="remove-manual-item" data-manual-index="${index}">移除</button>
      </div>
      ${lastRecordTemplate(item, index)}
      <div class="cardio-log-grid">
        <div class="field"><label>時間 分鐘</label><input inputmode="decimal" value="${cardio.minutes ?? ""}" data-manual-cardio-field="minutes" data-manual-index="${index}"></div>
        <div class="field"><label>速度</label><input inputmode="decimal" value="${cardio.speed ?? ""}" data-manual-cardio-field="speed" data-manual-index="${index}"></div>
        <div class="field"><label>斜度 / 阻力</label><input inputmode="decimal" value="${cardio.incline ?? ""}" data-manual-cardio-field="incline" data-manual-index="${index}"></div>
        <div class="field"><label>距離 km</label><input inputmode="decimal" value="${cardio.distance ?? ""}" data-manual-cardio-field="distance" data-manual-index="${index}"></div>
      </div>
    </article>
  `;
}
function renderGyms() {
  title.textContent = "選擇健身室";
  const districts = [...new Set(state.gyms.map((gym) => gym.district))];
  screen.innerHTML = `
    <div class="stack">
      <section class="card stack">
        <h2>官方資料</h2>
        <p class="muted">載入由康文署官方 JSON 生成的本機資料快照。手機版使用快照，是因為官方 JSON 不允許本機 PWA 直接跨域讀取。</p>
        <button class="secondary-button" type="button" data-action="sync-gyms">載入官方資料</button>
        <p class="muted small">${state.lastSync ? `最後同步：${state.lastSync}` : "尚未同步官方資料"}</p>
        ${state.officialDataInfo ? `<p class="muted small">官方快照：${state.officialDataInfo.gymCount || state.gyms.length} 間健身室</p>` : ""}
      </section>

      <div class="field">
        <label for="gymSearch">搜尋</label>
        <input id="gymSearch" type="search" placeholder="輸入地區或健身室名稱">
      </div>

      <section class="list" id="gymList">
        ${state.gyms.map(gymCard).join("")}
      </section>

      <p class="muted small">現有地區：${districts.join("、")}</p>
    </div>
  `;
}

function renderWorkout() {
  title.textContent = "今日流程";
  const workout = state.workoutDraft?.plan;
  if (!workout) {
    setTab("training");
    return;
  }

  screen.innerHTML = `
    <div class="stack">
      <section class="card">
        <h2>${workout.bodyParts.join("、")} · 主訓練 ${workout.duration} 分鐘</h2>
        <p class="muted">${selectedGym().name}</p>
        <p class="muted small">時間不包括熱身和收操 / 拉伸。</p>
        ${workout.condition !== "正常" ? `<p class="notice">今日狀態：${workout.condition}。已降低訓練量。</p>` : ""}
      </section>

      ${workout.sections.map((section, sectionIndex) => `
        <section class="workout-section">
          <h2>${section.title}</h2>
          ${section.items.length ? section.items.map((item, itemIndex) => workoutItemTemplate(item, sectionIndex, itemIndex)).join("") : `<div class="card"><p class="muted">沒有符合條件的固定器材，請返回調整部位或健身室。</p></div>`}
        </section>
      `).join("")}

      <button class="primary-button" type="button" data-action="finish-workout">完成並記錄</button>
      <button class="secondary-button" type="button" data-action="back-training">重新生成</button>
    </div>
  `;
}

function renderLog() {
  title.textContent = "記錄訓練";
  const workout = state.workoutDraft?.plan;
  if (!workout) {
    setTab("training");
    return;
  }

  const mainItems = workout.sections.find((section) => section.title === "主訓練")?.items || [];
  screen.innerHTML = `
    <form class="stack" data-form="save-log">
      <section class="card">
        <h2>${workout.bodyParts.join("、")} 訓練紀錄</h2>
        <p class="muted">輸入每組重量和次數。第一版資料會保存在這部手機的瀏覽器內。</p>
      </section>

      ${mainItems.map((item, index) => `
        <section class="card stack">
          <h3>${item.name}</h3>
          ${Array.from({ length: item.sets }, (_, setIndex) => `
            <div class="set-row">
              <strong>第${setIndex + 1}組</strong>
              <div class="field">
                <label>重量 kg</label>
                <input inputmode="decimal" name="weight-${index}-${setIndex}" value="">
              </div>
              <div class="field">
                <label>次數</label>
                <input inputmode="numeric" name="reps-${index}-${setIndex}" value="${item.reps}">
              </div>
            </div>
          `).join("")}
        </section>
      `).join("")}

      <div class="field">
        <label for="logNote">備註</label>
        <textarea id="logNote" name="note" rows="3" placeholder="例如：器材多人、感覺疲倦、重量太輕"></textarea>
      </div>

      <button class="primary-button" type="submit">儲存訓練</button>
    </form>
  `;
}

function renderRecords() {
  title.textContent = "紀錄";
  const activeManualRecord = state.manualDraft?.items?.length ? state.manualDraft : null;
  screen.innerHTML = `
    <div class="stack">
      ${activeManualRecord ? activeManualRecordCard(activeManualRecord) : ""}
      ${state.records.length ? state.records.map((record) => `
        <section class="card record-card" data-action="view-record" data-record-id="${record.id}">
          <div class="card-row">
            <div>${recordSummary(record)}</div>
            <button class="ghost-button danger" type="button" data-action="delete-record" data-record-id="${record.id}">刪除</button>
          </div>
          <ul class="equipment-list">
            ${record.items.map(recordItemSummary).join("")}
          </ul>
        </section>
      `).join("") : `<section class="card"><p class="muted">未有訓練紀錄</p></section>`}
    </div>
  `;
}

function renderRecordDetail() {
  title.textContent = "紀錄詳情";
  const record = state.records.find((item) => item.id === state.selectedRecordId);
  if (!record) {
    setTab("records");
    return;
  }

  screen.innerHTML = `
    <div class="stack">
      <button class="secondary-button" type="button" data-action="back-records">返回紀錄</button>
      <section class="card">
        ${recordSummary(record)}
        ${record.note ? `<p class="muted">${record.note}</p>` : ""}
      </section>
      ${record.items.map((item) => `
        <section class="card stack">
<h2>${item.name}</h2>
          ${item.nameEn ? `<p class="muted small">${item.nameEn}</p>` : ""}
          ${item.cardio ? cardioRecordDetail(item.cardio) : strengthRecordDetail(item.sets || [])}
        </section>
      `).join("")}
    </div>
  `;
}

function activeManualRecordCard(draft) {
  const gym = state.gyms.find((item) => item.id === draft.gymId) || selectedGym();
  return `
    <section class="card record-card pending-record">
      <div class="status-row">
        <h3>${draft.date}</h3>
        <span class="status-badge pending">未儲存</span>
      </div>
      <p class="muted">${gym.name}</p>
      <p>${draft.items.length} 項器材</p>
      <button class="primary-button" type="button" data-action="start-training">繼續記錄</button>
    </section>
  `;
}

function recordItemSummary(item) {
  if (item.cardio) {
    const minutes = item.cardio.minutes ? `${item.cardio.minutes} 分鐘` : "有氧";
    return `<li>${item.name} · ${minutes}</li>`;
  }
  return `<li>${item.name} · ${(item.sets || []).length} 組</li>`;
}

function strengthRecordDetail(sets) {
  return `
    <div class="record-set-list">
      ${sets.map((set, index) => `
        <div class="record-set-row">
          <strong>第${index + 1}組</strong>
          <span>${set.weight || 0} kg</span>
          <span>${set.reps || 0} 次</span>
        </div>
      `).join("")}
    </div>
  `;
}

function cardioRecordDetail(cardio) {
  return `
    <div class="record-set-list">
      <div class="record-set-row"><strong>時間</strong><span>${cardio.minutes || 0}</span><span>分鐘</span></div>
      <div class="record-set-row"><strong>速度</strong><span>${cardio.speed || "-"}</span><span></span></div>
      <div class="record-set-row"><strong>斜度</strong><span>${cardio.incline || "-"}</span><span></span></div>
      <div class="record-set-row"><strong>距離</strong><span>${cardio.distance || 0}</span><span>km</span></div>
    </div>
  `;
}
function activeWorkoutRecord(workout) {
  const allItems = workout.sections.flatMap((section) => section.items);
  const mainItems = workout.sections.find((section) => section.title === "主訓練")?.items || [];
  const completedCount = allItems.filter((item) => item.complete).length;

  return `
    <section class="card record-card pending-record">
      <div class="card-row">
        <div>
          <div class="status-row">
            <h3>${new Date().toISOString().slice(0, 10)}</h3>
            <span class="status-badge pending">未完成</span>
          </div>
          <p class="muted">${selectedGym().name}</p>
          <p>${workout.bodyParts.join("、")} · ${workout.duration} 分鐘 · ${mainItems.length} 個主訓練動作</p>
          <p class="muted small">已完成 ${completedCount}/${allItems.length} 項</p>
        </div>
      </div>
      <button class="primary-button" type="button" data-action="continue-workout">繼續進行</button>
      <button class="secondary-button" type="button" data-action="discard-workout">放棄今日流程</button>
    </section>
  `;
}

function saveCurrentWorkout() {
  const workout = state.workoutDraft?.plan;
  if (!workout) return;
  const mainItems = workout.sections.find((section) => section.title === "主訓練")?.items || [];
  const record = {
    id: makeId(),
    date: new Date().toISOString().slice(0, 10),
    gymName: selectedGym().name,
    bodyPart: workout.bodyParts.join("、"),
    duration: workout.duration,
    note: "",
    items: mainItems.map((item) => ({
      name: item.name,
      sets: (item.loggedSets || defaultLoggedSets(item)).map((set) => ({
        weight: Number(set.weight) || 0,
        reps: Number(set.reps) || 0
      }))
    }))
  };
  state.records.unshift(record);
  state.workoutDraft = null;
  saveState();
}

function saveManualRecord() {
  const draft = state.manualDraft;
  if (!draft?.items?.length) return;
  const gym = state.gyms.find((item) => item.id === draft.gymId) || selectedGym();
  const categories = unique(draft.items.map((item) => item.category || "未分類")).join("、");
  const record = {
    id: makeId(),
    date: draft.date || new Date().toISOString().slice(0, 10),
    gymId: gym.id,
    gymName: gym.name,
    bodyPart: categories,
    categories,
    duration: null,
    note: draft.note || "",
    items: draft.items.map((item) => ({
      name: item.name,
      nameEn: item.nameEn || "",
      category: item.category || "未分類",
      sets: item.category === "有氧" ? [] : (item.sets || []).map((set) => ({
        weight: Number(set.weight) || 0,
        reps: Number(set.reps) || 0
      })),
      cardio: item.category === "有氧" ? {
        minutes: Number(item.cardio?.minutes) || 0,
        speed: item.cardio?.speed || "",
        incline: item.cardio?.incline || "",
        distance: Number(item.cardio?.distance) || 0
      } : null
    }))
  };
  state.records.unshift(record);
  state.manualDraft = null;
  saveState();
}
function hasIncompleteWorkoutItems() {
  const workout = state.workoutDraft?.plan;
  if (!workout) return false;
  return workout.sections.flatMap((section) => section.items).some((item) => !item.complete);
}

function recordVolume(record) {
  return (record.items || []).reduce((sum, item) => sum + itemVolume(item), 0);
}

function itemVolume(item) {
  return (item.sets || []).reduce((sum, set) => sum + ((Number(set.weight) || 0) * (Number(set.reps) || 0)), 0);
}

function totalTrainingVolume() {
  return state.records.reduce((sum, record) => sum + recordVolume(record), 0);
}

function topExerciseVolumes() {
  const totals = new Map();
  for (const record of state.records) {
    for (const item of record.items || []) {
      const volume = itemVolume(item);
      if (!volume) continue;
      totals.set(item.name, (totals.get(item.name) || 0) + volume);
    }
  }
  return [...totals.entries()]
    .map(([name, volume]) => ({ name, volume }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5);
}

function recentExerciseProgress() {
  const byName = new Map();
  for (const record of state.records) {
    for (const item of record.items || []) {
      const volume = itemVolume(item);
      if (!volume) continue;
      if (!byName.has(item.name)) byName.set(item.name, []);
      byName.get(item.name).push({ date: record.date, volume, item });
    }
  }

  return [...byName.entries()]
    .map(([name, entries]) => {
      const sorted = entries.sort((a, b) => b.date.localeCompare(a.date));
      const latest = sorted[0];
      const previous = sorted[1];
      return {
        name,
        latestDate: latest.date,
        latestVolume: latest.volume,
        change: previous ? latest.volume - previous.volume : null
      };
    })
    .sort((a, b) => b.latestDate.localeCompare(a.latestDate))
    .slice(0, 5);
}

function formatVolume(value) {
  return `${Math.round(value).toLocaleString("zh-HK")} kg`;
}
function renderAnalytics() {
  title.textContent = "分析";
  const bodyPartCounts = countBy(state.records, "bodyPart");
  const maxBodyPart = Math.max(1, ...Object.values(bodyPartCounts));
  const weekly = weeklyCount();
  const maxWeekly = Math.max(1, ...weekly.map((item) => item.count));
  const totalVolume = totalTrainingVolume();
  const topVolumes = topExerciseVolumes();
  const progress = recentExerciseProgress();
  const maxExerciseVolume = Math.max(1, ...topVolumes.map((item) => item.volume));

  screen.innerHTML = `
    <div class="stack">
      <section class="metric-grid">
        <div class="metric">
          <strong>${state.records.length}</strong>
          <span class="muted">總訓練次數</span>
        </div>
        <div class="metric">
          <strong>${formatVolume(totalVolume)}</strong>
          <span class="muted">總重量訓練量</span>
        </div>
      </section>

      <section class="card stack">
        <h2>每週訓練次數</h2>
        <div class="bar-chart">
          ${weekly.map((item) => barRow(item.label, item.count, maxWeekly)).join("")}
        </div>
      </section>

      <section class="card stack">
        <h2>部位 / 分類比例</h2>
        <div class="bar-chart">
          ${Object.entries(bodyPartCounts).map(([label, count]) => barRow(label, count, maxBodyPart)).join("") || `<p class="muted">未有資料</p>`}
        </div>
      </section>

      <section class="card stack">
        <h2>器材訓練量</h2>
        <div class="bar-chart">
          ${topVolumes.length ? topVolumes.map((item) => barRow(item.name, Math.round(item.volume), maxExerciseVolume)).join("") : `<p class="muted">未有重量訓練資料</p>`}
        </div>
      </section>

      <section class="card stack">
        <h2>最近進步</h2>
        ${progress.length ? progress.map((item) => `
          <div class="progress-row">
            <div>
              <strong>${item.name}</strong>
              <p class="muted small">${item.latestDate} · ${formatVolume(item.latestVolume)}</p>
            </div>
            <span class="status-badge ${item.change === null || item.change >= 0 ? "complete" : "pending"}">${item.change === null ? "首次" : `${item.change >= 0 ? "+" : ""}${formatVolume(item.change)}`}</span>
          </div>
        `).join("") : `<p class="muted">未有足夠資料比較。</p>`}
      </section>

      <section class="card stack">
        <h2>體重變化</h2>
        <div class="bar-chart">
          ${state.weights.map((item) => barRow(item.date.slice(5), item.value, Math.max(...state.weights.map((weight) => weight.value)))).join("")}
        </div>
      </section>
    </div>
  `;
}
function renderSettings() {
  const isFirstSetup = !state.profileComplete;
  title.textContent = isFirstSetup ? "開始使用" : "設定";
  const goals = normalizeGoals(state.profile);
  screen.innerHTML = `
    <form class="stack" data-form="settings">
      <section class="card form-grid">
        <h2>個人資料</h2>
        ${isFirstSetup ? `<p class="muted">請先輸入基本資料，之後 App 會用它配合你的訓練紀錄和身體情況做分析。</p>` : ""}
        <div class="field">
          <label for="height">身高 cm</label>
          <input id="height" name="height" inputmode="decimal" value="${state.profile.height}">
        </div>
        <div class="field">
          <label for="weight">體重 kg</label>
          <input id="weight" name="weight" inputmode="decimal" value="${state.profile.weight}">
        </div>
        <div class="field">
          <label>健身目標，可選多於一項</label>
          <div class="choice-grid two">
            ${["增肌", "減脂", "力量", "健康"].map((value) => `
              <button class="chip ${goals.includes(value) ? "active" : ""}" type="button" data-goal-toggle="${value}">
                ${value}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="field">
          <label for="level">經驗程度</label>
          <select id="level" name="level">
            ${["新手", "中階", "進階"].map((value) => option(value, state.profile.level)).join("")}
          </select>
        </div>
        <div class="field">
          <label for="injury">受傷限制</label>
          <select id="injury" name="injury">
            ${["無", "肩", "腰", "膝", "其他"].map((value) => option(value, state.profile.injury)).join("")}
          </select>
        </div>
      </section>
      <button class="primary-button" type="submit">${isFirstSetup ? "開始使用" : "儲存設定"}</button>
      ${isFirstSetup ? "" : `<button class="secondary-button" type="button" data-action="choose-gym">更改常用健身室</button>`}
    </form>
  `;
}

function renderTestMode() {
  title.textContent = "測試模式";
  const options = state.testOptions || defaultTestOptions();
  options.bodyParts = normalizeBodyParts(options);
  const gym = state.gyms.find((item) => item.id === options.gymId) || selectedGym();
  const result = generateWorkout({ ...options, gymId: gym.id });
  const mainSection = result.sections.find((section) => section.title === "主訓練");
  const candidates = debugWorkoutCandidates(gym, options);

  screen.innerHTML = `
    <form class="stack" data-form="test-options">
      <section class="card stack">
        <h2>測試條件</h2>
        <div class="field">
          <label for="testGym">健身室</label>
          <select id="testGym" name="gymId">
            ${state.gyms.map((item) => `<option value="${item.id}" ${item.id === gym.id ? "selected" : ""}>${item.district} · ${item.name}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>部位</label>
          ${multiChoiceGrid("testBodyParts", ["胸", "上胸", "中胸", "下胸", "背", "腿", "臀部", "肩", "手臂", "二頭肌", "三頭肌", "核心", "全身"], options.bodyParts)}
        </div>
        <div class="field">
          <label>時間</label>
          ${choiceGrid("testDuration", ["30", "45", "60", "90"], String(options.duration), "two")}
        </div>
        <label class="card-row">
          <span>加入有氧</span>
          <input type="checkbox" name="includeCardio" ${options.includeCardio ? "checked" : ""}>
        </label>
        <label class="card-row">
          <span>使用啞鈴</span>
          <input type="checkbox" name="useDumbbells" ${options.useDumbbells !== false ? "checked" : ""}>
        </label>
        <button class="primary-button" type="submit">重新測試</button>
      </section>

      <section class="card stack">
        <h2>生成結果</h2>
        <p class="muted">${gym.name} · ${options.bodyParts.join("、")} · 主訓練 ${options.duration} 分鐘</p>
        ${mainSection.items.length ? mainSection.items.map((item) => `
          <div class="debug-result">
            <h3>${item.name}</h3>
            <p>場地器材：${item.matchedEquipment || "未命中"}</p>
            <p class="muted small">類型：${item.movementType || "未分類"} · ${item.sets} 組 x ${item.reps} 次 · 休息 ${item.rest} 秒</p>
          </div>
        `).join("") : `<p class="notice">沒有生成主訓練。通常是該場地沒有命中相關器材，或 aliases 未覆蓋官方器材名稱。</p>`}
      </section>

      <section class="card stack">
        <h2>候選動作</h2>
        ${candidates.length ? candidates.map((item) => `
          <div class="debug-result">
            <h3>${item.name}</h3>
            <p>命中：${item.matchedEquipment}</p>
            <p class="muted small">類型：${item.movementType || "未分類"} · 優先度：${item.priority || 50}</p>
          </div>
        `).join("") : `<p class="muted">沒有候選動作。</p>`}
      </section>

      <section class="card stack">
        <h2>該場地器材 aliases</h2>
        <div class="debug-alias-list">
          ${gym.equipment.map((item) => `
            <div>
              <strong>${item.name} x ${item.count}</strong>
              <p class="muted small">${(item.aliases || []).join("、") || "未有 alias"}</p>
            </div>
          `).join("")}
        </div>
      </section>
    </form>
  `;
}

function choiceGrid(name, choices, selected, className = "") {
  return `
    <div class="choice-grid ${className}">
      ${choices.map((choice) => `
        <button class="chip ${selected === choice ? "active" : ""}" type="button" data-choice="${name}" data-value="${choice}">
          ${name === "duration" ? `${choice}分鐘` : choice}
        </button>
      `).join("")}
    </div>
  `;
}

function multiChoiceGrid(name, choices, selectedValues, className = "") {
  return `
    <div class="choice-grid ${className}">
      ${choices.map((choice) => `
        <button class="chip ${selectedValues.includes(choice) ? "active" : ""}" type="button" data-multi-choice="${name}" data-value="${choice}">
          ${choice}
        </button>
      `).join("")}
    </div>
  `;
}

function gymCard(gym) {
  const selected = gym.id === state.selectedGymId;
  return `
    <button class="list-item" type="button" data-action="select-gym" data-gym-id="${gym.id}">
      <div class="card-row">
        <div>
          <h3>${gym.name}</h3>
          <p class="muted">${gym.district} · ${gym.address}</p>
          <p class="muted small">${gym.openingHours}</p>
        </div>
        <strong>${selected ? "已選" : "選擇"}</strong>
      </div>
      <ul class="equipment-list">
        ${gym.equipment.slice(0, 8).map((item) => `<li>${item.name} x ${item.count}</li>`).join("")}
      </ul>
      ${gym.equipment.length > 8 ? `<p class="muted small">另有 ${gym.equipment.length - 8} 項器材</p>` : ""}
      <span class="inline-link" data-action="show-equipment" data-gym-id="${gym.id}">顯示所有器材</span>
    </button>
  `;
}

function renderEquipmentModal(gym) {
  document.querySelector("#equipmentModal")?.remove();
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" id="equipmentModal" role="dialog" aria-modal="true" aria-labelledby="equipmentTitle">
      <div class="demo-modal">
        <div class="card-row">
          <div>
            <p class="eyebrow">器材清單</p>
            <h2 id="equipmentTitle">${gym.name}</h2>
            <p class="muted small">${gym.equipment.length} 項官方器材記錄</p>
          </div>
          <button class="icon-button" type="button" data-action="close-equipment" aria-label="關閉">×</button>
        </div>
        <div class="equipment-modal-list">
          ${gym.equipment.map((item) => `
            <div class="equipment-row">
              <div>
                <strong>${item.name}</strong>
                <p class="muted small">${item.category || "未分類"}${item.sharedWithDisabled ? " · 可供殘疾人士共用" : ""}</p>
              </div>
              <span>x ${item.count}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `);
}

function workoutItemTemplate(item, sectionIndex, itemIndex) {
  const sectionTitle = state.workoutDraft?.plan?.sections?.[sectionIndex]?.title || "";
  const isMainTraining = sectionTitle === "主訓練";
  const loggedSets = item.loggedSets || defaultLoggedSets(item);
  return `
    <article class="workout-item ${item.complete ? "complete" : ""}" data-action="show-demo" data-section="${sectionIndex}" data-item="${itemIndex}">
      <div class="card-row">
        <div>
          <h3>${item.name}</h3>
          <p class="muted">${item.equipment || "徒手"} · ${item.sets ? `${item.sets}組 x ${item.reps}次` : `${item.minutes}分鐘`}</p>
          ${isMainTraining ? recommendationReasonTemplate(item) : ""}
          ${item.settings?.length ? `<p class="small settings-line">${item.settings.join(" · ")}</p>` : ""}
          <p class="small muted">${item.rest ? `休息 ${item.rest}秒 · ` : ""}${item.tip}</p>
        </div>
        <button class="ghost-button workout-status" type="button" data-action="toggle-item" data-section="${sectionIndex}" data-item="${itemIndex}">
          ${item.complete ? "完成" : "未完成"}
        </button>
      </div>
      ${isMainTraining && item.complete ? `
        <div class="inline-log" data-stop-demo="true">
          ${loggedSets.map((set, setIndex) => setLogRow(sectionIndex, itemIndex, setIndex, set)).join("")}
          <div class="set-actions">
            <button class="secondary-button compact-button" type="button" data-action="remove-set" data-section="${sectionIndex}" data-item="${itemIndex}">- 減一組</button>
            <button class="secondary-button compact-button" type="button" data-action="add-set" data-section="${sectionIndex}" data-item="${itemIndex}">+ 加一組</button>
          </div>
        </div>
      ` : ""}
    </article>
  `;
}

function recommendationReasonTemplate(item) {
  const reasons = [
    item.matchedEquipment ? `因場地有：${item.matchedEquipment}` : "未能確認場地器材",
    item.bodyParts?.length ? `訓練部位：${item.bodyParts.join(" / ")}` : "",
    item.movementType ? `動作類型：${movementTypeLabel(item.movementType)}` : "",
    item.usesDumbbells ? "需要啞鈴" : "不使用啞鈴亦適用"
  ].filter(Boolean);

  return `
    <div class="recommendation-reasons">
      ${reasons.map((reason) => `<span>${reason}</span>`).join("")}
    </div>
  `;
}

function movementTypeLabel(type) {
  const labels = {
    "chest-press": "推胸",
    "upper-chest-press": "上胸推舉",
    "lower-chest-press": "下胸推舉",
    "chest-fly": "夾胸 / 飛鳥",
    "back-pull": "垂直拉背",
    "back-row": "水平划船",
    "back-extension": "背伸展",
    "leg-press": "腿推 / 深蹲模式",
    "leg-extension": "前腿伸展",
    "leg-curl": "後腿彎舉",
    "hip-extension": "臀部伸展",
    "hip-abduction": "臀部外展",
    "hip-adduction": "大腿內收",
    "shoulder-press": "肩推",
    "shoulder-raise": "側平舉",
    "biceps-curl": "二頭彎舉",
    "triceps-extension": "三頭伸展",
    "core-flexion": "腹部屈曲",
    "core-rotation": "核心旋轉"
  };
  return labels[type] || type;
}

function defaultLoggedSets(item) {
  return Array.from({ length: item.sets || 1 }, () => ({
    weight: "",
    reps: item.reps || ""
  }));
}

function setLogRow(sectionIndex, itemIndex, setIndex, set) {
  return `
    <div class="set-row inline-set-row">
      <strong>第${setIndex + 1}組</strong>
      <div class="field">
        <label>重量 kg</label>
        <input inputmode="decimal" value="${set.weight ?? ""}" data-log-field="weight" data-section="${sectionIndex}" data-item="${itemIndex}" data-set="${setIndex}">
      </div>
      <div class="field">
        <label>次數</label>
        <input inputmode="numeric" value="${set.reps ?? ""}" data-log-field="reps" data-section="${sectionIndex}" data-item="${itemIndex}" data-set="${setIndex}">
      </div>
    </div>
  `;
}

function renderDemoModal(item) {
  document.querySelector("#demoModal")?.remove();
  const target = demoTarget(item);
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" id="demoModal" role="dialog" aria-modal="true" aria-labelledby="demoTitle">
      <div class="demo-modal">
        <div class="card-row">
          <div>
            <p class="eyebrow">示範影片</p>
            <h2 id="demoTitle">${item.name}</h2>
          </div>
          <button class="icon-button" type="button" data-action="close-demo" aria-label="關閉">×</button>
        </div>
        <div class="demo-panel">
          <h3>${item.name}</h3>
          <p class="muted">${item.equipment || "徒手"} · ${item.sets ? `${item.sets}組 x ${item.reps}次` : `${item.minutes}分鐘`}</p>
          ${item.settings?.length ? `<ul class="equipment-list">${item.settings.map((setting) => `<li>${setting}</li>`).join("")}</ul>` : ""}
          <p>${item.tip}</p>
        </div>
        ${target ? `<a class="primary-link-button" href="${target.url}" target="_blank" rel="noopener">${target.label}</a>` : `<p class="notice">暫未有指定專業教學連結。</p>`}
        <p class="muted small">影片只作動作參考；如有痛楚或不適，應停止該動作。</p>
      </div>
    </div>
  `);
}

function demoTarget(item) {
  const directUrl = professionalDemoUrl(item);
  if (directUrl) {
    return {
      url: directUrl,
      label: directUrl.includes("youtube.com") ? "開啟指定示範影片" : "開啟專業示範教學"
    };
  }
  return null;
}

function professionalDemoUrl(item) {
  const name = item.name;
  const equipment = item.equipment || "";
  const mappings = [
    { keys: ["跑步機", "快走"], url: "https://www.nhs.uk/live-well/exercise/how-to-warm-up-before-exercising/" },
    { keys: ["腿部推蹬", "腿部推蹬機"], url: "https://weighttraining.guide/exercises/incline-leg-press/" },
    { keys: ["腿伸展", "伸腿"], url: "https://weighttraining.guide/exercises/leg-extension/" },
    { keys: ["腿彎舉", "屈腿"], url: "https://weighttraining.guide/exercises/seated-leg-curl/" },
    { keys: ["推胸練習器", "推胸", "輕重量推胸", "上斜推胸", "下斜推胸"], url: "https://weighttraining.guide/exercises/machine-chest-press/" },
    { keys: ["蝴蝶機", "飛鳥", "夾胸"], url: "https://weighttraining.guide/exercises/machine-fly/" },
    { keys: ["伏地挺身"], url: "https://www.acefitness.org/resources/everyone/exercise-library/41/push-up/" },
    { keys: ["肩推機", "肩推"], url: "https://weighttraining.guide/exercises/smith-machine-seated-overhead-press/" },
    { keys: ["坐姿划船", "坐姿划船機"], url: "https://weighttraining.guide/exercises/seated-cable-row/" },
    { keys: ["背伸展", "羅馬椅"], url: "https://weighttraining.guide/exercises/machine-back-extension/" },
    { keys: ["高位下拉", "下拉", "輕重量下拉"], url: "https://weighttraining.guide/exercises/wide-grip-lat-pull-down/" },
    { keys: ["啞鈴深蹲"], url: "https://weighttraining.guide/exercises/dumbbell-squat/" },
    { keys: ["啞鈴臀橋", "臀橋"], url: "https://weighttraining.guide/exercises/barbell-glute-bridge/" },
    { keys: ["臀部訓練機"], url: "https://weighttraining.guide/exercises/standing-cable-hip-extension/" },
    { keys: ["啞鈴彎舉", "輕重量彎舉", "二頭肌"], url: "https://www.acefitness.org/resources/everyone/exercise-library/15/biceps-curl/" },
    { keys: ["三頭下壓", "三頭肌"], url: "https://weighttraining.guide/exercises/triceps-push-down/" },
    { keys: ["二頭肌訓練機"], url: "https://weighttraining.guide/exercises/machine-preacher-curl/" },
    { keys: ["側平舉"], url: "https://weighttraining.guide/exercises/cable-one-arm-lateral-raise/" },
    { keys: ["椅上臂屈伸"], url: "https://weighttraining.guide/exercises/bench-dip/" },
    { keys: ["腹肌訓練"], url: "https://www.acefitness.org/resources/everyone/exercise-library/52/crunch/" },
    { keys: ["轉體", "扭腰", "旋體"], url: "https://weighttraining.guide/exercises/cable-twist/" },
    { keys: ["平板支撐"], url: "https://www.acefitness.org/resources/everyone/exercise-library/32/front-plank/" },
    { keys: ["徒手深蹲"], url: "https://www.acefitness.org/resources/everyone/exercise-library/135/bodyweight-squat/" },
    { keys: ["健身單車", "單車", "橢圓機", "橢圓運轉機", "樓梯機", "踏步機", "低衝擊有氧"], url: "https://www.nhs.uk/live-well/exercise/running-and-aerobic-exercises/" },
    { keys: ["划艇機", "划艇"], url: "https://www.concept2.com/training/rowing-technique" },
    { keys: ["肩關節活動", "動態拉伸"], url: "https://www.acefitness.org/resources/everyone/blog/5219/yoga-inspired-dynamic-warm-up/" },
    { keys: ["肩胛啟動", "肩袖活動", "彈力帶外旋", "肩袖放鬆"], url: "https://www.ouh.nhs.uk/physiotherapy/outpatients/videos/" },
    { keys: ["髖關節活動", "髖屈肌拉伸"], url: "https://www.ouh.nhs.uk/oxparc/information/videos/hip-flexor/" },
    { keys: ["胸肌拉伸", "肩前側拉伸", "腿後肌拉伸", "臀肌拉伸", "全身簡短拉伸"], url: "https://www.nhs.uk/live-well/exercise/how-to-stretch-after-exercising/" },
    { keys: ["上背伸展", "背闊肌拉伸"], url: "https://www.nhs.uk/live-well/exercise/strength-and-flex-exercise-plan-how-to-videos/" },
    { keys: ["股四頭肌拉伸"], url: "https://www.southtees.nhs.uk/resources/quads-stretch/" },
    { keys: ["三角肌拉伸"], url: "https://www.homerton.nhs.uk/shoulder-class/" },
    { keys: ["手肘和手腕活動"], url: "https://resources.specialolympics.org/sports-essentials/sports-and-coaching/warm-up-and-cool-down-videos" },
    { keys: ["二頭肌拉伸", "腹部伸展"], url: "https://www.taylorphysicaltherapy.com/video-library/sports-performance/upper-extremity-mobility" },
    { keys: ["三頭肌拉伸"], url: "https://resources.specialolympics.org/sports-essentials/sports-and-coaching/warm-up-and-cool-down-videos/cool-down-triceps-stretch" },
    { keys: ["前臂放鬆"], url: "https://resources.specialolympics.org/sports-essentials/sports-and-coaching/warm-up-and-cool-down-videos" },
    { keys: ["呼吸放鬆"], url: "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/" }
  ];
  const combined = `${name} ${equipment}`;
  return mappings.find((mapping) => mapping.keys.some((key) => combined.includes(key)))?.url || "";
}

function option(value, selected) {
  return `<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`;
}

function recordSummary(record) {
  const itemCount = record.items?.length || 0;
  const label = record.bodyPart || record.categories || "手動記錄";
  const detail = record.duration ? `${label} · ${record.duration} 分鐘 · ${itemCount} 個主訓練動作` : `${label} · ${itemCount} 項器材`;
  return `
    <div class="status-row">
      <h3>${record.date}</h3>
      <span class="status-badge complete">已完成</span>
    </div>
    <p class="muted">${record.gymName}</p>
    <p>${detail}</p>
  `;
}
function barRow(label, value, max) {
  const width = Math.max(6, Math.round((Number(value) / max) * 100));
  return `
    <div class="bar-row">
      <span>${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
      <strong>${value}</strong>
    </div>
  `;
}

function generateWorkout(options) {
  const gym = options.gymId
    ? state.gyms.find((item) => item.id === options.gymId) || selectedGym()
    : selectedGym();
  const equipmentTerms = availableEquipmentTerms(gym.equipment);
  const bodyParts = normalizeBodyParts(options);
  const base = getPrescription(options);
  const candidates = exerciseLibrary()
    .filter((exercise) => bodyParts.includes("全身") || exercise.bodyParts.some((bodyPart) => bodyParts.includes(bodyPart)))
    .filter((exercise) => options.useDumbbells !== false || !exercise.usesDumbbells)
    .filter((exercise) => exercise.equipment !== "徒手")
    .filter((exercise) => exerciseMatchesEquipment(exercise, equipmentTerms));
  const main = selectWorkoutExercises(candidates, bodyParts, base.exerciseCount)
    .map((exercise) => ({
      name: exercise.name,
      equipment: exercise.equipment,
      matchedEquipment: matchedEquipmentName(exercise, equipmentTerms),
      movementType: exercise.movementType,
      bodyParts: exercise.bodyParts,
      usesDumbbells: Boolean(exercise.usesDumbbells),
      sets: base.sets,
      reps: base.reps,
      rest: base.rest,
      tip: exercise.tip,
      settings: exercise.settings || [],
      complete: false
    }));

  const sections = [
    {
      title: "熱身",
      items: warmups(bodyParts, base.warmupMinutes)
    },
    {
      title: "主訓練",
      items: main
    }
  ];

  if (options.includeCardio) {
    sections.push({
      title: "有氧",
      items: [cardioItem(gym, options, base.cardioMinutes)]
    });
  }

  sections.push({
    title: "收操 / 拉伸",
    items: stretches(bodyParts)
  });

  return { ...options, bodyParts, sections };
}

function selectWorkoutExercises(candidates, bodyParts, limit) {
  const selected = [];
  const selectedNames = new Set();
  const plan = bodyParts.includes("全身")
    ? ["chest-press", "back-pull", "back-row", "leg-press", "shoulder-press", "core-flexion"]
    : unique(bodyParts.flatMap((bodyPart) => movementPlan(bodyPart)));

  for (const movementType of plan) {
    const exercise = bestCandidate(candidates, selectedNames, (candidate) => candidate.movementType === movementType);
    if (exercise) addSelected(exercise);
    if (selected.length >= limit) return selected;
  }

  for (const exercise of [...candidates].sort((a, b) => (a.priority || 50) - (b.priority || 50))) {
    if (addSelected(exercise) && selected.length >= limit) break;
  }

  return selected;

  function addSelected(exercise) {
    if (!exercise || selectedNames.has(exercise.name)) return false;
    selected.push(exercise);
    selectedNames.add(exercise.name);
    return true;
  }
}

function movementPlan(bodyPart) {
  const plans = {
    "胸": ["chest-press", "chest-fly", "triceps-extension"],
    "上胸": ["upper-chest-press", "chest-press"],
    "中胸": ["chest-press", "chest-fly"],
    "下胸": ["lower-chest-press", "chest-press"],
    "背": ["back-pull", "back-row", "back-extension"],
    "腿": ["leg-press", "leg-extension", "leg-curl"],
    "臀部": ["leg-press", "hip-extension", "hip-abduction", "leg-curl"],
    "肩": ["shoulder-press", "shoulder-raise"],
    "手臂": ["biceps-curl", "triceps-extension"],
    "二頭肌": ["biceps-curl"],
    "三頭肌": ["triceps-extension"],
    "核心": ["core-flexion", "core-rotation"]
  };
  return plans[bodyPart] || [];
}

function bestCandidate(candidates, selectedNames, predicate) {
  return candidates
    .filter((candidate) => !selectedNames.has(candidate.name) && predicate(candidate))
    .sort((a, b) => (a.priority || 50) - (b.priority || 50))[0];
}

function normalizeBodyParts(options) {
  if (Array.isArray(options.bodyParts) && options.bodyParts.length) return options.bodyParts;
  if (options.bodyPart) return [options.bodyPart];
  return ["胸"];
}

function defaultTestOptions() {
  return {
    gymId: state.selectedGymId,
    bodyParts: ["胸"],
    duration: 45,
    includeCardio: true,
    useDumbbells: true,
    condition: "正常"
  };
}

function debugWorkoutCandidates(gym, options) {
  const equipmentTerms = availableEquipmentTerms(gym.equipment);
  const bodyParts = normalizeBodyParts(options);
  return exerciseLibrary()
    .filter((exercise) => bodyParts.includes("全身") || exercise.bodyParts.some((bodyPart) => bodyParts.includes(bodyPart)))
    .filter((exercise) => options.useDumbbells !== false || !exercise.usesDumbbells)
    .filter((exercise) => exercise.equipment !== "徒手")
    .map((exercise) => ({
      ...exercise,
      matchedEquipment: matchedEquipmentName(exercise, equipmentTerms)
    }))
    .filter((exercise) => exercise.matchedEquipment)
    .sort((a, b) => (a.priority || 50) - (b.priority || 50));
}

function getPrescription(options) {
  const primaryGoal = normalizeGoals(state.profile)[0] || "增肌";
  const goalMap = {
    "增肌": { sets: 3, reps: 10, rest: 90 },
    "減脂": { sets: 3, reps: 12, rest: 45 },
    "力量": { sets: 4, reps: 5, rest: 150 },
    "健康": { sets: 2, reps: 12, rest: 75 }
  };
  const timeMap = {
    30: { warmupMinutes: 5, exerciseCount: 3, cardioMinutes: 5 },
    45: { warmupMinutes: 8, exerciseCount: 4, cardioMinutes: 8 },
    60: { warmupMinutes: 10, exerciseCount: 5, cardioMinutes: 12 },
    90: { warmupMinutes: 15, exerciseCount: 6, cardioMinutes: 18 }
  };
  const prescription = { ...goalMap[primaryGoal], ...timeMap[options.duration] };
  if (options.condition !== "正常") {
    prescription.sets = Math.max(2, prescription.sets - 1);
    prescription.exerciseCount = Math.max(2, prescription.exerciseCount - 1);
    prescription.cardioMinutes = Math.max(5, prescription.cardioMinutes - 3);
  }
  return prescription;
}

function exerciseLibrary() {
  return [
    { name: "推胸練習器", equipment: "推胸練習器", match: ["推胸", "胸"], bodyParts: ["胸", "中胸", "三頭肌"], movementType: "chest-press", priority: 10, settings: ["座椅高度：手柄約胸口中線"], tip: "肩胛穩定，推起時不要鎖死手肘。" },
    { name: "上斜推胸機", equipment: "上斜推胸機", match: ["上斜", "推胸"], bodyParts: ["胸", "上胸", "三頭肌"], movementType: "upper-chest-press", priority: 11, settings: ["座椅高度：手柄約上胸位置"], tip: "推起方向略向上，肩膀不要聳起。" },
    { name: "下斜推胸機", equipment: "下斜推胸機", match: ["下斜", "推胸"], bodyParts: ["胸", "下胸", "三頭肌"], movementType: "lower-chest-press", priority: 12, settings: ["座椅高度：手柄約下胸位置"], tip: "保持肩胛穩定，避免手肘過度外張。" },
    { name: "蝴蝶機夾胸", equipment: "蝴蝶機", match: ["飛鳥", "蝴蝶", "擴胸", "夾胸"], bodyParts: ["胸", "中胸"], movementType: "chest-fly", priority: 18, settings: ["座椅高度：手柄約胸口高度"], tip: "手肘微彎，集中感受胸肌夾合。" },
    { name: "伏地挺身", equipment: "徒手", match: "徒手", bodyParts: ["胸", "中胸", "三頭肌"], tip: "身體保持一直線，下降時手肘約45度。" },
    { name: "上斜伏地挺身", equipment: "徒手", match: "徒手", bodyParts: ["胸", "下胸", "三頭肌"], tip: "雙手放在穩定平台上，適合較輕強度。" },
    { name: "腳高手低伏地挺身", equipment: "徒手", match: "徒手", bodyParts: ["胸", "上胸", "三頭肌"], tip: "腳放高會增加上胸和肩前側負荷，先控制動作。" },
    { name: "高位下拉", equipment: "高位下拉機", match: ["下拉", "高拉", "背闊"], bodyParts: ["背", "手臂"], movementType: "back-pull", priority: 10, settings: ["大腿墊：固定但不壓痛"], tip: "用背部帶動，避免只用手臂拉。" },
    { name: "坐姿划船", equipment: "坐姿划船機", match: ["划船", "低拉"], bodyParts: ["背"], movementType: "back-row", priority: 11, settings: ["胸墊距離：手臂伸直時背部仍穩定"], tip: "胸口打開，手肘向後收。" },
    { name: "背伸展機", equipment: "背伸展機", match: ["背伸展", "羅馬椅", "背肌伸展", "腰部練習", "後腰"], bodyParts: ["背", "核心"], movementType: "back-extension", priority: 25, settings: ["墊位：髖部可自由屈伸"], tip: "保持脊椎中立，不要過度後仰。" },
    { name: "腿部推蹬", equipment: "腿部推蹬機", match: ["腿部推蹬", "蹬腿", "撐腿"], bodyParts: ["腿", "臀部"], movementType: "leg-press", priority: 10, settings: ["腳位：肩闊", "膝角：最低點約90度"], tip: "膝蓋方向跟腳尖一致。" },
    { name: "腿伸展機", equipment: "腿伸展機", match: ["腿伸展", "伸腿"], bodyParts: ["腿"], movementType: "leg-extension", priority: 14, settings: ["膝關節軸心對齊機器轉軸"], tip: "抬起時控制速度，不要用慣性甩腿。" },
    { name: "腿彎舉機", equipment: "腿彎舉機", match: ["腿彎舉", "屈腿", "曲腿", "大腿後肌", "大腿屈曲", "座式大腿屈曲"], bodyParts: ["腿"], movementType: "leg-curl", priority: 15, settings: ["墊位貼近腳踝上方"], tip: "收縮腿後肌，放下時慢慢控制。" },
    { name: "臀部訓練機", equipment: "臀部訓練機", match: ["臀部", "臀肌", "髖部"], bodyParts: ["臀部"], movementType: "hip-extension", priority: 13, settings: ["活動軸心對齊髖部"], tip: "用臀部發力，避免腰部代償。" },
    { name: "大腿外展機", equipment: "大腿內外側練習器", match: ["大腿外側", "外展", "內/外側", "內外側", "外／內", "内外側"], bodyParts: ["腿", "臀部"], movementType: "hip-abduction", priority: 17, settings: ["背墊貼穩", "膝墊貼近大腿外側"], tip: "外推時用臀中肌發力，不要借腰部擺動。" },
    { name: "大腿內收機", equipment: "大腿內外側練習器", match: ["大腿內側", "內收", "內/外側", "內外側", "外／內", "内外側"], bodyParts: ["腿"], movementType: "hip-adduction", priority: 22, settings: ["背墊貼穩", "膝墊貼近大腿內側"], tip: "合攏時保持慢速控制，不要讓重量片撞擊。" },
    { name: "史密夫深蹲", equipment: "史密夫機", match: ["史密夫"], bodyParts: ["腿", "臀部", "全身"], movementType: "leg-press", priority: 28, settings: ["安全扣：略低於最低動作位置", "腳位：肩闊或略寬"], tip: "保持軀幹穩定，先用輕重量確認軌跡。" },
    { name: "肩推機", equipment: "肩推機", match: ["肩推", "推膊", "推舉"], bodyParts: ["肩"], movementType: "shoulder-press", priority: 10, settings: ["座椅高度：手柄約耳至肩高度"], tip: "核心收緊，避免腰背過度拱起。" },
    { name: "側平舉機", equipment: "側平舉機", match: ["側平舉", "三角肌"], bodyParts: ["肩"], movementType: "shoulder-raise", priority: 18, settings: ["手肘墊約肩下方"], tip: "慢慢抬起，不要聳肩借力。" },
    { name: "啞鈴深蹲", equipment: "啞鈴組", match: ["啞鈴"], bodyParts: ["腿", "臀部", "全身"], movementType: "leg-press", priority: 35, usesDumbbells: true, tip: "先用輕重量，保持重心穩定。" },
    { name: "啞鈴臀橋", equipment: "啞鈴組", match: ["啞鈴"], bodyParts: ["臀部"], movementType: "hip-extension", priority: 34, usesDumbbells: true, tip: "頂峰時收緊臀部，避免腰部代償。" },
    { name: "啞鈴彎舉", equipment: "啞鈴組", match: ["啞鈴", "二頭肌"], bodyParts: ["手臂", "二頭肌"], movementType: "biceps-curl", priority: 10, usesDumbbells: true, tip: "手肘固定，避免身體借力。" },
    { name: "二頭肌訓練機", equipment: "二頭肌訓練機", match: ["二頭肌", "屈臂"], bodyParts: ["手臂", "二頭肌"], movementType: "biceps-curl", priority: 11, tip: "上臂貼穩，控制回落速度。" },
    { name: "三頭下壓", equipment: "滑輪機", match: ["滑輪", "三頭肌"], bodyParts: ["手臂", "三頭肌"], movementType: "triceps-extension", priority: 10, settings: ["滑輪高度：最高位", "手肘固定在身側"], tip: "下壓時只動前臂，避免肩膀借力。" },
    { name: "三頭肌訓練機", equipment: "三頭肌訓練機", match: ["三頭肌", "伸臂"], bodyParts: ["手臂", "三頭肌"], movementType: "triceps-extension", priority: 11, tip: "保持手肘穩定，避免肩膀前移。" },
    { name: "椅上臂屈伸", equipment: "徒手", match: "徒手", bodyParts: ["手臂", "三頭肌"], tip: "肩膀保持下沉，如肩前側不適應停止。" },
    { name: "腹肌訓練", equipment: "腹肌訓練椅", match: ["腹肌", "收腹", "捲腹"], bodyParts: ["核心"], movementType: "core-flexion", priority: 10, tip: "慢上慢落，避免拉扯頸部。" },
    { name: "轉體訓練機", equipment: "轉體訓練機", match: ["轉體", "扭腰", "旋體", "轉腰", "腰部旋轉"], bodyParts: ["核心"], movementType: "core-rotation", priority: 16, tip: "慢速控制，不要用慣性甩動。" },
    { name: "平板支撐", equipment: "徒手", match: "徒手", bodyParts: ["核心", "全身"], tip: "身體保持一直線，正常呼吸。" }
  ];
}

function warmups(bodyParts, minutes) {
  const map = {
    "胸": ["肩關節活動", "輕重量推胸"],
    "上胸": ["肩關節活動", "輕重量推胸"],
    "中胸": ["肩關節活動", "輕重量推胸"],
    "下胸": ["肩關節活動", "輕重量推胸"],
    "背": ["肩胛啟動", "輕重量下拉"],
    "腿": ["快走", "徒手深蹲"],
    "臀部": ["快走", "髖關節活動"],
    "肩": ["肩袖活動", "彈力帶外旋"],
    "手臂": ["手肘和手腕活動", "輕重量彎舉"],
    "二頭肌": ["手肘和手腕活動", "輕重量彎舉"],
    "三頭肌": ["手肘和手腕活動", "肩關節活動"],
    "核心": ["快走", "動態拉伸"],
    "全身": ["快走", "動態拉伸"]
  };
  const names = unique(bodyParts.flatMap((bodyPart) => map[bodyPart] || map["全身"])).slice(0, 3);
  return names.map((name) => ({
    name,
    equipment: name === "快走" ? "跑步機" : "徒手",
    minutes: Math.ceil(minutes / 2),
    settings: name === "快走" ? treadmillSettings("warmup") : [],
    tip: "逐步提升體溫，不需要做到疲倦。",
    complete: false
  }));
}

function cardioItem(gym, options, minutes) {
  const available = gym.equipment.find((item) => ["跑步機", "橢圓機", "健身單車", "划艇機", "樓梯機"].some((name) => item.name.includes(name)));
  return {
    name: available?.name || "低衝擊有氧",
    equipment: available?.name || "徒手",
    minutes,
    settings: machineSettings(available?.name, options),
    tip: normalizeBodyParts(options).some((part) => ["腿", "臀部"].includes(part)) ? "下肢訓練後保持低至中強度。" : "保持可說短句的強度。",
    complete: false
  };
}

function machineSettings(machineName = "", options = {}) {
  if (machineName.includes("跑步機")) {
    return treadmillSettings(normalizeGoals(state.profile).includes("減脂") ? "fatLoss" : "cardio");
  }
  if (machineName.includes("健身單車")) return ["阻力：3-5/10", "轉速：60-80 rpm"];
  if (machineName.includes("橢圓")) return ["阻力：3-5/10", "步頻：穩定可說短句"];
  if (machineName.includes("划艇")) return ["阻力：3-5/10", "節奏：每分鐘20-26槳"];
  if (machineName.includes("樓梯")) return ["速度：3-5級", "扶手只作平衡"];
  return [];
}

function treadmillSettings(mode) {
  if (mode === "warmup") return ["斜度：0-1%", "速度：4.5-5.5 km/h"];
  if (mode === "fatLoss") return ["斜度：3-6%", "速度：5.5-6.5 km/h"];
  return ["斜度：1-3%", "速度：5.0-6.0 km/h"];
}

function stretches(bodyParts) {
  const map = {
    "胸": ["胸肌拉伸", "肩前側拉伸"],
    "上胸": ["胸肌拉伸", "肩前側拉伸"],
    "中胸": ["胸肌拉伸", "肩前側拉伸"],
    "下胸": ["胸肌拉伸", "肩前側拉伸"],
    "背": ["背闊肌拉伸", "上背伸展"],
    "腿": ["股四頭肌拉伸", "腿後肌拉伸"],
    "臀部": ["臀肌拉伸", "髖屈肌拉伸"],
    "肩": ["三角肌拉伸", "肩袖放鬆"],
    "手臂": ["二頭肌拉伸", "三頭肌拉伸"],
    "二頭肌": ["二頭肌拉伸", "前臂放鬆"],
    "三頭肌": ["三頭肌拉伸", "肩前側拉伸"],
    "核心": ["腹部伸展", "髖屈肌拉伸"],
    "全身": ["全身簡短拉伸", "呼吸放鬆"]
  };
  const names = unique(bodyParts.flatMap((bodyPart) => map[bodyPart] || map["全身"])).slice(0, 4);
  return names.map((name) => ({
    name,
    equipment: "徒手",
    minutes: 2,
    tip: "每個拉伸保持自然呼吸，不要彈震。",
    complete: false
  }));
}

function unique(values) {
  return [...new Set(values)];
}

async function syncOfficialData() {
  const response = await fetch("./data/lcsd-gyms.json", { cache: "no-store" });
  if (!response.ok) throw new Error("未能讀取官方資料快照");
  const payload = await response.json();
  state.gyms = payload.gyms || [];

  if (!state.gyms.some((gym) => gym.id === state.selectedGymId)) {
    state.selectedGymId = state.gyms[0]?.id || defaultState.selectedGymId;
  }
  state.officialDataInfo = {
    generatedAt: payload.generatedAt,
    gymCount: payload.gymCount,
    equipmentCount: payload.equipmentCount,
    sources: payload.sources
  };
  state.lastSync = payload.generatedAt
    ? new Date(payload.generatedAt).toLocaleString("zh-HK")
    : new Date().toLocaleString("zh-HK");
  saveState();
}

function availableEquipmentTerms(equipment) {
  return equipment.flatMap((item) =>
    [item.name, item.category, ...(item.aliases || [])]
      .filter(Boolean)
      .map((term) => ({ term, name: item.name }))
  );
}

function exerciseMatchesEquipment(exercise, terms) {
  return Boolean(matchedEquipmentName(exercise, terms));
}

function matchedEquipmentName(exercise, terms) {
  const matches = Array.isArray(exercise.match) ? exercise.match : [exercise.match];
  for (const match of matches) {
    if (!match) return false;
    for (const item of terms) {
      if (item.term.includes(match) || match.includes(item.term)) {
        return item.name;
      }
    }
  }
  return "";
}

function normalizeGym(row) {
  const name = getField(row, ["Name_tc", "Name_cn", "Name", "Facility_Name_tc", "FacilityName_tc"]);
  return {
    id: getField(row, ["Facility_ID", "ID", "Name_en", "Name_tc"]) || name,
    name,
    district: getField(row, ["District_tc", "District_cn", "District"]) || "未分類",
    address: getField(row, ["Address_tc", "Address_cn", "Address"]) || "未提供地址",
    openingHours: getField(row, ["Opening_hours_tc", "Opening_Hours_tc", "Opening_hours", "OpeningHours"]) || "請以官方資料為準",
    equipment: []
  };
}

function normalizeEquipment(row) {
  return {
    gymName: getField(row, ["Name_tc", "Name_cn", "Name", "Facility_Name_tc"]),
    name: getField(row, ["Equipment_tc", "Equipment_cn", "Equipment", "Equipment_Name_tc"]) || "未命名器材",
    count: Number(getField(row, ["No_of_set", "No_of_sets", "Quantity", "No"])) || 1,
    category: "未分類"
  };
}

function getField(row, keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return "";
}

function countBy(items, field) {
  return items.reduce((result, item) => {
    result[item[field]] = (result[item[field]] || 0) + 1;
    return result;
  }, {});
}

function weeklyCount() {
  const labels = ["本週", "上週", "前2週", "前3週"];
  return labels.map((label, index) => ({
    label,
    count: Math.max(0, state.records.length - index)
  }));
}

document.addEventListener("click", async (event) => {
  if (event.target.closest("input, textarea, select") || (event.target.closest("[data-stop-demo]") && !event.target.closest("[data-action]"))) {
    return;
  }

  const tab = event.target.closest("[data-tab]");
  if (tab) {
    setTab(tab.dataset.tab);
    return;
  }

  const testChoice = event.target.closest('[data-choice="testDuration"]');
  if (testChoice) {
    const options = state.testOptions || defaultTestOptions();
    options.duration = Number(testChoice.dataset.value);
    state.testOptions = options;
    saveState();
    renderTestMode();
    return;
  }

  const testMultiChoice = event.target.closest('[data-multi-choice="testBodyParts"]');
  if (testMultiChoice) {
    const options = state.testOptions || defaultTestOptions();
    const value = testMultiChoice.dataset.value;
    const selected = normalizeBodyParts(options);

    if (value === "全身") {
      options.bodyParts = selected.includes("全身") ? ["胸"] : ["全身"];
    } else {
      const withoutFullBody = selected.filter((bodyPart) => bodyPart !== "全身");
      options.bodyParts = withoutFullBody.includes(value)
        ? withoutFullBody.filter((bodyPart) => bodyPart !== value)
        : [...withoutFullBody, value];
      if (options.bodyParts.length === 0) options.bodyParts = ["胸"];
    }

    delete options.bodyPart;
    state.testOptions = options;
    saveState();
    renderTestMode();
    return;
  }

  const choice = event.target.closest("[data-choice]");
  if (choice) {
    const draft = state.workoutDraft?.options || {
      bodyParts: ["胸"],
      duration: 45,
      includeCardio: true,
      useDumbbells: true,
      condition: "正常"
    };
    draft[choice.dataset.choice] = choice.dataset.choice === "duration" ? Number(choice.dataset.value) : choice.dataset.value;
    state.workoutDraft = { options: draft, plan: state.workoutDraft?.plan || null };
    saveState();
    renderTraining();
    return;
  }

  const multiChoice = event.target.closest("[data-multi-choice]");
  if (multiChoice) {
    const draft = state.workoutDraft?.options || {
      bodyParts: ["胸"],
      duration: 45,
      includeCardio: true,
      useDumbbells: true,
      condition: "正常"
    };
    const value = multiChoice.dataset.value;
    const selected = normalizeBodyParts(draft);

    if (value === "全身") {
      draft.bodyParts = selected.includes("全身") ? ["胸"] : ["全身"];
    } else {
      const withoutFullBody = selected.filter((bodyPart) => bodyPart !== "全身");
      draft.bodyParts = withoutFullBody.includes(value)
        ? withoutFullBody.filter((bodyPart) => bodyPart !== value)
        : [...withoutFullBody, value];
      if (draft.bodyParts.length === 0) draft.bodyParts = ["胸"];
    }

    delete draft.bodyPart;
    state.workoutDraft = { options: draft, plan: state.workoutDraft?.plan || null };
    saveState();
    renderTraining();
    return;
  }

  const goalToggle = event.target.closest("[data-goal-toggle]");
  if (goalToggle) {
    const value = goalToggle.dataset.goalToggle;
    const goals = normalizeGoals(state.profile);
    state.profile.goals = goals.includes(value)
      ? goals.filter((goal) => goal !== value)
      : [...goals, value];
    saveState();
    renderSettings();
    return;
  }

  const action = event.target.closest("[data-action]");
  if (!action) return;

  if (action.dataset.action === "choose-gym-for-record") {
    state.gymSelectMode = "manual";
    currentManualDraft();
    saveState();
    setTab("gyms");
    return;
  }

  if (action.dataset.action === "add-selected-manual-equipment") {
    const draft = currentManualDraft();
    const gym = state.gyms.find((item) => item.id === draft.gymId) || selectedGym();
    const groupedEquipment = groupByCategory(gym.equipment);
    const categories = ["全部", ...Object.keys(groupedEquipment)];
    const selectedCategory = categories.includes(draft.equipmentCategory) ? draft.equipmentCategory : "全部";
    const categoryItems = selectedCategory === "全部" ? gym.equipment : groupedEquipment[selectedCategory] || [];
    const equipment = categoryItems.find((item) => item.name === draft.selectedEquipmentName) || categoryItems[0];
    if (!equipment || draft.items.some((item) => item.sourceName === equipment.name)) return;
    draft.items.push(manualDraftItemFromEquipment(equipment));
    state.manualDraft = draft;
    saveState();
    renderTraining();
    return;
  }
  if (action.dataset.action === "toggle-manual-equipment") {
    const draft = currentManualDraft();
    const gym = state.gyms.find((item) => item.id === draft.gymId) || selectedGym();
    const equipment = gym.equipment.find((item) => item.name === action.dataset.equipmentName);
    if (!equipment) return;
    const existingIndex = draft.items.findIndex((item) => item.sourceName === equipment.name);
    if (existingIndex >= 0) {
      draft.items.splice(existingIndex, 1);
    } else {
      draft.items.push(manualDraftItemFromEquipment(equipment));

    }
    state.manualDraft = draft;
    saveState();
    renderTraining();
    return;
  }

  if (action.dataset.action === "remove-manual-item") {
    const draft = currentManualDraft();
    draft.items.splice(Number(action.dataset.manualIndex), 1);
    saveState();
    renderTraining();
    return;
  }

  if (action.dataset.action === "manual-add-set") {
    const item = currentManualDraft().items[Number(action.dataset.manualIndex)];
    if (!item) return;
    item.sets = item.sets || [];
    item.sets.push({ weight: "", reps: "" });
    saveState();
    renderTraining();
    return;
  }

  if (action.dataset.action === "apply-last-record") {
    const item = currentManualDraft().items[Number(action.dataset.manualIndex)];
    if (!item) return;
    if (item.category === "有氧" && item.lastCardio) {
      item.cardio = { ...item.lastCardio };
    } else if (item.lastSets?.length) {
      item.sets = item.lastSets.map((set) => ({ weight: set.weight || "", reps: set.reps || "" }));
    }
    saveState();
    renderTraining();
    return;
  }
  if (action.dataset.action === "manual-remove-set") {
    const item = currentManualDraft().items[Number(action.dataset.manualIndex)];
    if (!item?.sets?.length) return;
    if (item.sets.length > 1) item.sets.pop();
    saveState();
    renderTraining();
    return;
  }

  if (action.dataset.action === "save-manual-record") {
    saveManualRecord();
    setTab("records");
    return;
  }

  if (action.dataset.action === "discard-manual-record") {
    state.manualDraft = null;
    saveState();
    renderTraining();
    return;
  }
  if (action.dataset.action === "settings") {
    setTab(state.tab === "settings" && state.profileComplete ? state.previousTab || "home" : "settings");
  }
  if (action.dataset.action === "close-settings") setTab(state.previousTab || "home");
  if (action.dataset.action === "start-training") setTab("training");
  if (action.dataset.action === "continue-workout") setTab("workout");
  if (action.dataset.action === "discard-workout") {
    state.workoutDraft = null;
    saveState();
    setTab("training");
  }
  if (action.dataset.action === "choose-gym") setTab("gyms");
  if (action.dataset.action === "open-test-mode") setTab("testMode");
  if (action.dataset.action === "back-training") setTab("training");
  if (action.dataset.action === "go-log") setTab("log");

  if (action.dataset.action === "select-gym") {
    state.selectedGymId = action.dataset.gymId;
    if (state.gymSelectMode === "manual") {
      const draft = currentManualDraft();
      draft.gymId = action.dataset.gymId;
      state.gymSelectMode = null;
      saveState();
      setTab("training");
      return;
    }
    saveState();
    setTab("home");
    return;
  }

  if (action.dataset.action === "show-equipment") {
    event.stopPropagation();
    const gym = state.gyms.find((item) => item.id === action.dataset.gymId);
    if (gym) renderEquipmentModal(gym);
  }

  if (action.dataset.action === "close-equipment") {
    document.querySelector("#equipmentModal")?.remove();
  }

  if (action.dataset.action === "toggle-item") {
    event.stopPropagation();
    const item = state.workoutDraft.plan.sections[Number(action.dataset.section)].items[Number(action.dataset.item)];
    item.complete = !item.complete;
    const sectionTitle = state.workoutDraft.plan.sections[Number(action.dataset.section)].title;
    if (item.complete && sectionTitle === "主訓練" && !item.loggedSets) {
      item.loggedSets = defaultLoggedSets(item);
    }
    saveState();
    render();
  }

  if (action.dataset.action === "add-set") {
    event.stopPropagation();
    const item = state.workoutDraft.plan.sections[Number(action.dataset.section)].items[Number(action.dataset.item)];
    item.loggedSets = item.loggedSets || defaultLoggedSets(item);
    item.loggedSets.push({ weight: "", reps: item.reps || "" });
    item.sets = item.loggedSets.length;
    saveState();
    render();
  }

  if (action.dataset.action === "remove-set") {
    event.stopPropagation();
    const item = state.workoutDraft.plan.sections[Number(action.dataset.section)].items[Number(action.dataset.item)];
    item.loggedSets = item.loggedSets || defaultLoggedSets(item);
    if (item.loggedSets.length > 1) {
      item.loggedSets.pop();
      item.sets = item.loggedSets.length;
      saveState();
      render();
    }
  }

  if (action.dataset.action === "show-demo") {
    const item = state.workoutDraft.plan.sections[Number(action.dataset.section)].items[Number(action.dataset.item)];
    renderDemoModal(item);
  }

  if (action.dataset.action === "close-demo") {
    document.querySelector("#demoModal")?.remove();
  }

  if (action.dataset.action === "sync-gyms") {
    action.textContent = "更新中...";
    action.disabled = true;
    try {
      await syncOfficialData();
      renderGyms();
    } catch {
      action.textContent = "更新失敗，保留本機資料";
      action.disabled = false;
    }
  }

  if (action.dataset.action === "delete-record") {
    event.stopPropagation();
    state.records = state.records.filter((record) => record.id !== action.dataset.recordId);
    saveState();
    renderRecords();
  }

  if (action.dataset.action === "view-record") {
    state.selectedRecordId = action.dataset.recordId;
    saveState();
    setTab("recordDetail");
  }

  if (action.dataset.action === "back-records") {
    setTab("records");
  }

  if (action.dataset.action === "finish-workout") {
    if (hasIncompleteWorkoutItems()) {
      const confirmed = window.confirm("今日流程仍有未完成項目，是否確認完成訓練並儲存紀錄？");
      if (!confirmed) return;
    }
    saveCurrentWorkout();
    setTab("records");
  }

});

document.addEventListener("input", (event) => {
  const manualInput = event.target.closest("[data-manual-field]");
  if (manualInput) {
    const item = currentManualDraft().items[Number(manualInput.dataset.manualIndex)];
    if (!item) return;
    item.sets = item.sets || [{ weight: "", reps: "" }];
    const set = item.sets[Number(manualInput.dataset.set)];
    set[manualInput.dataset.manualField] = manualInput.value;
    saveState();
    return;
  }

  const manualCardioInput = event.target.closest("[data-manual-cardio-field]");
  if (manualCardioInput) {
    const item = currentManualDraft().items[Number(manualCardioInput.dataset.manualIndex)];
    if (!item) return;
    item.cardio = item.cardio || { minutes: "", speed: "", incline: "", distance: "" };
    item.cardio[manualCardioInput.dataset.manualCardioField] = manualCardioInput.value;
    saveState();
    return;
  }

  const manualNote = event.target.closest("[data-manual-note]");
  if (manualNote) {
    currentManualDraft().note = manualNote.value;
    saveState();
    return;
  }
  const logInput = event.target.closest("[data-log-field]");
  if (logInput) {
    const item = state.workoutDraft.plan.sections[Number(logInput.dataset.section)].items[Number(logInput.dataset.item)];
    item.loggedSets = item.loggedSets || defaultLoggedSets(item);
    const set = item.loggedSets[Number(logInput.dataset.set)];
    set[logInput.dataset.logField] = logInput.value;
    saveState();
    return;
  }

  if (event.target.id === "gymSearch") {
    const value = event.target.value.trim().toLowerCase();
    const list = document.querySelector("#gymList");
    list.innerHTML = state.gyms
      .filter((gym) => `${gym.name} ${gym.district} ${gym.address}`.toLowerCase().includes(value))
      .map(gymCard)
      .join("");
  }
});

document.addEventListener("change", (event) => {
  const picker = event.target.closest("[data-manual-picker]");
  if (!picker) return;

  const draft = currentManualDraft();
  const gym = state.gyms.find((item) => item.id === draft.gymId) || selectedGym();
  const groupedEquipment = groupByCategory(gym.equipment);

  if (picker.dataset.manualPicker === "category") {
    draft.equipmentCategory = picker.value;
    draft.selectedEquipmentName = picker.value === "全部" ? gym.equipment[0]?.name || "" : groupedEquipment[picker.value]?.[0]?.name || "";
  }

  if (picker.dataset.manualPicker === "equipment") {
    draft.selectedEquipmentName = picker.value;
  }

  state.manualDraft = draft;
  saveState();
  renderTraining();
});
document.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;

  if (form.dataset.form === "training-options") {
    const draft = state.workoutDraft?.options || {};
    const options = {
      bodyParts: normalizeBodyParts(draft),
      duration: Number(draft.duration || 45),
      includeCardio: Boolean(form.includeCardio.checked),
      useDumbbells: Boolean(form.useDumbbells.checked),
      condition: draft.condition || "正常"
    };
    state.workoutDraft = { options, plan: generateWorkout(options) };
    saveState();
    setTab("workout");
  }

  if (form.dataset.form === "settings") {
    const data = new FormData(form);
    const nextProfile = {
      height: Number(data.get("height")),
      weight: Number(data.get("weight")),
      goals: normalizeGoals(state.profile),
      level: data.get("level"),
      injury: data.get("injury")
    };
    if (!isProfileComplete(nextProfile)) {
      alert("請輸入身高、體重，並選擇至少一個健身目標。");
      return;
    }
    state.profile = nextProfile;
    state.profileComplete = true;
    state.weights.push({ date: new Date().toISOString().slice(0, 10), value: state.profile.weight });
    saveState();
    setTab("home");
  }

  if (form.dataset.form === "test-options") {
    const data = new FormData(form);
    const current = state.testOptions || defaultTestOptions();
    state.testOptions = {
      ...current,
      gymId: data.get("gymId"),
      bodyParts: normalizeBodyParts(current),
      duration: Number(current.duration || 45),
      includeCardio: Boolean(form.includeCardio.checked),
      useDumbbells: Boolean(form.useDumbbells.checked),
      condition: current.condition || "正常"
    };
    saveState();
    setTab("testMode");
  }

  if (form.dataset.form === "save-log") {
    saveCurrentWorkout();
    setTab("records");
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

render();






































