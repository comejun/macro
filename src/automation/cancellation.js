/**
 * 수리 불가 판정 후 견적 취소 UI 플로우 (카닥 파트너스 마크업 기준).
 *
 * 주의: Radix 포털 id는 렌더마다 바뀝니다. 사유 메뉴·모달 확인은 XPath로 `radix-` 접두 id를
 * 동적으로 찾습니다. 여전히 실패하면 DevTools로 마크업 변화를 확인해 selectors를 조정하세요.
 */
const { By, until } = require("selenium-webdriver");
const { click } = require("./dom");
const selectors = require("./selectors");

const FLOW_TIMEOUT_MS = 25_000;

/** Radix 포털 id는 `:r1i8:` 등이 렌더마다 바뀜 — `#radix-… > div > button:nth-child(n)` 패턴만 XPath로 매칭 */
async function waitAndClickRadixReasonNth(driver, nthChild, timeoutMs, logger) {
  const xpath = By.xpath(
    `//*[starts-with(@id,'radix-')]/div/button[position()=${nthChild}]`,
  );
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const els = await driver.findElements(xpath);
    for (let i = els.length - 1; i >= 0; i -= 1) {
      const el = els[i];
      try {
        if (await el.isDisplayed()) {
          await el.click();
          logger.info("Radix 사유 옵션 클릭", { nthChild });
          return;
        }
      } catch {
        /* stale 또는 일시적 미표시 */
      }
    }
    await driver.sleep(150);
  }
  throw new Error(`Radix 사유 버튼(${nthChild}번째)을 ${timeoutMs}ms 안에 찾지 못했습니다.`);
}

/** `:r1ib:` 고정 id가 깨질 때 — 마지막으로 보이는 Radix 트리 안 주색(primary) 확인 버튼 */
async function waitAndClickRadixModalPrimary(driver, timeoutMs, logger) {
  const cssLocator = selectors.cancellation.modalConfirmPrimary;
  try {
    await driver.wait(until.elementLocated(cssLocator), 10_000);
    await click(driver, cssLocator, { timeout: FLOW_TIMEOUT_MS });
    logger.info("견적 취소 — 최종 확인 모달 버튼 클릭(정밀 셀렉터)");
    return;
  } catch {
    logger.warn("모달 확인 정밀 셀렉터 타임아웃 — Radix 내 주 버튼으로 재시도");
  }
  const xpath = By.xpath(
    "//*[starts-with(@id,'radix-')]//button[contains(@class,'bg-primary-500')]",
  );
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const els = await driver.findElements(xpath);
    for (let i = els.length - 1; i >= 0; i -= 1) {
      const el = els[i];
      try {
        if (await el.isDisplayed()) {
          await el.click();
          logger.info("견적 취소 — 최종 확인 모달 버튼 클릭(XPath 폴백)");
          return;
        }
      } catch {
        /* stale */
      }
    }
    await driver.sleep(150);
  }
  throw new Error(`최종 확인 모달 버튼을 ${timeoutMs}ms 안에 찾지 못했습니다.`);
}

/** 정밀 input 경로가 깨지면 완화 셀렉터로 재시도 */
async function locateReasonInputLocator(driver, logger) {
  const strict = selectors.cancellation.reasonInput;
  const relaxed = selectors.cancellation.reasonInputRelaxed;
  try {
    await driver.wait(until.elementLocated(strict), 12_000);
    return strict;
  } catch {
    logger.warn("사유 입력 정밀 셀렉터 타임아웃 — 완화 셀렉터로 재시도");
    await driver.wait(until.elementLocated(relaxed), FLOW_TIMEOUT_MS);
    return relaxed;
  }
}

/** 취소 사유 중 수리 불가 부위(blockedPart)가 하나라도 있으면 true */
function hasBlockedPartReason(reasons) {
  return Array.isArray(reasons) && reasons.some((r) => r && r.kind === "blockedPart");
}

/**
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {Array<{ kind?: string }>} reasons
 */
async function performQuoteCancellation(driver, logger, reasons) {
  const blockedPartsFlow = hasBlockedPartReason(reasons);
  logger.info("견적 취소 단계 시작", {
    reasonChoice: blockedPartsFlow
      ? "수리 불가 부위 — radix 메뉴 5번째 버튼"
      : "그 외(브랜드·차종 등) — radix 메뉴 6번째 버튼",
  });

  await click(driver, selectors.cancellation.openFromVehicleHeader, {
    timeout: FLOW_TIMEOUT_MS,
  });

  logger.info("견적 취소 — 페이지 전환 후 사유 입력 영역 대기");
  const reasonInputLocator = await locateReasonInputLocator(driver, logger);
  logger.info("견적 취소 — 사유 입력 필드 확인됨");

  await click(driver, reasonInputLocator, { timeout: FLOW_TIMEOUT_MS });

  logger.info("견적 취소 — Radix 사유 메뉴 옵션 대기·클릭");
  const nthRadixReasonBtn = blockedPartsFlow ? 5 : 6;
  await waitAndClickRadixReasonNth(driver, nthRadixReasonBtn, FLOW_TIMEOUT_MS, logger);

  logger.info("견적 취소 — 하단 제출 버튼");
  await click(driver, selectors.cancellation.footerSubmit, { timeout: FLOW_TIMEOUT_MS });

  logger.info("견적 취소 — 최종 확인 모달");
  await waitAndClickRadixModalPrimary(driver, FLOW_TIMEOUT_MS, logger);

  logger.info("견적 취소 플로우 완료");
}

module.exports = { performQuoteCancellation, hasBlockedPartReason };
