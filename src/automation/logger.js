/**
 * 자동화 로거: 모든 액션·처리에 대해 일관된 로그 항목을 만들어
 * 콘솔과 외부 구독자(예: 렌더러로 전달하는 IPC)에 동시 전달합니다.
 */

/** @typedef {"info"|"warn"|"error"|"debug"} LogLevel */
/** @typedef {{ level: LogLevel, message: string, meta?: unknown, timestamp: string }} LogEntry */

/**
 * @param {{ onMessage?: (entry: LogEntry) => void }} [options]
 */
function createLogger(options = {}) {
  const { onMessage } = options;

  const emit = (level, message, meta) => {
    const entry = {
      level,
      message,
      meta,
      timestamp: new Date().toISOString(),
    };
    const formatted = `[${entry.timestamp}] [${level.toUpperCase()}] ${message}`;
    const writer = level === "error" ? console.error : console.log;
    if (meta !== undefined) {
      writer(formatted, meta);
    } else {
      writer(formatted);
    }
    if (typeof onMessage === "function") {
      try {
        onMessage(entry);
      } catch {
        // 구독자 예외는 로깅 흐름을 막지 않도록 무시.
      }
    }
  };

  return {
    info: (message, meta) => emit("info", message, meta),
    warn: (message, meta) => emit("warn", message, meta),
    error: (message, meta) => emit("error", message, meta),
    debug: (message, meta) => emit("debug", message, meta),
  };
}

module.exports = { createLogger };
