/**
 * 메인 페이지에서 새 견적 요청을 주기적으로 확인하는 폴러.
 *
 * 흐름:
 *   1) 페이지 새로고침
 *   2) 견적 요청 목록 ul이 보일 때까지 대기
 *   3) 상단부터 li 순회 — 유형 p가 "캐시백 요청"이면 다음 li로
 *      (마지막 li가 캐시백이면 다음 행이 없으므로 "신규 견적 없음"으로 종료)
 *   4) 첫 일반 견적 행의 요청 번호(span)로 직전 주기와 비교
 *   5) 10초 sleep 후 반복
 *
 * 중단:
 *   외부에서 requestStop()을 호출하면 sleep을 즉시 깨우고 다음 루프 검사 지점에서
 *   안전하게 종료합니다. 진행 중이던 Selenium 작업은 driver.quit() 호출 시
 *   예외로 떨어지지만, 다음 분기 검사로 인해 루프가 자연스럽게 끝납니다.
 */
const { until } = require("selenium-webdriver");
const selectors = require("./selectors");

const POLL_INTERVAL_MS = 10_000;
const LIST_TIMEOUT_MS = 10_000;

let isPolling = false;
let stopRequested = false;
let wakeUp = null;
/** 가장 마지막으로 본 견적 요청 번호. start() 호출마다 리셋됩니다. */
let lastRequestNumber = null;

const CASHBACK_LABEL = selectors.requests.CASHBACK_REQUEST_LABEL;

function sleep(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      wakeUp = null;
      resolve();
    }, ms);
    wakeUp = () => {
      clearTimeout(timer);
      wakeUp = null;
      resolve();
    };
  });
}

/**
 * 상단부터 li를 순회하며, p가 "캐시백 요청"인 행은 건너뛰고
 * 첫 번째 일반 견적 행의 견적 요청 번호를 반환합니다.
 * 캐시백 행이 마지막 li라 다음 행이 없으면 신규 견적 없음으로 처리합니다.
 *
 * @returns {Promise<
 *   | { ok: true; requestNumber: string; skippedCashback: number }
 *   | { ok: false; reason: "empty-list" | "no-new-quote-after-cashback" | "no-eligible-row" }
 * >}
 */
async function pickFirstNonCashbackRequestNumber(driver, logger) {
  const lis = await driver.findElements(selectors.requests.items);
  if (lis.length === 0) {
    return { ok: false, reason: "empty-list" };
  }

  let skippedCashback = 0;

  for (let i = 0; i < lis.length; i += 1) {
    const li = lis[i];
    const typePs = await li.findElements(selectors.requests.cashbackLabelP);
    const typeText =
      typePs.length > 0 ? (await typePs[0].getText()).trim() : "";

    if (typeText === CASHBACK_LABEL) {
      skippedCashback += 1;
      // 마지막 li가 캐시백이면 그 다음 견적 행이 없음 → 신규 견적 없음
      if (i === lis.length - 1) {
        logger.info("신규 견적 없음", {
          reason: "캐시백 요청 행만 있거나 마지막 행이 캐시백이라 처리할 다음 견적이 없음",
          index: i,
          skippedCashback,
        });
        return { ok: false, reason: "no-new-quote-after-cashback" };
      }
      logger.info("캐시백 요청 건 건너뜀 — 다음 li 확인", {
        index: i,
        label: typeText,
      });
      continue;
    }

    const numberSpans = await li.findElements(selectors.requests.requestNumberSpan);
    if (numberSpans.length === 0) {
      logger.warn("li에 견적 요청 번호(span) 없음 — 다음 행 시도", { index: i });
      continue;
    }

    const requestNumber = (await numberSpans[0].getText()).trim();
    if (!requestNumber) {
      logger.warn("견적 요청 번호가 비어 있음 — 다음 행 시도", { index: i });
      continue;
    }

    return { ok: true, requestNumber, skippedCashback };
  }

  if (skippedCashback > 0) {
    logger.info("표시된 li가 모두 캐시백 요청이거나 처리 가능한 견적 번호 없음", {
      skippedCashback,
      totalLi: lis.length,
    });
  }

  return { ok: false, reason: "no-eligible-row" };
}

async function pollOnce({ driver, logger }) {
  logger.info("페이지 새로고침");
  await driver.navigate().refresh();

  // ul이 그려질 때까지는 기다리지만, li/span은 없을 수도 있으므로 findElements로 안전 조회.
  await driver.wait(until.elementLocated(selectors.requests.list), LIST_TIMEOUT_MS);

  const pick = await pickFirstNonCashbackRequestNumber(driver, logger);

  if (!pick.ok) {
    if (pick.reason === "no-new-quote-after-cashback") {
      // 신규 견적 없음 — pickFirst에서 이미 로그함
      return;
    }
    logger.info("견적 요청 없음", { reason: pick.reason });
    return;
  }

  const { requestNumber: topRequestNumber, skippedCashback } = pick;

  if (topRequestNumber === lastRequestNumber) {
    logger.info("견적 요청 변동 없음", { requestNumber: topRequestNumber });
    return;
  }

  logger.info("새 견적 요청 감지", {
    requestNumber: topRequestNumber,
    previous: lastRequestNumber,
    skippedCashback,
  });
  lastRequestNumber = topRequestNumber;
  // TODO: 해당 li 클릭 → 견적 종류·브랜드·차종 분기 → 입력·라디오·버튼 처리 → Slack 알림.
}

/**
 * 폴링 루프 시작 (한 인스턴스만 동시 실행).
 * @param {{ driver: import("selenium-webdriver").WebDriver, logger: ReturnType<typeof import("./logger").createLogger> }} args
 */
async function start({ driver, logger }) {
  if (isPolling) {
    logger.warn("폴러가 이미 실행 중입니다.");
    return;
  }
  isPolling = true;
  stopRequested = false;
  lastRequestNumber = null;
  logger.info("새 견적 요청 폴링 시작", { intervalMs: POLL_INTERVAL_MS });

  try {
    while (!stopRequested) {
      try {
        await pollOnce({ driver, logger });
      } catch (error) {
        if (stopRequested) break;
        logger.error("폴링 중 오류 — 다음 주기에 재시도", {
          message: error?.message ?? String(error),
        });
      }
      if (stopRequested) break;
      await sleep(POLL_INTERVAL_MS);
    }
  } finally {
    isPolling = false;
    wakeUp = null;
    logger.info("폴링 종료");
  }
}

/** 진행 중인 폴러에 정지를 요청합니다. sleep 중이면 즉시 깨웁니다. */
function requestStop() {
  stopRequested = true;
  if (wakeUp) wakeUp();
}

module.exports = { start, requestStop, POLL_INTERVAL_MS };
