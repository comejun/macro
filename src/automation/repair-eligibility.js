/**
 * 차량 정보 섹션 텍스트와 앱 설정을 비교해 수리 불가 여부를 판단합니다.
 *
 * - 수리 불가 브랜드·차종: 설정 CSV를 쉼표 분리 후, 차량 정보 텍스트에 부분 문자열 포함 여부
 * - 수리 불가 부위: 설정의 blockedParts(토글에서 선택한 라벨 배열)가 차량 정보 텍스트에 포함되는지
 *
 * 주의: 부분 문자열 매칭이므로 짧은 토큰은 오탐 가능합니다. CSV에는 구체적인 명칭을 넣는 것을 권장합니다.
 */

/** @typedef {{ kind: "nonRepairBrand"|"nonRepairModel"|"blockedPart"; value: string }} EligibilityBlockReason */

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
      reasons.push({ kind: "nonRepairBrand", value: brand });
    }
  }

  for (const model of parseCsvList(settings.nonRepairModelsCsv)) {
    if (blob.includes(model)) {
      reasons.push({ kind: "nonRepairModel", value: model });
    }
  }

  // 수리 불가 부위 (설정 화면 토글 라벨 배열)
  for (const part of normalizeLabelArray(settings.blockedParts)) {
    if (blob.includes(part)) {
      reasons.push({ kind: "blockedPart", value: part });
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

module.exports = {
  evaluateRepairEligibility,
  /** 단위 테스트·다른 모듈에서 CSV 파싱만 재사용할 때 */
  parseCsvList,
};
