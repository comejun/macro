/**
 * 견적 발송 후 메시지 영역으로 이동해 동일 견적 요청 번호 스레드를 연다.
 */
const { until, Key } = require("selenium-webdriver");
const selectors = require("./selectors");
const { DEFAULT_TIMEOUT_MS, click, typeInto } = require("./dom");

/** 번호 비교용 공백 정규화 */
function normalizeRequestNumber(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * BMP 밖 문자(이모지 등)도 안전하게 처리하기 위해 JS로 textarea value를 주입하고
 * React가 감지할 수 있도록 input/change 이벤트를 발생시킵니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {import("selenium-webdriver").WebElement} textareaEl
 * @param {string} value
 */
async function injectTextareaValueWithEvents(driver, textareaEl, value) {
  await driver.executeScript(
    `
      const el = arguments[0];
      const next = String(arguments[1] ?? "");
      el.focus();
      el.value = next;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    `,
    textareaEl,
    value,
  );
}

/**
 * 메시지 단계 진입 전, 진행 상태 `ol > li > div > div > div > p`가
 * 한 번 보였다가 사라지는 것을 확인합니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {number} timeoutMs
 */
async function waitUntilTransientStatusPAppearsThenDisappears(
  driver,
  logger,
  timeoutMs,
) {
  const locator = selectors.messages.preEntryTransientStatusP;
  const deadline = Date.now() + timeoutMs;
  let seen = false;
  let goneStablePasses = 0;

  while (Date.now() < deadline) {
    const els = await driver.findElements(locator);
    let visibleCount = 0;
    for (const el of els) {
      try {
        if (await el.isDisplayed()) visibleCount += 1;
      } catch {
        /* stale */
      }
    }

    if (visibleCount > 0) {
      seen = true;
      goneStablePasses = 0;
    } else if (seen) {
      goneStablePasses += 1;
      if (goneStablePasses >= 2) {
        logger.info("메시지 전 단계 진행 상태 p 생성/소멸 확인 완료");
        return;
      }
    }

    await driver.sleep(120);
  }

  throw new Error(
    seen
      ? "메시지 전 단계 진행 상태 p가 사라질 때까지 기다리는 중 타임아웃"
      : "메시지 전 단계 진행 상태 p가 나타나지 않아 타임아웃",
  );
}

/**
 * 상단 네비 `a:nth-child(2) > span` 클릭 → 검색창에 요청 번호 입력 → Enter → 목록에서 번호 일치 li 클릭.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {string} requestNumberRaw 폴러에서 읽은 견적 요청 번호
 * @param {Record<string, unknown>} [settings]
 */
async function performQuoteMessaging(driver, logger, requestNumberRaw, settings = {}) {
  const needle = normalizeRequestNumber(requestNumberRaw);
  if (!needle) {
    throw new Error("견적 요청 번호가 비어 있습니다.");
  }
  const followUpMessage = String(settings.quoteSentFollowUpText ?? "").trim();
  if (!followUpMessage) {
    throw new Error(
      "설정 `quoteSentFollowUpText` 가 비어 있어 메시지 발송 단계를 진행할 수 없습니다.",
    );
  }

  logger.info("메시지 전송 단계 시작", { requestNumber: needle });
  logger.info("메시지 전송 — 단계 1/4: 진입 전 상태 p 생성/소멸 대기 시작");
  await waitUntilTransientStatusPAppearsThenDisappears(
    driver,
    logger,
    DEFAULT_TIMEOUT_MS * 2,
  );
  logger.info("메시지 전송 — 단계 1/4: 진입 전 상태 p 생성/소멸 대기 완료");

  logger.info("메시지 전송 — 단계 2/4: 상단 두 번째 탭 클릭 시작");
  await click(driver, selectors.messages.headerSecondTabSpan, {
    timeout: DEFAULT_TIMEOUT_MS,
  });
  await driver.sleep(350);
  logger.info("메시지 전송 — 단계 2/4: 상단 두 번째 탭 클릭 완료");

  logger.info("메시지 전송 — 단계 3/4: 견적 요청 번호 검색 입력/엔터 시작", {
    requestNumber: needle,
  });
  await typeInto(driver, selectors.messages.searchFormInput, needle);
  const inputEl = await driver.wait(
    until.elementLocated(selectors.messages.searchFormInput),
    DEFAULT_TIMEOUT_MS,
  );
  await inputEl.sendKeys(Key.RETURN);
  await driver.sleep(600);
  await driver.sleep(2000);
  logger.info("메시지 전송 — 단계 3/4: 견적 요청 번호 검색 입력/엔터 완료");

  logger.info("메시지 전송 — 단계 4/7: 검색 결과 목록에서 일치 행 탐색 시작");
  const lis = await driver.findElements(selectors.requests.items);
  for (const li of lis) {
    let rowNumber = "";
    try {
      const spans = await li.findElements(selectors.requests.requestNumberSpan);
      if (spans.length === 0) continue;
      rowNumber = normalizeRequestNumber(await spans[0].getText());
    } catch {
      continue;
    }
    if (rowNumber !== needle) continue;

    await driver.executeScript(
      "arguments[0].scrollIntoView({block:'center',inline:'nearest'});",
      li,
    );
    await driver.sleep(150);
    try {
      await li.click();
    } catch {
      await driver.executeScript("arguments[0].click();", li);
    }
    logger.info("메시지 스레드 행 클릭 완료", { requestNumber: needle });
    const quotePageUrl = await driver.getCurrentUrl();
    logger.info("메시지 전송 — 단계 4/7: 검색 결과 목록에서 일치 행 탐색 완료");
    logger.info("메시지 전송 — 견적 링크", {
      requestNumber: needle,
      quotePageUrl,
    });

    logger.info("메시지 전송 — 단계 5/7: 하단 sticky 링크 버튼 클릭 시작");
    await click(driver, selectors.messages.threadOpenLinkButton, {
      timeout: DEFAULT_TIMEOUT_MS,
    });
    logger.info("메시지 전송 — 단계 5/7: 하단 sticky 링크 버튼 클릭 완료");

    logger.info("메시지 전송 — 단계 6/7: 채팅 textarea 입력/전송버튼 클릭 시작");
    const textareaEl = await driver.wait(
      until.elementLocated(selectors.messages.chatTextarea),
      DEFAULT_TIMEOUT_MS,
    );
    await driver.wait(until.elementIsVisible(textareaEl), DEFAULT_TIMEOUT_MS);
    await driver.wait(until.elementIsEnabled(textareaEl), DEFAULT_TIMEOUT_MS);
    await injectTextareaValueWithEvents(driver, textareaEl, followUpMessage);
    const actualValue = String((await textareaEl.getAttribute("value")) ?? "");
    if (actualValue !== followUpMessage) {
      throw new Error("메시지 textarea 값 주입 검증 실패");
    }
    await textareaEl.click();
    await textareaEl.sendKeys(Key.SPACE);
    await click(driver, selectors.messages.chatSendButton, {
      timeout: DEFAULT_TIMEOUT_MS,
    });
    logger.info("메시지 전송 — 단계 6/7: 채팅 textarea 입력/전송버튼 클릭 완료");

    logger.info("메시지 전송 — 단계 7/7: 상단 첫 메뉴 클릭(신규 견적 복귀) 시작");
    await click(driver, selectors.messages.returnToNewRequestsLink, {
      timeout: DEFAULT_TIMEOUT_MS,
    });
    await driver.wait(until.elementLocated(selectors.requests.list), DEFAULT_TIMEOUT_MS);
    logger.info("메시지 전송 — 단계 7/7: 상단 첫 메뉴 클릭(신규 견적 복귀) 완료");
    logger.info("메시지 전송 단계 종료", { requestNumber: needle });
    return {
      requestNumber: needle,
      quotePageUrl,
    };
  }

  throw new Error(
    `검색 결과에서 견적 요청 번호 "${needle}" 과 일치하는 li 를 찾지 못했습니다.`,
  );
}

module.exports = {
  performQuoteMessaging,
  normalizeRequestNumber,
};
