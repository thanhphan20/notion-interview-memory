import type { MCQQuestion, MCQReview } from './database';
import type { HeatmapTile } from './heatmap';

export interface MCQDiagnosticAnswer {
  mcqId: number;
  selectedIndex: number;
  correct: boolean;
}

export interface WeaknessReportEntry {
  tag: string;
  wrongCount: number;
  total: number;
}

export interface WeaknessReport {
  entries: WeaknessReportEntry[];
  drillTargetTags: string[];
}

const DEFAULT_SIZE = 15;
const COLD_TARGET_RATIO = 0.6;
const MAX_DRILL_TAGS = 3;
const MIN_WRONG_FOR_DRILL = 2;

function defaultRng(): number {
  return Math.random();
}

function latestReviewTimeByTag(mcqs: MCQQuestion[], reviews: MCQReview[]): Map<string, number | null> {
  const latestByMcq = new Map<number, number>();
  for (const r of reviews) {
    const t = new Date(r.reviewedAt).getTime();
    const prev = latestByMcq.get(r.mcqId);
    if (prev === undefined || t > prev) {
      latestByMcq.set(r.mcqId, t);
    }
  }

  const latestByTag = new Map<string, number | null>();
  for (const mcq of mcqs) {
    const t = latestByMcq.get(mcq.id);
    for (const tag of mcq.tags) {
      if (!latestByTag.has(tag)) {
        latestByTag.set(tag, t ?? null);
      } else {
        const cur = latestByTag.get(tag)!;
        if (t !== undefined && (cur === null || t > cur)) {
          latestByTag.set(tag, t);
        }
      }
    }
  }
  return latestByTag;
}

function groupMcqsByTag(mcqs: MCQQuestion[]): Map<string, MCQQuestion[]> {
  const map = new Map<string, MCQQuestion[]>();
  for (const mcq of mcqs) {
    for (const tag of mcq.tags) {
      if (!map.has(tag)) map.set(tag, []);
      map.get(tag)!.push(mcq);
    }
  }
  return map;
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Round-robin pick across tag pools in priority order, honoring a max cap per bucket.
function pickFromTags(
  tagOrder: string[],
  mcqsByTag: Map<string, MCQQuestion[]>,
  quota: number,
  taken: Set<number>,
  rng: () => number,
): number[] {
  const picked: number[] = [];
  // Snapshot shuffled pools per tag so ordering is deterministic w.r.t. rng.
  const pools = new Map<string, MCQQuestion[]>();
  for (const tag of tagOrder) {
    const pool = mcqsByTag.get(tag) ?? [];
    pools.set(tag, seededShuffle(pool, rng));
  }
  let progressed = true;
  while (picked.length < quota && progressed) {
    progressed = false;
    for (const tag of tagOrder) {
      if (picked.length >= quota) break;
      const pool = pools.get(tag)!;
      while (pool.length > 0) {
        const m = pool.shift()!;
        if (!taken.has(m.id)) {
          taken.add(m.id);
          picked.push(m.id);
          progressed = true;
          break;
        }
      }
    }
  }
  return picked;
}

export function pickDiagnosticMCQs(
  mcqs: MCQQuestion[],
  reviews: MCQReview[],
  heatmap: HeatmapTile[],
  size: number = DEFAULT_SIZE,
  rng: () => number = defaultRng,
): number[] {
  if (mcqs.length < size) {
    throw new Error(`INSUFFICIENT_MCQS: need ${size} MCQs, have ${mcqs.length}`);
  }

  const mcqsByTag = groupMcqsByTag(mcqs);
  const coldTags = new Set(heatmap.filter((t) => t.isColdTag).map((t) => t.tag));
  const coldMcqIds = new Set<number>();
  for (const tag of coldTags) {
    for (const m of mcqsByTag.get(tag) ?? []) coldMcqIds.add(m.id);
  }

  const taken = new Set<number>();
  const selected: number[] = [];
  const coldQuota = Math.ceil(size * COLD_TARGET_RATIO); // 9 when size=15

  const useColdPath = coldTags.size > 0 && coldMcqIds.size >= coldQuota;

  if (useColdPath) {
    // Rank cold tags by staleness (oldest first, null=oldest).
    const latest = latestReviewTimeByTag(mcqs, reviews);
    const coldTagOrder = Array.from(coldTags).sort((a, b) => {
      const la = latest.get(a) ?? null;
      const lb = latest.get(b) ?? null;
      if (la === null && lb === null) return a.localeCompare(b);
      if (la === null) return -1;
      if (lb === null) return 1;
      return la - lb;
    });
    const coldPicks = pickFromTags(coldTagOrder, mcqsByTag, coldQuota, taken, rng);
    selected.push(...coldPicks);

    // Remaining slots from non-cold tags, ranked by staleness (oldest first).
    const nonColdTags = Array.from(mcqsByTag.keys()).filter((t) => !coldTags.has(t));
    nonColdTags.sort((a, b) => {
      const la = latest.get(a) ?? null;
      const lb = latest.get(b) ?? null;
      if (la === null && lb === null) return a.localeCompare(b);
      if (la === null) return -1;
      if (lb === null) return 1;
      return la - lb;
    });
    const remaining = size - selected.length;
    const nonColdPicks = pickFromTags(nonColdTags, mcqsByTag, remaining, taken, rng);
    selected.push(...nonColdPicks);
  } else {
    // Weight by staleness: oldest most-recent MCQ review time first (null=oldest).
    const latest = latestReviewTimeByTag(mcqs, reviews);
    const tagOrder = Array.from(mcqsByTag.keys()).sort((a, b) => {
      const la = latest.get(a) ?? null;
      const lb = latest.get(b) ?? null;
      if (la === null && lb === null) return a.localeCompare(b);
      if (la === null) return -1;
      if (lb === null) return 1;
      return la - lb;
    });
    const picks = pickFromTags(tagOrder, mcqsByTag, size, taken, rng);
    selected.push(...picks);
  }

  // Backfill from any remaining MCQs if still short (e.g., untagged MCQs).
  if (selected.length < size) {
    const leftovers = seededShuffle(
      mcqs.filter((m) => !taken.has(m.id)),
      rng,
    );
    for (const m of leftovers) {
      if (selected.length >= size) break;
      taken.add(m.id);
      selected.push(m.id);
    }
  }

  // Final interleave shuffle.
  return seededShuffle(selected, rng);
}

export function computeWeaknessReport(
  mcqs: MCQQuestion[],
  answers: MCQDiagnosticAnswer[],
): WeaknessReport {
  const mcqsById = new Map(mcqs.map((m) => [m.id, m]));
  const stats = new Map<string, { wrong: number; total: number }>();

  for (const ans of answers) {
    const mcq = mcqsById.get(ans.mcqId);
    if (!mcq) continue;
    for (const tag of mcq.tags) {
      const s = stats.get(tag) ?? { wrong: 0, total: 0 };
      s.total += 1;
      if (!ans.correct) s.wrong += 1;
      stats.set(tag, s);
    }
  }

  const entries: WeaknessReportEntry[] = Array.from(stats.entries()).map(([tag, s]) => ({
    tag,
    wrongCount: s.wrong,
    total: s.total,
  }));

  entries.sort((a, b) => {
    const ra = a.total === 0 ? 0 : a.wrongCount / a.total;
    const rb = b.total === 0 ? 0 : b.wrongCount / b.total;
    if (rb !== ra) return rb - ra;
    if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount;
    return a.tag.localeCompare(b.tag);
  });

  const drillTargetTags = entries
    .filter((e) => e.wrongCount >= MIN_WRONG_FOR_DRILL)
    .slice(0, MAX_DRILL_TAGS)
    .map((e) => e.tag);

  return { entries, drillTargetTags };
}
