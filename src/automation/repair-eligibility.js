/**
 * 차량 정보와 앱 설정을 비교해 수리 불가 여부를 판단합니다.
 *
 * - evaluateRepairEligibility: 차량 섹션 전체 텍스트 한 덩어리(폴백·레거시).
 * - evaluateRepairEligibilityStructured: 브랜드·차종은 전용 p 텍스트만, 수리 부위는 쉼표로 나눈 토큰과만 비교.
 *
 * 주의: 부분 문자열 매칭이므로 짧은 토큰은 오탐 가능합니다. CSV에는 구체적인 명칭을 넣는 것을 권장합니다.
 */

/**
 * @typedef {{
 *   kind: "nonRepairBrand"|"nonRepairModel"|"blockedPart";
 *   value: string;
 *   originElementKey: "brandAndModelLine"|"repairPartsSpan"|"vehicleSectionFallback";
 *   originDescriptionKo: string;
 *   matchedSiteToken?: string;
 * }} EligibilityBlockReason
 */

/** 구조화 판정 — 브랜드·차종 문단(p) */
const ORIGIN_BRAND_MODEL = {
  originElementKey: "brandAndModelLine",
  originDescriptionKo: "브랜드·차종(p)",
};
/** 구조화 판정 — 수리 부위(span, 쉼표 구분) */
const ORIGIN_REPAIR_PARTS = {
  originElementKey: "repairPartsSpan",
  originDescriptionKo: "수리 부위(span)",
};
/** 셀렉터 실패 시 섹션 통째 텍스트 */
const ORIGIN_FALLBACK = {
  originElementKey: "vehicleSectionFallback",
  originDescriptionKo: "차량 정보 섹션 전체(폴백)",
};

/**
 * @param {string | undefined | null} csv
 * @returns {string[]}
 */
function parseCsvList(csv) {
  return String(csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeLabelArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x ?? "").trim()).filter(Boolean);
}

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeWhitespace(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * 수리 부위 토큰(사이트)과 설정 라벨이 같은 부위를 가리키는지 느슨하게 비교합니다.
 */
function partTokenMatchesLabel(token, configuredLabel) {
  const t = normalizeWhitespace(token);
  const p = normalizeWhitespace(configuredLabel);
  if (!t || !p) return false;
  return t.includes(p) || p.includes(t);
}

/**
 * 브랜드·차종 전용 문단 + 수리 부위 쉼표 문자열을 사용하는 판정 (상세 페이지 전용).
 *
 * @param {{ brandAndModelText: string; repairPartsCommaSeparated: string }} fields
 */
function evaluateRepairEligibilityStructured(settings, fields) {
  const brandBlob = normalizeWhitespace(fields.brandAndModelText);
  const repairTokens = parseCsvList(fields.repairPartsCommaSeparated);
  /** @type {EligibilityBlockReason[]} */
  const reasons = [];

  for (const brand of parseCsvList(settings.nonRepairBrandsCsv)) {
    if (brand && brandBlob.includes(brand)) {
      reasons.push({
        kind: "nonRepairBrand",
        value: brand,
        ...ORIGIN_BRAND_MODEL,
      });
    }
  }

  for (const model of parseCsvList(settings.nonRepairModelsCsv)) {
    if (model && brandBlob.includes(model)) {
      reasons.push({
        kind: "nonRepairModel",
        value: model,
        ...ORIGIN_BRAND_MODEL,
      });
    }
  }

  for (const part of normalizeLabelArray(settings.blockedParts)) {
    const matchedTok = repairTokens.find((tok) => partTokenMatchesLabel(tok, part));
    if (matchedTok !== undefined) {
      reasons.push({
        kind: "blockedPart",
        value: part,
        ...ORIGIN_REPAIR_PARTS,
        matchedSiteToken: matchedTok,
      });
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

/**
 * @param {Record<string, unknown>} settings electron-store 스키마와 동일
 * @param {string} vehicleSectionText 차량 정보 섹션 getText() 결과
 * @returns {{ eligible: boolean; reasons: EligibilityBlockReason[] }}
 */
function evaluateRepairEligibility(settings, vehicleSectionText) {
  const blob = normalizeWhitespace(vehicleSectionText);
  /** @type {EligibilityBlockReason[]} */
  const reasons = [];

  for (const brand of parseCsvList(settings.nonRepairBrandsCsv)) {
    if (blob.includes(brand)) {
      reasons.push({
        kind: "nonRepairBrand",
        value: brand,
        ...ORIGIN_FALLBACK,
      });
    }
  }

  for (const model of parseCsvList(settings.nonRepairModelsCsv)) {
    if (blob.includes(model)) {
      reasons.push({
        kind: "nonRepairModel",
        value: model,
        ...ORIGIN_FALLBACK,
      });
    }
  }

  // 수리 불가 부위 (설정 화면 토글 라벨 배열)
  for (const part of normalizeLabelArray(settings.blockedParts)) {
    if (blob.includes(part)) {
      reasons.push({
        kind: "blockedPart",
        value: part,
        ...ORIGIN_FALLBACK,
      });
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

module.exports = {
  evaluateRepairEligibility,
  evaluateRepairEligibilityStructured,
  /** 단위 테스트·다른 모듈에서 CSV 파싱만 재사용할 때 */
  parseCsvList,
};
