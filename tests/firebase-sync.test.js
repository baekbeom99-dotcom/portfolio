const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    }
  };
}

function loadFirebaseModule(options = {}) {
  const localStorage = options.localStorage || createMemoryStorage();
  const sandbox = {
    window: {
      localStorage,
      fetch: options.fetchImpl
    },
    localStorage,
    fetch: options.fetchImpl
  };
  sandbox.window.window = sandbox.window;
  if (options.loadGitHubSync) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js", "github-sync.js"), "utf8"), sandbox);
  }
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js", "firebase-sync.js"), "utf8"), sandbox);
  return {
    PortfolioFirebase: sandbox.window.PortfolioFirebase,
    localStorage
  };
}

test("loadCatalog normalizes Firebase array and object collections and strips transient keys", async () => {
  const { PortfolioFirebase } = loadFirebaseModule({
    loadGitHubSync: true,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        config: { siteTitle: "사부작스쿨", ownerName: "사부자기 윤선생" },
        apps: {
          "0": {
            id: "math-app",
            title: "수학 앱",
            tagline: "설명",
            purpose: "목적",
            audience: "초등",
            description: ["하나"],
            launchType: "external",
            url: "https://example.com/math",
            embedMode: "newTab",
            _pendingThumbDataUrl: "should-strip"
          }
        },
        updatedAt: "2026-11-20T02:30:00.000Z"
      })
    })
  });

  const catalog = await PortfolioFirebase.loadCatalog();
  assert.equal(catalog.config.siteTitle, "사부작스쿨");
  assert.equal(catalog.apps.length, 1);
  assert.equal(catalog.apps[0].id, "math-app");
  assert.equal(catalog.apps[0]._pendingThumbDataUrl, undefined);
});

test("loadStats, incrementSiteView, and incrementAppView use atomic RTDB increment and guard invalid IDs", async () => {
  const calls = [];
  const { PortfolioFirebase } = loadFirebaseModule({
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, method: init.method || "GET", body: init.body });
      if (url.endsWith("/stats.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ totalViews: 14, appViews: { "gimkit-style": 5 } })
        };
      }
      if (url.endsWith("/stats/totalViews.json")) {
        return { ok: true, status: 200, json: async () => 15 };
      }
      if (url.endsWith("/stats/appViews/gimkit-style.json")) {
        return { ok: true, status: 200, json: async () => 6 };
      }
      return { ok: false, status: 404 };
    }
  });

  const stats = await PortfolioFirebase.loadStats();
  assert.equal(stats.totalViews, 14);
  assert.equal(stats.appViews["gimkit-style"], 5);

  const nextSite = await PortfolioFirebase.incrementSiteView();
  assert.equal(nextSite, 15);
  assert.deepEqual(JSON.parse(calls[1].body), { ".sv": { increment: 1 } });

  const nextApp = await PortfolioFirebase.incrementAppView("gimkit-style");
  assert.equal(nextApp, 6);
  assert.deepEqual(JSON.parse(calls[2].body), { ".sv": { increment: 1 } });

  const invalid = await PortfolioFirebase.incrementAppView("../bad/id");
  assert.equal(invalid, null);
  assert.equal(calls.length, 3);
});

test("signInWithPassword persists session, refreshes expired token, and translates Firebase errors", async () => {
  let tokenCallCount = 0;
  const { PortfolioFirebase, localStorage } = loadFirebaseModule({
    fetchImpl: async (url, init = {}) => {
      if (url.includes("accounts:signInWithPassword")) {
        const parsed = JSON.parse(init.body);
        if (parsed.password === "wrong") {
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: { message: "INVALID_LOGIN_CREDENTIALS" } })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            email: "admin@sabujaak.school",
            localId: "uid-admin-1",
            idToken: "token-initial",
            refreshToken: "refresh-1",
            expiresIn: "3600"
          })
        };
      }
      if (url.includes("securetoken.googleapis.com/v1/token")) {
        tokenCallCount += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id_token: "token-refreshed",
            refresh_token: "refresh-2",
            expires_in: "3600",
            user_id: "uid-admin-1"
          })
        };
      }
      return { ok: false, status: 404 };
    }
  });

  await assert.rejects(
    () => PortfolioFirebase.signInWithPassword("admin@sabujaak.school", "wrong"),
    /이메일 또는 비밀번호가 올바르지 않습니다/
  );

  const session = await PortfolioFirebase.signInWithPassword("admin@sabujaak.school", "secret123");
  assert.equal(session.idToken, "token-initial");
  assert.equal(PortfolioFirebase.getStoredAuth().email, "admin@sabujaak.school");

  const validToken = await PortfolioFirebase.getValidIdToken();
  assert.equal(validToken, "token-initial");
  assert.equal(tokenCallCount, 0);

  // Simulate near-expiry to trigger refresh flow
  const refreshedToken = await PortfolioFirebase.getValidIdToken({ now: Date.now() + 3590 * 1000 });
  assert.equal(refreshedToken, "token-refreshed");
  assert.equal(tokenCallCount, 1);

  PortfolioFirebase.signOut();
  assert.equal(PortfolioFirebase.getStoredAuth(), null);
  assert.equal(localStorage.getItem(PortfolioFirebase.AUTH_STORAGE_KEY), null);
});

test("publishCatalogToFirebase merges remote additions, excludes deletedIds, and promotes uploaded thumbnail", async () => {
  const requests = [];
  const localStorage = createMemoryStorage();
  localStorage.setItem("ys_portfolio_firebase_auth", JSON.stringify({
    email: "admin@sabujaak.school",
    uid: "uid-admin-1",
    idToken: "id-tok-123",
    refreshToken: "ref-1",
    expiresAt: Date.now() + 3600 * 1000
  }));

  const { PortfolioFirebase } = loadFirebaseModule({
    localStorage,
    loadGitHubSync: true,
    fetchImpl: async (url, init = {}) => {
      requests.push({ url, method: init.method || "GET", body: init.body });
      if ((init.method || "GET") === "GET" && url.endsWith("/portfolio.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            apps: [
              { id: "remote-kept", title: "원격 앱", tagline: "t", purpose: "p", audience: "a", description: ["d"], launchType: "external", url: "https://example.com/r", embedMode: "newTab" },
              { id: "remote-deleted", title: "삭제될 앱", tagline: "t", purpose: "p", audience: "a", description: ["d"], launchType: "external", url: "https://example.com/d", embedMode: "newTab" }
            ]
          })
        };
      }
      if (init.method === "PUT" && url.includes("/portfolio.json?auth=id-tok-123")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return { ok: false, status: 403 };
    }
  });

  const result = await PortfolioFirebase.publishCatalogToFirebase({
    config: { siteTitle: "사부작스쿨" },
    apps: [
      {
        id: "new-app",
        title: "새 앱",
        tagline: "요약",
        purpose: "목적",
        audience: "대상",
        description: ["사용법"],
        thumbnail: "",
        _pendingThumbDataUrl: "data:image/png;base64,AAAA",
        launchType: "external",
        url: "https://example.com/new",
        embedMode: "newTab",
        tags: ["교육"]
      }
    ],
    deletedIds: ["remote-deleted"]
  });

  assert.deepEqual(
    Array.from(result.updatedApps, (a) => a.id),
    ["new-app", "remote-kept"]
  );
  assert.equal(result.updatedApps[0].thumbnail, "data:image/png;base64,AAAA");
  assert.equal(result.updatedApps[0]._pendingThumbDataUrl, undefined);

  const putCall = requests.find((r) => r.method === "PUT");
  assert.ok(putCall);
  const putBody = JSON.parse(putCall.body);
  assert.equal(putBody.apps.length, 2);
});

test("renderHeader, renderAppGrid, and renderDetailModal render view counts when provided", () => {
  const docSandbox = {
    window: {},
    document: null
  };
  const createEl = (tag) => {
    const attrs = Object.create(null);
    const listeners = Object.create(null);
    const children = [];
    let text = "";
    const node = {
      tagName: String(tag).toUpperCase(),
      children,
      attrs,
      className: "",
      hidden: false,
      style: {},
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return attrs[k] || null; },
      appendChild(c) { children.push(c); return c; },
      addEventListener(e, fn) { (listeners[e] = listeners[e] || []).push(fn); },
      get textContent() {
        return text + children.map((c) => c.textContent).join("");
      },
      set textContent(v) {
        text = String(v);
        children.length = 0;
      }
    };
    return node;
  };
  docSandbox.document = {
    createElement: createEl,
    createTextNode(t) { return { textContent: String(t), children: [] }; }
  };
  docSandbox.window.document = docSandbox.document;
  docSandbox.window.window = docSandbox.window;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8"), docSandbox);
  const { renderHeader, renderAppGrid, renderDetailModal } = docSandbox.window.PortfolioRender;

  const headerRoot = createEl("header");
  renderHeader(
    headerRoot,
    { siteTitle: "사부작스쿨", ownerName: "사부자기 윤선생" },
    { totalCount: 1, embeddedCount: 0, externalCount: 1, totalViews: 1234 }
  );
  assert.ok(headerRoot.textContent.includes("총 조회수"));
  assert.ok(headerRoot.textContent.includes("1,234"));

  const sampleApp = {
    id: "math-quiz",
    title: "수학 퀴즈",
    tagline: "설명",
    purpose: "목적",
    audience: "초등",
    description: ["사용법"],
    launchType: "external",
    url: "https://example.com",
    embedMode: "newTab",
    tags: ["수학"]
  };
  const gridRoot = createEl("div");
  renderAppGrid(gridRoot, [sampleApp], { apps: [sampleApp] }, {
    appViews: { "math-quiz": 42 }
  });
  assert.ok(gridRoot.textContent.includes("조회 42"));

  const modalRoot = createEl("div");
  renderDetailModal(modalRoot, sampleApp, { viewCount: 42 });
  assert.ok(modalRoot.textContent.includes("조회 42"));
});

test("initAdmin renders total and per-app visitor stats dashboard and refreshes live from Firebase", async () => {
  const localStorage = createMemoryStorage();
  const sessionStorage = createMemoryStorage();
  let statsLoadCount = 0;

  const elementsById = new Map();
  const createEl = (tag) => {
    const attrs = Object.create(null);
    const listeners = Object.create(null);
    const children = [];
    let className = "";
    let text = "";
    const node = {
      tagName: String(tag).toUpperCase(),
      children,
      attrs,
      hidden: false,
      disabled: false,
      checked: false,
      files: [],
      style: {},
      dataset: Object.create(null),
      value: "",
      setAttribute(k, v) {
        attrs[k] = String(v);
        if (k === "id") elementsById.set(String(v), node);
      },
      getAttribute(k) { return attrs[k] || null; },
      get id() { return attrs.id || ""; },
      set id(v) { attrs.id = String(v); elementsById.set(String(v), node); },
      get className() { return className; },
      set className(v) { className = String(v); },
      appendChild(c) { children.push(c); return c; },
      replaceChildren(...nodes) { children.length = 0; children.push(...nodes); },
      addEventListener(e, fn) { (listeners[e] = listeners[e] || []).push(fn); },
      dispatchEvent(evt) {
        for (const fn of listeners[evt.type] || []) fn(evt);
      },
      click() { node.dispatchEvent({ type: "click", target: node }); },
      focus() {},
      select() {},
      querySelector(sel) {
        const queue = [...children];
        while (queue.length > 0) {
          const cur = queue.shift();
          if (sel.startsWith("#") && cur.id === sel.slice(1)) return cur;
          if (sel.startsWith(".") && cur.className.split(/\s+/).includes(sel.slice(1))) return cur;
          if (cur.children) queue.push(...cur.children);
        }
        return null;
      },
      get textContent() {
        return text + children.map((c) => c.textContent).join("");
      },
      set textContent(v) {
        text = String(v);
        children.length = 0;
      }
    };
    return node;
  };

  const modalEl = createEl("div");
  modalEl.hidden = true;
  const doc = {
    body: createEl("body"),
    activeElement: null,
    createElement: createEl,
    createTextNode(t) { return { textContent: String(t), children: [] }; }
  };

  const sandbox = {
    window: {
      document: doc,
      localStorage,
      sessionStorage,
      location: { href: "https://baekbeom99-dotcom.github.io/portfolio/", origin: "https://baekbeom99-dotcom.github.io" },
      fetch: async (url) => {
        if (String(url).endsWith("/stats.json")) {
          statsLoadCount += 1;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              totalViews: statsLoadCount === 1 ? 15 : 22,
              appViews: { "app-a": 3, "app-b": statsLoadCount === 1 ? 8 : 12 }
            })
          };
        }
        return { ok: false, status: 404 };
      }
    },
    document: doc,
    localStorage,
    sessionStorage,
    setTimeout,
    clearTimeout,
    AbortController
  };
  sandbox.window.window = sandbox.window;
  sandbox.fetch = sandbox.window.fetch;

  for (const rel of ["js/state.js", "js/render.js", "js/recommender.js", "js/github-sync.js", "js/firebase-sync.js", "js/admin.js"]) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), sandbox);
  }

  let latestCallbackStats = null;
  const controller = sandbox.window.PortfolioAdmin.initAdmin({
    modalEl,
    getApps: () => [
      { id: "app-a", title: "첫 번째 앱", launchType: "external", url: "https://example.com/a", createdAt: "2026-11-16" },
      { id: "app-b", title: "두 번째 앱", launchType: "external", url: "https://example.com/b", createdAt: "2026-11-20" }
    ],
    getConfig: () => ({ siteTitle: "사부작스쿨" }),
    getStats: () => ({ totalViews: 10, appViews: { "app-a": 2, "app-b": 5 } }),
    onStatsLoaded: (s) => { latestCallbackStats = s; }
  });

  sessionStorage.setItem("ys_portfolio_admin_unlocked", "true");
  // Re-init after unlocking session flag so renderAdminPanel opens directly
  const unlockedCtrl = sandbox.window.PortfolioAdmin.initAdmin({
    modalEl,
    getApps: () => [
      { id: "app-a", title: "첫 번째 앱", launchType: "external", url: "https://example.com/a", createdAt: "2026-11-16" },
      { id: "app-b", title: "두 번째 앱", launchType: "external", url: "https://example.com/b", createdAt: "2026-11-20" }
    ],
    getConfig: () => ({ siteTitle: "사부작스쿨" }),
    getStats: () => ({ totalViews: 10, appViews: { "app-a": 2, "app-b": 5 } }),
    onStatsLoaded: (s) => { latestCallbackStats = s; }
  });

  unlockedCtrl.open();
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(elementsById.get("admin-total-views").textContent, "15회");
  assert.equal(elementsById.get("admin-total-app-views").textContent, "11회");
  assert.equal(elementsById.get("admin-total-apps-count").textContent, "2개");
  assert.equal(latestCallbackStats.totalViews, 15);

  const listEl = elementsById.get("admin-app-stats-list");
  assert.equal(listEl.children[0].getAttribute("data-app-id"), "app-b");
  assert.equal(listEl.children[1].getAttribute("data-app-id"), "app-a");

  elementsById.get("admin-refresh-stats-btn").click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(elementsById.get("admin-total-views").textContent, "22회");
  assert.equal(elementsById.get("admin-total-app-views").textContent, "15회");
  controller.close();
});

test("database.rules.json defines public read/create and admin moderation rules for /board", () => {
  const rulesPath = path.join(ROOT, "database.rules.json");
  const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  assert.ok(rules.rules.board, "Missing /board rules");
  assert.equal(rules.rules.board[".read"], true);
  assert.ok(rules.rules.board.$postId && typeof rules.rules.board.$postId[".write"] === "string");
  assert.match(rules.rules.board.$postId[".write"], /zNS57lhTOXMCDrbBwhAV2US5i0w1/);
  assert.match(rules.rules.board.$postId[".write"], /!data\.exists\(\)/);
  assert.match(rules.rules.board.$postId[".write"], /!newData\.child\('reply'\)\.exists\(\)/);
});

test("normalizeBoardPosts normalizes entries, defaults empty author to 익명, and sorts newest-first", () => {
  const { PortfolioFirebase } = loadFirebaseModule();
  assert.equal(typeof PortfolioFirebase.normalizeBoardPosts, "function");

  assert.deepEqual(Array.from(PortfolioFirebase.normalizeBoardPosts(null)), []);
  const posts = PortfolioFirebase.normalizeBoardPosts({
    "-O1": { author: "  ", content: "  첫 번째 건의입니다  ", createdAt: 1000 },
    "-O2": { author: "김선생", content: "두 번째 요청입니다", createdAt: 3000, reply: "확인했습니다", replyAt: 3500 },
    "-O3": { author: "학생", content: "같은 시각 글", createdAt: 3000 },
    "-O_invalid": { author: "빈글", content: "", createdAt: 4000 }
  });

  assert.deepEqual(
    Array.from(posts, (p) => p.id),
    ["-O3", "-O2", "-O1"]
  );
  assert.equal(posts[2].author, "익명");
  assert.equal(posts[2].content, "첫 번째 건의입니다");
  assert.equal(posts[1].reply, "확인했습니다");
  assert.equal(posts[1].replyAt, 3500);
});

test("loadBoardPosts and createBoardPost validate inputs and persist to /board.json", async () => {
  const requests = [];
  const { PortfolioFirebase } = loadFirebaseModule({
    fetchImpl: async (url, init = {}) => {
      requests.push({ url, method: init.method || "GET", body: init.body || null });
      if (url.endsWith("/board.json") && (!init.method || init.method === "GET")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            "-O10": { author: "학부모", content: "모바일에서도 잘 돼요", createdAt: 1764340000000 }
          })
        };
      }
      if (url.endsWith("/board.json") && init.method === "POST") {
        return { ok: true, status: 200, json: async () => ({ name: "-O11" }) };
      }
      return { ok: false, status: 404 };
    }
  });

  const loaded = await PortfolioFirebase.loadBoardPosts();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, "-O10");

  await assert.rejects(() => PortfolioFirebase.createBoardPost({ author: "홍", content: "짧" }), /2자 이상/);
  await assert.rejects(
    () => PortfolioFirebase.createBoardPost({ author: "홍", content: "가".repeat(1001) }),
    /1000자 이하/
  );

  const created = await PortfolioFirebase.createBoardPost({
    author: "  ",
    content: "  구구단 앱 소리 끄기 버튼 추가해주세요  "
  });
  assert.equal(created.id, "-O11");
  assert.equal(created.author, "익명");
  assert.equal(created.content, "구구단 앱 소리 끄기 버튼 추가해주세요");
  assert.equal(typeof created.createdAt, "number");

  const postCall = requests.find((r) => r.method === "POST");
  assert.ok(postCall);
  const sentPayload = JSON.parse(postCall.body);
  assert.equal(sentPayload.author, "익명");
  assert.equal(sentPayload.reply, undefined);
});

test("replyBoardPost and deleteBoardPost require auth token, validate IDs, and handle 401/403", async () => {
  const localStorage = createMemoryStorage();
  const requests = [];
  let forceUnauthorized = false;

  localStorage.setItem(
    "ys_portfolio_firebase_auth",
    JSON.stringify({
      email: "admin@example.com",
      uid: "zNS57lhTOXMCDrbBwhAV2US5i0w1",
      idToken: "token-ok",
      refreshToken: "ref-1",
      expiresAt: Date.now() + 3600 * 1000
    })
  );

  const { PortfolioFirebase } = loadFirebaseModule({
    localStorage,
    fetchImpl: async (url, init = {}) => {
      requests.push({ url, method: init.method || "GET", body: init.body || null });
      if (forceUnauthorized) {
        return { ok: false, status: 403 };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }
  });

  await assert.rejects(() => PortfolioFirebase.deleteBoardPost("bad/id"), /게시글 ID/);
  await assert.rejects(() => PortfolioFirebase.replyBoardPost("-O10", "   "), /답변 내용/);

  const replied = await PortfolioFirebase.replyBoardPost("-O10", "반영 완료했습니다!");
  assert.equal(replied.id, "-O10");
  assert.equal(replied.reply, "반영 완료했습니다!");
  assert.equal(typeof replied.replyAt, "number");
  assert.equal(requests[0].method, "PATCH");
  assert.match(requests[0].url, /\/board\/-O10\.json\?auth=token-ok$/);

  const deleted = await PortfolioFirebase.deleteBoardPost("-O10");
  assert.equal(deleted, true);
  assert.equal(requests[1].method, "DELETE");
  assert.match(requests[1].url, /\/board\/-O10\.json\?auth=token-ok$/);

  forceUnauthorized = true;
  await assert.rejects(() => PortfolioFirebase.deleteBoardPost("-O10"), /로그인/);
  assert.equal(localStorage.getItem("ys_portfolio_firebase_auth"), null);
});
