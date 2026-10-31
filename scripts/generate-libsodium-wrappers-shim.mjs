#!/usr/bin/env node
// Regenerates vite-shims/libsodium-wrappers-sumo-shim.mjs's "export const <name> = ..." lines
// from whatever libsodium-wrappers-sumo is actually installed - run this again after bumping
// that dependency's version, so the shim's property list matches what the new version exports
// (see the shim file's own doc comment for why this flattening exists at all).
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sodiumWrappers from "../node_modules/libsodium-wrappers-sumo/dist/modules-sumo-esm/libsodium-wrappers.mjs";

await sodiumWrappers.ready;

const names = Object.keys(sodiumWrappers)
  .filter((name) => name !== "default" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
  .sort();

const header = `// ADR-0009 crypto-bridge fix (see libsodium-sumo-shim.mjs for the original pattern this
// follows): multiplatform-crypto-libsodium-bindings's generated bridge does
// "import * as JsSodiumInterface from 'libsodium-wrappers-sumo'" and then reads named
// properties directly off that namespace object (e.g. JsSodiumInterface.randombytes_buf).
// Under 0.7.x this worked by accident, via Vite/Rollup's CJS-interop synthesizing flattened
// named exports from that build's CommonJS module.exports shape. 0.8.x ships a real ESM
// module (export default Module only, matching the npm package's own documented usage -
// "import sodium from 'libsodium-wrappers-sumo'; await sodium.ready;" - a *default* import,
// never a namespace one) - nothing gets flattened onto the namespace anymore, so every one of
// those property reads returns undefined (confirmed directly: "h.randombytes_buf is not a
// function" reproduced from a live failed identity-creation attempt, not just the module-load
// self-test). This shim restores the same flattened shape the bridge still expects: await the
// real module once, then re-export every one of its own properties as a named export, so
// "import * as X" sees exactly the same names/values a *default* import's X.foo access would.
// The property list below is generated (not hand-maintained) - see
// scripts/generate-libsodium-wrappers-shim.mjs, run again after any libsodium-wrappers-sumo
// version bump to pick up whatever functions that version actually exports.
//
// A direct relative file path, not a package deep-import, for the same reason
// libsodium-sumo-shim.mjs uses one: avoids re-triggering this file's own Vite alias (which
// matches the bare "libsodium-wrappers-sumo" specifier exactly), and a deep import of this
// subpath isn't exposed by the package's own "exports" map anyway.
import sodiumWrappers from "../node_modules/libsodium-wrappers-sumo/dist/modules-sumo-esm/libsodium-wrappers.mjs";

// Every property below is only actually populated after this resolves - awaiting here, before
// any of the "export const" lines run, is what makes capturing them as plain values (not
// forwarding functions, unlike libsodium-sumo-shim.mjs's handful of cases) safe: by the time
// any importer's own module body starts running, this module has already finished evaluating.
await sodiumWrappers.ready;
`;

const body = names.map((name) => `export const ${name} = sodiumWrappers.${name};`).join("\n");
const footer = "\nexport default sodiumWrappers;\n";

const outPath = fileURLToPath(new URL("../vite-shims/libsodium-wrappers-sumo-shim.mjs", import.meta.url));
await writeFile(outPath, `${header}\n${body}\n${footer}`);
console.log(`Wrote ${names.length} property exports to ${outPath}`);
