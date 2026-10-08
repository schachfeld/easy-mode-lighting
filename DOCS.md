# Using Glow

Start the app and enable **Show in sidebar**. Open **Glow** from the Home Assistant sidebar.

Glow's sidebar entry is available to all Home Assistant users, including non-admins. If an older installation only shows it to admins, set `panel_admin: false` in Glow's app `config.yaml`, reload the app store, and turn **Show in sidebar** off and on again. Refresh the other users' browsers or companion apps. Users who previously hid Glow in their sidebar may also need to unhide it in their profile's sidebar settings.

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
