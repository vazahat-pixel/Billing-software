// Run: node --test src/pages/jobwork/millReceiveCalc.node.test.js
// Expected values follow JSM I_Tran_Inv_Proc_Receipt Dgv1_CellValidated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineShortagePct, lineShtgKgs, lineJobAmt } from './millReceiveCalc.js';

const line = (x) => ({ greyMts: 0, finishMts: 0, finalMts: 0, greyKgs: 0, recKgs: 0, f1Pcs: 0, jobRate: 0, unitPQ: 'Q', ...x });

test('Shtg% = (Grey - Finish) / Grey x 100, 2 decimals', () => {
  assert.equal(lineShortagePct(line({ greyMts: 1000, finishMts: 950 })), '5.00');
  assert.equal(lineShortagePct(line({ greyMts: 1000, finishMts: 0 })), '100.00'); // JSM shows 100 until finish is typed
  assert.equal(lineShortagePct(line({ greyMts: 1000, finishMts: 1020 })), '-2.00'); // gain
  assert.equal(lineShortagePct(line({ greyKgs: 200, recKgs: 190 })), '5.00'); // kgs when no metres
  assert.equal(lineShortagePct(line({})), '0.00');
});

test('Shtg.Kgs = Gry.Kgs - Rec.Kgs', () => {
  assert.equal(lineShtgKgs(line({ greyKgs: 200, recKgs: 190.5 })), '9.500');
  assert.equal(lineShtgKgs(line({ recKgs: 10 })), '0.000');
});

test('Job Amount by P/Q/K', () => {
  const base = { greyMts: 1000, finishMts: 1000, finalMts: 980, greyKgs: 210, recKgs: 200, f1Pcs: 40, jobRate: 10 };
  assert.equal(lineJobAmt(line({ ...base, unitPQ: 'Q' })), 10000); // Finish.Mts (JSM default)
  assert.equal(lineJobAmt(line({ ...base, unitPQ: 'F' })), 9800); // Final.Mts
  assert.equal(lineJobAmt(line({ ...base, unitPQ: 'P' })), 400); // F.Pcs
  assert.equal(lineJobAmt(line({ ...base, unitPQ: 'K' })), 2000); // Rec.Kgs
  assert.equal(lineJobAmt(line({ ...base, unitPQ: 'G' })), 2100); // Gry.Kgs
  assert.equal(lineJobAmt(line({ ...base, unitPQ: '' })), 10000); // blank = Q
  assert.equal(lineJobAmt(line({ ...base, unitPQ: 'p' })), 400); // lower case accepted
});

test('older receipts loaded with basis F keep their old amount (final x rate)', () => {
  // Old rule: final > 0 ? final : finish. Old receipts load with final = finish = received.
  const received = 950;
  assert.equal(lineJobAmt(line({ finishMts: received, finalMts: received, jobRate: 12.5, unitPQ: 'F' })), 11875);
});
