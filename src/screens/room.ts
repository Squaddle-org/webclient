import { h, mount } from "../dom";
import { t } from "../i18n";
import { b32ToRoomId, bytesEqual, roomIdToB32 } from "../bytes";
import { linkClick, type Navigate } from "../navigation";
import { renderAvatar } from "../components/avatar";
import { renderEmptyState } from "../components/empty-state";
import { icon } from "../components/icon";
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

  const header = h("div", { class: "row", style: "justify-content:space-between;align-items:baseline;" }, [
    h("a", { href: "/rooms", onclick: linkClick(() => navigate({ kind: "rooms" })) }, [`← ${t("rooms_title")}`]),
    limits ? h("span", { class: "pill" }, [t(`tier_${limits.tier}`)]) : null,
  ]);
  // The materialized, synced name (PROTOCOL.md §4.2/ADR-0014) is authoritative whenever it
  // exists - prefer it over the local cache, same reasoning as RelaySession.createInvite's own
  // lookup. session.roomName also pulls fresh first, so this doubles as the room-name half of
  // this screen's own self-healing-cache sync pass.
  const syncedRoomName = await session.roomName(roomId);
  const titleText = syncedRoomName ?? known?.displayName ?? t("default_room_name");
  const canRenameRoom = await session.canRenameRoom(roomId);
  const titleTextEl = h("h1", {}, [titleText]);
  const renameSection = h("div", { class: "rename-room-section" });
  const renderRenameSection = (editing: boolean): void => {
    if (!editing) {
      mount(
        renameSection,
        canRenameRoom ? h("button", { class: "text", onclick: () => renderRenameSection(true) }, [t("room_rename_action")]) : null,
      );
      return;
    }
    const nameInput = h("input", { type: "text", value: titleTextEl.textContent ?? "" }) as HTMLInputElement;
    mount(renameSection, h("div", { class: "row" }, [
      nameInput,
      h("button", { onclick: async () => {
        const name = nameInput.value.trim();
        if (!name) return;
        if (await session.setRoomName(roomId, name)) titleTextEl.textContent = name;
        renderRenameSection(false);
      } }, [t("action_save")]),
      h("button", { class: "text", onclick: () => renderRenameSection(false) }, [t("action_cancel")]),
    ]));
  };
  renderRenameSection(false);

  // Members dialog - a native <dialog> overlay (user-reported: the roster shouldn't sit
  // permanently below ideas/events) triggered by the icon button below, rather than a section
  // that's always rendered inline.
  const membersDialogContent = h("div", {});
  const membersDialog = h("dialog", { class: "card" }, [
    h("div", { class: "row", style: "justify-content:space-between;" }, [
      h("h2", {}, [t("members_title")]),
      h("button", { class: "text", onclick: () => membersDialog.close() }, [t("action_close")]),
    ]),
    membersDialogContent,
  ]);
  membersDialog.addEventListener("click", (ev) => {
    if (ev.target === membersDialog) membersDialog.close(); // backdrop click
  });

  const title = h("div", { class: "row", style: "align-items:baseline;" }, [
    titleTextEl,
    renameSection,
    h("a", { href: `/rooms/${roomIdB32}/invite`, onclick: linkClick(() => navigate({ kind: "invite", roomIdB32 })) }, [t("room_invite_action")]),
    h("button", { class: "icon-button", "aria-label": t("members_title"), onclick: () => membersDialog.showModal() }, [icon("group")]),
  ]);

  const tabBar = h("div", { class: "row" }, [
    h("button", { class: tabState.active === "ideas" ? "" : "secondary", onclick: () => { tabState.active = "ideas"; void renderTab(); } }, [t("room_tab_ideas")]),
    h("button", { class: tabState.active === "events" ? "" : "secondary", onclick: () => { tabState.active = "events"; void renderTab(); } }, [t("room_tab_events")]),
  ]);
  const tabContent = h("div", { class: "tab-content" });
  const error = h("p", { class: "error" });

  // ---- Ideas tab ----

  const ideaRow = (idea: Idea): HTMLElement => {
    const ideaIdB32 = roomIdToB32(idea.id);
    const canEdit = isAdminOrOwner || bytesEqual(idea.createdBy, myUserKey);

    // Mirrors android's VoteControl (RoomScreen.kt) exactly: one pill, up-arrow/count/down-arrow,
    // tinted to the primary/error container the moment this device's own vote is up/down - not
    // two separate text buttons plus a floating score badge.
    const voteControl = (): HTMLElement => {
      const stateClass = idea.myVote === 1 ? "voted-up" : idea.myVote === -1 ? "voted-down" : "";
      const vote = async (direction: 1 | -1): Promise<void> => {
        await session.vote(roomId, idea.id, idea.myVote === direction ? 0 : direction);
        await renderTab();
      };
      return h("div", { class: `vote-control ${stateClass}` }, [
        h("button", { class: "vote-up", "aria-label": t("room_upvote"), onclick: () => void vote(1) }, [icon("chevron-up")]),
        h("span", { class: "vote-score", "aria-label": `score ${String(idea.score)}` }, [String(idea.score)]),
        h("button", { class: "vote-down", "aria-label": t("room_downvote"), onclick: () => void vote(-1) }, [icon("chevron-down")]),
      ]);
    };

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
      h("div", { class: "row", style: "justify-content:space-between;align-items:flex-start;" }, [
        h("div", {}, [
          h("a", { class: "title-medium", href: `/rooms/${roomIdB32}/ideas/${ideaIdB32}`, onclick: linkClick(() => navigate({ kind: "idea", roomIdB32, ideaIdB32 })) }, [idea.title]),
          idea.desc ? h("p", { class: "body-medium" }, [idea.desc]) : null,
        ]),
        voteControl(),
      ]),
      h("div", { class: "row" }, [
        canEdit ? h("button", { class: "text", onclick: editForm }, [t("room_edit_idea")]) : null,
        canEdit ? h("button", { class: "destructive", onclick: async () => {
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
        event.canCancel ? h("button", { class: "destructive", onclick: async () => {
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
    mount(container, header, title, tabBar, tabContent, error, membersDialog);
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
      canKick ? h("button", { class: "destructive", onclick: act(() => session.kick(roomId, member.userKey)) }, [t("members_remove")]) : null,
    ]);
  };

  const refreshMembers = async (): Promise<void> => {
    const members = await session.listMembers(roomId);
    mount(membersDialogContent, h("ul", { class: "list" }, members.map(memberRow)));
  };

  await refreshMembers();
  await renderTab();

  onLiveSub(session.connectLiveUpdates(roomId, () => {
    void renderTab();
    void refreshMembers();
  }));

  return container;
}
