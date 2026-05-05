/**
 * 수리 가능 견적 — 작성 폼 단계 자동화.
 */
const { By, until } = require("selenium-webdriver");
const selectors = require("./selectors");
const { DEFAULT_TIMEOUT_MS, typeIntoElement } = require("./dom");
const { parseCsvList } = require("./repair-eligibility");

/** 한 번에 처리할 최대 삭제 시도 — 무한 루프 방지 */
const MAX_REMOVE_PASSES = 64;
/** 수리방법 행 순회 상한 */
const MAX_REPAIR_METHOD_ROWS = 64;

/** 공백 정규화(연속 공백·앞뒤 trim) — 페이지 텍스트·설정값 비교 시 공통 사용 */
function normalizeWs(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 앱 설정 `domesticBrandsCsv`(국산차 기준 브랜드) 중 하나라도 브랜드·차종 줄에 포함되면 국산, 아니면 수입.
 * 브랜드 줄이 비었거나 CSV가 비어 있으면 unknown.
 *
 * @returns {"국산"|"수입"|"unknown"}
 */
function classifyDomesticImportFromBrandLineAndCsv(brandLineRaw, domesticBrandsCsv) {
  const blob = normalizeWs(brandLineRaw);
  if (!blob) return "unknown";
  const brands = parseCsvList(domesticBrandsCsv);
  if (brands.length === 0) return "unknown";
  for (const brand of brands) {
    if (brand && blob.includes(brand)) return "국산";
  }
  return "수입";
}

/**
 * 보험 구분 span — `비보험 수리` 이면 비보험, 그 외는 보험.
 * @returns {"비보험"|"보험"}
 */
function classifyInsuranceFromSpanText(text) {
  const t = normalizeWs(text);
  if (t.includes("비보험 수리")) return "비보험";
  return "보험";
}

/**
 * @param {"국산"|"수입"|"unknown"} origin
 * @param {"비보험"|"보험"} coverage
 * @returns {string|null} 네 가지 견적 종류 라벨 또는 판별 불가 시 null
 */
function quoteKindLabelFourWay(origin, coverage) {
  if (origin === "국산") {
    return coverage === "비보험" ? "국산 비보험" : "국산 보험";
  }
  if (origin === "수입") {
    return coverage === "비보험" ? "수입 비보험" : "수입 보험";
  }
  return null;
}

/**
 * 상세 패널에서 국산/수입·보험 구분 필드를 읽어 판별합니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {Record<string, unknown>} settings
 */
async function readQuoteKindFromDetail(driver, settings) {
  let brandLineRaw = "";
  let insuranceSpanRaw = "";

  try {
    const el = await driver.findElement(selectors.detail.brandAndModelLine);
    brandLineRaw = normalizeWs(await el.getText());
  } catch {
    brandLineRaw = ""; /* 요소 없음·타임아웃 시 빈 문자열로 후속 판별 위임 */
  }

  try {
    const el = await driver.findElement(selectors.detail.quoteInsuranceCategorySpan);
    insuranceSpanRaw = normalizeWs(await el.getText());
  } catch {
    insuranceSpanRaw = ""; /* span 없으면 보험 판별은 classifyInsuranceFromSpanText 폴백 */
  }

  const domesticImport = classifyDomesticImportFromBrandLineAndCsv(
    brandLineRaw,
    settings.domesticBrandsCsv,
  );
  const insuranceCategory = classifyInsuranceFromSpanText(insuranceSpanRaw);

  return {
    brandLineRaw,
    insuranceSpanRaw,
    domesticImport,
    insuranceCategory,
  };
}

/**
 * 견적 종류에 해당하는 설정 금액(`prices.*`) 문자열.
 *
 * @param {Record<string, unknown>} settings
 * @param {"국산"|"수입"|"unknown"} domesticImport
 * @param {"비보험"|"보험"} insuranceCategory
 */
function repairPriceStringForQuoteKind(settings, domesticImport, insuranceCategory) {
  const prices =
    settings.prices && typeof settings.prices === "object" ? settings.prices : {};
  if (domesticImport === "국산" && insuranceCategory === "비보험") {
    return String(prices.domesticUninsured ?? "").trim();
  }
  if (domesticImport === "국산" && insuranceCategory === "보험") {
    return String(prices.domesticInsurance ?? "").trim();
  }
  if (domesticImport === "수입" && insuranceCategory === "비보험") {
    return String(prices.importUninsured ?? "").trim();
  }
  if (domesticImport === "수입" && insuranceCategory === "보험") {
    return String(prices.importInsurance ?? "").trim();
  }
  return "";
}

/**
 * 견적 작성 진입 시 국산/수입·보험/비보험을 읽어 로그만 남깁니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {Record<string, unknown>} settings
 */
async function detectAndLogQuoteKind(driver, logger, settings) {
  const { brandLineRaw, insuranceSpanRaw, domesticImport, insuranceCategory } =
    await readQuoteKindFromDetail(driver, settings);
  const quoteKind = quoteKindLabelFourWay(domesticImport, insuranceCategory);

  logger.info("견적 작성 — 견적 종류", {
    quoteKind: quoteKind ?? "미상(브랜드 줄 또는 국산차 기준 브랜드 설정 확인)",
    domesticImport,
    insuranceCategory,
    brandModelLine: brandLineRaw,
    insuranceSpanText: insuranceSpanRaw,
  });
}

/**
 * 스크롤 컨테이너 안 버튼은 Selenium 기본 click이 가로채이거나 누락되는 경우가 많아
 * 뷰포트 중앙으로 스크롤한 뒤 네이티브 클릭 → 실패 시 JS click 순으로 시도합니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {import("selenium-webdriver").WebElement} li
 * @param {string} btnRel
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {string} labelText
 */
async function clickPartRemoveButton(driver, li, btnRel, logger, labelText) {
  let btn = await li.findElement(By.css(btnRel));
  await driver.executeScript(
    "arguments[0].scrollIntoView({block:'center',inline:'nearest'});",
    btn,
  );
  await driver.sleep(200);
  /* 스크롤 후 stale 방지로 동일 셀렉터 재조회 */
  btn = await li.findElement(By.css(btnRel));

  await driver.wait(until.elementIsVisible(btn), DEFAULT_TIMEOUT_MS);
  await driver.wait(until.elementIsEnabled(btn), DEFAULT_TIMEOUT_MS);

  try {
    await btn.click();
  } catch (err) {
    logger.warn("견적 작성 — 삭제 버튼 JS 클릭 재시도", {
      part: labelText,
    });
    await driver.executeScript("arguments[0].click();", btn);
  }
}

/**
 * 부위 목록 `li` 개수에 따른 등급 숫자 (설정 화면 규칙).
 * — 사용자 원문에 「5~6→4」와 「5 이상→5」가 함께 있어, 상위 규칙 우선 후 **7개 이상만 5** 로 처리합니다.
 *
 * @param {number} n
 * @returns {string|null}
 */
function tierDigitFromPartLiCount(n) {
  if (n <= 0) return null;
  if (n <= 2) return "1";
  if (n === 3) return "2";
  if (n === 4) return "3";
  if (n <= 6) return "4";
  return "5";
}

/**
 * 부품 단계용 react-aria input — 표시 중인 후보를 역순으로 검색해 입력합니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {string} value
 * @param {number} timeoutMs
 */
async function waitAndTypeReactAriaPartsInput(driver, value, timeoutMs) {
  const xpath = By.xpath("//input[starts-with(@id,'react-aria')]");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const els = await driver.findElements(xpath);
    for (let j = els.length - 1; j >= 0; j -= 1) {
      const el = els[j];
      try {
        if (!(await el.isDisplayed())) continue;
        await driver.executeScript(
          "arguments[0].scrollIntoView({block:'center',inline:'nearest'});",
          el,
        );
        await driver.sleep(100);
        await typeIntoElement(driver, el, value);
        return;
      } catch {
        /* stale */
      }
    }
    await driver.sleep(120);
  }
  throw new Error("react-aria 부품 입력 필드를 찾지 못했습니다.");
}

/**
 * 폼 하단 래퍼(`quoteFormTierInputWrapper`) 안의 `input`에 부위 등급 숫자를 입력합니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {string} value
 * @param {number} timeoutMs
 */
async function typeTierInputInQuoteFormFooter(driver, value, timeoutMs) {
  const wrapperLoc = selectors.detail.quoteFormTierInputWrapper;
  await driver.wait(until.elementLocated(wrapperLoc), timeoutMs);
  const wrapper = await driver.findElement(wrapperLoc);
  let inp = await wrapper.findElement(By.css("input"));
  await driver.executeScript(
    "arguments[0].scrollIntoView({block:'center',inline:'nearest'});",
    inp,
  );
  await driver.sleep(100);
  inp = await wrapper.findElement(By.css("input")); /* 스크롤 직후 재조회 */
  await typeIntoElement(driver, inp, value);
}

/**
 * `form > div:nth-child(4) > ul` 의 직계 `li` 개수 로그 후, 등급 숫자를 폼 하단 입력에 반영합니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {import("selenium-webdriver").Locator} ulLoc
 */
async function logPartRowCountAndFillTierInput(driver, logger, ulLoc) {
  const ul = await driver.findElement(ulLoc);
  const partLiCount = (await ul.findElements(By.xpath("./li"))).length;

  logger.info("견적 작성 — 부위 목록 li 개수", { partLiCount });

  const tierVal = tierDigitFromPartLiCount(partLiCount);
  if (tierVal == null) {
    logger.warn("견적 작성 — 부위 li 없음 — 등급 입력 스킵");
    return;
  }

  logger.info("견적 작성 — 부위 등급 입력값", { partLiCount, tierInput: tierVal });

  try {
    const scrollEl = await driver.findElement(selectors.detail.scrollContainer);
    await driver.executeScript(
      "arguments[0].scrollTop = arguments[0].scrollHeight",
      scrollEl,
    );
    await driver.sleep(350);
    await typeTierInputInQuoteFormFooter(driver, tierVal, DEFAULT_TIMEOUT_MS);
  } catch (err) {
    logger.warn("견적 작성 — 부위 등급 입력 실패", {
      partLiCount,
      tierInput: tierVal,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * 부위 행(`li`) 안의 버튼을 스크롤 노출 후 클릭합니다. 가로채기 시 JS 클릭으로 한 번 더 시도합니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {import("selenium-webdriver").WebElement} li
 * @param {string} cssSelector 행 기준 상대 CSS
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {Record<string, unknown>} [warnMeta] 재시도 로그에 넣을 메타
 */
async function scrollClickElementInRow(driver, li, cssSelector, logger, warnMeta) {
  let el = await li.findElement(By.css(cssSelector));
  await driver.executeScript(
    "arguments[0].scrollIntoView({block:'center',inline:'nearest'});",
    el,
  );
  await driver.sleep(200);
  el = await li.findElement(By.css(cssSelector));
  await driver.wait(until.elementIsVisible(el), DEFAULT_TIMEOUT_MS);
  await driver.wait(until.elementIsEnabled(el), DEFAULT_TIMEOUT_MS);
  try {
    await el.click();
  } catch {
    logger.warn("견적 작성 — 행 내 버튼 JS 클릭 재시도", warnMeta ?? {});
    await driver.executeScript("arguments[0].click();", el);
  }
}

/**
 * 금액 입력 후: 부품 메뉴 버튼 → 부품 텍스트(react-aria input) → 행 확인 버튼.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {import("selenium-webdriver").WebElement} li
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {number} rowIndex
 * @param {string} partsTextStr
 */
async function runPartsTextStepAfterPrice(
  driver,
  li,
  logger,
  rowIndex,
  partsTextStr,
) {
  const menuSel = selectors.detail.quotePartPartsMenuBtnRelative;
  const confirmSel = selectors.detail.quotePartPartsRowConfirmBtnRelative;

  await scrollClickElementInRow(driver, li, menuSel, logger, {
    step: "부품 메뉴",
    rowIndex,
  });

  await waitAndTypeReactAriaPartsInput(
    driver,
    partsTextStr,
    DEFAULT_TIMEOUT_MS,
  );

  await scrollClickElementInRow(driver, li, confirmSel, logger, {
    step: "부품 확인",
    rowIndex,
  });
}

/**
 * 수리방법 콤보가 연 뒤 Radix 포털에서 첫 옵션 블록(`div/div/div[1]`)을 클릭합니다.
 * 포털 id(`radix-:rxx:`)는 매 세션마다 달라져 접두사 XPath만 사용합니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {number} timeoutMs
 */
async function clickRadixRepairMethodFirstPanelDiv(driver, logger, timeoutMs) {
  const xpath = By.xpath("//*[starts-with(@id,'radix-')]/div/div/div[1]");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const els = await driver.findElements(xpath);
    for (let i = els.length - 1; i >= 0; i -= 1) {
      const el = els[i];
      try {
        if (!(await el.isDisplayed())) continue;
        await driver.executeScript(
          "arguments[0].scrollIntoView({block:'center',inline:'nearest'});",
          el,
        );
        await driver.sleep(100);
        try {
          await el.click();
        } catch {
          await driver.executeScript("arguments[0].click();", el);
        }
        return;
      } catch {
        /* stale */
      }
    }
    await driver.sleep(120);
  }
  logger.warn("견적 작성 — 수리방법 Radix 첫 패널(div) 타임아웃");
  throw new Error("수리방법 Radix 첫 옵션 영역을 찾지 못했습니다.");
}

/**
 * 수리방법·금액·부품 텍스트를 부위 목록(`form > div:nth-child(4) > ul`)의 각 `li`에 채운 뒤,
 * 전체 `li` 개수로 부위 등급 숫자를 폼 하단 입력란에 넣습니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {Record<string, unknown>} settings
 */
async function fillRepairMethodForAllPartRows(driver, logger, settings) {
  const ulLoc = selectors.detail.quoteFormPartsListRepairMethod;
  const btnRel = selectors.detail.quotePartRepairMethodTriggerBtnRelative;
  const priceInputRel = selectors.detail.quotePartRepairPriceInputRelative;

  await driver.wait(until.elementLocated(ulLoc), DEFAULT_TIMEOUT_MS);

  /* 견적 종류 → 설정 화면의 단일 금액 문자열 */
  const { domesticImport, insuranceCategory } = await readQuoteKindFromDetail(
    driver,
    settings,
  );
  const priceStr = repairPriceStringForQuoteKind(
    settings,
    domesticImport,
    insuranceCategory,
  );
  if (!priceStr) {
    logger.warn("견적 작성 — 수리 금액 스킵(견적 종류 미확정 또는 해당 가격 미설정)", {
      domesticImport,
      insuranceCategory,
    });
  }

  const partsTextStr = String(settings.partsText ?? "").trim();
  if (!partsTextStr) {
    logger.warn("견적 작성 — 부품 텍스트 미설정 — 부품 입력 단계 생략");
  }

  const ulInitial = await driver.findElement(ulLoc);
  const rowCount = (await ulInitial.findElements(By.xpath("./li"))).length;
  if (rowCount === 0) {
    return;
  }

  let filled = 0;
  /* DOM 변경·무한 루프 방지로 행 수 상한 적용 */
  const maxRows = Math.min(rowCount, MAX_REPAIR_METHOD_ROWS);

  for (let i = 0; i < maxRows; i += 1) {
    /* 매 행마다 ul·li 재조회 — 이전 행 조작 후 stale 방지 */
    const ul = await driver.findElement(ulLoc);
    const lis = await ul.findElements(By.xpath("./li"));
    if (i >= lis.length) break;

    const li = lis[i];
    let btn;
    try {
      btn = await li.findElement(By.css(btnRel));
    } catch {
      continue; /* 해당 행에 수리방법 트리거 없음(레이아웃 차이 등) */
    }

    await driver.executeScript(
      "arguments[0].scrollIntoView({block:'center',inline:'nearest'});",
      btn,
    );
    await driver.sleep(200);
    btn = await li.findElement(By.css(btnRel));
    await driver.wait(until.elementIsVisible(btn), DEFAULT_TIMEOUT_MS);
    await driver.wait(until.elementIsEnabled(btn), DEFAULT_TIMEOUT_MS);

    try {
      await btn.click();
    } catch {
      await driver.executeScript("arguments[0].click();", btn);
    }

    await clickRadixRepairMethodFirstPanelDiv(
      driver,
      logger,
      DEFAULT_TIMEOUT_MS,
    );

    /* 같은 행의 금액 필드 */
    if (priceStr) {
      try {
        let inp = await li.findElement(By.css(priceInputRel));
        await driver.executeScript(
          "arguments[0].scrollIntoView({block:'center',inline:'nearest'});",
          inp,
        );
        await driver.sleep(150);
        inp = await li.findElement(By.css(priceInputRel));
        await typeIntoElement(driver, inp, priceStr);
      } catch (err) {
        logger.warn("견적 작성 — 수리 금액 입력 실패", {
          rowIndex: i,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    /* 설정 `partsText`가 있을 때만 부품 메뉴·react-aria 입력·확인 */
    if (partsTextStr) {
      try {
        await runPartsTextStepAfterPrice(driver, li, logger, i, partsTextStr);
      } catch (err) {
        logger.warn("견적 작성 — 부품 텍스트 단계 실패", {
          rowIndex: i,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    filled += 1;
    await driver.sleep(150);
  }

  if (filled > 0) {
    logger.info("견적 작성 — 수리방법 입력 단계 완료", { rows: filled });
  }

  /* 현재 ul의 li 개수 재집계 후 등급 입력(폼 하단) */
  await logPartRowCountAndFillTierInput(driver, logger, ulLoc);
}

/** `deleteParts` 설정 배열을 trim·빈 문자열 제거한 Set으로 만듭니다. */
function normalizeDeletePartsSet(raw) {
  if (!Array.isArray(raw)) return new Set();
  return new Set(
    raw.map((v) => String(v).trim()).filter((s) => s.length > 0),
  );
}

/**
 * XPath 라벨 `getText()`에 줄바꿈이 있으면 첫 `\n` 뒤만 deleteParts와 비교합니다.
 * 줄바꿈이 없으면 빈 문자열(비교 대상 없음)입니다.
 *
 * @param {unknown} raw
 */
function textAfterFirstNewlineForDeletePartsMatch(raw) {
  const normalized = String(raw ?? "").replace(/\r\n/g, "\n");
  const i = normalized.indexOf("\n");
  if (i === -1) return "";
  return normalized.slice(i + 1).trim();
}

/**
 * 견적 폼 부위 목록에서 `deleteParts`와 라벨이 일치하는 행의 삭제 버튼을 누릅니다.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {Record<string, unknown>} settings
 */
async function removeQuotePartsMatchingDeleteList(driver, logger, settings) {
  const deleteSet = normalizeDeletePartsSet(settings.deleteParts);
  if (deleteSet.size === 0) {
    return;
  }

  const ulLocator = selectors.detail.quoteFormPartsList;
  const labelXPathRel = selectors.detail.quotePartRowLabelRelativeXPath;
  const btnRel = selectors.detail.quotePartRowRemoveBtnRelative;

  await driver.wait(until.elementLocated(ulLocator), DEFAULT_TIMEOUT_MS);

  let totalRemoved = 0;
  /* 한 패스에 최대 1행만 삭제 후 목록이 바뀌므로 바깥 루프로 반복 */
  for (let pass = 0; pass < MAX_REMOVE_PASSES; pass += 1) {
    const ul = await driver.findElement(ulLocator);
    const lis = await ul.findElements(By.xpath("./li"));
    let clickedThisPass = false;

    for (const li of lis) {
      let labelText;
      try {
        const labelEl = await li.findElement(By.xpath(labelXPathRel));
        labelText = textAfterFirstNewlineForDeletePartsMatch(
          (await labelEl.getText()).trim(),
        );
      } catch {
        continue;
      }

      if (!deleteSet.has(labelText)) continue;

      try {
        await clickPartRemoveButton(driver, li, btnRel, logger, labelText);
        totalRemoved += 1;
        clickedThisPass = true;
        break; /* 목록 갱신 후 처음부터 다시 순회 */
      } catch (err) {
        logger.warn("견적 작성 — deleteParts 행 삭제 실패", {
          part: labelText,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!clickedThisPass) break;
  }

  if (totalRemoved > 0) {
    logger.info("견적 작성 — deleteParts 행 삭제 완료", { removed: totalRemoved });
  }
}

/**
 * 수리 가능 견적의 작성 폼 자동화 진입점.
 * 순서: 견적 종류 로그 → deleteParts 행 삭제 → 수리방법/금액/부품/부위등급.
 *
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {Record<string, unknown>} settings electron-store 스냅샷
 */
async function performQuoteDraft(driver, logger, settings) {
  logger.info("견적 작성 분기 시작");
  await detectAndLogQuoteKind(driver, logger, settings);
  await removeQuotePartsMatchingDeleteList(driver, logger, settings);
  await fillRepairMethodForAllPartRows(driver, logger, settings);
}

/** 단위 테스트·외부 모듈에서 일부 함수만 재사용할 때 노출 */
module.exports = {
  performQuoteDraft,
  detectAndLogQuoteKind,
  removeQuotePartsMatchingDeleteList,
  fillRepairMethodForAllPartRows,
  normalizeDeletePartsSet,
  textAfterFirstNewlineForDeletePartsMatch,
};
