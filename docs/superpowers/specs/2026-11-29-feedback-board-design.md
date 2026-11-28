# 사부작스쿨 문의·건의·요청 게시판 설계 명세

- **작성일**: 2026-11-29
- **기반 명세**: [2026-11-16-portfolio-system-design.md](file:///c:/Antigravity/portfolio/docs/superpowers/specs/2026-11-16-portfolio-system-design.md)
- **대상 저장소**: `c:\Antigravity\portfolio` (`https://baekbeom99-dotcom.github.io/portfolio/`)

---

## 1. 목적 및 요구사항

사부작스쿨 방문자(학생·교사·일반 사용자)가 별도 로그인이나 외부 폼 이동 없이 웹앱 사용 중 생긴 문의사항, 개선 건의, 새 웹앱 제작 요청 등을 간편하게 남기고 공개 목록을 확인할 수 있는 작은 소통 게시판을 추가한다.

### 확정 요구사항
1. **열람 범위**: 공개 게시판 — 모든 방문자가 글 목록을 열람하고 새 글을 등록할 수 있다.
2. **배치 위치**: 웹앱 쇼케이스(`<section class="showcase-section">`) 아래, `<footer class="site-footer">` 바로 위 영역에 컴팩트한 섹션(`<section id="feedback-board">`)으로 배치한다.
3. **입력 항목**: 닉네임(선택, 미입력 시 `"익명"`) + 내용(필수)만 입력하는 초간단 형태로 유지한다.
4. **관리 기능**: 관리자는 관리자 인증 상태에서 부적절한 글이나 처리 완료된 글을 삭제할 수 있으며, 필요 시 간단한 한 줄 답변(`reply`)을 달 수 있다.

---

## 2. 아키텍처 및 데이터 흐름

```
방문자 ──(입력 폼: 닉네임 + 내용)──▶ PortfolioBoard (js/board.js)
                                           │
                                           ▼
                                  PortfolioFirebase (js/firebase-sync.js)
                                    ├─ GET    /board.json           (목록 조회)
                                    ├─ POST   /board.json           (방문자 신규 글 등록)
                                    ├─ PATCH  /board/<id>.json?auth (관리자 답변 등록)
                                    └─ DELETE /board/<id>.json?auth (관리자 글 삭제)
                                           │
                                           ▼
                               Firebase RTDB (sabujaak-school)
                                 └─ database.rules.json 규칙 검증
```

- **정적 호스팅 + Firebase RTDB 연동**: 기존 `sabujaak-school` Firebase Realtime Database를 그대로 확장하여 서버/Cloud Functions 없이 동작한다.
- **오프라인 / `file://` 폴백**: `file://` 프로토콜이나 네트워크 불가 시에도 메인 포트폴리오 동작을 방해하지 않으며, 게시판에는 읽기/연결 안내 메시지를 표시하고 폼 제출 시 오류를 명확히 안내한다.

---

## 3. Firebase RTDB 스키마 및 보안 규칙

### 3.1 데이터 스키마 (`/board/$postId`)

`POST /board.json`을 통해 Firebase 서버 타임스탬프 순의 고유 Push Key(`$postId`)를 발급받는다.

```json
{
  "author": "초등교사",
  "content": "구구단 몬스터 난이도 선택 기능이 있으면 좋겠어요!",
  "createdAt": 1764345600000,
  "reply": "좋은 의견 감사합니다! 다음 업데이트에 반영해볼게요.",
  "replyAt": 1764349200000
}
```

- `author` (`string`, 필수): 1~30자. 클라이언트에서 공백만 있거나 비어 있으면 `"익명"`으로 치환해 전송한다.
- `content` (`string`, 필수): 2~1000자.
- `createdAt` (`number`, 필수): 작성 시각 epoch ms (`Date.now()`, `> 0`).
- `reply` (`string`, 선택): 관리자 답변 내용 (1~500자).
- `replyAt` (`number`, 선택): 관리자 답변 시각 epoch ms.

### 3.2 보안 규칙 (`database.rules.json`)

```json
"board": {
  ".read": true,
  "$postId": {
    ".write": "(auth != null && auth.uid === 'zNS57lhTOXMCDrbBwhAV2US5i0w1') || (!data.exists() && newData.hasChildren(['author', 'content', 'createdAt']) && newData.child('author').isString() && newData.child('author').val().length >= 1 && newData.child('author').val().length <= 30 && newData.child('content').isString() && newData.child('content').val().length >= 2 && newData.child('content').val().length <= 1000 && newData.child('createdAt').isNumber() && newData.child('createdAt').val() > 0 && !newData.child('reply').exists() && !newData.child('replyAt').exists())"
  }
}
```

- **비로그인 방문자**: 아직 존재하지 않는 키(`!data.exists()`)에 대한 **신규 생성만 허용**하며, 기존 글 수정·삭제 및 `reply`/`replyAt` 필드 위조를 DB 규칙 수준에서 차단한다.
- **관리자 (`auth.uid === 'zNS57lhTOXMCDrbBwhAV2US5i0w1'`)**: 모든 글의 생성·답변(`PATCH`)·삭제(`DELETE`)가 가능하다.

---

## 4. 모듈 설계

### 4.1 `js/firebase-sync.js` 확장
`PortfolioFirebase`에 게시판용 4개 함수를 추가한다.
- `normalizeBoardPosts(rawBoard)`: RTDB 객체/배열 응답을 정제해 `{ id, author, content, createdAt, reply, replyAt }[]`로 변환하고 `createdAt` 내림차순(최신순, 동률 시 `id` 내림차순)으로 정렬한다.
- `loadBoardPosts(options)`: `GET /board.json` 호출 후 정규화된 게시글 목록 반환.
- `createBoardPost(payload, options)`:
  - 입력 검증 (`content` trim 후 2~1000자 확인, `author` 미입력 시 `"익명"`·최대 30자 자름).
  - `POST /board.json` 호출해 `{ id, author, content, createdAt }` 반환.
- `deleteBoardPost(postId, options)`:
  - `ALLOWED_POST_ID_RE` (`/^[A-Za-z0-9_-]{1,128}$/`) 검증.
  - `getValidIdToken()`으로 Firebase 관리자 토큰 확보(미인증 시 한국어 안내 에러 throw).
  - `DELETE /board/<postId>.json?auth=<idToken>` 실행.
- `replyBoardPost(postId, replyText, options)`:
  - `postId` 및 답변 텍스트(1~500자) 검증, 관리자 토큰 확보 후 `PATCH /board/<postId>.json?auth=<idToken>`로 `{ reply, replyAt }` 저장.

### 4.2 `js/board.js` 신설 (`PortfolioBoard`)
- `createBoardController(options)` 및 `initBoard()` export:
  - 컨테이너 `<section id="feedback-board">` 내부를 **크래프트 아틀리에 테마**에 어울리는 컴팩트 카드로 렌더링.
  - **작성 폼**:
    - 닉네임 `<input maxlength="30" placeholder="닉네임 (비우면 익명)">`
    - 내용 `<textarea maxlength="1000" rows="3" placeholder="문의사항, 건의사항, 요청하고 싶은 웹앱을 자유롭게 남겨주세요.">`
    - 실시간 글자 수 카운터(`0 / 1000`) + `남기기` 버튼
    - 연속 등록 방지 쿨다운(기본 `10000ms`, 테스트에서 옵션으로 오버라이드 가능) + 인라인 에러/성공 상태 메시지 + `onNotify(toastMessage)` 콜백.
  - **목록 영역**:
    - 총 글 개수 배지(`전체 N건`) 및 `새로고침` 버튼.
    - 초기 `5`개만 표시(`DEFAULT_PAGE_SIZE = 5`)하고 남은 글이 있을 때 `이전 글 더 보기 (N건 남음)` 버튼 제공.
    - 빈 상태 안내(`"아직 등록된 문의·건의가 없습니다. 첫 번째 의견을 남겨보세요!"`).
    - 로딩/에러 상태 구분 표시.
  - **관리자 연동 (`canModerate()`)**:
    - `isAdminUnlocked()` 및 `hasFirebaseAuth()` 상태에 따라:
      - `isAdminUnlocked() === true`일 때 각 글 우측에 `답변` / `삭제` 버튼 노출.
      - 클릭 시 Firebase 관리자 토큰이 없으면 친절한 안내 메시지(`"관리자 모드에서 Firebase 로그인 후 삭제·답변할 수 있습니다."`) 표시.
      - `삭제` 버튼은 실수 방지를 위해 1차 클릭 시 `삭제 확인` 상태로 전환(또는 확인 프롬프트 없이 인라인 2단계 확인) 후 실제 삭제 요청.
      - `답변` 버튼은 해당 카드 안에 작은 인라인 답변 입력창을 열어 저장/취소 가능.
  - **XSS 방어**: 작성자, 본문, 날짜, 관리자 답변 모두 반드시 `textContent`로만 DOM에 주입한다(`innerHTML` 사용 금지).

### 4.3 `js/app.js` 및 `js/admin.js` 연동
- `index.html`: `<section id="feedback-board" class="board-section" aria-label="문의 및 건의 게시판"></section>` 추가 및 `<script defer src="./js/board.js"></script>` 로드.
- `js/app.js`: `initPortfolio()`에서 `PortfolioBoard.createBoardController`를 초기화하고, `onAuthChanged` 발생 시 `boardController.setAdminMode(...)` 및 `boardController.refresh()`와 연동(관리자 로그인 직후에도 삭제/답변 버튼이 즉시 동기화되도록 함).

---

## 5. 스타일 및 반응형 디자인 (`css/styles.css`, `css/theme-craft.css`)

- **컬러 & 질감**: 사부작스쿨 크래프트 팔레트(`--surface: #fffdf8`, `--surface-tint: #fbf1e3`, `--border: #e0d3be`, `--accent: #c65522`)와 `Jua` 디스플레이 타이틀 + `Pretendard` 본문 유지.
- **컴팩트 레이아웃**:
  - 데스크톱(`>= 900px`): 좌측(약 340px) 고정 폭 입력 카드 + 우측 가변 폭 게시글 목록의 2단 배치로 세로 높이를 절약한다.
  - 모바일/태블릿(`< 900px`): 입력 폼 상단 + 게시글 목록 하단의 1단 세로 스택.
- **접근성**: 모든 폼 컨트롤에 `<label>` 연결, 오류 메시지 `role="alert"`, 상태 업데이트 `aria-live="polite"`, `prefers-reduced-motion` 준수.

---

## 6. 테스트 전략

1. `tests/firebase-sync.test.js`:
   - `normalizeBoardPosts`, `loadBoardPosts`, `createBoardPost`, `replyBoardPost`, `deleteBoardPost` 정상 동작 및 유효성 검사(빈 내용·길이 초과·잘못된 `postId`·미인증/401/403 오류) 검증.
2. `tests/board.test.js`:
   - 초기 렌더링, 익명 기본값, 폼 유효성 검증, XSS 문자열(`"<script>alert(1)</script>"`)의 `textContent` 무해화, 연속 제출 쿨다운, `더 보기` 페이지네이션, 관리자 삭제(2단계 확인)·답변 작성 및 `onAuthChanged` 동기화 검증.
3. `tests/viewer-and-html.test.js`:
   - `index.html`에 `./js/board.js` 스크립트 순서 및 `#feedback-board` 컨테이너 포함 검증.
4. 라이브 배포 검증:
   - `firebase deploy --only database`로 `database.rules.json` 배포
   - `git push` 후 GitHub Pages에서 실제 브라우저(데스크톱/모바일)로 조회·작성·더보기·콘솔/네트워크 무오류 확인 및 테스트 글 정리.
