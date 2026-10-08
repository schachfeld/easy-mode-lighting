# Using Glow

Start the app and enable **Show in sidebar**. Open **Glow** from the Home Assistant sidebar.

Glow's app configuration sets `panel_admin: false` so its sidebar entry is available to all Home Assistant users, including non-admins.

For an existing local installation that only shows Glow to admins:

1. Confirm the installed source file at `/local_apps/glow/config.yaml` (or `/addons/glow/config.yaml` on older versions) contains `panel_admin: false`. Editing a copy on another computer does not update Home Assistant's installation.
2. Open **Settings → Apps → App store → ⋮ → Check for updates**. On older versions, use **Add-ons → Add-on store**. Do this before rebuilding so Supervisor reads the changed app configuration into its store cache.
3. Open the installed Glow app and select **Rebuild** from its menu. Rebuilding copies the store's cached configuration to the installed app; refreshing the store alone does not update the installed configuration.
4. Turn **Show in sidebar** off and on again, then refresh the affected users' browsers or companion apps.

For a repository installation, install a published Glow update containing the sidebar change instead of editing a local app folder.

If Glow is still missing for a user, open that user's profile and edit the sidebar visibility settings to check whether they previously hid it. On a desktop browser, an admin can also inspect the active panel setting in the browser's developer console:

```js
Object.values(document.querySelector("home-assistant").hass.panels)
  .filter((panel) => panel.config?.addon?.includes("glow"))
  .map((panel) => ({
    path: panel.url_path,
    adminOnly: panel.require_admin,
  }));
```

Glow should report `adminOnly: false`. If it reports `true`, the active panel still has the old restriction; check the source file and repeat the store refresh, rebuild, and sidebar toggle in that order. If it reports `false`, check the affected user's sidebar settings and reload their session.

## Your rooms

Glow uses the Areas already set up in Home Assistant. Assign your light devices to Areas under **Settings → Areas, labels & zones** to organize the room view. You can override the Area on individual light entities. Unassigned lights appear in **Other lights**. Hidden and disabled light entities are excluded.

Tap a room to see its scenes and lights. Use the switch to turn the room on or off and the brightness slider to adjust it. Moving a slider turns the affected lights on. Tap **Adjust light** to change an individual bulb’s color or white temperature. Controls only appear for capabilities that the bulb supports.

## Your scenes

1. Open a room and select **Create scene**.
2. Give the scene a name.
3. Choose a mood palette, or select **Use current lights** to capture the room as it is now.
4. Adjust individual lights if you like. An off switch means the scene will turn that light off.
5. Select **Save scene**. Tap its card whenever you want that look.

The editor does not change your physical lights while you are designing a scene. Saving creates the scene; tapping it applies it. A scene can include lights that should stay off.

Tap a heart to put a scene on the home screen. Tap the pencil to rename, adjust, or delete a Glow scene. Your scenes are available on every device and survive restarts.

Scenes already created in Home Assistant appear automatically when their Area or member lights identify a room. Scenes spanning multiple rooms appear in **All scenes**. Edit these scenes in Home Assistant.

## Storage and backups

Glow stores scenes in its persistent `/data` directory. Include this app in your Home Assistant backups. Glow scenes are local to this app and do not become Home Assistant scene entities for automations.

## If something looks wrong

- **No rooms:** check that Home Assistant has `light.*` entities. Devices exposed only as switches are not lighting entities.
- **A light is in Other lights:** assign the device or light entity to an Area in Home Assistant.
- **Unavailable light:** check the physical switch and the integration that provides the light. Glow does not pretend an unavailable bulb has responded.
- **Reconnecting:** the app reconnects automatically after Home Assistant restarts. Controls are disabled while disconnected; your saved scenes remain.
- **A scene won’t apply:** if one of its lights was removed or is unavailable, reconnect the bulb or edit the scene. Editing removes bulbs that no longer exist in the room.
- **Existing scene has no room:** Home Assistant must expose its Area or member light entities. Otherwise it remains available in All scenes.
- **Connection error persists:** restart the app and check its logs. App authentication is provided automatically by Home Assistant Supervisor.

Glow requires no configuration options and no publicly exposed network port.
