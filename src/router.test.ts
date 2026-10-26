import { describe, expect, it } from "vitest";
import { parseRoute, routeToPath } from "./router";

describe("parseRoute", () => {
  it("defaults to onboarding at the root", () => {
    expect(parseRoute("/", "https://app.squaddle.org/")).toEqual({ kind: "onboarding" });
    expect(parseRoute("", "https://app.squaddle.org/")).toEqual({ kind: "onboarding" });
  });

  it("parses rooms, room, and idea routes", () => {
    expect(parseRoute("/rooms", "https://app.squaddle.org/rooms")).toEqual({ kind: "rooms" });
    expect(parseRoute("/rooms/ABC123", "https://app.squaddle.org/rooms/ABC123")).toEqual({ kind: "room", roomIdB32: "ABC123" });
    expect(parseRoute("/rooms/ABC123/ideas/XYZ789", "https://app.squaddle.org/rooms/ABC123/ideas/XYZ789")).toEqual({
      kind: "idea",
      roomIdB32: "ABC123",
      ideaIdB32: "XYZ789",
    });
  });

  it("treats a /j/ path as a join route carrying the full href (fragment included)", () => {
    const href = "https://app.squaddle.org/j/relay.squaddle.org/ROOMID/INVITEID#c2VjcmV0";
    expect(parseRoute("/j/relay.squaddle.org/ROOMID/INVITEID", href)).toEqual({ kind: "join", url: href });
  });

  it("falls back to rooms for anything unparseable", () => {
    expect(parseRoute("/not/a/real/route/at/all", "https://app.squaddle.org/not/a/real/route/at/all")).toEqual({ kind: "rooms" });
  });
});

describe("routeToPath", () => {
  it("round-trips room and idea routes", () => {
    expect(routeToPath({ kind: "room", roomIdB32: "ABC123" })).toBe("/rooms/ABC123");
    expect(routeToPath({ kind: "idea", roomIdB32: "ABC123", ideaIdB32: "XYZ789" })).toBe("/rooms/ABC123/ideas/XYZ789");
    expect(routeToPath({ kind: "rooms" })).toBe("/rooms");
    expect(routeToPath({ kind: "onboarding" })).toBe("/onboarding");
  });
});
