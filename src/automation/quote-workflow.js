/**
 * 상세 페이지 진입 후: 차량 정보 검사 → 수리 불가면 견적 취소, 아니면 견적 작성.
 */
const selectors = require("./selectors");
const {
  evaluateRepairEligibility,
  evaluateRepairEligibilityStructured,
} = require("./repair-eligibility");
const { performQuoteCancellation } = require("./cancellation");
const { performQuoteDraft } = require("./quote-draft");

/** 로그·Slack 등에 그대로 넣기 좋은 한 줄 요약 */
const KIND_LABEL_KO = {
  nonRepairBrand: "수리 불가 브랜드(CSV)",
  nonRepairModel: "수리 불가 차종(CSV)",
  blockedPart: "수리 불가 부위(토글)",
};

function formatCancellationSummaryLines(reasons) {
  return reasons.map((r) => {
    const kindKo = KIND_LABEL_KO[r.kind] ?? r.kind;
    let line = `[${r.originDescriptionKo}] ${kindKo}: "${r.value}"`;
    if (r.matchedSiteToken) {
      line += ` ← 페이지 표기 "${r.matchedSiteToken}"`;
    }
    return line;
  });
}

/** 요소가 없거나 타임아웃이면 null — 폴백 분기에서 사용 */
async function safeGetText(driver, locator) {
  try {
    const el = await driver.findElement(locator);
    return await el.getText();
  } catch {
    return null;
  }
}

/**
 * 차량 정보 섹션 텍스트를 읽고 수리 불가 분기 후 취소 또는 작성 흐름으로 넘깁니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {Record<string, unknown>} settings
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @returns {Promise<"cancelled"|"draft">}
 */
async function runPostDetailQuoteFlow(driver, settings, logger) {
  const brandAndModelText = await safeGetText(driver, selectors.detail.brandAndModelLine);
  const repairPartsRaw = await safeGetText(driver, selectors.detail.repairPartsSpan);

  let eligible;
  let reasons;

  if (brandAndModelText != null && repairPartsRaw != null) {
    logger.info("차량 정보 필드(브랜드·차종 p / 수리부위 span) 수집", {
      brandLineLength: brandAndModelText.length,
      repairPartsLength: repairPartsRaw.length,
    });
    ({ eligible, reasons } = evaluateRepairEligibilityStructured(settings, {
      brandAndModelText,
      repairPartsCommaSeparated: repairPartsRaw,
    }));
  } else {
    const vehicleEl = await driver.findElement(selectors.detail.vehicleSection);
    const vehicleText = await vehicleEl.getText();
    logger.warn("브랜드·차종 또는 수리부위 셀렉터 조회 실패 — 차량 섹션 전체 텍스트로 폴백", {
      sectionLength: vehicleText.length,
    });
    ({ eligible, reasons } = evaluateRepairEligibility(settings, vehicleText));
  }

  if (!eligible) {
    const summaryLines = formatCancellationSummaryLines(reasons);
    logger.warn("수리 불가 조건 일치 — 견적 취소 분기", {
      reasonCount: reasons.length,
      summaryLinesKo: summaryLines,
      reasons,
    });
    await handleQuoteCancellation(driver, logger, reasons, summaryLines);
    return "cancelled";
  }

  logger.info("수리 불가 조건 없음 — 견적 작성 분기");
  await handleQuoteDraft(driver, logger, settings);
  return "draft";
}

/** @param {unknown[]} reasons 상세 메타가 붙은 판정 결과 배열 */
async function handleQuoteCancellation(driver, logger, reasons, summaryLinesKo) {
  logger.info("견적 취소 분기 — 사유 요약", {
    cancellationSummaryKo: summaryLinesKo,
    matchedReasons: reasons,
  });
  await performQuoteCancellation(driver, logger, reasons);
}

/**
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {Record<string, unknown>} settings
 */
async function handleQuoteDraft(driver, logger, settings) {
  await performQuoteDraft(driver, logger, settings);
}

module.exports = {
  runPostDetailQuoteFlow,
  handleQuoteCancellation,
  handleQuoteDraft,
  formatCancellationSummaryLines,
};
