import { h, mount } from "../dom";
import { t } from "../i18n";
import type { IdentityStore } from "../identity/identity-store";
import { KnownRoomsStore } from "../rooms/known-rooms-store";
import { restoreBackupFile } from "../settings/backup";

/** Create/restore-from-seed/restore-from-backup-file, mirroring android's `OnboardingScreen.kt`
 * three entry points exactly. [onDone] is called once the identity is persisted and (for a
 * backup restore) the room list has been seeded locally - the caller (`app.ts`) re-renders from
 * scratch afterward, same as every other route change. */
export function renderOnboarding(identityStore: IdentityStore, onDone: () => void): HTMLElement {
  const container = h("div", { class: "screen onboarding" });

  const showChoice = (): void => {
    mount(
      container,
      h("h1", {}, [t("app_name")]),
      h("p", { class: "body-medium" }, [t("onboarding_tagline")]),
      h("button", { onclick: () => showCreate() }, [t("onboarding_create_identity")]),
      h("button", { class: "secondary", onclick: () => showRestoreSeed() }, [t("onboarding_have_seed")]),
      h("button", { class: "secondary", onclick: () => showRestoreBackup() }, [t("onboarding_have_backup_file")]),
    );
  };

  const showCreate = (): void => {
    const labelInput = h("input", { type: "text", value: "My browser" }) as HTMLInputElement;
    mount(
      container,
      h("h2", {}, [t("onboarding_create_identity")]),
      h("label", {}, [`${t("onboarding_display_name_label")} `, labelInput]),
      h("button", {
        onclick: async () => {
          const { mnemonic } = await identityStore.create(labelInput.value.trim() || "My browser");
          showMnemonic(mnemonic);
        },
      }, [t("action_create")]),
      h("button", { class: "text", onclick: showChoice }, [t("action_back")]),
    );
  };

  const showMnemonic = (mnemonic: string[]): void => {
    const list = h("ol", {}, mnemonic.map((word) => h("li", {}, [word])));
    const checkbox = h("input", { type: "checkbox", id: "confirm-saved" }) as HTMLInputElement;
    const continueBtn = h("button", { disabled: "true", onclick: onDone }, [t("action_continue")]) as HTMLButtonElement;
    checkbox.addEventListener("change", () => {
      continueBtn.disabled = !checkbox.checked;
    });
    mount(
      container,
      h("h2", {}, [t("onboarding_seed_title")]),
      h("p", { class: "body-medium" }, [t("onboarding_seed_warning")]),
      h("ol", { class: "card" }, [list]),
      h("label", { class: "row" }, [checkbox, ` ${t("onboarding_wrote_it_down")}`]),
      continueBtn,
    );
  };

  const showRestoreSeed = (): void => {
    const labelInput = h("input", { type: "text", value: "My browser" }) as HTMLInputElement;
    const wordsInput = h("textarea", { rows: "3", placeholder: t("onboarding_seed_input_label") }) as HTMLTextAreaElement;
    const error = h("p", { class: "error" });
    mount(
      container,
      h("h2", {}, [t("onboarding_restore_title")]),
      h("p", { class: "body-medium" }, [t("onboarding_restore_explainer")]),
      h("label", {}, [`${t("onboarding_display_name_label")} `, labelInput]),
      h("label", {}, [t("onboarding_seed_input_label"), h("br"), wordsInput]),
      error,
      h("button", {
        onclick: async () => {
          const words = wordsInput.value.trim().split(/\s+/);
          const ok = await identityStore.restore(words, labelInput.value.trim() || "My browser");
          if (!ok) {
            error.textContent = t("join_error_title");
            return;
          }
          onDone();
        },
      }, [t("action_create")]),
      h("button", { class: "text", onclick: showChoice }, [t("action_back")]),
    );
  };

  const showRestoreBackup = (): void => {
    const labelInput = h("input", { type: "text", value: "My browser" }) as HTMLInputElement;
    const fileInput = h("input", { type: "file", accept: ".squaddle-backup" }) as HTMLInputElement;
    const passphraseInput = h("input", { type: "password", placeholder: t("settings_passphrase_label") }) as HTMLInputElement;
    const error = h("p", { class: "error" });
    mount(
      container,
      h("h2", {}, [t("onboarding_have_backup_file")]),
      h("p", { class: "body-medium" }, [t("onboarding_backup_passphrase_explainer")]),
      h("label", {}, [`${t("onboarding_display_name_label")} `, labelInput]),
      h("label", {}, [fileInput]),
      h("label", {}, [`${t("settings_passphrase_label")} `, passphraseInput]),
      error,
      h("button", {
        onclick: async () => {
          const file = fileInput.files?.[0];
          if (!file) return;
          const restored = await restoreBackupFile(file, passphraseInput.value);
          if (!restored) {
            error.textContent = t("join_error_title");
            return;
          }
          await identityStore.restoreFromEntropy(restored.entropy, labelInput.value.trim() || "My browser");
          const knownRooms = new KnownRoomsStore();
          const now = Date.now();
          for (const room of restored.rooms) {
            await knownRooms.upsert({
              roomId: room.roomId, displayName: room.name ?? t("default_room_name"),
              relayHost: room.relayHost, joinedAt: now, lastActivityAt: now,
            });
          }
          onDone();
        },
      }, [t("action_continue")]),
      h("button", { class: "text", onclick: showChoice }, [t("action_back")]),
    );
  };

  showChoice();
  return container;
}
