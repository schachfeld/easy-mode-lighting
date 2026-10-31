import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { averageBrightness } from "../packages/core/groups.mjs";
import type { Home, Light, LightSettings } from "./types";

type Settings = Partial<LightSettings>;
type Override = { settings: Settings; until: number; settled: boolean };
type Waiter = (ok: boolean) => void;
type Channel = {
  busy: boolean;
  next?: { settings: Settings; waiters: Waiter[] };
};

// Keep the expected state on screen while Home Assistant catches up.
const pendingMs = 10000;
const settleMs = 1500;
// Bulbs, bridges and Zigbee meshes cannot keep up with every pixel of a drag.
const minIntervalMs = 100;

export function mergeSettings(previous: Settings, next: Settings): Settings {
  return next.on === false ? { on: false } : { ...previous, ...next };
}

function apply(light: Light, settings: Settings): Light {
  return settings.on === false
    ? { ...light, on: false }
    : { ...light, ...settings, on: settings.on ?? light.on };
}

function matches(light: Light, settings: Settings) {
  if (settings.on !== undefined && light.on !== settings.on) return false;
  if (!light.on) return true;
  return (
    (settings.brightness === undefined ||
      !light.dimmable ||
      Math.abs(light.brightness - settings.brightness) <= 2) &&
    (settings.colorMode === undefined ||
      light.colorMode === settings.colorMode) &&
    (settings.color === undefined ||
      light.color.toLowerCase() === settings.color.toLowerCase()) &&
    (settings.kelvin === undefined ||
      Math.abs(light.kelvin - settings.kelvin) < 80)
  );
}

export function applyOverrides(
  home: Home,
  overrides: Map<string, Override>,
): Home {
  if (!overrides.size) return home;
  const lights = home.lights.map((light) => {
    const override = overrides.get(light.id);
    return override && light.available
      ? apply(light, override.settings)
      : light;
  });
  const byId = new Map(lights.map((light) => [light.id, light]));
  const groups = home.groups?.map((group) => {
    let next = group;
    if (group.memberIds.some((id) => overrides.has(id))) {
      const members = group.memberIds.flatMap((id) => byId.get(id) ?? []);
      next = {
        ...group,
        on: members.some((member) => member.available && member.on),
        brightness: averageBrightness(members, group.brightness),
      };
    }
    const override = overrides.get(group.id);
    return override && group.available
      ? { ...next, ...apply(next, override.settings) }
      : next;
  });
  return { ...home, lights, ...(groups ? { groups } : {}) };
}

// Sends light commands without blocking the interface. Commands for the same
// lights are coalesced: while one is in flight only the latest is kept, so a
// slider drag never builds up a backlog behind a slow bulb.
export function useLiveLights(
  home: Home | null,
  send: (ids: string[], settings: Settings) => Promise<unknown>,
  onError: (error: unknown) => void,
) {
  const overrides = useRef(new Map<string, Override>());
  const channels = useRef(new Map<string, Channel>());
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  const latest = useRef({ send, onError });
  latest.current = { send, onError };

  // Drop overrides once the real state agrees, or when they expire.
  useEffect(() => {
    if (!home) return;
    const now = Date.now();
    const lights = new Map(home.lights.map((light) => [light.id, light]));
    for (const group of home.groups ?? []) lights.set(group.id, group);
    let changed = false;
    for (const [id, override] of overrides.current) {
      const light = lights.get(id);
      if (
        override.until <= now ||
        !light ||
        (override.settled && matches(light, override.settings))
      ) {
        overrides.current.delete(id);
        changed = true;
      }
    }
    if (changed) refresh();
    const next = Math.min(
      ...[...overrides.current.values()].map((override) => override.until),
    );
    if (!Number.isFinite(next)) return;
    const timer = window.setTimeout(refresh, Math.max(0, next - now) + 10);
    return () => clearTimeout(timer);
  }, [home, version, refresh]);

  const predict = useCallback(
    (entries: [string, Settings][]) => {
      const tokens = new Map<string, Override>();
      for (const [id, settings] of entries) {
        const previous = overrides.current.get(id);
        const override = {
          settings: mergeSettings(previous?.settings ?? {}, settings),
          until: Date.now() + pendingMs,
          settled: false,
        };
        overrides.current.set(id, override);
        tokens.set(id, override);
      }
      refresh();
      // Only settle overrides that a newer command has not replaced.
      return (ok: boolean) => {
        for (const [id, override] of tokens) {
          if (overrides.current.get(id) !== override) continue;
          if (ok) {
            override.until = Date.now() + settleMs;
            override.settled = true;
          } else overrides.current.delete(id);
        }
        refresh();
      };
    },
    [refresh],
  );

  const control = useCallback(
    (targets: string[], settings: Settings, predicted: string[] = targets) => {
      const ids = [...new Set(targets)].sort();
      if (!ids.length) return Promise.resolve(true);
      const settle = predict(predicted.map((id) => [id, settings]));
      const key = ids.join("\n");
      const channel = channels.current.get(key) ?? { busy: false };
      channels.current.set(key, channel);
      const run = async (current: Settings, waiters: Waiter[]) => {
        channel.busy = true;
        const started = Date.now();
        let ok = true;
        try {
          await latest.current.send(ids, current);
        } catch (error) {
          ok = false;
          latest.current.onError(error);
        }
        for (const waiter of waiters) waiter(ok);
        const wait = minIntervalMs - (Date.now() - started);
        if (wait > 0 && channel.next)
          await new Promise((resolve) => setTimeout(resolve, wait));
        const queued = channel.next;
        channel.next = undefined;
        if (queued) run(queued.settings, queued.waiters);
        else {
          channel.busy = false;
          channels.current.delete(key);
        }
      };
      return new Promise<boolean>((resolve) => {
        const waiter: Waiter = (ok) => {
          settle(ok);
          resolve(ok);
        };
        if (!channel.busy) run(settings, [waiter]);
        else
          channel.next = {
            settings: mergeSettings(channel.next?.settings ?? {}, settings),
            waiters: [...(channel.next?.waiters ?? []), waiter],
          };
      });
    },
    [predict],
  );

  const display = useMemo(
    () => home && applyOverrides(home, overrides.current),
    [home, version],
  );
  return { home: display, control, predict };
}
