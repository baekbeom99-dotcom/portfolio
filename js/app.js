(function (global) {
  "use strict";

  /**
   * Bootstraps the portfolio UI, binds controls to PortfolioState, and coordinates rendering & viewer lifecycle.
   */
  function initPortfolio() {
    if (
      !global.PortfolioState ||
      !global.PortfolioRender ||
      !global.PortfolioViewer ||
      typeof document === "undefined"
    ) {
      return null;
    }

    var config = global.PORTFOLIO_CONFIG || {};
    var apps = Array.isArray(global.PORTFOLIO_APPS) ? global.PORTFOLIO_APPS : [];
    var store = global.PortfolioState.createStore(apps);

    var headerEl = document.getElementById("site-header");
    var searchInput = document.getElementById("search-input");
    var tagFiltersEl = document.getElementById("tag-filters");
    var appGridEl = document.getElementById("app-grid");
    var appsCountEl = document.getElementById("apps-count");
    var detailModalEl = document.getElementById("detail-modal");
    var viewerOverlayEl = document.getElementById("viewer-overlay");
    var viewerBackBtn = document.getElementById("viewer-back");
    var viewerCloseBtn = document.getElementById("viewer-close");
    var viewerDesktopBtn = document.getElementById("viewer-device-desktop");
    var viewerMobileBtn = document.getElementById("viewer-device-mobile");
    var viewerCopyShareBtn = document.getElementById("viewer-copy-share");
    var toastEl = document.getElementById("toast");
    var launchFilterBtns = document.querySelectorAll("[data-launch-filter]");

    if (typeof config.siteTitle === "string" && config.siteTitle.trim()) {
      document.title = config.siteTitle.trim();
    }

    var embeddedCount = 0;
    var externalCount = 0;
    var validCount = 0;
    for (var i = 0; i < apps.length; i += 1) {
      var item = apps[i];
      if (!item) {
        continue;
      }
      if (item.launchType === "embedded") {
        embeddedCount += 1;
        validCount += 1;
      } else if (item.launchType === "external") {
        externalCount += 1;
        validCount += 1;
      }
    }

    global.PortfolioRender.renderHeader(headerEl, config, {
      totalCount: validCount,
      embeddedCount: embeddedCount,
      externalCount: externalCount
    });

    var toastTimerId = null;
    function showToast(message) {
      if (!toastEl || !message) {
        return;
      }
      toastEl.textContent = String(message);
      toastEl.hidden = false;
      toastEl.classList.add("is-visible");
      if (toastTimerId !== null) {
        clearTimeout(toastTimerId);
      }
      toastTimerId = setTimeout(function () {
        toastEl.classList.remove("is-visible");
        toastEl.hidden = true;
        toastTimerId = null;
      }, 2400);
    }

    function copyAppShareLink(app) {
      if (!app || !app.id) {
        return;
      }
      var baseHref = global.location ? global.location.href : "";
      var shareUrl = store.buildShareUrl(baseHref, app.id);
      global.PortfolioViewer.copyShareLink(shareUrl, function (ok) {
        showToast(ok ? "공유 링크가 복사되었습니다." : "링크 복사에 실패했습니다.");
      });
    }

    function syncHashToApp(selectedAppId) {
      if (!global.location) {
        return;
      }
      var targetHash = selectedAppId ? "#app=" + encodeURIComponent(selectedAppId) : "";
      var currentHash = global.location.hash || "";
      if (currentHash === targetHash) {
        return;
      }
      if (global.history && typeof global.history.replaceState === "function") {
        var baseUrl = String(global.location.href || "").split("#")[0];
        try {
          global.history.replaceState(null, "", targetHash ? baseUrl + targetHash : baseUrl);
          return;
        } catch (_err) {
          // Fall back to location.hash on file:// opaque origins where replaceState throws SecurityError
        }
      }
      global.location.hash = targetHash;
    }

    var allTags = store.getAllTags();
    var lastFilterKey = null;
    var lastModalAppId = undefined;
    var lastFocusedEl = null;
    var lastModalVisible = false;
    var lastViewerOpen = null;

    function focusFirstAvailable(candidates) {
      for (var c = 0; c < candidates.length; c += 1) {
        var target = candidates[c];
        if (target && typeof target.focus === "function") {
          target.focus();
          return;
        }
      }
    }

    function renderFromState(state) {
      if (searchInput && searchInput.value !== state.searchQuery) {
        searchInput.value = state.searchQuery;
      }

      for (var b = 0; b < launchFilterBtns.length; b += 1) {
        var btn = launchFilterBtns[b];
        var filterVal = btn.getAttribute("data-launch-filter");
        var isActive = filterVal === state.launchFilter;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      }

      var filterKey = state.searchQuery + "\0" + state.activeTag + "\0" + state.launchFilter;
      if (filterKey !== lastFilterKey) {
        lastFilterKey = filterKey;

        global.PortfolioRender.renderFilters(tagFiltersEl, allTags, state, {
          onSelectTag: function (tag) {
            store.setActiveTag(tag);
          }
        });

        var filteredApps = store.getFilteredApps();
        global.PortfolioRender.renderAppGrid(appGridEl, filteredApps, state, {
          onSelectApp: function (appId) {
            if (document.activeElement && typeof document.activeElement.focus === "function") {
              lastFocusedEl = document.activeElement;
            }
            store.openDetail(appId);
          },
          onResetFilters: function () {
            store.resetFilters();
          }
        });

        if (appsCountEl) {
          var isFiltered =
            state.searchQuery.trim() !== "" ||
            state.activeTag !== "all" ||
            state.launchFilter !== "all";
          appsCountEl.textContent = isFiltered
            ? "총 " + validCount + "개 중 " + filteredApps.length + "개 표시"
            : "전체 " + validCount + "개 웹앱";
        }
      }

      var selectedApp = store.getSelectedApp();

      if (state.selectedAppId !== lastModalAppId) {
        lastModalAppId = state.selectedAppId;
        global.PortfolioRender.renderDetailModal(detailModalEl, selectedApp, {
          onCloseDetail: function () {
            store.closeDetail();
          },
          onLaunchIframe: function (app) {
            store.openViewer(app.id);
          },
          onCopyShare: copyAppShareLink
        });
      }

      if (detailModalEl) {
        if (selectedApp && state.viewerOpen) {
          detailModalEl.hidden = true;
          detailModalEl.setAttribute("aria-hidden", "true");
        } else if (selectedApp) {
          detailModalEl.hidden = false;
          detailModalEl.setAttribute("aria-hidden", "false");
        }
      }

      var wasModalVisible = lastModalVisible;
      var wasViewerOpen = lastViewerOpen === true;
      var isModalVisible = Boolean(selectedApp && !state.viewerOpen);
      var isViewerVisible = false;

      if (state.viewerOpen && selectedApp) {
        var mounted = global.PortfolioViewer.mountViewer(
          viewerOverlayEl,
          selectedApp,
          state.previewDevice
        );
        if (!mounted) {
          showToast("실행할 수 없는 앱 주소입니다.");
          store.closeViewer();
          return;
        }
        isViewerVisible = true;
      } else if (lastViewerOpen !== false) {
        global.PortfolioViewer.unmountViewer(viewerOverlayEl);
      }

      if (document.body) {
        document.body.classList.toggle("has-overlay", Boolean(selectedApp || state.viewerOpen));
      }

      if (isViewerVisible) {
        if (!wasViewerOpen) {
          focusFirstAvailable([viewerBackBtn, viewerCloseBtn]);
        }
      } else if (isModalVisible) {
        if (!wasModalVisible || wasViewerOpen) {
          var modalCloseBtn = detailModalEl && typeof detailModalEl.querySelector === "function"
            ? detailModalEl.querySelector(".modal-close")
            : null;
          var modalDialogEl = detailModalEl && typeof detailModalEl.querySelector === "function"
            ? detailModalEl.querySelector(".modal-dialog")
            : null;
          focusFirstAvailable([modalCloseBtn, modalDialogEl]);
        }
      } else if (!selectedApp && lastFocusedEl && typeof lastFocusedEl.focus === "function") {
        if (lastFocusedEl.isConnected !== false) {
          lastFocusedEl.focus();
        }
        lastFocusedEl = null;
      }

      lastModalVisible = isModalVisible;
      lastViewerOpen = isViewerVisible;

      syncHashToApp(state.selectedAppId);
    }

    store.subscribe(renderFromState);

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        store.setSearchQuery(searchInput.value);
      });
    }

    for (var f = 0; f < launchFilterBtns.length; f += 1) {
      (function (button) {
        button.addEventListener("click", function () {
          var filterVal = button.getAttribute("data-launch-filter");
          store.setLaunchFilter(filterVal);
        });
      })(launchFilterBtns[f]);
    }

    if (viewerBackBtn) {
      viewerBackBtn.addEventListener("click", function () {
        store.closeViewer();
      });
    }

    if (viewerCloseBtn) {
      viewerCloseBtn.addEventListener("click", function () {
        store.closeViewer();
      });
    }

    if (viewerDesktopBtn) {
      viewerDesktopBtn.addEventListener("click", function () {
        store.setPreviewDevice("desktop");
      });
    }

    if (viewerMobileBtn) {
      viewerMobileBtn.addEventListener("click", function () {
        store.setPreviewDevice("mobile");
      });
    }

    if (viewerCopyShareBtn) {
      viewerCopyShareBtn.addEventListener("click", function () {
        var selectedApp = store.getSelectedApp();
        if (selectedApp) {
          copyAppShareLink(selectedApp);
        }
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") {
        return;
      }
      var currentState = store.getState();
      if (currentState.viewerOpen) {
        event.preventDefault();
        store.closeViewer();
      } else if (currentState.selectedAppId) {
        event.preventDefault();
        store.closeDetail();
      }
    });

    if (typeof global.addEventListener === "function") {
      global.addEventListener("hashchange", function () {
        store.syncFromHash(global.location ? global.location.hash : "");
      });
    }

    store.syncFromHash(global.location ? global.location.hash : "");

    return {
      store: store
    };
  }

  global.PortfolioApp = {
    initPortfolio: initPortfolio
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initPortfolio);
    } else if (typeof document.getElementById === "function" && document.getElementById("app-grid")) {
      initPortfolio();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
