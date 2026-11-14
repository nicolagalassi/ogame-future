/**
 * Project Orion pages (component=orion): readers of what the game already shows. The game fetches
 * its tabs (missions, lithium production, scanner) into the page; nothing here asks it for anything.
 * Markup as on s808-en (13.x), ported from the Orion Calculator 1.3.7.
 */
import type { Rewards } from '../engines/orion';

export const isOrionPage = (doc: Document): boolean => /component=orion\b/.test(doc.location?.search ?? '') || !!doc.querySelector('#orioncomponent');

export const parseNumber = (text: string | null | undefined): number => parseInt(String(text ?? '').replace(/[^\d]/g, ''), 10) || 0;
const clean = (text: string | null | undefined) => String(text ?? '').replace(/\s+/g, ' ').trim();
export const coordsText = (text: string | null | undefined): string => /\d+:\d+:\d+/.exec(String(text ?? ''))?.[0] ?? '';

/** "3h 15m", "1g 3o 20m", "45m 10s": Italian writes g for days and o for hours, both spellings are read. */
export function durationHours(text: string | null | undefined): number {
  const part = (re: RegExp) => parseInt(re.exec(String(text ?? ''))?.[1] ?? '0', 10);
  return part(/(\d+)\s*[dg]\b/) * 24 + part(/(\d+)\s*[ho]\b/) + part(/(\d+)\s*m\b/) / 60 + part(/(\d+)\s*s\b/) / 3600;
}

/** "02.10.2026 09:05:49" → timestamp (0 when unreadable). */
export function parseGameDate(text: string | null | undefined): number {
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(text ?? ''));
  return m ? new Date(+m[3]!, +m[2]! - 1, +m[1]!, +m[4]!, +m[5]!, +(m[6] ?? 0)).getTime() : 0;
}

/** The inline scripts the game fetched with the tab: `var lithiumProduction = …` and the like. */
function scriptValue(doc: Document, ...res: RegExp[]): string | null {
  for (const s of Array.from(doc.querySelectorAll('#orionContent script, #orioncomponent script, #orionMission script'))) {
    for (const re of res) {
      const m = re.exec(s.textContent ?? '');
      if (m) return m[1]!;
    }
  }
  return null;
}

/** Lithium per hour: the scanner tab declares `lithiumProduction`, the missions tab passes `lithiumPerHour`. */
export function lithiumPerHour(doc: Document, win: { lithiumProduction?: unknown } | null): number {
  const value = Number(win?.lithiumProduction);
  if (value > 0) return value;
  return Number(scriptValue(doc, /lithiumProduction\s*=\s*([\d.]+)/, /lithiumPerHour\s*:\s*([\d.]+)/)) || 0;
}

/** Lithium in the bar: the game's running counter, its data-value only when the text cannot be read. */
export function lithiumNow(doc: Document): number | null {
  const el = doc.querySelector('#lithiumAmount, .orionLithiumAmount');
  if (!el) return null;
  return parseNumber(el.textContent) || Math.floor(Number(el.getAttribute('data-value')) || 0);
}

/** Hours until the resources being converted run out; Infinity when it does not stop (0 on the page). */
export function depletionHours(doc: Document): number {
  const v = scriptValue(doc, /lithiumDepletionSeconds\s*=\s*(\d+)/, /depletionSeconds\s*:\s*(\d+)/);
  return v !== null && Number(v) > 0 ? Number(v) / 3600 : Infinity;
}

/** Storage: production stops when the bar holds this much (a week of production); Infinity when not on the page. */
export function storageCap(doc: Document): number {
  const v = Number(scriptValue(doc, /lithiumStorageCapacity\s*=\s*(\d+)/, /lithiumStorageCapacity\s*:\s*(\d+)/));
  return v > 0 ? v : Infinity;
}

/** One scan's cost, from the scanner panel (the tooltip has the exact figure). */
export function scanCost(doc: Document): number {
  const el = doc.querySelector('#scanCostValue');
  return el ? parseNumber(el.getAttribute('data-tooltip-title')) || parseNumber(el.textContent) : 0;
}

/** A lithium reward: the game's lithium icon, or its name if the icon ever changes. */
const isLithium = (line: Element) => !!line.querySelector('lithium-icon') || /^\s*lit(h)?i/i.test(line.querySelector('.rewardName')?.textContent ?? '');

/** Reward lines inside `box`: resources by their icon, lithium apart, anything else as its text. */
export function readRewards(box: ParentNode, selector: string): Rewards {
  const r: Rewards = { metal: 0, crystal: 0, deuterium: 0, lithium: 0, other: [] };
  for (const line of Array.from(box.querySelectorAll(selector))) {
    if (line.classList.contains('rewardLineEmpty')) continue;
    const icon = line.querySelector('resource-icon');
    const type = icon ? (['metal', 'crystal', 'deuterium'] as const).find((k) => icon.classList.contains(k)) : undefined;
    const amount = clean(line.querySelector('.rewardAmount')?.textContent);
    const name = clean(line.querySelector('.rewardName')?.textContent);
    if (type) r[type] += parseNumber(amount);
    else if (isLithium(line)) r.lithium += parseNumber(amount);
    else {
      const text = clean(`${name} ${amount}`) || clean(line.textContent);
      if (text) r.other.push(text);
    }
  }
  return r;
}

// ---------- scanner results ----------

export const SCAN_CARD = '.scannerResultCard';

export interface ScanCard {
  coords: string;
  name: string;
  /** Redemption cost: the cell with the lithium icon; its tooltip has the exact figure (the text is rounded). */
  cost: number;
  rewards: Rewards;
  hours: number;
  waves: number;
}

export function readScanCard(card: Element): ScanCard {
  const row = card.querySelector('.scannerResultRow:not(.header)');
  const cells = row ? Array.from(row.querySelectorAll(':scope > .cell')) : [];
  const costCell = cells.find((c) => c.querySelector('lithium-icon'));
  // Columns: level, target, duration, waves, distance, type, cost.
  return {
    coords: coordsText(row?.querySelector('a')?.textContent),
    name: clean(card.querySelector('.scannerResultName')?.textContent),
    cost: parseNumber(costCell?.getAttribute('data-tooltip-title') || costCell?.getAttribute('title')),
    rewards: readRewards(card, '.scannerResultRewardsList .rewardLine'),
    hours: durationHours(cells[2]?.textContent),
    waves: parseNumber(cells[3]?.textContent),
  };
}

// ---------- active missions ----------

export const MISSION_CARD = '.anomalyMission';

export interface MissionCard {
  id: string;
  name: string;
  /** The anomaly's coordinates: the route reads origin → anomaly → wave; with no fleet out, the anomaly alone. */
  coords: string;
  /** The collect button's own "Lithium costs: 2.567.018": what collecting now costs. */
  cost: number;
  /** What has piled up so far. */
  rewards: Rewards;
  /** The whole mission, from its details: the reward cost (lithium cell, exact in its tooltip) and the possible rewards. */
  totalCost: number;
  possible: Rewards;
  /** "Wave: 2 / 7" (the one on its way). */
  incoming: number;
  total: number;
  /** Seconds until the anomaly goes. */
  seconds: number;
  level: number;
  stars: number;
  mode: string;
  kind: string;
  spawnedAt: number;
}

export function readMissionCard(card: Element): MissionCard {
  const labels = card.querySelectorAll('.missionRouteLabels .routeLabelCell');
  const coords = coordsText(labels[labels.length === 1 ? 0 : 1]?.querySelector('.nodeCoords')?.textContent) || coordsText(card.querySelector('.missionDetailsTable .cell:nth-child(3) span:last-child')?.textContent);
  const [incoming, total] = (/(\d+)\s*\/\s*(\d+)/.exec(clean(card.querySelector('.nodeWave')?.textContent)) ?? []).slice(1).map(Number);
  const tags = Array.from(card.querySelectorAll('.missionDetailsSubtitle .titleTypeIcon')).map((x) => clean(x.textContent));
  return {
    id: card.getAttribute('data-space-object-id') ?? '',
    name: clean(card.querySelector('.missionNameText')?.textContent) || clean(card.querySelector('.missionNameCompact')?.textContent) || coords,
    coords,
    cost: parseNumber((card.querySelector('.collectRewards .btnSub')?.textContent ?? '').split(':').pop()),
    rewards: readRewards(card, '.rewardsCell .rewardLine'),
    totalCost: (() => {
      const cell = Array.from(card.querySelectorAll('.missionDetailsTable .cell')).find((c) => c.querySelector('lithium-icon'));
      return parseNumber(cell?.querySelector('[data-tooltip-title]')?.getAttribute('data-tooltip-title') || cell?.getAttribute('data-tooltip-title')) || parseNumber(cell?.textContent);
    })(),
    possible: readRewards(card, '.possibleRewardsCell .rewardLine'),
    incoming: incoming || 0,
    total: total || 0,
    seconds: Number(card.querySelector('[id^="despawn_"]')?.getAttribute('data-seconds')) || 0,
    level: parseNumber(card.querySelector('.missionLevel')?.textContent),
    stars: card.querySelectorAll('.missionDifficultyStars img').length,
    mode: tags[0] || (card.classList.contains('pvp') ? 'PvP' : card.classList.contains('pve') ? 'PvE' : ''),
    kind: tags.slice(1).join(' / '),
    spawnedAt: parseGameDate(card.querySelector('.spawnedCell')?.textContent),
  };
}

// ---------- the collect dialog ----------

export const COLLECT_DIALOG = '.orionCollectRewards';

/**
 * The game's "collect rewards" dialog: the waves the lithium pays for are marked .affordable and
 * only those are collected; their own rewards first, the summary only without them (it may total
 * every wave).
 */
export function readCollectDialog(dialog: Element): { id: string; waves: number[]; rewards: Rewards; cost: number } {
  const rows = Array.from(dialog.querySelectorAll(dialog.querySelector('.collectWaveRow.affordable') ? '.collectWaveRow.affordable' : '.collectWaveRow'));
  const rewards = dialog.querySelector('.collectWaveRow.affordable .cwRewards .rewardLine') ? readRewards(dialog, '.collectWaveRow.affordable .cwRewards .rewardLine') : readRewards(dialog, '.collectSummaryRewards .rewardLine');
  const cost = parseNumber(dialog.querySelector('.collectTotalValue')?.textContent) || rows.reduce((s, r) => s + parseNumber((r.querySelector('.cwCost')?.textContent ?? '').split(':').pop()), 0);
  return {
    id: dialog.getAttribute('data-space-object-id') ?? '',
    waves: rows.map((r) => parseNumber(r.querySelector('.cwWave')?.textContent)).filter(Boolean),
    rewards,
    cost,
  };
}

/** The game greys a refused button out with the attribute, a class or aria-disabled: a click on it does nothing. */
export const isDisabled = (el: Element): boolean => !!((el as HTMLButtonElement).disabled || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true');
