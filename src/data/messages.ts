/**
 * Reads the messages the player has open in the inbox. OGame puts every report's data on a
 * hidden `.rawMessageData` element (data-raw-* attributes); OGLight (MIT, © 2019 Oz) reads the
 * same attributes. DOM only: no network.
 */

export type Res = { metal: number; crystal: number; deuterium: number };

/** Expedition outcomes (discoveries use artefact / lifeform / nothing). */
export type Outcome =
  | "resource"
  | "darkmatter"
  | "ship"
  | "nothing"
  | "trader"
  | "item"
  | "blackhole"
  | "early"
  | "late"
  | "pirate"
  | "alien"
  | "artefact"
  | "lifeform"
  | "unknown";

export interface ExpeditionMessage {
  kind: "expedition" | "discovery";
  id: string;
  /** Unix ms. */
  at: number;
  result: Outcome;
  /** 0 huge, 1 big, 2 normal, -1 not given. */
  size: number;
  depletion: number;
  res: Res & { darkMatter: number; food: number };
  ships: Record<number, number>;
  lost: Record<number, number>;
  item: string | null;
  lfXp: number;
  lifeform: number;
  artefacts: number;
  coords: string | null;
}

export interface SpyMessage {
  kind: "spy";
  id: string;
  at: number;
  coords: string;
  moon: boolean;
  playerId: number;
  playerName: string;
  /** Own planet spied by someone else. */
  counter: boolean;
  sourceName: string;
  sourceCoords: string;
  /** Minutes since last activity, 0 = active now (star), 60 = none seen. */
  activity: number;
  res: Res & { food: number };
  /** Share the attacker can take, 0..1. */
  loot: number;
  /** Resource value of fleet / defence; -1 when not visible in the report. */
  fleetValue: number;
  defValue: number;
  attacked: boolean;
}

export interface Place {
  name: string;
  coords: string;
  moon: boolean;
}

export interface CargoMessage {
  /**
   * transport = arrival at a planet (33), deploy = own fleet arrived or back home (34),
   * return = back from an expedition (34 from position 16), recycle = debris (32).
   */
  kind: "transport" | "deploy" | "return" | "recycle";
  id: string;
  at: number;
  coords: string | null;
  res: Res & { food: number };
  from: Place | null;
  to: Place | null;
  /** Recycling: what stays in the field after this pickup. */
  left?: Res;
}

export interface CombatMessage {
  kind: "combat";
  id: string;
  at: number;
  coords: string | null;
  attacker: boolean;
  winner: "won" | "lost" | "draw" | "unknown";
  /** Plundered (positive) or lost to a raid (negative). */
  loot: Res;
  /** Own units destroyed. */
  lost: Record<number, number>;
  debris: Res;
}

export type ParsedMessage =
  | ExpeditionMessage
  | SpyMessage
  | CargoMessage
  | CombatMessage;

const json = <T>(value: string | undefined, fallback: T): T => {
  if (!value || value === "-") return fallback;
  try {
    return (JSON.parse(value) as T) ?? fallback;
  } catch {
    return fallback;
  }
};
const int = (value: string | undefined): number => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : 0;
};
const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Resource objects from the game: deuterium / deut, darkMatter, food; numbers or strings. */
function readRes(raw: Record<string, unknown>) {
  return {
    metal: num(raw.metal),
    crystal: num(raw.crystal),
    deuterium: num(raw.deuterium ?? raw.deut),
    food: num(raw.food),
    darkMatter: num(raw.darkMatter ?? raw.darkmatter),
  };
}

/** Unit counts keyed by technology id, from `{ "202": 5 }` or `{ "202": { amount: 5 } }`. */
function readUnits(raw: Record<string, unknown>): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = Math.abs(Number(key));
    const amount =
      typeof value === "object" && value
        ? num((value as { amount?: unknown }).amount)
        : num(value);
    if (id > 0 && amount) out[id] = (out[id] ?? 0) + amount;
  }
  return out;
}

function outcome(
  type: number,
  d: DOMStringMap,
  artefacts: number,
  lfXp: number,
): Outcome {
  if (type === 61)
    return artefacts > 0 ? "artefact" : lfXp > 0 ? "lifeform" : "nothing";
  const nav = json<{
    returnTimeMultiplier?: number;
    returnTimeAbsoluteIncreaseHours?: number;
  }>(d.rawNavigation, {});
  switch (d.rawExpeditionresult) {
    case "ressources":
    case "resources":
      return "resource";
    case "darkmatter":
      return "darkmatter";
    case "nothing":
      return "nothing";
    case "shipwrecks":
      return "ship";
    case "trader":
      return "trader";
    case "items":
      return "item";
    case "fleetLost":
      return "blackhole";
    case "navigation":
      return (nav.returnTimeMultiplier ?? 1) < 1 ? "early" : "late";
    case "combatPirates":
      return "pirate";
    case "combatAliens":
      return "alien";
    default:
      return "unknown";
  }
}

const SIZES: Record<string, number> = { huge: 0, big: 1, normal: 2 };

/** One `.msg` element of the inbox, or null if it is not a report Future understands. */
export function readMessage(
  msg: Element,
  ownPlayerId: number,
): ParsedMessage | null {
  const raw = msg.querySelector<HTMLElement>(".rawMessageData");
  const id = msg.getAttribute("data-msg-id");
  if (!raw || !id) return null;
  const d = raw.dataset;
  const type = int(d.rawMessagetype);
  const at = int(d.rawTimestamp || d.rawDatetime) * 1000 || Date.now();

  if (type === 41 || type === 61 || d.rawExpeditionresult !== undefined) {
    const artefacts = int(d.rawArtifactsfound);
    const lfXp = int(d.rawLifeformgainedexperience);
    const result = outcome(type, d, artefacts, lfXp);
    const items = json<unknown>(d.rawItemsgained, null);
    const first = Array.isArray(items)
      ? items[0]
      : items && typeof items === "object"
        ? Object.values(items)[0]
        : null;
    const sizeRaw = d.rawSize ?? d.rawArtifactssize ?? "";
    const sized = ![
      "nothing",
      "trader",
      "blackhole",
      "lifeform",
      "unknown",
    ].includes(result);
    return {
      kind: type === 61 ? "discovery" : "expedition",
      id,
      at,
      result,
      size: !sized
        ? -1
        : sizeRaw in SIZES
          ? SIZES[sizeRaw]!
          : /^[0-2]$/.test(sizeRaw)
            ? Number(sizeRaw)
            : -1,
      depletion: int(d.rawDepletion),
      res: readRes(json(d.rawResourcesgained, {})),
      ships: readUnits(json(d.rawTechnologiesgained, {})),
      lost: readUnits(json(d.rawShipslost, {})),
      item:
        first && typeof first === "object"
          ? String((first as { name?: unknown }).name ?? "") || null
          : null,
      lfXp,
      lifeform: int(d.rawLifeform),
      artefacts,
      coords: d.rawCoords || d.rawCoordinates || null,
    };
  }

  if (
    d.rawCoordinates !== undefined &&
    d.rawResources !== undefined &&
    d.rawLoot !== undefined
  ) {
    // Position 16 ("deep space"): nothing to plunder there.
    if (d.rawTargetplayerid === "99999") return null;
    const counter = int(d.rawTargetplayerid) === ownPlayerId && ownPlayerId > 0;
    const hiddenFleet = d.rawHiddenships === "1";
    const hiddenDef = d.rawHiddendef === "1";
    const isActive = int(d.rawActive) === 1;
    let activity = d.rawActivity === undefined ? -1 : int(d.rawActivity);
    if (activity === -1 || (!isActive && activity < 15)) activity = 60;
    else if (isActive && activity < 15) activity = 0;
    return {
      kind: "spy",
      id,
      at,
      coords: d.rawCoordinates,
      moon: int(d.rawTargetplanettype) === 3,
      playerId: int(d.rawTargetplayerid),
      playerName: d.rawPlayername ?? "",
      counter,
      sourceName: d.rawSourceplayername ?? "",
      sourceCoords: d.rawSourceplanetcoordinates ?? "",
      activity,
      res: {
        metal: int(d.rawMetal),
        crystal: int(d.rawCrystal),
        deuterium: int(d.rawDeuterium),
        food: int(d.rawFood),
      },
      loot: int(d.rawLoot) / 100,
      fleetValue: hiddenFleet ? -1 : int(d.rawFleetvalue),
      defValue: hiddenDef ? -1 : int(d.rawDefensevalue),
      attacked: int(d.rawAttacking) === 1,
    };
  }

  if (d.rawResult !== undefined && d.rawFleets !== undefined)
    return readCombat(id, at, d, ownPlayerId);
  // One-round combat (probes shot down): only the losses are given.
  if (type === 48)
    return {
      kind: "combat",
      id,
      at,
      coords: d.rawCoords || d.rawTargetplanetcoordinates || null,
      attacker: true,
      winner: "lost",
      loot: { metal: 0, crystal: 0, deuterium: 0 },
      lost: readUnits(json(d.rawShipslost, {})),
      debris: { metal: 0, crystal: 0, deuterium: 0 },
    };

  const place = (side: "source" | "target"): Place | null => {
    const coords =
      d[`raw${side === "source" ? "Source" : "Target"}planetcoordinates`];
    if (!coords) return null;
    return {
      name: d[`raw${side === "source" ? "Source" : "Target"}planetname`] ?? "",
      coords,
      moon:
        int(d[`raw${side === "source" ? "Source" : "Target"}planettype`]) === 3,
    };
  };
  const recycled = readRes(json(d.rawRecycledresources, {}));
  if (
    type === 32 ||
    recycled.metal + recycled.crystal + recycled.deuterium > 0
  ) {
    const field = readRes(json(d.rawDebrisresources, {}));
    return {
      kind: "recycle",
      id,
      at,
      coords: d.rawCoords || d.rawTargetcoordinates || null,
      res: {
        metal: recycled.metal,
        crystal: recycled.crystal,
        deuterium: recycled.deuterium,
        food: 0,
      },
      from: null,
      to: null,
      left: {
        metal: Math.max(0, field.metal - recycled.metal),
        crystal: Math.max(0, field.crystal - recycled.crystal),
        deuterium: Math.max(0, field.deuterium - recycled.deuterium),
      },
    };
  }
  const cargo = readRes(json(d.rawCargo, {}));
  if (
    type === 33 ||
    type === 34 ||
    cargo.metal + cargo.crystal + cargo.deuterium + cargo.food > 0
  ) {
    // Fleets back from an expedition carry no source coordinates: the text has them.
    let from = place("source");
    if (!from) {
      const seen = /\[(\d+:\d+:\d+)\]/.exec(
        msg.querySelector(".msgContent")?.textContent ?? "",
      );
      if (seen) from = { name: "", coords: seen[1]!, moon: false };
    }
    const back = type === 34 && from?.coords.split(":")[2] === "16";
    return {
      kind: back ? "return" : type === 34 ? "deploy" : "transport",
      id,
      at,
      coords: d.rawTargetplanetcoordinates || d.rawCoords || null,
      res: {
        metal: cargo.metal,
        crystal: cargo.crystal,
        deuterium: cargo.deuterium,
        food: cargo.food,
      },
      from,
      to: place("target"),
    };
  }
  return null;
}

interface CombatFleet {
  fleetId?: number;
  side?: string;
  player?: { id?: number };
}
interface CombatRound {
  fleets?: {
    fleetId?: number;
    technologies?: { technologyId?: number; destroyedTotal?: number }[];
  }[];
}
interface CombatResult {
  winner?: string;
  loot?: { resources?: { resource?: string; amount?: number }[] };
  debris?: {
    resources?: { resource?: string; remaining?: number; total?: number }[];
  };
  repairedTechnologies?: { technologyId?: number; amount?: number }[];
}

function readCombat(
  id: string,
  at: number,
  d: DOMStringMap,
  own: number,
): CombatMessage {
  const fleets = json<CombatFleet[]>(d.rawFleets, []);
  const rounds = json<CombatRound[]>(d.rawCombatrounds, []);
  const result = json<CombatResult>(d.rawResult, {});
  const defender = json<{ owner?: { id?: number } }>(
    d.rawDefenderspaceobject,
    {},
  );
  const mine = (Array.isArray(fleets) ? fleets : []).filter(
    (f) => f.player?.id === own,
  );
  const ownIds = new Set(mine.map((f) => f.fleetId));
  const sides = new Set(mine.map((f) => f.side));
  const attacker = sides.has("attacker");
  const winner =
    result.winner === "none"
      ? "draw"
      : result.winner && sides.has(result.winner)
        ? "won"
        : result.winner
          ? "lost"
          : "unknown";
  const pick = (
    list:
      | { resource?: string; amount?: number; remaining?: number }[]
      | undefined,
    key: "amount" | "remaining",
  ): Res => {
    const of = (r: string) => num(list?.find((x) => x.resource === r)?.[key]);
    return {
      metal: of("metal"),
      crystal: of("crystal"),
      deuterium: of("deuterium"),
    };
  };
  let loot: Res = { metal: 0, crystal: 0, deuterium: 0 };
  const taken = pick(result.loot?.resources, "amount");
  if (winner === "won" && attacker) loot = taken;
  else if (winner === "lost" && defender.owner?.id === own)
    loot = {
      metal: -taken.metal,
      crystal: -taken.crystal,
      deuterium: -taken.deuterium,
    };
  const lost: Record<number, number> = {};
  const last = Array.isArray(rounds) ? rounds[rounds.length - 1] : undefined;
  for (const f of last?.fleets ?? [])
    if (ownIds.has(f.fleetId))
      for (const tech of f.technologies ?? [])
        if (tech.technologyId && tech.destroyedTotal)
          lost[tech.technologyId] =
            (lost[tech.technologyId] ?? 0) + tech.destroyedTotal;
  if (!attacker && defender.owner?.id === own)
    for (const r of result.repairedTechnologies ?? [])
      if (r.technologyId && lost[r.technologyId])
        lost[r.technologyId] = Math.max(
          0,
          lost[r.technologyId]! - num(r.amount),
        );
  return {
    kind: "combat",
    id,
    at,
    coords: d.rawCoords || null,
    attacker,
    winner,
    loot,
    lost,
    debris: pick(result.debris?.resources, "remaining"),
  };
}

/** The player's id, from the meta tag OGame puts on every game page. */
export function ownPlayerId(doc: Document): number {
  return int(
    doc
      .querySelector('meta[name="ogame-player-id"]')
      ?.getAttribute("content") ?? "",
  );
}

export function isMessagesPage(doc: Document): boolean {
  const q = new URLSearchParams(doc.location?.search ?? "");
  return (
    q.get("page") === "messages" ||
    q.get("component") === "messages" ||
    !!doc.querySelector("#messagecontainercomponent, #messagescomponent")
  );
}
