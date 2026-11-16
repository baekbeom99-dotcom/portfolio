# 웹앱 포트폴리오 시스템 설계 명세 (Design Spec)

- **작성일**: 2026-11-16
- **대상 경로**: `c:\Antigravity\portfolio`
- **아키텍처**: 순수 HTML / CSS / Vanilla JS (무빌드 정적 사이트)

---

## 1. 개요 및 목표

제작한 웹앱들을 한곳에 모아 일반 사용자·지인·커뮤니티에게 직관적으로 소개하고 바로 실행·공유할 수 있는 정적 포트폴리오 시스템을 구축한다.

### 핵심 요구사항
1. **웹앱 소개 콘텐츠**: 각 앱의 **목적(Purpose)**, **대상(Audience)**, **내용(Description)** 및 **썸네일(Thumbnail)**을 명확히 게시한다.
2. **하이브리드 앱 탑재 지원**:
   - **기존 GitHub 배포 앱**: 외부 URL(`https://...`)을 연결해 실행한다.
   - **GitHub 없는 직접 탑재 앱**: 정적 웹앱 빌드 결과물/파일을 포트폴리오 내부 `apps/<id>/` 폴더에 배치해 별도 저장소 배포 없이 바로 실행한다.
3. **무빌드·파일 기반 관리**: DB나 백엔드, 빌드 도구(`npm run build` 등) 없이 데이터 파일(`data/apps.js`)과 이미지·폴더 추가만으로 콘텐츠를 갱신한다.
4. **외부 공유 최적화**: 특정 앱을 가리키는 딥링크(`#app=<id>`) 복사 기능을 제공하고, 완성된 `portfolio/` 폴더 통째로 Netlify Drop, Cloudflare Pages 등 정적 호스팅에 올려 GitHub 연동 없이 외부 공유가 가능하도록 한다.

---

## 2. 폴더 및 파일 아키텍처

Chrome/Edge 등에서 로컬 `index.html`을 직접 열 때(`file://`) ES Module 및 `fetch()`가 CORS로 차단되는 문제를 피하기 위해, 일반 `<script defer>` 로드 순서와 단일 전역 네임스페이스(`window.Portfolio`) 패턴을 사용한다.

```text
portfolio/
├── index.html                    # 메인 쇼케이스 진입점
├── .nojekyll                     # GitHub Pages에서 정적 파일/내장 앱 폴더를 그대로 서빙하기 위한 설정
├── .github/
│   └── workflows/
│       └── deploy.yml            # main 브랜치 푸시 시 GitHub Pages 자동 배포 워크플로우
├── css/
│   └── styles.css                # 디자인 토큰(CSS Variables), 그리드, 모달, 뷰어 스타일
├── js/
│   ├── state.js                  # 필터/검색/선택 앱 상태 관리 및 URL 해시(#app=<id>) 동기화
│   ├── render.js                 # 헤더, 필터 칩, 카드 그리드, 상세 모달 DOM 렌더링
│   ├── viewer.js                 # 인앱 iframe 뷰어, 기기 폭 토글, 새 탭 실행, 링크 복사
│   └── app.js                    # 부트스트랩 및 이벤트 위임/바인딩
├── data/
│   └── apps.js                   # 사이트 설정(window.PORTFOLIO_CONFIG) 및 앱 목록(window.PORTFOLIO_APPS)
├── assets/
│   └── thumbnails/               # 앱 썸네일 이미지 (16:9 권장, png/jpg/webp)
└── apps/                         # GitHub 별도 배포 없이 직접 탑재하는 정적 웹앱 루트
    └── sample-app/               # 샘플 내장 앱 (실제 내장 앱 추가 가이드 겸용)
        └── index.html
```

> **경로 호환성 원칙**: 모든 에셋·스크립트·내장 앱 경로는 루트 절대 경로(`/...`)가 아닌 상대 경로(`./...`)를 사용하여, GitHub Pages 프로젝트 서브경로(`https://<user>.github.io/<repo>/`)와 일반 루트 도메인(Netlify Drop 등) 모두에서 수정 없이 동작하도록 한다.

---

## 3. 데이터 스키마 (`data/apps.js`)

`data/apps.js`는 주석 기반 작성 가이드를 포함하며, 아래 두 전역 상수를 정의한다.

### 3.1 사이트 메타데이터 (`window.PORTFOLIO_CONFIG`)
- `siteTitle` (string): 상단 타이틀 (예: `"My Web App Studio"`)
- `siteSubtitle` (string): 포트폴리오 목적을 알리는 한 줄 소개
- `ownerName` (string): 제작자 표시명
- `contactLink` (string, 선택): 문의/소셜 링크 (비어 있으면 미표시)

### 3.2 웹앱 항목 스키마 (`window.PORTFOLIO_APPS[]`)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | `string` | 예 | URL 친화적 고유 슬러그 (예: `"focus-timer"`). `#app=<id>` 공유 링크 및 기본 내장 경로에 사용 |
| `title` | `string` | 예 | 웹앱 이름 |
| `tagline` | `string` | 예 | 카드에 표시할 1줄 핵심 요약 |
| `purpose` | `string` | 예 | **목적** — 왜 만들었는지, 어떤 불편함을 해결하는지 |
| `audience` | `string` | 예 | **대상** — 누구를 위한 앱인지 (예: `"집중 시간을 관리하고 싶은 학생·직장인"`) |
| `description` | `string[]` 또는 `string` | 예 | **내용** — 주요 기능 및 사용 방법 (문단 또는 단계별 안내) |
| `thumbnail` | `string` | 아니오 | 썸네일 경로 (예: `"./assets/thumbnails/focus-timer.png"`). 누락/로드 실패 시 폴백 그래픽 표시 |
| `launchType` | `"external" \| "embedded"` | 예 | `"external"`(GitHub 등 외부 배포 URL) 또는 `"embedded"`(`apps/<id>/` 직접 탑재) |
| `url` | `string` | 예 | 실행 대상 URL (`https://...` 또는 `./apps/<id>/index.html`) |
| `embedMode` | `"iframe" \| "newTab"` | 예 | `"iframe"`(포트폴리오 내부 라이브 뷰어 우선) 또는 `"newTab"`(새 탭 실행 우선) |
| `tags` | `string[]` | 아니오 | 카테고리/주제 필터링 태그 (예: `["생산성", "유틸리티"]`) |
| `featured` | `boolean` | 아니오 | 상단 강조 또는 우선 정렬 여부 |
| `createdAt` | `string` | 아니오 | 제작/등록일 (`"YYYY-MM-DD"`) |

---

## 4. 화면 구성 및 사용자 흐름

### 4.1 쇼케이스 홈
- **히어로 헤더**: 사이트 제목, 소개 문구, 등록된 앱 개수 요약.
- **검색 및 필터 바**:
  - 실시간 키워드 검색 (`title`, `tagline`, `purpose`, `audience`, `tags` 대상).
  - 태그 칩 필터 (`전체` + 등록된 앱들에서 자동 추출된 고유 태그 목록).
  - 배포 형태 필터 (`전체`, `내장 앱`, `외부 링크`) 또는 배지 구분.
- **앱 카드 그리드** (모바일 1열 / 태블릿 2열 / 데스크톱 3열 반응형):
  - **16:9 썸네일** 영역 + 탑재 배지(`직접 탑재` / `웹 링크`).
  - 앱 이름(`title`), 한 줄 요약(`tagline`), 대상 요약(`audience` 뱃지/텍스트), 주요 태그.
  - 카드 클릭 시 **앱 상세 모달** 오픈 및 URL 해시 `#app=<id>` 갱신.

### 4.2 앱 상세 모달
- 상단: 16:9 썸네일 프리뷰 + 앱 제목 + 탑재 방식 배지.
- 본문 구조화 블록:
  1. **이 앱의 목적** (`purpose`)
  2. **추천 대상** (`audience`)
  3. **주요 내용 및 사용법** (`description`)
- 하단 액션 바:
  - **주요 CTA**: `embedMode === "iframe"`이면 **`포트폴리오에서 바로 실행`**, `"newTab"`이면 **`새 탭에서 실행`**
  - **보조 버튼**: **`새 탭으로 열기`** (항상 제공), **`공유 링크 복사`** (`#app=<id>` URL 클립보드 복사 및 토스트 피드백)
- 접근성: `Escape` 키 및 배경 클릭으로 닫기, 포커스 복귀 처리.

### 4.3 인앱 라이브 뷰어 (Overlay)
- `포트폴리오에서 바로 실행` 선택 시 전체 화면 오버레이 뷰어 실행.
- **상단 컨트롤 바**:
  - 뒤로가기(상세로 돌아가기) 버튼 및 현재 실행 중인 앱 이름.
  - 프리뷰 폭 전환 버튼: `데스크톱(100%)` / `모바일(390px)` 토글 (반응형 웹앱 체험 용이).
  - `새 탭으로 열기` 버튼 및 `공유 링크 복사` 버튼.
  - 외부 iframe 차단 안내 힌트(`화면이 표시되지 않으면 '새 탭으로 열기'를 눌러주세요`).
- **보안 속성**: `iframe`에 적절한 `title`, `loading="eager"`, `referrerpolicy="no-referrer-when-downgrade"` 설정.

---

## 5. 모듈 책임 및 데이터 흐름

```text
data/apps.js (정적 데이터)
       │
       ▼
  js/app.js (초기화 · 이벤트 바인딩)
       │
       ├──► js/state.js (searchQuery, activeTag, selectedAppId, viewerOpen, previewDevice)
       │         │   └─ hashchange / URL #app=<id> 양방향 동기화
       │         ▼
       ├──► js/render.js (필터 칩, 카드 그리드, 상세 모달 DOM 생성 · 안전한 textContent 바인딩)
       │
       └──► js/viewer.js (iframe src 마운트/언마운트, 폭 토글, 클립보드 복사 & 토스트 알림)
```

- **보안 원칙**: 데이터 파일의 문자열을 DOM에 삽입할 때 `innerHTML` 대신 `document.createElement` + `textContent`를 사용해 의도치 않은 HTML 인젝션을 방지한다.
- **리소스 정리**: 라이브 뷰어를 닫을 때 `iframe.src = "about:blank"`로 초기화하여 백그라운드 오디오·타이머가 계속 동작하지 않게 한다.

---

## 6. 예외 처리 및 호환성

1. **썸네일 누락 / 깨진 이미지**: `<img>`의 `onerror` 또는 경로 미지정 시, 앱 이름의 첫 글자와 고유 색상을 조합한 인라인 SVG 플레이스홀더로 자동 대체한다.
2. **외부 사이트 `X-Frame-Options` / CSP 차단**: 브라우저 정책상 JavaScript로 타 도메인의 iframe 차단 여부를 사전에 완벽히 감지할 수 없으므로, 앱별 `embedMode: "newTab"` 설정을 지원하고 뷰어 상단 바에 상시 `새 탭으로 열기` 탈출 버튼을 노출한다.
3. **로컬 파일 실행(`file://`) 제약**: 포트폴리오 자체 UI, 모달, `data/apps.js`, 썸네일 표시는 `file://`에서도 100% 동작한다. 단, `apps/<id>/`에 탑재한 외부 제작 앱 자체가 ES Module(`type="module"`)이나 `fetch`를 쓰는 경우 로컬에서는 간이 HTTP 서버(예: `python -m http.server`)로 테스트해야 하며, 이를 사용 가이드에 명시한다.
4. **빈 검색/데이터 상태**: 조건에 맞는 앱이 없을 때 `검색어/필터 초기화` 버튼이 포함된 빈 상태 화면을 표시한다.

---

## 7. 배포(GitHub Pages 및 무깃허브 정적 배포) 및 검증 계획

### 배포 방식
1. **GitHub Pages 자동 배포 (권장)**:
   - `.github/workflows/deploy.yml` (`actions/upload-pages-artifact` + `actions/deploy-pages`)을 포함해, `main` 브랜치에 푸시하면 별도 빌드 없이 저장소 정적 파일이 자동으로 GitHub Pages에 배포된다.
   - 루트 `.nojekyll` 파일을 두어 Jekyll 처리를 비활성화하고 `apps/` 내부 파일이 누락 없이 서빙되도록 한다.
   - GitHub 저장소 `Settings → Pages → Source`를 **GitHub Actions**로 설정하면 즉시 공개 URL이 생성된다.
   - 추후 만드는 새 웹앱을 별도 GitHub 저장소로 분리하지 않고 포트폴리오 저장소의 `apps/<app-id>/` 폴더에 직접 탑재해 함께 배포·공유할 수 있다.
2. **GitHub 없는 정적 배포 (대안)**:
   - GitHub을 쓰지 않고 공유해야 할 경우에도 `portfolio/` 폴더를 그대로 **Netlify Drop** 또는 **Cloudflare Pages Direct Upload**에 드래그 앤 드롭하면 동일한 상대 경로 구조로 즉시 HTTPS URL을 발급받을 수 있다.

### 신규 앱 추가 절차
- (외부/기존 GitHub 배포 앱) `data/apps.js`에 항목 추가 + `assets/thumbnails/`에 이미지 저장.
- (직접 탑재 앱) `apps/<app-id>/` 폴더에 정적 앱 파일 복사 + `data/apps.js`에 `launchType: "embedded"`, `url: "./apps/<app-id>/index.html"` 등록.

### 구현 후 검증 체크리스트
- 로컬 정적 서버 실행 후 브라우저에서 다음 시나리오를 직접 확인한다:
  1. 초기 카드 목록 렌더링 및 `목적 / 대상 / 내용 / 썸네일` 표시 확인.
  2. 검색어 입력 및 태그 필터 조합 동작, 빈 결과 초기화 버튼 확인.
  3. 상세 모달 열기/닫기(`Escape`, 배경 클릭), `#app=<id>` URL 직접 접속 시 해당 앱 모달 자동 오픈 확인.
  4. `공유 링크 복사` 클릭 시 클립보드 복사 및 토스트 알림 확인.
  5. 내장 샘플 앱(`./apps/sample-app/index.html`) 인앱 뷰어 실행, 데스크톱/모바일 폭 전환, 닫기 시 `iframe` 정리 확인.
  6. 누락된 썸네일 경로에 대한 폴백 플레이스홀더 렌더링 및 모바일 뷰포트 반응형 레이아웃 확인.
