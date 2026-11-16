const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

test("GitHub Pages config files (.nojekyll and deploy.yml) exist", () => {
  assert.equal(fs.existsSync(path.join(ROOT, ".nojekyll")), true);
  const workflowPath = path.join(ROOT, ".github", "workflows", "deploy.yml");
  assert.equal(fs.existsSync(workflowPath), true);
  const workflow = fs.readFileSync(workflowPath, "utf8");
  assert.match(workflow, /actions\/deploy-pages/);
  assert.match(workflow, /actions\/upload-pages-artifact/);
});

function validateAppEntries(apps) {
  const ids = new Set();
  for (const app of apps) {
    assert.match(app.id, /^[a-z0-9-]+$/);
    assert.equal(ids.has(app.id), false, `Duplicate app id: ${app.id}`);
    ids.add(app.id);

    for (const field of ["title", "tagline", "purpose", "audience", "url"]) {
      assert.equal(typeof app[field], "string", `${app.id}.${field} must be a string`);
      assert.ok(app[field].trim().length > 0, `${app.id}.${field} must be non-empty`);
    }

    assert.ok(
      typeof app.description === "string" || Array.isArray(app.description),
      `${app.id}.description must be string or string[]`
    );
    assert.ok(["external", "embedded"].includes(app.launchType));
    assert.ok(["iframe", "newTab"].includes(app.embedMode));

    if (app.thumbnailFit !== undefined) {
      assert.ok(
        ["auto", "cover", "contain"].includes(app.thumbnailFit),
        `${app.id}.thumbnailFit must be auto, cover, or contain`
      );
    }

    if (app.launchType === "embedded") {
      assert.ok(app.url.startsWith("./apps/"), "Embedded app url must be relative ./apps/...");
      const targetFile = path.resolve(ROOT, app.url);
      assert.equal(fs.existsSync(targetFile), true, `Missing embedded file: ${app.url}`);
    }

    if (app.thumbnail && app.thumbnail.startsWith("./")) {
      const thumbFile = path.resolve(ROOT, app.thumbnail);
      assert.equal(fs.existsSync(thumbFile), true, `Missing thumbnail file: ${app.thumbnail}`);
    }
  }
}

test("data/apps.js defines valid PORTFOLIO_CONFIG and PORTFOLIO_APPS", () => {
  const dataPath = path.join(ROOT, "data", "apps.js");
  assert.equal(fs.existsSync(dataPath), true);

  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(dataPath, "utf8"), sandbox);

  const config = sandbox.window.PORTFOLIO_CONFIG;
  const apps = sandbox.window.PORTFOLIO_APPS;

  assert.equal(config.siteTitle, "윤선생 App Studio");
  assert.equal(config.siteSubtitle, "교육용 및 일상생활을 위한 웹앱 공유 플랫폼");
  assert.equal(config.ownerName, "윤선생");
  assert.equal(typeof config.contactLink, "string");

  assert.ok(Array.isArray(apps));
  assert.equal(apps.length, 0);

  if (apps.length > 0) {
    validateAppEntries(apps);
  }
});

test("validateAppEntries validates optional thumbnailFit values when entries exist", () => {
  for (const fit of ["auto", "cover", "contain"]) {
    validateAppEntries([
      {
        id: `sample-${fit}`,
        title: "샘플 앱",
        tagline: "설명",
        purpose: "목적",
        audience: "대상",
        description: ["사용법"],
        launchType: "external",
        url: "https://example.com",
        embedMode: "newTab",
        thumbnailFit: fit
      }
    ]);
  }
});
