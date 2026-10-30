import { h, mount } from "../dom";
import { t } from "../i18n";
import { roomIdToB32 } from "../bytes";
import type { Navigate } from "../navigation";
import { parseInviteLink } from "../invite/invite-link";
import type { RoomSessionOrchestrator } from "../relay/room-session";

/** [ensureSession] mirrors `app.ts`'s own `ensureSession` - a plain parameter rather than an
 * import, same reasoning as every other screen taking `navigate` as a parameter. */
export async function renderJoin(
  container: HTMLElement,
  url: string,
  ensureSession: () => Promise<RoomSessionOrchestrator>,
  navigate: Navigate,
): Promise<void> {
  const link = parseInviteLink(url);
  if (!link) {
    mount(container, h("p", { class: "error" }, [t("join_error_title")]));
    return;
  }

  const session = await ensureSession();
  const roomName = await session.peekInviteRoomName(link);
  const error = h("p", { class: "error" });

  mount(
    container,
    h("div", { class: "screen join" }, [
      h("h1", {}, [t("join_confirm_title")]),
      h("p", { class: "body-medium" }, [roomName ?? t("default_room_name")]),
      error,
      h("button", {
        onclick: async () => {
          const result = await session.joinViaLink(link);
          if (!result) {
            error.textContent = t("join_error_title");
            return;
          }
          navigate({ kind: "room", roomIdB32: roomIdToB32(result.roomId) });
        },
      }, [t("action_join")]),
      h("button", { class: "secondary", onclick: () => navigate({ kind: "rooms" }) }, [t("action_cancel")]),
    ]),
  );
}
