(function (global) {
  "use strict";

  var FIREBASE_CONFIG = {
    projectId: "sabujaak-school",
    databaseURL: "https://sabujaak-school-default-rtdb.asia-southeast1.firebasedatabase.app",
    apiKey: "AIzaSyBZ-VayXg8B9m4k2zv5ife61UiBXtpud7Q"
  };

  var AUTH_STORAGE_KEY = "ys_portfolio_firebase_auth";
  var ALLOWED_APP_ID_RE = /^[a-z0-9-]+$/;

  function getFetch(fetchImpl) {
    if (typeof fetchImpl === "function") {
      return fetchImpl;
    }
    if (typeof global.fetch === "function") {
      return global.fetch.bind(global);
    }
    if (typeof fetch === "function") {
      return fetch;
    }
    return null;
  }

  function getStorage(storageImpl) {
    if (storageImpl) {
      return storageImpl;
    }
    try {
      return global.localStorage || null;
    } catch (_err) {
      return null;
    }
  }

  function trimString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeDatabaseUrl(url) {
    var base = trimString(url) || FIREBASE_CONFIG.databaseURL;
    return base.replace(/\/+$/, "");
  }

  function sanitizeApp(app) {
    if (
      global.PortfolioGitHubSync &&
      typeof global.PortfolioGitHubSync.sanitizeAppRecord === "function"
    ) {
      return global.PortfolioGitHubSync.sanitizeAppRecord(app);
    }
    if (!app || typeof app !== "object") {
      return null;
    }
    var copy = {};
    var keys = Object.keys(app);
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (key.charAt(0) !== "_") {
        copy[key] = app[key];
      }
    }
    return copy;
  }

  function normalizeAppsCollection(rawApps) {
    var sourceList = [];
    if (Array.isArray(rawApps)) {
      sourceList = rawApps;
    } else if (rawApps && typeof rawApps === "object") {
      var keys = Object.keys(rawApps);
      for (var i = 0; i < keys.length; i += 1) {
        sourceList.push(rawApps[keys[i]]);
      }
    }

    var result = [];
    for (var j = 0; j < sourceList.length; j += 1) {
      var clean = sanitizeApp(sourceList[j]);
      if (clean && clean.id) {
        result.push(clean);
      }
    }
    return result;
  }

  function normalizeCatalogPayload(rawPayload) {
    if (!rawPayload || typeof rawPayload !== "object") {
      return { config: null, apps: [], updatedAt: "" };
    }
    var config = rawPayload.config && typeof rawPayload.config === "object"
      ? rawPayload.config
      : null;
    var apps = normalizeAppsCollection(rawPayload.apps);
    var updatedAt = trimString(rawPayload.updatedAt);
    return {
      config: config,
      apps: apps,
      updatedAt: updatedAt
    };
  }

  function normalizeStatsPayload(rawStats) {
    var totalViews = 0;
    var appViews = Object.create(null);

    if (rawStats && typeof rawStats === "object") {
      if (typeof rawStats.totalViews === "number" && isFinite(rawStats.totalViews) && rawStats.totalViews >= 0) {
        totalViews = Math.floor(rawStats.totalViews);
      }
      if (rawStats.appViews && typeof rawStats.appViews === "object") {
        var keys = Object.keys(rawStats.appViews);
        for (var i = 0; i < keys.length; i += 1) {
          var appId = keys[i];
          var val = rawStats.appViews[appId];
          if (typeof val === "number" && isFinite(val) && val >= 0) {
            appViews[appId] = Math.floor(val);
          }
        }
      }
    }

    return {
      totalViews: totalViews,
      appViews: appViews
    };
  }

  function translateFirebaseAuthError(code) {
    var normalized = trimString(code).toUpperCase();
    if (
      normalized === "INVALID_LOGIN_CREDENTIALS" ||
      normalized === "INVALID_PASSWORD" ||
      normalized === "EMAIL_NOT_FOUND"
    ) {
      return "Firebase 관리자 이메일 또는 비밀번호가 올바르지 않습니다.";
    }
    if (normalized === "INVALID_EMAIL") {
      return "유효한 이메일 주소를 입력해 주세요.";
    }
    if (normalized.indexOf("TOO_MANY_ATTEMPTS_TRY_LATER") === 0) {
      return "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.";
    }
    if (normalized === "USER_DISABLED") {
      return "비활성화된 Firebase 관리자 계정입니다.";
    }
    return "Firebase 로그인에 실패했습니다. (" + (normalized || "AUTH_ERROR") + ")";
  }

  function readStoredSession(storageImpl) {
    var store = getStorage(storageImpl);
    if (!store) {
      return null;
    }
    try {
      var raw = store.getItem(AUTH_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.refreshToken) {
        return null;
      }
      return parsed;
    } catch (_err) {
      return null;
    }
  }

  function writeStoredSession(session, storageImpl) {
    var store = getStorage(storageImpl);
    if (!store) {
      return false;
    }
    try {
      store.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      return true;
    } catch (_err) {
      return false;
    }
  }

  function clearStoredSession(storageImpl) {
    var store = getStorage(storageImpl);
    if (!store) {
      return;
    }
    try {
      store.removeItem(AUTH_STORAGE_KEY);
    } catch (_err) {
      // Ignore storage removal errors in restricted environments.
    }
  }

  function getStoredAuth(options) {
    var opts = options || {};
    var session = readStoredSession(opts.storage);
    if (!session || !session.email) {
      return null;
    }
    return {
      email: session.email,
      uid: session.uid || "",
      expiresAt: Number(session.expiresAt) || 0
    };
  }

  function signOut(options) {
    var opts = options || {};
    clearStoredSession(opts.storage);
  }

  async function signInWithPassword(email, password, options) {
    var opts = options || {};
    var cleanEmail = trimString(email);
    var cleanPassword = typeof password === "string" ? password : "";
    if (!cleanEmail || !cleanPassword) {
      throw new Error("Firebase 관리자 이메일과 비밀번호를 모두 입력해 주세요.");
    }

    var fetchFn = getFetch(opts.fetchImpl);
    if (!fetchFn) {
      throw new Error("네트워크 요청 기능(fetch)을 사용할 수 없습니다.");
    }

    var apiKey = trimString(opts.apiKey) || FIREBASE_CONFIG.apiKey;
    var endpoint = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="
      + encodeURIComponent(apiKey);

    var res = await fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cleanEmail,
        password: cleanPassword,
        returnSecureToken: true
      })
    });

    var data = res && typeof res.json === "function" ? await res.json() : null;
    if (!res || !res.ok || !data || !data.idToken) {
      var errCode = data && data.error && data.error.message ? data.error.message : "";
      throw new Error(translateFirebaseAuthError(errCode));
    }

    var expiresInSec = Number(data.expiresIn) || 3600;
    var session = {
      email: data.email || cleanEmail,
      uid: data.localId || "",
      idToken: data.idToken,
      refreshToken: data.refreshToken || "",
      expiresAt: Date.now() + expiresInSec * 1000
    };
    writeStoredSession(session, opts.storage);
    return {
      email: session.email,
      uid: session.uid,
      idToken: session.idToken,
      expiresAt: session.expiresAt
    };
  }

  async function getValidIdToken(options) {
    var opts = options || {};
    var session = readStoredSession(opts.storage);
    if (!session) {
      return null;
    }

    var now = typeof opts.now === "number" ? opts.now : Date.now();
    if (session.idToken && Number(session.expiresAt) - now > 60000) {
      return session.idToken;
    }

    if (!session.refreshToken) {
      clearStoredSession(opts.storage);
      return null;
    }

    var fetchFn = getFetch(opts.fetchImpl);
    if (!fetchFn) {
      return session.idToken || null;
    }

    var apiKey = trimString(opts.apiKey) || FIREBASE_CONFIG.apiKey;
    var endpoint = "https://securetoken.googleapis.com/v1/token?key=" + encodeURIComponent(apiKey);

    try {
      var res = await fetchFn(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(session.refreshToken)
      });
      if (!res || !res.ok) {
        if (res && (res.status === 400 || res.status === 401 || res.status === 403)) {
          clearStoredSession(opts.storage);
        }
        return null;
      }
      var refreshed = typeof res.json === "function" ? await res.json() : null;
      if (!refreshed || !refreshed.id_token) {
        return null;
      }
      var expiresInSec = Number(refreshed.expires_in) || 3600;
      var nextSession = {
        email: session.email,
        uid: refreshed.user_id || session.uid || "",
        idToken: refreshed.id_token,
        refreshToken: refreshed.refresh_token || session.refreshToken,
        expiresAt: now + expiresInSec * 1000
      };
      writeStoredSession(nextSession, opts.storage);
      return nextSession.idToken;
    } catch (_err) {
      return null;
    }
  }

  async function loadCatalog(options) {
    var opts = options || {};
    var fetchFn = getFetch(opts.fetchImpl);
    if (!fetchFn) {
      throw new Error("네트워크 요청 기능(fetch)을 사용할 수 없습니다.");
    }
    var dbUrl = normalizeDatabaseUrl(opts.databaseURL);
    var res = await fetchFn(dbUrl + "/portfolio.json", {
      method: "GET"
    });
    if (!res || !res.ok) {
      throw new Error("Firebase에서 앱 목록을 불러오지 못했습니다. (" + (res ? res.status : 0) + ")");
    }
    var raw = typeof res.json === "function" ? await res.json() : null;
    return normalizeCatalogPayload(raw);
  }

  async function loadStats(options) {
    var opts = options || {};
    var fetchFn = getFetch(opts.fetchImpl);
    if (!fetchFn) {
      return normalizeStatsPayload(null);
    }
    var dbUrl = normalizeDatabaseUrl(opts.databaseURL);
    var res = await fetchFn(dbUrl + "/stats.json", {
      method: "GET"
    });
    if (!res || !res.ok) {
      return normalizeStatsPayload(null);
    }
    var raw = typeof res.json === "function" ? await res.json() : null;
    return normalizeStatsPayload(raw);
  }

  async function incrementCounter(pathSuffix, options) {
    var opts = options || {};
    var fetchFn = getFetch(opts.fetchImpl);
    if (!fetchFn) {
      return null;
    }
    var dbUrl = normalizeDatabaseUrl(opts.databaseURL);
    try {
      var res = await fetchFn(dbUrl + pathSuffix, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ".sv": { increment: 1 } })
      });
      if (!res || !res.ok || typeof res.json !== "function") {
        return null;
      }
      var nextVal = await res.json();
      return typeof nextVal === "number" && isFinite(nextVal) && nextVal >= 0
        ? Math.floor(nextVal)
        : null;
    } catch (_err) {
      return null;
    }
  }

  function incrementSiteView(options) {
    return incrementCounter("/stats/totalViews.json", options);
  }

  function incrementAppView(appId, options) {
    var cleanId = trimString(appId);
    if (!cleanId || !ALLOWED_APP_ID_RE.test(cleanId)) {
      return Promise.resolve(null);
    }
    return incrementCounter("/stats/appViews/" + encodeURIComponent(cleanId) + ".json", options);
  }

  function mergeApps(localApps, remoteApps, deletedIds) {
    if (
      global.PortfolioGitHubSync &&
      typeof global.PortfolioGitHubSync.mergeAppsWithRemote === "function"
    ) {
      return global.PortfolioGitHubSync.mergeAppsWithRemote(localApps, remoteApps, deletedIds);
    }
    var deletedSet = Object.create(null);
    if (Array.isArray(deletedIds)) {
      for (var d = 0; d < deletedIds.length; d += 1) {
        if (typeof deletedIds[d] === "string" && deletedIds[d]) {
          deletedSet[deletedIds[d]] = true;
        }
      }
    }
    var merged = [];
    var seen = Object.create(null);
    var safeLocal = Array.isArray(localApps) ? localApps : [];
    for (var i = 0; i < safeLocal.length; i += 1) {
      var item = safeLocal[i];
      if (item && item.id) {
        seen[item.id] = true;
        merged.push(item);
      }
    }
    var safeRemote = Array.isArray(remoteApps) ? remoteApps : [];
    for (var j = 0; j < safeRemote.length; j += 1) {
      var remoteItem = safeRemote[j];
      if (remoteItem && remoteItem.id && !seen[remoteItem.id] && !deletedSet[remoteItem.id]) {
        seen[remoteItem.id] = true;
        merged.push(remoteItem);
      }
    }
    return merged;
  }

  function prepareAppsForFirebase(appsList) {
    var list = Array.isArray(appsList) ? appsList : [];
    var prepared = [];
    for (var i = 0; i < list.length; i += 1) {
      var item = list[i];
      if (!item || typeof item !== "object") {
        continue;
      }
      var pendingThumb = typeof item._pendingThumbDataUrl === "string"
        ? item._pendingThumbDataUrl.trim()
        : "";
      var clean = sanitizeApp(item);
      if (!clean || !clean.id) {
        continue;
      }
      if (pendingThumb) {
        clean.thumbnail = pendingThumb;
      }
      prepared.push(clean);
    }
    return prepared;
  }

  async function publishCatalogToFirebase(params) {
    var opts = params || {};
    var fetchFn = getFetch(opts.fetchImpl);
    if (!fetchFn) {
      throw new Error("네트워크 요청 기능(fetch)을 사용할 수 없습니다.");
    }

    var idToken = await getValidIdToken({
      fetchImpl: fetchFn,
      storage: opts.storage,
      apiKey: opts.apiKey
    });

    if (!idToken && trimString(opts.email) && typeof opts.password === "string" && opts.password) {
      var signedIn = await signInWithPassword(opts.email, opts.password, {
        fetchImpl: fetchFn,
        storage: opts.storage,
        apiKey: opts.apiKey
      });
      idToken = signedIn.idToken;
    }

    if (!idToken) {
      throw new Error("Firebase 관리자 로그인이 필요합니다. 이메일과 비밀번호로 로그인해 주세요.");
    }

    var dbUrl = normalizeDatabaseUrl(opts.databaseURL);
    var localPrepared = prepareAppsForFirebase(opts.apps);

    // Fetch latest remote catalog so concurrent additions from another device are preserved unless deleted.
    var remoteApps = [];
    try {
      var remoteCatalog = await loadCatalog({ fetchImpl: fetchFn, databaseURL: dbUrl });
      remoteApps = remoteCatalog.apps;
    } catch (_err) {
      remoteApps = [];
    }

    var mergedApps = mergeApps(localPrepared, remoteApps, opts.deletedIds);
    var cleanConfig = opts.config && typeof opts.config === "object"
      ? opts.config
      : {
          siteTitle: "사부작스쿨",
          siteSubtitle: "교육용 및 일상생활을 위한 웹앱 공유 플랫폼",
          ownerName: "사부자기 윤선생",
          contactLink: ""
        };
    var updatedAt = new Date().toISOString();

    var putRes = await fetchFn(dbUrl + "/portfolio.json?auth=" + encodeURIComponent(idToken), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: cleanConfig,
        apps: mergedApps,
        updatedAt: updatedAt
      })
    });

    if (!putRes || !putRes.ok) {
      var status = putRes && typeof putRes.status === "number" ? putRes.status : 0;
      if (status === 401 || status === 403) {
        clearStoredSession(opts.storage);
        throw new Error("Firebase 쓰기 권한이 없거나 로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
      }
      throw new Error("Firebase 저장 중 오류가 발생했습니다. (" + status + ")");
    }

    return {
      updatedApps: mergedApps,
      updatedAt: updatedAt
    };
  }

  global.PortfolioFirebase = {
    FIREBASE_CONFIG: FIREBASE_CONFIG,
    AUTH_STORAGE_KEY: AUTH_STORAGE_KEY,
    normalizeCatalogPayload: normalizeCatalogPayload,
    normalizeStatsPayload: normalizeStatsPayload,
    getStoredAuth: getStoredAuth,
    signInWithPassword: signInWithPassword,
    getValidIdToken: getValidIdToken,
    signOut: signOut,
    loadCatalog: loadCatalog,
    loadStats: loadStats,
    incrementSiteView: incrementSiteView,
    incrementAppView: incrementAppView,
    publishCatalogToFirebase: publishCatalogToFirebase
  };
})(typeof window !== "undefined" ? window : globalThis);
