// Only collapse groups whose complete membership can be resolved to visible
// lights in one room. Unknown, hidden, cyclic and cross-room membership stays
// visible as before; guessing here could silently hide a control.
export function splitLightGroups(lights, states, preferences = {}) {
  const byId = new Map(lights.map((light) => [light.id, light]));
  function resolve(id, path = new Set()) {
    if (!byId.has(id) || path.has(id) || path.size > 64) return null;
    const members = states[id]?.attributes?.entity_id;
    if (members === undefined) return [id];
    if (!Array.isArray(members) || !members.length) return null;
    const nextPath = new Set([...path, id]);
    const leaves = [];
    for (const member of members) {
      const result = resolve(member, nextPath);
      if (!result) return null;
      leaves.push(...result);
    }
    const unique = [...new Set(leaves)];
    const roomId = byId.get(unique[0]).roomId;
    if (
      unique.some((member) => byId.get(member).roomId !== roomId) ||
      (byId.get(id).roomId !== "unassigned" && byId.get(id).roomId !== roomId)
    )
      return null;
    return unique;
  }

  const groups = [];
  for (const light of lights) {
    if (!Array.isArray(states[light.id]?.attributes?.entity_id)) continue;
    const memberIds = resolve(light.id);
    if (!memberIds?.length) continue;
    const members = memberIds.map((id) => byId.get(id));
    const roomId = members[0].roomId;
    const available = members.filter((member) => member.available);
    const on = available.filter((member) => member.on);
    const dimmable = on.filter((member) => member.dimmable);
    groups.push({
      ...light,
      roomId,
      memberIds,
      display:
        preferences?.[light.id] === "individual" ? "individual" : "group",
      available: available.length > 0,
      on: on.length > 0,
      brightness: dimmable.length
        ? Math.round(
            dimmable.reduce((sum, member) => sum + member.brightness, 0) /
              dimmable.length,
          )
        : light.brightness,
      dimmable: members.some((member) => member.dimmable),
      colorSupported: members.some((member) => member.colorSupported),
      temperatureSupported: members.some(
        (member) => member.temperatureSupported,
      ),
    });
  }
  const groupIds = new Set(groups.map((group) => group.id));
  return { lights: lights.filter((light) => !groupIds.has(light.id)), groups };
}

export function lightTargets(home, ids) {
  const groups = new Map((home.groups ?? []).map((group) => [group.id, group]));
  const targets = new Set(
    ids.flatMap((id) => groups.get(id)?.memberIds ?? [id]),
  );
  const lights = new Map(home.lights.map((light) => [light.id, light]));
  return [...targets].map((id) => {
    const light = lights.get(id);
    if (!light)
      throw new Error(
        "One of these lights no longer exists. Refresh and try again.",
      );
    return light;
  });
}

// Existing scenes can contain a helper and its members. Apply broad group
// settings first, then more specific groups, then explicit individual settings.
export function expandSceneLights(home, settings) {
  const groups = new Map((home.groups ?? []).map((group) => [group.id, group]));
  const entries = Object.entries(settings).sort(
    ([a], [b]) =>
      (groups.get(b)?.memberIds.length ?? 0) -
        (groups.get(a)?.memberIds.length ?? 0) || a.localeCompare(b),
  );
  const result = new Map();
  for (const [id, value] of entries)
    for (const memberId of groups.get(id)?.memberIds ?? [id])
      result.set(memberId, { ...result.get(memberId), ...value });
  return Object.fromEntries(result);
}

export function roomLightLayout(home, roomId) {
  const lights = home.lights.filter((light) => light.roomId === roomId);
  const candidates = (home.groups ?? [])
    .filter((group) => group.roomId === roomId && group.display === "group")
    .sort(
      (a, b) =>
        b.memberIds.length - a.memberIds.length || a.id.localeCompare(b.id),
    );
  // A selected outer group contains selected nested groups. Equal memberships
  // use one stable representative. Partially overlapping groups stay expanded.
  const outer = candidates.filter(
    (group, index) =>
      !candidates
        .slice(0, index)
        .some((parent) =>
          group.memberIds.every((id) => parent.memberIds.includes(id)),
        ),
  );
  const overlapping = outer.filter((group) =>
    outer.some(
      (other) =>
        other !== group &&
        other.memberIds.some((id) => group.memberIds.includes(id)),
    ),
  );
  const grouped = outer.filter((group) => !overlapping.includes(group));
  const owners = new Map(
    grouped.flatMap((group) => group.memberIds.map((id) => [id, group])),
  );
  const added = new Set();
  const items = [];
  for (const light of lights) {
    const item = owners.get(light.id) ?? light;
    if (!added.has(item.id)) {
      added.add(item.id);
      items.push(item);
    }
  }
  return { items, overlapping };
}
