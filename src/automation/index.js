/**
 * 자동화 오케스트레이터: 시작/정지/상태 조회를 외부에 제공합니다.
 *
 * 흐름:
 *   1) Chrome 드라이버 생성
 *   2) 카닥 파트너스 로그인 페이지 진입 + 로그인 자동화
 *   3) 메인 페이지에서 새 견적 요청 폴링 (10초 주기)
 *   4) 정지 요청·앱 종료 시 폴링 중단 후 드라이버 종료
 *
 * 새 견적 상세 진입 후: 차량 정보에서 수리 불가 브랜드·차종·부위 검사 →
 * 견적 취소 또는 견적 작성 분기(본문은 quote-workflow에서 확장).
 */
const { createChromeDriver } = require("./driver");
const { login } = require("./login");
const poller = require("./poller");

/** 카닥 파트너스 로그인 진입 URL */
const LOGIN_URL = "https://partners.cardoc.co.kr/auth/sign-in";

/** 로그인 자격 증명을 검증해 정규화된 객체 또는 null을 돌려줍니다. */
function normalizeCredentials(settings, logger) {
  const id = String(settings?.cardocId ?? "").trim();
  const password = String(settings?.cardocPassword ?? "");
  if (!id || !password) {
    const missing = [!id && "아이디", !password && "비밀번호"].filter(Boolean).join(", ");
    logger.error(`로그인 정보가 비어 있습니다: ${missing}`);
    return null;
  }
  return { id, password };
}

/** @typedef {"idle"|"starting"|"running"|"stopping"} AutomationState */

/** 자동화 UI 연동용 상태 머신 */
let state = /** @type {AutomationState} */ ("idle");
/** Selenium WebDriver 인스턴스 — 시작 시 생성·정지 시 종료 */
let driver = null;
/** 폴링 루프 Promise — cleanup 시 종료 대기에 사용 */
let pollerPromise = null;
/** 상태 변경 시 main.js가 렌더러로 브로드캐스트하기 위한 구독 목록 */
const stateListeners = new Set();

/** 상태 전이 후 모든 리스너에 알립니다. */
function setState(next) {
  if (state === next) return;
  state = next;
  for (const listener of stateListeners) {
    try {
      listener(state);
    } catch {
      // 구독자 예외는 흐름을 막지 않도록 무시.
    }
  }
}

/** 현재 자동화 상태 문자열을 반환합니다 (IPC 조회용). */
function getState() {
  return state;
}

/** 상태 변경 알림을 구독합니다. 반환 함수로 해제합니다. */
function onStateChange(listener) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

/** 폴러·브라우저 드라이버를 순서대로 안전 종료합니다. */
async function cleanup() {
  // 폴러를 먼저 멈추고 sleep을 깨운 뒤, driver.quit으로 in-flight Selenium 호출을
  // 끊고, 마지막으로 폴러 루프가 자연 종료되기를 기다립니다.
  poller.requestStop();

  if (driver) {
    try {
      await driver.quit();
    } catch {
      // 이미 닫혔거나 비정상 종료 — 무시하고 핸들만 해제.
    }
  }

  if (pollerPromise) {
    try {
      await pollerPromise;
    } catch {
      // 폴러 자체에서 이미 처리·로깅됨.
    }
    pollerPromise = null;
  }

  driver = null;
}

/**
 * 크롬 기동 → 로그인 → 견적 목록 폴링까지 시작합니다.
 * @param {{ settings: Record<string, unknown>, logger: ReturnType<typeof import("./logger").createLogger> }} args
 */
async function start({ settings, logger }) {
  if (state !== "idle") {
    logger.warn("이미 실행 중이거나 전이 중이라 시작 요청을 무시합니다.", { state });
    return false;
  }

  const credentials = normalizeCredentials(settings, logger);
  if (!credentials) {
    return false;
  }

  setState("starting");
  logger.info("자동화 시작 준비");

  try {
    driver = await createChromeDriver();
    logger.info("Chrome 드라이버 준비 완료");

    await driver.get(LOGIN_URL);
    logger.info("로그인 페이지 이동", { url: LOGIN_URL });

    await login(driver, credentials, logger);

    setState("running");
    logger.info("자동화 실행 상태로 전환됨");

    // 폴링은 fire-and-forget. 정지/오류 시 자체 종료하며 cleanup이 await 합니다.
    pollerPromise = poller.start({ driver, logger, settings }).catch((error) => {
      logger.error("폴러 비정상 종료", {
        message: error?.message ?? String(error),
      });
    });

    return true;
  } catch (error) {
    logger.error("자동화 시작 실패", {
      message: error?.message ?? String(error),
    });
    await cleanup();
    setState("idle");
    return false;
  }
}

/**
 * 폴링 중단 및 브라우저 종료. 이미 idle이면 아무 것도 하지 않습니다.
 * @param {{ logger?: ReturnType<typeof import("./logger").createLogger> }} [args]
 */
async function stop({ logger } = {}) {
  if (state === "idle") {
    logger?.warn("이미 정지 상태입니다.");
    return false;
  }
  setState("stopping");
  logger?.info("자동화 정지 요청 처리");
  await cleanup();
  setState("idle");
  logger?.info("자동화가 정지되었습니다.");
  return true;
}

module.exports = { start, stop, getState, onStateChange, LOGIN_URL };
