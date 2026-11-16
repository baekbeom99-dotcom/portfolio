(function (global) {
  "use strict";

  var ADMIN_PASSWORD_SHA256 = "b1a8cd2856f2c9616455e1ae797e01e5443c30ca6c08e0931ab4ee22bf3c2525";
  var DRAFT_STORAGE_KEY = "ys_portfolio_apps_draft";
  var SESSION_UNLOCK_KEY = "ys_portfolio_admin_unlocked";
  var GITHUB_SETTINGS_KEY = "ys_portfolio_github_settings";

  var DEFAULT_GITHUB_OWNER = "baekbeom99-dotcom";
  var DEFAULT_GITHUB_REPO = "portfolio";
  var DEFAULT_GITHUB_BRANCH = "main";
  var BASE_CATEGORY_CHIPS = ["교육", "일상생활"];

  var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  var SHA256_H_INIT = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  function encodeUtf8Bytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i += 1) {
      var code = str.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
        var next = str.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          var cp = ((code - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
          bytes.push(
            0xf0 | (cp >> 18),
            0x80 | ((cp >> 12) & 0x3f),
            0x80 | ((cp >> 6) & 0x3f),
            0x80 | (cp & 0x3f)
          );
          i += 1;
        } else {
          bytes.push(0xef, 0xbf, 0xbd);
        }
      } else if (code >= 0xd800 && code <= 0xdfff) {
        bytes.push(0xef, 0xbf, 0xbd);
      } else {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return bytes;
  }

  function rotr(value, bits) {
    return (value >>> bits) | (value << (32 - bits));
  }

  /**
   * Computes a pure-JS lowercase SHA-256 hex digest from UTF-8 text.
   */
  function sha256Hex(text) {
    var input = text == null ? "" : String(text);
    var bytes = encodeUtf8Bytes(input);
    var bitLen = bytes.length * 8;

    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) {
      bytes.push(0);
    }

    var highBits = Math.floor(bitLen / 0x100000000);
    var lowBits = bitLen >>> 0;
    bytes.push(
      (highBits >>> 24) & 0xff,
      (highBits >>> 16) & 0xff,
      (highBits >>> 8) & 0xff,
      highBits & 0xff,
      (lowBits >>> 24) & 0xff,
      (lowBits >>> 16) & 0xff,
      (lowBits >>> 8) & 0xff,
      lowBits & 0xff
    );

    var h = SHA256_H_INIT.slice();
    var w = new Array(64);

    for (var offset = 0; offset < bytes.length; offset += 64) {
      for (var t = 0; t < 16; t += 1) {
        var idx = offset + t * 4;
        w[t] = (
          (bytes[idx] << 24) |
          (bytes[idx + 1] << 16) |
          (bytes[idx + 2] << 8) |
          bytes[idx + 3]
        ) >>> 0;
      }
      for (var j = 16; j < 64; j += 1) {
        var s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }

      var a = h[0];
      var b = h[1];
      var c = h[2];
      var d = h[3];
      var e = h[4];
      var f = h[5];
      var g = h[6];
      var hh = h[7];

      for (var k = 0; k < 64; k += 1) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (hh + S1 + ch + SHA256_K[k] + w[k]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) >>> 0;

        hh = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      h[0] = (h[0] + a) >>> 0;
      h[1] = (h[1] + b) >>> 0;
      h[2] = (h[2] + c) >>> 0;
      h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0;
      h[5] = (h[5] + f) >>> 0;
      h[6] = (h[6] + g) >>> 0;
      h[7] = (h[7] + hh) >>> 0;
    }

    var hex = "";
    for (var m = 0; m < h.length; m += 1) {
      var wordHex = h[m].toString(16);
      while (wordHex.length < 8) {
        wordHex = "0" + wordHex;
      }
      hex += wordHex;
    }
    return hex;
  }

  /**
   * Verifies the admin passcode against its stored SHA-256 digest.
   */
  function verifyAdminPassword(password) {
    return typeof password === "string" && sha256Hex(password) === ADMIN_PASSWORD_SHA256;
  }

  /**
   * Normalizes comma-separated or array category tags by trimming, deduplicating, and dropping empties.
   */
  function normalizeTagsInput(rawInput) {
    var pieces = [];
    if (Array.isArray(rawInput)) {
      for (var i = 0; i < rawInput.length; i += 1) {
        if (typeof rawInput[i] === "string") {
          var splitItems = rawInput[i].split(",");
          for (var j = 0; j < splitItems.length; j += 1) {
            pieces.push(splitItems[j]);
          }
        }
      }
    } else if (typeof rawInput === "string") {
      pieces = rawInput.split(",");
    } else {
      return [];
    }

    var seen = Object.create(null);
    var cleaned = [];
    for (var k = 0; k < pieces.length; k += 1) {
      var tag = pieces[k].trim();
      if (tag && !seen[tag]) {
        seen[tag] = true;
        cleaned.push(tag);
      }
    }
    return cleaned;
  }

  function getSafeStorage(kind) {
    try {
      return global[kind] || null;
    } catch (_err) {
      return null;
    }
  }

  function loadDraftApps() {
    try {
      var storage = getSafeStorage("localStorage");
      if (!storage || typeof storage.getItem !== "function") {
        return null;
      }
      var raw = storage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_err) {
      return null;
    }
  }

  function saveDraftApps(apps) {
    try {
      var storage = getSafeStorage("localStorage");
      if (!storage || typeof storage.setItem !== "function") {
        return false;
      }
      var list = Array.isArray(apps) ? apps : [];
      storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (_err) {
      return false;
    }
  }

  function clearDraftApps() {
    try {
      var storage = getSafeStorage("localStorage");
      if (storage && typeof storage.removeItem === "function") {
        storage.removeItem(DRAFT_STORAGE_KEY);
      }
      return true;
    } catch (_err) {
      return false;
    }
  }

  function hasDraftApps() {
    return loadDraftApps() !== null;
  }

  function loadGitHubSettings() {
    var defaults = {
      owner: DEFAULT_GITHUB_OWNER,
      repo: DEFAULT_GITHUB_REPO,
      branch: DEFAULT_GITHUB_BRANCH,
      token: ""
    };
    try {
      var storage = getSafeStorage("localStorage");
      if (!storage || typeof storage.getItem !== "function") {
        return defaults;
      }
      var raw = storage.getItem(GITHUB_SETTINGS_KEY);
      if (!raw) {
        return defaults;
      }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return defaults;
      }
      return {
        owner: typeof parsed.owner === "string" && parsed.owner.trim() ? parsed.owner.trim() : defaults.owner,
        repo: typeof parsed.repo === "string" && parsed.repo.trim() ? parsed.repo.trim() : defaults.repo,
        branch: typeof parsed.branch === "string" && parsed.branch.trim() ? parsed.branch.trim() : defaults.branch,
        token: typeof parsed.token === "string" ? parsed.token.trim() : ""
      };
    } catch (_err) {
      return defaults;
    }
  }

  function saveGitHubSettings(settings) {
    try {
      var storage = getSafeStorage("localStorage");
      if (!storage || typeof storage.setItem !== "function") {
        return false;
      }
      var payload = {
        owner: settings && settings.owner ? String(settings.owner).trim() : DEFAULT_GITHUB_OWNER,
        repo: settings && settings.repo ? String(settings.repo).trim() : DEFAULT_GITHUB_REPO,
        branch: settings && settings.branch ? String(settings.branch).trim() : DEFAULT_GITHUB_BRANCH,
        token: settings && settings.token ? String(settings.token).trim() : ""
      };
      storage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify(payload));
      return true;
    } catch (_err) {
      return false;
    }
  }

  function clearNode(node) {
    if (!node) {
      return;
    }
    if (typeof node.replaceChildren === "function") {
      node.replaceChildren();
      return;
    }
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function el(tagName, options) {
    var node = document.createElement(tagName);
    if (!options) {
      return node;
    }
    if (options.className) {
      node.className = options.className;
    }
    if (options.text !== undefined && options.text !== null) {
      node.textContent = String(options.text);
    }
    if (options.attrs) {
      var attrKeys = Object.keys(options.attrs);
      for (var i = 0; i < attrKeys.length; i += 1) {
        var key = attrKeys[i];
        var val = options.attrs[key];
        if (val !== undefined && val !== null) {
          node.setAttribute(key, String(val));
        }
      }
    }
    if (options.props) {
      var propKeys = Object.keys(options.props);
      for (var j = 0; j < propKeys.length; j += 1) {
        var propKey = propKeys[j];
        node[propKey] = options.props[propKey];
      }
    }
    if (options.on) {
      var eventNames = Object.keys(options.on);
      for (var k = 0; k < eventNames.length; k += 1) {
        var eventName = eventNames[k];
        var handler = options.on[eventName];
        if (typeof handler === "function") {
          node.addEventListener(eventName, handler);
        }
      }
    }
    if (Array.isArray(options.children)) {
      for (var c = 0; c < options.children.length; c += 1) {
        if (options.children[c]) {
          node.appendChild(options.children[c]);
        }
      }
    }
    return node;
  }

  function slugifyId(text) {
    if (typeof text !== "string") {
      return "";
    }
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function isDataImageUrl(url) {
    return typeof url === "string" && /^data:image\//i.test(url.trim());
  }

  function validateThumbnailUrl(rawThumb) {
    if (typeof rawThumb !== "string") {
      return { valid: false, reason: "썸네일 경로 형식이 올바르지 않습니다." };
    }
    var trimmed = rawThumb.trim();
    if (!trimmed) {
      return { valid: true };
    }
    if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
      return { valid: false, reason: "썸네일 경로에 사용할 수 없는 제어 문자가 포함되어 있습니다." };
    }

    var lower = trimmed.toLowerCase();
    if (lower.indexOf("data:") === 0) {
      var parsedData = global.PortfolioGitHubSync && typeof global.PortfolioGitHubSync.parseDataUrlBase64 === "function"
        ? global.PortfolioGitHubSync.parseDataUrlBase64(trimmed)
        : null;
      if (!parsedData) {
        return {
          valid: false,
          reason: "지원되지 않는 이미지 데이터 형식입니다. PNG, JPG, WebP, GIF, SVG 파일만 사용할 수 있습니다."
        };
      }
      return { valid: true };
    }

    if (trimmed.indexOf("./") === 0) {
      if (trimmed.indexOf("\\") !== -1) {
        return { valid: false, reason: "썸네일 경로에 역슬래시(\\)는 사용할 수 없습니다." };
      }
      var rawPath = trimmed.split(/[?#]/)[0];
      var decodedPath;
      try {
        decodedPath = decodeURIComponent(rawPath);
      } catch (_err) {
        return { valid: false, reason: "올바르지 않은 썸네일 상대 경로입니다." };
      }
      if (
        decodedPath.indexOf("\\") !== -1
        || /(?:^|\/)\.\.(?:\/|$)/.test(rawPath)
        || /(?:^|\/)\.\.(?:\/|$)/.test(decodedPath)
      ) {
        return { valid: false, reason: "썸네일 경로에 상위 경로 이동(..)은 사용할 수 없습니다." };
      }
      var subPath = decodedPath.slice(2);
      if (!subPath || /^(?:\.\/)*\.?$/.test(subPath)) {
        return { valid: false, reason: "올바른 ./ 썸네일 경로를 입력해 주세요." };
      }
      return { valid: true };
    }

    if (lower.indexOf("https://") === 0 || lower.indexOf("http://") === 0) {
      try {
        var parsedUrl = new URL(trimmed);
        if ((parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") || !parsedUrl.hostname) {
          return { valid: false, reason: "올바른 썸네일 웹 주소(https:// 또는 http://)를 입력해 주세요." };
        }
        return { valid: true };
      } catch (_urlErr) {
        return { valid: false, reason: "올바른 썸네일 웹 주소(https:// 또는 http://)를 입력해 주세요." };
      }
    }

    return {
      valid: false,
      reason: "썸네일은 https://, http://, ./ 상대 경로 또는 지원되는 이미지 파일만 사용할 수 있습니다."
    };
  }

  function splitDescriptionLines(rawText) {
    if (typeof rawText !== "string") {
      return [];
    }
    var lines = rawText.split(/\r?\n/);
    var cleaned = [];
    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i].trim();
      if (line) {
        cleaned.push(line);
      }
    }
    return cleaned;
  }

  function collectSuggestionTags(apps) {
    var seen = Object.create(null);
    var tags = [];
    for (var i = 0; i < BASE_CATEGORY_CHIPS.length; i += 1) {
      var baseTag = BASE_CATEGORY_CHIPS[i];
      if (!seen[baseTag]) {
        seen[baseTag] = true;
        tags.push(baseTag);
      }
    }
    var list = Array.isArray(apps) ? apps : [];
    for (var j = 0; j < list.length; j += 1) {
      var app = list[j];
      if (!app || !Array.isArray(app.tags)) {
        continue;
      }
      for (var k = 0; k < app.tags.length; k += 1) {
        var tag = typeof app.tags[k] === "string" ? app.tags[k].trim() : "";
        if (tag && !seen[tag]) {
          seen[tag] = true;
          tags.push(tag);
        }
      }
    }
    return tags;
  }

  function createFieldGroup(labelText, controlEl, htmlFor, hintText) {
    var label = el("label", {
      className: "admin-field-label",
      text: labelText,
      attrs: htmlFor ? { "for": htmlFor } : undefined
    });
    var children = [label, controlEl];
    if (hintText) {
      children.push(el("p", { className: "admin-field-hint", text: hintText }));
    }
    return el("div", {
      className: "admin-field",
      children: children
    });
  }

  function createSelect(id, choices, defaultValue) {
    var select = el("select", {
      className: "admin-select",
      attrs: { id: id }
    });
    for (var i = 0; i < choices.length; i += 1) {
      var opt = el("option", {
        text: choices[i].label,
        props: { value: choices[i].value }
      });
      select.appendChild(opt);
    }
    select.value = defaultValue;
    return select;
  }

  /**
   * Initializes the Admin Mode controller for modal authentication, app editing, URL recommendation, and GitHub publish.
   */
  function initAdmin(options) {
    var opts = options && typeof options === "object" ? options : {};
    var modalEl = opts.modalEl || null;
    var getApps = typeof opts.getApps === "function" ? opts.getApps : function () { return []; };
    var getConfig = typeof opts.getConfig === "function" ? opts.getConfig : function () { return {}; };
    var onAppsChanged = typeof opts.onAppsChanged === "function" ? opts.onAppsChanged : function () {};
    var onAuthChanged = typeof opts.onAuthChanged === "function" ? opts.onAuthChanged : function () {};
    var onToast = typeof opts.onToast === "function" ? opts.onToast : function () {};
    var onOpenChange = typeof opts.onOpenChange === "function" ? opts.onOpenChange : function () {};

    function readSessionUnlocked() {
      try {
        var session = getSafeStorage("sessionStorage");
        return Boolean(session && typeof session.getItem === "function" && session.getItem(SESSION_UNLOCK_KEY) === "true");
      } catch (_err) {
        return false;
      }
    }

    function writeSessionUnlocked(value) {
      try {
        var session = getSafeStorage("sessionStorage");
        if (!session) {
          return;
        }
        if (value && typeof session.setItem === "function") {
          session.setItem(SESSION_UNLOCK_KEY, "true");
        } else if (!value && typeof session.removeItem === "function") {
          session.removeItem(SESSION_UNLOCK_KEY);
        }
      } catch (_err) {
        // Keep in-memory unlock state if sessionStorage is restricted
      }
    }

    var unlocked = readSessionUnlocked();
    var modalOpen = false;
    var lastFocusedEl = null;

    var editingAppId = null;
    var idManuallyEdited = false;
    var pendingThumbDataUrl = "";
    var currentInspectResult = null;
    var inspectEpoch = 0;
    var publishEpoch = 0;

    function isUnlocked() {
      return unlocked;
    }

    function isOpen() {
      return Boolean(modalOpen && modalEl && !modalEl.hidden);
    }

    function syncOverlayState(openNow) {
      modalOpen = openNow;
      if (modalEl) {
        modalEl.hidden = !openNow;
        modalEl.setAttribute("aria-hidden", openNow ? "false" : "true");
      }
      onOpenChange(openNow);
    }

    function close() {
      if (!modalEl) {
        modalOpen = false;
        return;
      }
      inspectEpoch += 1;
      publishEpoch += 1;
      syncOverlayState(false);
      clearNode(modalEl);
      if (lastFocusedEl && typeof lastFocusedEl.focus === "function" && lastFocusedEl.isConnected !== false) {
        lastFocusedEl.focus();
      }
      lastFocusedEl = null;
    }

    function lock() {
      unlocked = false;
      writeSessionUnlocked(false);
      publishEpoch += 1;
      if (isOpen()) {
        close();
      }
      onAuthChanged(false);
      onToast("관리자 모드가 잠겼습니다.");
    }

    function renderAuthPrompt() {
      if (!modalEl) {
        return;
      }
      clearNode(modalEl);

      var backdrop = el("div", {
        className: "modal-backdrop",
        on: { click: close }
      });

      var closeBtn = el("button", {
        className: "modal-close admin-close-btn",
        text: "\u00D7",
        props: { type: "button" },
        attrs: { id: "admin-close-btn", "aria-label": "닫기" },
        on: { click: close }
      });

      var pwInput = el("input", {
        className: "admin-input",
        attrs: {
          id: "admin-password-input",
          type: "password",
          autocomplete: "current-password",
          placeholder: "관리자 비밀번호 입력"
        }
      });

      var errorEl = el("p", {
        className: "admin-error-msg",
        attrs: { id: "admin-auth-error", role: "alert" }
      });

      var submitBtn = el("button", {
        className: "btn-primary",
        text: "확인",
        props: { type: "submit" }
      });

      var cancelBtn = el("button", {
        className: "btn-secondary",
        text: "취소",
        props: { type: "button" },
        on: { click: close }
      });

      var form = el("form", {
        className: "admin-auth-form",
        on: {
          submit: function (event) {
            if (event && typeof event.preventDefault === "function") {
              event.preventDefault();
            }
            if (verifyAdminPassword(pwInput.value)) {
              errorEl.textContent = "";
              unlocked = true;
              writeSessionUnlocked(true);
              onAuthChanged(true);
              renderAdminPanel();
            } else {
              errorEl.textContent = "비밀번호가 올바르지 않습니다.";
              if (typeof pwInput.focus === "function") {
                pwInput.focus();
              }
              if (typeof pwInput.select === "function") {
                pwInput.select();
              }
            }
          }
        },
        children: [
          createFieldGroup("비밀번호", pwInput, "admin-password-input"),
          errorEl,
          el("div", {
            className: "admin-auth-actions",
            children: [cancelBtn, submitBtn]
          })
        ]
      });

      var authBox = el("div", {
        className: "admin-auth-box",
        children: [
          el("h2", {
            className: "admin-auth-title",
            text: "관리자 모드 인증",
            attrs: { id: "admin-auth-title" }
          }),
          el("p", {
            className: "admin-auth-desc",
            text: "웹앱을 등록·수정하거나 GitHub에 게시하려면 관리자 비밀번호를 입력하세요."
          }),
          form
        ]
      });

      var dialog = el("div", {
        className: "modal-dialog admin-auth-dialog",
        attrs: {
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "admin-auth-title"
        },
        children: [closeBtn, authBox]
      });

      modalEl.appendChild(backdrop);
      modalEl.appendChild(dialog);

      if (typeof pwInput.focus === "function") {
        pwInput.focus();
      }
    }

    function renderAdminPanel() {
      if (!modalEl) {
        return;
      }
      clearNode(modalEl);

      publishEpoch += 1;
      editingAppId = null;
      idManuallyEdited = false;
      pendingThumbDataUrl = "";
      currentInspectResult = null;

      var backdrop = el("div", {
        className: "modal-backdrop",
        on: { click: close }
      });

      var headerBar = el("header", {
        className: "admin-panel-header",
        children: [
          el("div", {
            className: "admin-panel-title-wrap",
            children: [
              el("h2", {
                className: "admin-panel-title",
                text: "관리자 패널",
                attrs: { id: "admin-panel-title" }
              }),
              el("p", {
                className: "admin-panel-subtitle",
                text: "링크를 입력하면 추천 문구와 실행 방식을 자동으로 제안합니다."
              })
            ]
          }),
          el("div", {
            className: "admin-panel-header-actions",
            children: [
              el("button", {
                className: "btn-admin-lock",
                text: "잠금",
                props: { type: "button" },
                on: { click: lock }
              }),
              el("button", {
                className: "modal-close admin-close-btn",
                text: "\u00D7",
                props: { type: "button" },
                attrs: { id: "admin-close-btn", "aria-label": "닫기" },
                on: { click: close }
              })
            ]
          })
        ]
      });

      // Registered Apps List
      var appListItemsEl = el("div", { className: "admin-app-list-items" });

      // URL & Recommender Controls
      var urlInput = el("input", {
        className: "admin-input",
        attrs: {
          id: "admin-app-url",
          type: "text",
          placeholder: "https://... 또는 ./apps/my-app/index.html"
        }
      });

      var checkUrlBtn = el("button", {
        className: "btn-secondary admin-check-url-btn",
        text: "링크 확인 및 추천 문구 생성",
        props: { type: "button" },
        attrs: { id: "admin-check-url-btn" }
      });

      var urlStatusEl = el("p", {
        className: "admin-url-status",
        attrs: { id: "admin-url-status", role: "status" }
      });

      var recTitleEl = el("strong", { className: "admin-rec-value" });
      var recTaglineEl = el("span", { className: "admin-rec-value" });
      var recPurposeEl = el("span", { className: "admin-rec-value" });
      var recAudienceEl = el("span", { className: "admin-rec-value" });
      var recDescEl = el("ul", { className: "admin-rec-desc-list" });
      var recTagsEl = el("span", { className: "admin-rec-value" });

      var applyRecBtn = el("button", {
        className: "btn-primary admin-apply-rec-btn",
        text: "추천 문구 적용",
        props: { type: "button" },
        attrs: { id: "admin-apply-rec-btn" }
      });

      var recBoxEl = el("div", {
        className: "admin-rec-box",
        props: { hidden: true },
        attrs: { id: "admin-rec-box" },
        children: [
          el("div", {
            className: "admin-rec-header",
            children: [
              el("span", { className: "admin-rec-badge", text: "추천 문구 미리보기" }),
              applyRecBtn
            ]
          }),
          el("dl", {
            className: "admin-rec-grid",
            children: [
              el("dt", { text: "제목" }),
              el("dd", { children: [recTitleEl] }),
              el("dt", { text: "한 줄 소개" }),
              el("dd", { children: [recTaglineEl] }),
              el("dt", { text: "목적" }),
              el("dd", { children: [recPurposeEl] }),
              el("dt", { text: "추천 대상" }),
              el("dd", { children: [recAudienceEl] }),
              el("dt", { text: "추천 카테고리" }),
              el("dd", { children: [recTagsEl] }),
              el("dt", { text: "주요 내용" }),
              el("dd", { children: [recDescEl] })
            ]
          })
        ]
      });

      // Metadata Form Fields
      var idInput = el("input", {
        className: "admin-input",
        attrs: {
          id: "admin-app-id",
          type: "text",
          placeholder: "영문 소문자·숫자·하이픈 (예: focus-timer)"
        }
      });

      var titleInput = el("input", {
        className: "admin-input",
        attrs: {
          id: "admin-app-title",
          type: "text",
          placeholder: "앱 이름"
        }
      });

      var taglineInput = el("input", {
        className: "admin-input",
        attrs: {
          id: "admin-app-tagline",
          type: "text",
          placeholder: "한 줄 소개"
        }
      });

      var tagsInput = el("input", {
        className: "admin-input",
        attrs: {
          id: "admin-app-tags",
          type: "text",
          placeholder: "쉼표(,)로 구분 (예: 교육, 일상생활)"
        }
      });

      var tagSuggestionsEl = el("div", { className: "admin-tag-suggestions" });

      var purposeInput = el("textarea", {
        className: "admin-textarea",
        attrs: {
          id: "admin-app-purpose",
          rows: "2",
          placeholder: "이 앱을 만든 목적을 입력하세요"
        }
      });

      var audienceInput = el("input", {
        className: "admin-input",
        attrs: {
          id: "admin-app-audience",
          type: "text",
          placeholder: "예: 초·중학생, 영어 교사, 자기주도 학습자"
        }
      });

      var descInput = el("textarea", {
        className: "admin-textarea",
        attrs: {
          id: "admin-app-description",
          rows: "4",
          placeholder: "주요 내용 및 사용법을 한 줄에 하나씩 입력하세요"
        }
      });

      var launchTypeSelect = createSelect(
        "admin-launch-type",
        [
          { value: "external", label: "웹 링크 (외부 URL)" },
          { value: "embedded", label: "직접 탑재 (./apps/...)" }
        ],
        "external"
      );

      var embedModeSelect = createSelect(
        "admin-embed-mode",
        [
          { value: "iframe", label: "포트폴리오 안에서 실행 (iframe)" },
          { value: "newTab", label: "새 탭에서 열기" }
        ],
        "newTab"
      );

      var featuredCheckbox = el("input", {
        className: "admin-checkbox",
        attrs: { id: "admin-featured", type: "checkbox" }
      });

      // Thumbnail Controls & Live Preview
      var thumbUrlInput = el("input", {
        className: "admin-input",
        attrs: {
          id: "admin-thumb-url",
          type: "text",
          placeholder: "./assets/thumbnails/... 또는 https://..."
        }
      });

      var thumbFileInput = el("input", {
        className: "admin-file-input",
        attrs: {
          id: "admin-thumb-file",
          type: "file",
          accept: ".png,.jpg,.jpeg,.webp,.gif,.svg"
        }
      });

      var clearThumbBtn = el("button", {
        className: "btn-secondary admin-thumb-clear-btn",
        text: "썸네일 지우기",
        props: { type: "button" },
        attrs: { id: "admin-thumb-clear-btn" }
      });

      var thumbFileRow = el("div", {
        className: "admin-thumb-file-row",
        children: [thumbFileInput, clearThumbBtn]
      });

      var thumbFileNoteEl = el("span", { className: "admin-thumb-file-note" });

      var thumbFitSelect = createSelect(
        "admin-thumb-fit",
        [
          { value: "auto", label: "자동 맞춤 · 권장" },
          { value: "cover", label: "꽉 채우기" },
          { value: "contain", label: "전체 보기 + 블러 배경" }
        ],
        "auto"
      );

      var thumbPreviewEl = el("div", {
        className: "admin-thumb-preview",
        attrs: { id: "admin-thumb-preview" }
      });

      var formErrorEl = el("p", {
        className: "admin-error-msg",
        attrs: { id: "admin-form-error", role: "alert" }
      });

      // GitHub Sync Settings & Footer Actions
      var savedGh = loadGitHubSettings();
      var ghOwnerInput = el("input", {
        className: "admin-input",
        props: { value: savedGh.owner },
        attrs: { id: "admin-github-owner", type: "text" }
      });
      var ghRepoInput = el("input", {
        className: "admin-input",
        props: { value: savedGh.repo },
        attrs: { id: "admin-github-repo", type: "text" }
      });
      var ghBranchInput = el("input", {
        className: "admin-input",
        props: { value: savedGh.branch },
        attrs: { id: "admin-github-branch", type: "text" }
      });
      var ghTokenInput = el("input", {
        className: "admin-input",
        props: { value: savedGh.token },
        attrs: {
          id: "admin-github-token",
          type: "password",
          autocomplete: "off",
          placeholder: "GitHub Personal Access Token (Contents: Read & Write)"
        }
      });
      var ghStatusEl = el("p", {
        className: "admin-github-status",
        attrs: { id: "admin-github-status", role: "status" }
      });

      function persistGhInputs() {
        saveGitHubSettings({
          owner: ghOwnerInput.value,
          repo: ghRepoInput.value,
          branch: ghBranchInput.value,
          token: ghTokenInput.value
        });
      }

      ghOwnerInput.addEventListener("change", persistGhInputs);
      ghRepoInput.addEventListener("change", persistGhInputs);
      ghBranchInput.addEventListener("change", persistGhInputs);
      ghTokenInput.addEventListener("change", persistGhInputs);

      var githubDetailsEl = el("details", {
        className: "admin-github-details",
        children: [
          el("summary", {
            className: "admin-github-summary",
            text: "GitHub 자동 게시 설정 (토큰·저장소)"
          }),
          el("div", {
            className: "admin-github-fields",
            children: [
              el("div", {
                className: "admin-row-3",
                children: [
                  createFieldGroup("Owner", ghOwnerInput, "admin-github-owner"),
                  createFieldGroup("Repository", ghRepoInput, "admin-github-repo"),
                  createFieldGroup("Branch", ghBranchInput, "admin-github-branch")
                ]
              }),
              createFieldGroup(
                "Personal Access Token",
                ghTokenInput,
                "admin-github-token",
                "토큰은 이 브라우저의 localStorage에만 저장되며 코드나 data/apps.js에는 포함되지 않습니다."
              ),
              ghStatusEl
            ]
          })
        ]
      });

      function updateThumbFileNote() {
        if (pendingThumbDataUrl) {
          thumbFileNoteEl.textContent = "업로드 이미지 선택됨 (게시 시 assets/thumbnails/에 자동 저장)";
        } else {
          thumbFileNoteEl.textContent = "";
        }
      }

      function updateThumbPreview() {
        clearNode(thumbPreviewEl);
        var activeThumb = pendingThumbDataUrl || thumbUrlInput.value.trim();
        var previewApp = {
          title: titleInput.value.trim() || "새 웹앱",
          thumbnail: activeThumb,
          thumbnailFit: thumbFitSelect.value || "auto"
        };
        if (global.PortfolioRender && typeof global.PortfolioRender.buildThumbnailFrame === "function") {
          var frame = global.PortfolioRender.buildThumbnailFrame(
            "app-card-thumb",
            "app-card-img",
            previewApp,
            false
          );
          thumbPreviewEl.appendChild(frame);
        }
      }

      function renderTagSuggestionChips() {
        clearNode(tagSuggestionsEl);
        var allTags = collectSuggestionTags(getApps());
        var selectedTags = normalizeTagsInput(tagsInput.value);
        var selectedMap = Object.create(null);
        for (var s = 0; s < selectedTags.length; s += 1) {
          selectedMap[selectedTags[s]] = true;
        }

        for (var i = 0; i < allTags.length; i += 1) {
          (function (tag) {
            var isActive = Boolean(selectedMap[tag]);
            var chip = el("button", {
              className: isActive ? "admin-tag-chip is-active" : "admin-tag-chip",
              text: tag,
              props: { type: "button" },
              attrs: {
                "data-suggest-tag": tag,
                "aria-pressed": isActive ? "true" : "false"
              },
              on: {
                click: function () {
                  var current = normalizeTagsInput(tagsInput.value);
                  var next = [];
                  var existed = false;
                  for (var j = 0; j < current.length; j += 1) {
                    if (current[j] === tag) {
                      existed = true;
                    } else {
                      next.push(current[j]);
                    }
                  }
                  if (!existed) {
                    next.push(tag);
                  }
                  tagsInput.value = next.join(", ");
                  renderTagSuggestionChips();
                }
              }
            });
            tagSuggestionsEl.appendChild(chip);
          })(allTags[i]);
        }
      }

      function resetFormToNew() {
        editingAppId = null;
        idManuallyEdited = false;
        pendingThumbDataUrl = "";
        currentInspectResult = null;
        urlInput.value = "";
        urlStatusEl.textContent = "";
        urlStatusEl.className = "admin-url-status";
        recBoxEl.hidden = true;
        idInput.value = "";
        titleInput.value = "";
        taglineInput.value = "";
        tagsInput.value = "";
        purposeInput.value = "";
        audienceInput.value = "";
        descInput.value = "";
        launchTypeSelect.value = "external";
        embedModeSelect.value = "newTab";
        featuredCheckbox.checked = false;
        thumbUrlInput.value = "";
        thumbFileInput.value = "";
        thumbFitSelect.value = "auto";
        formErrorEl.textContent = "";
        updateThumbFileNote();
        renderTagSuggestionChips();
        updateThumbPreview();
        renderRegisteredAppsList();
      }

      function loadAppIntoForm(app) {
        if (!app) {
          return;
        }
        editingAppId = app.id || null;
        idManuallyEdited = true;
        currentInspectResult = null;
        urlStatusEl.textContent = "";
        urlStatusEl.className = "admin-url-status";
        recBoxEl.hidden = true;
        formErrorEl.textContent = "";

        urlInput.value = app.url || "";
        idInput.value = app.id || "";
        titleInput.value = app.title || "";
        taglineInput.value = app.tagline || "";
        tagsInput.value = Array.isArray(app.tags) ? app.tags.join(", ") : "";
        purposeInput.value = app.purpose || "";
        audienceInput.value = app.audience || "";
        descInput.value = Array.isArray(app.description)
          ? app.description.join("\n")
          : (typeof app.description === "string" ? app.description : "");
        launchTypeSelect.value = app.launchType === "embedded" ? "embedded" : "external";
        embedModeSelect.value = app.embedMode === "iframe" ? "iframe" : "newTab";
        featuredCheckbox.checked = Boolean(app.featured);

        if (app._pendingThumbDataUrl || isDataImageUrl(app.thumbnail)) {
          pendingThumbDataUrl = app._pendingThumbDataUrl || app.thumbnail;
          thumbUrlInput.value = "";
        } else {
          pendingThumbDataUrl = "";
          thumbUrlInput.value = app.thumbnail || "";
        }
        thumbFileInput.value = "";
        thumbFitSelect.value = app.thumbnailFit === "cover" || app.thumbnailFit === "contain"
          ? app.thumbnailFit
          : "auto";

        updateThumbFileNote();
        renderTagSuggestionChips();
        updateThumbPreview();
        renderRegisteredAppsList();
      }

      function renderRegisteredAppsList() {
        clearNode(appListItemsEl);
        var apps = Array.isArray(getApps()) ? getApps() : [];
        if (apps.length === 0) {
          appListItemsEl.appendChild(
            el("p", {
              className: "admin-app-list-empty",
              text: "등록된 웹앱이 없습니다. 아래에서 새 웹앱을 등록해 보세요."
            })
          );
          return;
        }

        for (var i = 0; i < apps.length; i += 1) {
          (function (app) {
            if (!app) {
              return;
            }
            var isSelected = editingAppId && app.id === editingAppId;
            var selectBtn = el("button", {
              className: isSelected ? "admin-app-item-select is-active" : "admin-app-item-select",
              props: { type: "button" },
              on: {
                click: function () {
                  loadAppIntoForm(app);
                }
              },
              children: [
                el("span", { className: "admin-app-item-title", text: app.title || app.id || "제목 없음" }),
                el("span", {
                  className: "admin-app-item-meta",
                  text: (app.launchType === "embedded" ? "직접 탑재" : "웹 링크") + " · " + (app.id || "")
                })
              ]
            });

            var deleteBtn = el("button", {
              className: "admin-app-delete-btn",
              text: "삭제",
              props: { type: "button" },
              attrs: { "data-app-id": app.id || "" },
              on: {
                click: function () {
                  var currentList = Array.isArray(getApps()) ? getApps() : [];
                  var nextList = [];
                  for (var j = 0; j < currentList.length; j += 1) {
                    if (currentList[j] && currentList[j].id !== app.id) {
                      nextList.push(currentList[j]);
                    }
                  }
                  saveDraftApps(nextList);
                  onAppsChanged(nextList);
                  if (editingAppId === app.id) {
                    resetFormToNew();
                  } else {
                    renderRegisteredAppsList();
                    renderTagSuggestionChips();
                  }
                  onToast("웹앱이 삭제되었습니다. (로컬 미리보기)");
                }
              }
            });

            appListItemsEl.appendChild(
              el("div", {
                className: "admin-app-item",
                children: [selectBtn, deleteBtn]
              })
            );
          })(apps[i]);
        }
      }

      // Wire Live Form Events
      idInput.addEventListener("input", function () {
        idManuallyEdited = true;
      });

      titleInput.addEventListener("input", function () {
        if (!editingAppId && !idManuallyEdited) {
          var suggested = slugifyId(titleInput.value);
          if (suggested) {
            idInput.value = suggested;
          }
        }
        updateThumbPreview();
      });

      tagsInput.addEventListener("input", renderTagSuggestionChips);

      thumbUrlInput.addEventListener("input", function () {
        if (thumbUrlInput.value.trim()) {
          pendingThumbDataUrl = "";
          updateThumbFileNote();
        }
        updateThumbPreview();
      });

      thumbFitSelect.addEventListener("change", updateThumbPreview);

      thumbFileInput.addEventListener("change", function () {
        var file = thumbFileInput.files && thumbFileInput.files[0];
        if (!file) {
          return;
        }
        var ReaderCtor = global.FileReader || (typeof FileReader !== "undefined" ? FileReader : null);
        if (!ReaderCtor) {
          formErrorEl.textContent = "이 브라우저에서는 이미지 파일 읽기를 지원하지 않습니다.";
          return;
        }
        var reader = new ReaderCtor();
        reader.onload = function () {
          var result = typeof reader.result === "string" ? reader.result : "";
          var parsed = global.PortfolioGitHubSync && typeof global.PortfolioGitHubSync.parseDataUrlBase64 === "function"
            ? global.PortfolioGitHubSync.parseDataUrlBase64(result)
            : null;
          if (!parsed) {
            pendingThumbDataUrl = "";
            thumbFileInput.value = "";
            updateThumbFileNote();
            updateThumbPreview();
            formErrorEl.textContent = "지원되지 않는 이미지 형식입니다. PNG, JPG, WebP, GIF, SVG 파일만 업로드할 수 있습니다.";
            return;
          }
          formErrorEl.textContent = "";
          pendingThumbDataUrl = result;
          thumbUrlInput.value = "";
          updateThumbFileNote();
          updateThumbPreview();
        };
        reader.onerror = function () {
          formErrorEl.textContent = "이미지 파일을 읽는 중 오류가 발생했습니다.";
        };
        reader.readAsDataURL(file);
      });

      clearThumbBtn.addEventListener("click", function () {
        pendingThumbDataUrl = "";
        thumbUrlInput.value = "";
        thumbFileInput.value = "";
        formErrorEl.textContent = "";
        updateThumbFileNote();
        updateThumbPreview();
      });

      // URL Inspection & Recommendation Apply
      checkUrlBtn.addEventListener("click", async function () {
        if (!global.PortfolioRecommender || typeof global.PortfolioRecommender.inspectWebAppUrl !== "function") {
          urlStatusEl.textContent = "추천 분석 모듈을 불러오지 못했습니다.";
          urlStatusEl.className = "admin-url-status is-error";
          return;
        }

        var rawUrl = urlInput.value;
        var myEpoch = ++inspectEpoch;
        checkUrlBtn.disabled = true;
        urlStatusEl.textContent = "웹앱 링크를 확인하고 추천 문구를 생성하는 중...";
        urlStatusEl.className = "admin-url-status is-loading";

        try {
          var loc = global.location || {};
          var result = await global.PortfolioRecommender.inspectWebAppUrl(rawUrl, {
            currentOrigin: loc.origin || "",
            baseHref: loc.href || ""
          });
          if (myEpoch !== inspectEpoch || !isOpen()) {
            return;
          }

          currentInspectResult = result;
          if (result.normalizedUrl) {
            urlInput.value = result.normalizedUrl;
          }
          urlStatusEl.textContent = result.statusMessage || "";
          if (result.status === "analyzed") {
            urlStatusEl.className = "admin-url-status is-ok";
          } else if (result.status === "cors-limited" || result.status === "unreachable") {
            urlStatusEl.className = "admin-url-status is-warn";
          } else {
            urlStatusEl.className = "admin-url-status is-error";
          }

          var rec = result.recommendations;
          if (rec) {
            recTitleEl.textContent = rec.title || "";
            recTaglineEl.textContent = rec.tagline || "";
            recPurposeEl.textContent = rec.purpose || "";
            recAudienceEl.textContent = rec.audience || "";
            recTagsEl.textContent = Array.isArray(rec.suggestedTags) ? rec.suggestedTags.join(", ") : "";
            clearNode(recDescEl);
            var recLines = Array.isArray(rec.description) ? rec.description : [];
            for (var r = 0; r < recLines.length; r += 1) {
              recDescEl.appendChild(el("li", { text: recLines[r] }));
            }
            recBoxEl.hidden = false;
          } else {
            recBoxEl.hidden = true;
          }
        } catch (_err) {
          if (myEpoch !== inspectEpoch || !isOpen()) {
            return;
          }
          urlStatusEl.textContent = "링크 확인 중 오류가 발생했습니다.";
          urlStatusEl.className = "admin-url-status is-error";
          recBoxEl.hidden = true;
        } finally {
          checkUrlBtn.disabled = false;
        }
      });

      applyRecBtn.addEventListener("click", function () {
        var rec = currentInspectResult && currentInspectResult.recommendations;
        if (!rec) {
          return;
        }
        if (!editingAppId && (!idManuallyEdited || !idInput.value.trim()) && rec.id) {
          idInput.value = rec.id;
        }
        if (rec.title) {
          titleInput.value = rec.title;
        }
        if (rec.tagline) {
          taglineInput.value = rec.tagline;
        }
        if (rec.purpose) {
          purposeInput.value = rec.purpose;
        }
        if (rec.audience) {
          audienceInput.value = rec.audience;
        }
        if (Array.isArray(rec.description)) {
          descInput.value = rec.description.join("\n");
        }
        if (Array.isArray(rec.suggestedTags)) {
          tagsInput.value = rec.suggestedTags.join(", ");
        }
        if (currentInspectResult.launchType) {
          launchTypeSelect.value = currentInspectResult.launchType === "embedded" ? "embedded" : "external";
        }
        if (rec.embedMode) {
          embedModeSelect.value = rec.embedMode === "iframe" ? "iframe" : "newTab";
        }
        renderTagSuggestionChips();
        updateThumbPreview();
        onToast("추천 문구를 입력 양식에 적용했습니다.");
      });

      function buildValidatedAppFromForm(existingApps) {
        formErrorEl.textContent = "";
        var idVal = idInput.value.trim();
        var urlVal = urlInput.value.trim();
        var titleVal = titleInput.value.trim();
        var taglineVal = taglineInput.value.trim();
        var purposeVal = purposeInput.value.trim();
        var audienceVal = audienceInput.value.trim();
        var descLines = splitDescriptionLines(descInput.value);
        var tagsList = normalizeTagsInput(tagsInput.value);

        if (!idVal || !/^[a-z0-9-]+$/.test(idVal)) {
          formErrorEl.textContent = "앱 ID는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.";
          return null;
        }

        var list = Array.isArray(existingApps) ? existingApps : [];
        var existingRecord = null;
        for (var i = 0; i < list.length; i += 1) {
          var item = list[i];
          if (!item) {
            continue;
          }
          if (item.id === editingAppId) {
            existingRecord = item;
          }
          if (item.id === idVal && idVal !== editingAppId) {
            formErrorEl.textContent = "이미 사용 중인 앱 ID입니다. 다른 ID를 입력해 주세요.";
            return null;
          }
        }

        var normalizedUrl = urlVal;
        var detectedLaunchType = launchTypeSelect.value === "embedded" ? "embedded" : "external";
        if (global.PortfolioRecommender && typeof global.PortfolioRecommender.validateAppUrl === "function") {
          var urlCheck = global.PortfolioRecommender.validateAppUrl(urlVal);
          if (!urlCheck.valid) {
            formErrorEl.textContent = urlCheck.reason || "올바른 웹앱 링크를 입력해 주세요.";
            return null;
          }
          normalizedUrl = urlCheck.normalizedUrl;
          detectedLaunchType = urlCheck.launchType;
        } else if (!urlVal || (urlVal.indexOf("https://") !== 0 && urlVal.indexOf("http://") !== 0 && urlVal.indexOf("./apps/") !== 0)) {
          formErrorEl.textContent = "https://, http:// 또는 ./apps/ 형식의 웹앱 링크를 입력해 주세요.";
          return null;
        }

        if (!titleVal) {
          formErrorEl.textContent = "앱 이름을 입력해 주세요.";
          return null;
        }
        if (!taglineVal) {
          formErrorEl.textContent = "한 줄 소개를 입력해 주세요.";
          return null;
        }
        if (!purposeVal) {
          formErrorEl.textContent = "이 앱의 목적을 입력해 주세요.";
          return null;
        }
        if (!audienceVal) {
          formErrorEl.textContent = "추천 대상을 입력해 주세요.";
          return null;
        }
        if (descLines.length === 0) {
          formErrorEl.textContent = "주요 내용 및 사용법을 1줄 이상 입력해 주세요.";
          return null;
        }

        var thumbVal = pendingThumbDataUrl || thumbUrlInput.value.trim();
        var thumbCheck = validateThumbnailUrl(thumbVal);
        if (!thumbCheck.valid) {
          formErrorEl.textContent = thumbCheck.reason;
          return null;
        }
        var fitVal = thumbFitSelect.value === "cover" || thumbFitSelect.value === "contain"
          ? thumbFitSelect.value
          : "auto";
        var embedVal = embedModeSelect.value === "iframe" ? "iframe" : "newTab";
        var launchVal = launchTypeSelect.value === "embedded" || launchTypeSelect.value === "external"
          ? launchTypeSelect.value
          : detectedLaunchType;

        var record = {
          id: idVal,
          title: titleVal,
          tagline: taglineVal,
          purpose: purposeVal,
          audience: audienceVal,
          description: descLines,
          thumbnail: thumbVal,
          thumbnailFit: fitVal,
          launchType: launchVal,
          url: normalizedUrl,
          embedMode: embedVal,
          tags: tagsList,
          featured: Boolean(featuredCheckbox.checked),
          createdAt: existingRecord && existingRecord.createdAt
            ? existingRecord.createdAt
            : new Date().toISOString().slice(0, 10)
        };

        if (pendingThumbDataUrl) {
          record._pendingThumbDataUrl = pendingThumbDataUrl;
        } else if (isDataImageUrl(thumbVal)) {
          record._pendingThumbDataUrl = thumbVal;
        }

        return record;
      }

      function upsertAppRecord(appsList, newRecord) {
        var next = [];
        var replaced = false;
        for (var i = 0; i < appsList.length; i += 1) {
          var item = appsList[i];
          if (!item) {
            continue;
          }
          if (editingAppId && item.id === editingAppId) {
            next.push(newRecord);
            replaced = true;
          } else {
            next.push(item);
          }
        }
        if (!replaced) {
          next.push(newRecord);
        }
        return next;
      }

      function hasAnyFormInput() {
        return Boolean(
          urlInput.value.trim() ||
          idInput.value.trim() ||
          titleInput.value.trim() ||
          taglineInput.value.trim() ||
          purposeInput.value.trim() ||
          audienceInput.value.trim() ||
          descInput.value.trim()
        );
      }

      // Footer Buttons
      var saveDraftBtn = el("button", {
        className: "btn-primary",
        text: "로컬 미리보기에 저장",
        props: { type: "button" },
        attrs: { id: "admin-save-draft-btn" },
        on: {
          click: function () {
            var currentList = Array.isArray(getApps()) ? getApps() : [];
            var record = buildValidatedAppFromForm(currentList);
            if (!record) {
              return;
            }
            var updated = upsertAppRecord(currentList, record);
            editingAppId = record.id;
            idManuallyEdited = true;
            var savedOk = saveDraftApps(updated);
            onAppsChanged(updated);
            renderRegisteredAppsList();
            renderTagSuggestionChips();
            if (savedOk) {
              onToast("로컬 미리보기에 저장되었습니다.");
            } else {
              onToast("화면에는 반영되었으나 브라우저 저장 공간이 부족합니다.");
            }
          }
        }
      });

      var publishBtn = el("button", {
        className: "btn-secondary admin-publish-btn",
        text: "GitHub에 게시",
        props: { type: "button" },
        attrs: { id: "admin-publish-btn" },
        on: {
          click: async function () {
            if (!global.PortfolioGitHubSync || typeof global.PortfolioGitHubSync.publishToGitHub !== "function") {
              ghStatusEl.textContent = "GitHub 동기화 모듈을 불러오지 못했습니다.";
              return;
            }

            persistGhInputs();
            var appsToPublish = Array.isArray(getApps()) ? getApps().slice() : [];
            var nextEditingId = editingAppId;
            var hasFormSubmission = hasAnyFormInput();
            if (hasFormSubmission) {
              var validated = buildValidatedAppFromForm(appsToPublish);
              if (!validated) {
                return;
              }
              appsToPublish = upsertAppRecord(appsToPublish, validated);
              nextEditingId = validated.id;
            }

            var pendingThumbnails = Object.create(null);
            for (var i = 0; i < appsToPublish.length; i += 1) {
              var item = appsToPublish[i];
              if (!item || !item.id) {
                continue;
              }
              if (item._pendingThumbDataUrl) {
                pendingThumbnails[item.id] = item._pendingThumbDataUrl;
              } else if (isDataImageUrl(item.thumbnail)) {
                pendingThumbnails[item.id] = item.thumbnail;
              }
            }

            var myPublishEpoch = ++publishEpoch;
            publishBtn.disabled = true;
            ghStatusEl.textContent = "GitHub에 게시하는 중...";
            ghStatusEl.className = "admin-github-status is-loading";
            githubDetailsEl.open = true;

            try {
              var result = await global.PortfolioGitHubSync.publishToGitHub({
                owner: ghOwnerInput.value,
                repo: ghRepoInput.value,
                branch: ghBranchInput.value,
                token: ghTokenInput.value,
                config: getConfig(),
                apps: appsToPublish,
                pendingThumbnails: pendingThumbnails
              });

              if (myPublishEpoch !== publishEpoch || !isOpen() || !isUnlocked()) {
                return;
              }

              if (hasFormSubmission) {
                editingAppId = nextEditingId;
                idManuallyEdited = true;
              }

              var publishedApps = Array.isArray(result.updatedApps) ? result.updatedApps : appsToPublish;
              global.PORTFOLIO_APPS = publishedApps.slice();
              clearDraftApps();
              onAppsChanged(publishedApps);

              if (editingAppId) {
                for (var j = 0; j < publishedApps.length; j += 1) {
                  if (publishedApps[j] && publishedApps[j].id === editingAppId) {
                    loadAppIntoForm(publishedApps[j]);
                    break;
                  }
                }
              } else {
                renderRegisteredAppsList();
                renderTagSuggestionChips();
              }

              var successMsg = "GitHub에 게시되었습니다. 약 20초 후 사이트에 반영됩니다.";
              ghStatusEl.textContent = successMsg;
              ghStatusEl.className = "admin-github-status is-ok";
              onToast(successMsg);
            } catch (err) {
              if (myPublishEpoch !== publishEpoch || !isOpen() || !isUnlocked()) {
                return;
              }
              var errMsg = err && err.message ? err.message : "GitHub 게시 중 오류가 발생했습니다.";
              ghStatusEl.textContent = errMsg;
              ghStatusEl.className = "admin-github-status is-error";
              onToast(errMsg);
            } finally {
              if (myPublishEpoch === publishEpoch) {
                publishBtn.disabled = false;
              }
            }
          }
        }
      });

      var downloadBtn = el("button", {
        className: "btn-secondary",
        text: "data/apps.js 다운로드",
        props: { type: "button" },
        attrs: { id: "admin-download-btn" },
        on: {
          click: function () {
            if (!global.PortfolioGitHubSync || typeof global.PortfolioGitHubSync.serializeAppsJs !== "function") {
              onToast("직렬화 모듈을 불러오지 못했습니다.");
              return;
            }
            var content = global.PortfolioGitHubSync.serializeAppsJs(getConfig(), getApps());
            var BlobCtor = global.Blob || (typeof Blob !== "undefined" ? Blob : null);
            var UrlApi = global.URL || (typeof URL !== "undefined" ? URL : null);
            if (!BlobCtor || !UrlApi || typeof UrlApi.createObjectURL !== "function") {
              onToast("이 환경에서는 파일 다운로드를 지원하지 않습니다.");
              return;
            }
            var blob = new BlobCtor([content], { type: "application/javascript;charset=utf-8" });
            var blobUrl = UrlApi.createObjectURL(blob);
            var anchor = el("a", {
              props: { href: blobUrl, download: "apps.js" }
            });
            if (document.body) {
              document.body.appendChild(anchor);
              if (typeof anchor.click === "function") {
                anchor.click();
              }
              document.body.removeChild(anchor);
            }
            if (typeof UrlApi.revokeObjectURL === "function") {
              UrlApi.revokeObjectURL(blobUrl);
            }
            onToast("apps.js 파일이 다운로드되었습니다.");
          }
        }
      });

      var resetDraftBtn = el("button", {
        className: "btn-secondary admin-reset-draft-btn",
        text: "로컬 미리보기 초기화",
        props: { type: "button" },
        attrs: { id: "admin-reset-draft-btn" },
        on: {
          click: function () {
            clearDraftApps();
            var baseApps = Array.isArray(global.PORTFOLIO_APPS) ? global.PORTFOLIO_APPS.slice() : [];
            onAppsChanged(baseApps);
            resetFormToNew();
            onToast("로컬 미리보기를 초기화했습니다.");
          }
        }
      });

      var newAppBtn = el("button", {
        className: "btn-secondary admin-new-app-btn",
        text: "+ 새 웹앱 등록",
        props: { type: "button" },
        attrs: { id: "admin-new-app-btn" },
        on: { click: resetFormToNew }
      });

      var appsSidebar = el("aside", {
        className: "admin-app-list",
        children: [
          el("div", {
            className: "admin-app-list-header",
            children: [
              el("h3", { className: "admin-section-title", text: "등록된 웹앱" }),
              newAppBtn
            ]
          }),
          appListItemsEl
        ]
      });

      var urlCheckRow = el("div", {
        className: "admin-url-row",
        children: [urlInput, checkUrlBtn]
      });

      var formArea = el("div", {
        className: "admin-form",
        children: [
          el("section", {
            className: "admin-form-section",
            children: [
              el("h3", { className: "admin-section-title", text: "1. 웹앱 링크 확인 및 추천 문구" }),
              createFieldGroup("웹앱 URL 또는 내부 경로", urlCheckRow, "admin-app-url"),
              urlStatusEl,
              recBoxEl
            ]
          }),
          el("section", {
            className: "admin-form-section",
            children: [
              el("h3", { className: "admin-section-title", text: "2. 기본 정보 및 카테고리" }),
              el("div", {
                className: "admin-row-2",
                children: [
                  createFieldGroup("앱 ID (영문 슬러그)", idInput, "admin-app-id"),
                  createFieldGroup("앱 이름", titleInput, "admin-app-title")
                ]
              }),
              createFieldGroup("한 줄 소개", taglineInput, "admin-app-tagline"),
              createFieldGroup(
                "카테고리 (쉼표로 구분)",
                tagsInput,
                "admin-app-tags",
                "아래 빠른 선택 버튼을 누르거나 원하는 카테고리를 직접 입력하세요."
              ),
              tagSuggestionsEl,
              createFieldGroup("이 앱의 목적", purposeInput, "admin-app-purpose"),
              createFieldGroup("추천 대상", audienceInput, "admin-app-audience"),
              createFieldGroup("주요 내용 및 사용법 (줄바꿈으로 항목 구분)", descInput, "admin-app-description"),
              el("div", {
                className: "admin-row-2",
                children: [
                  createFieldGroup("실행 유형", launchTypeSelect, "admin-launch-type"),
                  createFieldGroup("열기 방식", embedModeSelect, "admin-embed-mode")
                ]
              }),
              el("label", {
                className: "admin-checkbox-label",
                attrs: { "for": "admin-featured" },
                children: [
                  featuredCheckbox,
                  el("span", { text: "추천 웹앱으로 목록 상단에 우선 표시" })
                ]
              })
            ]
          }),
          el("section", {
            className: "admin-form-section",
            children: [
              el("h3", { className: "admin-section-title", text: "3. 썸네일 및 자동 맞춤 미리보기" }),
              el("div", {
                className: "admin-thumb-grid",
                children: [
                  el("div", {
                    className: "admin-thumb-controls",
                    children: [
                      createFieldGroup("썸네일 이미지 경로 / URL", thumbUrlInput, "admin-thumb-url"),
                      createFieldGroup("이미지 파일 업로드", thumbFileRow, "admin-thumb-file"),
                      thumbFileNoteEl,
                      createFieldGroup("썸네일 맞춤 방식", thumbFitSelect, "admin-thumb-fit")
                    ]
                  }),
                  el("div", {
                    className: "admin-thumb-preview-wrap",
                    children: [
                      el("span", { className: "admin-field-label", text: "16:9 카드 미리보기" }),
                      thumbPreviewEl
                    ]
                  })
                ]
              })
            ]
          }),
          formErrorEl,
          githubDetailsEl
        ]
      });

      var bodyLayout = el("div", {
        className: "admin-layout",
        children: [appsSidebar, formArea]
      });

      var footerActions = el("footer", {
        className: "admin-footer-actions",
        children: [saveDraftBtn, publishBtn, downloadBtn, resetDraftBtn]
      });

      var dialog = el("div", {
        className: "modal-dialog admin-dialog",
        attrs: {
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "admin-panel-title"
        },
        children: [headerBar, bodyLayout, footerActions]
      });

      modalEl.appendChild(backdrop);
      modalEl.appendChild(dialog);

      renderRegisteredAppsList();
      renderTagSuggestionChips();
      updateThumbPreview();

      if (typeof urlInput.focus === "function") {
        urlInput.focus();
      }
    }

    function open() {
      if (!modalEl) {
        return;
      }
      if (document.activeElement && typeof document.activeElement.focus === "function") {
        lastFocusedEl = document.activeElement;
      }
      syncOverlayState(true);
      if (unlocked) {
        renderAdminPanel();
      } else {
        renderAuthPrompt();
      }
    }

    return {
      isUnlocked: isUnlocked,
      open: open,
      close: close,
      lock: lock,
      isOpen: isOpen
    };
  }

  global.PortfolioAdmin = {
    sha256Hex: sha256Hex,
    verifyAdminPassword: verifyAdminPassword,
    normalizeTagsInput: normalizeTagsInput,
    loadDraftApps: loadDraftApps,
    saveDraftApps: saveDraftApps,
    clearDraftApps: clearDraftApps,
    hasDraftApps: hasDraftApps,
    initAdmin: initAdmin
  };
})(typeof window !== "undefined" ? window : globalThis);
