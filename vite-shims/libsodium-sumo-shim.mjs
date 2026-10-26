// ADR-0009 crypto-bridge fix, ported to Vite/Rollup (core's own webpack.config.d/ shim only
// applies to core's OWN build - webclient uses Vite, a different bundler, so this needs its own
// copy): multiplatform-crypto-libsodium-bindings' generated bridge statically ESM-imports named
// exports (crypto_generichash, _sodium_init, ready, ...) from a package literally named
// 'libsodium-sumo', but that package's real ESM build only has `export default Module` (an
// Emscripten module object whose raw _-prefixed C exports are attached asynchronously, after
// Module.ready resolves) - no static named exports exist at all. Aliased onto this file (see
// vite.config.ts) in place of the real package.
// A direct relative file path, not a package deep-import (libsodium-sumo's own package.json
// "exports" map only exposes "." - a bare-specifier deep import of this subpath is rejected by
// Node/Vite's exports resolution; this bypasses that entirely since it's not a package import at
// all. Also avoids re-triggering this file's own Vite alias (which matches the bare "libsodium-
// sumo" specifier exactly).
import RealModule from "../node_modules/libsodium-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs";

// No top-level await: avoids any risk of a synchronous CJS require('libsodium-sumo') elsewhere
// in the dependency graph being unable to consume an async ES module (same reasoning as core's
// own webpack shim). RealModule's _-prefixed properties are populated asynchronously after WASM
// instantiation, but RealModule itself (the object reference) is available synchronously at
// import time - these forwarding functions just read the property at CALL time.
export const ready = RealModule.ready;
export function crypto_generichash(...args) { return RealModule._crypto_generichash(...args); }
export function crypto_hash_sha256(...args) { return RealModule._crypto_hash_sha256(...args); }
export function crypto_hash_sha512(...args) { return RealModule._crypto_hash_sha512(...args); }
export function crypto_hash_sha256_init(...args) { return RealModule._crypto_hash_sha256_init(...args); }
export function _sodium_init(...args) { return RealModule._sodium_init(...args); }
export default RealModule;
