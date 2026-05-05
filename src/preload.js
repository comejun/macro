/**
 * 프리로드: 메인과 렌더러 사이의 안전한 다리입니다.
 * 여기서 ipcRenderer 등을 쓰고, contextBridge로 렌더러에 허용된 API만 넘깁니다.
 */
const { contextBridge, ipcRenderer } = require("electron");

/** IPC 이벤트 채널 구독 — 반환 함수로 ipcRenderer.off 해제 */
const subscribe = (channel) => (callback) => {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.off(channel, listener);
};

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

  /** 자동화 시작 — 성공 시 true. 이미 동작 중이면 false. */
  startAutomation: () => ipcRenderer.invoke("automation:start"),
  /** 자동화 정지 — 성공 시 true. 이미 idle이면 false. */
  stopAutomation: () => ipcRenderer.invoke("automation:stop"),
  /** 현재 자동화 상태(idle | starting | running | stopping). */
  getAutomationStatus: () => ipcRenderer.invoke("automation:status"),
  /** 자동화 로그 스트림 구독. 반환값은 해제 함수입니다. */
  onAutomationLog: subscribe("automation:log"),
  /** 자동화 상태 변경 구독. 반환값은 해제 함수입니다. */
  onAutomationState: subscribe("automation:state"),
});
