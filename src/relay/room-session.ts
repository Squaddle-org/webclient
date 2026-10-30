import { SessionApi, type RelaySession, type IdeaJs, type CommentJs, type MemberJs, type EventJs, type RoomLimitsJs, type EntitlementResultJs, type LiveUpdatesHandle } from "core";
import type { IdentityRecord } from "../identity/identity-record";
import { KnownRoomsStore, type KnownRoom } from "../rooms/known-rooms-store";
import { inviteLinkToString, parseInviteLink, type InviteLink } from "../invite/invite-link";

export interface Idea {
  id: Int8Array;
  createdBy: Int8Array;
  title: string;
  desc: string | null;
  tags: string[];
  score: number;
  myVote: number | null;
}

export interface Comment {
  id: Int8Array;
  ideaId: Int8Array;
  author: Int8Array;
  text: string;
}

/** [role] is `"owner" | "admin" | "member" | "pending"` - see {@link MemberJs}'s own doc comment. */
export interface Member {
  userKey: Int8Array;
  role: string;
}

/** Wraps core's {@link LiveUpdatesHandle} purely so callers depend on this module's own type,
 * not `core`'s directly, same reasoning as every other `toX` conversion here. */
export interface LiveUpdatesSubscription {
  close(): void;
}

/** [start]/[end] are Unix seconds (see {@link EventJs}'s own doc comment - NOT milliseconds). */
export interface Event {
  id: Int8Array;
  ideaId: Int8Array | null;
  createdBy: Int8Array;
  title: string;
  start: number;
  end: number | null;
  tz: string;
  location: string | null;
  allDay: boolean;
  canCancel: boolean;
  myRsvp: string | null;
  yesCount: number;
  noCount: number;
  maybeCount: number;
}

export interface RoomLimits {
  tier: string;
  maxMembers: number | null;
  maxPending: number | null;
  opRetentionDays: number | null;
  attachmentBytes: number | null;
  maxActiveInvites: number | null;
  boostedUntil: number | null;
}

function toIdea(js: IdeaJs): Idea {
  return { id: js.id, createdBy: js.createdBy, title: js.title, desc: js.desc ?? null, tags: js.tags, score: js.score, myVote: js.myVote ?? null };
}

function toComment(js: CommentJs): Comment {
  return { id: js.id, ideaId: js.ideaId, author: js.author, text: js.text };
}

function toMember(js: MemberJs): Member {
  return { userKey: js.userKey, role: js.role };
}

function toEvent(js: EventJs): Event {
  return {
    id: js.id, ideaId: js.ideaId ?? null, createdBy: js.createdBy, title: js.title,
    start: js.start, end: js.end ?? null, tz: js.tz, location: js.location ?? null, allDay: js.allDay,
    canCancel: js.canCancel, myRsvp: js.myRsvp ?? null, yesCount: js.yesCount, noCount: js.noCount, maybeCount: js.maybeCount,
  };
}

function toLimits(js: RoomLimitsJs): RoomLimits | null {
  if (!js.ok || !js.tier) return null;
  return {
    tier: js.tier, maxMembers: js.maxMembers ?? null, maxPending: js.maxPending ?? null,
    opRetentionDays: js.opRetentionDays ?? null, attachmentBytes: js.attachmentBytes ?? null,
    maxActiveInvites: js.maxActiveInvites ?? null, boostedUntil: js.boostedUntil ?? null,
  };
}

function toInt8Array(bytes: Uint8Array): Int8Array {
  // Same bits, read as signed instead of unsigned - a view reinterpretation, not a copy. The
  // inverse of identity-store.ts's `toUint8Array` - `RelaySession`'s methods are `Int8Array`-typed
  // (how Kotlin's `ByteArray` crosses `@JsExport`), but `IdentityRecord` stores `Uint8Array`.
  return new Int8Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
}

export const DEFAULT_RELAY_HOST = "relay.squaddle.org";

/**
 * Opens a {@link RelaySession} for the given identity against [relayHost], and ties it to the
 * local {@link KnownRoomsStore} - the glue `main.ts`/screens actually call. Mirrors android's
 * `AppSession`+`RealSyncGateway` split loosely: `RelaySession` itself is the protocol-talking
 * half (lives entirely in core's js target per webclient's CLAUDE.md), this class is the thin
 * local-bookkeeping half.
 */
export class RoomSessionOrchestrator {
  private readonly knownRooms = new KnownRoomsStore();

  private constructor(
    private readonly session: RelaySession,
    public readonly relayHost: string,
  ) {}

  static async open(
    identity: IdentityRecord,
    relayHost: string = DEFAULT_RELAY_HOST,
    tls = true,
  ): Promise<RoomSessionOrchestrator> {
    const session = await SessionApi.getInstance().open(
      toInt8Array(identity.entropy),
      toInt8Array(identity.devicePublicKey),
      toInt8Array(identity.deviceSecretKey),
      toInt8Array(identity.deviceCertUser),
      toInt8Array(identity.deviceCertUserBox),
      identity.deviceCertLabel,
      identity.deviceCertIssuedAt,
      toInt8Array(identity.deviceCertSig),
      relayHost,
      tls,
    );
    return new RoomSessionOrchestrator(session, relayHost);
  }

  async registerDevice(): Promise<boolean> {
    const result = await this.session.registerDevice();
    return result.kind === "ok";
  }

  /** Creates the room, then records it locally under [displayName] - a purely local name (not a
   * protocol concept, PROTOCOL.md §4's genesis entry carries no name field). */
  async createRoom(displayName: string): Promise<Int8Array | null> {
    const result = await this.session.createRoom();
    if (!result.ok || !result.roomId) return null;
    const now = Date.now();
    await this.knownRooms.upsert({ roomId: result.roomId, displayName, relayHost: this.relayHost, joinedAt: now, lastActivityAt: now });
    return result.roomId;
  }

  /** [roomId] must already be in the known-rooms store (i.e. this device created or joined it) -
   * its locally-recorded display name is sealed into the invite envelope so a joiner can preview
   * it before committing (see {@link RelaySession.peekInviteRoomName}). */
  async createInvite(
    roomId: Int8Array,
    requiresApproval: boolean,
    expiresAt: number | null,
    maxUses: number | null,
  ): Promise<{ link: InviteLink; url: string } | null> {
    const known = (await this.knownRooms.all()).find((r) => bytesEqual(r.roomId, roomId));
    const result = await this.session.createInvite(roomId, requiresApproval, expiresAt, maxUses, known?.displayName ?? null);
    if (!result.ok || !result.inviteId) return null;
    const link: InviteLink = { relayHost: this.relayHost, roomId, inviteId: result.inviteId, inviteSecret: result.inviteSecret ?? null };
    return { link, url: inviteLinkToString(link) };
  }

  /** `null` if [url] doesn't parse as an invite link. On success, joins (or, for an
   * approval-required invite, sends a pending join request) and records the room locally. */
  async joinViaUrl(url: string): Promise<{ roomId: Int8Array } | null> {
    const link = parseInviteLink(url);
    if (!link) return null;
    return this.joinViaLink(link);
  }

  /** `null` if the join request itself failed to send - **not** `null` for an approval-required
   * invite that sent successfully (that's a normal, expected outcome: the room appears locally
   * with this device showing as `"pending"` in {@link listMembers} until an owner/admin calls
   * {@link approve}). The display name is whatever the inviter sealed into the envelope ({@link
   * RelaySession.peekInviteRoomName}) for an open invite, or a generic placeholder for an
   * approval-required one (no envelope exists for those at all, §3.5) - same fallback android's
   * `RealSyncGateway.joinViaLink` uses either way. */
  async joinViaLink(link: InviteLink): Promise<{ roomId: Int8Array } | null> {
    const result = link.inviteSecret
      ? await this.session.joinViaLink(link.roomId, link.inviteId, link.inviteSecret)
      : await this.session.joinPendingApproval(link.roomId, link.inviteId);
    if (result.kind !== "ok") return null;

    const roomName = link.inviteSecret ? (await this.session.peekInviteRoomName(link.roomId, link.inviteId, link.inviteSecret)) ?? "Squaddle room" : "Squaddle room";
    const now = Date.now();
    await this.knownRooms.upsert({ roomId: link.roomId, displayName: roomName, relayHost: link.relayHost, joinedAt: now, lastActivityAt: now });
    return { roomId: link.roomId };
  }

  /** Read-only preview before committing to join - `null` for an approval-required invite (no
   * envelope exists to preview, §3.5) or if the peek itself fails. */
  async peekInviteRoomName(link: InviteLink): Promise<string | null> {
    if (!link.inviteSecret) return null;
    return (await this.session.peekInviteRoomName(link.roomId, link.inviteId, link.inviteSecret)) ?? null;
  }

  /** Pulls every known room (log+ops) and returns the refreshed local registry, sorted
   * most-recently-active first - the Rooms list screen's main data source, mirroring android's
   * `RoomsListViewModel.refresh`. */
  async refreshKnownRooms(): Promise<KnownRoom[]> {
    const known = await this.knownRooms.all();
    for (const room of known) {
      const result = await this.session.pull(room.roomId);
      if (result.ok) await this.knownRooms.touchActivity(room.roomId, Date.now());
    }
    return this.knownRooms.all();
  }

  async listKnownRooms(): Promise<KnownRoom[]> {
    return this.knownRooms.all();
  }

  /** Pulls [roomId] fresh, then returns its ideas sorted by score descending (highest first) -
   * the Room screen's main list, matching {@link RelaySession.listIdeas}'s own ordering. */
  async listIdeas(roomId: Int8Array): Promise<Idea[]> {
    await this.session.pull(roomId);
    const ideas = await this.session.listIdeas(roomId);
    return ideas.map(toIdea);
  }

  async createIdea(roomId: Int8Array, title: string, desc: string | null): Promise<boolean> {
    return this.session.createIdea(roomId, title, desc);
  }

  /** [value] is the caller's own vote - whatever scale the room's UI uses (e.g. -1/0/1); core
   * just sums whatever values it's given (PROTOCOL.md §4.2), it doesn't constrain the range. */
  async vote(roomId: Int8Array, ideaId: Int8Array, value: number): Promise<boolean> {
    return this.session.vote(roomId, ideaId, value);
  }

  /** Pulls [roomId] fresh first - an idea detail screen's comments should reflect what everyone
   * else has just posted, same reasoning as {@link listIdeas}. */
  async listComments(roomId: Int8Array, ideaId: Int8Array): Promise<Comment[]> {
    await this.session.pull(roomId);
    const comments = await this.session.listComments(roomId, ideaId);
    return comments.map(toComment);
  }

  async addComment(roomId: Int8Array, ideaId: Int8Array, text: string): Promise<boolean> {
    return this.session.addComment(roomId, ideaId, text);
  }

  /** Pulls [roomId] fresh first, same reasoning as {@link listIdeas}. Read-only - no invite/kick/
   * role-change actions in M5a's members screen. */
  async listMembers(roomId: Int8Array): Promise<Member[]> {
    await this.session.pull(roomId);
    const members = await this.session.listMembers(roomId);
    return members.map(toMember);
  }

  async editIdea(roomId: Int8Array, id: Int8Array, field: string, value: string | null): Promise<boolean> {
    return this.session.editIdea(roomId, id, field, value);
  }

  async deleteIdea(roomId: Int8Array, id: Int8Array): Promise<boolean> {
    return this.session.deleteIdea(roomId, id);
  }

  async deleteComment(roomId: Int8Array, id: Int8Array): Promise<boolean> {
    return this.session.deleteComment(roomId, id);
  }

  /** `"owner" | "admin" | "member" | "pending"`, or `null` if somehow not a member at all. */
  async myRole(roomId: Int8Array): Promise<string | null> {
    return (await this.session.myRole(roomId)) ?? null;
  }

  async canCreateEvent(roomId: Int8Array): Promise<boolean> {
    return this.session.canCreateEvent(roomId);
  }

  /** Pulls [roomId] fresh first, same reasoning as {@link listIdeas}. */
  async listEvents(roomId: Int8Array): Promise<Event[]> {
    await this.session.pull(roomId);
    const events = await this.session.listEvents(roomId);
    return events.map(toEvent);
  }

  async createEvent(
    roomId: Int8Array,
    ideaId: Int8Array | null,
    title: string,
    start: number,
    end: number | null,
    tz: string,
    location: string | null,
    allDay: boolean,
  ): Promise<boolean> {
    const result = await this.session.createEvent(roomId, ideaId, title, start, end, tz, location, allDay);
    return result.kind === "ok";
  }

  async cancelEvent(roomId: Int8Array, id: Int8Array): Promise<boolean> {
    const result = await this.session.cancelEvent(roomId, id);
    return result.kind === "ok";
  }

  /** [value] is `"yes"`, `"no"`, or `"maybe"` (PROTOCOL.md §4.3). */
  async rsvp(roomId: Int8Array, eventId: Int8Array, value: string): Promise<boolean> {
    const result = await this.session.rsvp(roomId, eventId, value);
    return result.kind === "ok";
  }

  async setProfile(roomId: Int8Array, displayName: string, emoji: string | null): Promise<boolean> {
    const result = await this.session.setProfile(roomId, displayName, emoji);
    return result.kind === "ok";
  }

  async kick(roomId: Int8Array, target: Int8Array): Promise<boolean> {
    return (await this.session.kick(roomId, target)).kind === "ok";
  }

  /** [role] is `"admin"` or `"member"` (promote/demote - PROTOCOL.md §3.3). */
  async setRole(roomId: Int8Array, target: Int8Array, role: string): Promise<boolean> {
    return (await this.session.setRole(roomId, target, role)).kind === "ok";
  }

  async transferOwner(roomId: Int8Array, target: Int8Array): Promise<boolean> {
    return (await this.session.transferOwner(roomId, target)).kind === "ok";
  }

  async approve(roomId: Int8Array, target: Int8Array): Promise<boolean> {
    return (await this.session.approve(roomId, target)).kind === "ok";
  }

  async reject(roomId: Int8Array, target: Int8Array): Promise<boolean> {
    return (await this.session.reject(roomId, target)).kind === "ok";
  }

  async getLimits(roomId: Int8Array): Promise<RoomLimits | null> {
    return toLimits(await this.session.getLimits(roomId));
  }

  /** On success, returns the room's new tier - `null` on failure (bad code, already used, etc.),
   * with [message] carrying the relay's own error text for display. */
  async redeemVoucher(roomId: Int8Array, code: string): Promise<{ tier: string | null; message: string | null }> {
    const result: EntitlementResultJs = await this.session.redeemVoucher(roomId, code);
    return result.ok ? { tier: result.tier ?? null, message: null } : { tier: null, message: result.message || result.code };
  }

  /** `null` if push isn't configured on this relay, or it's unreachable. */
  async vapidPublicKey(): Promise<string | null> {
    return (await this.session.vapidPublicKey()) ?? null;
  }

  async registerPushEndpoint(endpoint: string): Promise<boolean> {
    return (await this.session.registerPushEndpoint(endpoint)).kind === "ok";
  }

  async unregisterPush(): Promise<boolean> {
    return (await this.session.unregisterPush()).kind === "ok";
  }

  /** Subscribes to [roomId]'s live updates; [onChanged] fires whenever a server push actually
   * lands new local data - call {@link LiveUpdatesSubscription.close} when the UI navigates
   * away from the room. See {@link RelaySession.connectLiveUpdates}'s own doc comment for why
   * this isn't a simple event-free `Promise`. */
  connectLiveUpdates(roomId: Int8Array, onChanged: () => void): LiveUpdatesSubscription {
    const handle: LiveUpdatesHandle = this.session.connectLiveUpdates(roomId, onChanged);
    return { close: () => handle.close() };
  }
}

function bytesEqual(a: Int8Array, b: Int8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
