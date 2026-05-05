/**
 * 사이트 셀렉터 모음 — 마크업이 바뀌면 이 파일 한 곳만 갱신합니다.
 */
const { By } = require("selenium-webdriver");

module.exports = {
   login: {
      id: By.css('input[name="loginId"]'),
      // (2) aria-label — 반드시 대괄호로 감싸기
      password: By.css('input[aria-label="비밀번호"]'),
      submit: By.css('button[type="submit"]'),
      /** 로그인 성공 판정용 — URL에 이 부분이 더 이상 포함되지 않으면 진입 성공으로 간주. */
      pendingUrlFragment: "/auth/sign-in",
   },
};
