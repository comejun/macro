/**
 * Chrome WebDriver 팩토리.
 * Selenium 4의 Selenium Manager가 설치된 Chrome에 맞는 chromedriver를
 * 자동 다운로드하므로, 사용자 PC에 Chrome만 설치되어 있으면 됩니다.
 */
const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

/**
 * @param {{ headless?: boolean, userDataDir?: string }} [options]
 * @returns {Promise<import("selenium-webdriver").WebDriver>}
 */
async function createChromeDriver(options = {}) {
  // userDataDir: 실제 Chrome 프로필 경로를 넘기면 쿠키·세션 재사용 가능
  const { headless = false, userDataDir } = options;

  const chromeOptions = new chrome.Options();
  if (headless) {
    chromeOptions.addArguments("--headless=new");
  }
  // 사이트가 자동화 플래그를 감지해 차단하는 경우를 줄입니다.
  chromeOptions.addArguments("--start-maximized");
  chromeOptions.addArguments("--disable-blink-features=AutomationControlled");
  chromeOptions.excludeSwitches("enable-automation");
  if (userDataDir) {
    chromeOptions.addArguments(`--user-data-dir=${userDataDir}`);
  }

  return new Builder().forBrowser("chrome").setChromeOptions(chromeOptions).build();
}

module.exports = { createChromeDriver };
