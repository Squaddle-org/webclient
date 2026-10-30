import { h, mount } from "../dom";
import { t } from "../i18n";
import { b32ToRoomId, bytesEqual } from "../bytes";
import { linkClick, type Navigate } from "../navigation";
import { getMyUserKey } from "../session-context";
import type { Comment, RoomSessionOrchestrator } from "../relay/room-session";

export async function renderIdeaDetail(session: RoomSessionOrchestrator, roomIdB32: string, ideaIdB32: string, navigate: Navigate): Promise<HTMLElement> {
  const container = h("div", { class: "screen idea-detail" });
  const roomId = b32ToRoomId(roomIdB32);
  const ideaId = b32ToRoomId(ideaIdB32); // same encoding, different byte length - same decoder
  if (!roomId || !ideaId) {
    mount(container, h("p", { class: "error" }, [t("join_error_title")]));
    return container;
  }

  const myUserKey = getMyUserKey();
  const myRole = await session.myRole(roomId);
  const isAdminOrOwner = myRole === "owner" || myRole === "admin";

  const render = async (): Promise<void> => {
    const ideas = await session.listIdeas(roomId);
    const idea = ideas.find((i) => bytesEqual(i.id, ideaId));
    if (!idea) {
      mount(container, h("p", { class: "error" }, [t("join_error_title")]));
      return;
    }

    const commentInput = h("input", { type: "text", placeholder: t("room_add_comment_label") }) as HTMLInputElement;
    const comments = await session.listComments(roomId, ideaId);
    const commentRow = (comment: Comment): HTMLElement => {
      const canDelete = isAdminOrOwner || bytesEqual(comment.author, myUserKey);
      return h("li", { class: "card row" }, [
        h("span", { class: "body-medium", style: "flex:1;" }, [comment.text]),
        canDelete ? h("button", { class: "text", onclick: async () => {
          await session.deleteComment(roomId, comment.id);
          await render();
        } }, [t("room_delete_comment")]) : null,
      ]);
    };

    mount(
      container,
      h("a", { href: `/rooms/${roomIdB32}`, onclick: linkClick(() => navigate({ kind: "room", roomIdB32 })) }, [`← ${t("room_back_to_ideas")}`]),
      h("h1", {}, [idea.title]),
      idea.desc ? h("p", { class: "body-medium" }, [idea.desc]) : null,
      h("p", { class: "label-medium" }, [t("room_score_label", idea.score)]),
      h("h2", {}, [t("room_comments")]),
      h("ul", { class: "list" }, comments.map(commentRow)),
      h("div", { class: "row" }, [
        commentInput,
        h("button", {
          onclick: async () => {
            const text = commentInput.value.trim();
            if (!text) return;
            await session.addComment(roomId, ideaId, text);
            await render();
          },
        }, [t("room_post_comment")]),
      ]),
    );
  };

  await render();
  return container;
}
