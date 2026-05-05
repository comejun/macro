/**
 * 상세 페이지 진입 후: 차량 정보 검사 → 수리 불가면 견적 취소, 아니면 견적 작성.
 */
const selectors = require("./selectors");
const {
  evaluateRepairEligibility,
  evaluateRepairEligibilityStructured,
} = require("./repair-eligibility");
const { performQuoteCancellation } = require("./cancellation");
const {
  performQuoteDraft,
  classifyDomesticImportFromBrandLineAndCsv,
  classifyInsuranceFromSpanText,
  quoteKindLabelFourWay,
  repairPriceStringForQuoteKind,
} = require("./quote-draft");
const { performQuoteMessaging } = require("./quote-messaging");
const { postSlackWebhook, fillTemplate } = require("./slack");

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
 * @param {string | null} [requestNumber] 폴러에서 읽은 번호 — 메시지 단계에 사용
 * @returns {Promise<"cancelled"|"draft">}
 */
async function runPostDetailQuoteFlow(driver, settings, logger, requestNumber = null) {
  const brandAndModelText = await safeGetText(driver, selectors.detail.brandAndModelLine);
  const repairPartsRaw = await safeGetText(driver, selectors.detail.repairPartsSpan);
  const insuranceSpanText =
    (await safeGetText(driver, selectors.detail.quoteInsuranceCategorySpan)) ?? "";

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
    await handleQuoteCancellation(driver, logger, reasons, summaryLines, {
      brandModelLine: String(brandAndModelText ?? "").trim(),
      cancellationSlackWebhookUrl: String(settings?.cancellationSlackWebhookUrl ?? ""),
    });
    return "cancelled";
  }

  logger.info("수리 불가 조건 없음 — 견적 작성 분기");
  const slackQuoteMeta = buildSlackQuoteMeta(
    settings,
    String(brandAndModelText ?? "").trim(),
    String(insuranceSpanText ?? "").trim(),
  );
  await handleQuoteDraft(driver, logger, settings, requestNumber, slackQuoteMeta);
  return "draft";
}

/**
 * @param {unknown[]} reasons 상세 메타가 붙은 판정 결과 배열
 * @param {string[]} summaryLinesKo
 * @param {{ brandModelLine: string, cancellationSlackWebhookUrl: string }} [extra]
 */
async function handleQuoteCancellation(
  driver,
  logger,
  reasons,
  summaryLinesKo,
  extra = { brandModelLine: "", cancellationSlackWebhookUrl: "" },
) {
  logger.info("견적 취소 분기 — 사유 요약", {
    cancellationSummaryKo: summaryLinesKo,
    matchedReasons: reasons,
  });
  await performQuoteCancellation(driver, logger, reasons);
  await sendSlackAfterCancellation(logger, {
    cancellationSlackWebhookUrl: String(extra?.cancellationSlackWebhookUrl ?? ""),
    cancellationPageUrl: await driver.getCurrentUrl(),
    cancellationBasis: summaryLinesKo.join(" | "),
    brandModelLine: String(extra?.brandModelLine ?? ""),
  });
}

/**
 * @param {import("selenium-webdriver").WebDriver} driver
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {Record<string, unknown>} settings
 * @param {string | null} [requestNumber] 없으면 메시지 단계 생략
 * @param {{ brandModelLine: string, appliedQuotePriceBasis: string }} [slackQuoteMeta]
 */
async function handleQuoteDraft(
  driver,
  logger,
  settings,
  requestNumber = null,
  slackQuoteMeta = {
    brandModelLine: "",
    appliedQuotePriceBasis: "",
  },
) {
  logger.info("견적 작성+메시지 단계 진입");
  await performQuoteDraft(driver, logger, settings);
  const rn = requestNumber != null ? String(requestNumber).trim() : "";
  if (!rn) {
    logger.warn("견적 요청 번호 없음 — 메시지 전송 단계 생략");
    logger.info("견적 작성+메시지 단계 종료 (메시지 생략)");
    return;
  }
  try {
    logger.info("메시지 전송 단계 호출", { requestNumber: rn });
    const messagingResult = await performQuoteMessaging(driver, logger, rn, settings);
    logger.info("메시지 전송 단계 완료", { requestNumber: rn });
    await sendSlackAfterMessagingIfConfigured(
      logger,
      settings,
      rn,
      messagingResult?.quotePageUrl,
      slackQuoteMeta,
    );
  } catch (err) {
    logger.warn("메시지 전송 단계 실패", {
      requestNumber: rn,
      message: err instanceof Error ? err.message : String(err),
    });
  }
  logger.info("견적 작성+메시지 단계 종료");
}

/**
 * 메시지 전송 성공 이후 Slack 알림을 보냅니다.
 * webhook URL이 비어 있으면 조용히 스킵합니다.
 *
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {Record<string, unknown>} settings
 * @param {string} requestNumber
 * @param {string | undefined} quotePageUrl
 * @param {{ brandModelLine: string, appliedQuotePriceBasis: string }} [slackQuoteMeta]
 */
async function sendSlackAfterMessagingIfConfigured(
  logger,
  settings,
  requestNumber,
  quotePageUrl,
  slackQuoteMeta = {
    brandModelLine: "",
    appliedQuotePriceBasis: "",
  },
) {
  const webhookUrl = String(settings?.slackWebhookUrl ?? "").trim();
  if (!webhookUrl) {
    logger.info("Slack webhook 미설정 — 알림 전송 생략");
    return;
  }

  const templateRaw = String(settings?.slackMessageTemplate ?? "").trim();
  const defaultTemplate = [
    "견적 문자 발송 완료",
    "요청번호: {requestNumber}",
    "견적 링크: {quotePageUrl}",
    "차량 브랜드/차종: {brandModelLine}",
    "적용한 견적 금액 기준: {appliedQuotePriceBasis}",
  ].join("\n");

  const hasNewFields =
    templateRaw.includes("{brandModelLine}") &&
    templateRaw.includes("{appliedQuotePriceBasis}");
  const template = templateRaw && hasNewFields ? templateRaw : defaultTemplate;
  if (templateRaw && !hasNewFields) {
    logger.warn("Slack 템플릿이 구버전이라 최신 기본 양식으로 대체합니다.");
  }
  const text = fillTemplate(template, {
    requestNumber,
    quotePageUrl: String(quotePageUrl ?? ""),
    brandModelLine: String(slackQuoteMeta?.brandModelLine ?? ""),
    appliedQuotePriceBasis: String(slackQuoteMeta?.appliedQuotePriceBasis ?? ""),
  });

  logger.info("Slack 알림 전송 시작", { requestNumber });
  try {
    await postSlackWebhook({ webhookUrl, text });
    logger.info("Slack 알림 전송 완료", { requestNumber });
  } catch (err) {
    logger.warn("Slack 알림 전송 실패", {
      requestNumber,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * 견적 취소 처리 완료 시 전용 Slack 웹훅으로 알림을 보냅니다.
 *
 * @param {ReturnType<typeof import("./logger").createLogger>} logger
 * @param {{ cancellationSlackWebhookUrl: string, cancellationPageUrl: string, cancellationBasis: string, brandModelLine: string }} payload
 */
async function sendSlackAfterCancellation(logger, payload) {
  const webhookUrl = String(payload?.cancellationSlackWebhookUrl ?? "").trim();
  if (!webhookUrl) {
    logger.info("취소 Slack webhook 미설정 — 알림 전송 생략");
    return;
  }

  const text = [
    "견적 취소 처리 완료",
    `취소 처리 페이지 URL: ${payload.cancellationPageUrl}`,
    `취소 처리 기준: ${payload.cancellationBasis || "(기준 없음)"}`,
    `브랜드/차종: ${payload.brandModelLine || "(정보 없음)"}`,
  ].join("\n");

  logger.info("취소 Slack 알림 전송 시작");
  try {
    await postSlackWebhook({ webhookUrl, text });
    logger.info("취소 Slack 알림 전송 완료");
  } catch (err) {
    logger.warn("취소 Slack 알림 전송 실패", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Slack 메시지 본문에 넣을 견적 메타(차량/적용 금액 기준)를 구성합니다.
 *
 * @param {Record<string, unknown>} settings
 * @param {string} brandModelLine
 * @param {string} insuranceSpanText
 */
function buildSlackQuoteMeta(settings, brandModelLine, insuranceSpanText) {
  const domesticImport = classifyDomesticImportFromBrandLineAndCsv(
    brandModelLine,
    settings?.domesticBrandsCsv,
  );
  const insuranceCategory = classifyInsuranceFromSpanText(insuranceSpanText);
  const quoteKind = quoteKindLabelFourWay(domesticImport, insuranceCategory) ?? "미상";
  const amount = repairPriceStringForQuoteKind(settings, domesticImport, insuranceCategory);
  const appliedQuotePriceBasis = amount
    ? `${quoteKind} 기준 (${amount})`
    : `${quoteKind} 기준`;

  return {
    brandModelLine: String(brandModelLine ?? ""),
    appliedQuotePriceBasis,
  };
}

module.exports = {
  runPostDetailQuoteFlow,
  handleQuoteCancellation,
  handleQuoteDraft,
  formatCancellationSummaryLines,
};
