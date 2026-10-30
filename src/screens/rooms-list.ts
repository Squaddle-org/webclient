import { h, mount } from "../dom";
import { t } from "../i18n";
import { roomIdToB32 } from "../bytes";
import { linkClick, type Navigate } from "../navigation";
import { renderEmptyState } from "../components/empty-state";
import type { RoomSessionOrchestrator } from "../relay/room-session";
import type { KnownRoom } from "../rooms/known-rooms-store";

export async function renderRoomsList(session: RoomSessionOrchestrator, navigate: Navigate): Promise<HTMLElement> {
  const container = h("div", { class: "screen rooms-list" });
  const newRoomInput = h("input", { type: "text", placeholder: t("rooms_name_label") }) as HTMLInputElement;
  const joinUrlInput = h("input", { type: "text", placeholder: t("invite_title") }) as HTMLInputElement;
  const error = h("p", { class: "error" });

  const roomRow = (room: KnownRoom): HTMLElement =>
    h("li", { class: "card" }, [
      h(
        "a",
        { href: `/rooms/${roomIdToB32(room.roomId)}`, onclick: linkClick(() => navigate({ kind: "room", roomIdB32: roomIdToB32(room.roomId) })) },
        [room.displayName],
      ),
    ]);

  const known = await session.refreshKnownRooms();
  mount(
    container,
    h("div", { class: "row", style: "justify-content:space-between;" }, [
      h("h1", {}, [t("rooms_title")]),
      h("a", { href: "/settings", class: "label-large", onclick: linkClick(() => navigate({ kind: "settings" })) }, [t("settings_title")]),
    ]),
    known.length === 0
      ? renderEmptyState("people", t("rooms_empty_explainer"))
      : h("ul", { class: "list" }, known.map(roomRow)),
    h("h2", {}, [t("rooms_create")]),
    h("div", { class: "row" }, [
      newRoomInput,
      h("button", {
        onclick: async () => {
          const name = newRoomInput.value.trim();
          if (!name) return;
          const roomId = await session.createRoom(name);
          if (roomId) navigate({ kind: "room", roomIdB32: roomIdToB32(roomId) });
          else error.textContent = t("rooms_create_error_title");
        },
      }, [t("action_create")]),
    ]),
    h("h2", {}, [t("action_join")]),
    h("div", { class: "row" }, [
      joinUrlInput,
      h("button", {
        class: "secondary",
        onclick: async () => {
          const result = await session.joinViaUrl(joinUrlInput.value.trim());
          if (!result) {
            error.textContent = t("join_error_title");
            return;
          }
          navigate({ kind: "room", roomIdB32: roomIdToB32(result.roomId) });
        },
      }, [t("action_join")]),
    ]),
    error,
  );
  return container;
}
