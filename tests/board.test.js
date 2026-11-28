const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function createFakeDom() {
  const elementsById = new Map();

  function createElement(tagName) {
    const attrs = Object.create(null);
    const listeners = Object.create(null);
    const children = [];
    let classNameValue = "";
    let textValue = "";

    const node = {
      nodeType: 1,
      tagName: String(tagName).toUpperCase(),
      parentNode: null,
      children,
      hidden: false,
      disabled: false,
      value: "",
      type: "",
      required: false,
      rows: 0,
      maxLength: -1,
      placeholder: "",
      htmlFor: "",
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
        },
        remove(...tokens) {
          const set = new Set(classNameValue.split(/\s+/).filter(Boolean));
          for (const token of tokens) set.delete(token);
          classNameValue = Array.from(set).join(" ");
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
        if (attrs.id) elementsById.set(attrs.id, node);
      },
      get textContent() {
        if (children.length === 0) return textValue;
        return textValue + children.map((c) => c.textContent).join("");
      },
      set textContent(val) {
        textValue = val == null ? "" : String(val);
        children.length = 0;
      },
      get innerHTML() {
        throw new Error("innerHTML access is disallowed; use textContent/DOM APIs");
      },
      set innerHTML(_val) {
        throw new Error("innerHTML assignment is disallowed for XSS safety");
      },
      setAttribute(name, value) {
        attrs[name] = String(value);
        if (name === "id") elementsById.set(String(value), node);
      },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
      },
      appendChild(child) {
        if (child && child.parentNode && child.parentNode !== node) {
          const idx = child.parentNode.children.indexOf(child);
          if (idx >= 0) child.parentNode.children.splice(idx, 1);
        }
        if (child) child.parentNode = node;
        children.push(child);
        return child;
      },
      replaceChildren(...nodes) {
        children.length = 0;
        for (const child of nodes) node.appendChild(child);
      },
      addEventListener(type, fn) {
        (listeners[type] = listeners[type] || []).push(fn);
      },
      dispatchEvent(evt) {
        const event = evt || { type: "click" };
        event.target = event.target || node;
        event.preventDefault = event.preventDefault || (() => {});
        for (const fn of listeners[event.type] || []) {
          fn(event);
        }
      },
      click() {
        node.dispatchEvent({ type: "click", target: node, preventDefault() {} });
      },
      focus() {},
      querySelector(sel) {
        return node.querySelectorAll(sel)[0] || null;
      },
      querySelectorAll(sel) {
        const matched = [];
        const walk = (root) => {
          for (const child of root.children || []) {
            if (sel.startsWith("#") && child.id === sel.slice(1)) {
              matched.push(child);
            } else if (sel.startsWith(".") && child.classList && child.classList.contains(sel.slice(1))) {
              matched.push(child);
            } else if (child.tagName === sel.toUpperCase()) {
              matched.push(child);
            }
            walk(child);
          }
        };
        walk(node);
        return matched;
      }
    };
    return node;
  }

  return {
    elementsById,
    document: {
      createElement,
      getElementById(id) {
        return elementsById.get(id) || null;
      }
    }
  };
}

function loadBoardHarness(options = {}) {
  const dom = createFakeDom();
  const containerEl = dom.document.createElement("section");
  containerEl.id = "feedback-board";

  let currentNow = typeof options.initialNow === "number" ? options.initialNow : 1764345600000;
  let storedAuth = options.storedAuth || null;
  let adminUnlocked = Boolean(options.adminUnlocked);
  const notifications = [];

  const postsStore = Array.isArray(options.initialPosts) ? options.initialPosts.slice() : [];
  const calls = {
    load: 0,
    create: [],
    reply: [],
    delete: []
  };

  const firebaseApi = {
    getStoredAuth() {
      return storedAuth;
    },
    async loadBoardPosts() {
      calls.load += 1;
      if (options.failLoad) {
        throw new Error("네트워크 오류");
      }
      return postsStore
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async createBoardPost(payload) {
      calls.create.push(payload);
      const author = (payload.author || "").trim() || "익명";
      const content = (payload.content || "").trim();
      if (content.length < 2) {
        throw new Error("내용을 2자 이상 입력해 주세요.");
      }
      const created = {
        id: "-O" + String(100 + calls.create.length),
        author,
        content,
        createdAt: currentNow
      };
      postsStore.unshift(created);
      return created;
    },
    async replyBoardPost(postId, replyText) {
      if (!storedAuth) {
        throw new Error("관리자 Firebase 로그인이 필요합니다.");
      }
      calls.reply.push({ postId, replyText });
      const target = postsStore.find((p) => p.id === postId);
      if (target) {
        target.reply = replyText.trim();
        target.replyAt = currentNow;
      }
      return { id: postId, reply: replyText.trim(), replyAt: currentNow };
    },
    async deleteBoardPost(postId) {
      if (!storedAuth) {
        throw new Error("관리자 Firebase 로그인이 필요합니다.");
      }
      calls.delete.push(postId);
      const idx = postsStore.findIndex((p) => p.id === postId);
      if (idx >= 0) postsStore.splice(idx, 1);
      return true;
    }
  };

  const sandbox = {
    window: {
      document: dom.document,
      PortfolioFirebase: firebaseApi
    },
    document: dom.document,
    setTimeout,
    clearTimeout
  };
  sandbox.window.window = sandbox.window;

  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js", "board.js"), "utf8"), sandbox);

  const controller = sandbox.window.PortfolioBoard.createBoardController({
    containerEl,
    firebaseApi,
    isAdminUnlocked: () => adminUnlocked,
    onNotify: (msg) => notifications.push(msg),
    pageSize: options.pageSize || 5,
    cooldownMs: options.cooldownMs !== undefined ? options.cooldownMs : 10000,
    now: () => currentNow
  });

  return {
    dom,
    containerEl,
    controller,
    calls,
    notifications,
    setNow(next) { currentNow = next; },
    setStoredAuth(next) { storedAuth = next; },
    setAdminUnlocked(next) {
      adminUnlocked = Boolean(next);
      controller.setAdminUnlocked(adminUnlocked);
    }
  };
}

test("PortfolioBoard renders initial posts, defaults empty author to 익명, and prevents XSS", async () => {
  const h = loadBoardHarness({
    initialPosts: [
      { id: "-O1", author: "<img src=x onerror=alert(1)>", content: "<script>alert(1)</script>", createdAt: 1764340000000 }
    ]
  });

  await new Promise((r) => setTimeout(r, 10));
  assert.equal(h.calls.load, 1);

  const listEl = h.dom.elementsById.get("board-list");
  assert.equal(listEl.children.length, 1);
  assert.equal(listEl.children[0].querySelector(".board-post-author").textContent, "<img src=x onerror=alert(1)>");
  assert.equal(listEl.children[0].querySelector(".board-post-content").textContent, "<script>alert(1)</script>");

  // Validation error on < 2 chars
  const formEl = h.dom.elementsById.get("board-form");
  const authorInput = h.dom.elementsById.get("board-author");
  const contentInput = h.dom.elementsById.get("board-content");
  const statusEl = h.dom.elementsById.get("board-form-status");

  authorInput.value = "   ";
  contentInput.value = "짧";
  formEl.dispatchEvent({ type: "submit", preventDefault() {} });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(h.calls.create.length, 0);
  assert.equal(statusEl.hidden, false);
  assert.match(statusEl.textContent, /2자 이상/);

  // Valid submission with blank author defaults to 익명
  contentInput.value = "  구구단 게임 너무 좋아요! 타이머 기능도 요청합니다.  ";
  formEl.dispatchEvent({ type: "submit", preventDefault() {} });
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(h.calls.create.length, 1);
  assert.equal(listEl.children.length, 2);
  assert.equal(listEl.children[0].querySelector(".board-post-author").textContent, "익명");
  assert.equal(contentInput.value, "");
  assert.equal(h.dom.elementsById.get("board-count").textContent, "전체 2건");
});

test("PortfolioBoard enforces submit cooldown and paginates with 더 보기 button", async () => {
  const initialPosts = [];
  for (let i = 1; i <= 7; i += 1) {
    initialPosts.push({ id: `-O${i}`, author: `작성자${i}`, content: `의견 내용 ${i}번입니다.`, createdAt: 1764300000000 + i * 1000 });
  }
  const h = loadBoardHarness({ initialPosts, pageSize: 5, cooldownMs: 10000 });
  await new Promise((r) => setTimeout(r, 10));

  const listEl = h.dom.elementsById.get("board-list");
  const moreWrap = h.dom.elementsById.get("board-more-wrap");
  const moreBtn = h.dom.elementsById.get("board-load-more");

  assert.equal(listEl.children.length, 5);
  assert.equal(moreWrap.hidden, false);
  assert.match(moreBtn.textContent, /2건/);

  moreBtn.click();
  assert.equal(listEl.children.length, 7);
  assert.equal(moreWrap.hidden, true);

  // Cooldown check
  const formEl = h.dom.elementsById.get("board-form");
  const contentInput = h.dom.elementsById.get("board-content");
  contentInput.value = "첫 번째 새 건의입니다.";
  formEl.dispatchEvent({ type: "submit", preventDefault() {} });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(h.calls.create.length, 1);

  contentInput.value = "연속 두 번째 건의입니다.";
  formEl.dispatchEvent({ type: "submit", preventDefault() {} });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(h.calls.create.length, 1);
  assert.match(h.dom.elementsById.get("board-form-status").textContent, /잠시 후/);

  h.setNow(1764345600000 + 11000);
  formEl.dispatchEvent({ type: "submit", preventDefault() {} });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(h.calls.create.length, 2);
});

test("PortfolioBoard supports admin inline reply and 2-step delete moderation", async () => {
  const h = loadBoardHarness({
    initialPosts: [
      { id: "-O1", author: "학생", content: "다크모드 되나요?", createdAt: 1764340000000 }
    ],
    adminUnlocked: false,
    storedAuth: null
  });
  await new Promise((r) => setTimeout(r, 10));

  // Admin locked: no delete/reply buttons rendered
  assert.equal(h.containerEl.querySelectorAll(".board-delete-btn").length, 0);
  assert.equal(h.containerEl.querySelectorAll(".board-reply-toggle-btn").length, 0);

  // Unlock admin without Firebase token: buttons appear, clicking warns Firebase login needed
  h.setAdminUnlocked(true);
  assert.equal(h.containerEl.querySelectorAll(".board-delete-btn").length, 1);
  h.containerEl.querySelector(".board-delete-btn").click();
  assert.equal(h.calls.delete.length, 0);
  assert.ok(h.notifications.some((m) => m.includes("Firebase")));

  // Provide Firebase auth token: reply works, and 2-step delete removes post
  h.setStoredAuth({ uid: "zNS57lhTOXMCDrbBwhAV2US5i0w1", idToken: "tok" });

  h.containerEl.querySelector(".board-reply-toggle-btn").click();
  const replyInput = h.containerEl.querySelector(".board-reply-input");
  assert.ok(replyInput);
  replyInput.value = "검토 후 반영하겠습니다!";
  h.containerEl.querySelector(".board-reply-save-btn").click();
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(h.calls.reply.length, 1);
  assert.equal(h.containerEl.querySelector(".board-reply-text").textContent, "검토 후 반영하겠습니다!");

  const delBtn = h.containerEl.querySelector(".board-delete-btn");
  delBtn.click();
  assert.equal(h.calls.delete.length, 0, "First click must arm confirmation");
  assert.match(h.containerEl.querySelector(".board-delete-btn").textContent, /확인/);

  h.containerEl.querySelector(".board-delete-btn").click();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(h.calls.delete, ["-O1"]);
  assert.equal(h.dom.elementsById.get("board-list").children.length, 0);
});
