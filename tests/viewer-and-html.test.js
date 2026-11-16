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

  for (const requiredId of [
    "site-header",
    "search-input",
    "tag-filters",
    "app-grid",
    "detail-modal",
    "viewer-overlay",
    "viewer-iframe",
    "toast"
  ]) {
    assert.match(html, new RegExp(`id=["']${requiredId}["']`), `Missing #${requiredId}`);
  }
  assert.match(html, /data-launch-filter=["']all["']/);
});

test("css/styles.css exists and defines core showcase, modal, viewer, mobile preview, and reduced-motion rules", () => {
  const cssPath = path.join(ROOT, "css", "styles.css");
  assert.equal(fs.existsSync(cssPath), true, "css/styles.css must exist");
  const css = fs.readFileSync(cssPath, "utf8");

  for (const selector of [
    ".app-card",
    ".modal-dialog",
    ".modal-dialog > *",
    ".viewer-overlay",
    ".is-mobile",
    "@media (prefers-reduced-motion: reduce)"
  ]) {
    assert.ok(css.includes(selector), `Missing CSS rule for ${selector}`);
  }
  assert.match(css, /\.modal-dialog\s*>\s*\*[\s\S]*flex-shrink:\s*0/);
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

  const headerEl = createWithId("header", "site-header");
  const searchInput = createWithId("input", "search-input");
  const tagFiltersEl = createWithId("div", "tag-filters");
  const appsCountEl = createWithId("p", "apps-count");
  const appGridEl = createWithId("div", "app-grid");
  const detailModalEl = createWithId("div", "detail-modal", { hidden: true });
  const toastEl = createWithId("div", "toast", { hidden: true });

  const overlayDom = buildOverlayDom(doc);
  const viewerBackBtn = createWithId("button", "viewer-back");
  const viewerCloseBtn = createWithId("button", "viewer-close");
  const viewerCopyShareBtn = createWithId("button", "viewer-copy-share");
  overlayDom.overlay.appendChild(viewerBackBtn);
  overlayDom.overlay.appendChild(viewerCloseBtn);
  overlayDom.overlay.appendChild(viewerCopyShareBtn);

  const launchBtns = ["all", "embedded", "external"].map((val) => {
    const btn = doc.createElement("button");
    btn.setAttribute("data-launch-filter", val);
    btn.setAttribute("aria-pressed", val === "all" ? "true" : "false");
    if (val === "all") btn.classList.add("is-active");
    return btn;
  });

  doc.querySelectorAll = (selector) => {
    if (selector === "[data-launch-filter]") return launchBtns;
    return [];
  };

  doc.body.appendChild(headerEl);
  doc.body.appendChild(searchInput);
  doc.body.appendChild(tagFiltersEl);
  doc.body.appendChild(appsCountEl);
  doc.body.appendChild(appGridEl);
  doc.body.appendChild(detailModalEl);
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

  for (const relPath of [
    "data/apps.js",
    "js/state.js",
    "js/render.js",
    "js/viewer.js",
    "js/app.js"
  ]) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, relPath), "utf8"), sandbox);
  }

  const instance = sandbox.window.PortfolioApp.initPortfolio();
  return {
    doc,
    winListeners,
    searchInput,
    appGridEl,
    detailModalEl,
    overlayDom,
    viewerBackBtn,
    launchBtns,
    locationObj,
    instance
  };
}

test("PortfolioApp.initPortfolio wires state, render, viewer, focus management, Escape order, and hashchange end-to-end", () => {
  const {
    doc,
    winListeners,
    searchInput,
    appGridEl,
    detailModalEl,
    overlayDom,
    viewerBackBtn,
    launchBtns,
    locationObj,
    instance
  } = setupPortfolioHarness();

  assert.ok(instance && instance.store);

  // Header & initial grid rendered from data/apps.js
  assert.ok(appGridEl.children.length >= 2);
  assert.equal(detailModalEl.hidden, true);
  assert.equal(overlayDom.overlay.hidden, true);

  // Launch filter click narrows grid to embedded
  launchBtns[1].click();
  assert.equal(launchBtns[1].getAttribute("aria-pressed"), "true");
  assert.equal(launchBtns[0].getAttribute("aria-pressed"), "false");
  assert.equal(appGridEl.children.length, 1);

  // Search input filters out and back in
  searchInput.value = "없는검색어";
  searchInput.dispatchEvent({ type: "input", target: searchInput });
  assert.equal(appGridEl.children[0].className, "empty-state");

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
  } = setupPortfolioHarness({ location: fileLocation, history: throwingHistory });

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
