/**
 * Selenium DOM 보조 함수 모음.
 * 모든 페이지 조작은 이 모듈을 거쳐 일관된 대기/검증 패턴을 적용합니다.
 */
const { until, Key } = require("selenium-webdriver");

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * 마스킹된 입력값을 평문 노출 없이 진단할 수 있도록 문자 카테고리만 노출합니다.
 * 예: "Abc 12!" → "Ull_dd?"
 */
function describeShape(s) {
  return [...(s ?? "")]
    .map((ch) => {
      if (/[A-Z]/.test(ch)) return "U";
      if (/[a-z]/.test(ch)) return "l";
      if (/\d/.test(ch)) return "d";
      if (/\s/.test(ch)) return "_";
      return "?";
    })
    .join("");
}

/**
 * 셀렉터 위치의 입력칸을 안전하게 채워 넣습니다.
 *  - 명시적 대기로 DOM 진입을 기다립니다.
 *  - clear()와 Cmd/Ctrl+A → DELETE 시퀀스로 React 컨트롤드 인풋도 비웁니다.
 *  - sendKeys로 input/change 이벤트가 정상 발생하도록 합니다.
 *  - 입력 결과를 value 속성으로 검증합니다.
 *    · mask=false: 정확한 값 일치 검증 (불일치 시 평문 expose 가능).
 *    · mask=true : 평문 노출을 피하기 위해 길이만 검증. 길이가 어긋나면
 *      문자 카테고리 형태(예: lll-dd_)를 함께 던져 디버깅을 돕습니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {import("selenium-webdriver").Locator} locator
 * @param {string} value
 * @param {{ timeout?: number, mask?: boolean }} [options]
 * @returns {Promise<string>} 검증에 쓴 실제 value (mask=true일 때는 마스킹 문자열)
 */
async function typeInto(driver, locator, value, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS, mask = false } = options;

  const el = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(el), timeout);
  await driver.wait(until.elementIsEnabled(el), timeout);

  await el.click();
  await el.clear();
  const selectAllKey = process.platform === "darwin" ? Key.COMMAND : Key.CONTROL;
  await el.sendKeys(Key.chord(selectAllKey, "a"));
  await el.sendKeys(Key.DELETE);

  await el.sendKeys(value);

  const actual = (await el.getAttribute("value")) ?? "";

  if (mask) {
    if (actual.length !== value.length) {
      throw new Error(
        `입력 검증 실패 (expected length=${value.length}, actual length=${actual.length}, expected shape=${describeShape(value)}, actual shape=${describeShape(actual)})`
      );
    }
    return "*".repeat(value.length);
  }

  if (actual !== value) {
    throw new Error(
      `입력 검증 실패 (expected="${value}", actual="${actual}")`
    );
  }
  return actual;
}

/**
 * 셀렉터 위치 요소를 클릭합니다.
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {import("selenium-webdriver").Locator} locator
 * @param {{ timeout?: number }} [options]
 */
async function click(driver, locator, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS } = options;
  const el = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(el), timeout);
  await driver.wait(until.elementIsEnabled(el), timeout);
  await el.click();
  return el;
}

module.exports = {
  typeInto,
  click,
  DEFAULT_TIMEOUT_MS,
};
