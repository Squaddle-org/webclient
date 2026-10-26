import { StorageApi } from "core";
// `?url` - Vite's asset-import convention: resolves to a build-stable URL for the file itself
// (copied into the build output), rather than trying to parse/bundle `.wasm` as JS.
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { render } from "./app";

async function bootstrap(): Promise<void> {
  await StorageApi.getInstance().preloadSqlJsDriver((file) => (file.endsWith(".wasm") ? sqlWasmUrl : file));

  window.addEventListener("popstate", () => render());
  document.body.addEventListener("click", (ev) => {
    const anchor = (ev.target as HTMLElement).closest("a");
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    const href = anchor.getAttribute("href");
    if (!href || !href.startsWith("/")) return; // external links navigate normally
    ev.preventDefault();
    history.pushState(null, "", href);
    render();
  });

  await render();
}

void bootstrap();
