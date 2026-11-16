const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createFakeDocument() {
  function attachCommonHelpers(node) {
    return node;
  }

  function createTextNode(text) {
    return attachCommonHelpers({
      nodeType: 3,
      nodeValue: String(text),
      parentNode: null,
      get textContent() {
        return this.nodeValue;
      },
      set textContent(val) {
        this.nodeValue = val == null ? "" : String(val);
      }
    });
  }

  function createElement(tagName) {
    const upperTag = String(tagName).toUpperCase();
    const attrs = Object.create(null);
    const listeners = Object.create(null);
    const children = [];
    let classNameValue = "";

    const element = {
      nodeType: 1,
      tagName: upperTag,
      parentNode: null,
      children,
      dataset: Object.create(null),
      hidden: false,
      style: {},
      get firstChild() {
        return children.length > 0 ? children[0] : null;
      },
      get className() {
        return classNameValue;
      },
      set className(val) {
        classNameValue = val == null ? "" : String(val);
        attrs.class = classNameValue;
      },
      classList: {
        add(...tokens) {
          const current = new Set(classNameValue.split(/\s+/).filter(Boolean));
          for (const token of tokens) {
            if (token) current.add(token);
          }
          classNameValue = Array.from(current).join(" ");
          attrs.class = classNameValue;
        },
        remove(...tokens) {
          const current = new Set(classNameValue.split(/\s+/).filter(Boolean));
          for (const token of tokens) {
            current.delete(token);
          }
          classNameValue = Array.from(current).join(" ");
          attrs.class = classNameValue;
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
      },
      get type() {
        return attrs.type || "";
      },
      set type(val) {
        attrs.type = String(val);
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
      get src() {
        return attrs.src || "";
      },
      set src(val) {
        attrs.src = String(val);
      },
      get alt() {
        return attrs.alt || "";
      },
      set alt(val) {
        attrs.alt = String(val);
      },
      get loading() {
        return attrs.loading || "";
      },
      set loading(val) {
        attrs.loading = String(val);
      },
      setAttribute(name, value) {
        const key = String(name);
        const val = String(value);
        attrs[key] = val;
        if (key === "class") {
          classNameValue = val;
        } else if (key.startsWith("data-")) {
          const camel = key
            .slice(5)
            .replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
          element.dataset[camel] = val;
        }
      },
      getAttribute(name) {
        const key = String(name);
        return Object.prototype.hasOwnProperty.call(attrs, key) ? attrs[key] : null;
      },
      hasAttribute(name) {
        return Object.prototype.hasOwnProperty.call(attrs, String(name));
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
      replaceChildren(...nodes) {
        while (children.length > 0) {
          const removed = children.pop();
          removed.parentNode = null;
        }
        for (const node of nodes) {
          element.appendChild(node);
        }
      },
      get textContent() {
        return children.map((child) => child.textContent).join("");
      },
      set textContent(val) {
        while (children.length > 0) {
          const removed = children.pop();
          removed.parentNode = null;
        }
        if (val !== null && val !== undefined && String(val) !== "") {
          element.appendChild(createTextNode(String(val)));
        }
      },
      get innerHTML() {
        throw new Error("innerHTML getter must not be accessed");
      },
      set innerHTML(_val) {
        throw new Error("innerHTML setter must never be called");
      },
      addEventListener(eventName, handler) {
        if (!listeners[eventName]) {
          listeners[eventName] = [];
        }
        listeners[eventName].push(handler);
      },
      dispatchEvent(event) {
        const evt = event || { type: "" };
        if (!evt.target) {
          evt.target = element;
        }
        const handlers = listeners[evt.type] || [];
        for (const handler of handlers) {
          handler(evt);
        }
        const propHandler = element["on" + evt.type];
        if (typeof propHandler === "function") {
          propHandler(evt);
        }
      },
      click() {
        element.dispatchEvent({ type: "click", target: element });
      }
    };

    return element;
  }

  return {
    createElement,
    createTextNode
  };
}

function findAll(root, predicate) {
  const results = [];
  function walk(node) {
    if (!node || node.nodeType !== 1) return;
    if (predicate(node)) {
      results.push(node);
    }
    for (const child of node.children) {
      walk(child);
    }
  }
  walk(root);
  return results;
}

function findFirst(root, predicate) {
  return findAll(root, predicate)[0] || null;
}

function loadRenderModule(fakeDoc) {
  const code = fs.readFileSync(path.resolve(__dirname, "..", "js", "render.js"), "utf8");
  const sandbox = {
    window: {},
    document: fakeDoc
  };
  sandbox.window.document = fakeDoc;
  vm.runInNewContext(code, sandbox);
  return sandbox.window.PortfolioRender;
}

test("createFallbackSvgDataUri escapes XML characters and returns valid 16:9 SVG data URI", () => {
  const doc = createFakeDocument();
  const { createFallbackSvgDataUri } = loadRenderModule(doc);

  const payload = "<script>alert(1)</script> & \"quote\" 'single'";
  const uri = createFallbackSvgDataUri(payload);

  assert.ok(uri.startsWith("data:image/svg+xml;charset=utf-8,"));
  const decoded = decodeURIComponent(uri.slice("data:image/svg+xml;charset=utf-8,".length));

  assert.match(decoded, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(decoded, /viewBox="0 0 800 450"/);
  assert.match(decoded, /<defs>/);
  assert.equal(decoded.includes("<script>"), false, "Raw <script> tag must be XML-escaped");
  assert.ok(decoded.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(decoded.includes("&amp;"));
  assert.ok(decoded.includes("&quot;quote&quot;"));

  // Deterministic output for identical input
  assert.equal(createFallbackSvgDataUri("포모도로 타이머"), createFallbackSvgDataUri("포모도로 타이머"));

  // Handles empty/null titles gracefully
  const emptyUri = createFallbackSvgDataUri("");
  assert.ok(emptyUri.startsWith("data:image/svg+xml;charset=utf-8,"));
  assert.ok(decodeURIComponent(emptyUri).includes(">W</text>"));
});

test("renderHeader renders config, stats, safe contactLink, and omits unsafe javascript: contactLink", () => {
  const doc = createFakeDocument();
  const { renderHeader } = loadRenderModule(doc);
  const rootEl = doc.createElement("header");

  renderHeader(
    rootEl,
    {
      siteTitle: "My Web App Studio",
      siteSubtitle: "일상의 불편을 해결하는 웹앱 모음",
      ownerName: "홍길동",
      contactLink: "https://github.com/example"
    },
    { totalCount: 5, embeddedCount: 2, externalCount: 3 }
  );

  assert.ok(rootEl.textContent.includes("My Web App Studio"));
  assert.ok(rootEl.textContent.includes("일상의 불편을 해결하는 웹앱 모음"));
  assert.ok(rootEl.textContent.includes("홍길동"));
  assert.ok(rootEl.textContent.includes("5"));
  assert.ok(rootEl.textContent.includes("2"));
  assert.ok(rootEl.textContent.includes("3"));

  const safeLink = findFirst(rootEl, (n) => n.tagName === "A");
  assert.ok(safeLink, "Expected safe contactLink anchor");
  assert.equal(safeLink.href, "https://github.com/example");
  assert.equal(safeLink.target, "_blank");
  assert.equal(safeLink.rel, "noopener noreferrer");

  // Unsafe javascript: contactLink must be omitted
  renderHeader(
    rootEl,
    {
      siteTitle: "Studio",
      siteSubtitle: "Sub",
      ownerName: "Owner",
      contactLink: "javascript:alert(1)"
    },
    { totalCount: 1, embeddedCount: 0, externalCount: 1 }
  );

  const unsafeLink = findFirst(rootEl, (n) => n.tagName === "A");
  assert.equal(unsafeLink, null, "Unsafe javascript: contactLink must not render an <a>");

  // Safe mailto: contactLink is allowed
  renderHeader(
    rootEl,
    {
      siteTitle: "Studio",
      siteSubtitle: "Sub",
      ownerName: "Owner",
      contactLink: "mailto:maker@example.com"
    },
    { totalCount: 1, embeddedCount: 0, externalCount: 1 }
  );
  const mailtoLink = findFirst(rootEl, (n) => n.tagName === "A");
  assert.ok(mailtoLink);
  assert.equal(mailtoLink.href, "mailto:maker@example.com");
});

test("renderFilters renders '전체' + tags with aria-pressed state and triggers onSelectTag", () => {
  const doc = createFakeDocument();
  const { renderFilters } = loadRenderModule(doc);
  const containerEl = doc.createElement("div");

  const selected = [];
  renderFilters(
    containerEl,
    ["생산성", "유틸리티"],
    { activeTag: "생산성" },
    { onSelectTag: (tag) => selected.push(tag) }
  );

  const buttons = findAll(containerEl, (n) => n.tagName === "BUTTON");
  assert.equal(buttons.length, 3);

  assert.equal(buttons[0].textContent, "전체");
  assert.equal(buttons[0].getAttribute("data-tag"), "all");
  assert.equal(buttons[0].getAttribute("aria-pressed"), "false");

  assert.equal(buttons[1].textContent, "생산성");
  assert.equal(buttons[1].getAttribute("data-tag"), "생산성");
  assert.equal(buttons[1].getAttribute("aria-pressed"), "true");

  assert.equal(buttons[2].textContent, "유틸리티");
  assert.equal(buttons[2].getAttribute("aria-pressed"), "false");

  buttons[2].click();
  buttons[0].click();
  assert.deepEqual(selected, ["유틸리티", "all"]);
});

test("renderAppGrid renders empty state with reset button when apps is empty", () => {
  const doc = createFakeDocument();
  const { renderAppGrid } = loadRenderModule(doc);
  const gridEl = doc.createElement("div");

  let resetCalled = 0;
  renderAppGrid(
    gridEl,
    [],
    { searchQuery: "없는앱", activeTag: "all", launchFilter: "all" },
    { onResetFilters: () => { resetCalled += 1; } }
  );

  const resetBtn = findFirst(gridEl, (n) => n.tagName === "BUTTON" && n.textContent.includes("필터 초기화"));
  assert.ok(resetBtn, "Empty state should include '필터 초기화' button");
  resetBtn.click();
  assert.equal(resetCalled, 1);
});

test("renderAppGrid renders cards safely via textContent, badges, audience, and thumbnail fallback", () => {
  const doc = createFakeDocument();
  const { renderAppGrid } = loadRenderModule(doc);
  const gridEl = doc.createElement("div");

  const xssTitle = '<img src=x onerror=alert(1)>타이머';
  const apps = [
    {
      id: "embedded-app",
      title: xssTitle,
      tagline: "빠른 집중 관리",
      purpose: "집중 유지",
      audience: "학생 및 직장인",
      description: "설명",
      thumbnail: "./assets/thumbnails/broken.png",
      launchType: "embedded",
      url: "./apps/sample-app/index.html",
      embedMode: "iframe",
      tags: ["생산성", "타이머"]
    },
    {
      id: "external-app",
      title: "외부 웹앱",
      tagline: "외부 링크 소개",
      purpose: "공유",
      audience: "개발자",
      description: "설명",
      launchType: "external",
      url: "https://example.com",
      embedMode: "newTab",
      tags: ["유틸리티"]
    }
  ];

  const clickedIds = [];
  renderAppGrid(gridEl, apps, {}, { onSelectApp: (id) => clickedIds.push(id) });

  const cards = findAll(gridEl, (n) => n.tagName === "ARTICLE");
  assert.equal(cards.length, 2);

  // Verify no injected <img> was parsed from xssTitle (only 1 thumbnail <img> per card)
  const allImgs = findAll(gridEl, (n) => n.tagName === "IMG");
  assert.equal(allImgs.length, 2);
  assert.ok(cards[0].textContent.includes(xssTitle));
  assert.ok(cards[0].textContent.includes("직접 탑재"));
  assert.ok(cards[0].textContent.includes("학생 및 직장인"));

  assert.ok(cards[1].textContent.includes("웹 링크"));
  assert.ok(cards[1].textContent.includes("개발자"));
  assert.ok(allImgs[1].src.startsWith("data:image/svg+xml;charset=utf-8,"), "Missing thumbnail should use fallback SVG");

  // Broken image onerror swaps once and guards with dataset.fallbackApplied
  assert.equal(allImgs[0].src, "./assets/thumbnails/broken.png");
  assert.equal(allImgs[0].loading, "lazy");
  allImgs[0].dispatchEvent({ type: "error", target: allImgs[0] });
  assert.ok(allImgs[0].src.startsWith("data:image/svg+xml;charset=utf-8,"));
  assert.ok(allImgs[0].dataset.fallbackApplied);

  // Second error must be a no-op
  allImgs[0].src = "sentinel-unchanged";
  allImgs[0].dispatchEvent({ type: "error", target: allImgs[0] });
  assert.equal(allImgs[0].src, "sentinel-unchanged");

  // Card trigger invokes onSelectApp(app.id)
  const triggers = findAll(gridEl, (n) => n.tagName === "BUTTON");
  assert.equal(triggers.length, 2);
  triggers[0].click();
  triggers[1].click();
  assert.deepEqual(clickedIds, ["embedded-app", "external-app"]);
});

test("renderDetailModal hides on null app, renders structured sections, and swaps primary CTA by embedMode", () => {
  const doc = createFakeDocument();
  const { renderDetailModal } = loadRenderModule(doc);
  const modalEl = doc.createElement("div");

  renderDetailModal(modalEl, null, {});
  assert.equal(modalEl.hidden, true);
  assert.equal(modalEl.getAttribute("aria-hidden"), "true");
  assert.equal(modalEl.children.length, 0);

  let closed = 0;
  let launched = null;
  let copied = null;

  const iframeApp = {
    id: "focus-timer",
    title: "25분 집중 타이머",
    tagline: "간단한 포모도로",
    purpose: "집중 세션 관리 목적",
    audience: "수험생과 개발자",
    description: ["시작을 누르세요", "25분 뒤 알림"],
    thumbnail: "./assets/thumbnails/sample-app.svg",
    launchType: "embedded",
    url: "./apps/sample-app/index.html",
    embedMode: "iframe",
    tags: ["생산성"]
  };

  renderDetailModal(modalEl, iframeApp, {
    onCloseDetail: () => { closed += 1; },
    onLaunchIframe: (app) => { launched = app.id; },
    onCopyShare: (app) => { copied = app.id; }
  });

  assert.equal(modalEl.hidden, false);
  assert.equal(modalEl.getAttribute("aria-hidden"), "false");

  const dialog = findFirst(modalEl, (n) => n.getAttribute("role") === "dialog");
  assert.ok(dialog, "Expected role='dialog' element");
  assert.equal(dialog.getAttribute("aria-modal"), "true");
  assert.ok(dialog.getAttribute("aria-labelledby"));

  const text = modalEl.textContent;
  assert.ok(text.includes("이 앱의 목적"));
  assert.ok(text.includes("집중 세션 관리 목적"));
  assert.ok(text.includes("추천 대상"));
  assert.ok(text.includes("수험생과 개발자"));
  assert.ok(text.includes("주요 내용 및 사용법"));
  assert.ok(text.includes("시작을 누르세요"));
  assert.ok(text.includes("25분 뒤 알림"));

  const launchBtn = findFirst(modalEl, (n) => n.tagName === "BUTTON" && n.textContent === "포트폴리오에서 바로 실행");
  assert.ok(launchBtn, "iframe app should render '포트폴리오에서 바로 실행' button");
  launchBtn.click();
  assert.equal(launched, "focus-timer");

  const newTabSecondary = findFirst(modalEl, (n) => n.tagName === "A" && n.textContent === "새 탭으로 열기");
  assert.ok(newTabSecondary, "iframe app should also provide '새 탭으로 열기' link");
  assert.equal(newTabSecondary.href, "./apps/sample-app/index.html");
  assert.equal(newTabSecondary.target, "_blank");
  assert.equal(newTabSecondary.rel, "noopener noreferrer");

  const copyBtn = findFirst(modalEl, (n) => n.tagName === "BUTTON" && n.textContent === "공유 링크 복사");
  assert.ok(copyBtn);
  copyBtn.click();
  assert.equal(copied, "focus-timer");

  const closeBtn = findFirst(modalEl, (n) => n.tagName === "BUTTON" && n.getAttribute("aria-label") === "닫기");
  assert.ok(closeBtn);
  closeBtn.click();
  assert.equal(closed, 1);

  // newTab app renders primary <a target="_blank" rel="noopener noreferrer"> labeled "새 탭에서 실행"
  const newTabApp = {
    id: "ext-app",
    title: "외부 앱",
    tagline: "외부 실행",
    purpose: "목적 설명",
    audience: "모든 사용자",
    description: "문자열 형태의 상세 설명",
    launchType: "external",
    url: "https://example.com/app",
    embedMode: "newTab",
    tags: ["쇼케이스"]
  };

  renderDetailModal(modalEl, newTabApp, {
    onCloseDetail: () => {},
    onLaunchIframe: () => {},
    onCopyShare: () => {}
  });

  assert.ok(modalEl.textContent.includes("문자열 형태의 상세 설명"));
  const primaryNewTabLink = findFirst(modalEl, (n) => n.tagName === "A" && n.textContent === "새 탭에서 실행");
  assert.ok(primaryNewTabLink, "newTab app should render '새 탭에서 실행' anchor");
  assert.equal(primaryNewTabLink.href, "https://example.com/app");
  assert.equal(primaryNewTabLink.target, "_blank");
  assert.equal(primaryNewTabLink.rel, "noopener noreferrer");
  assert.equal(
    findFirst(modalEl, (n) => n.tagName === "BUTTON" && n.textContent === "포트폴리오에서 바로 실행"),
    null
  );

  // Unsafe javascript: app.url must never become an anchor href
  renderDetailModal(modalEl, {
    id: "bad-url",
    title: "위험 URL",
    tagline: "테스트",
    purpose: "목적",
    audience: "대상",
    description: "내용",
    launchType: "external",
    url: "javascript:alert(1)",
    embedMode: "newTab"
  }, {});
  const blockedAnchor = findFirst(modalEl, (n) => n.tagName === "A");
  assert.ok(blockedAnchor);
  assert.equal(blockedAnchor.href, "");
  assert.equal(blockedAnchor.getAttribute("aria-disabled"), "true");
});
