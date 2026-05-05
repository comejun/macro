/**
 * 프리로드: 메인과 렌더러 사이의 안전한 다리입니다.
 * 여기서 ipcRenderer 등을 쓰고, contextBridge로 렌더러에 허용된 API만 넘깁니다.
 */
const { contextBridge, ipcRenderer } = require("electron");

// window.macro 로만 접근 가능한 얇은 API 레이어 (필요 시 메서드·이벤트만 추가).
contextBridge.exposeInMainWorld("macro", {
  /** 실행 OS (win32, darwin, linux 등) */
  platform: process.platform,
  /** 저장된 설정 전체를 불러옵니다. */
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  /** 부분 또는 전체 설정을 병합 저장하고 최신 상태를 돌려받습니다. */
  saveSettings: (payload) => ipcRenderer.invoke("settings:save", payload),
  /** 앱을 종료합니다. */
  quit: () => ipcRenderer.invoke("app:quit"),
});
