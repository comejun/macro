/**
 * 사이트 셀렉터 모음 — 마크업이 바뀌면 이 파일 한 곳만 갱신합니다.
 */
const { By } = require("selenium-webdriver");

// 공통 메인 컬럼 래퍼 — 목록·상세 패널 모두 이 트리 아래에 있습니다.
const MAIN_COL_CSS =
   "#root > main > div.w-full.s\\:min-w-360.flex-1.flex.flex-col";

// 견적 요청 목록 ul. Tailwind `s:min-w-360` 등은 `\:` 로 이스케이프합니다.
const REQUEST_LIST_CSS = `${MAIN_COL_CSS} > div > section > section > section > ul`;

/** 상세 스크롤 영역 (차량 정보 + 견적 작성 폼의 부모) */
const DETAIL_SCROLL_CSS =
   `${MAIN_COL_CSS} > div > div > div > div.w-full.overflow-y-scroll.s\\:h-screen`;
/** 차량 정보 섹션 */
const DETAIL_VEHICLE_SECTION_CSS = `${DETAIL_SCROLL_CSS} > div > section > section`;
/** 견적 작성 폼 */
const DETAIL_QUOTE_FORM_CSS = `${DETAIL_SCROLL_CSS} > div > form`;

/** 상세 우측 패널 — 브랜드·차종이 적힌 한 줄 (p) */
const DETAIL_BRAND_MODEL_P_CSS = `${DETAIL_SCROLL_CSS} > div > section > section > div.flex.justify-between.items-start > div.w-\\[680px\\] > section > p`;
/** 상세 — 수리 부위 목록이 쉼표로 구분된 span */
const DETAIL_REPAIR_PARTS_SPAN_CSS = `${DETAIL_SCROLL_CSS} > div > section.px-4.py-6.flex.flex-col.gap-y-2 > section > div.flex.gap-10 > section.w-105.flex.flex-col.gap-2 > div:nth-child(2) > span.text-blue-gray-800`;

// ul 직계 li마다 아래 상대 셀렉터로 유형(p)·견적 번호(span)를 찾습니다.
// 캐시백 요청(p 텍스트 === "캐시백 요청")이면 같은 순서의 다음 li를 봅니다.
const REQUEST_LI_CASHBACK_P_RELATIVE =
  "div.relative.w-20.h-20.s\\:w-24.s\\:h-24 > div.absolute.left-0.top-0.w-20.h-20.s\\:w-24.s\\:h-24.rounded-lg.bg-\\[\\#30333687\\].flex.justify-center.items-center.block > p";
const REQUEST_LI_NUMBER_SPAN_RELATIVE =
  "div.ml-3.relative.w-full > div.mb-1.flex > span";

/** 캐시백이 아닌 일반 견적 행으로 간주할 때 건너뛸 배지 텍스트 */
const CASHBACK_REQUEST_LABEL = "캐시백 요청";

/** 차량 정보 헤더 우측 — 견적 취소 플로우 진입 버튼 */
const CANCEL_OPEN_FROM_VEHICLE_CSS = `${DETAIL_SCROLL_CSS} > div > section > section > div.flex.justify-between.items-start > div.flex.gap-x-2 > button`;
/** 취소 사유 선택 단계의 입력 박스(input) — 정밀 경로 */
const CANCEL_REASON_INPUT_CSS = `${MAIN_COL_CSS} > div.flex.flex-col.items-center.px-4.pb-30 > div > div > div:nth-child(2) > div.flex.items-center.border.border-blue-gray-200.rounded-lg.h-13.s\\:h-12.px-4.hover\\:border-blue-gray-800.focus-within\\:border-blue-gray-800.cursor-pointer > input`;
/**
 * 위와 동일 화면의 완화 셀렉터 — pb-30·h-13 등 빌드·브레이크포인트에서 클래스가 바뀌면 이쪽이 살아남을 수 있음.
 */
const CANCEL_REASON_INPUT_RELAXED_CSS = `${MAIN_COL_CSS} div.flex.flex-col.items-center[class*="px-4"] div.flex.items-center.border.border-blue-gray-200.rounded-lg input`;

/**
 * Radix 포털 루트 id — 앱 리빌드 시 `:r1i8:` 부분이 바뀔 수 있음.
 * 실패 시 DevTools Elements에서 id 복사 후 아래 두 줄만 수정.
 */
const RADIX_CANCEL_REASON_MENU_CSS = "#radix-\\:r1i8\\:";
const RADIX_FINAL_CONFIRM_CSS = "#radix-\\:r1ib\\:";

const CANCEL_REASON_BTN_BLOCKED_PARTS_CSS = `${RADIX_CANCEL_REASON_MENU_CSS} > div > button:nth-child(5)`;
const CANCEL_REASON_BTN_OTHER_CSS = `${RADIX_CANCEL_REASON_MENU_CSS} > div > button:nth-child(6)`;

const CANCEL_FOOTER_SUBMIT_CSS = `${MAIN_COL_CSS} > footer > div > button`;
const MODAL_CONFIRM_PRIMARY_BTN_CSS = `${RADIX_FINAL_CONFIRM_CSS} > div > button.flex.justify-center.items-center.rounded-lg.outline-none.font-bold.h-12.px-5.bg-primary-500.text-white.hover\\:bg-primary-600.disabled\\:bg-blue-gray-100.disabled\\:text-blue-gray-300.active\\:bg-primary-700.flex-1.s\\:flex-initial`;

module.exports = {
   login: {
      id: By.css('input[name="loginId"]'),
      /** 속성 선택 시 반드시 대괄호: `[aria-label="…"]` */
      password: By.css('input[aria-label="비밀번호"]'),
      submit: By.css('button[type="submit"]'),
      /** 로그인 성공 판정용 — URL에 이 부분이 더 이상 포함되지 않으면 진입 성공으로 간주. */
      pendingUrlFragment: "/auth/sign-in",
   },
   requests: {
      /** 새 견적 요청 목록 ul */
      list: By.css(REQUEST_LIST_CSS),
      /** 견적 요청 항목 li (순서대로 순회) */
      items: By.css(`${REQUEST_LIST_CSS} > li`),
      /** 각 li 기준: 유형 표시 p (값이 "캐시백 요청"이면 해당 행 스킵) */
      cashbackLabelP: By.css(REQUEST_LI_CASHBACK_P_RELATIVE),
      /** 각 li 기준: 견적 요청 번호 span */
      requestNumberSpan: By.css(REQUEST_LI_NUMBER_SPAN_RELATIVE),
      CASHBACK_REQUEST_LABEL,
   },
   /** 목록 행 클릭 후 표시되는 상세 패널 */
   detail: {
      scrollContainer: By.css(DETAIL_SCROLL_CSS),
      vehicleSection: By.css(DETAIL_VEHICLE_SECTION_CSS),
      quoteForm: By.css(DETAIL_QUOTE_FORM_CSS),
      /** 브랜드 + 차종 텍스트 */
      brandAndModelLine: By.css(DETAIL_BRAND_MODEL_P_CSS),
      /** 수리 부위 (쉼표 구분) */
      repairPartsSpan: By.css(DETAIL_REPAIR_PARTS_SPAN_CSS),
   },
   /** 견적 취소 마법사 (차량 정보 → 사유 → 확인 모달) */
   cancellation: {
      openFromVehicleHeader: By.css(CANCEL_OPEN_FROM_VEHICLE_CSS),
      reasonInput: By.css(CANCEL_REASON_INPUT_CSS),
      reasonInputRelaxed: By.css(CANCEL_REASON_INPUT_RELAXED_CSS),
      /** 고정 id는 자주 깨짐 — cancellation.js에서 XPath 동적 탐색 우선 */
      radixReasonOptionBlockedParts: By.css(CANCEL_REASON_BTN_BLOCKED_PARTS_CSS),
      radixReasonOptionOther: By.css(CANCEL_REASON_BTN_OTHER_CSS),
      footerSubmit: By.css(CANCEL_FOOTER_SUBMIT_CSS),
      modalConfirmPrimary: By.css(MODAL_CONFIRM_PRIMARY_BTN_CSS),
   },
};
