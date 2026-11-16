(function (global) {
  "use strict";

  var VALID_LAUNCH_FILTERS = {
    all: true,
    embedded: true,
    external: true
  };

  var VALID_PREVIEW_DEVICES = {
    desktop: true,
    mobile: true
  };

  function matchesSearch(app, normalizedQuery) {
    if (!normalizedQuery) {
      return true;
    }

    var searchableFields = [
      app.title,
      app.tagline,
      app.purpose,
      app.audience
    ];

    for (var i = 0; i < searchableFields.length; i += 1) {
      var field = searchableFields[i];
      if (typeof field === "string" && field.toLowerCase().indexOf(normalizedQuery) !== -1) {
        return true;
      }
    }

    if (Array.isArray(app.tags)) {
      for (var j = 0; j < app.tags.length; j += 1) {
        var tag = app.tags[j];
        if (typeof tag === "string" && tag.toLowerCase().indexOf(normalizedQuery) !== -1) {
          return true;
        }
      }
    }

    return false;
  }

  function parseAppIdFromHash(hashString) {
    if (typeof hashString !== "string" || !hashString) {
      return null;
    }

    var trimmed = hashString.charAt(0) === "#" ? hashString.slice(1) : hashString;
    var match = /(?:^|&)app=([^&]*)/.exec(trimmed);
    if (!match || !match[1]) {
      return null;
    }

    try {
      return decodeURIComponent(match[1]);
    } catch (_err) {
      return null;
    }
  }

  function createStore(apps) {
    var state = {
      apps: Array.isArray(apps) ? apps.slice() : [],
      searchQuery: "",
      activeTag: "all",
      launchFilter: "all",
      selectedAppId: null,
      viewerOpen: false,
      previewDevice: "desktop"
    };

    var listeners = [];

    function findAppById(appId) {
      if (typeof appId !== "string" || !appId) {
        return null;
      }
      for (var i = 0; i < state.apps.length; i += 1) {
        var app = state.apps[i];
        if (app && app.id === appId) {
          return app;
        }
      }
      return null;
    }

    function getState() {
      return {
        apps: state.apps.slice(),
        searchQuery: state.searchQuery,
        activeTag: state.activeTag,
        launchFilter: state.launchFilter,
        selectedAppId: state.selectedAppId,
        viewerOpen: state.viewerOpen,
        previewDevice: state.previewDevice
      };
    }

    function notify() {
      var snapshot = getState();
      var currentListeners = listeners.slice();
      for (var i = 0; i < currentListeners.length; i += 1) {
        currentListeners[i](snapshot);
      }
    }

    function subscribe(listener) {
      if (typeof listener !== "function") {
        return function () {};
      }
      listeners.push(listener);
      return function unsubscribe() {
        var index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      };
    }

    function setSearchQuery(query) {
      state.searchQuery = query == null ? "" : String(query);
      notify();
    }

    function setActiveTag(tag) {
      state.activeTag = typeof tag === "string" && tag ? tag : "all";
      notify();
    }

    function setLaunchFilter(filter) {
      if (!Object.prototype.hasOwnProperty.call(VALID_LAUNCH_FILTERS, filter)) {
        return;
      }
      state.launchFilter = filter;
      notify();
    }

    function resetFilters() {
      state.searchQuery = "";
      state.activeTag = "all";
      state.launchFilter = "all";
      notify();
    }

    function openDetail(appId) {
      if (!findAppById(appId)) {
        return;
      }
      state.selectedAppId = appId;
      state.viewerOpen = false;
      notify();
    }

    function closeDetail() {
      state.selectedAppId = null;
      state.viewerOpen = false;
      notify();
    }

    function openViewer(appId) {
      if (!findAppById(appId)) {
        return;
      }
      state.selectedAppId = appId;
      state.viewerOpen = true;
      notify();
    }

    function closeViewer() {
      state.viewerOpen = false;
      notify();
    }

    function setPreviewDevice(device) {
      if (!Object.prototype.hasOwnProperty.call(VALID_PREVIEW_DEVICES, device)) {
        return;
      }
      state.previewDevice = device;
      notify();
    }

    function setApps(nextApps) {
      state.apps = Array.isArray(nextApps) ? nextApps.slice() : [];
      if (state.activeTag !== "all" && getAllTags().indexOf(state.activeTag) === -1) {
        state.activeTag = "all";
      }
      if (state.launchFilter !== "all") {
        var hasMatchingLaunch = false;
        for (var i = 0; i < state.apps.length; i += 1) {
          if (state.apps[i] && state.apps[i].launchType === state.launchFilter) {
            hasMatchingLaunch = true;
            break;
          }
        }
        if (!hasMatchingLaunch) {
          state.launchFilter = "all";
        }
      }
      if (state.selectedAppId && !findAppById(state.selectedAppId)) {
        state.selectedAppId = null;
        state.viewerOpen = false;
      }
      notify();
    }

    function getFilteredApps() {
      var normalizedQuery = state.searchQuery.trim().toLowerCase();
      var featuredApps = [];
      var regularApps = [];

      for (var i = 0; i < state.apps.length; i += 1) {
        var app = state.apps[i];
        if (!app) {
          continue;
        }
        if (state.activeTag !== "all") {
          if (!Array.isArray(app.tags) || app.tags.indexOf(state.activeTag) === -1) {
            continue;
          }
        }
        if (state.launchFilter !== "all" && app.launchType !== state.launchFilter) {
          continue;
        }
        if (!matchesSearch(app, normalizedQuery)) {
          continue;
        }

        if (app.featured === true) {
          featuredApps.push(app);
        } else {
          regularApps.push(app);
        }
      }

      return featuredApps.concat(regularApps);
    }

    function getAllTags() {
      var seen = Object.create(null);
      var tags = [];

      for (var i = 0; i < state.apps.length; i += 1) {
        var app = state.apps[i];
        if (!app || !Array.isArray(app.tags)) {
          continue;
        }
        for (var j = 0; j < app.tags.length; j += 1) {
          var tag = app.tags[j];
          if (typeof tag === "string" && tag && !seen[tag]) {
            seen[tag] = true;
            tags.push(tag);
          }
        }
      }

      tags.sort(function (a, b) {
        return a.localeCompare(b, "ko");
      });

      return tags;
    }

    function getSelectedApp() {
      return findAppById(state.selectedAppId);
    }

    function syncFromHash(hashString) {
      var parsedId = parseAppIdFromHash(hashString);
      state.selectedAppId = findAppById(parsedId) ? parsedId : null;
      state.viewerOpen = false;
      notify();
    }

    function buildShareUrl(baseHref, appId) {
      var rawBase = typeof baseHref === "string" ? baseHref : "";
      var hashIndex = rawBase.indexOf("#");
      var cleanBase = hashIndex >= 0 ? rawBase.slice(0, hashIndex) : rawBase;
      if (appId == null || appId === "") {
        return cleanBase;
      }
      return cleanBase + "#app=" + encodeURIComponent(String(appId));
    }

    return {
      getState: getState,
      subscribe: subscribe,
      setSearchQuery: setSearchQuery,
      setActiveTag: setActiveTag,
      setLaunchFilter: setLaunchFilter,
      resetFilters: resetFilters,
      openDetail: openDetail,
      closeDetail: closeDetail,
      openViewer: openViewer,
      closeViewer: closeViewer,
      setPreviewDevice: setPreviewDevice,
      setApps: setApps,
      getFilteredApps: getFilteredApps,
      getAllTags: getAllTags,
      getSelectedApp: getSelectedApp,
      syncFromHash: syncFromHash,
      buildShareUrl: buildShareUrl
    };
  }

  global.PortfolioState = {
    createStore: createStore
  };
})(typeof window !== "undefined" ? window : globalThis);
