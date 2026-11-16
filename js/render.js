(function (global) {
  "use strict";

  var SVG_WIDTH = 800;
  var SVG_HEIGHT = 450;
  var SVG_CX = SVG_WIDTH / 2;
  var SVG_CY = 186;
  var SVG_RING_OUTER = 104;
  var SVG_RING_INNER = 78;
  var SVG_GRID_UNIT = 40;
  var SVG_TICK_COUNT = 12;

  var SVG_PALETTES = [
    { bgStart: "#0b1220", bgEnd: "#172554", accent: "#38bdf8", text: "#f8fafc", muted: "#cbd5e1" },
    { bgStart: "#071718", bgEnd: "#0f2e2b", accent: "#34d399", text: "#f8fafc", muted: "#cbd5e1" },
    { bgStart: "#120e24", bgEnd: "#261b4d", accent: "#a78bfa", text: "#f8fafc", muted: "#cbd5e1" },
    { bgStart: "#18120c", bgEnd: "#332110", accent: "#fbbf24", text: "#f8fafc", muted: "#e2e8f0" },
    { bgStart: "#1a0d17", bgEnd: "#38162c", accent: "#fb7185", text: "#f8fafc", muted: "#e2e8f0" },
    { bgStart: "#081724", bgEnd: "#0f334a", accent: "#22d3ee", text: "#f8fafc", muted: "#cbd5e1" }
  ];

  /**
   * Escapes XML special characters so arbitrary text is safe inside SVG markup.
   */
  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Computes a deterministic non-negative integer hash for a string.
   */
  function hashString(value) {
    var hash = 0;
    for (var i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function truncateTitle(value, maxLength) {
    var chars = Array.from(value);
    if (chars.length <= maxLength) {
      return value;
    }
    return chars.slice(0, maxLength - 1).join("") + "\u2026";
  }

  function buildPolarTicks(cx, cy, innerR, outerR, count) {
    var lines = [];
    for (var i = 0; i < count; i += 1) {
      var angle = (i * 2 * Math.PI) / count - Math.PI / 2;
      var cos = Math.cos(angle);
      var sin = Math.sin(angle);
      var x1 = (cx + innerR * cos).toFixed(2);
      var y1 = (cy + innerR * sin).toFixed(2);
      var x2 = (cx + outerR * cos).toFixed(2);
      var y2 = (cy + outerR * sin).toFixed(2);
      lines.push(
        '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>'
      );
    }
    return lines.join("");
  }

  /**
   * Generates a deterministic 16:9 SVG data URI fallback thumbnail for an app title.
   */
  function createFallbackSvgDataUri(title) {
    var rawTitle = typeof title === "string" ? title.trim() : "";
    var displayTitle = rawTitle || "Web App";
    var firstChar = Array.from(displayTitle)[0] || "W";
    var initial = /^[a-z]$/.test(firstChar) ? firstChar.toUpperCase() : firstChar;

    var hash = hashString(displayTitle);
    var palette = SVG_PALETTES[hash % SVG_PALETTES.length];
    var idSuffix = String(hash);

    var safeInitial = escapeXml(initial);
    var safeSubtitle = escapeXml(truncateTitle(displayTitle, 26));
    var safeAriaTitle = escapeXml(displayTitle + " 썸네일");
    var ticksMarkup = buildPolarTicks(
      SVG_CX,
      SVG_CY,
      SVG_RING_OUTER + 10,
      SVG_RING_OUTER + 20,
      SVG_TICK_COUNT
    );

    var bgGradId = "fb-bg-" + idSuffix;
    var glowGradId = "fb-glow-" + idSuffix;
    var gridPatId = "fb-grid-" + idSuffix;
    var titleId = "fb-title-" + idSuffix;

    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + SVG_WIDTH + " " + SVG_HEIGHT + '" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="' + titleId + '">' +
      '<title id="' + titleId + '">' + safeAriaTitle + "</title>" +
      "<defs>" +
      '<linearGradient id="' + bgGradId + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="' + palette.bgStart + '"/>' +
      '<stop offset="100%" stop-color="' + palette.bgEnd + '"/>' +
      "</linearGradient>" +
      '<radialGradient id="' + glowGradId + '" cx="50%" cy="42%" r="48%">' +
      '<stop offset="0%" stop-color="' + palette.accent + '" stop-opacity="0.26"/>' +
      '<stop offset="100%" stop-color="' + palette.bgStart + '" stop-opacity="0"/>' +
      "</radialGradient>" +
      '<pattern id="' + gridPatId + '" width="' + SVG_GRID_UNIT + '" height="' + SVG_GRID_UNIT + '" patternUnits="userSpaceOnUse">' +
      '<path d="M ' + SVG_GRID_UNIT + " 0 L 0 0 0 " + SVG_GRID_UNIT + '" fill="none" stroke="' + palette.muted + '" stroke-width="0.6" stroke-opacity="0.1"/>' +
      "</pattern>" +
      "</defs>" +
      '<g id="background-grid">' +
      '<rect width="' + SVG_WIDTH + '" height="' + SVG_HEIGHT + '" fill="url(#' + bgGradId + ')"/>' +
      '<rect width="' + SVG_WIDTH + '" height="' + SVG_HEIGHT + '" fill="url(#' + gridPatId + ')"/>' +
      '<rect width="' + SVG_WIDTH + '" height="' + SVG_HEIGHT + '" fill="url(#' + glowGradId + ')"/>' +
      "</g>" +
      '<g id="primary-subject">' +
      '<g stroke="' + palette.accent + '" stroke-opacity="0.45" stroke-width="2" stroke-linecap="round">' +
      ticksMarkup +
      "</g>" +
      '<circle cx="' + SVG_CX + '" cy="' + SVG_CY + '" r="' + SVG_RING_OUTER + '" fill="none" stroke="' + palette.accent + '" stroke-opacity="0.35" stroke-width="2"/>' +
      '<circle cx="' + SVG_CX + '" cy="' + SVG_CY + '" r="' + SVG_RING_INNER + '" fill="' + palette.bgStart + '" fill-opacity="0.65" stroke="' + palette.accent + '" stroke-width="3"/>' +
      '<text x="' + SVG_CX + '" y="' + (SVG_CY + 22) + '" text-anchor="middle" fill="' + palette.accent + '" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="800">' + safeInitial + "</text>" +
      "</g>" +
      '<g id="foreground-accents">' +
      '<text x="' + SVG_CX + '" y="' + (SVG_CY + SVG_RING_OUTER + 68) + '" text-anchor="middle" fill="' + palette.text + '" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="600">' + safeSubtitle + "</text>" +
      "</g>" +
      "</svg>";

    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  /**
   * Clears all child nodes from a DOM container safely without innerHTML.
   */
  function clearElement(element) {
    if (!element) {
      return;
    }
    if (typeof element.replaceChildren === "function") {
      element.replaceChildren();
      return;
    }
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * Creates a DOM element using document.createElement and safe textContent only.
   */
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
        var child = options.children[c];
        if (child) {
          node.appendChild(child);
        }
      }
    }
    return node;
  }

  function getSafeUrl(rawUrl, allowedPrefixes) {
    if (typeof rawUrl !== "string") {
      return null;
    }
    var trimmed = rawUrl.trim();
    if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) {
      return null;
    }
    var lower = trimmed.toLowerCase();
    for (var i = 0; i < allowedPrefixes.length; i += 1) {
      if (lower.indexOf(allowedPrefixes[i]) === 0) {
        return trimmed;
      }
    }
    return null;
  }

  function getSafeContactUrl(url) {
    return getSafeUrl(url, ["https://", "http://", "mailto:"]);
  }

  function getSafeAppUrl(url) {
    return getSafeUrl(url, ["https://", "http://", "./apps/"]);
  }

  function getSafeThumbnailUrl(url) {
    return getSafeUrl(url, ["https://", "http://", "./"]);
  }

  function getLaunchTypeLabel(launchType) {
    return launchType === "embedded" ? "직접 탑재" : "웹 링크";
  }

  function getLaunchBadgeClass(launchType) {
    return launchType === "embedded"
      ? "launch-badge is-embedded"
      : "launch-badge is-external";
  }

  /**
   * Attaches a thumbnail image source and a one-shot onerror SVG fallback guard.
   */
  function attachThumbnailFallback(imgEl, thumbnailUrl, title, lazy) {
    var trimmedTitle = typeof title === "string" ? title.trim() : "";
    var appTitle = trimmedTitle || "웹앱";
    var safeThumb = getSafeThumbnailUrl(thumbnailUrl);
    imgEl.alt = appTitle + " 썸네일";
    if (lazy) {
      imgEl.loading = "lazy";
    }
    imgEl.src = safeThumb || createFallbackSvgDataUri(appTitle);
    imgEl.addEventListener("error", function () {
      if (!imgEl.dataset) {
        imgEl.dataset = {};
      }
      if (imgEl.dataset.fallbackApplied === "true") {
        return;
      }
      imgEl.dataset.fallbackApplied = "true";
      imgEl.src = createFallbackSvgDataUri(appTitle);
    });
  }

  /**
   * Builds a 16:9 thumbnail frame with ambient blurred backdrop and adaptive fit detection.
   */
  function buildThumbnailFrame(frameClass, imgClass, app, isLazy) {
    var safeApp = app || {};
    var frame = el("div", { className: frameClass || "app-card-thumb" });
    var ambientImg = el("img", {
      className: "thumb-ambient-bg",
      attrs: {
        alt: "",
        "aria-hidden": "true"
      }
    });
    if (isLazy) {
      ambientImg.loading = "lazy";
    }
    var mainImg = el("img", { className: imgClass || "app-card-img" });

    var safeThumb = getSafeThumbnailUrl(safeApp.thumbnail);
    attachThumbnailFallback(mainImg, safeApp.thumbnail, safeApp.title, Boolean(isLazy));

    var fitMode = safeApp.thumbnailFit;
    if (fitMode === "cover") {
      frame.classList.add("is-cover-fit");
    } else if (safeThumb) {
      if (fitMode === "contain") {
        frame.classList.add("is-contain-fit");
        ambientImg.src = safeThumb;
      } else {
        mainImg.addEventListener("load", function () {
          if (mainImg.dataset && mainImg.dataset.fallbackApplied === "true") {
            frame.classList.remove("is-contain-fit");
            return;
          }
          var w = Number(mainImg.naturalWidth) || 0;
          var h = Number(mainImg.naturalHeight) || 0;
          if (w > 0 && h > 0 && (Math.abs((w / h) - (16 / 9)) > 0.28 || w < 360)) {
            frame.classList.add("is-contain-fit");
            ambientImg.src = safeThumb;
          } else {
            frame.classList.remove("is-contain-fit");
          }
        });
      }
    }

    mainImg.addEventListener("error", function () {
      frame.classList.remove("is-contain-fit");
      if (typeof ambientImg.removeAttribute === "function") {
        ambientImg.removeAttribute("src");
      } else {
        ambientImg.src = "";
      }
    });

    frame.appendChild(ambientImg);
    frame.appendChild(mainImg);
    return frame;
  }

  function renderTagChips(tags, className, limit) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return null;
    }
    var listEl = el("div", { className: className });
    var count = typeof limit === "number" ? Math.min(tags.length, limit) : tags.length;
    for (var i = 0; i < count; i += 1) {
      if (typeof tags[i] === "string" && tags[i]) {
        listEl.appendChild(el("span", { className: "tag-chip", text: tags[i] }));
      }
    }
    if (typeof limit === "number" && tags.length > limit) {
      listEl.appendChild(
        el("span", { className: "tag-chip is-overflow", text: "+" + (tags.length - limit) })
      );
    }
    return listEl.children.length > 0 ? listEl : null;
  }

  function renderStatBadge(label, count, modifierClass) {
    return el("span", {
      className: "stat-badge " + modifierClass,
      children: [
        el("span", { className: "stat-label", text: label }),
        el("strong", { className: "stat-value", text: String(count) })
      ]
    });
  }

  /**
   * Renders the hero header with site metadata, safe contact link, admin actions, and app count summary.
   */
  function renderHeader(rootEl, config, stats, callbacks) {
    if (!rootEl) {
      return;
    }
    clearElement(rootEl);

    var safeConfig = config || {};
    var safeStats = stats || {};
    var safeCallbacks = callbacks || {};
    var totalCount = Number(safeStats.totalCount) || 0;
    var embeddedCount = Number(safeStats.embeddedCount) || 0;
    var externalCount = Number(safeStats.externalCount) || 0;
    var isAdminUnlocked = Boolean(safeCallbacks.isAdminUnlocked);
    var onOpenAdmin = typeof safeCallbacks.onOpenAdmin === "function"
      ? safeCallbacks.onOpenAdmin
      : function () {};
    var onLockAdmin = typeof safeCallbacks.onLockAdmin === "function"
      ? safeCallbacks.onLockAdmin
      : function () {};

    var inner = el("div", { className: "hero-inner" });
    var copyBlock = el("div", { className: "hero-copy" });

    var metaRow = el("div", { className: "hero-meta" });
    if (typeof safeConfig.ownerName === "string" && safeConfig.ownerName.trim()) {
      metaRow.appendChild(
        el("span", { className: "hero-owner", text: safeConfig.ownerName.trim() })
      );
    }
    var safeContact = getSafeContactUrl(safeConfig.contactLink);
    if (safeContact) {
      var isMailto = safeContact.toLowerCase().indexOf("mailto:") === 0;
      metaRow.appendChild(
        el("a", {
          className: "hero-contact",
          text: "문의 · 링크",
          props: isMailto
            ? { href: safeContact }
            : {
                href: safeContact,
                target: "_blank",
                rel: "noopener noreferrer"
              }
        })
      );
    }
    if (metaRow.children.length > 0) {
      copyBlock.appendChild(metaRow);
    }

    copyBlock.appendChild(
      el("h1", {
        className: "hero-title",
        text: typeof safeConfig.siteTitle === "string" && safeConfig.siteTitle
          ? safeConfig.siteTitle
          : "Web App Portfolio"
      })
    );

    if (typeof safeConfig.siteSubtitle === "string" && safeConfig.siteSubtitle.trim()) {
      copyBlock.appendChild(
        el("p", { className: "hero-subtitle", text: safeConfig.siteSubtitle.trim() })
      );
    }

    var topActions = el("div", { className: "hero-top-actions" });
    if (isAdminUnlocked) {
      topActions.appendChild(
        el("button", {
          className: "btn-admin-entry",
          text: "관리자 패널",
          props: { type: "button" },
          attrs: { id: "admin-toggle-btn" },
          on: { click: onOpenAdmin }
        })
      );
      topActions.appendChild(
        el("button", {
          className: "btn-admin-lock",
          text: "잠금",
          props: { type: "button" },
          attrs: { id: "admin-lock-btn" },
          on: { click: onLockAdmin }
        })
      );
    } else {
      topActions.appendChild(
        el("button", {
          className: "btn-admin-entry",
          text: "관리자 모드",
          props: { type: "button" },
          attrs: { id: "admin-toggle-btn" },
          on: { click: onOpenAdmin }
        })
      );
    }

    var statsRow = el("div", {
      className: "hero-stats",
      children: [
        renderStatBadge("전체 앱", totalCount, "is-total"),
        renderStatBadge("직접 탑재", embeddedCount, "is-embedded"),
        renderStatBadge("웹 링크", externalCount, "is-external")
      ]
    });

    var sideCol = el("div", {
      className: "hero-side",
      children: [topActions, statsRow]
    });

    inner.appendChild(copyBlock);
    inner.appendChild(sideCol);
    rootEl.appendChild(inner);
  }

  /**
   * Renders tag filter chips including "전체" and wires onSelectTag callbacks.
   */
  function renderFilters(containerEl, tags, state, callbacks) {
    if (!containerEl) {
      return;
    }
    clearElement(containerEl);

    if (!Array.isArray(tags) || tags.length === 0) {
      containerEl.hidden = true;
      return;
    }

    containerEl.hidden = false;

    var activeTag = state && typeof state.activeTag === "string" ? state.activeTag : "all";
    var onSelectTag = callbacks && typeof callbacks.onSelectTag === "function"
      ? callbacks.onSelectTag
      : function () {};

    function createChip(label, tagValue) {
      var isSelected = activeTag === tagValue;
      return el("button", {
        className: isSelected ? "filter-chip is-active" : "filter-chip",
        text: label,
        props: { type: "button" },
        attrs: {
          "data-tag": tagValue,
          "aria-pressed": isSelected ? "true" : "false"
        },
        on: {
          click: function () {
            onSelectTag(tagValue);
          }
        }
      });
    }

    containerEl.appendChild(createChip("전체", "all"));

    if (Array.isArray(tags)) {
      for (var i = 0; i < tags.length; i += 1) {
        var tag = tags[i];
        if (typeof tag === "string" && tag) {
          containerEl.appendChild(createChip(tag, tag));
        }
      }
    }
  }

  function renderAppCard(app, onSelectApp) {
    var card = el("article", {
      className: app.featured ? "app-card is-featured" : "app-card",
      attrs: { "data-app-id": app.id || "" }
    });

    var thumbFrame = buildThumbnailFrame("app-card-thumb", "app-card-img", app, true);
    thumbFrame.appendChild(
      el("span", {
        className: getLaunchBadgeClass(app.launchType),
        text: getLaunchTypeLabel(app.launchType)
      })
    );

    var body = el("div", { className: "app-card-body" });
    body.appendChild(el("h3", { className: "app-card-title", text: app.title || "" }));
    body.appendChild(el("p", { className: "app-card-tagline", text: app.tagline || "" }));

    if (typeof app.audience === "string" && app.audience.trim()) {
      body.appendChild(
        el("p", {
          className: "app-card-audience",
          children: [
            el("span", { className: "audience-label", text: "추천 대상" }),
            el("span", { className: "audience-text", text: app.audience })
          ]
        })
      );
    }

    var tagRow = renderTagChips(app.tags, "app-card-tags", 3);
    if (tagRow) {
      body.appendChild(tagRow);
    }

    var trigger = el("button", {
      className: "app-card-trigger",
      props: { type: "button" },
      on: {
        click: function () {
          onSelectApp(app.id);
        }
      },
      children: [thumbFrame, body]
    });

    card.appendChild(trigger);
    return card;
  }

  /**
   * Renders the showcase app grid or an accessible empty state (catalog-empty vs filter-empty).
   */
  function renderAppGrid(gridEl, apps, state, callbacks) {
    if (!gridEl) {
      return;
    }
    clearElement(gridEl);

    var safeApps = Array.isArray(apps) ? apps : [];
    var onSelectApp = callbacks && typeof callbacks.onSelectApp === "function"
      ? callbacks.onSelectApp
      : function () {};
    var onResetFilters = callbacks && typeof callbacks.onResetFilters === "function"
      ? callbacks.onResetFilters
      : function () {};
    var onOpenAdmin = callbacks && typeof callbacks.onOpenAdmin === "function"
      ? callbacks.onOpenAdmin
      : function () {};

    if (safeApps.length === 0) {
      var isCatalogEmpty = Boolean(state && Array.isArray(state.apps) && state.apps.length === 0);
      if (isCatalogEmpty) {
        var catalogEmptyPanel = el("div", {
          className: "empty-state is-catalog-empty",
          attrs: { role: "status" },
          children: [
            el("h3", { className: "empty-state-title", text: "아직 등록된 웹앱이 없습니다." }),
            el("p", {
              className: "empty-state-desc",
              text: "상단 '관리자 모드'에서 첫 웹앱과 썸네일을 등록해 보세요."
            }),
            el("button", {
              className: "btn-primary btn-open-admin",
              text: "관리자 모드에서 등록하기",
              props: { type: "button" },
              on: { click: onOpenAdmin }
            })
          ]
        });
        gridEl.appendChild(catalogEmptyPanel);
        return;
      }

      var emptyPanel = el("div", {
        className: "empty-state",
        attrs: { role: "status" },
        children: [
          el("h3", { className: "empty-state-title", text: "조건에 맞는 웹앱이 없습니다." }),
          el("p", {
            className: "empty-state-desc",
            text: "검색어나 선택된 태그·실행 방식 필터를 초기화해 전체 웹앱을 확인해 보세요."
          }),
          el("button", {
            className: "btn-reset-filters",
            text: "필터 초기화",
            props: { type: "button" },
            on: { click: onResetFilters }
          })
        ]
      });
      gridEl.appendChild(emptyPanel);
      return;
    }

    for (var i = 0; i < safeApps.length; i += 1) {
      if (safeApps[i]) {
        gridEl.appendChild(renderAppCard(safeApps[i], onSelectApp));
      }
    }
  }

  function renderDescriptionContent(description) {
    if (Array.isArray(description)) {
      var list = el("ul", { className: "modal-desc-list" });
      for (var i = 0; i < description.length; i += 1) {
        if (typeof description[i] === "string" && description[i].trim()) {
          list.appendChild(el("li", { text: description[i] }));
        }
      }
      return list;
    }
    return el("p", {
      className: "modal-desc-text",
      text: typeof description === "string" ? description : ""
    });
  }

  function createStructuredSection(headingText, contentNode) {
    return el("section", {
      className: "modal-section",
      children: [
        el("h3", { className: "modal-section-heading", text: headingText }),
        contentNode
      ]
    });
  }

  function createExternalActionLink(label, url, className) {
    var safeUrl = getSafeAppUrl(url);
    var props = {
      target: "_blank",
      rel: "noopener noreferrer"
    };
    var attrs = {};
    if (safeUrl) {
      props.href = safeUrl;
    } else {
      attrs["aria-disabled"] = "true";
    }
    return el("a", {
      className: className,
      text: label,
      props: props,
      attrs: attrs
    });
  }

  /**
   * Renders the accessible detail modal for a selected app, or hides the container when app is null.
   */
  function renderDetailModal(modalEl, app, callbacks) {
    if (!modalEl) {
      return;
    }
    clearElement(modalEl);

    if (!app) {
      modalEl.hidden = true;
      modalEl.setAttribute("aria-hidden", "true");
      return;
    }

    modalEl.hidden = false;
    modalEl.setAttribute("aria-hidden", "false");

    var onCloseDetail = callbacks && typeof callbacks.onCloseDetail === "function"
      ? callbacks.onCloseDetail
      : function () {};
    var onLaunchIframe = callbacks && typeof callbacks.onLaunchIframe === "function"
      ? callbacks.onLaunchIframe
      : function () {};
    var onCopyShare = callbacks && typeof callbacks.onCopyShare === "function"
      ? callbacks.onCopyShare
      : function () {};

    var backdrop = el("div", {
      className: "modal-backdrop",
      on: { click: onCloseDetail }
    });

    var closeBtn = el("button", {
      className: "modal-close",
      text: "\u00D7",
      props: { type: "button" },
      attrs: { "aria-label": "닫기" },
      on: { click: onCloseDetail }
    });

    var thumbWrap = buildThumbnailFrame("modal-thumb-wrap", "modal-thumb-img", app, false);

    var headerMeta = el("div", {
      className: "modal-header-meta",
      children: [
        el("span", {
          className: getLaunchBadgeClass(app.launchType),
          text: getLaunchTypeLabel(app.launchType)
        })
      ]
    });

    var titleEl = el("h2", {
      className: "modal-title",
      text: app.title || "",
      attrs: { id: "detail-modal-title" }
    });

    var taglineEl = el("p", {
      className: "modal-tagline",
      text: app.tagline || ""
    });

    var headerBlock = el("div", {
      className: "modal-header-block",
      children: [headerMeta, titleEl, taglineEl]
    });

    var modalTags = renderTagChips(app.tags, "modal-tags");
    if (modalTags) {
      headerBlock.appendChild(modalTags);
    }

    var sectionsBlock = el("div", {
      className: "modal-sections",
      children: [
        createStructuredSection(
          "이 앱의 목적",
          el("p", { className: "modal-section-text", text: app.purpose || "" })
        ),
        createStructuredSection(
          "추천 대상",
          el("p", { className: "modal-section-text", text: app.audience || "" })
        ),
        createStructuredSection(
          "주요 내용 및 사용법",
          renderDescriptionContent(app.description)
        )
      ]
    });

    var actionsBar = el("div", { className: "modal-actions" });
    if (app.embedMode === "iframe") {
      actionsBar.appendChild(
        el("button", {
          className: "btn-primary",
          text: "포트폴리오에서 바로 실행",
          props: { type: "button" },
          on: {
            click: function () {
              onLaunchIframe(app);
            }
          }
        })
      );
      actionsBar.appendChild(
        createExternalActionLink("새 탭으로 열기", app.url, "btn-secondary")
      );
    } else {
      actionsBar.appendChild(
        createExternalActionLink("새 탭에서 실행", app.url, "btn-primary")
      );
    }

    actionsBar.appendChild(
      el("button", {
        className: "btn-secondary",
        text: "공유 링크 복사",
        props: { type: "button" },
        on: {
          click: function () {
            onCopyShare(app);
          }
        }
      })
    );

    var dialog = el("div", {
      className: "modal-dialog",
      attrs: {
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "detail-modal-title"
      },
      children: [closeBtn, thumbWrap, headerBlock, sectionsBlock, actionsBar]
    });

    modalEl.appendChild(backdrop);
    modalEl.appendChild(dialog);
  }

  global.PortfolioRender = {
    createFallbackSvgDataUri: createFallbackSvgDataUri,
    buildThumbnailFrame: buildThumbnailFrame,
    renderHeader: renderHeader,
    renderFilters: renderFilters,
    renderAppGrid: renderAppGrid,
    renderDetailModal: renderDetailModal
  };
})(typeof window !== "undefined" ? window : globalThis);
