/**
 * 상세 페이지 진입 후: 차량 정보 검사 → 수리 불가면 견적 취소, 아니면 견적 작성.
 */
const selectors = require("./selectors");
const { evaluateRepairEligibility } = require("./repair-eligibility");

/**
 * 차량 정보 섹션 텍스트를 읽고 수리 불가 분기 후 취소 또는 작성 흐름으로 넘깁니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {Record<string, unknown>} settings
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @returns {Promise<"cancelled"|"draft">}
 */
async function runPostDetailQuoteFlow(driver, settings, logger) {
  const vehicleEl = await driver.findElement(selectors.detail.vehicleSection);
  const vehicleText = await vehicleEl.getText();

  logger.info("차량 정보 섹션 텍스트 수집", { length: vehicleText.length });

  const { eligible, reasons } = evaluateRepairEligibility(settings, vehicleText);

  if (!eligible) {
    logger.warn("수리 불가 조건 일치 — 견적 취소 분기", {
      reasonCount: reasons.length,
      reasons,
    });
    await handleQuoteCancellation(driver, logger, reasons);
    return "cancelled";
  }

  logger.info("수리 불가 조건 없음 — 견적 작성 분기");
  await handleQuoteDraft(driver, logger, settings);
  return "draft";
}

/** @param {Array<{ kind: string; value: string }>} reasons */
async function handleQuoteCancellation(driver, logger, reasons) {
  void driver; // 취소 버튼 자동화 시 driver 사용 예정
  logger.info("TODO: 견적 취소 UI 자동화 — 취소 버튼 셀렉터·확인 모달 처리 필요", {
    matchedReasons: reasons,
  });
}

/**
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {Record<string, unknown>} settings
 */
async function handleQuoteDraft(driver, logger, settings) {
  void driver; // selectors.detail.quoteForm 조작 시 사용 예정
  void settings; // 견적 금액·부위 설정 반영 시 사용 예정
  logger.info("TODO: 견적 작성 폼 자동화 — selectors.detail.quoteForm 내부 입력·라디오·전송", {});
}

module.exports = {
  runPostDetailQuoteFlow,
  handleQuoteCancellation,
  handleQuoteDraft,
};
