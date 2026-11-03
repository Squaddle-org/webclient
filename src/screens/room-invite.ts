import { h, mount } from "../dom";
import { t } from "../i18n";
import { b32ToRoomId } from "../bytes";
import { linkClick, type Navigate } from "../navigation";
import type { RoomSessionOrchestrator } from "../relay/room-session";

/** Invite creation, moved off the room screen into its own linked subpage (user-reported: it
 * shouldn't sit permanently in the room's main view) - reached via the "Add members" link next
 * to "Rename room" there. */
export async function renderRoomInvite(session: RoomSessionOrchestrator, roomIdB32: string, navigate: Navigate): Promise<HTMLElement> {
  const container = h("div", { class: "screen room-invite" });
  const roomId = b32ToRoomId(roomIdB32);
  if (!roomId) {
    mount(container, h("p", { class: "error" }, [t("join_error_title")]));
    return container;
  }

  const error = h("p", { class: "error" });
  const requireApprovalInput = h("input", { type: "checkbox" }) as HTMLInputElement;
  const maxUsesInput = h("input", { type: "number", min: "1", placeholder: t("invite_max_uses_label") }) as HTMLInputElement;
  const expirySelect = h("select", {}, [
    h("option", { value: "" }, [t("invite_expiry_never")]),
    h("option", { value: "86400" }, [t("invite_expiry_1_day")]),
    h("option", { value: "604800" }, [t("invite_expiry_7_days")]),
    h("option", { value: "2592000" }, [t("invite_expiry_30_days")]),
  ]) as HTMLSelectElement;
  const resultInput = h("input", { type: "text", readonly: "true" }) as HTMLInputElement;

  mount(
    container,
    h("a", { href: `/rooms/${roomIdB32}`, onclick: linkClick(() => navigate({ kind: "room", roomIdB32 })) }, [`← ${t("room_back_action")}`]),
    h("h1", {}, [t("invite_title")]),
    h("label", { class: "row" }, [requireApprovalInput, ` ${t("invite_require_approval")}`]),
    h("p", { class: "body-small" }, [t("invite_require_approval_explainer")]),
    h("label", {}, [`${t("invite_expires")} `, expirySelect]),
    h("label", {}, [maxUsesInput]),
    h("button", {
      onclick: async () => {
        const expiresInSeconds = expirySelect.value ? Number(expirySelect.value) : null;
        const expiresAt = expiresInSeconds ? Math.floor(Date.now() / 1000) + expiresInSeconds : null;
        const maxUses = maxUsesInput.value ? Number(maxUsesInput.value) : null;
        const invite = await session.createInvite(roomId, requireApprovalInput.checked, expiresAt, maxUses);
        if (invite) resultInput.value = invite.url;
        else error.textContent = t("invite_error_title");
      },
    }, [t("invite_create")]),
    resultInput,
    error,
  );
  return container;
}
