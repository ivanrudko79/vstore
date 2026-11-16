import fs from 'node:fs';
const apps = JSON.parse(fs.readFileSync(new URL('../data/apps.json', import.meta.url), 'utf8'));
const categories = JSON.parse(fs.readFileSync(new URL('../data/categories.json', import.meta.url), 'utf8'));
const fail = message => { console.error(`Catalog validation failed: ${message}`); process.exitCode = 1; };
const categoryIds = new Set();
for (const category of categories) {
  if (!category.id || !category.name || categoryIds.has(category.id)) fail(`invalid or duplicate category: ${category.id}`);
  categoryIds.add(category.id);
}
const ids = new Set(), bundles = new Set();
for (const app of apps) {
  for (const key of ['id','name','developer','bundleId','version','category','description','icon','source','addedDate','updatedDate','status']) if (!app[key]) fail(`${app.id || '(unknown)'} is missing ${key}`);
  if (ids.has(app.id)) fail(`duplicate app id: ${app.id}`); ids.add(app.id);
  if (bundles.has(app.bundleId)) fail(`duplicate bundle id: ${app.bundleId}`); bundles.add(app.bundleId);
  if (!categoryIds.has(app.category)) fail(`${app.id} references unknown category ${app.category}`);
  if (app.status === 'demo' && (app.downloadUrl || app.sha256 || app.distributionPermission)) fail(`${app.id} marks demo content as distributable`);
  if (app.status === 'published' && (!app.downloadUrl || !app.sha256 || !app.source || !app.distributionPermission)) fail(`${app.id} published without URL, SHA-256, source, or distribution permission`);
  if (app.sha256 && !/^[a-f0-9]{64}$/i.test(app.sha256)) fail(`${app.id} has an invalid SHA-256`);
}
if (!process.exitCode) console.log(`Catalog valid: ${apps.length} apps, ${categories.length} categories.`);
