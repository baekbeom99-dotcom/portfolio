/**
 * 포트폴리오 설정 및 웹앱 목록 데이터 파일
 *
 * [새 웹앱 추가 방법]
 * 1) 기존 GitHub Pages 등 외부에 배포된 앱:
 *    - launchType: "external"
 *    - url: "https://username.github.io/my-app/"
 *    - embedMode: "iframe" (포트폴리오 안에서 바로 실행) 또는 "newTab" (외부 사이트가 iframe을 막을 때)
 *
 * 2) GitHub에 별도 배포하지 않고 바로 탑재하는 앱:
 *    - apps/<id>/ 폴더에 정적 웹앱 파일(index.html 등)을 복사
 *    - launchType: "embedded"
 *    - url: "./apps/<id>/index.html"
 *    - embedMode: "iframe"
 *
 * 3) 썸네일 이미지 (16:9 권장):
 *    - assets/thumbnails/ 폴더에 이미지(.svg, .png, .webp 등)를 넣고
 *      "./assets/thumbnails/파일명.svg" 형태로 지정
 */

window.PORTFOLIO_CONFIG = {
  siteTitle: "My Web App Studio",
  siteSubtitle: "일상의 작은 불편을 해결하기 위해 직접 만든 웹앱들을 한곳에 모아 공유합니다.",
  ownerName: "제작자 이름",
  contactLink: ""
};

window.PORTFOLIO_APPS = [
  {
    id: "sample-focus-timer",
    title: "25분 집중 타이머 (내장 앱 샘플)",
    tagline: "GitHub 별도 배포 없이 포트폴리오 폴더에 바로 탑재해 실행하는 포모도로 타이머",
    purpose: "별도의 사이트나 저장소를 열지 않고도 포트폴리오 안에서 즉시 써볼 수 있는 내장 웹앱 구조를 검증하고 안내하기 위해 만들었습니다.",
    audience: "공부나 업무 중 간단하게 25분 집중 세션을 돌리고 싶은 사용자",
    description: [
      "시작 버튼을 누르면 25분 카운트다운이 시작되며, 언제든 일시정지와 초기화가 가능합니다.",
      "실제 내 앱을 추가할 때는 apps/<앱아이디>/ 폴더에 정적 파일을 넣고 data/apps.js에 등록하면 됩니다."
    ],
    thumbnail: "./assets/thumbnails/sample-app.svg",
    launchType: "embedded",
    url: "./apps/sample-app/index.html",
    embedMode: "iframe",
    tags: ["생산성", "타이머", "내장앱"],
    featured: true,
    createdAt: "2026-11-16"
  },
  {
    id: "github-deployed-example",
    title: "기존 GitHub 배포 웹앱 (예시 슬롯)",
    tagline: "이미 GitHub Pages 등에 배포되어 있는 내 웹앱의 목적·대상·사용법을 정리해 연결하는 예시",
    purpose: "여러 저장소에 흩어져 있던 기존 웹앱들을 한 화면에서 맥락과 함께 소개하고 지인에게 공유하기 위한 연결 슬롯입니다.",
    audience: "포트폴리오 링크 하나로 기존에 만든 웹앱들을 둘러보고 싶은 지인 및 사용자",
    description: [
      "이 항목의 url을 실제 GitHub Pages 주소(예: https://아이디.github.io/앱이름/)로 바꾸면 바로 내 앱이 연결됩니다.",
      "목적, 대상, 사용법 텍스트와 16:9 썸네일을 수정해 실제 앱 소개로 교체하세요."
    ],
    thumbnail: "./assets/thumbnails/external-demo.svg",
    launchType: "external",
    url: "https://example.com",
    embedMode: "newTab",
    tags: ["쇼케이스", "유틸리티"],
    featured: false,
    createdAt: "2026-11-16"
  }
];
