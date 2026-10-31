import { h, mount } from "../dom";
import { t } from "../i18n";
import type { IdentityStore } from "../identity/identity-store";
import { KnownRoomsStore } from "../rooms/known-rooms-store";
import { restoreBackupFile } from "../settings/backup";
import { getRelayHost } from "../storage/relay-host-pref";
import { setDisplayName } from "../storage/display-name-pref";
import { RoomSessionOrchestrator } from "../relay/room-session";
import { confirmationCode, generateLink, pollForLinkedIdentity } from "../link/device-link";
import { renderLinkQr } from "../link/qr-display";

/** Create/restore-from-seed/restore-from-backup-file/link-from-another-device, mirroring
 * android's `OnboardingScreen.kt` entry points. Every path funnels into [showNameEntry] before
 * [onDone] - android has a dedicated "What should we call you?" step (`OnboardingUiState.NameEntry`)
 * feeding every one of its own paths the same way; webclient's onboarding previously had no such
 * step at all (the "Display name" field on each path was actually just the device cert's own
 * label, `android.os.Build.MODEL`'s android-side equivalent, auto-defaulted there and never
 * user-facing on android - conflating the two meant webclient never set a real profile name, so
 * every member list showed nothing for a webclient user, anywhere). [onDone] is called once the
 * identity is persisted, any known rooms are seeded, and a display name has been both stored
 * locally and - for a path that already knows about rooms by this point (backup/link restore) -
 * pushed into each of them. */
export function renderOnboarding(identityStore: IdentityStore, onDone: () => void): HTMLElement {
  const container = h("div", { class: "screen onboarding" });

  /** [hasExistingRooms] - a backup/link restore already knows about rooms *before* this step
   * runs (unlike create/restore-from-seed, which never have any yet) - best-effort pushes the
   * chosen name into every one of them right away, same as Settings' own "Save name" action,
   * rather than leaving them without a name until the user happens to visit Settings later. */
  const showNameEntry = (hasExistingRooms: boolean): void => {
    const nameInput = h("input", { type: "text", placeholder: t("onboarding_display_name_label") }) as HTMLInputElement;
    const continueBtn = h("button", {
      onclick: async () => {
        const name = nameInput.value.trim();
        if (name) {
          setDisplayName(name);
          if (hasExistingRooms) {
            try {
              const identity = await identityStore.load();
              if (identity) {
                const session = await RoomSessionOrchestrator.open(identity, getRelayHost());
                await session.registerDevice();
                await session.setDisplayNameEverywhere(name);
              }
            } catch {
              // Best-effort - app.ts's own ensureSession() still establishes a real session right
              // after onDone() either way; a failure here just means the name reaches existing
              // rooms a little later (next time any of them gets a setProfile call) instead of now.
            }
          }
        }
        onDone();
      },
    }, [t("action_continue")]);
    mount(
      container,
      h("h2", {}, [t("onboarding_name_title")]),
      h("p", { class: "body-medium" }, [t("onboarding_name_explainer")]),
      h("label", {}, [nameInput]),
      continueBtn,
    );
  };

  const showChoice = (): void => {
    mount(
      container,
      h("h1", {}, [t("app_name")]),
      h("p", { class: "body-medium" }, [t("onboarding_tagline")]),
      h("button", { onclick: () => showCreate() }, [t("onboarding_create_identity")]),
      h("button", { class: "secondary", onclick: () => showRestoreSeed() }, [t("onboarding_have_seed")]),
      h("button", { class: "secondary", onclick: () => showRestoreBackup() }, [t("onboarding_have_backup_file")]),
      h("button", { class: "secondary", onclick: () => void showLinkDevice() }, [t("onboarding_link_device")]),
    );
  };

  const showCreate = (): void => {
    mount(
      container,
      h("h2", {}, [t("onboarding_create_identity")]),
      h("button", {
        onclick: async () => {
          const { mnemonic } = await identityStore.create("My browser");
          showMnemonic(mnemonic);
        },
      }, [t("action_create")]),
      h("button", { class: "text", onclick: showChoice }, [t("action_back")]),
    );
  };

  const showMnemonic = (mnemonic: string[]): void => {
    const list = h("ol", {}, mnemonic.map((word) => h("li", {}, [word])));
    const checkbox = h("input", { type: "checkbox", id: "confirm-saved" }) as HTMLInputElement;
    const continueBtn = h("button", { disabled: "true", onclick: () => showNameEntry(false) }, [t("action_continue")]) as HTMLButtonElement;
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
    const wordsInput = h("textarea", { rows: "3", placeholder: t("onboarding_seed_input_label") }) as HTMLTextAreaElement;
    const error = h("p", { class: "error" });
    mount(
      container,
      h("h2", {}, [t("onboarding_restore_title")]),
      h("p", { class: "body-medium" }, [t("onboarding_restore_explainer")]),
      h("label", {}, [t("onboarding_seed_input_label"), h("br"), wordsInput]),
      error,
      h("button", {
        onclick: async () => {
          const words = wordsInput.value.trim().split(/\s+/);
          const ok = await identityStore.restore(words, "My browser");
          if (!ok) {
            error.textContent = t("join_error_title");
            return;
          }
          showNameEntry(false);
        },
      }, [t("action_create")]),
      h("button", { class: "text", onclick: showChoice }, [t("action_back")]),
    );
  };

  const showRestoreBackup = (): void => {
    const fileInput = h("input", { type: "file", accept: ".squaddle-backup" }) as HTMLInputElement;
    const passphraseInput = h("input", { type: "password", placeholder: t("settings_passphrase_label") }) as HTMLInputElement;
    const error = h("p", { class: "error" });
    mount(
      container,
      h("h2", {}, [t("onboarding_have_backup_file")]),
      h("p", { class: "body-medium" }, [t("onboarding_backup_passphrase_explainer")]),
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
          await identityStore.restoreFromEntropy(restored.entropy, "My browser");
          const knownRooms = new KnownRoomsStore();
          const now = Date.now();
          for (const room of restored.rooms) {
            await knownRooms.upsert({
              roomId: room.roomId, displayName: room.name ?? t("default_room_name"),
              relayHost: room.relayHost, joinedAt: now, lastActivityAt: now,
            });
          }
          showNameEntry(restored.rooms.length > 0);
        },
      }, [t("action_continue")]),
      h("button", { class: "text", onclick: showChoice }, [t("action_back")]),
    );
  };

  const showLinkDevice = async (): Promise<void> => {
    let cancelled = false;
    const backToChoice = (): void => {
      cancelled = true;
      showChoice();
    };

    const generated = await generateLink(getRelayHost());
    const qrCanvas = await renderLinkQr(generated.qr.uri);
    const status = h("p", { class: "body-medium" }, [t("link_waiting")]);
    mount(
      container,
      h("h2", {}, [t("link_title")]),
      h("p", { class: "body-medium" }, [t("link_explainer")]),
      qrCanvas,
      status,
      h("button", { class: "text", onclick: backToChoice }, [t("action_back")]),
    );

    const deadline = Date.now() + 5 * 60 * 1000; // mailbox TTL, relay/internal/api/link.go's linkMailboxTTL
    const poll = async (): Promise<void> => {
      if (cancelled) return;
      if (Date.now() > deadline) {
        status.textContent = t("link_expired");
        mount(
          container,
          h("h2", {}, [t("link_title")]),
          status,
          h("button", { onclick: () => void showLinkDevice() }, [t("link_generate_new")]),
          h("button", { class: "text", onclick: backToChoice }, [t("action_back")]),
        );
        return;
      }
      const identity = await pollForLinkedIdentity(generated.qr, generated.ephemeralSecretKey);
      if (cancelled) return;
      if (!identity) {
        setTimeout(() => void poll(), 2000);
        return;
      }

      const code = await confirmationCode(generated.qr.ephemeralPublicKey, identity.userKey);
      await identityStore.restoreFromEntropy(identity.entropy, "My browser");
      const knownRooms = new KnownRoomsStore();
      const now = Date.now();
      for (const room of identity.rooms) {
        await knownRooms.upsert({
          roomId: room.roomId, displayName: room.name ?? t("default_room_name"),
          relayHost: room.relayHost, joinedAt: now, lastActivityAt: now,
        });
      }

      mount(
        container,
        h("h2", {}, [t("link_confirm_title")]),
        h("p", { class: "body-medium" }, [t("link_confirm_explainer")]),
        h("p", { class: "display-small", style: "text-align:center;letter-spacing:4px;" }, [code]),
        h("button", { onclick: () => showNameEntry(identity.rooms.length > 0) }, [t("action_continue")]),
      );
    };
    void poll();
  };

  showChoice();
  return container;
}
