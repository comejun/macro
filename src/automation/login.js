/**
 * 카닥 파트너스 로그인 흐름.
 * 입력 → 제출 → 페이지 전환 확인까지 한 번에 수행합니다.
 */
const { typeInto, click } = require("./dom");
const selectors = require("./selectors");

const LOGIN_TRANSITION_TIMEOUT_MS = 15_000;

/**
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {{ id: string, password: string }} credentials
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 */
async function login(driver, credentials, logger) {
  const { id, password } = credentials;

  logger.info("아이디 입력 시작");
  await typeInto(driver, selectors.login.id, id);
  logger.info("아이디 입력 완료");

  logger.info("비밀번호 입력 시작");
  // 비밀번호는 절대 평문 로깅하지 않습니다.
  await typeInto(driver, selectors.login.password, password, { mask: true });
  logger.info("비밀번호 입력 완료");

  logger.info("로그인 버튼 클릭");
  await click(driver, selectors.login.submit);

  // 로그인 성공 판정: URL이 더 이상 sign-in 경로를 포함하지 않을 때.
  await driver.wait(
    async () => {
      const url = await driver.getCurrentUrl();
      return !url.includes(selectors.login.pendingUrlFragment);
    },
    LOGIN_TRANSITION_TIMEOUT_MS,
    "로그인 후 페이지 전환을 기다리다 시간 초과 — 자격 증명 또는 캡차 여부 확인"
  );

  const finalUrl = await driver.getCurrentUrl();
  logger.info("로그인 성공", { url: finalUrl });
}

module.exports = { login };
