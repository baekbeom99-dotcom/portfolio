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
 * 3) 썸네일 이미지 및 맞춤 옵션 (16:9 권장):
 *    - assets/thumbnails/ 폴더에 이미지(.svg, .png, .webp 등)를 넣고
 *      "./assets/thumbnails/파일명.svg" 형태로 지정
 *    - thumbnailFit (선택): "auto" | "cover" | "contain"
 *      - "auto" (기본값): 이미지 비율과 해상도를 판별해 세로형·정사각형·소형 이미지는 여백 없이 전체가 보이도록 자동 맞춤
 *      - "cover": 16:9 프레임에 꽉 채워 자름
 *      - "contain": 이미지 전체가 잘리지 않도록 표시(주변은 블러 배경으로 채움)
 */

window.PORTFOLIO_CONFIG = {
  siteTitle: "윤선생 App Studio",
  siteSubtitle: "교육용 및 일상생활을 위한 웹앱 공유 플랫폼",
  ownerName: "윤선생",
  contactLink: ""
};

window.PORTFOLIO_APPS = [];
