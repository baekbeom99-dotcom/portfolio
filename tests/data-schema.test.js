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

test("data/apps.js defines valid PORTFOLIO_CONFIG and PORTFOLIO_APPS", () => {
  const dataPath = path.join(ROOT, "data", "apps.js");
  assert.equal(fs.existsSync(dataPath), true);

  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(dataPath, "utf8"), sandbox);

  const config = sandbox.window.PORTFOLIO_CONFIG;
  const apps = sandbox.window.PORTFOLIO_APPS;

  assert.equal(typeof config.siteTitle, "string");
  assert.ok(config.siteTitle.length > 0);
  assert.equal(typeof config.siteSubtitle, "string");
  assert.equal(typeof config.ownerName, "string");

  assert.ok(Array.isArray(apps));
  assert.ok(apps.length >= 2, "Expected at least 2 sample entries (external + embedded)");

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

  assert.ok(apps.some((a) => a.launchType === "embedded"));
  assert.ok(apps.some((a) => a.launchType === "external"));
});
