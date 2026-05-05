/**
 * 사이트 셀렉터 모음 — 마크업이 바뀌면 이 파일 한 곳만 갱신합니다.
 */
const { By } = require("selenium-webdriver");

// 견적 요청 목록 ul의 CSS 경로. Tailwind의 `s:min-w-360` 처럼 콜론이 포함된 클래스명은
// CSS 셀렉터에서 `\:` 로 이스케이프해야 하므로 JS 문자열에서는 `\\:` 로 표기합니다.
const REQUEST_LIST_CSS =
   "#root > main > div.w-full.s\\:min-w-360.flex-1.flex.flex-col > div > section > section > section > ul";

// ul 직계 li마다 아래 상대 셀렉터로 유형(p)·견적 번호(span)를 찾습니다.
// 캐시백 요청(p 텍스트 === "캐시백 요청")이면 같은 순서의 다음 li를 봅니다.
const REQUEST_LI_CASHBACK_P_RELATIVE =
  "div.relative.w-20.h-20.s\\:w-24.s\\:h-24 > div.absolute.left-0.top-0.w-20.h-20.s\\:w-24.s\\:h-24.rounded-lg.bg-\\[\\#30333687\\].flex.justify-center.items-center.block > p";
const REQUEST_LI_NUMBER_SPAN_RELATIVE =
  "div.ml-3.relative.w-full > div.mb-1.flex > span";

/** 캐시백이 아닌 일반 견적 행으로 간주할 때 건너뛸 배지 텍스트 */
const CASHBACK_REQUEST_LABEL = "캐시백 요청";

module.exports = {
   login: {
      id: By.css('input[name="loginId"]'),
      // (2) aria-label — 반드시 대괄호로 감싸기
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
};
