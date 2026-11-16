(function (global) {
  "use strict";

  var DEFAULT_TIMEOUT_MS = 6000;
  var CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;
  var PATH_TRAVERSAL_PATTERN = /(?:^|\/)\.\.(?:\/|$)/;

  var EDUCATION_KEYWORD_PATTERN = /(단어|퀴즈|영어|수학|학습|공부|수업|학생|단어장|시험|문제|교육|암기|어휘|독해|문법|교실|선생님|강의|quiz|study|edu|education|vocab|vocabulary|flashcard|learn|learning|math|english|school|student|teacher|lesson|exam|test)/i;
  var DAILY_KEYWORD_PATTERN = /(타이머|집중|뽀모도로|가계부|메모|일정|계산|체크|할일|할 일|습관|날씨|루틴|시계|달력|노트|다이어리|식단|운동|건강|생활|일상|timer|pomodoro|focus|todo|note|notes|habit|calc|calculator|tracker|calendar|weather|budget|expense|routine|clock|daily)/i;

  var NAMED_ENTITIES = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    "#39": "'",
    apos: "'",
    nbsp: " "
  };

  function validateAppUrl(rawUrl) {
    if (typeof rawUrl !== "string") {
      return {
        valid: false,
        normalizedUrl: "",
        launchType: "external",
        reason: "웹앱 주소는 문자열이어야 합니다."
      };
    }

    var trimmed = rawUrl.trim();
    if (!trimmed) {
      return {
        valid: false,
        normalizedUrl: "",
        launchType: "external",
        reason: "웹앱 링크를 입력해 주세요."
      };
    }

    if (CONTROL_CHAR_PATTERN.test(trimmed)) {
      return {
        valid: false,
        normalizedUrl: "",
        launchType: "external",
        reason: "사용할 수 없는 제어 문자가 포함되어 있습니다."
      };
    }

    var lower = trimmed.toLowerCase();
    if (lower.indexOf("javascript:") === 0 || lower.indexOf("data:") === 0 || lower.indexOf("vbscript:") === 0) {
      return {
        valid: false,
        normalizedUrl: "",
        launchType: "external",
        reason: "보안상 허용되지 않는 프로토콜입니다."
      };
    }

    if (trimmed.indexOf("./apps/") === 0) {
      if (PATH_TRAVERSAL_PATTERN.test(trimmed)) {
        return {
          valid: false,
          normalizedUrl: "",
          launchType: "embedded",
          reason: "상위 경로 이동(..)은 사용할 수 없습니다."
        };
      }
      var relativeSubpath = trimmed.slice("./apps/".length).split(/[?#]/)[0];
      if (!relativeSubpath || relativeSubpath === "/") {
        return {
          valid: false,
          normalizedUrl: "",
          launchType: "embedded",
          reason: "./apps/ 아래의 앱 폴더 또는 HTML 파일 경로를 입력해 주세요."
        };
      }
      return {
        valid: true,
        normalizedUrl: trimmed,
        launchType: "embedded"
      };
    }

    if (lower.indexOf("http://") !== 0 && lower.indexOf("https://") !== 0) {
      return {
        valid: false,
        normalizedUrl: "",
        launchType: "external",
        reason: "https://, http:// 또는 ./apps/ 형식의 경로만 입력할 수 있습니다."
      };
    }

    try {
      var parsed = new URL(trimmed);
      if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
        return {
          valid: false,
          normalizedUrl: "",
          launchType: "external",
          reason: "올바른 웹 주소 형식이 아닙니다."
        };
      }
      return {
        valid: true,
        normalizedUrl: parsed.href,
        launchType: "external"
      };
    } catch (_err) {
      return {
        valid: false,
        normalizedUrl: "",
        launchType: "external",
        reason: "올바른 웹 주소 형식이 아닙니다."
      };
    }
  }

  function extractGitHubRepo(url) {
    if (typeof url !== "string") {
      return null;
    }
    var trimmed = url.trim();
    var lower = trimmed.toLowerCase();
    if (lower.indexOf("http://") !== 0 && lower.indexOf("https://") !== 0) {
      return null;
    }

    var parsed;
    try {
      parsed = new URL(trimmed);
    } catch (_err) {
      return null;
    }

    var host = parsed.hostname.toLowerCase();
    var segments = parsed.pathname.split("/").filter(Boolean);

    var pagesMatch = /^([a-z0-9-]+)\.github\.io$/.exec(host);
    if (pagesMatch) {
      var pagesOwner = pagesMatch[1];
      if (segments.length === 0 || /\.(?:html?|css|js|json|svg|png|txt)$/i.test(segments[0])) {
        return { owner: pagesOwner, repo: pagesOwner + ".github.io" };
      }
      return { owner: pagesOwner, repo: segments[0] };
    }

    if (host === "github.com" || host === "www.github.com") {
      if (segments.length < 2) {
        return null;
      }
      var repoOwner = segments[0];
      var repoName = segments[1].replace(/\.git$/i, "");
      if (!repoOwner || !repoName) {
        return null;
      }
      return { owner: repoOwner, repo: repoName };
    }

    return null;
  }

  function decodeHtmlEntities(text) {
    if (typeof text !== "string" || !text) {
      return "";
    }
    return text.replace(/&([a-z]+|#\d+|#x[0-9a-f]+);/gi, function (match, token) {
      var lowerToken = token.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, lowerToken)) {
        return NAMED_ENTITIES[lowerToken];
      }
      if (lowerToken.charAt(0) === "#") {
        var codePoint = lowerToken.charAt(1) === "x"
          ? parseInt(lowerToken.slice(2), 16)
          : parseInt(lowerToken.slice(1), 10);
        if (codePoint > 0 && codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff)) {
          return String.fromCodePoint(codePoint);
        }
        return "";
      }
      return match;
    });
  }

  function cleanPlainText(rawFragment) {
    if (typeof rawFragment !== "string" || !rawFragment) {
      return "";
    }
    var withoutBreaks = rawFragment.replace(/<br\s*\/?>/gi, " ");
    var withoutTags = withoutBreaks.replace(/<[^>]*>/g, "");
    var decoded = decodeHtmlEntities(withoutTags);
    return decoded.replace(/\s+/g, " ").trim();
  }

  function stripNonContentBlocks(html) {
    return html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  }

  function parseTagAttributes(attrString) {
    var attrs = {};
    var attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    var match;
    while ((match = attrRegex.exec(attrString)) !== null) {
      var key = match[1].toLowerCase();
      var value = match[2] !== undefined ? match[2] : (match[3] !== undefined ? match[3] : (match[4] || ""));
      attrs[key] = value;
    }
    return attrs;
  }

  function extractMetaDescription(cleanHtml) {
    var metaRegex = /<meta\b([^>]*)\/?>/gi;
    var match;
    var standardDesc = "";
    var ogDesc = "";

    while ((match = metaRegex.exec(cleanHtml)) !== null) {
      var attrs = parseTagAttributes(match[1]);
      var content = cleanPlainText(attrs.content || "");
      if (!content) {
        continue;
      }
      var nameVal = (attrs.name || "").toLowerCase();
      var propVal = (attrs.property || "").toLowerCase();

      if (nameVal === "description" && !standardDesc) {
        standardDesc = content;
      } else if ((propVal === "og:description" || nameVal === "og:description") && !ogDesc) {
        ogDesc = content;
      }
    }

    return standardDesc || ogDesc;
  }

  function extractTextList(cleanHtml, tagPattern, limit) {
    var items = [];
    var seen = {};
    var regex = new RegExp("<(" + tagPattern + ")\\b[^>]*>([\\s\\S]*?)<\\/\\1>", "gi");
    var match;

    while ((match = regex.exec(cleanHtml)) !== null) {
      var text = cleanPlainText(match[2]);
      if (!text || seen[text]) {
        continue;
      }
      seen[text] = true;
      items.push(text);
      if (items.length >= limit) {
        break;
      }
    }

    return items;
  }

  function parseHtmlMetadata(htmlText) {
    if (typeof htmlText !== "string" || !htmlText.trim()) {
      return {
        title: "",
        description: "",
        headings: [],
        snippets: []
      };
    }

    var cleanHtml = stripNonContentBlocks(htmlText);
    var titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(cleanHtml);
    var title = titleMatch ? cleanPlainText(titleMatch[1]) : "";
    var description = extractMetaDescription(cleanHtml);
    var headings = extractTextList(cleanHtml, "h1|h2", 4);
    var snippets = extractTextList(cleanHtml, "p|button", 3);

    return {
      title: title,
      description: description,
      headings: headings,
      snippets: snippets
    };
  }

  function slugifyAscii(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function humanizeSlug(slug) {
    if (typeof slug !== "string" || !slug) {
      return "";
    }
    return slug
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b[a-z]/g, function (ch) {
        return ch.toUpperCase();
      });
  }

  function deriveAppId(url, repoMeta) {
    if (typeof url === "string" && url.indexOf("./apps/") === 0) {
      var subPath = url.slice("./apps/".length).split(/[?#]/)[0];
      var firstSegment = subPath.split("/").filter(Boolean)[0] || "";
      var embeddedSlug = slugifyAscii(firstSegment.replace(/\.[a-z0-9]+$/i, ""));
      if (embeddedSlug) {
        return embeddedSlug;
      }
    }

    var ghRepo = extractGitHubRepo(url);
    if (ghRepo) {
      var repoCandidate = (repoMeta && repoMeta.name) ? repoMeta.name : ghRepo.repo;
      var ghSlug = slugifyAscii(repoCandidate);
      if (ghSlug) {
        return ghSlug;
      }
    }

    if (typeof url === "string") {
      try {
        var parsed = new URL(url);
        var segments = parsed.pathname.split("/").filter(Boolean);
        for (var i = segments.length - 1; i >= 0; i -= 1) {
          var cleaned = segments[i].replace(/\.(?:html?|php|aspx?)$/i, "");
          if (cleaned && cleaned.toLowerCase() !== "index") {
            var segSlug = slugifyAscii(cleaned);
            if (segSlug) {
              return segSlug;
            }
          }
        }
        var hostSlug = slugifyAscii(parsed.hostname.replace(/^www\./i, ""));
        if (hostSlug) {
          return hostSlug;
        }
      } catch (_err) {
        // Fallback handled below
      }
    }

    return "web-app";
  }

  function resolveEmbedMode(url) {
    if (typeof url === "string" && url.indexOf("./apps/") === 0) {
      return "iframe";
    }
    try {
      var parsed = new URL(url);
      if (/\.github\.io$/i.test(parsed.hostname)) {
        return "iframe";
      }
    } catch (_err) {
      // Non-URL strings default to newTab
    }
    return "newTab";
  }

  function truncateText(text, maxLength) {
    if (typeof text !== "string") {
      return "";
    }
    var trimmed = text.trim();
    if (trimmed.length <= maxLength) {
      return trimmed;
    }
    return trimmed.slice(0, maxLength - 1).trim() + "…";
  }

  function detectDomainProfile(corpus) {
    var hasEducation = EDUCATION_KEYWORD_PATTERN.test(corpus);
    var hasDaily = DAILY_KEYWORD_PATTERN.test(corpus);
    var suggestedTags = [];

    if (hasEducation) {
      suggestedTags.push("교육");
    }
    if (hasDaily) {
      suggestedTags.push("일상생활");
    }
    if (suggestedTags.length === 0) {
      suggestedTags = ["교육", "일상생활"];
    }

    return {
      hasEducation: hasEducation,
      hasDaily: hasDaily,
      suggestedTags: suggestedTags
    };
  }

  function buildDomainCopy(corpus, profile, title, sourceDesc) {
    if (/타이머|집중|뽀모도로|timer|pomodoro|focus/i.test(corpus)) {
      return {
        defaultTagline: "집중 시간과 루틴을 간편하게 관리하는 웹 타이머",
        purpose: sourceDesc
          ? sourceDesc + " — 정해진 시간 동안 집중력을 유지하고 휴식 주기를 체계적으로 관리할 수 있도록 제작했습니다."
          : "정해진 시간 동안 몰입을 유지하고 휴식 리듬을 손쉽게 관리할 수 있도록 돕는 집중 타이머 웹앱입니다.",
        audience: "집중 학습이나 업무 시간 관리가 필요한 학생, 교사 및 직장인",
        extraBullets: [
          "시작·일시정지·초기화 버튼으로 직관적인 시간 제어가 가능합니다.",
          "별도 설치 없이 브라우저 화면에서 바로 타이머를 실행할 수 있습니다."
        ]
      };
    }

    if (/단어|어휘|단어장|vocab|vocabulary|flashcard|영어|english/i.test(corpus)) {
      return {
        defaultTagline: "핵심 어휘를 반복 학습하고 퀴즈로 점검하는 웹앱",
        purpose: sourceDesc
          ? sourceDesc + " — 단어 암기와 실전 확인 과정을 가볍게 반복해 학습 효과를 높이기 위해 제작했습니다."
          : "핵심 어휘와 개념을 반복 연습하고 스스로 성취도를 점검할 수 있도록 구성한 학습 웹앱입니다.",
        audience: "어휘 실력을 기르고 싶은 학생, 교사 및 자기주도 학습자",
        extraBullets: [
          "핵심 단어와 문제를 단계별로 살펴보며 반복 복습할 수 있습니다.",
          "PC와 모바일 브라우저 모두에서 언제든 가볍게 학습을 이어갈 수 있습니다."
        ]
      };
    }

    if (/퀴즈|시험|문제|quiz|exam|test|수학|math/i.test(corpus)) {
      return {
        defaultTagline: "문제를 풀며 개념 이해도를 바로 확인하는 인터랙티브 웹앱",
        purpose: sourceDesc
          ? sourceDesc + " — 수업이나 자습 중 배운 내용을 즉시 문제 풀이로 확인하고 복습할 수 있도록 만들었습니다."
          : "학습한 내용을 퀴즈와 문제 풀이로 즉시 점검하고 복습 효율을 높이기 위해 제작한 교육용 웹앱입니다.",
        audience: "수업 참여 학생, 교사 및 문제 풀이 연습이 필요한 학습자",
        extraBullets: [
          "화면 안내에 따라 문제를 풀고 학습 내용을 빠르게 점검할 수 있습니다.",
          "설치나 로그인 없이 링크만으로 수업·가정 학습에 바로 활용할 수 있습니다."
        ]
      };
    }

    if (/가계부|예산|계산|지출|budget|expense|calc|calculator/i.test(corpus)) {
      return {
        defaultTagline: "수치 계산과 일상 기록을 빠르고 정확하게 처리하는 웹앱",
        purpose: sourceDesc
          ? sourceDesc + " — 일상에서 자주 필요한 계산과 지출·수치 관리를 손쉽게 처리할 수 있도록 제작했습니다."
          : "일상생활 속 반복 계산과 수치 정리를 복잡한 절차 없이 빠르게 처리할 수 있도록 돕는 실용 웹앱입니다.",
        audience: "생활 계산과 기록을 간편하게 관리하고 싶은 모든 사용자",
        extraBullets: [
          "필요한 값을 입력하면 즉시 결과를 확인하고 비교할 수 있습니다.",
          "가벼운 웹 화면으로 모바일과 데스크톱 어디서나 빠르게 접근할 수 있습니다."
        ]
      };
    }

    if (/습관|할일|할 일|체크|메모|일정|루틴|todo|habit|note|tracker|calendar/i.test(corpus)) {
      return {
        defaultTagline: "일정과 습관을 꾸준히 기록하고 점검하는 생활 관리 웹앱",
        purpose: sourceDesc
          ? sourceDesc + " — 매일 해야 할 일과 목표를 한눈에 정리해 꾸준한 실행을 돕기 위해 제작했습니다."
          : "일상의 할 일, 메모, 루틴을 깔끔하게 기록하고 실천 여부를 바로 확인할 수 있도록 만든 웹앱입니다.",
        audience: "꾸준한 루틴과 일정 관리를 원하는 학생 및 일반 사용자",
        extraBullets: [
          "핵심 항목을 손쉽게 입력하고 진행 상태를 직관적으로 체크할 수 있습니다.",
          "웹 브라우저에서 바로 열어 매일의 기록을 가볍게 이어갈 수 있습니다."
        ]
      };
    }

    if (profile.hasEducation) {
      return {
        defaultTagline: title + " 학습 활동을 지원하는 교육용 웹앱",
        purpose: sourceDesc
          ? sourceDesc + " — 학습자가 핵심 내용을 이해하고 스스로 연습할 수 있도록 돕기 위해 제작했습니다."
          : "수업과 자기주도 학습에서 핵심 개념을 쉽고 흥미롭게 익힐 수 있도록 제작한 교육용 웹앱입니다.",
        audience: "초·중·고 학생, 교사 및 자기주도 학습자",
        extraBullets: [
          "화면에 안내된 단계에 따라 별도 설치 없이 바로 학습을 시작할 수 있습니다.",
          "모바일과 데스크톱 환경 모두에 맞춰 편리하게 이용할 수 있습니다."
        ]
      };
    }

    if (profile.hasDaily) {
      return {
        defaultTagline: "일상에서 바로 꺼내 쓰는 간편 웹 유틸리티",
        purpose: sourceDesc
          ? sourceDesc + " — 일상 속 번거로운 작업을 웹에서 손쉽게 해결할 수 있도록 구성했습니다."
          : "일상생활에 필요한 기능을 복잡한 절차 없이 브라우저에서 즉시 사용할 수 있도록 제작한 웹앱입니다.",
        audience: "실용적인 웹 도구를 간편하게 활용하고 싶은 모든 사용자",
        extraBullets: [
          "링크를 열면 별도 가입이나 설치 없이 핵심 기능을 바로 실행할 수 있습니다.",
          "직관적인 화면 구성으로 누구나 부담 없이 사용할 수 있습니다."
        ]
      };
    }

    return {
      defaultTagline: sourceDesc ? truncateText(sourceDesc, 70) : title + " 웹앱 바로 실행 도구",
      purpose: sourceDesc
        ? sourceDesc + " — 교육과 일상생활에서 필요한 작업을 웹에서 간편하게 수행할 수 있도록 제작했습니다."
        : "별도 프로그램 설치 없이 웹 브라우저만으로 필요한 기능을 손쉽게 활용할 수 있도록 만든 웹앱입니다.",
      audience: "교육 현장 및 일상에서 웹앱 도구를 활용하고 싶은 모든 사용자",
      extraBullets: [
        "링크를 통해 브라우저에서 즉시 실행하고 주요 기능을 체험할 수 있습니다.",
        "PC와 모바일 화면 크기에서 모두 안정적으로 동작하도록 활용할 수 있습니다."
      ]
    };
  }

  function buildDescriptionBullets(htmlMeta, repoMeta, domainCopy) {
    var bullets = [];
    var seen = {};

    function addBullet(text) {
      var cleaned = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
      if (!cleaned || seen[cleaned]) {
        return;
      }
      seen[cleaned] = true;
      bullets.push(truncateText(cleaned, 120));
    }

    var headings = htmlMeta && Array.isArray(htmlMeta.headings) ? htmlMeta.headings : [];
    var snippets = htmlMeta && Array.isArray(htmlMeta.snippets) ? htmlMeta.snippets : [];

    for (var i = 0; i < snippets.length && bullets.length < 2; i += 1) {
      if (snippets[i].length >= 8) {
        addBullet(snippets[i]);
      }
    }

    if (headings.length > 1) {
      addBullet("주요 구성: " + headings.slice(0, 3).join(" · "));
    } else if (snippets.length > 0 && bullets.length === 0) {
      addBullet("주요 동작 버튼: " + snippets.slice(0, 3).join(", "));
    }

    if (repoMeta && Array.isArray(repoMeta.topics) && repoMeta.topics.length > 0 && bullets.length < 2) {
      addBullet("관련 주제: " + repoMeta.topics.slice(0, 4).join(", "));
    }

    for (var j = 0; j < domainCopy.extraBullets.length && bullets.length < 3; j += 1) {
      addBullet(domainCopy.extraBullets[j]);
    }

    return bullets.slice(0, 3);
  }

  function buildRecommendations(input) {
    var params = input && typeof input === "object" ? input : {};
    var url = typeof params.url === "string" ? params.url.trim() : "";
    var htmlMeta = params.htmlMeta && typeof params.htmlMeta === "object" ? params.htmlMeta : null;
    var repoMeta = params.repoMeta && typeof params.repoMeta === "object" ? params.repoMeta : null;

    var id = deriveAppId(url, repoMeta);
    var headings = htmlMeta && Array.isArray(htmlMeta.headings) ? htmlMeta.headings : [];
    var snippets = htmlMeta && Array.isArray(htmlMeta.snippets) ? htmlMeta.snippets : [];
    var topics = repoMeta && Array.isArray(repoMeta.topics) ? repoMeta.topics : [];

    var title = (htmlMeta && htmlMeta.title)
      || headings[0]
      || (repoMeta && repoMeta.name ? humanizeSlug(repoMeta.name) : "")
      || humanizeSlug(id)
      || "새 웹앱";

    var sourceDesc = (htmlMeta && htmlMeta.description) || (repoMeta && repoMeta.description) || "";
    var corpusParts = [
      url,
      title,
      sourceDesc,
      headings.join(" "),
      snippets.join(" "),
      repoMeta && repoMeta.name ? repoMeta.name : "",
      repoMeta && repoMeta.language ? repoMeta.language : "",
      topics.join(" ")
    ];
    var corpus = corpusParts.join(" ").toLowerCase();

    var profile = detectDomainProfile(corpus);
    var domainCopy = buildDomainCopy(corpus, profile, title, sourceDesc);

    var tagline = sourceDesc
      ? truncateText(sourceDesc, 80)
      : (headings[0] && headings[0] !== title ? truncateText(headings[0], 80) : domainCopy.defaultTagline);

    var description = buildDescriptionBullets(htmlMeta, repoMeta, domainCopy);

    return {
      id: id,
      title: title,
      tagline: tagline,
      purpose: domainCopy.purpose,
      audience: domainCopy.audience,
      description: description,
      suggestedTags: profile.suggestedTags,
      embedMode: resolveEmbedMode(url)
    };
  }

  function resolveFetchTarget(normalizedUrl, baseHref) {
    if (normalizedUrl.indexOf("./") === 0 && typeof baseHref === "string" && baseHref) {
      try {
        return new URL(normalizedUrl, baseHref).href;
      } catch (_err) {
        return normalizedUrl;
      }
    }
    return normalizedUrl;
  }

  function createTimeoutSignal(timeoutMs) {
    if (typeof AbortController !== "function") {
      return { signal: undefined, cleanup: function () {} };
    }
    var controller = new AbortController();
    var timerId = setTimeout(function () {
      controller.abort();
    }, timeoutMs);

    return {
      signal: controller.signal,
      cleanup: function () {
        clearTimeout(timerId);
      }
    };
  }

  async function fetchGitHubRepoMeta(ghRepo, fetchImpl, timeoutMs) {
    if (!ghRepo || typeof fetchImpl !== "function") {
      return null;
    }
    var apiUrl = "https://api.github.com/repos/"
      + encodeURIComponent(ghRepo.owner)
      + "/"
      + encodeURIComponent(ghRepo.repo);

    var timer = createTimeoutSignal(timeoutMs);
    try {
      var res = await fetchImpl(apiUrl, {
        headers: { Accept: "application/vnd.github+json" },
        signal: timer.signal
      });
      if (!res || !res.ok || typeof res.json !== "function") {
        return null;
      }
      var data = await res.json();
      if (!data || typeof data !== "object") {
        return null;
      }
      return {
        name: typeof data.name === "string" ? data.name : ghRepo.repo,
        fullName: typeof data.full_name === "string" ? data.full_name : ghRepo.owner + "/" + ghRepo.repo,
        description: typeof data.description === "string" ? data.description.trim() : "",
        topics: Array.isArray(data.topics) ? data.topics.filter(function (t) { return typeof t === "string"; }) : [],
        language: typeof data.language === "string" ? data.language : ""
      };
    } catch (_err) {
      return null;
    } finally {
      timer.cleanup();
    }
  }

  async function fetchHtmlPage(fetchTarget, fetchImpl, timeoutMs) {
    if (typeof fetchImpl !== "function") {
      return { state: "network-error", htmlMeta: null, httpStatus: 0 };
    }

    var timer = createTimeoutSignal(timeoutMs);
    try {
      var res = await fetchImpl(fetchTarget, { signal: timer.signal });
      if (!res) {
        return { state: "network-error", htmlMeta: null, httpStatus: 0 };
      }
      if (!res.ok) {
        return { state: "http-error", htmlMeta: null, httpStatus: res.status || 0 };
      }
      var htmlText = typeof res.text === "function" ? await res.text() : "";
      return {
        state: "ok",
        htmlMeta: parseHtmlMetadata(htmlText),
        httpStatus: res.status || 200
      };
    } catch (_err) {
      return { state: "network-error", htmlMeta: null, httpStatus: 0 };
    } finally {
      timer.cleanup();
    }
  }

  async function checkNoCorsReachability(fetchTarget, fetchImpl, timeoutMs) {
    if (typeof fetchImpl !== "function") {
      return false;
    }
    var timer = createTimeoutSignal(timeoutMs);
    try {
      await fetchImpl(fetchTarget, { mode: "no-cors", signal: timer.signal });
      return true;
    } catch (_err) {
      return false;
    } finally {
      timer.cleanup();
    }
  }

  async function inspectWebAppUrl(rawUrl, options) {
    var validation = validateAppUrl(rawUrl);
    if (!validation.valid) {
      return {
        ok: false,
        status: "invalid",
        statusMessage: validation.reason || "유효하지 않은 웹앱 링크입니다.",
        validation: validation,
        launchType: validation.launchType,
        normalizedUrl: "",
        htmlMeta: null,
        repoMeta: null,
        recommendations: null
      };
    }

    var opts = options && typeof options === "object" ? options : {};
    var fetchImpl = typeof opts.fetchImpl === "function"
      ? opts.fetchImpl
      : (typeof global.fetch === "function" ? global.fetch.bind(global) : null);
    var baseHref = typeof opts.baseHref === "string" ? opts.baseHref : "";
    var timeoutMs = typeof opts.timeoutMs === "number" && opts.timeoutMs > 0 ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;

    var normalizedUrl = validation.normalizedUrl;
    var fetchTarget = resolveFetchTarget(normalizedUrl, baseHref);
    var ghRepo = extractGitHubRepo(normalizedUrl);

    var parallelResults = await Promise.all([
      fetchHtmlPage(fetchTarget, fetchImpl, timeoutMs),
      fetchGitHubRepoMeta(ghRepo, fetchImpl, timeoutMs)
    ]);

    var pageResult = parallelResults[0];
    var repoMeta = parallelResults[1];
    var htmlMeta = pageResult.htmlMeta;

    var ok = false;
    var status = "unreachable";
    var statusMessage = "";

    if (pageResult.state === "ok") {
      ok = true;
      status = "analyzed";
      statusMessage = "웹앱 페이지 내용을 분석해 추천 문구를 생성했습니다.";
    } else if (pageResult.state === "http-error") {
      ok = false;
      status = "unreachable";
      statusMessage = "웹앱 링크에 연결할 수 없습니다(HTTP " + pageResult.httpStatus + "). 주소를 다시 확인해 주세요. 주소 기반 기본 추천 문구는 생성했습니다.";
    } else {
      var noCorsOk = await checkNoCorsReachability(fetchTarget, fetchImpl, timeoutMs);
      if (noCorsOk) {
        ok = true;
        status = "cors-limited";
        statusMessage = "링크 연결은 확인되었으나 외부 도메인 보안 정책(CORS)으로 상세 내용을 직접 읽지 못해 주소·저장소 정보를 바탕으로 추천 문구를 만들었습니다.";
      } else {
        ok = false;
        status = "unreachable";
        statusMessage = "웹앱 링크에 연결할 수 없습니다. 주소나 네트워크 상태를 확인해 주세요. 주소 기반 기본 추천 문구는 생성했습니다.";
      }
    }

    var recommendations = buildRecommendations({
      url: normalizedUrl,
      htmlMeta: htmlMeta,
      repoMeta: repoMeta
    });

    return {
      ok: ok,
      status: status,
      statusMessage: statusMessage,
      launchType: validation.launchType,
      normalizedUrl: normalizedUrl,
      htmlMeta: htmlMeta,
      repoMeta: repoMeta,
      recommendations: recommendations
    };
  }

  global.PortfolioRecommender = {
    validateAppUrl: validateAppUrl,
    parseHtmlMetadata: parseHtmlMetadata,
    extractGitHubRepo: extractGitHubRepo,
    buildRecommendations: buildRecommendations,
    inspectWebAppUrl: inspectWebAppUrl
  };
})(typeof window !== "undefined" ? window : globalThis);
