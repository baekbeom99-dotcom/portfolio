const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadGitHubSync(extraGlobals = {}) {
  const code = fs.readFileSync(path.resolve(__dirname, "..", "js", "github-sync.js"), "utf8");
  const sandbox = {
    window: {},
    TextEncoder,
    btoa,
    encodeURIComponent,
    decodeURIComponent,
    ...extraGlobals
  };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.PortfolioGitHubSync;
}

test("utf8ToBase64 encodes Korean text cleanly in browser-like and minimal vm sandboxes", () => {
  const syncBrowser = loadGitHubSync();
  const sample = "윤선생 App Studio — 한글, 특수문자! \"따옴표\" & 이모지 🎯";
  const encoded = syncBrowser.utf8ToBase64(sample);
  assert.equal(typeof encoded, "string");
  assert.equal(Buffer.from(encoded, "base64").toString("utf8"), sample);
  assert.equal(syncBrowser.utf8ToBase64(""), "");

  // Minimal vm sandbox without TextEncoder/btoa/Buffer
  const code = fs.readFileSync(path.resolve(__dirname, "..", "js", "github-sync.js"), "utf8");
  const minimalSandbox = { window: {} };
  vm.runInNewContext(code, minimalSandbox);
  const minimalEncoded = minimalSandbox.window.PortfolioGitHubSync.utf8ToBase64(sample);
  assert.equal(Buffer.from(minimalEncoded, "base64").toString("utf8"), sample);
});

test("parseDataUrlBase64 parses image data URLs and rejects unsafe/non-image inputs", () => {
  const { parseDataUrlBase64 } = loadGitHubSync();

  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const pngParsed = parseDataUrlBase64(`data:image/png;base64,${pngBase64}`);
  assert.deepEqual(toPlain(pngParsed), {
    mimeType: "image/png",
    ext: "png",
    base64: pngBase64
  });

  const jpgParsed = parseDataUrlBase64("data:image/jpeg;base64,/9j/4AAQSkZJRg==");
  assert.deepEqual(toPlain(jpgParsed), {
    mimeType: "image/jpeg",
    ext: "jpg",
    base64: "/9j/4AAQSkZJRg=="
  });

  const webpParsed = parseDataUrlBase64("data:image/webp;base64,UklGRh4AAABXRUJQVlA4");
  assert.deepEqual(toPlain(webpParsed), {
    mimeType: "image/webp",
    ext: "webp",
    base64: "UklGRh4AAABXRUJQVlA4"
  });

  const svgRaw = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text>단어장</text></svg>';
  const svgParsed = parseDataUrlBase64(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgRaw)}`
  );
  assert.equal(svgParsed.mimeType, "image/svg+xml");
  assert.equal(svgParsed.ext, "svg");
  assert.equal(Buffer.from(svgParsed.base64, "base64").toString("utf8"), svgRaw);

  const svgB64 = Buffer.from(svgRaw, "utf8").toString("base64");
  assert.deepEqual(toPlain(parseDataUrlBase64(`data:image/svg+xml;base64,${svgB64}`)), {
    mimeType: "image/svg+xml",
    ext: "svg",
    base64: svgB64
  });

  assert.equal(parseDataUrlBase64("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(parseDataUrlBase64("data:text/html;base64,PGh0bWw+PC9odG1sPg=="), null);
  assert.equal(parseDataUrlBase64("https://example.com/image.png"), null);
  assert.equal(parseDataUrlBase64("data:image/png;base64,"), null);
  assert.equal(parseDataUrlBase64(""), null);
  assert.equal(parseDataUrlBase64(null), null);
});

test("sanitizeAppRecord strips transient _-prefixed keys and normalizes schema fields", () => {
  const { sanitizeAppRecord } = loadGitHubSync();

  const cleaned = sanitizeAppRecord({
    id: " vocab-quiz ",
    title: " 영어 단어 퀴즈 ",
    tagline: "중학생용 어휘 암기",
    purpose: "단어 복습",
    audience: "중학생",
    description: [" 1단계 ", "", "2단계"],
    thumbnail: "./assets/thumbnails/vocab-quiz.png",
    thumbnailFit: "invalid-fit",
    launchType: "external",
    url: "https://example.com/vocab",
    embedMode: "iframe",
    tags: ["영어", " ", "퀴즈", "영어"],
    featured: 1,
    createdAt: "2026-11-16",
    _pendingThumbDataUrl: "data:image/png;base64,AAAA",
    _internalFlag: true,
    extraUntrackedField: "should-drop"
  });

  assert.deepEqual(toPlain(cleaned), {
    id: "vocab-quiz",
    title: "영어 단어 퀴즈",
    tagline: "중학생용 어휘 암기",
    purpose: "단어 복습",
    audience: "중학생",
    description: ["1단계", "2단계"],
    thumbnail: "./assets/thumbnails/vocab-quiz.png",
    thumbnailFit: "auto",
    launchType: "external",
    url: "https://example.com/vocab",
    embedMode: "iframe",
    tags: ["영어", "퀴즈"],
    featured: true,
    createdAt: "2026-11-16"
  });
  assert.equal("_pendingThumbDataUrl" in cleaned, false);
  assert.equal("_internalFlag" in cleaned, false);

  const coverRecord = sanitizeAppRecord({ id: "a", thumbnailFit: "cover" });
  assert.equal(coverRecord.thumbnailFit, "cover");

  const containRecord = sanitizeAppRecord({ id: "b", thumbnailFit: "contain" });
  assert.equal(containRecord.thumbnailFit, "contain");

  const protoFitRecord = sanitizeAppRecord({ id: "c", thumbnailFit: "toString" });
  assert.equal(protoFitRecord.thumbnailFit, "auto");
});

test("serializeAppsJs strips _pending* fields and round-trips through node:vm", () => {
  const { serializeAppsJs } = loadGitHubSync();

  const config = {
    siteTitle: "윤선생 App Studio",
    siteSubtitle: "교육용 및 일상생활을 위한 웹앱 공유 플랫폼",
    ownerName: "윤선생",
    contactLink: "https://github.com/yoon"
  };

  const apps = [
    {
      id: "math-flash",
      title: '수학 "암산" 퀴즈 </script>',
      tagline: "초등 연산 연습",
      purpose: "기초 연산 훈련",
      audience: "초등학생",
      description: ["문제를 풀고 점수를 확인하세요."],
      thumbnail: "./assets/thumbnails/math-flash.png",
      thumbnailFit: "cover",
      launchType: "external",
      url: "https://example.com/math",
      embedMode: "newTab",
      tags: ["수학", "초등", "수학"],
      featured: false,
      createdAt: "2026-11-16",
      _pendingThumbDataUrl: "data:image/png;base64,AAAA",
      _tempState: "draft"
    }
  ];

  const output = serializeAppsJs(config, apps);
  assert.match(output, /\[새 웹앱 추가 방법\]/);
  assert.doesNotMatch(output, /_pendingThumbDataUrl/);
  assert.doesNotMatch(output, /_tempState/);

  const sandbox = { window: {} };
  vm.runInNewContext(output, sandbox);

  assert.deepEqual(toPlain(sandbox.window.PORTFOLIO_CONFIG), config);
  assert.deepEqual(toPlain(sandbox.window.PORTFOLIO_APPS), [
    {
      id: "math-flash",
      title: '수학 "암산" 퀴즈 </script>',
      tagline: "초등 연산 연습",
      purpose: "기초 연산 훈련",
      audience: "초등학생",
      description: ["문제를 풀고 점수를 확인하세요."],
      thumbnail: "./assets/thumbnails/math-flash.png",
      thumbnailFit: "cover",
      launchType: "external",
      url: "https://example.com/math",
      embedMode: "newTab",
      tags: ["수학", "초등"],
      featured: false,
      createdAt: "2026-11-16"
    }
  ]);
});

test("publishToGitHub uploads new thumbnail, updates existing data/apps.js, and returns updatedApps", async () => {
  const { publishToGitHub } = loadGitHubSync();

  const requests = [];
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  async function mockFetch(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const parsedBody = options.body ? JSON.parse(options.body) : null;
    requests.push({ url, method, headers: options.headers || {}, body: parsedBody });

    if (method === "GET" && url.includes("/contents/assets/thumbnails/focus-timer.png")) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ message: "Not Found" })
      };
    }

    if (method === "PUT" && url.includes("/contents/assets/thumbnails/focus-timer.png")) {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          content: { path: "assets/thumbnails/focus-timer.png", sha: "thumb-sha-1" },
          commit: { sha: "commit-thumb-1", html_url: "https://github.com/yoon/portfolio/commit/commit-thumb-1" }
        })
      };
    }

    if (method === "GET" && url.includes("/contents/data/apps.js")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ sha: "existing-apps-sha-123" })
      };
    }

    if (method === "PUT" && url.includes("/contents/data/apps.js")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: { path: "data/apps.js", sha: "new-apps-sha-456" },
          commit: {
            sha: "final-commit-sha-789",
            html_url: "https://github.com/yoon/portfolio/commit/final-commit-sha-789"
          }
        })
      };
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  }

  const result = await publishToGitHub({
    owner: "yoon",
    repo: "portfolio",
    branch: "main",
    token: "ghp_secret_token",
    config: {
      siteTitle: "윤선생 App Studio",
      siteSubtitle: "교육용 및 일상생활을 위한 웹앱 공유 플랫폼",
      ownerName: "윤선생",
      contactLink: ""
    },
    apps: [
      {
        id: "focus-timer",
        title: "집중 타이머",
        tagline: "25분 뽀모도로",
        purpose: "시간 관리",
        audience: "학생",
        description: ["시작 버튼을 눌러 집중을 시작하세요."],
        thumbnail: "",
        thumbnailFit: "auto",
        launchType: "external",
        url: "https://yoon.github.io/focus-timer/",
        embedMode: "iframe",
        tags: ["타이머", "집중"],
        featured: true,
        createdAt: "2026-11-16",
        _pendingThumbDataUrl: "ignored-or-overridden"
      }
    ],
    pendingThumbnails: {
      "focus-timer": `data:image/png;base64,${pngBase64}`
    },
    fetchImpl: mockFetch
  });

  assert.equal(result.ok, true);
  assert.equal(result.commitSha, "final-commit-sha-789");
  assert.equal(result.htmlUrl, "https://github.com/yoon/portfolio/commit/final-commit-sha-789");
  assert.equal(result.updatedApps.length, 1);
  assert.equal(result.updatedApps[0].thumbnail, "./assets/thumbnails/focus-timer.png");
  assert.equal("_pendingThumbDataUrl" in result.updatedApps[0], false);

  assert.equal(requests.length, 4);

  // 1) GET thumbnail -> 404
  assert.equal(requests[0].method, "GET");
  assert.equal(
    requests[0].url,
    "https://api.github.com/repos/yoon/portfolio/contents/assets/thumbnails/focus-timer.png?ref=main"
  );
  assert.equal(requests[0].headers.Authorization, "Bearer ghp_secret_token");

  // 2) PUT thumbnail -> no sha
  assert.equal(requests[1].method, "PUT");
  assert.equal(requests[1].body.content, pngBase64);
  assert.equal(requests[1].body.branch, "main");
  assert.equal("sha" in requests[1].body, false);

  // 3) GET data/apps.js -> 200 with sha
  assert.equal(requests[2].method, "GET");
  assert.equal(
    requests[2].url,
    "https://api.github.com/repos/yoon/portfolio/contents/data/apps.js?ref=main"
  );

  // 4) PUT data/apps.js -> includes sha and valid serialized JS
  assert.equal(requests[3].method, "PUT");
  assert.equal(requests[3].body.sha, "existing-apps-sha-123");
  assert.equal(requests[3].body.branch, "main");
  const decodedAppsJs = Buffer.from(requests[3].body.content, "base64").toString("utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(decodedAppsJs, sandbox);
  assert.equal(sandbox.window.PORTFOLIO_APPS[0].thumbnail, "./assets/thumbnails/focus-timer.png");
  assert.equal("_pendingThumbDataUrl" in sandbox.window.PORTFOLIO_APPS[0], false);
});

test("publishToGitHub validates required inputs and translates HTTP 401/403/404/422 to Korean errors", async () => {
  const { publishToGitHub } = loadGitHubSync();

  await assert.rejects(
    () => publishToGitHub({ owner: "", repo: "r", token: "t", config: {}, apps: [], fetchImpl: async () => ({}) }),
    /owner|소유자/
  );
  await assert.rejects(
    () => publishToGitHub({ owner: "o", repo: "", token: "t", config: {}, apps: [], fetchImpl: async () => ({}) }),
    /repo|저장소/
  );
  await assert.rejects(
    () => publishToGitHub({ owner: "o", repo: "r", token: "", config: {}, apps: [], fetchImpl: async () => ({}) }),
    /토큰|Token/
  );

  await assert.rejects(
    () =>
      publishToGitHub({
        owner: "yoon",
        repo: "portfolio",
        token: "bad-token",
        config: {},
        apps: [],
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          json: async () => ({ message: "Bad credentials" })
        })
      }),
    (err) => {
      assert.match(err.message, /401/);
      assert.match(err.message, /인증|토큰/);
      return true;
    }
  );

  await assert.rejects(
    () =>
      publishToGitHub({
        owner: "yoon",
        repo: "portfolio",
        token: "tok",
        config: {},
        apps: [],
        fetchImpl: async (url, opts = {}) => {
          if (!opts.method || opts.method === "GET") {
            return { ok: true, status: 200, json: async () => ({ sha: "abc" }) };
          }
          return { ok: false, status: 422, json: async () => ({ message: "Invalid sha" }) };
        }
      }),
    (err) => {
      assert.match(err.message, /422/);
      assert.match(err.message, /충돌|유효성/);
      return true;
    }
  );

  await assert.rejects(
    () =>
      publishToGitHub({
        owner: "yoon",
        repo: "portfolio",
        token: "tok",
        config: {},
        apps: [],
        fetchImpl: async () => ({
          ok: false,
          status: 403,
          json: async () => ({ message: "Resource not accessible by personal access token" })
        })
      }),
    (err) => {
      assert.match(err.message, /403/);
      assert.match(err.message, /권한/);
      return true;
    }
  );

  await assert.rejects(
    () =>
      publishToGitHub({
        owner: "yoon",
        repo: "missing-repo",
        token: "tok",
        config: {},
        apps: [],
        fetchImpl: async (url, opts = {}) => {
          if (!opts.method || opts.method === "GET") {
            return { ok: false, status: 404, json: async () => ({ message: "Not Found" }) };
          }
          return { ok: false, status: 404, json: async () => ({ message: "Not Found" }) };
        }
      }),
    (err) => {
      assert.match(err.message, /404/);
      assert.match(err.message, /저장소|브랜치/);
      return true;
    }
  );
});

test("publishToGitHub supports app._pendingThumbDataUrl when pendingThumbnails map is omitted", async () => {
  const { publishToGitHub } = loadGitHubSync();
  const svgRaw = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>';
  const uploadedPaths = [];

  const result = await publishToGitHub({
    owner: "yoon",
    repo: "portfolio",
    token: "tok",
    config: { siteTitle: "윤선생 App Studio", siteSubtitle: "", ownerName: "윤선생", contactLink: "" },
    apps: [
      {
        id: "svg-app",
        title: "SVG 앱",
        tagline: "설명",
        purpose: "목적",
        audience: "대상",
        description: ["안내"],
        launchType: "external",
        url: "https://example.com",
        embedMode: "newTab",
        _pendingThumbDataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgRaw)}`
      }
    ],
    fetchImpl: async (url, opts = {}) => {
      const method = (opts.method || "GET").toUpperCase();
      if (method === "GET") {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      uploadedPaths.push(url);
      return {
        ok: true,
        status: 201,
        json: async () => ({ commit: { sha: "sha-svg", html_url: "https://github.com/yoon/portfolio/commit/sha-svg" } })
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.updatedApps[0].thumbnail, "./assets/thumbnails/svg-app.svg");
  assert.equal(uploadedPaths.length, 2);
  assert.match(uploadedPaths[0], /\/contents\/assets\/thumbnails\/svg-app\.svg$/);
  assert.match(uploadedPaths[1], /\/contents\/data\/apps\.js$/);
});

test("publishToGitHub rejects uppercase app IDs when uploading pending thumbnails", async () => {
  const { publishToGitHub } = loadGitHubSync();
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  let fetchCalled = false;

  await assert.rejects(
    () =>
      publishToGitHub({
        owner: "yoon",
        repo: "portfolio",
        token: "tok",
        config: {},
        apps: [
          {
            id: "My-App",
            title: "대문자 ID 앱",
            tagline: "설명",
            purpose: "목적",
            audience: "대상",
            description: ["안내"],
            launchType: "external",
            url: "https://example.com",
            embedMode: "newTab"
          }
        ],
        pendingThumbnails: {
          "My-App": `data:image/png;base64,${pngBase64}`
        },
        fetchImpl: async () => {
          fetchCalled = true;
          return { ok: true, status: 200, json: async () => ({}) };
        }
      }),
    /영문 소문자·숫자·하이픈/
  );
  assert.equal(fetchCalled, false);
});
