import { describe, expect, it } from 'bun:test';
import {
  pickDiagnosticMCQs,
  computeWeaknessReport,
  type MCQDiagnosticAnswer,
} from '../src/lib/mcq-diagnostic';
import type { MCQQuestion, MCQReview } from '../src/lib/database';
import type { HeatmapTile } from '../src/lib/heatmap';

let mcqIdSeq = 0;
function makeMCQ(tags: string[]): MCQQuestion {
  mcqIdSeq += 1;
  return {
    id: mcqIdSeq,
    noteId: 1,
    question: `q${mcqIdSeq}`,
    options: ['a', 'b', 'c', 'd'],
    correctIndex: 0,
    explanation: '',
    tags,
    createdAt: new Date(0).toISOString(),
  };
}

function makeReview(mcqId: number, reviewedAt: string): MCQReview {
  return {
    id: mcqId * 1000,
    mcqId,
    question: '',
    options: [],
    correctIndex: 0,
    selectedIndex: 0,
    correct: true,
    reviewedAt,
  };
}

function makeTile(tag: string, isColdTag: boolean): HeatmapTile {
  return {
    tag,
    retentionRate: null,
    ratingAverageTrend: null,
    cardCount: 0,
    measuredCardCount: 0,
    status: 'grey',
    isColdTag,
  };
}

// Mulberry32 PRNG for deterministic tests.
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('pickDiagnosticMCQs', () => {
  it('returns exactly 15 when pool is sufficient', () => {
    mcqIdSeq = 0;
    const mcqs = Array.from({ length: 25 }, () => makeMCQ(['X']));
    const heatmap: HeatmapTile[] = [makeTile('X', false)];
    const result = pickDiagnosticMCQs(mcqs, [], heatmap, 15, seededRng(1));
    expect(result).toHaveLength(15);
  });

  it('throws INSUFFICIENT_MCQS when fewer than 15 MCQs exist', () => {
    mcqIdSeq = 0;
    const mcqs = Array.from({ length: 10 }, () => makeMCQ(['X']));
    expect(() => pickDiagnosticMCQs(mcqs, [], [], 15, seededRng(1))).toThrow(
      /INSUFFICIENT_MCQS/,
    );
  });

  it('cold-tag weighting picks >=9 from cold tag Networking', () => {
    mcqIdSeq = 0;
    const networkingMcqs = Array.from({ length: 20 }, () => makeMCQ(['Networking']));
    const otherMcqs = [
      ...Array.from({ length: 10 }, () => makeMCQ(['SystemDesign'])),
      ...Array.from({ length: 10 }, () => makeMCQ(['Databases'])),
    ];
    const mcqs = [...networkingMcqs, ...otherMcqs];
    const networkingIds = new Set(networkingMcqs.map((m) => m.id));
    const heatmap: HeatmapTile[] = [
      makeTile('Networking', true),
      makeTile('SystemDesign', false),
      makeTile('Databases', false),
    ];
    const result = pickDiagnosticMCQs(mcqs, [], heatmap, 15, seededRng(42));
    expect(result).toHaveLength(15);
    const coldPicked = result.filter((id) => networkingIds.has(id)).length;
    expect(coldPicked).toBeGreaterThanOrEqual(9);
  });

  it('no cold tags: biases toward tags with oldest review timestamps', () => {
    mcqIdSeq = 0;
    const staleMcqs = Array.from({ length: 15 }, () => makeMCQ(['Stale']));
    const freshMcqs = Array.from({ length: 15 }, () => makeMCQ(['Fresh']));
    const mcqs = [...staleMcqs, ...freshMcqs];
    const staleIds = new Set(staleMcqs.map((m) => m.id));

    const reviews: MCQReview[] = [
      // Stale tag: one old review in 2020
      makeReview(staleMcqs[0].id, '2020-01-01T00:00:00.000Z'),
      // Fresh tag: recent review in 2025
      makeReview(freshMcqs[0].id, '2025-06-01T00:00:00.000Z'),
    ];
    const heatmap: HeatmapTile[] = [
      makeTile('Stale', false),
      makeTile('Fresh', false),
    ];
    const result = pickDiagnosticMCQs(mcqs, reviews, heatmap, 15, seededRng(7));
    const staleCount = result.filter((id) => staleIds.has(id)).length;
    // Stale ranks first in round-robin priority -> should dominate.
    expect(staleCount).toBeGreaterThan(result.length / 2);
  });

  it('never returns duplicate MCQ ids even for multi-tag MCQs', () => {
    mcqIdSeq = 0;
    // Every MCQ has two tags so it appears in multiple tag buckets.
    const mcqs = Array.from({ length: 30 }, () => makeMCQ(['A', 'B']));
    const heatmap: HeatmapTile[] = [makeTile('A', true), makeTile('B', true)];
    const result = pickDiagnosticMCQs(mcqs, [], heatmap, 15, seededRng(99));
    expect(new Set(result).size).toBe(result.length);
    expect(result).toHaveLength(15);
  });

  it('is deterministic with a seeded rng', () => {
    mcqIdSeq = 0;
    const mcqs = [
      ...Array.from({ length: 20 }, () => makeMCQ(['Networking'])),
      ...Array.from({ length: 10 }, () => makeMCQ(['Other'])),
    ];
    const heatmap: HeatmapTile[] = [
      makeTile('Networking', true),
      makeTile('Other', false),
    ];
    const a = pickDiagnosticMCQs(mcqs, [], heatmap, 15, seededRng(123));
    const b = pickDiagnosticMCQs(mcqs, [], heatmap, 15, seededRng(123));
    expect(a).toEqual(b);
  });

  it('with a tag filter, restricts selection to MCQs carrying that tag', () => {
    mcqIdSeq = 0;
    const networkingMcqs = Array.from({ length: 20 }, () => makeMCQ(['Networking']));
    const otherMcqs = Array.from({ length: 10 }, () => makeMCQ(['Other']));
    const mcqs = [...networkingMcqs, ...otherMcqs];
    const networkingIds = new Set(networkingMcqs.map((m) => m.id));
    const heatmap: HeatmapTile[] = [makeTile('Networking', false), makeTile('Other', false)];

    const result = pickDiagnosticMCQs(mcqs, [], heatmap, 15, seededRng(1), 'Networking');
    expect(result).toHaveLength(15);
    expect(result.every((id) => networkingIds.has(id))).toBe(true);
  });

  it('with a tag filter, shrinks the size to whatever is available for that tag instead of throwing', () => {
    mcqIdSeq = 0;
    const mcqs = [
      ...Array.from({ length: 5 }, () => makeMCQ(['Rare'])),
      ...Array.from({ length: 20 }, () => makeMCQ(['Common'])),
    ];
    const heatmap: HeatmapTile[] = [makeTile('Rare', false), makeTile('Common', false)];

    const result = pickDiagnosticMCQs(mcqs, [], heatmap, 15, seededRng(1), 'Rare');
    expect(result).toHaveLength(5);
  });

  it('with a tag filter that matches nothing, throws INSUFFICIENT_MCQS', () => {
    mcqIdSeq = 0;
    const mcqs = Array.from({ length: 20 }, () => makeMCQ(['Common']));
    const heatmap: HeatmapTile[] = [makeTile('Common', false)];

    expect(() => pickDiagnosticMCQs(mcqs, [], heatmap, 15, seededRng(1), 'Nonexistent')).toThrow(
      /INSUFFICIENT_MCQS/,
    );
  });

  it('without a tag filter, still requires the full default size across all topics', () => {
    mcqIdSeq = 0;
    const mcqs = Array.from({ length: 10 }, () => makeMCQ(['X']));
    expect(() => pickDiagnosticMCQs(mcqs, [], [], 15, seededRng(1), undefined)).toThrow(
      /INSUFFICIENT_MCQS/,
    );
  });
});

describe('computeWeaknessReport', () => {
  it('orders entries by wrong-rate descending', () => {
    mcqIdSeq = 0;
    // A: 4 questions, 3 wrong. B: 4 questions, 2 wrong. C: 3 questions, 0 wrong.
    const aQs = Array.from({ length: 4 }, () => makeMCQ(['A']));
    const bQs = Array.from({ length: 4 }, () => makeMCQ(['B']));
    const cQs = Array.from({ length: 3 }, () => makeMCQ(['C']));
    const mcqs = [...aQs, ...bQs, ...cQs];

    const answers: MCQDiagnosticAnswer[] = [
      ...aQs.map((m, i) => ({ mcqId: m.id, selectedIndex: 0, correct: i === 0 })),
      ...bQs.map((m, i) => ({ mcqId: m.id, selectedIndex: 0, correct: i < 2 })),
      ...cQs.map((m) => ({ mcqId: m.id, selectedIndex: 0, correct: true })),
    ];

    const report = computeWeaknessReport(mcqs, answers);
    expect(report.entries.map((e) => e.tag)).toEqual(['A', 'B', 'C']);
    expect(report.entries[0]).toEqual({ tag: 'A', wrongCount: 3, total: 4 });
    expect(report.entries[1]).toEqual({ tag: 'B', wrongCount: 2, total: 4 });
    expect(report.entries[2]).toEqual({ tag: 'C', wrongCount: 0, total: 3 });
  });

  it('drillTargetTags: excludes tags with <2 wrong, caps at 3', () => {
    mcqIdSeq = 0;
    // Five tags with wrong counts: A=3, B=2, C=2, D=2, E=1
    const buildTag = (tag: string, wrong: number, total: number) => {
      const qs = Array.from({ length: total }, () => makeMCQ([tag]));
      const ans: MCQDiagnosticAnswer[] = qs.map((m, i) => ({
        mcqId: m.id,
        selectedIndex: 0,
        correct: i >= wrong,
      }));
      return { qs, ans };
    };
    const A = buildTag('A', 3, 4);
    const B = buildTag('B', 2, 4);
    const C = buildTag('C', 2, 5);
    const D = buildTag('D', 2, 6);
    const E = buildTag('E', 1, 4);

    const mcqs = [...A.qs, ...B.qs, ...C.qs, ...D.qs, ...E.qs];
    const answers = [...A.ans, ...B.ans, ...C.ans, ...D.ans, ...E.ans];

    const report = computeWeaknessReport(mcqs, answers);
    expect(report.drillTargetTags).toHaveLength(3);
    expect(report.drillTargetTags).not.toContain('E');
    // A ranks first (highest wrong rate).
    expect(report.drillTargetTags[0]).toBe('A');
  });

  it('multi-tag question contributes to all its tags', () => {
    mcqIdSeq = 0;
    const q1 = makeMCQ(['A', 'B']);
    const q2 = makeMCQ(['A']);
    const mcqs = [q1, q2];
    const answers: MCQDiagnosticAnswer[] = [
      { mcqId: q1.id, selectedIndex: 1, correct: false },
      { mcqId: q2.id, selectedIndex: 0, correct: true },
    ];
    const report = computeWeaknessReport(mcqs, answers);
    const a = report.entries.find((e) => e.tag === 'A')!;
    const b = report.entries.find((e) => e.tag === 'B')!;
    expect(a).toEqual({ tag: 'A', wrongCount: 1, total: 2 });
    expect(b).toEqual({ tag: 'B', wrongCount: 1, total: 1 });
  });
});
