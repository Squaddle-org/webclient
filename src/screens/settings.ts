import { IdentityApi } from "core";
import { h, mount } from "../dom";
import { t, getLang, setLang } from "../i18n";
import { linkClick, type Navigate } from "../navigation";
import type { IdentityStore } from "../identity/identity-store";
import { createBackupFile, restoreBackupFile } from "../settings/backup";
import { disablePush, enablePush, pushEnabled, pushSupported } from "../settings/push";
import { getDisplayName, setDisplayName } from "../storage/display-name-pref";
import { getRelayHost, setRelayHost } from "../storage/relay-host-pref";
import { KnownRoomsStore } from "../rooms/known-rooms-store";
import type { RoomSessionOrchestrator } from "../relay/room-session";

/** [resetSession] mirrors `app.ts`'s own "force a fresh session against the new host" reset
 * (same as the relay-host field used to do inline in the rooms list before this screen existed). */
export async function renderSettings(session: RoomSessionOrchestrator, identityStore: IdentityStore, resetSession: () => void, navigate: Navigate): Promise<HTMLElement> {
  const container = h("div", { class: "screen settings" });
  const identity = await identityStore.load();

  const seedSection = h("div", {});
  const renderSeedSection = (): void => {
    mount(
      seedSection,
      h("h2", {}, [t("settings_recovery_seed")]),
      h("p", { class: "body-medium" }, [t("settings_seed_warning")]),
      h("button", {
        class: "secondary",
        onclick: async () => {
          if (!identity) return;
          const entropy = new Int8Array(identity.entropy.buffer as ArrayBuffer, identity.entropy.byteOffset, identity.entropy.byteLength);
          const words = await IdentityApi.getInstance().entropyToMnemonic(entropy);
          mount(seedSection, h("h2", {}, [t("settings_recovery_seed")]), h("ol", { class: "card" }, words.map((w) => h("li", {}, [w]))), h("button", { class: "text", onclick: renderSeedSection }, [t("settings_hide")]));
        },
      }, [t("settings_reveal_seed")]),
    );
  };
  renderSeedSection();

  const backupSection = h("div", {});
  const backupError = h("p", { class: "error" });
  const renderBackupSection = (): void => {
    const createPassphrase = h("input", { type: "password", placeholder: t("settings_passphrase_label") }) as HTMLInputElement;
    const restoreFile = h("input", { type: "file", accept: ".squaddle-backup" }) as HTMLInputElement;
    const restorePassphrase = h("input", { type: "password", placeholder: t("settings_passphrase_label") }) as HTMLInputElement;
    mount(
      backupSection,
      h("h2", {}, [t("settings_backup")]),
      h("p", { class: "body-medium" }, [t("settings_backup_explainer")]),
      h("div", { class: "row" }, [
        createPassphrase,
        h("button", {
          onclick: async () => {
            if (!identity) return;
            await createBackupFile(identity, await session.listKnownRooms(), createPassphrase.value);
          },
        }, [t("settings_create_backup")]),
      ]),
      h("h2", {}, [t("settings_restore")]),
      h("p", { class: "body-medium" }, [t("settings_restore_explainer")]),
      h("div", { class: "row" }, [
        restoreFile,
        restorePassphrase,
        h("button", {
          class: "secondary",
          onclick: async () => {
            const file = restoreFile.files?.[0];
            if (!file) return;
            const restored = await restoreBackupFile(file, restorePassphrase.value);
            if (!restored) {
              backupError.textContent = t("join_error_title");
              return;
            }
            const now = Date.now();
            const knownRooms = new KnownRoomsStore();
            for (const room of restored.rooms) {
              await knownRooms.upsert({ roomId: room.roomId, displayName: room.name ?? t("default_room_name"), relayHost: room.relayHost, joinedAt: now, lastActivityAt: now });
            }
            backupError.textContent = "";
            navigate({ kind: "rooms" });
          },
        }, [t("settings_restore_from_backup")]),
      ]),
      backupError,
    );
  };
  renderBackupSection();

  const pushSection = h("div", {});
  const renderPushSection = async (): Promise<void> => {
    if (!pushSupported()) {
      mount(pushSection, h("h2", {}, [t("settings_push")]), h("p", { class: "body-medium" }, [t("settings_push_unsupported")]));
      return;
    }
    const enabled = await pushEnabled();
    mount(
      pushSection,
      h("h2", {}, [t("settings_push")]),
      h("p", { class: "body-medium" }, [t("settings_push_explainer")]),
      h("button", {
        class: enabled ? "destructive" : "",
        onclick: async () => {
          if (enabled) await disablePush(session);
          else await enablePush(session);
          await renderPushSection();
        },
      }, [enabled ? t("settings_push_disable") : t("settings_push_enable")]),
    );
  };
  void renderPushSection();

  const profileSection = h("div", {});
  const renderProfileSection = (): void => {
    const nameInput = h("input", { type: "text", value: getDisplayName() ?? "" }) as HTMLInputElement;
    mount(
      profileSection,
      h("h2", {}, [t("settings_profile_name")]),
      h("div", { class: "row" }, [
        nameInput,
        h("button", {
          onclick: async () => {
            const name = nameInput.value.trim();
            if (!name) return;
            setDisplayName(name);
            await session.setDisplayNameEverywhere(name);
          },
        }, [t("settings_profile_save")]),
      ]),
    );
  };
  renderProfileSection();

  const relaySection = h("div", {});
  const renderRelaySection = (): void => {
    const hostInput = h("input", { type: "text", value: getRelayHost() }) as HTMLInputElement;
    mount(
      relaySection,
      h("h2", {}, [t("settings_relay_host")]),
      h("div", { class: "row" }, [
        hostInput,
        h("button", {
          class: "secondary",
          onclick: () => {
            setRelayHost(hostInput.value);
            resetSession();
            navigate({ kind: "rooms" });
          },
        }, [t("action_save")]),
      ]),
    );
  };
  renderRelaySection();

  const langSection = h("div", { class: "row" }, [
    h("button", { class: getLang() === "en" ? "" : "secondary", onclick: () => { setLang("en"); navigate({ kind: "settings" }); } }, ["EN"]),
    h("button", { class: getLang() === "de" ? "" : "secondary", onclick: () => { setLang("de"); navigate({ kind: "settings" }); } }, ["DE"]),
  ]);

  mount(
    container,
    h("a", { href: "/rooms", onclick: linkClick(() => navigate({ kind: "rooms" })) }, [`← ${t("rooms_title")}`]),
    h("h1", {}, [t("settings_title")]),
    langSection,
    profileSection,
    relaySection,
    pushSection,
    seedSection,
    backupSection,
  );
  return container;
}
