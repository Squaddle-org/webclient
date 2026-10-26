import { EncodingApi } from "core";
import { h, mount } from "./dom";
import { parseRoute, routeToPath, type Route } from "./router";
import { IdentityStore } from "./identity/identity-store";
import { IndexedDbKeystore } from "./storage/keystore";
import { getRelayHost, setRelayHost } from "./storage/relay-host-pref";
import { RoomSessionOrchestrator, type Idea, type Comment } from "./relay/room-session";
import type { KnownRoom } from "./rooms/known-rooms-store";
import { parseInviteLink } from "./invite/invite-link";

const identityStore = new IdentityStore(new IndexedDbKeystore());
let orchestrator: RoomSessionOrchestrator | null = null;

function roomIdToB32(roomId: Int8Array): string {
  return EncodingApi.getInstance().base32Encode(roomId);
}

function b32ToRoomId(text: string): Int8Array | null {
  return EncodingApi.getInstance().base32Decode(text) ?? null;
}

/** Opens (or reuses) the one session for this page load - mirrors `RoomSessionOrchestrator`'s
 * own doc comment: constructed once, not per-call, so pulled data/cursors persist for the
 * lifetime of the page. */
async function ensureSession(): Promise<RoomSessionOrchestrator> {
  if (orchestrator) return orchestrator;
  const identity = await identityStore.load();
  if (!identity) throw new Error("no identity - onboarding must run first");
  orchestrator = await RoomSessionOrchestrator.open(identity, getRelayHost());
  await orchestrator.registerDevice(); // self-certifying, always safe to call again (SyncClient.publishDeviceCert's own doc comment)
  return orchestrator;
}

export function navigate(route: Route): void {
  history.pushState(null, "", routeToPath(route));
  render();
}

function currentRoute(): Route {
  return parseRoute(location.pathname, location.href);
}

export async function render(): Promise<void> {
  const container = document.getElementById("app");
  if (!container) return;

  if (!(await identityStore.hasIdentity())) {
    mount(container, renderOnboarding());
    return;
  }

  const route = currentRoute();
  try {
    if (route.kind === "join") {
      await renderJoin(container, route.url);
      return;
    }
    const session = await ensureSession();
    switch (route.kind) {
      case "onboarding":
      case "rooms":
        mount(container, await renderRoomsList(session));
        break;
      case "room":
        mount(container, await renderRoomView(session, route.roomIdB32));
        break;
      case "idea":
        mount(container, await renderIdeaDetail(session, route.roomIdB32, route.ideaIdB32));
        break;
    }
  } catch (err) {
    mount(container, h("div", { class: "error" }, [`Something went wrong: ${err instanceof Error ? err.message : String(err)}`]));
  }
}

// ---- Onboarding ----

function renderOnboarding(): HTMLElement {
  const container = h("div", { class: "screen onboarding" });
  const showChoice = () => {
    mount(
      container,
      h("h1", {}, ["Squaddle"]),
      h("button", { onclick: () => showCreate() }, ["Create a new identity"]),
      h("button", { onclick: () => showRestore() }, ["Restore from recovery words"]),
    );
  };

  const showCreate = () => {
    const labelInput = h("input", { type: "text", value: "My device" }) as HTMLInputElement;
    mount(
      container,
      h("h2", {}, ["Create identity"]),
      h("label", {}, ["Device name ", labelInput]),
      h("button", {
        onclick: async () => {
          const { mnemonic } = await identityStore.create(labelInput.value.trim() || "My device");
          showMnemonic(mnemonic);
        },
      }, ["Create"]),
      h("button", { onclick: showChoice }, ["Back"]),
    );
  };

  const showMnemonic = (mnemonic: string[]) => {
    const list = h("ol", {}, mnemonic.map((word) => h("li", {}, [word])));
    const checkbox = h("input", { type: "checkbox", id: "confirm-saved" }) as HTMLInputElement;
    const continueBtn = h("button", { disabled: "true", onclick: () => render() }, ["Continue"]) as HTMLButtonElement;
    checkbox.addEventListener("change", () => {
      continueBtn.disabled = !checkbox.checked;
    });
    mount(
      container,
      h("h2", {}, ["Save these 24 words"]),
      h("p", {}, ["Write these down somewhere safe - they're the only way to recover this identity."]),
      list,
      h("label", {}, [checkbox, " I've saved these words"]),
      continueBtn,
    );
  };

  const showRestore = () => {
    const labelInput = h("input", { type: "text", value: "My device" }) as HTMLInputElement;
    const wordsInput = h("textarea", { rows: "3" }) as HTMLTextAreaElement;
    const error = h("p", { class: "error" });
    mount(
      container,
      h("h2", {}, ["Restore identity"]),
      h("label", {}, ["Device name ", labelInput]),
      h("label", {}, ["24-word recovery phrase", h("br"), wordsInput]),
      error,
      h("button", {
        onclick: async () => {
          const words = wordsInput.value.trim().split(/\s+/);
          const ok = await identityStore.restore(words, labelInput.value.trim() || "My device");
          if (!ok) {
            error.textContent = "That recovery phrase isn't valid.";
            return;
          }
          render();
        },
      }, ["Restore"]),
      h("button", { onclick: showChoice }, ["Back"]),
    );
  };

  showChoice();
  return container;
}

// ---- Rooms list ----

async function renderRoomsList(session: RoomSessionOrchestrator): Promise<HTMLElement> {
  const container = h("div", { class: "screen rooms-list" });
  const relayHostInput = h("input", { type: "text", value: getRelayHost() }) as HTMLInputElement;
  const newRoomInput = h("input", { type: "text", placeholder: "Room name" }) as HTMLInputElement;
  const joinUrlInput = h("input", { type: "text", placeholder: "Paste an invite link" }) as HTMLInputElement;
  const error = h("p", { class: "error" });

  const roomRow = (room: KnownRoom): HTMLElement =>
    h("li", {}, [
      h("a", { href: routeToPathFor(room), onclick: linkClick(() => navigate({ kind: "room", roomIdB32: roomIdToB32(room.roomId) })) }, [
        room.displayName,
      ]),
    ]);

  function routeToPathFor(room: KnownRoom): string {
    return `/rooms/${roomIdToB32(room.roomId)}`;
  }

  const known = await session.refreshKnownRooms();
  mount(
    container,
    h("h1", {}, ["Your rooms"]),
    h("ul", {}, known.map(roomRow)),
    h("h2", {}, ["Create a room"]),
    newRoomInput,
    h("button", {
      onclick: async () => {
        const name = newRoomInput.value.trim();
        if (!name) return;
        const roomId = await session.createRoom(name);
        if (roomId) navigate({ kind: "room", roomIdB32: roomIdToB32(roomId) });
      },
    }, ["Create"]),
    h("h2", {}, ["Join a room"]),
    joinUrlInput,
    error,
    h("button", {
      onclick: async () => {
        const result = await session.joinViaUrl(joinUrlInput.value.trim());
        if (!result) {
          error.textContent = "That invite link didn't work - check it's complete and try again.";
          return;
        }
        navigate({ kind: "room", roomIdB32: roomIdToB32(result.roomId) });
      },
    }, ["Join"]),
    h("h2", {}, ["Relay host"]),
    relayHostInput,
    h("button", {
      onclick: () => {
        setRelayHost(relayHostInput.value);
        orchestrator = null; // force a fresh session against the new host on next use
        render();
      },
    }, ["Save"]),
  );
  return container;
}

function linkClick(fn: () => void): (ev: Event) => void {
  return (ev: Event) => {
    ev.preventDefault();
    fn();
  };
}

// ---- Room view ----

async function renderRoomView(session: RoomSessionOrchestrator, roomIdB32: string): Promise<HTMLElement> {
  const container = h("div", { class: "screen room-view" });
  const roomId = b32ToRoomId(roomIdB32);
  if (!roomId) {
    mount(container, h("p", { class: "error" }, ["Not a valid room link."]));
    return container;
  }

  const titleInput = h("input", { type: "text", placeholder: "Idea title" }) as HTMLInputElement;
  const descInput = h("input", { type: "text", placeholder: "Description (optional)" }) as HTMLInputElement;

  const ideaRow = (idea: Idea): HTMLElement => {
    const ideaIdB32 = EncodingApi.getInstance().base32Encode(idea.id);
    return h("li", {}, [
      h("a", { href: `/rooms/${roomIdB32}/ideas/${ideaIdB32}`, onclick: linkClick(() => navigate({ kind: "idea", roomIdB32, ideaIdB32 })) }, [
        `${idea.title} `,
      ]),
      h("span", { class: "score" }, [`score: ${idea.score}`]),
      h("button", {
        onclick: async () => {
          await session.vote(roomId, idea.id, (idea.myVote ?? 0) >= 1 ? 0 : 1);
          mount(container, await renderRoomView(session, roomIdB32));
        },
      }, [idea.myVote && idea.myVote >= 1 ? "Unvote" : "Upvote"]),
    ]);
  };

  const ideas = await session.listIdeas(roomId);
  mount(
    container,
    h("a", { href: "/rooms", onclick: linkClick(() => navigate({ kind: "rooms" })) }, ["← Rooms"]),
    h("h1", {}, ["Ideas"]),
    h("ul", {}, ideas.map(ideaRow)),
    h("h2", {}, ["New idea"]),
    titleInput,
    descInput,
    h("button", {
      onclick: async () => {
        const title = titleInput.value.trim();
        if (!title) return;
        await session.createIdea(roomId, title, descInput.value.trim() || null);
        mount(container, await renderRoomView(session, roomIdB32));
      },
    }, ["Add idea"]),
  );
  return container;
}

// ---- Idea detail ----

async function renderIdeaDetail(session: RoomSessionOrchestrator, roomIdB32: string, ideaIdB32: string): Promise<HTMLElement> {
  const container = h("div", { class: "screen idea-detail" });
  const roomId = b32ToRoomId(roomIdB32);
  const ideaId = b32ToRoomId(ideaIdB32); // same encoding, different byte length - same decoder
  if (!roomId || !ideaId) {
    mount(container, h("p", { class: "error" }, ["Not a valid link."]));
    return container;
  }

  const ideas = await session.listIdeas(roomId);
  const idea = ideas.find((i) => bytesEqual(i.id, ideaId));
  if (!idea) {
    mount(container, h("p", { class: "error" }, ["That idea wasn't found."]));
    return container;
  }

  const commentInput = h("input", { type: "text", placeholder: "Add a comment" }) as HTMLInputElement;
  const comments = await session.listComments(roomId, ideaId);
  const commentRow = (comment: Comment): HTMLElement => h("li", {}, [comment.text]);

  mount(
    container,
    h("a", { href: `/rooms/${roomIdB32}`, onclick: linkClick(() => navigate({ kind: "room", roomIdB32 })) }, ["← Back"]),
    h("h1", {}, [idea.title]),
    idea.desc ? h("p", {}, [idea.desc]) : null,
    h("p", {}, [`Score: ${idea.score}`]),
    h("h2", {}, ["Comments"]),
    h("ul", {}, comments.map(commentRow)),
    commentInput,
    h("button", {
      onclick: async () => {
        const text = commentInput.value.trim();
        if (!text) return;
        await session.addComment(roomId, ideaId, text);
        mount(container, await renderIdeaDetail(session, roomIdB32, ideaIdB32));
      },
    }, ["Comment"]),
  );
  return container;
}

// ---- Join (external invite link landing) ----

async function renderJoin(container: HTMLElement, url: string): Promise<void> {
  const link = parseInviteLink(url);
  if (!link) {
    mount(container, h("p", { class: "error" }, ["That invite link isn't valid."]));
    return;
  }
  const session = await ensureSession();
  const result = await session.joinViaLink(link);
  if (!result) {
    mount(container, h("p", { class: "error" }, ["Couldn't join that room - the invite may require approval (not supported yet) or may have expired."]));
    return;
  }
  navigate({ kind: "room", roomIdB32: roomIdToB32(result.roomId) });
}

function bytesEqual(a: Int8Array, b: Int8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
