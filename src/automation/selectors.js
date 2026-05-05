/**
 * 사이트 셀렉터 모음 — 마크업이 바뀌면 이 파일 한 곳만 갱신합니다.
 */
const { By } = require("selenium-webdriver");

// 공통 메인 컬럼 래퍼 — 목록·상세 패널 모두 이 트리 아래에 있습니다.
const MAIN_COL_CSS =
   "#root > main > div.w-full.s\\:min-w-360.flex-1.flex.flex-col";

// 견적 요청 목록 ul. Tailwind `s:min-w-360` 등은 `\:` 로 이스케이프합니다.
const REQUEST_LIST_CSS = `${MAIN_COL_CSS} > div > section > section > section > ul`;

/** 메시지 화면 진입 — 상단 네비 두 번째 탭의 span (검색 전 클릭) */
const MESSAGES_HEADER_NAV_SECOND_TAB_SPAN_CSS = `${MAIN_COL_CSS} > div > section > section > div.flex.z-20.sticky.top-0.bg-white.gap-x-7.px-4.s\\:px-5.border-b.border-b-blue-gray-200 > a:nth-child(2) > span`;
/** 메시지 검색 — 견적 요청 번호 입력란 */
const MESSAGES_SEARCH_FORM_INPUT_CSS = `${MAIN_COL_CSS} > div > section > div > form > input`;
/** 메시지 단계 진입 전 표시/소멸 확인용 진행 상태 p */
const MESSAGES_PRE_ENTRY_TRANSIENT_STATUS_P_CSS = "ol > li > div > div > div > p";
/** 요청 번호 일치 li 진입 후 하단 sticky 영역의 링크 버튼(a > button) */
const MESSAGES_THREAD_OPEN_LINK_BUTTON_CSS = `${MAIN_COL_CSS} > div > div > div > div.sticky.left-0.bottom-0.bg-white.py-3.border-t.border-blue-gray-200.hidden.s\\:block > div > div.flex.gap-x-2 > a > button`;
/** 대화 페이지 하단 입력 영역 textarea */
const MESSAGES_CHAT_TEXTAREA_CSS = `${MAIN_COL_CSS} > div > div > div > div.sticky.bottom-0 > form > div > textarea`;
/** 대화 페이지 하단 전송 버튼 (`textarea` 우측/하단 form 내부 button) */
const MESSAGES_CHAT_SEND_BUTTON_CSS = `${MAIN_COL_CSS} > div > div > div > div.sticky.bottom-0 > form > div > button`;
/** 메시지 전송 후 신규 견적 확인 화면으로 복귀하는 상단 첫 메뉴 a */
const MESSAGES_RETURN_TO_NEW_REQUESTS_LINK_CSS = "#root > main > header > div > div > div.h-full.flex.items-center.gap-x-10 > ul > li:nth-child(1) > a";

/** 상세 스크롤 영역 (차량 정보 + 견적 작성 폼의 부모) */
const DETAIL_SCROLL_CSS =
   `${MAIN_COL_CSS} > div > div > div > div.w-full.overflow-y-scroll.s\\:h-screen`;
/** 차량 정보 섹션 */
const DETAIL_VEHICLE_SECTION_CSS = `${DETAIL_SCROLL_CSS} > div > section > section`;
/** 견적 작성 폼 */
const DETAIL_QUOTE_FORM_CSS = `${DETAIL_SCROLL_CSS} > div > form`;
/**
 * 견적 폼 내 부위 목록 ul — XPath (브라우저 복사 경로 기준 `…/form/div[3]/ul`).
 * CSS `nth-child`와 번호가 어긋날 수 있어 XPath를 단일 소스로 둡니다.
 */
const QUOTE_FORM_PARTS_UL_XPATH =
  '//*[@id="root"]/main/div[1]/div/div/div/div[2]/div/form/div[3]/ul';
/**
 * 각 부위 `li` 기준: deleteParts와 비교할 텍스트 (`…/li[n]/div[1]/div[1]`에 해당).
 * XPath의 `/text()`는 Selenium에서 요소 조회 후 `getText()`로 대체합니다.
 */
const QUOTE_PART_ROW_LABEL_RELATIVE_XPATH_FROM_LI = "./div[1]/div[1]";
/** 각 부위 `li` 기준: 해당 행 삭제 버튼 */
const QUOTE_PART_ROW_REMOVE_BTN_RELATIVE_TO_LI =
  "div.flex.justify-between.items-center.py-2\\.5 > div:nth-child(2) > button";

/** 견적 폼 부위 목록 ul — 수리방법 입력 단계(form `div:nth-child(4) > ul`, 사용자 제공 CSS) */
const QUOTE_FORM_PARTS_UL_CSS_REPAIR_METHOD =
  `${DETAIL_QUOTE_FORM_CSS} > div:nth-child(4) > ul`;
/** 각 부위 `li` 내 수리방법(Radix) 트리거 버튼 */
const QUOTE_PART_REPAIR_METHOD_TRIGGER_BTN_RELATIVE =
  "div.pl-9.pr-12 > div > div > button";
/** 각 부위 `li` 내 수리 금액 input */
const QUOTE_PART_REPAIR_PRICE_INPUT_RELATIVE =
  "div.pl-9.pr-12 > div > div > div > input";
/** 각 부위 `li` 내 부품 플로우 — `ul` 직계 트리거 버튼 */
const QUOTE_PART_PARTS_MENU_BTN_RELATIVE = "ul > button";
/** 각 부위 `li` 내 부품 플로우 — `ul > li` 행의 확인 등 후속 버튼 */
const QUOTE_PART_PARTS_ROW_CONFIRM_BTN_RELATIVE =
  "ul > li > div:nth-child(4) > button";

/** 견적 폼 하단(mt-10) — 부위 등급 입력란이 들어 있는 래퍼 div (`… > div > input`) */
const QUOTE_FORM_TIER_INPUT_WRAPPER_CSS = `${DETAIL_QUOTE_FORM_CSS} > div.flex.mt-10.justify-between.items-center > div.flex.gap-x-2 > div > div`;
/** 등급(개수) 입력 후 클릭하는 버튼 — form 여섯 번째 블록 내 네 번째 버튼 */
const QUOTE_FORM_AFTER_TIER_FOURTH_BUTTON_CSS = `${DETAIL_QUOTE_FORM_CSS} > div:nth-child(6) > div.flex.items-center.flex-wrap.w-full.gap-2.mt-2 > button:nth-child(4)`;
/** 견적 폼 일곱 번째 블록 헤더 줄의 버튼 — 클릭 시 Radix 모달 오픈 */
const QUOTE_FORM_BLOCK7_HEADER_BTN_CSS = `${DETAIL_QUOTE_FORM_CSS} > div:nth-child(7) > div.w-full.flex.justify-between.items-center.mb-4 > button`;

/** 다섯 번째 블록 내 라디오 2열 카드 (`border-blue-gray-200` 박스) */
const QUOTE_FORM_BLOCK5_RADIO_CARD_CSS = `${DETAIL_QUOTE_FORM_CSS} > div:nth-child(5) > div.border.border-blue-gray-200.flex.px-5.py-6.rounded-xl.mt-4`;
/**
 * 라디오 그룹 A — 좌측 칼럼(`pr-5`·세로 구분선).
 * 컨테이너 직계 첫 div → 그 안 두 번째 div → 첫 번째 label.
 */
const QUOTE_FORM_RADIO_GROUP_A_LABEL_CSS = `${QUOTE_FORM_BLOCK5_RADIO_CARD_CSS} > div.flex-1.pr-5.border-r.border-blue-gray-100 > div:nth-child(1) > div:nth-child(2) > label:nth-child(1)`;
/**
 * 라디오 그룹 C — 좌측 칼럼(`pr-5`) 내 두 번째 직계 div → 그 안 두 번째 div → 첫 label.
 */
const QUOTE_FORM_RADIO_GROUP_C_LABEL_CSS = `${QUOTE_FORM_BLOCK5_RADIO_CARD_CSS} > div.flex-1.pr-5.border-r.border-blue-gray-100 > div:nth-child(2) > div:nth-child(2) > label:nth-child(1)`;
/**
 * 라디오 그룹 B — 우측 칼럼(`pl-5`).
 * 동일 깊이 `… > div:nth-child(1) > div:nth-child(2) > label:nth-child(n)` — 부위 `li` 개수로 n 이 1 또는 2.
 */
const QUOTE_FORM_RADIO_GROUP_B_LABEL_CSS = (labelNth1Based) =>
   `${QUOTE_FORM_BLOCK5_RADIO_CARD_CSS} > div.flex-1.pl-5 > div:nth-child(1) > div:nth-child(2) > label:nth-child(${labelNth1Based})`;

/**
 * 상세 하단 sticky 바(`hidden s:block`) — 견적 발송 트리거(주색 버튼).
 * 뷰포트가 `s` 브레이크포인트 미만이면 숨겨져 자동화가 실패할 수 있습니다.
 */
const QUOTE_SUBMIT_STICKY_PRIMARY_BTN_CSS = `${MAIN_COL_CSS} > div > div > div > div.sticky.left-0.bottom-0.bg-white.py-3.border-t.border-blue-gray-200.hidden.s\\:block > div > div.flex.gap-x-2 > button.flex.justify-center.items-center.rounded-lg.outline-none.font-bold.h-13.px-5.bg-primary-500.text-white.hover\\:bg-primary-600.disabled\\:bg-blue-gray-100.disabled\\:text-blue-gray-300.active\\:bg-primary-700`;
/**
 * 발송 확인 Radix 모달 하단 푸터 주 버튼 — `#radix-:r??:` 는 세션마다 변함.
 * 경로: `radix > div > div.fixed.bottom-0.left-0…rounded-2xl… > button.bg-primary-500`
 */
const RADIX_QUOTE_SUBMIT_CONFIRM_FOOTER_BTN_XPATH =
   "//*[starts-with(@id,'radix-')]/div/div[contains(@class,'fixed')][contains(@class,'bottom-0')][contains(@class,'left-0')][contains(@class,'rounded-2xl')]/button[contains(@class,'bg-primary-500')]";

/** 상세 우측 패널 — 브랜드·차종이 적힌 한 줄 (p) */
const DETAIL_BRAND_MODEL_P_CSS = `${DETAIL_SCROLL_CSS} > div > section > section > div.flex.justify-between.items-start > div.w-\\[680px\\] > section > p`;
/** 상세 — 수리 부위 목록이 쉼표로 구분된 span */
const DETAIL_REPAIR_PARTS_SPAN_CSS = `${DETAIL_SCROLL_CSS} > div > section.px-4.py-6.flex.flex-col.gap-y-2 > section > div.flex.gap-10 > section.w-105.flex.flex-col.gap-2 > div:nth-child(2) > span.text-blue-gray-800`;
/**
 * 상세 차량 블록 — 보험/비보험 표시 span (`비보험 수리` 등).
 * 브랜드·차종 `p`와 같은 `section > section` 트리의 `div.flex.gap-10` 기준 첫 칼럼.
 */
const DETAIL_QUOTE_INSURANCE_CATEGORY_SPAN_CSS = `${DETAIL_SCROLL_CSS} > div > section > section > div.flex.gap-10 > section.w-105.flex.flex-col.gap-2 > div:nth-child(1) > span.text-blue-gray-800`;

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
   /** 라디오 그룹 B — `label:nth-child(1|2)` (부위 `li` 개수 분기) */
   quoteFormRadioGroupBLabelByIndex: (labelNth1Based) =>
      By.css(QUOTE_FORM_RADIO_GROUP_B_LABEL_CSS(labelNth1Based)),
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
      /** 견적 작성 폼 — 부위 행 목록 ul (XPath) */
      quoteFormPartsList: By.xpath(QUOTE_FORM_PARTS_UL_XPATH),
      /** 각 `li`에서 라벨 노드를 찾을 상대 XPath 문자열 */
      quotePartRowLabelRelativeXPath: QUOTE_PART_ROW_LABEL_RELATIVE_XPATH_FROM_LI,
      quotePartRowRemoveBtnRelative: QUOTE_PART_ROW_REMOVE_BTN_RELATIVE_TO_LI,
      /**
       * 부위 목록 ul — 수리방법 단계(deleteParts용 XPath ul과 블록 인덱스가 다를 수 있음).
       */
      quoteFormPartsListRepairMethod: By.css(QUOTE_FORM_PARTS_UL_CSS_REPAIR_METHOD),
      quotePartRepairMethodTriggerBtnRelative:
        QUOTE_PART_REPAIR_METHOD_TRIGGER_BTN_RELATIVE,
      quotePartRepairPriceInputRelative: QUOTE_PART_REPAIR_PRICE_INPUT_RELATIVE,
      quotePartPartsMenuBtnRelative: QUOTE_PART_PARTS_MENU_BTN_RELATIVE,
      quotePartPartsRowConfirmBtnRelative:
        QUOTE_PART_PARTS_ROW_CONFIRM_BTN_RELATIVE,
      /** 부위 등급(react-aria 등) 입력 래퍼 — 내부 `input` 조회 */
      quoteFormTierInputWrapper: By.css(QUOTE_FORM_TIER_INPUT_WRAPPER_CSS),
      /** 등급 입력 직후 누르는 버튼(`button:nth-child(4)`) */
      quoteFormAfterTierFourthButton: By.css(QUOTE_FORM_AFTER_TIER_FOURTH_BUTTON_CSS),
      quoteFormBlock7HeaderButton: By.css(QUOTE_FORM_BLOCK7_HEADER_BTN_CSS),
      /** 견적 폼 라디오 그룹 A (좌측 칼럼) 고정 라벨 */
      quoteFormRadioGroupALabel: By.css(QUOTE_FORM_RADIO_GROUP_A_LABEL_CSS),
      /** 견적 폼 라디오 그룹 C (좌측 칼럼·두 번째 스택) 고정 라벨 */
      quoteFormRadioGroupCLabel: By.css(QUOTE_FORM_RADIO_GROUP_C_LABEL_CSS),
      /** 브랜드 + 차종 텍스트 */
      brandAndModelLine: By.css(DETAIL_BRAND_MODEL_P_CSS),
      /** 보험/비보험 구분 텍스트 span */
      quoteInsuranceCategorySpan: By.css(DETAIL_QUOTE_INSURANCE_CATEGORY_SPAN_CSS),
      /** 수리 부위 (쉼표 구분) */
      repairPartsSpan: By.css(DETAIL_REPAIR_PARTS_SPAN_CSS),
      /** 견적 작성 완료 후 하단 sticky 발송 버튼 */
      quoteSubmitStickyPrimaryButton: By.css(QUOTE_SUBMIT_STICKY_PRIMARY_BTN_CSS),
      /** 발송 확인 Radix 모달 하단 주 버튼(id 가변 → XPath) */
      radixQuoteSubmitConfirmFooterButton: By.xpath(RADIX_QUOTE_SUBMIT_CONFIRM_FOOTER_BTN_XPATH),
   },
   /** 견적 발송 후 스레드 검색·진입 (목록 ul 구조는 `requests.list` 와 동일) */
   messages: {
      /** 상단 네비 `a:nth-child(2)` 안 레이블 span — 메시지 등 두 번째 탭 */
      headerSecondTabSpan: By.css(MESSAGES_HEADER_NAV_SECOND_TAB_SPAN_CSS),
      searchFormInput: By.css(MESSAGES_SEARCH_FORM_INPUT_CSS),
      /** 생성 후 사라지는 진행 상태 p (`ol > li > div > div > div > p`) */
      preEntryTransientStatusP: By.css(MESSAGES_PRE_ENTRY_TRANSIENT_STATUS_P_CSS),
      /** 요청 번호 일치 행 클릭 뒤 다음 화면으로 이동하는 링크 버튼 */
      threadOpenLinkButton: By.css(MESSAGES_THREAD_OPEN_LINK_BUTTON_CSS),
      /** 대화창 메시지 입력 textarea */
      chatTextarea: By.css(MESSAGES_CHAT_TEXTAREA_CSS),
      /** 대화창 전송 버튼 */
      chatSendButton: By.css(MESSAGES_CHAT_SEND_BUTTON_CSS),
      /** 상단 첫 메뉴(신규 견적 화면 복귀) */
      returnToNewRequestsLink: By.css(MESSAGES_RETURN_TO_NEW_REQUESTS_LINK_CSS),
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
