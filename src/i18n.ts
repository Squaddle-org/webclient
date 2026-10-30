/**
 * Minimal i18n: a flat `{en, de}` dictionary with the exact same keys and copy as android's
 * `values/strings.xml`/`values-de/strings.xml` (Phase H's localization work) - reused verbatim,
 * not re-translated, so the two clients actually say the same thing. Not every key is wired up
 * yet (android-only concepts like self-update/notification channels have no web screen to put
 * them on - see webclient/README.md's parity table), but the dictionary stays complete so a
 * future screen can pull the right key instead of inventing new copy.
 */

export type Lang = "en" | "de";

const STRINGS: Record<string, Record<Lang, string>> = {
  app_name: { en: "Squaddle", de: "Squaddle" },

  action_continue: { en: "Continue", de: "Weiter" },
  action_back: { en: "Back", de: "Zurück" },
  action_join: { en: "Join", de: "Beitreten" },
  action_cancel: { en: "Cancel", de: "Abbrechen" },
  action_ok: { en: "OK", de: "OK" },
  action_dismiss: { en: "Dismiss", de: "Verwerfen" },
  action_open: { en: "Open", de: "Öffnen" },
  action_create: { en: "Create", de: "Erstellen" },
  action_delete: { en: "Delete", de: "Löschen" },
  action_save: { en: "Save", de: "Speichern" },
  action_done: { en: "Done", de: "Fertig" },
  action_discard: { en: "Discard", de: "Verwerfen" },
  action_keep_editing: { en: "Keep editing", de: "Weiter bearbeiten" },
  discard_changes_title: { en: "Discard changes?", de: "Änderungen verwerfen?" },
  discard_changes_body: { en: "You have unsaved changes that will be lost.", de: "Du hast ungespeicherte Änderungen, die verloren gehen." },
  default_room_name: { en: "Squaddle room", de: "Squaddle-Raum" },

  tier_free: { en: "Free", de: "Kostenlos" },
  tier_boosted: { en: "Boosted", de: "Geboostet" },
  tier_unlimited: { en: "Unlimited", de: "Unbegrenzt" },

  notification_channel_idea: { en: "New ideas", de: "Neue Ideen" },
  notification_channel_comment: { en: "New comments", de: "Neue Kommentare" },
  notification_channel_event: { en: "New events", de: "Neue Termine" },
  notification_channel_rsvp: { en: "RSVP updates", de: "Zusagen-Updates" },
  notification_channel_membership: { en: "Role changes", de: "Rollenänderungen" },
  notification_channel_pending_approval: { en: "Pending approvals", de: "Ausstehende Genehmigungen" },

  notification_new_idea: { en: "New idea in %1$s", de: "Neue Idee in %1$s" },
  notification_new_comment: { en: "New comment in %1$s", de: "Neuer Kommentar in %1$s" },
  notification_new_event: { en: "New event in %1$s", de: "Neuer Termin in %1$s" },
  notification_new_rsvp: { en: "New RSVP in %1$s", de: "Neue Zusage in %1$s" },
  notification_role_changed: { en: "Your role changed in %1$s", de: "Deine Rolle in %1$s hat sich geändert" },
  notification_kicked: { en: "You were removed from %1$s", de: "Du wurdest aus %1$s entfernt" },
  notification_pending_approval: { en: "Someone wants to join %1$s", de: "Jemand möchte %1$s beitreten" },
  notification_group_summary: { en: "%1$d new update(s) in %2$s", de: "%1$d neue Aktualisierung(en) in %2$s" },

  push_install_ntfy_hint: {
    en: "Install ntfy for instant updates - without it, Squaddle checks for new activity every few hours.",
    de: "Installiere ntfy für sofortige Updates - ohne ntfy prüft Squaddle nur alle paar Stunden auf neue Aktivität.",
  },
  push_install_ntfy_action: { en: "Install", de: "Installieren" },

  outbox_pending_hint: { en: "%1$d change(s) waiting to sync - check your connection.", de: "%1$d Änderung(en) warten auf Synchronisierung - prüfe deine Verbindung." },

  onboarding_tagline: {
    en: "No accounts, no passwords. Your identity is a seed phrase only you hold.",
    de: "Keine Konten, keine Passwörter. Deine Identität ist nur eine Seed-Phrase, die nur du besitzt.",
  },
  onboarding_create_identity: { en: "Create a new identity", de: "Neue Identität erstellen" },
  onboarding_have_seed: { en: "I already have a seed phrase", de: "Ich habe bereits eine Seed-Phrase" },
  onboarding_have_backup_file: { en: "Restore from a backup file", de: "Aus einer Sicherungsdatei wiederherstellen" },
  onboarding_backup_passphrase_title: { en: "Enter the backup's passphrase", de: "Passphrase der Sicherung eingeben" },
  onboarding_backup_passphrase_explainer: {
    en: "This recovers your identity and imports the room list stored in the backup - including rooms on a different relay, which a seed phrase alone can't do.",
    de: "Dies stellt deine Identität wieder her und importiert die in der Sicherung gespeicherte Raumliste - auch Räume auf einem anderen Relay, was mit einer reinen Seed-Phrase nicht möglich ist.",
  },
  onboarding_seed_title: { en: "Your recovery phrase", de: "Deine Wiederherstellungsphrase" },
  onboarding_seed_warning: {
    en: "Write these 24 words down somewhere safe. Anyone with this phrase can access every room you're in.",
    de: "Schreibe diese 24 Wörter an einem sicheren Ort auf. Jeder mit dieser Phrase kann auf alle deine Räume zugreifen.",
  },
  onboarding_wrote_it_down: { en: "I wrote it down", de: "Ich habe sie aufgeschrieben" },
  onboarding_restore_title: { en: "Enter your recovery phrase", de: "Wiederherstellungsphrase eingeben" },
  onboarding_restore_explainer: {
    en: "This recovers your identity and rejoins every room on your default relay that you're still a member of. Rooms hosted on a different relay will need a fresh invite link.",
    de: "Dies stellt deine Identität wieder her und tritt allen Räumen auf deinem Standard-Relay erneut bei, in denen du noch Mitglied bist. Räume auf einem anderen Relay benötigen einen neuen Einladungslink.",
  },
  onboarding_seed_input_label: { en: "24 words, separated by spaces", de: "24 Wörter, durch Leerzeichen getrennt" },
  onboarding_name_title: { en: "What should we call you?", de: "Wie sollen wir dich nennen?" },
  onboarding_name_explainer: {
    en: "Your display name is shown to other room members - it's not part of your identity.",
    de: "Dein Anzeigename wird anderen Mitgliedern des Raums angezeigt - er ist nicht Teil deiner Identität.",
  },
  onboarding_display_name_label: { en: "Display name", de: "Anzeigename" },
  onboarding_finish_restoring: { en: "Finish restoring", de: "Wiederherstellung abschließen" },
  onboarding_finish: { en: "Finish", de: "Fertigstellen" },

  join_confirm_title: { en: "Join this room?", de: "Diesem Raum beitreten?" },
  join_error_title: { en: "Couldn't open this invite", de: "Einladung konnte nicht geöffnet werden" },
  join_clipboard_banner: { en: "Open invite from clipboard?", de: "Einladung aus der Zwischenablage öffnen?" },

  members_title: { en: "Members", de: "Mitglieder" },
  members_pending_approval: { en: "Pending approval", de: "Ausstehende Genehmigung" },
  members_action_failed_title: { en: "Action failed", de: "Aktion fehlgeschlagen" },
  members_reject: { en: "Reject", de: "Ablehnen" },
  members_approve: { en: "Approve", de: "Genehmigen" },
  members_promote: { en: "Promote to admin", de: "Zum Admin befördern" },
  members_demote: { en: "Demote to member", de: "Zum Mitglied zurückstufen" },
  members_transfer_ownership: { en: "Transfer ownership", de: "Besitz übertragen" },
  members_remove: { en: "Remove from room", de: "Aus dem Raum entfernen" },
  role_owner: { en: "Owner", de: "Besitzer" },
  role_admin: { en: "Admin", de: "Admin" },
  role_member: { en: "Member", de: "Mitglied" },
  role_pending: { en: "Pending", de: "Ausstehend" },

  invite_title: { en: "Invite", de: "Einladen" },
  invite_error_title: { en: "Couldn't create invite", de: "Einladung konnte nicht erstellt werden" },
  invite_require_approval: { en: "Require approval", de: "Genehmigung erforderlich" },
  invite_require_approval_explainer: { en: "New joiners wait for an admin to approve them.", de: "Neue Mitglieder warten auf die Genehmigung durch einen Admin." },
  invite_max_uses_label: { en: "Max uses (optional)", de: "Max. Nutzungen (optional)" },
  invite_create: { en: "Create invite", de: "Einladung erstellen" },
  invite_expires: { en: "Expires", de: "Läuft ab" },
  invite_expiry_never: { en: "Never", de: "Nie" },
  invite_expiry_1_day: { en: "1 day", de: "1 Tag" },
  invite_expiry_7_days: { en: "7 days", de: "7 Tage" },
  invite_expiry_30_days: { en: "30 days", de: "30 Tage" },
  invite_ready_title: { en: "Invite ready", de: "Einladung bereit" },
  invite_ready_explainer: { en: "Share this link - whoever opens it can join the room.", de: "Teile diesen Link - wer ihn öffnet, kann dem Raum beitreten." },
  invite_share: { en: "Share invite link", de: "Einladungslink teilen" },
  invite_create_another: { en: "Create another invite", de: "Weitere Einladung erstellen" },

  rooms_title: { en: "Rooms", de: "Räume" },
  rooms_developer_settings: { en: "Developer settings", de: "Entwicklereinstellungen" },
  rooms_create: { en: "Create room", de: "Raum erstellen" },
  rooms_create_error_title: { en: "Couldn't create room", de: "Raum konnte nicht erstellt werden" },
  rooms_empty_title: { en: "No rooms yet", de: "Noch keine Räume" },
  rooms_empty_explainer: { en: "Create a room, or open an invite link someone shared with you.", de: "Erstelle einen Raum oder öffne einen Einladungslink, den dir jemand geschickt hat." },
  rooms_create_dialog_title: { en: "Create a room", de: "Einen Raum erstellen" },
  rooms_name_label: { en: "Room name", de: "Raumname" },

  room_mute: { en: "Mute notifications", de: "Benachrichtigungen stummschalten" },
  room_unmute: { en: "Unmute notifications", de: "Benachrichtigungen aktivieren" },
  room_redeem_voucher: { en: "Redeem voucher", de: "Gutschein einlösen" },
  room_new_idea: { en: "New idea", de: "Neue Idee" },
  room_new_idea_title: { en: "New idea", de: "Neue Idee" },
  room_new_event: { en: "New event", de: "Neuer Termin" },
  room_new_event_title: { en: "New event", de: "Neuer Termin" },
  room_tab_ideas: { en: "Ideas", de: "Ideen" },
  room_tab_events: { en: "Events", de: "Termine" },
  room_no_ideas_title: { en: "No ideas yet", de: "Noch keine Ideen" },
  room_no_ideas_hint: { en: "Tap + to suggest one.", de: "Tippe auf +, um eine vorzuschlagen." },
  room_no_events_title: { en: "No events yet", de: "Noch keine Termine" },
  room_no_events_hint: { en: "Turn an idea into an event, or tap + to create one.", de: "Mache aus einer Idee einen Termin, oder tippe auf +, um einen zu erstellen." },
  room_upvote: { en: "Upvote", de: "Hochstimmen" },
  room_downvote: { en: "Downvote", de: "Herunterstimmen" },
  room_back_to_ideas: { en: "Back to ideas", de: "Zurück zu den Ideen" },
  room_edit_idea: { en: "Edit idea", de: "Idee bearbeiten" },
  room_delete_idea: { en: "Delete idea", de: "Idee löschen" },
  room_make_this_an_event: { en: "Make this an event", de: "Daraus einen Termin machen" },
  room_comments: { en: "Comments", de: "Kommentare" },
  room_delete_comment: { en: "Delete comment", de: "Kommentar löschen" },
  room_add_comment_label: { en: "Add a comment", de: "Kommentar hinzufügen" },
  room_post_comment: { en: "Post", de: "Posten" },
  room_edit_idea_title: { en: "Edit idea", de: "Idee bearbeiten" },
  room_delete_idea_confirm_title: { en: "Delete this idea?", de: "Diese Idee löschen?" },
  room_delete_confirm_body: { en: "This can't be undone.", de: "Dies kann nicht rückgängig gemacht werden." },
  room_title_label: { en: "Title", de: "Titel" },
  room_description_optional_label: { en: "Description (optional)", de: "Beschreibung (optional)" },
  room_location_optional_label: { en: "Location (optional)", de: "Ort (optional)" },
  room_all_day: { en: "All day", de: "Ganztägig" },
  room_add_to_calendar: { en: "Add to calendar", de: "Zum Kalender hinzufügen" },
  room_share_event: { en: "Share event", de: "Termin teilen" },
  room_cancel_event: { en: "Cancel event", de: "Termin absagen" },
  room_cancel_event_confirm_title: { en: "Cancel this event?", de: "Diesen Termin absagen?" },
  room_keep_it: { en: "Keep it", de: "Beibehalten" },
  room_rsvp_yes: { en: "Yes (%1$d)", de: "Ja (%1$d)" },
  room_rsvp_maybe: { en: "Maybe (%1$d)", de: "Vielleicht (%1$d)" },
  room_rsvp_no: { en: "No (%1$d)", de: "Nein (%1$d)" },

  settings_title: { en: "Settings", de: "Einstellungen" },
  settings_recovery_seed: { en: "Recovery seed", de: "Wiederherstellungs-Seed" },
  settings_seed_warning: { en: "Anyone with these 24 words can fully recover your account - never share them.", de: "Jeder mit diesen 24 Wörtern kann dein Konto vollständig wiederherstellen - teile sie niemals." },
  settings_hide: { en: "Hide", de: "Verbergen" },
  settings_reveal_seed: { en: "Reveal seed", de: "Seed anzeigen" },
  settings_backup: { en: "Backup", de: "Sicherung" },
  settings_backup_explainer: { en: "Save an encrypted copy of your seed and room list to a file on this device.", de: "Speichere eine verschlüsselte Kopie deines Seeds und deiner Raumliste als Datei auf diesem Gerät." },
  settings_create_backup: { en: "Create backup", de: "Sicherung erstellen" },
  settings_restore: { en: "Restore", de: "Wiederherstellen" },
  settings_restore_explainer: { en: "Import the room list from a backup file for this same account.", de: "Importiere die Raumliste aus einer Sicherungsdatei für dasselbe Konto." },
  settings_restore_from_backup: { en: "Restore from backup", de: "Aus Sicherung wiederherstellen" },
  settings_automatic_backups: { en: "Automatic backups", de: "Automatische Sicherungen" },
  settings_software_update: { en: "Software update", de: "Software-Update" },
  settings_software_update_explainer: { en: "Squaddle never checks for updates on its own - tap below to check manually.", de: "Squaddle sucht nie von sich aus nach Updates - tippe unten, um manuell zu prüfen." },
  settings_check_for_update: { en: "Check for updates", de: "Nach Updates suchen" },
  settings_update_up_to_date: { en: "You're on the latest version.", de: "Du hast die neueste Version." },
  settings_update_check_failed: { en: "Couldn't check for updates: %1$s", de: "Update-Prüfung fehlgeschlagen: %1$s" },
  settings_update_available_title: { en: "Version %1$s is available", de: "Version %1$s ist verfügbar" },
  settings_download_and_install: { en: "Download & install", de: "Herunterladen & installieren" },
  settings_interval_hours_label: { en: "Interval (hours)", de: "Intervall (Stunden)" },
  settings_passphrase_label: { en: "Passphrase", de: "Passphrase" },
  settings_show_passphrase: { en: "Show passphrase", de: "Passphrase anzeigen" },
  settings_hide_passphrase: { en: "Hide passphrase", de: "Passphrase verbergen" },
  settings_protect_backup_title: { en: "Protect this backup", de: "Diese Sicherung schützen" },
  settings_enter_backup_passphrase_title: { en: "Enter the backup's passphrase", de: "Passphrase der Sicherung eingeben" },
  settings_choose_auto_backup_passphrase_title: { en: "Choose a passphrase for automatic backups", de: "Passphrase für automatische Sicherungen wählen" },
  settings_enable: { en: "Enable", de: "Aktivieren" },
  settings_push: { en: "Push notifications", de: "Push-Benachrichtigungen" },
  settings_push_explainer: { en: "Get notified about new activity even when this tab isn't open.", de: "Erhalte Benachrichtigungen über neue Aktivität, auch wenn dieser Tab nicht offen ist." },
  settings_push_enable: { en: "Enable push notifications", de: "Push-Benachrichtigungen aktivieren" },
  settings_push_disable: { en: "Disable push notifications", de: "Push-Benachrichtigungen deaktivieren" },
  settings_push_unsupported: { en: "Push notifications aren't supported in this browser.", de: "Push-Benachrichtigungen werden in diesem Browser nicht unterstützt." },
  settings_relay_host: { en: "Relay host", de: "Relay-Host" },
  settings_profile_name: { en: "Display name", de: "Anzeigename" },
  settings_profile_save: { en: "Save name", de: "Namen speichern" },
  settings_limits: { en: "Room limits", de: "Raumlimits" },

  voucher_title: { en: "Redeem voucher", de: "Gutschein einlösen" },
  voucher_explainer: { en: "Enter a voucher code to boost this room.", de: "Gib einen Gutscheincode ein, um diesen Raum zu boosten." },
  voucher_code_label: { en: "Voucher code", de: "Gutscheincode" },
  voucher_redeem: { en: "Redeem", de: "Einlösen" },
  voucher_error_title: { en: "Couldn't redeem voucher", de: "Gutschein konnte nicht eingelöst werden" },
  voucher_new_tier: { en: "This room is now tier: %1$s", de: "Dieser Raum ist jetzt Stufe: %1$s" },
};

const STORAGE_KEY = "squaddle.lang";

function detectLang(): Lang {
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

let currentLang: Lang = (localStorage.getItem(STORAGE_KEY) as Lang | null) ?? detectLang();
document.documentElement.lang = currentLang;

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
}

/** `%1$s`/`%1$d`/`%2$s`-style placeholders (android's own format, reused verbatim) - [args] fill
 * them in order, `%1$...` first, `%2$...` second, etc. Unknown keys return the key itself rather
 * than throwing, so a typo is visible instead of crashing the screen. */
export function t(key: string, ...args: (string | number)[]): string {
  const entry = STRINGS[key];
  const template = entry ? entry[currentLang] : key;
  return template.replace(/%(\d)\$[sd]/g, (_, index: string) => String(args[Number(index) - 1] ?? ""));
}
