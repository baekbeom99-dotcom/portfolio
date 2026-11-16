const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
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

function createFakeAdminDom() {
  const elementsById = new Map();

  function createTextNode(text) {
    return {
      nodeType: 3,
      parentNode: null,
      textContent: String(text)
    };
  }

  function createElement(tagName) {
    const upperTag = String(tagName).toUpperCase();
    const attrs = Object.create(null);
    const listeners = Object.create(null);
    const children = [];
    let classNameValue = "";

    const node = {
      nodeType: 1,
      tagName: upperTag,
      parentNode: null,
      children,
      hidden: false,
      disabled: false,
      checked: false,
      files: [],
      style: {},
      dataset: Object.create(null),
      value: "",
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
          for (const t of tokens) {
            if (t) set.add(t);
          }
          classNameValue = Array.from(set).join(" ");
          attrs.class = classNameValue;
        },
        remove(...tokens) {
          const set = new Set(classNameValue.split(/\s+/).filter(Boolean));
          for (const t of tokens) {
            set.delete(t);
          }
          classNameValue = Array.from(set).join(" ");
          attrs.class = classNameValue;
        },
        toggle(token, force) {
          const has = this.contains(token);
          const shouldAdd = force !== undefined ? Boolean(force) : !has;
          if (shouldAdd) this.add(token);
          else this.remove(token);
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
        if (attrs.id && elementsById.get(attrs.id) === node) {
          elementsById.delete(attrs.id);
        }
        attrs.id = String(val);
        if (attrs.id) {
          elementsById.set(attrs.id, node);
        }
      },
      get type() {
        return attrs.type || "";
      },
      set type(val) {
        attrs.type = String(val);
      },
      get src() {
        return attrs.src || "";
      },
      set src(val) {
        attrs.src = String(val);
      },
      get href() {
        return attrs.href || "";
      },
      set href(val) {
        attrs.href = String(val);
      },
      get download() {
        return attrs.download || "";
      },
      set download(val) {
        attrs.download = String(val);
      },
      get innerHTML() {
        throw new Error("innerHTML getter must not be accessed");
      },
      set innerHTML(_val) {
        throw new Error("innerHTML setter must never be called");
      },
      get firstChild() {
        return children.length > 0 ? children[0] : null;
      },
      get textContent() {
        return children.map((c) => c.textContent).join("");
      },
      set textContent(val) {
        while (children.length > 0) {
          const removed = children.pop();
          removed.parentNode = null;
        }
        if (val !== null && val !== undefined && String(val) !== "") {
          node.appendChild(createTextNode(String(val)));
        }
      },
      setAttribute(name, value) {
        const key = String(name);
        const val = String(value);
        attrs[key] = val;
        if (key === "id") {
          node.id = val;
        } else if (key === "class") {
          classNameValue = val;
        } else if (key.startsWith("data-")) {
          const camel = key.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
          node.dataset[camel] = val;
        }
      },
      getAttribute(name) {
        const key = String(name);
        return Object.prototype.hasOwnProperty.call(attrs, key) ? attrs[key] : null;
      },
      hasAttribute(name) {
        return Object.prototype.hasOwnProperty.call(attrs, String(name));
      },
      removeAttribute(name) {
        delete attrs[String(name)];
      },
      appendChild(child) {
        if (child.parentNode) {
          child.parentNode.removeChild(child);
        }
        child.parentNode = node;
        children.push(child);
        if (child.nodeType === 1 && child.id) {
          elementsById.set(child.id, child);
        }
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
        for (const n of nodes) {
          node.appendChild(n);
        }
      },
      addEventListener(evt, fn) {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(fn);
      },
      dispatchEvent(evt) {
        const eventObj = evt || { type: "" };
        if (!eventObj.target) eventObj.target = node;
        if (!eventObj.preventDefault) eventObj.preventDefault = () => {};
        for (const fn of (listeners[eventObj.type] || []).slice()) {
          fn(eventObj);
        }
      },
      click() {
        node.dispatchEvent({ type: "click", target: node });
      },
      focus() {
        doc.activeElement = node;
      },
      select() {},
      querySelector(selector) {
        return node.querySelectorAll(selector)[0] || null;
      },
      querySelectorAll(selector) {
        const results = [];
        const matches = (el) => {
          if (selector.startsWith("#")) return el.id === selector.slice(1);
          if (selector.startsWith(".")) return el.classList.contains(selector.slice(1));
          return el.tagName === selector.toUpperCase();
        };
        const walk = (curr) => {
          for (const child of curr.children) {
            if (child.nodeType === 1) {
              if (matches(child)) results.push(child);
              walk(child);
            }
          }
        };
        walk(node);
        return results;
      }
    };

    return node;
  }

  const body = createElement("body");
  const doc = {
    body,
    activeElement: null,
    createElement,
    createTextNode,
    getElementById(id) {
      return elementsById.get(id) || null;
    }
  };
  return doc;
}

function loadAdminHarness(options = {}) {
  const doc = createFakeAdminDom();
  const localStorage = options.localStorage || createMemoryStorage();
  const sessionStorage = options.sessionStorage || createMemoryStorage();

  const modalEl = doc.createElement("div");
  modalEl.id = "admin-modal";
  modalEl.hidden = true;
  modalEl.setAttribute("aria-hidden", "true");
  doc.body.appendChild(modalEl);

  class MockFileReader {
    readAsDataURL(file) {
      this.result = file && file._mockDataUrl ? file._mockDataUrl : "data:image/png;base64,iVBORw0KGgo=";
      if (typeof this.onload === "function") {
        this.onload({ target: this });
      }
    }
  }

  const blobUrls = [];
  function MockURL(input, base) {
    return new URL(input, base);
  }
  MockURL.createObjectURL = function (blob) {
    const u = "blob:mock-" + blobUrls.length;
    blobUrls.push({ url: u, blob });
    return u;
  };
  MockURL.revokeObjectURL = function () {};

  const sandbox = {
    window: {
      document: doc,
      localStorage,
      sessionStorage,
      location: { href: "https://baekbeom99-dotcom.github.io/portfolio/", origin: "https://baekbeom99-dotcom.github.io" },
      FileReader: MockFileReader,
      URL: MockURL,
      Blob,
      PORTFOLIO_CONFIG: {
        siteTitle: "윤선생 App Studio",
        siteSubtitle: "교육용 및 일상생활을 위한 웹앱 공유 플랫폼",
        ownerName: "윤선생",
        contactLink: ""
      },
      PORTFOLIO_APPS: Array.isArray(options.initialApps) ? options.initialApps.slice() : []
    },
    document: doc,
    localStorage,
    sessionStorage,
    location: { href: "https://baekbeom99-dotcom.github.io/portfolio/", origin: "https://baekbeom99-dotcom.github.io" },
    FileReader: MockFileReader,
    URL: MockURL,
    Blob,
    fetch: options.fetchImpl || (async () => ({ ok: false, status: 404 })),
    setTimeout,
    clearTimeout,
    AbortController
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.fetch = sandbox.fetch;

  for (const relPath of [
    "js/render.js",
    "js/recommender.js",
    "js/github-sync.js",
    "js/admin.js"
  ]) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, relPath), "utf8"), sandbox);
  }

  return {
    doc,
    modalEl,
    localStorage,
    sessionStorage,
    sandbox,
    blobUrls,
    PortfolioAdmin: sandbox.window.PortfolioAdmin
  };
}

test("js/admin.js contains no plaintext admin password and sha256Hex/verifyAdminPassword match Node crypto", () => {
  const adminSource = fs.readFileSync(path.join(ROOT, "js", "admin.js"), "utf8");
  assert.equal(adminSource.includes("gPqk"), false, "js/admin.js must never contain the literal passcode");

  const { PortfolioAdmin } = loadAdminHarness();
  const expected = crypto.createHash("sha256").update("gPqk", "utf8").digest("hex");
  assert.equal(expected, "b1a8cd2856f2c9616455e1ae797e01e5443c30ca6c08e0931ab4ee22bf3c2525");
  assert.equal(PortfolioAdmin.sha256Hex("gPqk"), expected);
  assert.equal(PortfolioAdmin.sha256Hex(""), crypto.createHash("sha256").update("", "utf8").digest("hex"));
  assert.equal(
    PortfolioAdmin.sha256Hex("윤선생 App Studio — 긴 문자열 SHA256 검증 테스트 1234567890!@#"),
    crypto.createHash("sha256").update("윤선생 App Studio — 긴 문자열 SHA256 검증 테스트 1234567890!@#", "utf8").digest("hex")
  );
  assert.equal(PortfolioAdmin.verifyAdminPassword("gPqk"), true);
  assert.equal(PortfolioAdmin.verifyAdminPassword("wrong"), false);
  assert.equal(PortfolioAdmin.verifyAdminPassword(null), false);
});

test("normalizeTagsInput trims, deduplicates, drops empty items, and ignores prototype keys", () => {
  const { PortfolioAdmin } = loadAdminHarness();
  assert.deepEqual(Array.from(PortfolioAdmin.normalizeTagsInput("교육, 일상생활, 교육, ")), ["교육", "일상생활"]);
  assert.deepEqual(Array.from(PortfolioAdmin.normalizeTagsInput([" 교육 ", "constructor, 일상생활", ""])), ["교육", "constructor", "일상생활"]);
  assert.deepEqual(Array.from(PortfolioAdmin.normalizeTagsInput("  ,  , ")), []);
  assert.deepEqual(Array.from(PortfolioAdmin.normalizeTagsInput(null)), []);
});

test("draft storage helpers safely wrap localStorage and handle restricted contexts", () => {
  const { PortfolioAdmin, localStorage } = loadAdminHarness();
  assert.equal(PortfolioAdmin.loadDraftApps(), null);
  assert.equal(PortfolioAdmin.hasDraftApps(), false);

  const sample = [{ id: "demo", title: "데모" }];
  assert.equal(PortfolioAdmin.saveDraftApps(sample), true);
  assert.equal(PortfolioAdmin.hasDraftApps(), true);
  assert.equal(PortfolioAdmin.loadDraftApps().length, 1);
  assert.equal(localStorage.getItem("ys_portfolio_apps_draft") !== null, true);

  // Empty array draft (e.g. deleted all apps) is still a distinct draft
  assert.equal(PortfolioAdmin.saveDraftApps([]), true);
  assert.equal(PortfolioAdmin.hasDraftApps(), true);
  assert.deepEqual(Array.from(PortfolioAdmin.loadDraftApps()), []);

  PortfolioAdmin.clearDraftApps();
  assert.equal(PortfolioAdmin.hasDraftApps(), false);
  assert.equal(PortfolioAdmin.loadDraftApps(), null);

  // Restricted localStorage throwing SecurityError must not crash
  const throwingStorage = {
    getItem() { throw new Error("SecurityError"); },
    setItem() { throw new Error("SecurityError"); },
    removeItem() { throw new Error("SecurityError"); }
  };
  const restricted = loadAdminHarness({ localStorage: throwingStorage });
  assert.equal(restricted.PortfolioAdmin.loadDraftApps(), null);
  assert.equal(restricted.PortfolioAdmin.saveDraftApps(sample), false);
  assert.equal(restricted.PortfolioAdmin.hasDraftApps(), false);
  assert.doesNotThrow(() => restricted.PortfolioAdmin.clearDraftApps());
});

test("initAdmin handles unlock flow, URL recommendation apply, thumbnail preview, draft save, delete, and GitHub publish", async () => {
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url, method: init.method || "GET", body: init.body });
    if (url === "https://example.github.io/vocab-quiz/") {
      return {
        ok: true,
        status: 200,
        text: async () => "<html><head><title>영어 단어 퀴즈</title><meta name=\"description\" content=\"영단어를 퀴즈로 외우는 학습 앱\"></head><body><h1>영단어 퀴즈</h1><p>매일 10문제씩 풀며 어휘력을 키우세요.</p></body></html>"
      };
    }
    if (url.startsWith("https://api.github.com/repos/baekbeom99-dotcom/portfolio/contents/")) {
      if ((init.method || "GET") === "GET") {
        return { ok: false, status: 404, json: async () => ({ message: "Not Found" }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          commit: { sha: "abc1234", html_url: "https://github.com/baekbeom99-dotcom/portfolio/commit/abc1234" }
        })
      };
    }
    return { ok: false, status: 404 };
  };

  let currentApps = [];
  const authEvents = [];
  const toasts = [];

  const harness = loadAdminHarness({ fetchImpl, initialApps: currentApps });
  const { doc, modalEl, sessionStorage, PortfolioAdmin } = harness;

  const controller = PortfolioAdmin.initAdmin({
    modalEl,
    getApps: () => currentApps,
    getConfig: () => harness.sandbox.window.PORTFOLIO_CONFIG,
    onAppsChanged: (next) => { currentApps = next; },
    onAuthChanged: (unlocked) => { authEvents.push(unlocked); },
    onToast: (msg) => { toasts.push(msg); }
  });

  assert.equal(controller.isUnlocked(), false);
  assert.equal(controller.isOpen(), false);

  // Open while locked -> renders password dialog
  controller.open();
  assert.equal(controller.isOpen(), true);
  assert.equal(modalEl.hidden, false);
  assert.equal(modalEl.getAttribute("aria-hidden"), "false");

  const pwInput = doc.getElementById("admin-password-input");
  const authError = doc.getElementById("admin-auth-error");
  const authForm = modalEl.querySelector("form");
  assert.ok(pwInput && authError && authForm);

  // Wrong password shows error and stays locked
  pwInput.value = "wrong-pass";
  authForm.dispatchEvent({ type: "submit", preventDefault() {} });
  assert.equal(controller.isUnlocked(), false);
  assert.equal(authError.textContent, "비밀번호가 올바르지 않습니다.");

  // Correct password unlocks session and opens Admin Panel
  pwInput.value = "gPqk";
  authForm.dispatchEvent({ type: "submit", preventDefault() {} });
  assert.equal(controller.isUnlocked(), true);
  assert.equal(sessionStorage.getItem("ys_portfolio_admin_unlocked"), "true");
  assert.deepEqual(authEvents, [true]);

  // Verify full Admin Panel elements exist
  const urlInput = doc.getElementById("admin-app-url");
  const checkBtn = doc.getElementById("admin-check-url-btn");
  const urlStatus = doc.getElementById("admin-url-status");
  const recBox = doc.getElementById("admin-rec-box");
  const idInput = doc.getElementById("admin-app-id");
  const titleInput = doc.getElementById("admin-app-title");
  const taglineInput = doc.getElementById("admin-app-tagline");
  const tagsInput = doc.getElementById("admin-app-tags");
  const purposeInput = doc.getElementById("admin-app-purpose");
  const audienceInput = doc.getElementById("admin-app-audience");
  const descInput = doc.getElementById("admin-app-description");
  const thumbFileInput = doc.getElementById("admin-thumb-file");
  const thumbFitSelect = doc.getElementById("admin-thumb-fit");
  const thumbPreview = doc.getElementById("admin-thumb-preview");
  const saveDraftBtn = doc.getElementById("admin-save-draft-btn");

  assert.ok(urlInput && checkBtn && urlStatus && recBox && idInput && titleInput && tagsInput && saveDraftBtn);
  assert.equal(recBox.hidden, true);

  // Check URL and apply recommendation
  urlInput.value = "https://example.github.io/vocab-quiz/";
  await checkBtn.click();
  // Wait microtasks for async inspectWebAppUrl
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(recBox.hidden, false);
  assert.ok(urlStatus.textContent.includes("분석해 추천 문구를 생성"));
  const applyRecBtn = doc.getElementById("admin-apply-rec-btn");
  assert.ok(applyRecBtn);
  applyRecBtn.click();

  assert.equal(idInput.value, "vocab-quiz");
  assert.equal(titleInput.value, "영어 단어 퀴즈");
  assert.ok(taglineInput.value.includes("영단어"));
  assert.ok(purposeInput.value.length > 0);
  assert.ok(audienceInput.value.length > 0);
  assert.ok(descInput.value.length > 0);
  assert.ok(tagsInput.value.includes("교육"));

  // Clean unused-category rule: clear tagsInput to only "교육", verify saved tags match user entry
  tagsInput.value = "교육, ";

  // Upload thumbnail file & switch fit mode -> updates #admin-thumb-preview via buildThumbnailFrame
  thumbFileInput.files = [{ name: "cover.png", type: "image/png", _mockDataUrl: "data:image/png;base64,iVBORw0KGgo=" }];
  thumbFileInput.dispatchEvent({ type: "change", target: thumbFileInput });
  thumbFitSelect.value = "contain";
  thumbFitSelect.dispatchEvent({ type: "change", target: thumbFitSelect });

  const previewFrame = thumbPreview.querySelector(".app-card-thumb");
  assert.ok(previewFrame);
  assert.equal(previewFrame.classList.contains("is-contain-fit"), true);
  const previewImg = previewFrame.querySelector(".app-card-img");
  assert.equal(previewImg.src, "data:image/png;base64,iVBORw0KGgo=");

  // Save to draft -> updates currentApps, localStorage draft, and triggers onAppsChanged
  saveDraftBtn.click();
  assert.equal(currentApps.length, 1);
  assert.equal(currentApps[0].id, "vocab-quiz");
  assert.deepEqual(Array.from(currentApps[0].tags), ["교육"]);
  assert.equal(currentApps[0].thumbnailFit, "contain");
  assert.equal(PortfolioAdmin.hasDraftApps(), true);
  assert.ok(toasts.some((m) => m.includes("로컬 미리보기")));

  // Publish to GitHub -> uploads thumbnail + data/apps.js and clears draft
  const tokenInput = doc.getElementById("admin-github-token");
  const publishBtn = doc.getElementById("admin-publish-btn");
  assert.ok(tokenInput && publishBtn);
  tokenInput.value = "ghp_test_token";
  publishBtn.click();
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(PortfolioAdmin.hasDraftApps(), false, "Draft should clear after publishing to GitHub");
  assert.equal(currentApps.length, 1);
  assert.equal(currentApps[0].thumbnail, "./assets/thumbnails/vocab-quiz.png");
  assert.ok(toasts.some((m) => m.includes("GitHub에 게시되었습니다")));
  assert.ok(fetchCalls.some((c) => c.method === "PUT" && c.url.includes("assets/thumbnails/vocab-quiz.png")));
  assert.ok(fetchCalls.some((c) => c.method === "PUT" && c.url.includes("data/apps.js")));

  // Delete app via registered apps list
  const deleteBtn = modalEl.querySelector(".admin-app-delete-btn");
  assert.ok(deleteBtn);
  deleteBtn.click();
  assert.equal(currentApps.length, 0);
  assert.equal(PortfolioAdmin.hasDraftApps(), true);

  // Lock clears session and calls onAuthChanged(false)
  controller.lock();
  assert.equal(controller.isUnlocked(), false);
  assert.equal(sessionStorage.getItem("ys_portfolio_admin_unlocked"), null);
  assert.deepEqual(authEvents, [true, false]);
});

test("initAdmin supports quick-toggle category chips, validation errors, download, and draft reset", () => {
  const baseApp = {
    id: "existing-app",
    title: "기존 앱",
    tagline: "기존 소개",
    purpose: "기존 목적",
    audience: "학생",
    description: ["첫 번째 단계"],
    thumbnail: "./assets/thumbnails/existing.png",
    thumbnailFit: "auto",
    launchType: "external",
    url: "https://example.com/existing",
    embedMode: "newTab",
    tags: ["수학"],
    featured: false,
    createdAt: "2026-11-15"
  };

  let currentApps = [baseApp];
  const harness = loadAdminHarness({ initialApps: currentApps });
  harness.sessionStorage.setItem("ys_portfolio_admin_unlocked", "true");

  const { doc, modalEl, blobUrls, PortfolioAdmin } = harness;
  const controller = PortfolioAdmin.initAdmin({
    modalEl,
    getApps: () => currentApps,
    getConfig: () => harness.sandbox.window.PORTFOLIO_CONFIG,
    onAppsChanged: (next) => { currentApps = next; },
    onAuthChanged: () => {},
    onToast: () => {}
  });

  // Session storage unlock persists across initAdmin
  assert.equal(controller.isUnlocked(), true);
  controller.open();

  // Suggestion chips include base chips ("교육", "일상생활") + existing app tag ("수학")
  const suggestChips = modalEl.querySelectorAll(".admin-tag-chip");
  const chipTexts = suggestChips.map((c) => c.textContent);
  assert.deepEqual(chipTexts, ["교육", "일상생활", "수학"]);

  const tagsInput = doc.getElementById("admin-app-tags");
  suggestChips[0].click(); // adds "교육"
  suggestChips[2].click(); // adds "수학"
  assert.equal(tagsInput.value, "교육, 수학");
  suggestChips[0].click(); // toggles off "교육"
  assert.equal(tagsInput.value, "수학");

  // Validation prevents duplicate ID or unsafe URL
  const idInput = doc.getElementById("admin-app-id");
  const urlInput = doc.getElementById("admin-app-url");
  const saveDraftBtn = doc.getElementById("admin-save-draft-btn");
  const formError = doc.getElementById("admin-form-error");

  idInput.value = "existing-app";
  urlInput.value = "https://example.com/new";
  saveDraftBtn.click();
  assert.ok(formError.textContent.includes("이미 사용 중인 앱 ID"));

  idInput.value = "brand-new";
  urlInput.value = "javascript:alert(1)";
  saveDraftBtn.click();
  assert.ok(formError.textContent.length > 0);

  // Download apps.js creates Blob URL
  const downloadBtn = doc.getElementById("admin-download-btn");
  downloadBtn.click();
  assert.equal(blobUrls.length, 1);

  // Save valid new app then reset draft back to window.PORTFOLIO_APPS
  doc.getElementById("admin-app-url").value = "https://example.com/new";
  doc.getElementById("admin-app-title").value = "새 앱";
  doc.getElementById("admin-app-tagline").value = "새 소개";
  doc.getElementById("admin-app-purpose").value = "새 목적";
  doc.getElementById("admin-app-audience").value = "모든 사용자";
  doc.getElementById("admin-app-description").value = "사용법 1\n사용법 2";
  saveDraftBtn.click();
  assert.equal(currentApps.length, 2);
  assert.equal(PortfolioAdmin.hasDraftApps(), true);

  const resetDraftBtn = doc.getElementById("admin-reset-draft-btn");
  resetDraftBtn.click();
  assert.equal(PortfolioAdmin.hasDraftApps(), false);
  assert.equal(currentApps.length, 1);
  assert.equal(currentApps[0].id, "existing-app");
});
