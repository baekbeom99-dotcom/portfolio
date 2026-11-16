(function (global) {
  "use strict";

  var SAFE_APP_PREFIXES = ["https://", "http://", "./apps/"];

  function getSafeAppUrl(rawUrl) {
    if (typeof rawUrl !== "string") {
      return null;
    }
    var trimmed = rawUrl.trim();
    if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) {
      return null;
    }
    var lower = trimmed.toLowerCase();
    for (var i = 0; i < SAFE_APP_PREFIXES.length; i += 1) {
      if (lower.indexOf(SAFE_APP_PREFIXES[i]) === 0) {
        return trimmed;
      }
    }
    return null;
  }

  function queryNode(root, selector) {
    if (root && typeof root.querySelector === "function") {
      var found = root.querySelector(selector);
      if (found) {
        return found;
      }
    }
    if (selector.charAt(0) === "#" && typeof document !== "undefined" && typeof document.getElementById === "function") {
      return document.getElementById(selector.slice(1));
    }
    return null;
  }

  function setClassPresence(node, className, shouldExist) {
    if (!node) {
      return;
    }
    if (node.classList && typeof node.classList.toggle === "function") {
      node.classList.toggle(className, Boolean(shouldExist));
      return;
    }
    var tokens = String(node.className || "").split(/\s+/).filter(Boolean);
    var idx = tokens.indexOf(className);
    if (shouldExist && idx === -1) {
      tokens.push(className);
    } else if (!shouldExist && idx !== -1) {
      tokens.splice(idx, 1);
    }
    node.className = tokens.join(" ");
  }

  /**
   * Unmounts the live iframe viewer, clears the iframe resource to about:blank, and hides the overlay.
   */
  function unmountViewer(overlayEl) {
    if (!overlayEl) {
      return;
    }
    var titleEl = queryNode(overlayEl, "#viewer-app-title");
    if (titleEl) {
      titleEl.textContent = "";
    }
    var externalLink = queryNode(overlayEl, "#viewer-open-external");
    if (externalLink) {
      if (typeof externalLink.removeAttribute === "function") {
        externalLink.removeAttribute("href");
      } else {
        externalLink.href = "";
      }
    }
    var iframeEl = queryNode(overlayEl, "#viewer-iframe");
    if (iframeEl) {
      iframeEl.src = "about:blank";
      if (typeof iframeEl.removeAttribute === "function") {
        iframeEl.removeAttribute("title");
      } else {
        iframeEl.title = "";
      }
    }
    overlayEl.hidden = true;
    overlayEl.setAttribute("aria-hidden", "true");
  }

  /**
   * Mounts an app into the live iframe viewer overlay after validating its URL.
   */
  function mountViewer(overlayEl, app, previewDevice) {
    if (!overlayEl) {
      return false;
    }
    var safeUrl = app ? getSafeAppUrl(app.url) : null;
    if (!safeUrl) {
      unmountViewer(overlayEl);
      return false;
    }

    var isMobile = previewDevice === "mobile";
    overlayEl.hidden = false;
    overlayEl.setAttribute("aria-hidden", "false");

    var titleEl = queryNode(overlayEl, "#viewer-app-title");
    if (titleEl) {
      titleEl.textContent = typeof app.title === "string" ? app.title : "";
    }

    var externalLink = queryNode(overlayEl, "#viewer-open-external");
    if (externalLink) {
      externalLink.href = safeUrl;
      externalLink.target = "_blank";
      externalLink.rel = "noopener noreferrer";
    }

    var desktopBtn = queryNode(overlayEl, "#viewer-device-desktop");
    if (desktopBtn) {
      desktopBtn.setAttribute("aria-pressed", isMobile ? "false" : "true");
      setClassPresence(desktopBtn, "is-active", !isMobile);
    }

    var mobileBtn = queryNode(overlayEl, "#viewer-device-mobile");
    if (mobileBtn) {
      mobileBtn.setAttribute("aria-pressed", isMobile ? "true" : "false");
      setClassPresence(mobileBtn, "is-active", isMobile);
    }

    var stageEl = queryNode(overlayEl, ".viewer-frame-stage") || queryNode(overlayEl, "#viewer-stage");
    setClassPresence(stageEl, "is-mobile", isMobile);

    var iframeEl = queryNode(overlayEl, "#viewer-iframe");
    if (iframeEl) {
      var currentAttrSrc = typeof iframeEl.getAttribute === "function"
        ? iframeEl.getAttribute("src")
        : iframeEl.src;
      if (currentAttrSrc !== safeUrl && iframeEl.src !== safeUrl) {
        iframeEl.src = safeUrl;
      }
      var appTitle = typeof app.title === "string" && app.title ? app.title : "웹앱";
      iframeEl.title = appTitle + " 실행 화면";
    }

    return true;
  }

  function fallbackCopyText(text) {
    if (typeof document === "undefined" || !document.body || typeof document.createElement !== "function") {
      return false;
    }
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    var copied = false;
    try {
      if (typeof textarea.focus === "function") {
        textarea.focus();
      }
      if (typeof textarea.select === "function") {
        textarea.select();
      }
      if (typeof textarea.setSelectionRange === "function") {
        textarea.setSelectionRange(0, text.length);
      }
      if (typeof document.execCommand === "function") {
        copied = Boolean(document.execCommand("copy"));
      }
    } catch (_err) {
      copied = false;
    } finally {
      if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    }
    return copied;
  }

  /**
   * Copies a share URL using the Clipboard API with an execCommand fallback for file:// contexts.
   */
  function copyShareLink(url, onCopied) {
    var notify = typeof onCopied === "function" ? onCopied : function () {};
    if (typeof url !== "string" || !url) {
      notify(false);
      return Promise.resolve(false);
    }

    var nav = typeof navigator !== "undefined" ? navigator : global.navigator;
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
      return nav.clipboard.writeText(url).then(
        function () {
          notify(true);
          return true;
        },
        function () {
          var fallbackOk = fallbackCopyText(url);
          notify(fallbackOk);
          return fallbackOk;
        }
      );
    }

    var ok = fallbackCopyText(url);
    notify(ok);
    return Promise.resolve(ok);
  }

  global.PortfolioViewer = {
    mountViewer: mountViewer,
    unmountViewer: unmountViewer,
    copyShareLink: copyShareLink
  };
})(typeof window !== "undefined" ? window : globalThis);
