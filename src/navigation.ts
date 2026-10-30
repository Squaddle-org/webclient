import type { Route } from "./router";

/** Passed into every screen module as a plain parameter (not imported from `app.ts` directly) so
 * screens stay free of any import cycle back into the module that dispatches to them. */
export type Navigate = (route: Route) => void;

export function linkClick(fn: () => void): (ev: Event) => void {
  return (ev: Event) => {
    ev.preventDefault();
    fn();
  };
}
