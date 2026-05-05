/**
 * 렌더러 스크립트: 설정 폼을 그리고, 변경 시 메인 프로세스에 자동 저장합니다.
 * Node 모듈을 직접 쓰지 않고 preload가 노출한 window.macro API만 사용합니다.
 */

// 토글 그룹에서 공유하는 부위 라벨 — 키와 라벨이 동일합니다.
const PART_LABELS = [
  "운전석 전펜더",
  "운전석 전도어",
  "운전석 스텝",
  "운전석 후도어",
  "운전석 후펜더",
  "앞범퍼",
  "후드",
  "루프",
  "트렁크",
  "뒷범퍼",
  "조수석 전펜더",
  "조수석 전도어",
  "조수석 스텝",
  "조수석 후도어",
  "조수석 후펜더",
];

const SAVE_DEBOUNCE_MS = 250;

const AUTOMATION_STATE_LABELS = {
  idle: "대기 중",
  starting: "시작 중…",
  running: "실행 중",
  stopping: "정지 중…",
};

const form = document.getElementById("settings-form");
const indicator = document.querySelector("[data-save-indicator]");
const statusEl = document.querySelector("[data-automation-status]");

/** 토글 버튼 그룹을 PART_LABELS 기반으로 채워 넣습니다. */
function renderToggleGroups() {
  document.querySelectorAll("[data-toggle-group]").forEach((host) => {
    host.replaceChildren(
      ...PART_LABELS.map((label) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "toggle";
        btn.textContent = label;
        btn.dataset.value = label;
        btn.setAttribute("aria-pressed", "false");
        return btn;
      })
    );
  });
}

/** dot-path("prices.domesticUninsured")에 값을 안전하게 설정합니다. */
function setByPath(target, dotPath, value) {
  const keys = dotPath.split(".");
  let cursor = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (typeof cursor[key] !== "object" || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
}

/** dot-path 위치의 값을 가져오고, 없으면 기본값을 돌려줍니다. */
function getByPath(source, dotPath, fallback = "") {
  return dotPath
    .split(".")
    .reduce((acc, key) => (acc != null ? acc[key] : undefined), source) ?? fallback;
}

/** 저장된 설정으로 폼을 초기화합니다. */
function applySettings(settings) {
  form.querySelectorAll("input, textarea").forEach((el) => {
    if (!el.name) return;
    el.value = String(getByPath(settings, el.name, ""));
  });

  document.querySelectorAll("[data-toggle-group]").forEach((host) => {
    const groupKey = host.dataset.toggleGroup;
    const selected = new Set(Array.isArray(settings[groupKey]) ? settings[groupKey] : []);
    host.querySelectorAll(".toggle").forEach((btn) => {
      btn.setAttribute("aria-pressed", selected.has(btn.dataset.value) ? "true" : "false");
    });
  });
}

/** 현재 폼 상태를 저장 페이로드로 직렬화합니다. */
function collectSettings() {
  const payload = {};
  form.querySelectorAll("input, textarea").forEach((el) => {
    if (!el.name) return;
    setByPath(payload, el.name, el.value);
  });

  document.querySelectorAll("[data-toggle-group]").forEach((host) => {
    const groupKey = host.dataset.toggleGroup;
    payload[groupKey] = Array.from(host.querySelectorAll('.toggle[aria-pressed="true"]'))
      .map((btn) => btn.dataset.value);
  });

  return payload;
}

function setIndicator(state, text) {
  if (!indicator) return;
  indicator.dataset.state = state;
  indicator.textContent = text;
}

function createDebouncedSaver(delay) {
  let timer = null;
  let pending = false;
  let inFlight = false;

  const flush = async () => {
    if (inFlight) {
      pending = true;
      return;
    }
    inFlight = true;
    setIndicator("saving", "저장 중…");
    try {
      await window.macro.saveSettings(collectSettings());
      setIndicator("saved", "저장됨");
    } catch (error) {
      console.error("[macro] 설정 저장 실패", error);
      setIndicator("error", "저장 실패");
    } finally {
      inFlight = false;
      if (pending) {
        pending = false;
        flush();
      }
    }
  };

  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  };
}

const scheduleSave = createDebouncedSaver(SAVE_DEBOUNCE_MS);

function bindEvents() {
  form.addEventListener("input", scheduleSave);

  document.querySelectorAll("[data-toggle-group]").forEach((host) => {
    host.addEventListener("click", (event) => {
      const btn = event.target.closest(".toggle");
      if (!btn || !host.contains(btn)) return;
      const next = btn.getAttribute("aria-pressed") === "true" ? "false" : "true";
      btn.setAttribute("aria-pressed", next);
      scheduleSave();
    });
  });

  const startBtn = document.querySelector('[data-action="start"]');
  const stopBtn = document.querySelector('[data-action="stop"]');
  const quitBtn = document.querySelector('[data-action="quit"]');

  startBtn?.addEventListener("click", async () => {
    startBtn.disabled = true;
    try {
      // 시작 직전 최신 입력 상태를 한 번 더 저장해 메인의 store와 동기화합니다.
      await window.macro.saveSettings(collectSettings());
      await window.macro.startAutomation();
    } catch (error) {
      console.error("[macro] 자동화 시작 실패", error);
    }
  });

  stopBtn?.addEventListener("click", async () => {
    stopBtn.disabled = true;
    try {
      await window.macro.stopAutomation();
    } catch (error) {
      console.error("[macro] 자동화 정지 실패", error);
    }
  });

  quitBtn?.addEventListener("click", async () => {
    // 종료 직전 마지막 상태를 확실히 저장한 뒤 메인에 종료를 요청합니다.
    try {
      await window.macro.saveSettings(collectSettings());
    } catch (error) {
      console.error("[macro] 종료 직전 저장 실패", error);
    }
    window.macro.quit();
  });
}

function applyAutomationState(state) {
  const startBtn = document.querySelector('[data-action="start"]');
  const stopBtn = document.querySelector('[data-action="stop"]');
  if (startBtn) startBtn.disabled = state !== "idle";
  if (stopBtn) stopBtn.disabled = state !== "running";
  if (statusEl) {
    statusEl.dataset.state = state;
    statusEl.textContent = AUTOMATION_STATE_LABELS[state] ?? state;
  }
}

async function init() {
  renderToggleGroups();
  bindEvents();
  try {
    const settings = await window.macro.loadSettings();
    applySettings(settings ?? {});
    setIndicator("saved", "");
  } catch (error) {
    console.error("[macro] 설정 로드 실패", error);
    setIndicator("error", "불러오기 실패");
  }

  window.macro.onAutomationLog((entry) => {
    // 추후 로그 패널이 추가되면 DOM에 누적. 지금은 콘솔로만 흘립니다.
    const writer = entry.level === "error" ? console.error : console.log;
    if (entry.meta !== undefined) {
      writer(`[automation:${entry.level}]`, entry.message, entry.meta);
    } else {
      writer(`[automation:${entry.level}]`, entry.message);
    }
  });

  window.macro.onAutomationState(applyAutomationState);

  try {
    const initialState = await window.macro.getAutomationStatus();
    applyAutomationState(initialState ?? "idle");
  } catch (error) {
    console.error("[macro] 자동화 상태 조회 실패", error);
    applyAutomationState("idle");
  }
}

init();
