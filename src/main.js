/**
 * 메인 프로세스: 앱 생명주기와 창(BrowserWindow)을 담당합니다.
 * Selenium·파일·네이티브 API 등은 보통 여기 또는 여기서 불리는 모듈에 둡니다.
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const Store = require("electron-store");
const automation = require("./automation");
const { createLogger } = require("./automation/logger");

// 설정 영구 저장소 — userData 폴더 내 JSON으로 자동 저장됩니다.
// TODO: 비밀번호는 향후 keytar 등 OS 키체인으로 분리 권장.
const store = new Store({
  name: "settings",
  defaults: {
    cardocId: "",
    cardocPassword: "",
    prices: {
      domesticUninsured: "",
      domesticInsurance: "",
      importUninsured: "",
      importInsurance: "",
    },
    blockedParts: [],
    deleteParts: [],
    domesticBrandsCsv: "",
    nonRepairBrandsCsv: "",
    nonRepairModelsCsv: "",
  },
});

let mainWindow = null;
let isQuitting = false;

/** 활성 창의 webContents로 자동화 로그를 흘려보내는 로거를 만듭니다. */
function createPipedLogger() {
  return createLogger({
    onMessage: (entry) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("automation:log", entry);
      }
    },
  });
}

ipcMain.handle("settings:load", () => store.store);
ipcMain.handle("settings:save", (_event, payload) => {
  if (payload && typeof payload === "object") {
    store.set(payload);
  }
  return store.store;
});

ipcMain.handle("automation:start", () =>
  automation.start({ settings: store.store, logger: createPipedLogger() })
);
ipcMain.handle("automation:stop", () =>
  automation.stop({ logger: createPipedLogger() })
);
ipcMain.handle("automation:status", () => automation.getState());

// 렌더러의 종료 버튼에서 호출 — 모든 창을 닫고 앱을 종료합니다.
ipcMain.handle("app:quit", () => {
  app.quit();
});

/** 앱 창 하나를 생성하고 로컬 HTML을 로드합니다. */
function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 720,
    minHeight: 560,
    webPreferences: {
      // preload에서만 제한된 API를 렌더러에 노출합니다.
      preload: path.join(__dirname, "preload.js"),
      // 렌더러와 Electron 내부를 분리해 XSS 시 노출 범위를 줄입니다.
      contextIsolation: true,
      // 렌더러에서 Node(require 등) 직접 사용 금지 — 보안 기본값입니다.
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  mainWindow = win;
}

app.whenReady().then(() => {
  // 자동화 상태 변화는 항상 활성 창에 푸시.
  automation.onStateChange((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("automation:state", state);
    }
  });

  createWindow();

  // macOS: 독 아이콘 클릭 시 창이 없으면 다시 만듭니다.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 자동화가 실행 중이면 먼저 정리한 뒤 종료합니다.
app.on("before-quit", async (event) => {
  if (isQuitting) return;
  if (automation.getState() === "idle") return;
  event.preventDefault();
  isQuitting = true;
  await automation.stop({ logger: createPipedLogger() });
  app.quit();
});

// Windows/Linux: 모든 창을 닫으면 앱 종료 (macOS는 메뉴바·독으로 앱이 남는 경우가 많음).
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
