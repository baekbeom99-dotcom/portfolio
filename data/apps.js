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
  "siteTitle": "윤선생 App Studio",
  "siteSubtitle": "교육용 및 일상생활을 위한 웹앱 공유 플랫폼",
  "ownerName": "윤선생",
  "contactLink": ""
};

window.PORTFOLIO_APPS = [
  {
    "id": "animal-race",
    "title": "동물 달리기 추첨",
    "tagline": "교실 추첨용 동물 달리기, 마블 룰렛(순서 정하기)",
    "purpose": "교실 추첨용 동물 달리기 + 마블 룰렛 웹앱 — 학습자가 핵심 내용을 이해하고 스스로 연습할 수 있도록 돕기 위해 제작했습니다.",
    "audience": "초·중·고 학생, 교사 및 자기주도 학습자",
    "description": [
      "주요 동작 버튼: 동물 달리기, 마블 룰렛, 소리 켬",
      "화면에 안내된 단계에 따라 별도 설치 없이 바로 학습을 시작할 수 있습니다.",
      "모바일과 데스크톱 환경 모두에 맞춰 편리하게 이용할 수 있습니다."
    ],
    "thumbnail": "./assets/thumbnails/animal-race.png",
    "thumbnailFit": "auto",
    "launchType": "external",
    "url": "https://baekbeom99-dotcom.github.io/animal-race/",
    "embedMode": "newTab",
    "tags": [
      "교육",
      "순서정하기"
    ],
    "featured": false,
    "createdAt": "2026-11-16"
  },
  {
    "id": "gugu-monster",
    "title": "구구단 몬스터 탐험대",
    "tagline": "구구단을 풀어 몬스터를 잡고 펫을 키우는 학습앱",
    "purpose": "구구단 몬스터 탐험대: 구구단을 풀어 몬스터를 잡고 펫을 키우는 초등 3학년용 학습 웹앱 — 학습자가 핵심 내용을 이해하고 스스로 연습할 수 있도록 돕기 위해 제작했습니다.",
    "audience": "초·중·고 학생, 교사 및 자기주도 학습자",
    "description": [
      "화면에 안내된 단계에 따라 별도 설치 없이 바로 학습을 시작할 수 있습니다.",
      "모바일과 데스크톱 환경 모두에 맞춰 편리하게 이용할 수 있습니다."
    ],
    "thumbnail": "./assets/thumbnails/gugu-monster.png",
    "thumbnailFit": "auto",
    "launchType": "external",
    "url": "https://baekbeom99-dotcom.github.io/gugu-monster/#/pet",
    "embedMode": "newTab",
    "tags": [
      "교육",
      "수학",
      "구구단"
    ],
    "featured": false,
    "createdAt": "2026-11-16"
  },
  {
    "id": "doble",
    "title": "Turtle Dobble",
    "tagline": "도블 게임 기반 한글 및 알파벳 학습앱(태블릿, PC버전)",
    "purpose": "별도 프로그램 설치 없이 웹 브라우저만으로 필요한 기능을 손쉽게 활용할 수 있도록 만든 웹앱입니다.",
    "audience": "교육 현장 및 일상에서 웹앱 도구를 활용하고 싶은 모든 사용자",
    "description": [
      "링크를 통해 브라우저에서 즉시 실행하고 주요 기능을 체험할 수 있습니다.",
      "PC와 태블릿 화면 크기에서 모두 안정적으로 동작하도록 활용할 수 있습니다."
    ],
    "thumbnail": "./assets/thumbnails/doble.png",
    "thumbnailFit": "auto",
    "launchType": "external",
    "url": "https://baekbeom99-dotcom.github.io/doble/",
    "embedMode": "newTab",
    "tags": [
      "교육",
      "한글",
      "알파벳"
    ],
    "featured": false,
    "createdAt": "2026-11-16"
  },
  {
    "id": "turtle-dobble",
    "title": "Turtle Dobble (휴대폰 버전, 간략)",
    "tagline": "도블 게임 기반 한글 및 알파벳 학습앱(휴대폰 버전)",
    "purpose": "순발력과 관찰력으로 같은 글자를 찾아라! 혼자하기, 1:1 대결하기, 협동 보스전까지 즐기는 거북이 도블 모바일 게임 — 교육과 일상생활에서 필요한 작업을 웹에서 간편하게 수행할 수 있도록 제작했습니다.",
    "audience": "교육 현장 및 일상에서 웹앱 도구를 활용하고 싶은 모든 사용자",
    "description": [
      "링크를 통해 브라우저에서 즉시 실행하고 주요 기능을 체험할 수 있습니다.",
      "PC와 모바일 화면 크기에서 모두 안정적으로 동작하도록 활용할 수 있습니다."
    ],
    "thumbnail": "./assets/thumbnails/turtle-dobble.png",
    "thumbnailFit": "auto",
    "launchType": "external",
    "url": "https://baekbeom99-dotcom.github.io/advGugu/",
    "embedMode": "newTab",
    "tags": [
      "교육",
      "한글",
      "알파벳"
    ],
    "featured": false,
    "createdAt": "2026-11-16"
  },
  {
    "id": "pose-ninja-fruit",
    "title": "Pose Ninja Fruit - 모션 인식 슬라이스 게임",
    "tagline": "모션 인식 과일 슬라이스 게임 + 갤러그 게임(실내 운동앱)",
    "purpose": "웹캠/전면 카메라 모션 인식(MediaPipe Pose) 과일 슬라이스 게임 (Pose Ninja Fruit) — 교육과 일상생활에서 필요한 작업을 웹에서 간편하게 수행할 수 있도록 제작했습니다.",
    "audience": "교육 현장 및 일상에서 웹앱 도구를 활용하고 싶은 모든 사용자",
    "description": [
      "❓ 자세 가이드",
      "주요 구성: POSE NINJA FRUIT · GAME OVER · ⚡ 한글 자음 필살기 자세 가이드",
      "링크를 통해 브라우저에서 즉시 실행하고 주요 기능을 체험할 수 있습니다."
    ],
    "thumbnail": "./assets/thumbnails/pose-ninja-fruit.png",
    "thumbnailFit": "auto",
    "launchType": "external",
    "url": "https://baekbeom99-dotcom.github.io/pose-ninja-fruit/",
    "embedMode": "newTab",
    "tags": [
      "교육",
      "일상생활"
    ],
    "featured": false,
    "createdAt": "2026-11-16"
  },
  {
    "id": "catmath",
    "title": "냥냥수학",
    "tagline": "수준별 학습지 만들기, 자기 주도 수학 학습, 기초연산",
    "purpose": "수준별 학습 및 자기조도 학습을 위한 학습지 만들기",
    "audience": "초등학생 및 교사",
    "description": [
      "수학 학습지 만들기, 학습자 수준별 문제 출제, 고양이 키우기"
    ],
    "thumbnail": "./assets/thumbnails/catmath.png",
    "thumbnailFit": "auto",
    "launchType": "external",
    "url": "https://gugudan-monster.web.app/",
    "embedMode": "newTab",
    "tags": [
      "교육",
      "수학"
    ],
    "featured": false,
    "createdAt": "2026-11-16"
  }
];
