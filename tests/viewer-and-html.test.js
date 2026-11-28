const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function createFakeDom() {
  const elementsById = new Map();

  function createElement(tagName) {
    const upperTag = String(tagName).toUpperCase();
    const attrs = Object.create(null);
    const children = [];
    let classNameValue = "";
    let textValue = "";
    let srcSetCount = 0;

    const element = {
      nodeType: 1,
      tagName: upperTag,
      parentNode: null,
      children,
      hidden: false,
      style: {},
      value: "",
      dataset: Object.create(null),
      get className() {
        return classNameValue;
      },
      set className(val) {
        classNameValue = val == null ? "" : String(val);
        attrs.class = classNameValue;
      },
      classList: {
        add(...tokens) {
          const set = new Set(classNameValue.split(/\s+/).filter(Boolean));
          for (const token of tokens) {
            if (token) set.add(token);
          }
          classNameValue = Array.from(set).join(" ");
          attrs.class = classNameValue;
        },
        remove(...tokens) {
          const set = new Set(classNameValue.split(/\s+/).filter(Boolean));
          for (const token of tokens) {
            set.delete(token);
          }
          classNameValue = Array.from(set).join(" ");
          attrs.class = classNameValue;
        },
        toggle(token, force) {
          const has = this.contains(token);
          const shouldAdd = force !== undefined ? Boolean(force) : !has;
          if (shouldAdd) {
            this.add(token);
          } else {
            this.remove(token);
          }
          return shouldAdd;
        },
        contains(token) {
          return classNameValue.split(/\s+/).filter(Boolean).includes(token);
        }
      },
      get id() {
        return attrs.id || "";
      },
      set id(val) {
        attrs.id = String(val);
        if (attrs.id) {
          elementsById.set(attrs.id, element);
        }
      },
      get src() {
        return attrs.src || "";
      },
      set src(val) {
        srcSetCount += 1;
        attrs.src = String(val);
      },
      get srcSetCount() {
        return srcSetCount;
      },
      get title() {
        return attrs.title || "";
      },
      set title(val) {
        if (val === null || val === undefined || val === "") {
          delete attrs.title;
        } else {
          attrs.title = String(val);
        }
      },
      get href() {
        return attrs.href || "";
      },
      set href(val) {
        attrs.href = String(val);
      },
      get target() {
        return attrs.target || "";
      },
      set target(val) {
        attrs.target = String(val);
      },
      get rel() {
        return attrs.rel || "";
      },
      set rel(val) {
        attrs.rel = String(val);
      },
      get textContent() {
        return textValue;
      },
      set textContent(val) {
        textValue = val == null ? "" : String(val);
      },
      setAttribute(name, value) {
        const key = String(name);
        const val = String(value);
        attrs[key] = val;
        if (key === "id") {
          elementsById.set(val, element);
        } else if (key === "class") {
          classNameValue = val;
        }
      },
      getAttribute(name) {
        const key = String(name);
        return Object.prototype.hasOwnProperty.call(attrs, key) ? attrs[key] : null;
      },
      removeAttribute(name) {
        delete attrs[String(name)];
      },
      appendChild(child) {
        if (child.parentNode) {
          child.parentNode.removeChild(child);
        }
        child.parentNode = element;
        children.push(child);
        return child;
      },
      removeChild(child) {
        const idx = children.indexOf(child);
        if (idx !== -1) {
          children.splice(idx, 1);
          child.parentNode = null;
        }
        return child;
      },
      querySelector(selector) {
        const matchesSelector = (node) => {
          if (selector.startsWith("#")) {
            return node.id === selector.slice(1);
          }
          if (selector.startsWith(".")) {
            return node.classList.contains(selector.slice(1));
          }
          return false;
        };
        const queue = [...children];
        while (queue.length > 0) {
          const curr = queue.shift();
          if (matchesSelector(curr)) {
            return curr;
          }
          queue.push(...curr.children);
        }
        return null;
      },
      focus() {},
      select() {},
      setSelectionRange() {}
    };

    return element;
  }

  const body = createElement("body");
  const doc = {
    body,
    createElement,
    getElementById(id) {
      return elementsById.get(id) || null;
    },
    execCommand: null
  };

  return doc;
}

function buildOverlayDom(doc) {
  const overlay = doc.createElement("div");
  overlay.id = "viewer-overlay";
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");

  const titleEl = doc.createElement("h2");
  titleEl.id = "viewer-app-title";

  const externalLink = doc.createElement("a");
  externalLink.id = "viewer-open-external";

  const desktopBtn = doc.createElement("button");
  desktopBtn.id = "viewer-device-desktop";
  desktopBtn.setAttribute("aria-pressed", "true");

  const mobileBtn = doc.createElement("button");
  mobileBtn.id = "viewer-device-mobile";
  mobileBtn.setAttribute("aria-pressed", "false");

  const stageEl = doc.createElement("div");
  stageEl.id = "viewer-stage";
  stageEl.className = "viewer-frame-stage";

  const iframeEl = doc.createElement("iframe");
  iframeEl.id = "viewer-iframe";
  iframeEl.src = "about:blank";

  stageEl.appendChild(iframeEl);
  overlay.appendChild(titleEl);
  overlay.appendChild(externalLink);
  overlay.appendChild(desktopBtn);
  overlay.appendChild(mobileBtn);
  overlay.appendChild(stageEl);

  return {
    overlay,
    titleEl,
    externalLink,
    desktopBtn,
    mobileBtn,
    stageEl,
    iframeEl
  };
}

function loadViewerModule(doc, navigatorMock) {
  const code = fs.readFileSync(path.join(ROOT, "js", "viewer.js"), "utf8");
  const sandbox = {
    window: {},
    document: doc,
    navigator: navigatorMock || {}
  };
  sandbox.window.document = doc;
  sandbox.window.navigator = sandbox.navigator;
  vm.runInNewContext(code, sandbox);
  return sandbox.window.PortfolioViewer;
}

test("PortfolioViewer.mountViewer mounts safe URLs, updates device state, avoids redundant reloads, and rejects unsafe URLs", () => {
  const doc = createFakeDom();
  const Viewer = loadViewerModule(doc);
  const dom = buildOverlayDom(doc);

  const localResult = Viewer.mountViewer(
    dom.overlay,
    { id: "sample", title: "25분 집중 타이머", url: "./apps/sample-app/index.html" },
    "desktop"
  );
  assert.equal(localResult, true);
  assert.equal(dom.overlay.hidden, false);
  assert.equal(dom.overlay.getAttribute("aria-hidden"), "false");
  assert.equal(dom.titleEl.textContent, "25분 집중 타이머");
  assert.equal(dom.externalLink.href, "./apps/sample-app/index.html");
  assert.equal(dom.iframeEl.src, "./apps/sample-app/index.html");
  assert.equal(dom.iframeEl.title, "25분 집중 타이머 실행 화면");
  assert.equal(dom.stageEl.classList.contains("is-mobile"), false);
  assert.equal(dom.desktopBtn.getAttribute("aria-pressed"), "true");
  assert.equal(dom.mobileBtn.getAttribute("aria-pressed"), "false");
  const setsAfterInitialMount = dom.iframeEl.srcSetCount;

  // Toggling to mobile with same app should apply .is-mobile and NOT reload iframe
  const mobileToggleResult = Viewer.mountViewer(
    dom.overlay,
    { id: "sample", title: "25분 집중 타이머", url: "./apps/sample-app/index.html" },
    "mobile"
  );
  assert.equal(mobileToggleResult, true);
  assert.equal(dom.stageEl.classList.contains("is-mobile"), true);
  assert.equal(dom.desktopBtn.getAttribute("aria-pressed"), "false");
  assert.equal(dom.mobileBtn.getAttribute("aria-pressed"), "true");
  assert.equal(dom.iframeEl.srcSetCount, setsAfterInitialMount, "Same src must not reload iframe");

  // External https:// URL is allowed
  const httpsResult = Viewer.mountViewer(
    dom.overlay,
    { id: "ext", title: "외부 앱", url: "https://example.com/demo/" },
    "desktop"
  );
  assert.equal(httpsResult, true);
  assert.equal(dom.iframeEl.src, "https://example.com/demo/");
  assert.equal(dom.externalLink.href, "https://example.com/demo/");
  assert.equal(dom.stageEl.classList.contains("is-mobile"), false);

  // Unsafe javascript: URL is rejected and unmounts viewer
  const unsafeJs = Viewer.mountViewer(
    dom.overlay,
    { id: "bad", title: "XSS", url: "javascript:alert(1)" },
    "desktop"
  );
  assert.equal(unsafeJs, false);
  assert.equal(dom.overlay.hidden, true);
  assert.equal(dom.overlay.getAttribute("aria-hidden"), "true");
  assert.equal(dom.iframeEl.src, "about:blank");

  // Unsafe data: URL is rejected
  const unsafeData = Viewer.mountViewer(
    dom.overlay,
    { id: "bad2", title: "Data", url: "data:text/html,<script>alert(1)</script>" },
    "desktop"
  );
  assert.equal(unsafeData, false);
  assert.equal(dom.overlay.hidden, true);

  // Null app is rejected
  assert.equal(Viewer.mountViewer(dom.overlay, null, "desktop"), false);
});

test("PortfolioViewer.unmountViewer resets iframe.src to about:blank, clears title, and hides overlay", () => {
  const doc = createFakeDom();
  const Viewer = loadViewerModule(doc);
  const dom = buildOverlayDom(doc);

  Viewer.mountViewer(
    dom.overlay,
    { id: "sample", title: "샘플 앱", url: "./apps/sample-app/index.html" },
    "mobile"
  );
  assert.equal(dom.overlay.hidden, false);

  Viewer.unmountViewer(dom.overlay);
  assert.equal(dom.iframeEl.src, "about:blank");
  assert.equal(dom.iframeEl.getAttribute("title"), null);
  assert.equal(dom.titleEl.textContent, "");
  assert.equal(dom.externalLink.getAttribute("href"), null);
  assert.equal(dom.overlay.hidden, true);
  assert.equal(dom.overlay.getAttribute("aria-hidden"), "true");
});

test("PortfolioViewer.copyShareLink uses navigator.clipboard and falls back to execCommand when unavailable", async () => {
  const doc1 = createFakeDom();
  const copiedTexts = [];
  const ViewerWithClipboard = loadViewerModule(doc1, {
    clipboard: {
      writeText(text) {
        copiedTexts.push(text);
        return Promise.resolve();
      }
    }
  });

  let callbackResult = null;
  await ViewerWithClipboard.copyShareLink("https://example.com/#app=demo", (ok) => {
    callbackResult = ok;
  });
  assert.deepEqual(copiedTexts, ["https://example.com/#app=demo"]);
  assert.equal(callbackResult, true);

  // Fallback path when navigator.clipboard is unavailable (e.g., file://)
  const doc2 = createFakeDom();
  const execCalls = [];
  doc2.execCommand = (cmd) => {
    execCalls.push(cmd);
    return true;
  };
  const ViewerFallback = loadViewerModule(doc2, {});

  let fallbackResult = null;
  await ViewerFallback.copyShareLink("file:///C:/portfolio/index.html#app=demo", (ok) => {
    fallbackResult = ok;
  });
  assert.deepEqual(execCalls, ["copy"]);
  assert.equal(fallbackResult, true);
  assert.equal(doc2.body.children.length, 0, "Temporary textarea must be removed after copy");

  // Failure path when both clipboard and execCommand fail
  const doc3 = createFakeDom();
  doc3.execCommand = () => false;
  const ViewerFail = loadViewerModule(doc3, {});
  let failResult = null;
  await ViewerFail.copyShareLink("https://example.com/#app=demo", (ok) => {
    failResult = ok;
  });
  assert.equal(failResult, false);
});

test("index.html declares relative scripts in strict dependency order, zero ES modules, zero root-absolute paths, and required containers", () => {
  const htmlPath = path.join(ROOT, "index.html");
  assert.equal(fs.existsSync(htmlPath), true, "index.html must exist");
  const html = fs.readFileSync(htmlPath, "utf8");

  assert.equal(/<script[^>]+type=["']module["']/i.test(html), false, "Must not use <script type='module'>");
  assert.equal(
    /(href|src)=["']\/(css|js|data|assets|apps)\//i.test(html),
    false,
    "Must not use root-absolute asset paths"
  );

  assert.match(html, /href=["']\.\/css\/styles\.css["']/);

  const scriptOrder = [
    "./data/apps.js",
    "./js/state.js",
    "./js/render.js",
    "./js/viewer.js",
    "./js/recommender.js",
    "./js/github-sync.js",
    "./js/admin.js",
    "./js/board.js",
    "./js/app.js"
  ];
  let lastIndex = -1;
  for (const scriptSrc of scriptOrder) {
    const escaped = scriptSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`<script\\s+defer\\s+src=["']${escaped}["']`, "i");
    const match = regex.exec(html);
    assert.ok(match, `Missing <script defer src="${scriptSrc}">`);
    assert.ok(match.index > lastIndex, `Script out of order: ${scriptSrc}`);
    lastIndex = match.index;
  }

  assert.match(html, /<title>사부작스쿨<\/title>/);
  assert.match(html, /<meta\s+name=["']description["']\s+content=["']교육용 및 일상생활을 위한 웹앱 공유 플랫폼["']/);
  assert.match(html, /<meta\s+property=["']og:title["']\s+content=["']사부작스쿨["']/);
  assert.match(html, /<meta\s+property=["']og:description["']\s+content=["']교육용 및 일상생활을 위한 웹앱 공유 플랫폼["']/);

  for (const requiredId of [
    "site-header",
    "draft-banner",
    "search-input",
    "tag-filters",
    "app-grid",
    "feedback-board",
    "detail-modal",
    "admin-modal",
    "viewer-overlay",
    "viewer-iframe",
    "toast"
  ]) {
    assert.match(html, new RegExp(`id=["']${requiredId}["']`), `Missing #${requiredId}`);
  }
  assert.match(html, /data-launch-filter=["']all["']/);

  const draftIdx = html.indexOf('id="draft-banner"');
  const controlsIdx = html.indexOf('class="controls-bar"');
  assert.ok(draftIdx !== -1 && controlsIdx !== -1 && draftIdx < controlsIdx, "#draft-banner must appear above .controls-bar");

  const detailIdx = html.indexOf('id="detail-modal"');
  const adminIdx = html.indexOf('id="admin-modal"');
  assert.ok(detailIdx !== -1 && adminIdx !== -1 && adminIdx > detailIdx, "#admin-modal must appear after #detail-modal");

  const viewerOverlayMatch = /<div[^>]*id=["']viewer-overlay["'][\s\S]*?<div[^>]*id=["']toast["']/i.exec(html);
  assert.ok(viewerOverlayMatch, "Missing #viewer-overlay section");
  assert.ok(
    viewerOverlayMatch[0].includes("화면이 표시되지 않으면 '새 탭으로 열기'를 눌러주세요"),
    "#viewer-overlay must contain blocked-iframe external open hint"
  );

  const iframeMatch = /<iframe[^>]*id=["']viewer-iframe["'][^>]*>/i.exec(html);
  assert.ok(iframeMatch, "Missing #viewer-iframe tag");
  assert.match(iframeMatch[0], /\bloading=["']eager["']/i, "#viewer-iframe must set loading='eager'");
  assert.match(iframeMatch[0], /\bsandbox=["'][^"']*\ballow-modals\b[^"']*["']/i, "#viewer-iframe sandbox must include allow-modals");
});

test("css/styles.css exists and defines core showcase, modal, viewer, mobile preview, and reduced-motion rules", () => {
  const cssPath = path.join(ROOT, "css", "styles.css");
  assert.equal(fs.existsSync(cssPath), true, "css/styles.css must exist");
  const css = fs.readFileSync(cssPath, "utf8");

  for (const selector of [
    ".hero-top-actions",
    ".btn-admin-entry",
    ".btn-admin-lock",
    ".draft-banner",
    ".board-section",
    ".board-card-shell",
    ".board-post",
    ".board-reply-editor",
    ".admin-dialog",
    ".admin-auth-box",
    ".admin-layout",
    ".admin-app-list",
    ".admin-form",
    ".admin-rec-box",
    ".admin-thumb-preview",
    ".admin-tag-suggestions",
    ".admin-github-details",
    ".thumb-ambient-bg",
    ".is-contain-fit",
    ".app-card",
    ".modal-dialog",
    ".modal-dialog > *",
    ".viewer-overlay",
    ".viewer-hint",
    ".is-mobile",
    "@media (prefers-reduced-motion: reduce)"
  ]) {
    assert.ok(css.includes(selector), `Missing CSS rule for ${selector}`);
  }
  assert.match(css, /\.modal-dialog\s*>\s*\*[\s\S]*flex-shrink:\s*0/);
  assert.match(css, /\.thumb-ambient-bg\s*\{[^}]*max-width:\s*none/);
});

function setupPortfolioHarness(options = {}) {
  const doc = createFakeDom();
  const docListeners = Object.create(null);
  const winListeners = Object.create(null);

  const elements = {};
  const createWithId = (tag, id, extra = {}) => {
    const el = doc.createElement(tag);
    el.id = id;
    Object.assign(el, extra);
    elements[id] = el;
    return el;
  };

  function enhanceDoc(baseDoc) {
    const origCreate = baseDoc.createElement;
    baseDoc.createElement = function (tag) {
      const node = origCreate(tag);
      const listeners = Object.create(null);
      node.addEventListener = function (evt, fn) {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(fn);
      };
      node.dispatchEvent = function (evt) {
        const eventObj = evt || { type: "" };
        if (!eventObj.target) eventObj.target = node;
        if (!eventObj.preventDefault) eventObj.preventDefault = () => {};
        for (const fn of listeners[eventObj.type] || []) {
          fn(eventObj);
        }
      };
      node.click = function () {
        node.dispatchEvent({ type: "click", target: node });
      };
      node.focus = function () {
        baseDoc.activeElement = node;
      };
      node.replaceChildren = function (...nodes) {
        while (node.children.length > 0) {
          const removed = node.children.pop();
          removed.parentNode = null;
        }
        for (const n of nodes) {
          node.appendChild(n);
        }
      };
      return node;
    };
    baseDoc.createTextNode = function (text) {
      return {
        nodeType: 3,
        parentNode: null,
        textContent: String(text)
      };
    };
    baseDoc.readyState = "loading";
    baseDoc.title = "";
    baseDoc.activeElement = null;
    baseDoc.addEventListener = (evt, fn) => {
      if (!docListeners[evt]) docListeners[evt] = [];
      docListeners[evt].push(fn);
    };
    baseDoc.dispatchEvent = (evt) => {
      for (const fn of docListeners[evt.type] || []) {
        fn(evt);
      }
    };
    return baseDoc;
  }

  enhanceDoc(doc);
  doc.head = doc.createElement("head");

  const headerEl = createWithId("header", "site-header");
  const draftBannerEl = createWithId("div", "draft-banner", { hidden: true });
  const searchInput = createWithId("input", "search-input");
  const tagFiltersEl = createWithId("div", "tag-filters");
  const appsCountEl = createWithId("p", "apps-count");
  const appGridEl = createWithId("div", "app-grid");
  const feedbackBoardEl = createWithId("section", "feedback-board");
  const detailModalEl = createWithId("div", "detail-modal", { hidden: true });
  const adminModalEl = createWithId("div", "admin-modal", { hidden: true });
  const toastEl = createWithId("div", "toast", { hidden: true });

  const overlayDom = buildOverlayDom(doc);
  const viewerBackBtn = createWithId("button", "viewer-back");
  const viewerCloseBtn = createWithId("button", "viewer-close");
  const viewerCopyShareBtn = createWithId("button", "viewer-copy-share");
  overlayDom.overlay.appendChild(viewerBackBtn);
  overlayDom.overlay.appendChild(viewerCloseBtn);
  overlayDom.overlay.appendChild(viewerCopyShareBtn);

  const launchGroupEl = doc.createElement("div");
  launchGroupEl.className = "launch-filter-group";
  const launchBtns = ["all", "embedded", "external"].map((val) => {
    const btn = doc.createElement("button");
    btn.setAttribute("data-launch-filter", val);
    btn.setAttribute("aria-pressed", val === "all" ? "true" : "false");
    if (val === "all") btn.classList.add("is-active");
    launchGroupEl.appendChild(btn);
    return btn;
  });

  doc.querySelector = (selector) => {
    if (selector === ".launch-filter-group") return launchGroupEl;
    return null;
  };
  doc.querySelectorAll = (selector) => {
    if (selector === "[data-launch-filter]") return launchBtns;
    return [];
  };

  doc.body.appendChild(headerEl);
  doc.body.appendChild(draftBannerEl);
  doc.body.appendChild(searchInput);
  doc.body.appendChild(launchGroupEl);
  doc.body.appendChild(tagFiltersEl);
  doc.body.appendChild(appsCountEl);
  doc.body.appendChild(appGridEl);
  doc.body.appendChild(feedbackBoardEl);
  doc.body.appendChild(detailModalEl);
  doc.body.appendChild(adminModalEl);
  doc.body.appendChild(overlayDom.overlay);
  doc.body.appendChild(toastEl);

  const locationObj = options.location || {
    href: "https://example.github.io/portfolio/",
    hash: ""
  };
  const historyObj = options.history || {
    replaceState(_state, _title, url) {
      const idx = url.indexOf("#");
      locationObj.href = url;
      locationObj.hash = idx >= 0 ? url.slice(idx) : "";
    }
  };

  const sandbox = {
    window: {
      document: doc,
      location: locationObj,
      history: historyObj,
      navigator: { clipboard: { writeText: () => Promise.resolve() } },
      addEventListener(evt, fn) {
        if (!winListeners[evt]) winListeners[evt] = [];
        winListeners[evt].push(fn);
      }
    },
    document: doc,
    location: locationObj,
    history: historyObj,
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    setTimeout,
    clearTimeout
  };
  sandbox.window.window = sandbox.window;

  if (options.portfolioAdmin) {
    sandbox.window.PortfolioAdmin = options.portfolioAdmin;
  }
  if (options.portfolioBoard) {
    sandbox.window.PortfolioBoard = options.portfolioBoard;
  }

  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "data/apps.js"), "utf8"), sandbox);
  if (Array.isArray(options.apps)) {
    sandbox.window.PORTFOLIO_APPS = options.apps;
  }

  for (const relPath of [
    "js/state.js",
    "js/render.js",
    "js/viewer.js",
    "js/app.js"
  ]) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, relPath), "utf8"), sandbox);
  }

  const instance = sandbox.window.PortfolioApp.initPortfolio();
  return {
    sandbox,
    doc,
    winListeners,
    headerEl,
    draftBannerEl,
    searchInput,
    tagFiltersEl,
    appGridEl,
    detailModalEl,
    adminModalEl,
    overlayDom,
    viewerBackBtn,
    launchGroupEl,
    launchBtns,
    locationObj,
    instance
  };
}

const SAMPLE_APPS = [
  {
    id: "sample-focus-timer",
    title: "25분 집중 타이머",
    tagline: "간단한 포모도로 타이머",
    purpose: "집중 세션 관리",
    audience: "학생 및 직장인",
    description: ["시작 버튼을 누르세요."],
    thumbnail: "./assets/thumbnails/sample-app.svg",
    launchType: "embedded",
    url: "./apps/sample-app/index.html",
    embedMode: "iframe",
    tags: ["생산성", "타이머"],
    featured: true,
    createdAt: "2026-11-16"
  },
  {
    id: "github-deployed-example",
    title: "외부 웹앱 예시",
    tagline: "외부 링크 앱",
    purpose: "공유",
    audience: "모든 사용자",
    description: ["새 탭에서 열립니다."],
    thumbnail: "./assets/thumbnails/external-demo.svg",
    launchType: "external",
    url: "https://example.com",
    embedMode: "newTab",
    tags: ["유틸리티"],
    featured: false,
    createdAt: "2026-11-16"
  }
];

test("PortfolioApp.initPortfolio hides launch filter and tag filters on empty initial catalog and wires admin hooks", () => {
  let openCount = 0;
  let lockCount = 0;
  const {
    headerEl,
    tagFiltersEl,
    appGridEl,
    launchGroupEl
  } = setupPortfolioHarness({
    apps: [],
    portfolioAdmin: {
      isUnlocked: () => true,
      open: () => { openCount += 1; },
      lock: () => { lockCount += 1; }
    }
  });

  assert.equal(launchGroupEl.hidden, true, "Launch filter group must hide when catalog is empty");
  assert.equal(tagFiltersEl.hidden, true, "Tag filters must hide when no tags exist");
  assert.ok(appGridEl.querySelector(".is-catalog-empty"), "Catalog-empty panel should render");

  const headerAdminBtn = headerEl.querySelector("#admin-toggle-btn");
  const headerLockBtn = headerEl.querySelector("#admin-lock-btn");
  const emptyAdminBtn = appGridEl.querySelector(".btn-open-admin");
  assert.ok(headerAdminBtn);
  assert.ok(headerLockBtn);
  assert.ok(emptyAdminBtn);
  headerAdminBtn.click();
  emptyAdminBtn.click();
  headerLockBtn.click();
  assert.equal(openCount, 2);
  assert.equal(lockCount, 1);

  // Single launch type (only embedded, 0 external) also hides launch filter group
  const singleType = setupPortfolioHarness({ apps: [SAMPLE_APPS[0]] });
  assert.equal(singleType.launchGroupEl.hidden, true, "Launch filter group must hide when only 1 launch type exists");
  assert.equal(singleType.tagFiltersEl.hidden, false);
});

test("PortfolioApp.initPortfolio wires state, render, viewer, focus management, Escape order, and hashchange end-to-end", () => {
  const {
    doc,
    winListeners,
    searchInput,
    appGridEl,
    detailModalEl,
    overlayDom,
    viewerBackBtn,
    launchGroupEl,
    launchBtns,
    locationObj,
    instance
  } = setupPortfolioHarness({ apps: SAMPLE_APPS });

  assert.ok(instance && instance.store);
  assert.equal(launchGroupEl.hidden, false, "Launch filter group should be visible when both launch types exist");

  // Header & initial grid rendered from data/apps.js
  assert.ok(appGridEl.children.length >= 2);
  assert.equal(detailModalEl.hidden, true);
  assert.equal(overlayDom.overlay.hidden, true);
  const iframeSrcSetsAfterInit = overlayDom.iframeEl.srcSetCount;

  // Launch filter click narrows grid to embedded without touching closed viewer iframe
  launchBtns[1].click();
  assert.equal(launchBtns[1].getAttribute("aria-pressed"), "true");
  assert.equal(launchBtns[0].getAttribute("aria-pressed"), "false");
  assert.equal(appGridEl.children.length, 1);

  // Search input filters out and back in without unmounting closed viewer
  searchInput.value = "없는검색어";
  searchInput.dispatchEvent({ type: "input", target: searchInput });
  assert.equal(appGridEl.children[0].className, "empty-state");
  assert.equal(
    overlayDom.iframeEl.srcSetCount,
    iframeSrcSetsAfterInit,
    "Search/filter updates must not redundantly unmount closed viewer"
  );

  // Reset filters via empty state button
  const resetBtn = appGridEl.querySelector(".btn-reset-filters");
  assert.ok(resetBtn);
  resetBtn.click();
  assert.equal(searchInput.value, "");
  assert.ok(appGridEl.children.length >= 2);

  // Clicking a card moves focus into modal close button, and closing restores focus to card trigger
  const firstCardTrigger = appGridEl.querySelector(".app-card-trigger");
  assert.ok(firstCardTrigger);
  firstCardTrigger.focus();
  firstCardTrigger.click();
  assert.equal(detailModalEl.hidden, false);
  const modalCloseBtn = detailModalEl.querySelector(".modal-close");
  assert.ok(modalCloseBtn);
  assert.equal(doc.activeElement, modalCloseBtn, "Focus must move into modal close button on open");

  // Launch viewer from detail modal -> focus moves to #viewer-back
  const launchIframeBtn = detailModalEl.querySelector(".btn-primary");
  assert.ok(launchIframeBtn);
  launchIframeBtn.click();
  assert.equal(overlayDom.overlay.hidden, false);
  assert.equal(overlayDom.iframeEl.src, "./apps/sample-app/index.html");
  assert.equal(detailModalEl.hidden, true);
  assert.equal(doc.activeElement, viewerBackBtn, "Focus must move to viewer back button when mounted");

  // Toggle mobile preview in viewer -> keeps focus on mobile toggle button
  overlayDom.mobileBtn.focus();
  overlayDom.mobileBtn.click();
  assert.equal(overlayDom.stageEl.classList.contains("is-mobile"), true);
  assert.equal(doc.activeElement, overlayDom.mobileBtn, "Toggling device must not steal focus");

  // First Escape closes viewer back to detail modal, resets iframe, and returns focus to modal close button
  doc.dispatchEvent({ type: "keydown", key: "Escape", preventDefault() {} });
  assert.equal(overlayDom.overlay.hidden, true);
  assert.equal(overlayDom.iframeEl.src, "about:blank");
  assert.equal(detailModalEl.hidden, false);
  assert.equal(doc.activeElement, detailModalEl.querySelector(".modal-close"));

  // Second Escape closes detail modal, clears URL hash, and restores focus to triggering card button
  doc.dispatchEvent({ type: "keydown", key: "Escape", preventDefault() {} });
  assert.equal(detailModalEl.hidden, true);
  assert.equal(locationObj.hash, "");
  assert.equal(doc.activeElement, firstCardTrigger);

  // Open detail modal via hashchange
  locationObj.hash = "#app=sample-focus-timer";
  for (const fn of winListeners.hashchange || []) {
    fn({ type: "hashchange" });
  }
  assert.equal(detailModalEl.hidden, false);
  assert.equal(instance.store.getState().selectedAppId, "sample-focus-timer");
  assert.equal(doc.activeElement, detailModalEl.querySelector(".modal-close"));
});

test("PortfolioApp.initPortfolio opens and closes cards cleanly when history.replaceState throws SecurityError on file://", () => {
  const fileLocation = {
    href: "file:///C:/portfolio/index.html",
    hash: ""
  };
  const throwingHistory = {
    replaceState() {
      const err = new Error("Blocked a frame with origin \"null\"");
      err.name = "SecurityError";
      throw err;
    }
  };

  const {
    appGridEl,
    detailModalEl,
    locationObj,
    instance
  } = setupPortfolioHarness({ apps: SAMPLE_APPS, location: fileLocation, history: throwingHistory });

  const cardTrigger = appGridEl.querySelector(".app-card-trigger");
  assert.ok(cardTrigger);
  cardTrigger.click();
  assert.equal(detailModalEl.hidden, false);
  assert.equal(instance.store.getState().selectedAppId, "sample-focus-timer");
  assert.equal(locationObj.hash, "#app=sample-focus-timer");

  const closeBtn = detailModalEl.querySelector(".modal-close");
  assert.ok(closeBtn);
  closeBtn.click();
  assert.equal(detailModalEl.hidden, true);
  assert.equal(instance.store.getState().selectedAppId, null);
  assert.equal(locationObj.hash, "");
});

test("PortfolioApp.initPortfolio renders draft banner, responds to onAppsChanged/onAuthChanged, and closes admin modal on Escape", () => {
  let draftList = [SAMPLE_APPS[0]];
  let adminOpen = false;
  let adminUnlocked = false;
  let capturedAdminOpts = null;
  let clearCount = 0;

  const {
    doc,
    headerEl,
    draftBannerEl,
    appGridEl,
    adminModalEl,
    instance
  } = setupPortfolioHarness({
    apps: [],
    portfolioAdmin: {
      loadDraftApps: () => draftList,
      hasDraftApps: () => draftList !== null,
      clearDraftApps: () => {
        clearCount += 1;
        draftList = null;
      },
      initAdmin: (opts) => {
        capturedAdminOpts = opts;
        return {
          isUnlocked: () => adminUnlocked,
          isOpen: () => adminOpen,
          open: () => {
            adminOpen = true;
            adminModalEl.hidden = false;
          },
          close: () => {
            adminOpen = false;
            adminModalEl.hidden = true;
          },
          lock: () => {
            adminUnlocked = false;
            opts.onAuthChanged(false);
          }
        };
      }
    }
  });

  assert.ok(capturedAdminOpts, "initPortfolio must initialize PortfolioAdmin.initAdmin");
  assert.equal(instance.store.getState().apps.length, 1);
  assert.equal(draftBannerEl.hidden, false);
  const bannerText = draftBannerEl.querySelector(".draft-banner-text");
  assert.ok(bannerText && bannerText.textContent.includes("로컬 미리보기 중"));
  assert.equal(appGridEl.children.length, 1);

  // Header reflects auth state changes immediately
  assert.equal(headerEl.querySelector("#admin-toggle-btn").textContent, "관리자 모드");
  adminUnlocked = true;
  capturedAdminOpts.onAuthChanged(true);
  assert.equal(headerEl.querySelector("#admin-toggle-btn").textContent, "관리자 패널");
  assert.ok(headerEl.querySelector("#admin-lock-btn"));

  // Escape closes admin modal when open
  headerEl.querySelector("#admin-toggle-btn").click();
  assert.equal(adminOpen, true);
  doc.dispatchEvent({ type: "keydown", key: "Escape", preventDefault() {} });
  assert.equal(adminOpen, false);

  // onAppsChanged updates store, grid, and tags cleanly
  capturedAdminOpts.onAppsChanged(SAMPLE_APPS);
  assert.equal(appGridEl.children.length, 2);

  // Clicking draft banner reset restores base PORTFOLIO_APPS ([]) and hides banner
  const resetDraftBtn = draftBannerEl.querySelector(".btn-reset-draft");
  assert.ok(resetDraftBtn);
  resetDraftBtn.click();
  assert.equal(clearCount, 1);
  assert.equal(draftBannerEl.hidden, true);
  assert.equal(instance.store.getState().apps.length, 0);
});

test("PortfolioApp.initPortfolio preserves published cache across reload until cache-busted data/apps.js catches up", () => {
  const freshApps = [
    {
      id: "animal-race",
      title: "동물 달리기 추첨",
      tagline: "교실 추첨",
      purpose: "목적",
      audience: "학생",
      description: ["내용"],
      launchType: "external",
      url: "https://example.com/race",
      embedMode: "newTab",
      tags: ["교육"]
    }
  ];

  let clearedPublishedCache = 0;
  const h1 = setupPortfolioHarness({
    apps: [],
    location: { protocol: "https:", href: "https://example.github.io/portfolio/", hash: "" },
    portfolioAdmin: {
      isUnlocked: () => false,
      loadDraftApps: () => null,
      clearDraftApps: () => true,
      hasDraftApps: () => false,
      loadPublishedCache: () => freshApps,
      clearPublishedCache: () => { clearedPublishedCache += 1; },
      initAdmin: () => ({
        isUnlocked: () => false,
        isOpen: () => false,
        open: () => {},
        close: () => {},
        lock: () => {}
      })
    }
  });

  // Immediately displays publishedCache even when stale cached data/apps.js had []
  assert.equal(h1.appGridEl.children.length, 1);
  assert.equal(h1.instance.store.getState().apps[0].id, "animal-race");

  // Cache-busted script tag appended to document.head
  assert.equal(h1.doc.head.children.length, 1);
  const reloadScript = h1.doc.head.children[0];
  assert.match(reloadScript.src, /^\.\/data\/apps\.js\?t=\d+$/);

  // When server returns empty stale data first, publishedCache is NOT cleared
  reloadScript.onload();
  assert.equal(clearedPublishedCache, 0);
  assert.equal(h1.instance.store.getState().apps.length, 1);

  // When server catches up with matching freshApps, publishedCache clears cleanly
  const h2 = setupPortfolioHarness({
    apps: [],
    location: { protocol: "https:", href: "https://example.github.io/portfolio/", hash: "" },
    portfolioAdmin: {
      isUnlocked: () => false,
      loadDraftApps: () => null,
      clearDraftApps: () => true,
      hasDraftApps: () => false,
      loadPublishedCache: () => freshApps,
      clearPublishedCache: () => { clearedPublishedCache += 1; },
      initAdmin: () => ({
        isUnlocked: () => false,
        isOpen: () => false,
        open: () => {},
        close: () => {},
        lock: () => {}
      })
    }
  });
  h2.sandbox.window.PORTFOLIO_APPS = freshApps;
  h2.doc.head.children[0].onload();
  assert.equal(clearedPublishedCache, 1);
  assert.equal(h2.instance.store.getState().apps.length, 1);
});

test("PortfolioApp.initPortfolio mounts PortfolioBoard and syncs admin auth changes", () => {
  let capturedBoardOpts = null;
  const adminStates = [];
  let adminUnlocked = false;
  let capturedAdminOpts = null;

  setupPortfolioHarness({
    apps: [],
    portfolioAdmin: {
      isUnlocked: () => adminUnlocked,
      loadDraftApps: () => null,
      hasDraftApps: () => false,
      loadPublishedCache: () => null,
      initAdmin: (opts) => {
        capturedAdminOpts = opts;
        return {
          isUnlocked: () => adminUnlocked,
          isOpen: () => false,
          open: () => {},
          close: () => {},
          lock: () => {}
        };
      }
    },
    portfolioBoard: {
      createBoardController: (opts) => {
        capturedBoardOpts = opts;
        return {
          setAdminUnlocked(next) {
            adminStates.push(Boolean(next));
          },
          refresh() {}
        };
      }
    }
  });

  assert.ok(capturedBoardOpts, "initPortfolio must mount PortfolioBoard.createBoardController");
  assert.equal(capturedBoardOpts.containerEl.id, "feedback-board");
  assert.equal(capturedBoardOpts.isAdminUnlocked(), false);

  adminUnlocked = true;
  capturedAdminOpts.onAuthChanged(true);
  assert.deepEqual(adminStates, [true]);

  adminUnlocked = false;
  capturedAdminOpts.onAuthChanged(false);
  assert.deepEqual(adminStates, [true, false]);
});
