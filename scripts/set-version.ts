#!/usr/bin/env bun
// Sets package.json's version — what semantic-release calls on a release, in
// place of @semantic-release/npm (which shells out to npm).
//
//   bun scripts/set-version.ts <semver>

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('usage: bun scripts/set-version.ts <semver>');
  process.exit(1);
}
const file = Bun.file(new URL('../package.json', import.meta.url));
const pkg = await file.json();
pkg.version = version;
await Bun.write(file, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`package.json → ${version}`);
