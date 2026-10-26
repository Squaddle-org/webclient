import { describe, expect, it } from "vitest";
import { inviteLinkToString, parseInviteLink } from "./invite-link";

describe("parseInviteLink / inviteLinkToString", () => {
  const roomId = new Int8Array(32).map((_, i) => i);
  const inviteId = new Int8Array(16).map((_, i) => i + 1);
  const inviteSecret = new Int8Array(32).map((_, i) => i + 2);

  it("round-trips an open invite link", () => {
    const link = { relayHost: "relay.squaddle.org", roomId, inviteId, inviteSecret };
    const url = inviteLinkToString(link);
    const parsed = parseInviteLink(url);

    expect(parsed).not.toBeNull();
    expect(parsed!.relayHost).toBe("relay.squaddle.org");
    expect(parsed!.roomId).toEqual(roomId);
    expect(parsed!.inviteId).toEqual(inviteId);
    expect(parsed!.inviteSecret).toEqual(inviteSecret);
  });

  it("round-trips an approval-required invite link (no secret)", () => {
    const link = { relayHost: "relay.squaddle.org", roomId, inviteId, inviteSecret: null };
    const url = inviteLinkToString(link);
    const parsed = parseInviteLink(url);

    expect(parsed).not.toBeNull();
    expect(parsed!.inviteSecret).toBeNull();
  });

  it("rejects garbage text", () => {
    expect(parseInviteLink("not a link")).toBeNull();
    expect(parseInviteLink("https://squaddle.org/j/only/three")).toBeNull();
    expect(parseInviteLink("https://squaddle.org/j/relay/!!!invalid!!!/alsoinvalid")).toBeNull();
  });
});
