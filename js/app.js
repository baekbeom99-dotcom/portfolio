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
    var baseApps = Array.isArray(global.PORTFOLIO_APPS) ? global.PORTFOLIO_APPS : [];
    var draftApps =
      global.PortfolioAdmin && typeof global.PortfolioAdmin.loadDraftApps === "function"
        ? global.PortfolioAdmin.loadDraftApps()
        : null;
    var publishedCacheApps =
      draftApps === null &&
      global.PortfolioAdmin &&
      typeof global.PortfolioAdmin.loadPublishedCache === "function"
        ? global.PortfolioAdmin.loadPublishedCache()
        : null;
    var initialApps = draftApps !== null
      ? draftApps
      : (publishedCacheApps !== null ? publishedCacheApps : baseApps);
    var store = global.PortfolioState.createStore(initialApps);

    var headerEl = document.getElementById("site-header");
    var draftBannerEl = document.getElementById("draft-banner");
    var searchInput = document.getElementById("search-input");
    var tagFiltersEl = document.getElementById("tag-filters");
    var appGridEl = document.getElementById("app-grid");
    var appsCountEl = document.getElementById("apps-count");
    var detailModalEl = document.getElementById("detail-modal");
    var adminModalEl = document.getElementById("admin-modal");
    var viewerOverlayEl = document.getElementById("viewer-overlay");
    var viewerBackBtn = document.getElementById("viewer-back");
    var viewerCloseBtn = document.getElementById("viewer-close");
    var viewerDesktopBtn = document.getElementById("viewer-device-desktop");
    var viewerMobileBtn = document.getElementById("viewer-device-mobile");
    var viewerCopyShareBtn = document.getElementById("viewer-copy-share");
    var toastEl = document.getElementById("toast");
    var launchGroupEl = typeof document.querySelector === "function"
      ? document.querySelector(".launch-filter-group")
      : null;
    var launchFilterBtns = document.querySelectorAll("[data-launch-filter]");

    if (typeof config.siteTitle === "string" && config.siteTitle.trim()) {
      document.title = config.siteTitle.trim();
    }

    var currentSiteViews = null;
    var currentAppViews = null;

    function computeStats(appList) {
      var list = Array.isArray(appList) ? appList : [];
      var embeddedCount = 0;
      var externalCount = 0;
      var totalCount = 0;
      for (var i = 0; i < list.length; i += 1) {
        var item = list[i];
        if (!item) {
          continue;
        }
        if (item.launchType === "embedded") {
          embeddedCount += 1;
          totalCount += 1;
        } else if (item.launchType === "external") {
          externalCount += 1;
          totalCount += 1;
        }
      }
      var stats = {
        totalCount: totalCount,
        embeddedCount: embeddedCount,
        externalCount: externalCount
      };
      if (typeof currentSiteViews === "number" && isFinite(currentSiteViews) && currentSiteViews >= 0) {
        stats.totalViews = currentSiteViews;
      }
      return stats;
    }

    var currentStats = computeStats(initialApps);

    function syncLaunchGroupVisibility(stats) {
      if (launchGroupEl) {
        launchGroupEl.hidden = !(stats.embeddedCount > 0 && stats.externalCount > 0);
      }
    }

    syncLaunchGroupVisibility(currentStats);

    var adminController = null;

    function isAdminUnlocked() {
      if (adminController && typeof adminController.isUnlocked === "function") {
        return Boolean(adminController.isUnlocked());
      }
      return Boolean(
        global.PortfolioAdmin &&
        typeof global.PortfolioAdmin.isUnlocked === "function" &&
        global.PortfolioAdmin.isUnlocked()
      );
    }

    function isAdminOpen() {
      if (adminController && typeof adminController.isOpen === "function") {
        return Boolean(adminController.isOpen());
      }
      return Boolean(adminModalEl && !adminModalEl.hidden);
    }

    function handleOpenAdmin() {
      if (adminController && typeof adminController.open === "function") {
        adminController.open();
      } else if (global.PortfolioAdmin && typeof global.PortfolioAdmin.open === "function") {
        global.PortfolioAdmin.open();
      }
    }

    function handleLockAdmin() {
      if (adminController && typeof adminController.lock === "function") {
        adminController.lock();
      } else if (global.PortfolioAdmin && typeof global.PortfolioAdmin.lock === "function") {
        global.PortfolioAdmin.lock();
      }
    }

    function renderSiteHeader() {
      global.PortfolioRender.renderHeader(
        headerEl,
        config,
        currentStats,
        {
          isAdminUnlocked: isAdminUnlocked(),
          onOpenAdmin: handleOpenAdmin,
          onLockAdmin: handleLockAdmin
        }
      );
    }

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

    var lastFilterKey = null;
    var lastModalAppId = undefined;

    function handleAppsChanged(nextApps) {
      var normalizedList = Array.isArray(nextApps) ? nextApps.slice() : [];
      currentStats = computeStats(normalizedList);
      syncLaunchGroupVisibility(currentStats);
      renderSiteHeader();
      renderDraftBanner();
      lastFilterKey = null;
      lastModalAppId = undefined;
      if (typeof store.setApps === "function") {
        store.setApps(normalizedList);
      }
    }

    function renderDraftBanner() {
      if (!draftBannerEl) {
        return;
      }
      clearNode(draftBannerEl);
      var hasDraft = Boolean(
        global.PortfolioAdmin &&
        typeof global.PortfolioAdmin.hasDraftApps === "function" &&
        global.PortfolioAdmin.hasDraftApps()
      );
      if (!hasDraft) {
        draftBannerEl.hidden = true;
        return;
      }

      draftBannerEl.hidden = false;
      var messageSpan = document.createElement("span");
      messageSpan.className = "draft-banner-text";
      messageSpan.textContent = global.PortfolioFirebase
        ? "로컬 미리보기 중 · 'Firebase에 게시'를 누르기 전까지는 이 브라우저에만 보입니다."
        : "로컬 미리보기 중 · 'GitHub에 게시'를 누르기 전까지는 이 브라우저에만 보입니다.";

      var resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "btn-secondary btn-reset-draft";
      resetBtn.textContent = "초기화";
      resetBtn.addEventListener("click", function () {
        if (global.PortfolioAdmin && typeof global.PortfolioAdmin.clearDraftApps === "function") {
          global.PortfolioAdmin.clearDraftApps();
        }
        if (global.PortfolioAdmin && typeof global.PortfolioAdmin.clearDeletedIds === "function") {
          global.PortfolioAdmin.clearDeletedIds();
        }
        var latestBase = Array.isArray(global.PORTFOLIO_APPS) ? global.PORTFOLIO_APPS : [];
        handleAppsChanged(latestBase);
        showToast("로컬 미리보기를 초기화했습니다.");
      });

      draftBannerEl.appendChild(messageSpan);
      draftBannerEl.appendChild(resetBtn);
    }

    function syncBodyOverlayClass(state) {
      if (!document.body) {
        return;
      }
      var hasDetailOrViewer = Boolean(state && (state.selectedAppId || state.viewerOpen));
      document.body.classList.toggle("has-overlay", hasDetailOrViewer || isAdminOpen());
    }

    if (
      global.PortfolioAdmin &&
      typeof global.PortfolioAdmin.initAdmin === "function" &&
      adminModalEl
    ) {
      adminController = global.PortfolioAdmin.initAdmin({
        modalEl: adminModalEl,
        getApps: function () {
          return store.getState().apps;
        },
        getConfig: function () {
          return config;
        },
        getStats: function () {
          return {
            totalViews: currentSiteViews,
            appViews: currentAppViews || Object.create(null)
          };
        },
        onStatsLoaded: function (stats) {
          if (!stats || typeof stats !== "object") {
            return;
          }
          if (typeof stats.totalViews === "number" && isFinite(stats.totalViews)) {
            currentSiteViews = stats.totalViews;
          }
          if (stats.appViews && typeof stats.appViews === "object") {
            currentAppViews = stats.appViews;
          }
          currentStats = computeStats(store.getState().apps);
          renderSiteHeader();
          lastFilterKey = null;
          renderFromState(store.getState());
        },
        onAppsChanged: handleAppsChanged,
        onAuthChanged: function () {
          renderSiteHeader();
        },
        onToast: showToast,
        onOpenChange: function () {
          syncBodyOverlayClass(store.getState());
        }
      });
    }

    renderSiteHeader();
    renderDraftBanner();

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

    var lastTrackedAppViewId = null;

    function trackAppView(appId) {
      if (
        !appId ||
        lastTrackedAppViewId === appId ||
        !global.PortfolioFirebase ||
        typeof global.PortfolioFirebase.incrementAppView !== "function"
      ) {
        return;
      }
      var loc = global.location;
      if (!loc || (loc.protocol !== "http:" && loc.protocol !== "https:")) {
        return;
      }
      lastTrackedAppViewId = appId;
      global.PortfolioFirebase.incrementAppView(appId).then(function (nextCount) {
        if (typeof nextCount !== "number") {
          return;
        }
        if (!currentAppViews) {
          currentAppViews = Object.create(null);
        }
        currentAppViews[appId] = nextCount;
        lastFilterKey = null;
        if (store.getState().selectedAppId === appId) {
          lastModalAppId = undefined;
        }
        renderFromState(store.getState());
      });
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

        var allTags = store.getAllTags();
        global.PortfolioRender.renderFilters(tagFiltersEl, allTags, state, {
          onSelectTag: function (tag) {
            store.setActiveTag(tag);
          }
        });

        var filteredApps = store.getFilteredApps();
        global.PortfolioRender.renderAppGrid(appGridEl, filteredApps, state, {
          appViews: currentAppViews,
          onSelectApp: function (appId) {
            if (document.activeElement && typeof document.activeElement.focus === "function") {
              lastFocusedEl = document.activeElement;
            }
            store.openDetail(appId);
          },
          onResetFilters: function () {
            store.resetFilters();
          },
          onOpenAdmin: handleOpenAdmin
        });

        if (appsCountEl) {
          var isFiltered =
            state.searchQuery.trim() !== "" ||
            state.activeTag !== "all" ||
            state.launchFilter !== "all";
          appsCountEl.textContent = isFiltered
            ? "총 " + currentStats.totalCount + "개 중 " + filteredApps.length + "개 표시"
            : "전체 " + currentStats.totalCount + "개 웹앱";
        }
      }

      var selectedApp = store.getSelectedApp();

      if (selectedApp && selectedApp.id) {
        trackAppView(selectedApp.id);
      } else {
        lastTrackedAppViewId = null;
      }

      if (state.selectedAppId !== lastModalAppId) {
        lastModalAppId = state.selectedAppId;
        var modalViewCount =
          selectedApp &&
          currentAppViews &&
          typeof currentAppViews[selectedApp.id] === "number"
            ? currentAppViews[selectedApp.id]
            : null;
        global.PortfolioRender.renderDetailModal(detailModalEl, selectedApp, {
          viewCount: modalViewCount,
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
        syncBodyOverlayClass(state);
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
      } else if (isAdminOpen() && adminController && typeof adminController.close === "function") {
        event.preventDefault();
        adminController.close();
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

    var firebaseCatalogSynced = false;

    function refreshDeployedDataScript() {
      var loc = global.location;
      if (!loc || (loc.protocol !== "http:" && loc.protocol !== "https:")) {
        return;
      }
      var head = document.head || document.documentElement;
      if (!head || typeof document.createElement !== "function") {
        return;
      }
      var scriptEl = document.createElement("script");
      scriptEl.src = "./data/apps.js?t=" + String(Date.now());
      scriptEl.onload = function () {
        if (scriptEl.parentNode) {
          scriptEl.parentNode.removeChild(scriptEl);
        }
        if (firebaseCatalogSynced) {
          return;
        }
        var freshApps = Array.isArray(global.PORTFOLIO_APPS) ? global.PORTFOLIO_APPS : [];
        var hasDraft = Boolean(
          global.PortfolioAdmin &&
          typeof global.PortfolioAdmin.hasDraftApps === "function" &&
          global.PortfolioAdmin.hasDraftApps()
        );
        if (hasDraft) {
          return;
        }
        var cachedPublished =
          global.PortfolioAdmin &&
          typeof global.PortfolioAdmin.loadPublishedCache === "function"
            ? global.PortfolioAdmin.loadPublishedCache()
            : null;
        if (cachedPublished !== null) {
          try {
            if (JSON.stringify(freshApps) === JSON.stringify(cachedPublished)) {
              if (typeof global.PortfolioAdmin.clearPublishedCache === "function") {
                global.PortfolioAdmin.clearPublishedCache();
              }
            }
          } catch (_err) {
            // Keep published cache until TTL if comparison fails.
          }
          return;
        }
        try {
          if (JSON.stringify(freshApps) !== JSON.stringify(store.getState().apps)) {
            handleAppsChanged(freshApps);
          }
        } catch (_err) {
          handleAppsChanged(freshApps);
        }
      };
      scriptEl.onerror = function () {
        if (scriptEl.parentNode) {
          scriptEl.parentNode.removeChild(scriptEl);
        }
      };
      head.appendChild(scriptEl);
    }

    function syncFromFirebase() {
      var loc = global.location;
      if (!global.PortfolioFirebase || !loc || (loc.protocol !== "http:" && loc.protocol !== "https:")) {
        return;
      }

      if (typeof global.PortfolioFirebase.loadCatalog === "function") {
        global.PortfolioFirebase.loadCatalog().then(function (remoteCatalog) {
          if (!remoteCatalog || !Array.isArray(remoteCatalog.apps) || remoteCatalog.apps.length === 0) {
            return;
          }
          firebaseCatalogSynced = true;
          if (remoteCatalog.config && typeof remoteCatalog.config === "object") {
            config = Object.assign({}, config, remoteCatalog.config);
            global.PORTFOLIO_CONFIG = config;
            if (typeof config.siteTitle === "string" && config.siteTitle.trim()) {
              document.title = config.siteTitle.trim();
            }
          }
          global.PORTFOLIO_APPS = remoteCatalog.apps.slice();

          var hasDraft = Boolean(
            global.PortfolioAdmin &&
            typeof global.PortfolioAdmin.hasDraftApps === "function" &&
            global.PortfolioAdmin.hasDraftApps()
          );
          if (hasDraft) {
            return;
          }

          if (
            global.PortfolioAdmin &&
            typeof global.PortfolioAdmin.clearPublishedCache === "function"
          ) {
            global.PortfolioAdmin.clearPublishedCache();
          }

          try {
            if (JSON.stringify(remoteCatalog.apps) !== JSON.stringify(store.getState().apps)) {
              handleAppsChanged(remoteCatalog.apps);
            }
          } catch (_err) {
            handleAppsChanged(remoteCatalog.apps);
          }
        }).catch(function () {
          // Fallback silently to data/apps.js when Firebase is unreachable.
        });
      }

      if (
        typeof global.PortfolioFirebase.loadStats === "function" &&
        typeof global.PortfolioFirebase.incrementSiteView === "function"
      ) {
        Promise.all([
          global.PortfolioFirebase.loadStats(),
          global.PortfolioFirebase.incrementSiteView()
        ]).then(function (results) {
          var loadedStats = results[0] || { totalViews: 0, appViews: {} };
          var nextTotal = results[1];
          currentAppViews = loadedStats.appViews || Object.create(null);
          currentSiteViews = typeof nextTotal === "number" ? nextTotal : loadedStats.totalViews;
          currentStats = computeStats(store.getState().apps);
          renderSiteHeader();
          lastFilterKey = null;
          renderFromState(store.getState());
        }).catch(function () {
          // Ignore stats failures on offline/restricted loads.
        });
      }
    }

    refreshDeployedDataScript();
    syncFromFirebase();

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
