(function (global) {
  "use strict";

  var DEFAULT_PAGE_SIZE = 5;
  var DEFAULT_COOLDOWN_MS = 10000;
  var AUTHOR_MAX_LEN = 30;
  var CONTENT_MIN_LEN = 2;
  var CONTENT_MAX_LEN = 1000;
  var REPLY_MAX_LEN = 500;

  function pad2(num) {
    return num < 10 ? "0" + String(num) : String(num);
  }

  /**
   * Formats an epoch ms timestamp into YYYY-MM-DD HH:mm.
   */
  function formatPostTimestamp(ts) {
    if (typeof ts !== "number" || !isFinite(ts) || ts <= 0) {
      return "";
    }
    var d = new Date(ts);
    if (isNaN(d.getTime())) {
      return "";
    }
    return (
      String(d.getFullYear()) +
      "-" +
      pad2(d.getMonth() + 1) +
      "-" +
      pad2(d.getDate()) +
      " " +
      pad2(d.getHours()) +
      ":" +
      pad2(d.getMinutes())
    );
  }

  function createEl(doc, tag, className, text) {
    var el = doc.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (text !== undefined && text !== null) {
      el.textContent = String(text);
    }
    return el;
  }

  /**
   * Builds and manages the public inquiry/suggestion/request board modal.
   */
  function createBoardController(options) {
    var opts = options || {};
    var doc = opts.document || (typeof document !== "undefined" ? document : null);
    var modalEl = opts.modalEl || opts.containerEl || (doc && doc.getElementById ? doc.getElementById("board-modal") : null);
    if (!doc || !modalEl) {
      return null;
    }

    var firebaseApi = opts.firebaseApi || global.PortfolioFirebase || null;
    var pageSize = typeof opts.pageSize === "number" && opts.pageSize > 0 ? Math.floor(opts.pageSize) : DEFAULT_PAGE_SIZE;
    var cooldownMs = typeof opts.cooldownMs === "number" && opts.cooldownMs >= 0 ? opts.cooldownMs : DEFAULT_COOLDOWN_MS;
    var nowFn = typeof opts.now === "function" ? opts.now : function () { return Date.now(); };
    var onNotify = typeof opts.onNotify === "function" ? opts.onNotify : function () {};
    var onOpenChange = typeof opts.onOpenChange === "function" ? opts.onOpenChange : function () {};

    var adminUnlocked = typeof opts.isAdminUnlocked === "function"
      ? Boolean(opts.isAdminUnlocked())
      : Boolean(opts.isAdminUnlocked);

    var posts = [];
    var visibleCount = pageSize;
    var loading = false;
    var submitting = false;
    var lastSubmitAt = 0;
    var loadError = "";
    var confirmDeleteId = null;
    var editingReplyId = null;
    var busyPostId = null;
    var destroyed = false;

    var backdrop = createEl(doc, "div", "modal-backdrop");
    var dialog = createEl(doc, "div", "modal-dialog board-modal-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "board-modal-title");

    var shell = createEl(doc, "div", "board-card-shell");

    // Header row
    var header = createEl(doc, "div", "board-header");
    var headerInfo = createEl(doc, "div", "board-header-info");
    var titleEl = createEl(doc, "h2", "board-title", "문의 · 건의 · 요청 게시판");
    titleEl.id = "board-modal-title";
    var subtitleEl = createEl(
      doc,
      "p",
      "board-subtitle",
      "궁금한 점이나 개선 의견, 만들어졌으면 하는 웹앱 요청을 자유롭게 남겨주세요."
    );
    headerInfo.appendChild(titleEl);
    headerInfo.appendChild(subtitleEl);

    var headerActions = createEl(doc, "div", "board-header-actions");
    var countBadge = createEl(doc, "span", "board-count-badge", "전체 0건");
    countBadge.id = "board-count";
    var refreshBtn = createEl(doc, "button", "board-refresh-btn", "새로고침");
    refreshBtn.id = "board-refresh";
    refreshBtn.type = "button";
    var closeBtn = createEl(doc, "button", "modal-close board-close-btn", "×");
    closeBtn.id = "board-close-btn";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "게시판 닫기");
    headerActions.appendChild(countBadge);
    headerActions.appendChild(refreshBtn);
    headerActions.appendChild(closeBtn);

    header.appendChild(headerInfo);
    header.appendChild(headerActions);
    shell.appendChild(header);

    // Body layout (compact form + post list)
    var layout = createEl(doc, "div", "board-layout");

    var formEl = createEl(doc, "form", "board-form");
    formEl.id = "board-form";
    formEl.setAttribute("novalidate", "novalidate");

    var authorGroup = createEl(doc, "div", "board-field");
    var authorLabel = createEl(doc, "label", "board-label");
    authorLabel.htmlFor = "board-author";
    authorLabel.setAttribute("for", "board-author");
    authorLabel.appendChild(createEl(doc, "span", "", "닉네임 "));
    authorLabel.appendChild(createEl(doc, "span", "board-optional", "(선택)"));
    var authorInput = createEl(doc, "input", "board-input");
    authorInput.id = "board-author";
    authorInput.type = "text";
    authorInput.maxLength = AUTHOR_MAX_LEN;
    authorInput.placeholder = "닉네임 (비우면 익명)";
    authorInput.setAttribute("autocomplete", "nickname");
    authorGroup.appendChild(authorLabel);
    authorGroup.appendChild(authorInput);

    var contentGroup = createEl(doc, "div", "board-field");
    var contentLabel = createEl(doc, "label", "board-label");
    contentLabel.htmlFor = "board-content";
    contentLabel.setAttribute("for", "board-content");
    contentLabel.appendChild(createEl(doc, "span", "", "내용 "));
    contentLabel.appendChild(createEl(doc, "span", "board-required", "*"));
    var contentInput = createEl(doc, "textarea", "board-textarea");
    contentInput.id = "board-content";
    contentInput.rows = 3;
    contentInput.maxLength = CONTENT_MAX_LEN;
    contentInput.required = true;
    contentInput.placeholder = "문의사항, 건의사항, 요청하고 싶은 웹앱을 자유롭게 남겨주세요.";
    contentGroup.appendChild(contentLabel);
    contentGroup.appendChild(contentInput);

    var formFooter = createEl(doc, "div", "board-form-footer");
    var charCountEl = createEl(doc, "span", "board-char-count", "0 / " + String(CONTENT_MAX_LEN));
    charCountEl.id = "board-char-count";
    var submitBtn = createEl(doc, "button", "btn-primary board-submit-btn", "남기기");
    submitBtn.id = "board-submit";
    submitBtn.type = "submit";
    formFooter.appendChild(charCountEl);
    formFooter.appendChild(submitBtn);

    var formStatusEl = createEl(doc, "p", "board-form-status");
    formStatusEl.id = "board-form-status";
    formStatusEl.setAttribute("role", "status");
    formStatusEl.setAttribute("aria-live", "polite");
    formStatusEl.hidden = true;

    formEl.appendChild(authorGroup);
    formEl.appendChild(contentGroup);
    formEl.appendChild(formFooter);
    formEl.appendChild(formStatusEl);

    var listWrap = createEl(doc, "div", "board-list-wrap");
    var listStatusEl = createEl(doc, "div", "board-list-status");
    listStatusEl.id = "board-list-status";
    listStatusEl.setAttribute("aria-live", "polite");

    var listEl = createEl(doc, "ul", "board-list");
    listEl.id = "board-list";

    var moreWrap = createEl(doc, "div", "board-more-wrap");
    moreWrap.id = "board-more-wrap";
    moreWrap.hidden = true;
    var moreBtn = createEl(doc, "button", "btn-secondary board-more-btn", "더 보기");
    moreBtn.id = "board-load-more";
    moreBtn.type = "button";
    moreWrap.appendChild(moreBtn);

    listWrap.appendChild(listStatusEl);
    listWrap.appendChild(listEl);
    listWrap.appendChild(moreWrap);

    layout.appendChild(formEl);
    layout.appendChild(listWrap);
    shell.appendChild(layout);
    dialog.appendChild(shell);

    modalEl.hidden = true;
    modalEl.setAttribute("aria-hidden", "true");
    if (typeof modalEl.replaceChildren === "function") {
      modalEl.replaceChildren(backdrop, dialog);
    } else {
      modalEl.textContent = "";
      modalEl.appendChild(backdrop);
      modalEl.appendChild(dialog);
    }

    function setFormStatus(message, isError) {
      if (!message) {
        formStatusEl.textContent = "";
        formStatusEl.hidden = true;
        formStatusEl.classList.remove("is-error");
        formStatusEl.classList.remove("is-success");
        return;
      }
      formStatusEl.textContent = message;
      formStatusEl.hidden = false;
      if (isError) {
        formStatusEl.classList.add("is-error");
        formStatusEl.classList.remove("is-success");
      } else {
        formStatusEl.classList.add("is-success");
        formStatusEl.classList.remove("is-error");
      }
    }

    function updateCharCount() {
      var len = typeof contentInput.value === "string" ? contentInput.value.length : 0;
      charCountEl.textContent = String(len) + " / " + String(CONTENT_MAX_LEN);
    }

    function hasFirebaseSession() {
      if (!firebaseApi || typeof firebaseApi.getStoredAuth !== "function") {
        return false;
      }
      var auth = firebaseApi.getStoredAuth();
      return Boolean(auth && auth.idToken);
    }

    function ensureFirebaseModeratorReady() {
      if (hasFirebaseSession()) {
        return true;
      }
      var msg = "관리자 모드에서 Firebase 로그인 후 삭제·답변할 수 있습니다.";
      onNotify(msg);
      setFormStatus(msg, true);
      return false;
    }

    function renderPostItem(post) {
      var li = createEl(doc, "li", "board-post");
      li.setAttribute("data-post-id", post.id);

      var topRow = createEl(doc, "div", "board-post-top");
      var meta = createEl(doc, "div", "board-post-meta");
      meta.appendChild(createEl(doc, "span", "board-post-author", post.author || "익명"));
      var formattedDate = formatPostTimestamp(post.createdAt);
      if (formattedDate) {
        meta.appendChild(createEl(doc, "time", "board-post-date", formattedDate));
      }
      topRow.appendChild(meta);

      if (adminUnlocked) {
        var actions = createEl(doc, "div", "board-post-actions");
        var replyToggleBtn = createEl(
          doc,
          "button",
          "board-action-btn board-reply-toggle-btn",
          post.reply ? "답변 수정" : "답변"
        );
        replyToggleBtn.type = "button";
        replyToggleBtn.disabled = busyPostId === post.id;
        replyToggleBtn.addEventListener("click", function () {
          if (!ensureFirebaseModeratorReady()) {
            return;
          }
          confirmDeleteId = null;
          editingReplyId = editingReplyId === post.id ? null : post.id;
          renderPosts();
        });

        var isConfirming = confirmDeleteId === post.id;
        var deleteBtn = createEl(
          doc,
          "button",
          isConfirming ? "board-action-btn board-delete-btn is-danger is-confirming" : "board-action-btn board-delete-btn is-danger",
          isConfirming ? "삭제 확인" : "삭제"
        );
        deleteBtn.type = "button";
        deleteBtn.disabled = busyPostId === post.id;
        deleteBtn.addEventListener("click", function () {
          handleDeleteClick(post.id);
        });

        actions.appendChild(replyToggleBtn);
        actions.appendChild(deleteBtn);
        topRow.appendChild(actions);
      }

      li.appendChild(topRow);
      li.appendChild(createEl(doc, "p", "board-post-content", post.content));

      if (post.reply) {
        var replyBox = createEl(doc, "div", "board-post-reply");
        var replyHead = createEl(doc, "div", "board-reply-head");
        replyHead.appendChild(createEl(doc, "span", "board-reply-badge", "사부자기 윤선생 답변"));
        var replyDate = formatPostTimestamp(post.replyAt);
        if (replyDate) {
          replyHead.appendChild(createEl(doc, "time", "board-reply-date", replyDate));
        }
        replyBox.appendChild(replyHead);
        replyBox.appendChild(createEl(doc, "p", "board-reply-text", post.reply));
        li.appendChild(replyBox);
      }

      if (adminUnlocked && editingReplyId === post.id) {
        var editor = createEl(doc, "div", "board-reply-editor");
        var replyInput = createEl(doc, "textarea", "board-reply-input");
        replyInput.rows = 2;
        replyInput.maxLength = REPLY_MAX_LEN;
        replyInput.placeholder = "답변 내용을 입력하세요... (최대 500자)";
        replyInput.value = post.reply || "";

        var editorActions = createEl(doc, "div", "board-reply-editor-actions");
        var saveReplyBtn = createEl(doc, "button", "btn-primary board-reply-save-btn", "답변 저장");
        saveReplyBtn.type = "button";
        saveReplyBtn.disabled = busyPostId === post.id;
        saveReplyBtn.addEventListener("click", function () {
          handleReplySave(post.id, replyInput.value);
        });

        var cancelReplyBtn = createEl(doc, "button", "btn-secondary board-reply-cancel-btn", "취소");
        cancelReplyBtn.type = "button";
        cancelReplyBtn.addEventListener("click", function () {
          editingReplyId = null;
          renderPosts();
        });

        editorActions.appendChild(saveReplyBtn);
        editorActions.appendChild(cancelReplyBtn);
        editor.appendChild(replyInput);
        editor.appendChild(editorActions);
        li.appendChild(editor);
      }

      return li;
    }

    function renderPosts() {
      countBadge.textContent = "전체 " + String(posts.length) + "건";

      if (loading && posts.length === 0) {
        listStatusEl.textContent = "게시판 글을 불러오는 중입니다...";
        listStatusEl.hidden = false;
        listEl.replaceChildren();
        moreWrap.hidden = true;
        return;
      }

      if (loadError && posts.length === 0) {
        listStatusEl.textContent = loadError;
        listStatusEl.hidden = false;
        listEl.replaceChildren();
        moreWrap.hidden = true;
        return;
      }

      if (posts.length === 0) {
        listStatusEl.textContent = "아직 등록된 문의·건의가 없습니다. 첫 번째 의견을 남겨보세요!";
        listStatusEl.hidden = false;
        listEl.replaceChildren();
        moreWrap.hidden = true;
        return;
      }

      listStatusEl.textContent = loadError || "";
      listStatusEl.hidden = !loadError;

      var limit = Math.min(posts.length, visibleCount);
      var fragmentNodes = [];
      for (var i = 0; i < limit; i += 1) {
        fragmentNodes.push(renderPostItem(posts[i]));
      }
      listEl.replaceChildren.apply(listEl, fragmentNodes);

      var remaining = posts.length - limit;
      if (remaining > 0) {
        moreWrap.hidden = false;
        moreBtn.textContent = "더 보기 (" + String(remaining) + "건 남음)";
      } else {
        moreWrap.hidden = true;
      }
    }

    async function refresh() {
      if (destroyed) {
        return;
      }
      if (!firebaseApi || typeof firebaseApi.loadBoardPosts !== "function") {
        loadError = "게시판 연동 모듈을 찾을 수 없습니다.";
        renderPosts();
        return;
      }
      loading = true;
      loadError = "";
      refreshBtn.disabled = true;
      renderPosts();

      try {
        var loaded = await firebaseApi.loadBoardPosts();
        if (destroyed) {
          return;
        }
        posts = Array.isArray(loaded) ? loaded : [];
      } catch (_err) {
        if (destroyed) {
          return;
        }
        loadError = "게시판 글을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.";
      } finally {
        if (!destroyed) {
          loading = false;
          refreshBtn.disabled = false;
          renderPosts();
        }
      }
    }

    async function handleSubmit(event) {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      if (submitting || destroyed) {
        return;
      }
      if (!firebaseApi || typeof firebaseApi.createBoardPost !== "function") {
        setFormStatus("게시판 등록 기능을 사용할 수 없습니다.", true);
        return;
      }

      var rawAuthor = typeof authorInput.value === "string" ? authorInput.value.trim() : "";
      var rawContent = typeof contentInput.value === "string" ? contentInput.value.trim() : "";

      if (rawContent.length < CONTENT_MIN_LEN) {
        setFormStatus("내용을 " + String(CONTENT_MIN_LEN) + "자 이상 입력해 주세요.", true);
        return;
      }
      if (rawContent.length > CONTENT_MAX_LEN) {
        setFormStatus("내용은 " + String(CONTENT_MAX_LEN) + "자 이하로 입력해 주세요.", true);
        return;
      }

      var currentNow = nowFn();
      if (lastSubmitAt > 0 && currentNow - lastSubmitAt < cooldownMs) {
        var waitSec = Math.ceil((cooldownMs - (currentNow - lastSubmitAt)) / 1000);
        setFormStatus("잠시 후 다시 등록해 주세요. (" + String(waitSec) + "초 대기)", true);
        return;
      }

      submitting = true;
      submitBtn.disabled = true;
      setFormStatus("등록 중입니다...", false);

      try {
        var created = await firebaseApi.createBoardPost({
          author: rawAuthor,
          content: rawContent,
          createdAt: currentNow
        });
        if (destroyed) {
          return;
        }
        lastSubmitAt = nowFn();
        posts.unshift(created);
        if (visibleCount < pageSize) {
          visibleCount = pageSize;
        }
        contentInput.value = "";
        updateCharCount();
        confirmDeleteId = null;
        setFormStatus("소중한 의견이 등록되었습니다!", false);
        onNotify("의견이 게시판에 등록되었습니다.");
        renderPosts();
      } catch (err) {
        if (!destroyed) {
          setFormStatus((err && err.message) || "등록에 실패했습니다. 잠시 후 다시 시도해 주세요.", true);
        }
      } finally {
        if (!destroyed) {
          submitting = false;
          submitBtn.disabled = false;
        }
      }
    }

    async function handleDeleteClick(postId) {
      if (busyPostId || destroyed) {
        return;
      }
      if (!ensureFirebaseModeratorReady()) {
        return;
      }
      if (confirmDeleteId !== postId) {
        confirmDeleteId = postId;
        editingReplyId = null;
        onNotify("삭제를 진행하려면 '삭제 확인'을 한 번 더 눌러주세요.");
        renderPosts();
        return;
      }
      if (!firebaseApi || typeof firebaseApi.deleteBoardPost !== "function") {
        return;
      }
      busyPostId = postId;
      renderPosts();
      try {
        await firebaseApi.deleteBoardPost(postId);
        if (destroyed) {
          return;
        }
        posts = posts.filter(function (p) { return p.id !== postId; });
        confirmDeleteId = null;
        onNotify("게시글을 삭제했습니다.");
      } catch (err) {
        if (!destroyed) {
          confirmDeleteId = null;
          var errMsg = (err && err.message) || "게시글 삭제에 실패했습니다.";
          setFormStatus(errMsg, true);
          onNotify(errMsg);
        }
      } finally {
        if (!destroyed) {
          busyPostId = null;
          renderPosts();
        }
      }
    }

    async function handleReplySave(postId, rawReply) {
      if (busyPostId || destroyed) {
        return;
      }
      if (!ensureFirebaseModeratorReady()) {
        return;
      }
      var cleanReply = typeof rawReply === "string" ? rawReply.trim() : "";
      if (!cleanReply) {
        setFormStatus("답변 내용을 입력해 주세요.", true);
        return;
      }
      if (!firebaseApi || typeof firebaseApi.replyBoardPost !== "function") {
        return;
      }
      busyPostId = postId;
      renderPosts();
      try {
        var result = await firebaseApi.replyBoardPost(postId, cleanReply);
        if (destroyed) {
          return;
        }
        for (var i = 0; i < posts.length; i += 1) {
          if (posts[i].id === postId) {
            posts[i] = Object.assign({}, posts[i], {
              reply: result.reply,
              replyAt: result.replyAt
            });
            break;
          }
        }
        editingReplyId = null;
        setFormStatus("", false);
        onNotify("답변이 저장되었습니다.");
      } catch (err) {
        if (!destroyed) {
          var errMsg = (err && err.message) || "답변 저장에 실패했습니다.";
          setFormStatus(errMsg, true);
          onNotify(errMsg);
        }
      } finally {
        if (!destroyed) {
          busyPostId = null;
          renderPosts();
        }
      }
    }

    formEl.addEventListener("submit", handleSubmit);
    contentInput.addEventListener("input", updateCharCount);
    refreshBtn.addEventListener("click", refresh);
    backdrop.addEventListener("click", function () {
      close();
    });
    closeBtn.addEventListener("click", function () {
      close();
    });
    moreBtn.addEventListener("click", function () {
      visibleCount += pageSize;
      renderPosts();
    });

    function isOpen() {
      return Boolean(modalEl && !modalEl.hidden);
    }

    function open() {
      if (destroyed) {
        return;
      }
      modalEl.hidden = false;
      modalEl.setAttribute("aria-hidden", "false");
      onOpenChange(true);
      refresh();
      if (typeof contentInput.focus === "function") {
        contentInput.focus();
      }
    }

    function close() {
      if (destroyed) {
        return;
      }
      confirmDeleteId = null;
      editingReplyId = null;
      modalEl.hidden = true;
      modalEl.setAttribute("aria-hidden", "true");
      onOpenChange(false);
    }

    function setAdminUnlocked(nextUnlocked) {
      adminUnlocked = Boolean(nextUnlocked);
      if (!adminUnlocked) {
        confirmDeleteId = null;
        editingReplyId = null;
      }
      if (isOpen()) {
        renderPosts();
      }
    }

    function destroy() {
      destroyed = true;
    }

    return {
      isOpen: isOpen,
      open: open,
      close: close,
      refresh: refresh,
      setAdminUnlocked: setAdminUnlocked,
      destroy: destroy
    };
  }

  global.PortfolioBoard = {
    DEFAULT_PAGE_SIZE: DEFAULT_PAGE_SIZE,
    DEFAULT_COOLDOWN_MS: DEFAULT_COOLDOWN_MS,
    formatPostTimestamp: formatPostTimestamp,
    createBoardController: createBoardController
  };
})(typeof window !== "undefined" ? window : globalThis);
