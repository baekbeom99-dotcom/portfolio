const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadRecommender() {
  const code = fs.readFileSync(path.resolve(__dirname, "..", "js", "recommender.js"), "utf8");
  const sandbox = {
    window: {},
    URL,
    AbortController,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.PortfolioRecommender;
}

test("validateAppUrl accepts https, http, and ./apps/ paths while rejecting unsafe inputs", () => {
  const { validateAppUrl } = loadRecommender();

  const httpsRes = validateAppUrl("  https://example.com/my-app  ");
  assert.equal(httpsRes.valid, true);
  assert.equal(httpsRes.normalizedUrl, "https://example.com/my-app");
  assert.equal(httpsRes.launchType, "external");

  const httpRes = validateAppUrl("http://localhost:8080/app");
  assert.equal(httpRes.valid, true);
  assert.equal(httpRes.normalizedUrl, "http://localhost:8080/app");
  assert.equal(httpRes.launchType, "external");

  const embeddedRes = validateAppUrl("./apps/sample-app/index.html");
  assert.equal(embeddedRes.valid, true);
  assert.equal(embeddedRes.normalizedUrl, "./apps/sample-app/index.html");
  assert.equal(embeddedRes.launchType, "embedded");

  const invalidCases = [
    "",
    "   ",
    null,
    undefined,
    "javascript:alert(1)",
    "JAVASCRIPT:void(0)",
    "data:text/html,<script>alert(1)</script>",
    "https://example.com/\u0000evil",
    "ftp://example.com/file",
    "/apps/sample-app/index.html",
    "./apps/",
    "./apps/.",
    "./apps/./",
    "./apps/../secret/index.html",
    "./apps/foo\\..\\secret.html",
    "./apps/%2e%2e/secret.html",
    "./apps/%ZZ/index.html",
    "./other/index.html"
  ];

  for (const bad of invalidCases) {
    const res = validateAppUrl(bad);
    assert.equal(res.valid, false, `Expected invalid for ${String(bad)}`);
    assert.equal(typeof res.reason, "string");
    assert.ok(res.reason.length > 0);
  }
});

test("extractGitHubRepo parses github.io Pages URLs and github.com repo URLs", () => {
  const { extractGitHubRepo } = loadRecommender();

  assert.deepEqual(
    { ...extractGitHubRepo("https://baekbeom99-dotcom.github.io/portfolio/") },
    { owner: "baekbeom99-dotcom", repo: "portfolio" }
  );

  assert.deepEqual(
    { ...extractGitHubRepo("https://teacher-yoon.github.io/english-quiz/play.html") },
    { owner: "teacher-yoon", repo: "english-quiz" }
  );

  assert.deepEqual(
    { ...extractGitHubRepo("https://teacher-yoon.github.io/") },
    { owner: "teacher-yoon", repo: "teacher-yoon.github.io" }
  );

  assert.deepEqual(
    { ...extractGitHubRepo("https://github.com/octocat/vocab-trainer.git") },
    { owner: "octocat", repo: "vocab-trainer" }
  );

  assert.deepEqual(
    { ...extractGitHubRepo("https://github.com/octocat/vocab-trainer/tree/main") },
    { owner: "octocat", repo: "vocab-trainer" }
  );

  assert.equal(extractGitHubRepo("https://github.com/octocat"), null);
  assert.equal(extractGitHubRepo("https://example.com/quiz"), null);
  assert.equal(extractGitHubRepo("./apps/sample-app/index.html"), null);
});

test("parseHtmlMetadata extracts plain decoded text, supports both meta attribute orders, and strips scripts/tags", () => {
  const { parseHtmlMetadata } = loadRecommender();

  const html = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <title>영어 &amp; 단어 퀴즈 &lt;초등&gt;</title>
      <meta content="학생용 &#39;기초&#39; &quot;어휘&quot;&nbsp;연습 앱" name="description" />
      <meta property="og:description" content="fallback og description" />
      <style>.hidden { display: none; }</style>
    </head>
    <body>
      <h1><span>1단원</span> <b>필수 단어</b><script>alert("xss")</script></h1>
      <h2>오답 노트</h2>
      <h2>발음 듣기</h2>
      <h2>학습 통계</h2>
      <h2>다섯 번째 제목은 제외</h2>
      <p>매일 10문제씩 <em>반복</em> 학습합니다.</p>
      <button type="button">퀴즈 시작</button>
      <button type="button">단어장 보기</button>
      <p>네 번째 문단은 제외됩니다.</p>
      <script>const secret = "do not leak";</script>
    </body>
    </html>
  `;

  const meta = parseHtmlMetadata(html);
  assert.equal(meta.title, "영어 & 단어 퀴즈 <초등>");
  assert.equal(meta.description, "학생용 '기초' \"어휘\" 연습 앱");
  assert.deepEqual(Array.from(meta.headings), [
    "1단원 필수 단어",
    "오답 노트",
    "발음 듣기",
    "학습 통계"
  ]);
  assert.deepEqual(Array.from(meta.snippets), [
    "매일 10문제씩 반복 학습합니다.",
    "퀴즈 시작",
    "단어장 보기"
  ]);

  const ogOnlyHtml = `
    <html><head>
      <meta content="OG &amp;lt;script&amp;gt; 설명" property="og:description">
    </head></html>
  `;
  const ogMeta = parseHtmlMetadata(ogOnlyHtml);
  assert.equal(ogMeta.description, "OG &lt;script&gt; 설명");
});

test("buildRecommendations generates valid Korean copy, tags, id, and embedMode across domains", () => {
  const { buildRecommendations } = loadRecommender();

  const eduRec = buildRecommendations({
    url: "https://teacher.github.io/vocab-quiz-master/",
    htmlMeta: {
      title: "영단어 퀴즈 마스터",
      description: "초중등 영어 어휘 암기 및 퀴즈 웹앱",
      headings: ["오늘의 단어 10개", "스피드 퀴즈"],
      snippets: ["퀴즈 시작", "오답 복습하기"]
    },
    repoMeta: {
      name: "vocab-quiz-master",
      description: "English vocabulary flashcard quiz",
      topics: ["education", "quiz"],
      language: "JavaScript"
    }
  });

  assert.match(eduRec.id, /^[a-z0-9-]+$/);
  assert.equal(eduRec.id, "vocab-quiz-master");
  assert.equal(eduRec.title, "영단어 퀴즈 마스터");
  assert.ok(eduRec.tagline.length > 0);
  assert.ok(eduRec.purpose.length > 0);
  assert.ok(eduRec.audience.length > 0);
  assert.ok(Array.isArray(eduRec.description));
  assert.ok(eduRec.description.length >= 2 && eduRec.description.length <= 3);
  assert.ok(eduRec.suggestedTags.includes("교육"));
  assert.equal(eduRec.embedMode, "iframe");

  const dailyRec = buildRecommendations({
    url: "./apps/daily-timer/index.html",
    htmlMeta: {
      title: "25분 집중 타이머",
      description: "",
      headings: ["25분 집중 타이머"],
      snippets: ["시간을 효율적으로 관리하는 뽀모도로 타이머입니다.", "시작", "초기화"]
    },
    repoMeta: null
  });

  assert.equal(dailyRec.id, "daily-timer");
  assert.ok(dailyRec.suggestedTags.includes("일상생활"));
  assert.equal(dailyRec.embedMode, "iframe");

  const neutralRec = buildRecommendations({
    url: "https://example.com/color-mixer",
    htmlMeta: {
      title: "Color Palette Mixer",
      description: "Blend hex colors interactively",
      headings: ["Color Palette Mixer"],
      snippets: ["Pick colors"]
    },
    repoMeta: null
  });

  assert.match(neutralRec.id, /^[a-z0-9-]+$/);
  assert.equal(neutralRec.embedMode, "newTab");
  assert.ok(neutralRec.suggestedTags.length >= 1);
  assert.ok(neutralRec.suggestedTags.includes("교육") || neutralRec.suggestedTags.includes("일상생활"));
});

test("inspectWebAppUrl handles invalid URLs, embedded HTML analysis, GitHub API + CORS fallback, and unreachable fallback", async () => {
  const { inspectWebAppUrl } = loadRecommender();

  // 1. Invalid URL
  let fetchCalled = false;
  const invalidRes = await inspectWebAppUrl("javascript:alert(1)", {
    fetchImpl: async () => {
      fetchCalled = true;
      return { ok: true, text: async () => "" };
    }
  });
  assert.equal(fetchCalled, false);
  assert.equal(invalidRes.ok, false);
  assert.equal(invalidRes.status, "invalid");
  assert.equal(invalidRes.validation.valid, false);

  // 2. Embedded HTML analysis (sample-app)
  const sampleHtml = fs.readFileSync(
    path.resolve(__dirname, "..", "apps", "sample-app", "index.html"),
    "utf8"
  );
  const embeddedRes = await inspectWebAppUrl("./apps/sample-app/index.html", {
    fetchImpl: async (url) => {
      assert.equal(url, "./apps/sample-app/index.html");
      return {
        ok: true,
        status: 200,
        text: async () => sampleHtml
      };
    }
  });
  assert.equal(embeddedRes.ok, true);
  assert.equal(embeddedRes.status, "analyzed");
  assert.equal(embeddedRes.launchType, "embedded");
  assert.equal(embeddedRes.htmlMeta.title, "샘플 내장 앱 - 25분 집중 타이머");
  assert.equal(embeddedRes.recommendations.id, "sample-app");
  assert.equal(embeddedRes.recommendations.embedMode, "iframe");
  assert.ok(embeddedRes.recommendations.suggestedTags.includes("일상생활"));

  // 3. GitHub Pages with CORS error + no-cors reachability + GitHub API metadata
  const corsRes = await inspectWebAppUrl("https://teacher.github.io/math-flashcard/", {
    fetchImpl: async (url, init = {}) => {
      if (url === "https://api.github.com/repos/teacher/math-flashcard") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            name: "math-flashcard",
            description: "Elementary math flashcard practice tool",
            topics: ["math", "study"],
            language: "HTML"
          })
        };
      }
      if (url === "https://teacher.github.io/math-flashcard/" && init.mode === "no-cors") {
        return { ok: false, type: "opaque", status: 0 };
      }
      throw new TypeError("Failed to fetch due to CORS");
    }
  });
  assert.equal(corsRes.ok, true);
  assert.equal(corsRes.status, "cors-limited");
  assert.equal(
    corsRes.statusMessage,
    "링크 연결은 확인되었으나 외부 도메인 보안 정책(CORS)으로 상세 내용을 직접 읽지 못해 주소·저장소 정보를 바탕으로 추천 문구를 만들었습니다."
  );
  assert.equal(corsRes.repoMeta.name, "math-flashcard");
  assert.ok(corsRes.recommendations.suggestedTags.includes("교육"));
  assert.equal(corsRes.recommendations.embedMode, "iframe");

  // 4. GitHub Pages HTML analyzed + GitHub API 404 ignored gracefully
  const ghHtmlRes = await inspectWebAppUrl("https://teacher.github.io/habit-check/", {
    fetchImpl: async (url) => {
      if (url.startsWith("https://api.github.com/")) {
        return { ok: false, status: 404 };
      }
      return {
        ok: true,
        status: 200,
        text: async () => "<title>매일 습관 체크리스트</title><p>할 일과 습관을 기록하세요.</p>"
      };
    }
  });
  assert.equal(ghHtmlRes.ok, true);
  assert.equal(ghHtmlRes.status, "analyzed");
  assert.equal(ghHtmlRes.repoMeta, null);
  assert.ok(ghHtmlRes.recommendations.suggestedTags.includes("일상생활"));

  // 5. Unreachable URL still provides fallback draft recommendations
  const unreachableRes = await inspectWebAppUrl("https://offline.example.com/english-study", {
    fetchImpl: async () => {
      throw new TypeError("Network unreachable");
    }
  });
  assert.equal(unreachableRes.ok, false);
  assert.equal(unreachableRes.status, "unreachable");
  assert.ok(unreachableRes.statusMessage.length > 0);
  assert.ok(unreachableRes.recommendations !== null);
  assert.match(unreachableRes.recommendations.id, /^[a-z0-9-]+$/);
  assert.ok(unreachableRes.recommendations.suggestedTags.includes("교육"));
  assert.equal(unreachableRes.recommendations.embedMode, "newTab");
});
