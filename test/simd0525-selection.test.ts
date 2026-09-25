import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { selectByRank } from '../scripts/simd0525-epoch1037-collect.ts'

/**
 * The selection rule is preregistered. These tests exist so it cannot drift after results are seen:
 * selection must depend on slot position alone, and must be reproducible from the committed bounds.
 */
test('even-rank selection is deterministic and position-only', () => {
  const produced = Array.from({ length: 11_282 }, (_, i) => 1000 + i * 1)
  const a = selectByRank(produced, 60), b = selectByRank(produced, 60)
  assert.deepEqual(a, b, 'two runs must select identically')
  assert.equal(a.length, 60)
  assert.equal(a[0], produced[0], 'first rank is the first produced slot')
  assert.equal(a.at(-1), produced.at(-1), 'last rank is the last produced slot')
  assert.deepEqual([...a].sort((x, y) => x - y), a, 'selection stays in ascending slot order')
  // Evenly spaced by construction: consecutive gaps differ by at most one slot index.
  const gaps = a.slice(1).map((v, i) => v - a[i])
  assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1, 'ranks are evenly spaced')
})

test('selection ignores every property that is not position', () => {
  // The rule only ever receives slot numbers, so no outcome, fee, CU or program can reach it.
  const produced = [5, 9, 11, 12, 20, 31, 44, 50]
  assert.deepEqual(selectByRank(produced, 4), [5, 11, 31, 50])
  // Fewer produced blocks than planned: take all, never pad or substitute.
  assert.deepEqual(selectByRank([7, 8, 9], 10), [7, 8, 9])
})

test('the committed windows are internally consistent and slot-anchored', () => {
  const b = JSON.parse(readFileSync('research/simd0525-epoch1037/windows.json', 'utf8'))
  const w = b.windows
  // The POST side must start exactly ON the epoch boundary slot, and PRE must end one slot before.
  assert.equal(w.PRIMARY_1037_POST.startSlot, b.boundary1037.slot)
  assert.equal(w.PRIMARY_1037_PRE.endSlotInclusive, b.boundary1037.slot - 1)
  assert.equal(w.PLACEBO_1036_POST.startSlot, b.boundary1036.slot)
  assert.equal(w.PLACEBO_1036_PRE.endSlotInclusive, b.boundary1036.slot - 1)
  // Epoch assignment must match the slot arithmetic, not a blockTime guess.
  assert.equal(Math.floor(w.PRIMARY_1037_POST.startSlot / 432_000), 1037)
  assert.equal(Math.floor(w.PRIMARY_1037_PRE.endSlotInclusive / 432_000), 1036)
  // Windows are matched on wall clock, so slot spans legitimately differ across the boundary.
  for (const name of Object.keys(w)) {
    const span = w[name].endBlockTime - w[name].startBlockTime
    const expected = w[name].windowSeconds
    assert.ok(Math.abs(span - expected) <= 2, `${name} wall-clock span ${span}s should be ~${expected}s`)
    assert.ok(w[name].endSlotInclusive > w[name].startSlot, `${name} must be non-empty`)
  }
  assert.notEqual(w.PRIMARY_1037_PRE.slotSpan, w.PRIMARY_1037_POST.slotSpan,
    'equal wall-clock hours contain unequal slot counts across this boundary')
})
