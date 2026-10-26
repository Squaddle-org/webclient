import { SessionApi, type RelaySession, type IdeaJs, type CommentJs, type MemberJs, type LiveUpdatesHandle } from "core";
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

function toIdea(js: IdeaJs): Idea {
  return { id: js.id, createdBy: js.createdBy, title: js.title, desc: js.desc ?? null, tags: js.tags, score: js.score, myVote: js.myVote ?? null };
}

function toComment(js: CommentJs): Comment {
  return { id: js.id, ideaId: js.ideaId, author: js.author, text: js.text };
}

function toMember(js: MemberJs): Member {
  return { userKey: js.userKey, role: js.role };
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

  /** `null` if [url] doesn't parse as an invite link. On success, joins and records the room
   * locally - the display name is whatever the inviter sealed into the envelope ({@link
   * RelaySession.peekInviteRoomName}), falling back to a generic placeholder if that's
   * unavailable (approval-required invite, or the peek itself failed), same fallback android's
   * `RealSyncGateway.joinViaLink` uses. */
  async joinViaUrl(url: string): Promise<{ roomId: Int8Array } | null> {
    const link = parseInviteLink(url);
    if (!link) return null;
    return this.joinViaLink(link);
  }

  async joinViaLink(link: InviteLink): Promise<{ roomId: Int8Array } | null> {
    if (!link.inviteSecret) return null; // approval-required invites are out of M5a's scope (see RelaySession.joinViaLink's own doc comment)
    const result = await this.session.joinViaLink(link.roomId, link.inviteId, link.inviteSecret);
    if (result.kind !== "ok") return null;

    const roomName = (await this.session.peekInviteRoomName(link.roomId, link.inviteId, link.inviteSecret)) ?? "Squaddle room";
    const now = Date.now();
    await this.knownRooms.upsert({ roomId: link.roomId, displayName: roomName, relayHost: link.relayHost, joinedAt: now, lastActivityAt: now });
    return { roomId: link.roomId };
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
