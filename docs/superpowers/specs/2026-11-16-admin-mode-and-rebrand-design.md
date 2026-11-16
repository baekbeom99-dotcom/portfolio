# 윤선생 App Studio 브랜딩 · 카테고리 정리 · 관리자 모드 설계 명세

- **작성일**: 2026-11-16
- **기반 명세**: [2026-11-16-portfolio-system-design.md](file:///c:/Antigravity/portfolio/docs/superpowers/specs/2026-11-16-portfolio-system-design.md)

---

## 1. 변경 목표

1. **브랜딩 개편**:
   - 사이트 타이틀: **`윤선생 App Studio`**
   - 부제: **`교육용 및 일상생활을 위한 웹앱 공유 플랫폼`**
   - `index.html`의 `<title>`, `<meta name="description">`, Open Graph 메타 태그를 동일하게 반영한다.
2. **미사용 카테고리 및 예시 항목 삭제**:
   - 기존 예시 앱 2개와 예시용 태그(`내장앱`, `생산성`, `쇼케이스`, `유틸리티`, `타이머`)를 `data/apps.js`의 활성 목록에서 제거한다 (`window.PORTFOLIO_APPS = []`, `apps/sample-app/index.html`은 참고용으로 보존).
   - 필터 바에는 **실제 등록된 앱들에 입력된 카테고리(`tags`)만 동적으로 표시**하며, 어떤 앱에도 속하지 않은 카테고리는 표시하지 않는다.
   - `직접 탑재` / `웹 링크` 실행 방식 필터 역시 각 유형의 앱이 1개 이상 존재할 때만 표시하며, 0개이거나 단일 유형만 있을 때는 불필요한 필터 그룹을 숨긴다.
   - 등록된 앱이 0개일 때는 검색 결과 없음과 구분되는 초기 빈 상태(`"아직 등록된 웹앱이 없습니다."`)와 관리자 모드 안내 버튼을 표시한다.
3. **상단 관리자 모드 (`PW: gPqk`)**:
   - 헤더 우측 상단에 **`관리자 모드`** 버튼을 배치한다.
   - 비밀번호 입력 시 평문 문자열을 소스에 노출하지 않고 순수 JS SHA-256 해시(`b1a8cd2856f2c9616455e1ae797e01e5443c30ca6c08e0931ab4ee22bf3c2525`)로 검증한다.
   - 인증 성공 시 `sessionStorage`에 관리자 세션을 유지하고, 상단 버튼이 `관리자 패널` / `잠금`으로 전환된다.
4. **웹앱 링크 확인 & 내용 입력 추천 문구 생성 (`js/recommender.js`)**:
   - 관리자 폼에서 웹앱 링크 입력 후 **`링크 확인 및 추천 문구 생성`**을 클릭하면:
     - URL 안전성(`https://`, `http://`, `./apps/`) 검증.
     - 동일 출처(`window.location.origin` 일치 또는 `./apps/...`)는 HTML을 `fetch`해 `<title>`, `<meta name="description">`, `<h1>~<h2>`, 주요 텍스트 추출.
     - GitHub / GitHub Pages URL(`github.com/<owner>/<repo>` 또는 `<owner>.github.io/<repo>`)은 GitHub 공개 API(`api.github.com/repos/<owner>/<repo>`)로 저장소 설명(`description`), 토픽(`topics`), 언어를 추가 조회.
     - CORS로 본문 읽기가 차단된 외부 도메인은 `fetch(..., { mode: "no-cors" })`로 연결 확인 후 경로·키워드 기반 안내 제공.
     - 추출 결과를 바탕으로 **앱 제목, 한 줄 요약, 목적, 추천 대상, 주요 내용 및 사용법, 추천 카테고리(`교육`, `일상생활` 등)** 초안을 생성해 제시하고, **`추천 문구 적용`** 버튼으로 폼에 반영할 수 있게 한다.
5. **다양한 썸네일 비율 자동 맞춤 배치 (`thumbnailFit`)**:
   - 썸네일 입력 시 **이미지 파일 첨부**와 **이미지 URL/경로 입력**을 모두 지원한다.
   - 앱 데이터에 `thumbnailFit: "auto" | "cover" | "contain"` 필드를 추가한다 (기본값 `"auto"`).
   - 렌더링 시 `"auto"` 모드는 이미지 로드(`onload`) 시 원본 비율(`naturalWidth / naturalHeight`)을 측정해 16:9(`16/9 ≈ 1.778`)와 비율 차이가 `0.28` 이상이거나 가로 해상도가 `360px` 미만이면 자동으로 **`contain` + 블러/그라데이션 앰비언트 배경(`.is-contain-fit`)**으로 전환한다.
   - 덕분에 세로형 모바일 캡처, 정사각형 아이콘, 초광폭 이미지도 16:9 프레임 안에서 잘리거나 어색하게 늘어나지 않고 안정적으로 배치된다.
   - 관리자 폼에서 실시간 16:9 미리보기를 보며 `자동 맞춤 / 꽉 채우기 / 전체 보기+블러 배경`을 직접 선택할 수 있다.
6. **저장 · 즉시 미리보기 · GitHub 자동 커밋 & 파일 다운로드 (`js/github-sync.js`)**:
   - 관리자 폼에서 저장 시 `localStorage` 드래프트(`ys_portfolio_apps_draft`)에 즉시 반영되어 현재 브라우저에서 바로 확인·체험할 수 있다 (로컬 드래프트 활성화 시 상단 배너 + `초기화(배포본 보기)` 제공).
   - GitHub 설정(저장소 `owner/repo`, 브랜치 `main`, 브라우저 `localStorage`에만 보관되는 PAT)을 입력해 두면 **`GitHub에 게시`** 클릭 시 첨부한 썸네일 이미지(`assets/thumbnails/<id>.<ext>`)와 `data/apps.js`를 GitHub Contents API로 커밋해 GitHub Actions 자동 재배포를 트리거한다.
   - PAT가 없거나 GitHub 외 환경에 반영할 때는 **`data/apps.js` 다운로드** 및 **코드 복사** 기능을 즉시 사용할 수 있다.
