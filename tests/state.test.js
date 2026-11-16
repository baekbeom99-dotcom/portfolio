const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadStateModule() {
  const code = fs.readFileSync(path.resolve(__dirname, "..", "js", "state.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.PortfolioState;
}

const SAMPLE_APPS = [
  {
    id: "app-one",
    title: "습관 트래커",
    tagline: "매일 루틴 기록",
    purpose: "꾸준한 습관 형성을 돕기 위해 제작",
    audience: "직장인 및 학생",
    description: ["체크리스트 기능"],
    launchType: "external",
    url: "https://example.com/1",
    embedMode: "newTab",
    tags: ["생산성", "건강"],
    featured: false
  },
  {
    id: "app-two",
    title: "색상 팔레트 생성기",
    tagline: "웹 디자인 배색 추천",
    purpose: "디자이너의 배색 고민 단축",
    audience: "프론트엔드 개발자",
    description: ["HEX 복사 기능"],
    launchType: "embedded",
    url: "./apps/app-two/index.html",
    embedMode: "iframe",
    tags: ["디자인", "생산성"],
    featured: true
  }
];

test("filters apps by searchQuery across title, purpose, audience, and tags", () => {
  const { createStore } = loadStateModule();
  const store = createStore(SAMPLE_APPS);

  assert.ok(Array.isArray(store.getFilteredApps()));
  assert.deepEqual(Array.from(store.getFilteredApps(), (a) => a.id), ["app-two", "app-one"]);

  store.setSearchQuery("습관");
  assert.deepEqual(Array.from(store.getFilteredApps(), (a) => a.id), ["app-one"]);

  store.setSearchQuery("프론트엔드");
  assert.deepEqual(Array.from(store.getFilteredApps(), (a) => a.id), ["app-two"]);

  store.setSearchQuery("건강");
  assert.deepEqual(Array.from(store.getFilteredApps(), (a) => a.id), ["app-one"]);

  store.setSearchQuery("배색 추천");
  assert.deepEqual(Array.from(store.getFilteredApps(), (a) => a.id), ["app-two"]);

  store.resetFilters();
  assert.equal(store.getFilteredApps().length, 2);
});

test("filters apps by activeTag and launchFilter", () => {
  const { createStore } = loadStateModule();
  const store = createStore(SAMPLE_APPS);

  assert.ok(Array.isArray(store.getAllTags()));
  assert.deepEqual(Array.from(store.getAllTags()), ["건강", "디자인", "생산성"]);

  store.setActiveTag("생산성");
  assert.equal(store.getFilteredApps().length, 2);

  store.setLaunchFilter("embedded");
  assert.deepEqual(Array.from(store.getFilteredApps(), (a) => a.id), ["app-two"]);

  store.setLaunchFilter("invalid-filter");
  assert.equal(store.getState().launchFilter, "embedded");
});

test("manages detail modal, viewer overlay, and #app=<id> deep links", () => {
  const { createStore } = loadStateModule();
  const store = createStore(SAMPLE_APPS);

  let notifications = 0;
  const unsub = store.subscribe(() => { notifications += 1; });

  store.syncFromHash("#app=app-one");
  assert.equal(store.getState().selectedAppId, "app-one");
  assert.equal(store.getSelectedApp().title, "습관 트래커");

  store.openViewer("app-two");
  assert.equal(store.getState().selectedAppId, "app-two");
  assert.equal(store.getState().viewerOpen, true);

  store.openDetail("app-one");
  assert.equal(store.getState().selectedAppId, "app-one");
  assert.equal(store.getState().viewerOpen, false);

  store.openViewer("app-two");
  store.setPreviewDevice("mobile");
  assert.equal(store.getState().previewDevice, "mobile");

  store.setPreviewDevice("tablet");
  assert.equal(store.getState().previewDevice, "mobile");

  store.closeViewer();
  assert.equal(store.getState().viewerOpen, false);
  assert.equal(store.getState().selectedAppId, "app-two");

  store.closeDetail();
  assert.equal(store.getState().selectedAppId, null);

  store.syncFromHash("#app=unknown-id");
  assert.equal(store.getState().selectedAppId, null);

  store.syncFromHash("#app=%E0%A4%A");
  assert.equal(store.getState().selectedAppId, null);

  const shareUrl = store.buildShareUrl("https://me.github.io/portfolio/#old", "app-two");
  assert.equal(shareUrl, "https://me.github.io/portfolio/#app=app-two");

  const encodedShareUrl = store.buildShareUrl("https://me.github.io/portfolio/", "my app/1");
  assert.equal(encodedShareUrl, "https://me.github.io/portfolio/#app=my%20app%2F1");

  assert.ok(notifications >= 6);
  const beforeUnsub = notifications;
  unsub();
  store.setSearchQuery("test");
  assert.equal(notifications, beforeUnsub);
});

test("handles non-array input, case-insensitive search, and featured tie-breaking", () => {
  const { createStore } = loadStateModule();
  const emptyStore = createStore(null);
  assert.ok(Array.isArray(emptyStore.getFilteredApps()));
  assert.deepEqual(Array.from(emptyStore.getFilteredApps()), []);
  assert.ok(Array.isArray(emptyStore.getAllTags()));
  assert.deepEqual(Array.from(emptyStore.getAllTags()), []);
  assert.equal(emptyStore.getSelectedApp(), null);

  const mixedApps = [
    { id: "first", title: "Alpha", tagline: "", purpose: "", audience: "", launchType: "external", tags: ["UI"], featured: false },
    { id: "second", title: "Beta", tagline: "", purpose: "", audience: "", launchType: "embedded", tags: ["Tool"], featured: true },
    { id: "third", title: "Gamma", tagline: "", purpose: "", audience: "", launchType: "external", tags: ["ui"], featured: true },
    { id: "fourth", title: "Delta", tagline: "", purpose: "", audience: "", launchType: "embedded", tags: [], featured: false }
  ];
  const store = createStore(mixedApps);
  assert.deepEqual(Array.from(store.getFilteredApps(), (a) => a.id), ["second", "third", "first", "fourth"]);

  store.setSearchQuery("ALPHA");
  assert.deepEqual(Array.from(store.getFilteredApps(), (a) => a.id), ["first"]);
});

test("setApps updates catalog, clears stale filters/selection, and notifies subscribers", () => {
  const { createStore } = loadStateModule();
  const store = createStore(SAMPLE_APPS);

  let notifications = 0;
  store.subscribe(() => { notifications += 1; });

  store.setActiveTag("디자인");
  store.setLaunchFilter("embedded");
  store.openDetail("app-two");
  const beforeSet = notifications;

  store.setApps([SAMPLE_APPS[0]]);
  assert.equal(notifications, beforeSet + 1);
  assert.equal(store.getState().apps.length, 1);
  assert.equal(store.getState().activeTag, "all", "Stale activeTag must reset when no longer present");
  assert.equal(store.getState().launchFilter, "all", "Stale launchFilter must reset when no apps match");
  assert.equal(store.getState().selectedAppId, null, "Stale selectedAppId must clear when app is removed");
  assert.equal(store.getState().viewerOpen, false);
  assert.deepEqual(Array.from(store.getAllTags()), ["건강", "생산성"]);
  assert.deepEqual(Array.from(store.getFilteredApps(), (a) => a.id), ["app-one"]);

  // Even when launchFilter matches the only remaining launchType, reset to "all" when <2 distinct launch types exist
  const mixedStore = createStore(SAMPLE_APPS);
  mixedStore.setLaunchFilter("external");
  assert.equal(mixedStore.getState().launchFilter, "external");
  mixedStore.setApps([SAMPLE_APPS[0]]); // external only -> launch filter UI hidden
  assert.equal(mixedStore.getState().launchFilter, "all", "launchFilter must reset when fewer than 2 launch types exist");
});
