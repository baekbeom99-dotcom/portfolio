(function (global) {
  "use strict";

  var BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  var VALID_THUMBNAIL_FITS = {
    auto: true,
    cover: true,
    contain: true
  };

  var IMAGE_EXT_BY_SUBTYPE = {
    png: "png",
    jpeg: "jpg",
    jpg: "jpg",
    webp: "webp",
    gif: "gif",
    "svg+xml": "svg"
  };

  var DATA_APPS_HEADER = [
    "/**",
    " * 포트폴리오 설정 및 웹앱 목록 데이터 파일",
    " *",
    " * [새 웹앱 추가 방법]",
    " * 1) 기존 GitHub Pages 등 외부에 배포된 앱:",
    ' *    - launchType: "external"',
    ' *    - url: "https://username.github.io/my-app/"',
    ' *    - embedMode: "iframe" (포트폴리오 안에서 바로 실행) 또는 "newTab" (외부 사이트가 iframe을 막을 때)',
    " *",
    " * 2) GitHub에 별도 배포하지 않고 바로 탑재하는 앱:",
    " *    - apps/<id>/ 폴더에 정적 웹앱 파일(index.html 등)을 복사",
    ' *    - launchType: "embedded"',
    ' *    - url: "./apps/<id>/index.html"',
    ' *    - embedMode: "iframe"',
    " *",
    " * 3) 썸네일 이미지 및 맞춤 옵션 (16:9 권장):",
    " *    - assets/thumbnails/ 폴더에 이미지(.svg, .png, .webp 등)를 넣고",
    ' *      "./assets/thumbnails/파일명.svg" 형태로 지정',
    ' *    - thumbnailFit (선택): "auto" | "cover" | "contain"',
    ' *      - "auto" (기본값): 이미지 비율과 해상도를 판별해 세로형·정사각형·소형 이미지는 여백 없이 전체가 보이도록 자동 맞춤',
    ' *      - "cover": 16:9 프레임에 꽉 채워 자름',
    ' *      - "contain": 이미지 전체가 잘리지 않도록 표시(주변은 블러 배경으로 채움)',
    " */"
  ].join("\n");

  function encodeUtf8BytesPure(str) {
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

  function bytesToBase64Pure(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i];
      var hasB1 = i + 1 < bytes.length;
      var hasB2 = i + 2 < bytes.length;
      var b1 = hasB1 ? bytes[i + 1] : 0;
      var b2 = hasB2 ? bytes[i + 2] : 0;
      var triplet = (b0 << 16) | (b1 << 8) | b2;

      out += BASE64_ALPHABET.charAt((triplet >> 18) & 0x3f);
      out += BASE64_ALPHABET.charAt((triplet >> 12) & 0x3f);
      out += hasB1 ? BASE64_ALPHABET.charAt((triplet >> 6) & 0x3f) : "=";
      out += hasB2 ? BASE64_ALPHABET.charAt(triplet & 0x3f) : "=";
    }
    return out;
  }

  /**
   * Encodes a UTF-8 string (including Korean/Unicode) to Base64 across browser and Node environments.
   */
  function utf8ToBase64(text) {
    var str = text == null ? "" : String(text);
    if (!str) {
      return "";
    }

    if (typeof TextEncoder === "function" && typeof btoa === "function") {
      var bytes = new TextEncoder().encode(str);
      var chunkSize = 0x8000;
      var binary = "";
      for (var i = 0; i < bytes.length; i += chunkSize) {
        var slice = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, slice);
      }
      return btoa(binary);
    }

    if (typeof Buffer === "function" && typeof Buffer.from === "function") {
      return Buffer.from(str, "utf8").toString("base64");
    }

    return bytesToBase64Pure(encodeUtf8BytesPure(str));
  }

  function base64ToBytesPure(cleanB64) {
    var bytes = [];
    for (var i = 0; i < cleanB64.length; i += 4) {
      var c0 = BASE64_ALPHABET.indexOf(cleanB64.charAt(i));
      var c1 = BASE64_ALPHABET.indexOf(cleanB64.charAt(i + 1));
      var ch2 = cleanB64.charAt(i + 2);
      var ch3 = cleanB64.charAt(i + 3);
      var c2 = ch2 === "=" ? 0 : BASE64_ALPHABET.indexOf(ch2);
      var c3 = ch3 === "=" ? 0 : BASE64_ALPHABET.indexOf(ch3);
      if (c0 === -1 || c1 === -1 || c2 === -1 || c3 === -1) {
        return null;
      }
      var triplet = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
      bytes.push((triplet >> 16) & 0xff);
      if (ch2 !== "=") {
        bytes.push((triplet >> 8) & 0xff);
      }
      if (ch3 !== "=") {
        bytes.push(triplet & 0xff);
      }
    }
    return bytes;
  }

  function decodeUtf8BytesPure(bytes) {
    var out = "";
    var i = 0;
    while (i < bytes.length) {
      var b0 = bytes[i];
      if (b0 < 0x80) {
        out += String.fromCharCode(b0);
        i += 1;
      } else if ((b0 & 0xe0) === 0xc0 && i + 1 < bytes.length) {
        out += String.fromCharCode(((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
        i += 2;
      } else if ((b0 & 0xf0) === 0xe0 && i + 2 < bytes.length) {
        out += String.fromCharCode(
          ((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
        );
        i += 3;
      } else if ((b0 & 0xf8) === 0xf0 && i + 3 < bytes.length) {
        var cp =
          ((b0 & 0x07) << 18)
          | ((bytes[i + 1] & 0x3f) << 12)
          | ((bytes[i + 2] & 0x3f) << 6)
          | (bytes[i + 3] & 0x3f);
        var offset = cp - 0x10000;
        out += String.fromCharCode(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
        i += 4;
      } else {
        out += "\ufffd";
        i += 1;
      }
    }
    return out;
  }

  /**
   * Decodes a Base64 string (including line-wrapped GitHub API payloads) into UTF-8 text.
   */
  function base64ToUtf8(base64Text) {
    if (typeof base64Text !== "string") {
      return "";
    }
    var clean = base64Text.replace(/\s+/g, "");
    if (!clean) {
      return "";
    }

    if (typeof atob === "function" && typeof TextDecoder === "function") {
      try {
        var binary = atob(clean);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder("utf-8").decode(bytes);
      } catch (_err) {
        // Fall through to alternative decoders.
      }
    }

    if (typeof Buffer === "function" && typeof Buffer.from === "function") {
      return Buffer.from(clean, "base64").toString("utf8");
    }

    var pureBytes = base64ToBytesPure(clean);
    return pureBytes ? decodeUtf8BytesPure(pureBytes) : "";
  }

  /**
   * Extracts and JSON-parses the window.PORTFOLIO_APPS array from serialized data/apps.js text without eval.
   */
  function parseAppsFromAppsJs(jsText) {
    if (typeof jsText !== "string" || !jsText) {
      return [];
    }
    var match = /window\.PORTFOLIO_APPS\s*=\s*\[/.exec(jsText);
    if (!match) {
      return [];
    }
    var startIdx = match.index + match[0].length - 1;
    var depth = 0;
    var inString = false;
    var escaped = false;
    var endIdx = -1;

    for (var i = startIdx; i < jsText.length; i += 1) {
      var ch = jsText.charAt(i);
      if (escaped) {
        escaped = false;
        continue;
      }
      if (inString) {
        if (ch === "\\") {
          escaped = true;
        } else if (ch === "\"") {
          inString = false;
        }
        continue;
      }
      if (ch === "\"") {
        inString = true;
      } else if (ch === "[") {
        depth += 1;
      } else if (ch === "]") {
        depth -= 1;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx === -1) {
      return [];
    }
    try {
      var parsed = JSON.parse(jsText.slice(startIdx, endIdx + 1));
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function mergeAppsWithRemote(remoteApps, localApps, deletedIds) {
    var deletedMap = Object.create(null);
    if (Array.isArray(deletedIds)) {
      for (var d = 0; d < deletedIds.length; d += 1) {
        var delId = typeof deletedIds[d] === "string" ? deletedIds[d].trim() : "";
        if (delId) {
          deletedMap[delId] = true;
        }
      }
    }

    var localList = Array.isArray(localApps) ? localApps : [];
    var localMap = Object.create(null);
    var merged = [];

    for (var i = 0; i < localList.length; i += 1) {
      var sanitizedLocal = sanitizeAppRecord(localList[i]);
      if (sanitizedLocal.id) {
        localMap[sanitizedLocal.id] = true;
      }
      merged.push(sanitizedLocal);
    }

    var remoteList = Array.isArray(remoteApps) ? remoteApps : [];
    for (var j = 0; j < remoteList.length; j += 1) {
      var sanitizedRemote = sanitizeAppRecord(remoteList[j]);
      if (!sanitizedRemote.id || localMap[sanitizedRemote.id] || deletedMap[sanitizedRemote.id]) {
        continue;
      }
      localMap[sanitizedRemote.id] = true;
      merged.push(sanitizedRemote);
    }

    return merged;
  }

  /**
   * Parses supported image data URLs (PNG/JPEG/WebP/GIF/SVG) into { mimeType, ext, base64 }.
   */
  function parseDataUrlBase64(dataUrl) {
    if (typeof dataUrl !== "string") {
      return null;
    }
    var trimmed = dataUrl.trim();
    if (!trimmed) {
      return null;
    }

    var base64Match = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
    if (base64Match) {
      var subtype = base64Match[1].toLowerCase();
      var ext = IMAGE_EXT_BY_SUBTYPE[subtype];
      var cleanBase64 = base64Match[2].replace(/\s+/g, "");
      if (!ext || !cleanBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleanBase64)) {
        return null;
      }
      return {
        mimeType: "image/" + subtype,
        ext: ext,
        base64: cleanBase64
      };
    }

    var svgUtf8Match = /^data:image\/svg\+xml(?:;charset=utf-8)?,([\s\S]+)$/i.exec(trimmed);
    if (svgUtf8Match) {
      var rawEncoded = svgUtf8Match[1];
      if (/^;base64,/i.test(rawEncoded)) {
        return null;
      }
      var decodedSvg;
      try {
        decodedSvg = decodeURIComponent(rawEncoded);
      } catch (_err) {
        return null;
      }
      if (!decodedSvg || !decodedSvg.trim()) {
        return null;
      }
      return {
        mimeType: "image/svg+xml",
        ext: "svg",
        base64: utf8ToBase64(decodedSvg)
      };
    }

    return null;
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function trimString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function sanitizeDescription(description) {
    if (Array.isArray(description)) {
      var items = [];
      for (var i = 0; i < description.length; i += 1) {
        var text = trimString(description[i]);
        if (text) {
          items.push(text);
        }
      }
      return items;
    }
    if (typeof description === "string") {
      return description.trim();
    }
    return [];
  }

  function sanitizeTags(tags) {
    if (!Array.isArray(tags)) {
      return [];
    }
    var seen = Object.create(null);
    var cleaned = [];
    for (var i = 0; i < tags.length; i += 1) {
      var tag = trimString(tags[i]);
      if (tag && !seen[tag]) {
        seen[tag] = true;
        cleaned.push(tag);
      }
    }
    return cleaned;
  }

  /**
   * Strips transient _-prefixed keys and returns a normalized portfolio app schema record.
   */
  function sanitizeAppRecord(app) {
    var src = app && typeof app === "object" ? app : {};
    var launchType = src.launchType === "embedded" ? "embedded" : "external";
    var embedMode = src.embedMode === "iframe" || src.embedMode === "newTab"
      ? src.embedMode
      : (launchType === "embedded" ? "iframe" : "newTab");
    var rawFit = trimString(src.thumbnailFit);
    var thumbnailFit = hasOwn(VALID_THUMBNAIL_FITS, rawFit) ? rawFit : "auto";

    return {
      id: trimString(src.id),
      title: trimString(src.title),
      tagline: trimString(src.tagline),
      purpose: trimString(src.purpose),
      audience: trimString(src.audience),
      description: sanitizeDescription(src.description),
      thumbnail: trimString(src.thumbnail),
      thumbnailFit: thumbnailFit,
      launchType: launchType,
      url: trimString(src.url),
      embedMode: embedMode,
      tags: sanitizeTags(src.tags),
      featured: Boolean(src.featured),
      createdAt: trimString(src.createdAt)
    };
  }

  function sanitizeConfig(config) {
    var src = config && typeof config === "object" ? config : {};
    return {
      siteTitle: trimString(src.siteTitle),
      siteSubtitle: trimString(src.siteSubtitle),
      ownerName: trimString(src.ownerName),
      contactLink: trimString(src.contactLink)
    };
  }

  function safeJsonStringify(value) {
    return JSON.stringify(value, null, 2)
      .replace(/</g, "\\u003c")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  }

  /**
   * Serializes PORTFOLIO_CONFIG and PORTFOLIO_APPS into a data/apps.js script string.
   */
  function serializeAppsJs(config, apps) {
    var cleanConfig = sanitizeConfig(config);
    var sourceApps = Array.isArray(apps) ? apps : [];
    var cleanApps = [];
    for (var i = 0; i < sourceApps.length; i += 1) {
      cleanApps.push(sanitizeAppRecord(sourceApps[i]));
    }

    return [
      DATA_APPS_HEADER,
      "",
      "window.PORTFOLIO_CONFIG = " + safeJsonStringify(cleanConfig) + ";",
      "",
      "window.PORTFOLIO_APPS = " + safeJsonStringify(cleanApps) + ";",
      ""
    ].join("\n");
  }

  function encodeRepoPath(filePath) {
    return String(filePath)
      .split("/")
      .map(function (segment) {
        return encodeURIComponent(segment);
      })
      .join("/");
  }

  function buildContentsUrl(owner, repo, filePath, branch) {
    var base = "https://api.github.com/repos/"
      + encodeURIComponent(owner)
      + "/"
      + encodeURIComponent(repo)
      + "/contents/"
      + encodeRepoPath(filePath);
    if (branch) {
      return base + "?ref=" + encodeURIComponent(branch);
    }
    return base;
  }

  function buildAuthHeaders(token, includeJsonBody) {
    var headers = {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json"
    };
    if (includeJsonBody) {
      headers["Content-Type"] = "application/json";
    }
    return headers;
  }

  async function readGitHubErrorMessage(res) {
    try {
      if (res && typeof res.json === "function") {
        var body = await res.json();
        if (body && typeof body.message === "string" && body.message.trim()) {
          return body.message.trim();
        }
      }
    } catch (_err) {
      // Ignore parse failure when building fallback HTTP error message.
    }
    return "";
  }

  async function createGitHubHttpError(res) {
    var status = res && typeof res.status === "number" ? res.status : 0;
    var detail = await readGitHubErrorMessage(res);
    var suffix = detail ? " (" + detail + ")" : "";

    if (status === 401) {
      return new Error("GitHub 인증에 실패했습니다 (401). 토큰이 올바른지 또는 만료되지 않았는지 확인해 주세요." + suffix);
    }
    if (status === 403) {
      return new Error("GitHub 저장소 쓰기 권한이 부족하거나 요청 한도를 초과했습니다 (403). 토큰의 Contents 권한을 확인해 주세요." + suffix);
    }
    if (status === 404) {
      return new Error("GitHub 저장소, 브랜치 또는 경로를 찾을 수 없습니다 (404). owner/repo/branch 설정을 확인해 주세요." + suffix);
    }
    if (status === 409 || status === 422) {
      return new Error("GitHub 파일 반영 중 충돌 또는 유효성 오류가 발생했습니다 (" + status + "). 잠시 후 다시 시도해 주세요." + suffix);
    }
    return new Error("GitHub API 요청이 실패했습니다 (" + status + ")." + suffix);
  }

  async function fetchExistingFileInfo(fetchFn, owner, repo, branch, token, filePath) {
    var url = buildContentsUrl(owner, repo, filePath, branch);
    var res = await fetchFn(url, {
      method: "GET",
      headers: buildAuthHeaders(token, false)
    });

    if (!res) {
      throw new Error("GitHub API로부터 응답을 받지 못했습니다.");
    }
    if (res.status === 404) {
      return { sha: null, contentText: "" };
    }
    if (!res.ok) {
      throw await createGitHubHttpError(res);
    }

    var data = typeof res.json === "function" ? await res.json() : null;
    var sha = data && typeof data.sha === "string" ? data.sha : null;
    var contentText = "";
    if (data && typeof data.content === "string" && (!data.encoding || data.encoding === "base64")) {
      contentText = base64ToUtf8(data.content);
    }
    return { sha: sha, contentText: contentText };
  }

  async function putRepoFile(fetchFn, params) {
    var sha = typeof params.knownSha === "string" || params.knownSha === null
      ? params.knownSha
      : (await fetchExistingFileInfo(
        fetchFn,
        params.owner,
        params.repo,
        params.branch,
        params.token,
        params.filePath
      )).sha;

    var payload = {
      message: params.message,
      content: params.contentBase64,
      branch: params.branch
    };
    if (sha) {
      payload.sha = sha;
    }

    var res = await fetchFn(buildContentsUrl(params.owner, params.repo, params.filePath, ""), {
      method: "PUT",
      headers: buildAuthHeaders(params.token, true),
      body: JSON.stringify(payload)
    });

    if (!res) {
      throw new Error("GitHub API로부터 파일 업로드 응답을 받지 못했습니다.");
    }
    if (!res.ok) {
      throw await createGitHubHttpError(res);
    }

    return typeof res.json === "function" ? await res.json() : {};
  }

  /**
   * Uploads pending image thumbnails and publishes serialized data/apps.js via GitHub Contents API.
   */
  async function publishToGitHub(options) {
    var opts = options && typeof options === "object" ? options : {};
    var owner = trimString(opts.owner);
    var repo = trimString(opts.repo);
    var token = trimString(opts.token);
    var branch = trimString(opts.branch) || "main";

    if (!owner) {
      throw new Error("GitHub 저장소 소유자(owner)를 입력해 주세요.");
    }
    if (!repo) {
      throw new Error("GitHub 저장소 이름(repo)을 입력해 주세요.");
    }
    if (!token) {
      throw new Error("GitHub Personal Access Token을 입력해 주세요.");
    }

    var fetchFn = typeof opts.fetchImpl === "function"
      ? opts.fetchImpl
      : (typeof global.fetch === "function"
        ? global.fetch.bind(global)
        : (typeof fetch === "function" ? fetch : null));

    if (!fetchFn) {
      throw new Error("네트워크 요청(fetch)을 사용할 수 없는 환경입니다.");
    }

    var pendingMap = opts.pendingThumbnails && typeof opts.pendingThumbnails === "object"
      ? opts.pendingThumbnails
      : null;
    var rawApps = Array.isArray(opts.apps) ? opts.apps : [];
    var updatedApps = [];

    for (var i = 0; i < rawApps.length; i += 1) {
      var rawApp = rawApps[i];
      var sanitized = sanitizeAppRecord(rawApp);
      var pendingDataUrl = (pendingMap && sanitized.id && hasOwn(pendingMap, sanitized.id) && pendingMap[sanitized.id])
        || (rawApp && rawApp._pendingThumbDataUrl);

      var parsedImage = parseDataUrlBase64(pendingDataUrl);
      if (parsedImage) {
        if (!sanitized.id || !/^[a-z0-9-]+$/.test(sanitized.id)) {
          throw new Error("썸네일을 업로드하려면 영문 소문자·숫자·하이픈으로 된 앱 ID가 필요합니다.");
        }
        var thumbPath = "assets/thumbnails/" + sanitized.id + "." + parsedImage.ext;
        await putRepoFile(fetchFn, {
          owner: owner,
          repo: repo,
          branch: branch,
          token: token,
          filePath: thumbPath,
          message: "chore: upload thumbnail for " + sanitized.id,
          contentBase64: parsedImage.base64
        });
        sanitized.thumbnail = "./" + thumbPath;
      }

      updatedApps.push(sanitized);
    }

    var remoteAppsFile = await fetchExistingFileInfo(
      fetchFn,
      owner,
      repo,
      branch,
      token,
      "data/apps.js"
    );
    var remoteApps = parseAppsFromAppsJs(remoteAppsFile.contentText);
    var finalApps = mergeAppsWithRemote(remoteApps, updatedApps, opts.deletedIds);

    var serializedAppsJs = serializeAppsJs(opts.config, finalApps);
    var putResult = await putRepoFile(fetchFn, {
      owner: owner,
      repo: repo,
      branch: branch,
      token: token,
      filePath: "data/apps.js",
      message: "chore: update portfolio apps data",
      contentBase64: utf8ToBase64(serializedAppsJs),
      knownSha: remoteAppsFile.sha
    });

    var commitSha = putResult && putResult.commit && typeof putResult.commit.sha === "string"
      ? putResult.commit.sha
      : (putResult && putResult.content && typeof putResult.content.sha === "string" ? putResult.content.sha : "");
    var htmlUrl = putResult && putResult.commit && typeof putResult.commit.html_url === "string"
      ? putResult.commit.html_url
      : (putResult && putResult.content && typeof putResult.content.html_url === "string" ? putResult.content.html_url : "");

    return {
      ok: true,
      commitSha: commitSha,
      htmlUrl: htmlUrl,
      updatedApps: finalApps
    };
  }

  global.PortfolioGitHubSync = {
    utf8ToBase64: utf8ToBase64,
    base64ToUtf8: base64ToUtf8,
    parseAppsFromAppsJs: parseAppsFromAppsJs,
    parseDataUrlBase64: parseDataUrlBase64,
    sanitizeAppRecord: sanitizeAppRecord,
    serializeAppsJs: serializeAppsJs,
    publishToGitHub: publishToGitHub
  };
})(typeof window !== "undefined" ? window : globalThis);
