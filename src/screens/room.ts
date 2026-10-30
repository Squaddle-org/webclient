import { h, mount } from "../dom";
import { t } from "../i18n";
import { b32ToRoomId, bytesEqual, roomIdToB32 } from "../bytes";
import { linkClick, type Navigate } from "../navigation";
import { renderAvatar } from "../components/avatar";
import { renderEmptyState } from "../components/empty-state";
import { getMyUserKey } from "../session-context";
import { downloadIcs } from "../room/ics";
import type { Event, Idea, LiveUpdatesSubscription, Member, RoomSessionOrchestrator } from "../relay/room-session";

type Tab = "ideas" | "events";

function formatEventTime(event: Event): string {
  const opts: Intl.DateTimeFormatOptions = event.allDay
    ? { year: "numeric", month: "short", day: "numeric" }
    : { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  try {
    return new Date(event.start * 1000).toLocaleString(undefined, { ...opts, timeZone: event.tz });
  } catch {
    return new Date(event.start * 1000).toLocaleString(undefined, opts);
  }
}

/** [onLiveSub] hands the caller (`app.ts`) the live-updates handle to close when the user
 * navigates away - `app.ts` owns that lifecycle (same module-level pattern it already used
 * before this screen moved into its own module), this screen just creates the subscription. */
export async function renderRoomView(
  session: RoomSessionOrchestrator,
  roomIdB32: string,
  navigate: Navigate,
  onLiveSub: (sub: LiveUpdatesSubscription) => void,
): Promise<HTMLElement> {
  const container = h("div", { class: "screen room-view" });
  const roomId = b32ToRoomId(roomIdB32);
  if (!roomId) {
    mount(container, h("p", { class: "error" }, [t("join_error_title")]));
    return container;
  }

  const myUserKey = getMyUserKey();
  // A plain object, not a bare `let` - TS's control-flow narrowing otherwise collapses a `let`
  // reassigned only from closures (the tab buttons below) to its literal initial value at any
  // synchronous read site, which falsely flags the second tab-bar button's comparison as
  // "no overlap".
  const tabState: { active: Tab } = { active: "ideas" };

  const known = (await session.listKnownRooms()).find((r) => bytesEqual(r.roomId, roomId));
  const myRole = await session.myRole(roomId);
  const isAdminOrOwner = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";
  const limits = await session.getLimits(roomId);

  const voucherSection = h("div", { class: "voucher-section" });
  const voucherError = h("p", { class: "error" });
  const renderVoucher = (): void => {
    const codeInput = h("input", { type: "text", placeholder: t("voucher_code_label") }) as HTMLInputElement;
    mount(voucherSection, h("div", { class: "row" }, [
      codeInput,
      h("button", { class: "text", onclick: async () => {
        const result = await session.redeemVoucher(roomId, codeInput.value.trim());
        if (!result.tier) {
          voucherError.textContent = result.message ?? t("voucher_error_title");
          return;
        }
        voucherError.textContent = "";
        await renderTab();
      } }, [t("room_redeem_voucher")]),
    ]), voucherError);
  };
  renderVoucher();

  const header = h("div", { class: "row", style: "justify-content:space-between;align-items:baseline;" }, [
    h("a", { href: "/rooms", onclick: linkClick(() => navigate({ kind: "rooms" })) }, [`← ${t("rooms_title")}`]),
    limits ? h("span", { class: "pill" }, [t(`tier_${limits.tier}`)]) : null,
  ]);
  const title = h("h1", {}, [known?.displayName ?? t("default_room_name")]);

  const tabBar = h("div", { class: "row" }, [
    h("button", { class: tabState.active === "ideas" ? "" : "secondary", onclick: () => { tabState.active = "ideas"; void renderTab(); } }, [t("room_tab_ideas")]),
    h("button", { class: tabState.active === "events" ? "" : "secondary", onclick: () => { tabState.active = "events"; void renderTab(); } }, [t("room_tab_events")]),
  ]);
  const tabContent = h("div", { class: "tab-content" });
  const membersSection = h("div", { class: "members-section" });
  const inviteSection = h("div", { class: "invite-section" });
  const error = h("p", { class: "error" });

  // ---- Ideas tab ----

  const ideaRow = (idea: Idea): HTMLElement => {
    const ideaIdB32 = roomIdToB32(idea.id);
    const canEdit = isAdminOrOwner || bytesEqual(idea.createdBy, myUserKey);
    const voteBtn = (direction: 1 | -1, label: string): HTMLElement =>
      h("button", {
        class: idea.myVote === direction ? "" : "secondary",
        onclick: async () => {
          await session.vote(roomId, idea.id, idea.myVote === direction ? 0 : direction);
          await renderTab();
        },
      }, [label]);

    const editForm = (): void => {
      const editTitle = h("input", { type: "text", value: idea.title }) as HTMLInputElement;
      const editDesc = h("input", { type: "text", value: idea.desc ?? "" }) as HTMLInputElement;
      const row = container.querySelector(`[data-idea="${ideaIdB32}"]`);
      if (!row) return;
      mount(row as HTMLElement, editTitle, editDesc, h("div", { class: "row" }, [
        h("button", { onclick: async () => {
          await session.editIdea(roomId, idea.id, "title", editTitle.value.trim());
          await session.editIdea(roomId, idea.id, "desc", editDesc.value.trim() || null);
          await renderTab();
        } }, [t("action_save")]),
        h("button", { class: "secondary", onclick: () => void renderTab() }, [t("action_cancel")]),
      ]));
    };

    return h("li", { class: "card", "data-idea": ideaIdB32 }, [
      h("div", { class: "row", style: "justify-content:space-between;" }, [
        h("a", { class: "title-medium", href: `/rooms/${roomIdB32}/ideas/${ideaIdB32}`, onclick: linkClick(() => navigate({ kind: "idea", roomIdB32, ideaIdB32 })) }, [idea.title]),
        h("span", { class: "label-medium" }, [String(idea.score)]),
      ]),
      idea.desc ? h("p", { class: "body-medium" }, [idea.desc]) : null,
      h("div", { class: "row" }, [
        voteBtn(1, t("room_upvote")),
        voteBtn(-1, t("room_downvote")),
        canEdit ? h("button", { class: "text", onclick: editForm }, [t("room_edit_idea")]) : null,
        canEdit ? h("button", { class: "text", onclick: async () => {
          if (!confirm(t("room_delete_idea_confirm_title"))) return;
          await session.deleteIdea(roomId, idea.id);
          await renderTab();
        } }, [t("room_delete_idea")]) : null,
        (isAdminOrOwner || myRole === "member") ? h("button", { class: "text", onclick: () => makeEventForm(idea) }, [t("room_make_this_an_event")]) : null,
      ]),
    ]);
  };

  const renderIdeasTab = async (): Promise<void> => {
    const ideas = await session.listIdeas(roomId);
    const titleInput = h("input", { type: "text", placeholder: t("room_title_label") }) as HTMLInputElement;
    const descInput = h("input", { type: "text", placeholder: t("room_description_optional_label") }) as HTMLInputElement;
    mount(
      tabContent,
      ideas.length === 0 ? renderEmptyState("idea", t("room_no_ideas_hint")) : h("ul", { class: "list" }, ideas.map(ideaRow)),
      h("h3", {}, [t("room_new_idea")]),
      h("div", { class: "row" }, [
        titleInput, descInput,
        h("button", {
          onclick: async () => {
            const value = titleInput.value.trim();
            if (!value) return;
            await session.createIdea(roomId, value, descInput.value.trim() || null);
            titleInput.value = "";
            descInput.value = "";
            await renderTab();
          },
        }, [t("action_create")]),
      ]),
    );
  };

  // ---- Events tab ----

  let newEventIdeaId: Int8Array | null = null;

  const makeEventForm = (idea: Idea): void => {
    newEventIdeaId = idea.id;
    tabState.active = "events";
    void renderTab();
  };

  const eventRow = (event: Event): HTMLElement => {
    const rsvpBtn = (value: "yes" | "maybe" | "no", labelKey: string, count: number): HTMLElement =>
      h("button", {
        class: event.myRsvp === value ? "" : "secondary",
        onclick: async () => {
          await session.rsvp(roomId, event.id, value);
          await renderTab();
        },
      }, [t(labelKey, count)]);

    return h("li", { class: "card" }, [
      h("div", { class: "title-medium" }, [event.title]),
      h("p", { class: "body-medium" }, [formatEventTime(event), event.location ? ` · ${event.location}` : ""]),
      h("div", { class: "row" }, [
        rsvpBtn("yes", "room_rsvp_yes", event.yesCount),
        rsvpBtn("maybe", "room_rsvp_maybe", event.maybeCount),
        rsvpBtn("no", "room_rsvp_no", event.noCount),
      ]),
      h("div", { class: "row" }, [
        h("button", { class: "text", onclick: () => downloadIcs(event) }, [t("room_add_to_calendar")]),
        event.canCancel ? h("button", { class: "text", onclick: async () => {
          if (!confirm(t("room_cancel_event_confirm_title"))) return;
          await session.cancelEvent(roomId, event.id);
          await renderTab();
        } }, [t("room_cancel_event")]) : null,
      ]),
    ]);
  };

  const renderEventsTab = async (): Promise<void> => {
    const events = await session.listEvents(roomId);
    const canCreate = await session.canCreateEvent(roomId);
    const eventTitleInput = h("input", { type: "text", placeholder: t("room_title_label"), value: newEventIdeaId ? "" : "" }) as HTMLInputElement;
    const eventLocationInput = h("input", { type: "text", placeholder: t("room_location_optional_label") }) as HTMLInputElement;
    const dateInput = h("input", { type: "datetime-local" }) as HTMLInputElement;
    const allDayInput = h("input", { type: "checkbox" }) as HTMLInputElement;

    mount(
      tabContent,
      events.length === 0 ? renderEmptyState("event", t("room_no_events_hint")) : h("ul", { class: "list" }, events.map(eventRow)),
      canCreate
        ? h("div", {}, [
            h("h3", {}, [t("room_new_event")]),
            h("div", { class: "row" }, [eventTitleInput]),
            h("div", { class: "row" }, [dateInput, h("label", { class: "row" }, [allDayInput, ` ${t("room_all_day")}`])]),
            h("div", { class: "row" }, [eventLocationInput]),
            h("div", { class: "row" }, [
              h("button", {
                onclick: async () => {
                  const value = eventTitleInput.value.trim();
                  const when = dateInput.value ? Math.floor(new Date(dateInput.value).getTime() / 1000) : null;
                  if (!value || when === null) return;
                  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                  await session.createEvent(roomId, newEventIdeaId, value, when, null, tz, eventLocationInput.value.trim() || null, allDayInput.checked);
                  newEventIdeaId = null;
                  await renderTab();
                },
              }, [t("action_create")]),
              h("button", { class: "secondary", onclick: () => { newEventIdeaId = null; void renderTab(); } }, [t("action_cancel")]),
            ]),
          ])
        : null,
    );
  };

  const renderTab = async (): Promise<void> => {
    if (tabState.active === "ideas") await renderIdeasTab();
    else await renderEventsTab();
    mount(container, header, title, voucherSection, tabBar, tabContent, membersSection, inviteSection, error);
  };

  // ---- Members ----

  const memberRow = (member: Member): HTMLElement => {
    const isSelf = bytesEqual(member.userKey, myUserKey);
    const canApprove = isAdminOrOwner && member.role === "pending";
    const canReject = canApprove;
    const canKick = !isSelf && member.role !== "pending" && ((isOwner && member.role !== "owner") || (myRole === "admin" && member.role === "member"));
    const canPromote = isOwner && !isSelf && member.role === "member";
    const canDemote = isOwner && !isSelf && member.role === "admin";
    const canTransfer = isOwner && !isSelf && member.role === "admin";

    const act = (fn: () => Promise<boolean>): (() => void) => () => {
      void fn().then((ok) => {
        if (!ok) error.textContent = t("members_action_failed_title");
        void refreshMembers();
      });
    };

    return h("li", { class: "card row" }, [
      renderAvatar(member.userKey, member.displayName, 32),
      h("span", { class: "body-medium", style: "flex:1;" }, [member.displayName ?? t(`role_${member.role}`)]),
      h("span", { class: "pill" }, [t(`role_${member.role}`)]),
      canApprove ? h("button", { class: "text", onclick: act(() => session.approve(roomId, member.userKey)) }, [t("members_approve")]) : null,
      canReject ? h("button", { class: "text", onclick: act(() => session.reject(roomId, member.userKey)) }, [t("members_reject")]) : null,
      canPromote ? h("button", { class: "text", onclick: act(() => session.setRole(roomId, member.userKey, "admin")) }, [t("members_promote")]) : null,
      canDemote ? h("button", { class: "text", onclick: act(() => session.setRole(roomId, member.userKey, "member")) }, [t("members_demote")]) : null,
      canTransfer ? h("button", { class: "text", onclick: act(() => session.transferOwner(roomId, member.userKey)) }, [t("members_transfer_ownership")]) : null,
      canKick ? h("button", { class: "text", onclick: act(() => session.kick(roomId, member.userKey)) }, [t("members_remove")]) : null,
    ]);
  };

  const refreshMembers = async (): Promise<void> => {
    const members = await session.listMembers(roomId);
    mount(membersSection, h("h2", {}, [t("members_title")]), h("ul", { class: "list" }, members.map(memberRow)));
  };

  // ---- Invite ----

  const renderInvite = (): void => {
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
      inviteSection,
      h("h2", {}, [t("invite_title")]),
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
    );
  };

  renderInvite();
  await refreshMembers();
  await renderTab();

  onLiveSub(session.connectLiveUpdates(roomId, () => {
    void renderTab();
    void refreshMembers();
  }));

  return container;
}
