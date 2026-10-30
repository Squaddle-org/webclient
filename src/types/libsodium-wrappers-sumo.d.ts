/** No official types ship with this package (confirmed - `@types/libsodium-wrappers-sumo` is a
 * deprecated stub claiming otherwise). Only the one thing `main.ts` actually needs: the `ready`
 * promise that resolves once the package's own WASM init has really finished - see `main.ts`'s
 * own doc comment on why this matters (a real, pre-existing race in core's Kotlin/JS crypto
 * bridge, not fixed at its source here). */
declare module "libsodium-wrappers-sumo" {
  const sodium: { ready: Promise<void> };
  export default sodium;
}
