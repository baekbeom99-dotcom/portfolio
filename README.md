# Web App Portfolio

별도의 빌드 도구, 번들러, 외부 패키지 없이 순수 HTML/CSS/Vanilla JS로 동작하는 정적 웹앱 포트폴리오입니다.  
이미 GitHub Pages 등에 배포된 외부 웹앱과, 별도 저장소 없이 이 폴더 안에 바로 탑재한 내장 웹앱을 한곳에서 소개하고 실행할 수 있습니다.

## 1. 포트폴리오 구조

```text
portfolio/
├── index.html                  # 포트폴리오 메인 페이지
├── css/                        # 스타일시트
├── js/                         # 상태·렌더링·뷰어 스크립트
├── data/
│   └── apps.js                 # 사이트 설정(PORTFOLIO_CONFIG) 및 앱 목록(PORTFOLIO_APPS)
├── assets/
│   └── thumbnails/             # 16:9 앱 썸네일 (.svg / .png / .webp)
├── apps/
│   └── sample-app/             # GitHub 없이 직접 탑재하는 정적 웹앱 예시
├── tests/                      # node --test 기반 자동 검증 테스트
├── .nojekyll                   # GitHub Pages Jekyll 처리 비활성화
└── .github/workflows/deploy.yml# GitHub Pages 자동 배포 워크플로우
```

## 2. 새 웹앱 추가 방법

모든 앱 정보는 `data/apps.js`의 `window.PORTFOLIO_APPS` 배열에 추가합니다.  
썸네일은 `assets/thumbnails/`에 16:9 비율 이미지(예: `800x450`)를 넣고 `"./assets/thumbnails/파일명.svg"`처럼 상대 경로로 지정하세요.

### 방법 A. 기존 GitHub 배포 앱 연결하기

이미 GitHub Pages, Vercel, Netlify 등에 배포된 앱 URL을 연결할 때 사용합니다.

```javascript
{
  id: "my-github-app",
  title: "내 웹앱 제목",
  tagline: "한 줄 요약 소개",
  purpose: "이 웹앱을 만든 목적",
  audience: "추천 대상 사용자",
  description: [
    "주요 기능과 사용 방법 설명 1",
    "주요 기능과 사용 방법 설명 2"
  ],
  thumbnail: "./assets/thumbnails/my-github-app.png",
  launchType: "external",
  url: "https://username.github.io/my-app/",
  embedMode: "iframe", // 외부 사이트가 iframe 삽입을 차단하면 "newTab" 사용
  tags: ["유틸리티", "생산성"],
  featured: true,
  createdAt: "2026-11-16"
}
```

### 방법 B. GitHub 배포 없이 `apps/<id>/`에 직접 탑재하기

별도의 GitHub 저장소를 만들지 않고 정적 웹앱 파일(`index.html`, JS, CSS 등)을 포트폴리오 안에 직접 넣을 때 사용합니다.

1. `apps/<앱아이디>/` 폴더를 만들고 정적 웹앱 파일(`index.html` 등)을 복사합니다. (내부 자산 경로도 `./` 상대 경로 권장)
2. `data/apps.js`에 아래 형식으로 등록합니다.

```javascript
{
  id: "my-local-app",
  title: "내장 웹앱 제목",
  tagline: "포트폴리오 안에서 바로 실행되는 웹앱",
  purpose: "이 웹앱을 만든 목적",
  audience: "추천 대상 사용자",
  description: [
    "사용 방법 안내"
  ],
  thumbnail: "./assets/thumbnails/my-local-app.svg",
  launchType: "embedded",
  url: "./apps/my-local-app/index.html",
  embedMode: "iframe",
  tags: ["내장앱"],
  featured: false,
  createdAt: "2026-11-16"
}
```

## 3. 로컬 테스트 방법

- **브라우저로 바로 열기**: `index.html` 파일을 더블 클릭(`file://`)하여 바로 확인할 수 있습니다.
- **로컬 정적 서버로 열기** (내장 앱 iframe 및 공유 링크 동작 확인 권장):
  ```bash
  python -m http.server 4173
  ```
  브라우저에서 `http://localhost:4173` 접속
- **자동 테스트 실행** (Node.js 내장 테스트 러너):
  ```bash
  node --test tests/*.test.js
  ```

## 4. 배포 방법

### 방법 1. GitHub Pages 자동 배포 (`.github/workflows/deploy.yml`)

1. GitHub 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다.
2. `main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 실행되어 `index.html`, `.nojekyll`, `css/`, `js/`, `data/`, `assets/`, `apps/` 정적 웹 파일만 `_site/`로 스테이징해 자동 배포합니다.

### 방법 2. GitHub 없이 직접 업로드 (Netlify Drop / Cloudflare Pages)

GitHub 계정이나 저장소 연동 없이 배포하려면 아래 정적 웹 파일만 폴더에 모아 드래그 앤 드롭으로 업로드하세요.
- 필수 포함: `index.html`, `.nojekyll`, `data/`, `assets/`, `apps/`, `css/`, `js/`
- 제외 가능: `tests/`, `docs/`, `.github/`
