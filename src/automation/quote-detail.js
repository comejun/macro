/**
 * 목록에서 견적 행(li) 클릭 후 우측(또는 패널) 상세 영역이 뜰 때까지 대기합니다.
 */
const { until } = require("selenium-webdriver");
const selectors = require("./selectors");

const DETAIL_PANEL_TIMEOUT_MS = 15_000;

/**
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {import("selenium-webdriver").WebElement} targetLi
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 */
async function clickQuoteRowAndWaitForDetail(driver, targetLi, logger) {
  logger.info("견적 요청 행 클릭");
  // 뷰포트 밖에 있으면 클릭이 실패할 수 있어 스크롤을 맞춥니다.
  await driver.executeScript(
    "arguments[0].scrollIntoView({ block: 'center', inline: 'nearest' });",
    targetLi
  );

  await driver.wait(until.elementIsVisible(targetLi), DETAIL_PANEL_TIMEOUT_MS);
  await driver.wait(until.elementIsEnabled(targetLi), DETAIL_PANEL_TIMEOUT_MS);
  await targetLi.click();

  // SPA 전환 후 우측 패널 DOM이 붙을 때까지 순서대로 대기
  logger.info("상세 패널 로드 대기");
  await driver.wait(
    until.elementLocated(selectors.detail.scrollContainer),
    DETAIL_PANEL_TIMEOUT_MS
  );
  const scrollEl = await driver.findElement(selectors.detail.scrollContainer);
  await driver.wait(until.elementIsVisible(scrollEl), DETAIL_PANEL_TIMEOUT_MS);

  await driver.wait(
    until.elementLocated(selectors.detail.vehicleSection),
    DETAIL_PANEL_TIMEOUT_MS
  );
  await driver.wait(until.elementLocated(selectors.detail.quoteForm), DETAIL_PANEL_TIMEOUT_MS);

  logger.info("견적 상세 진입 확인", {
    scroll: true,
    vehicleSection: true,
    quoteForm: true,
  });
}

module.exports = { clickQuoteRowAndWaitForDetail, DETAIL_PANEL_TIMEOUT_MS };
