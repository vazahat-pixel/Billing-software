/**
 * Mill Receipt line calculations, as in JSM I_Tran_Inv_Proc_Receipt (Dgv1_CellValidated).
 * Pure functions — used by ReceiveModal and unit-tested with node --test.
 */
/** Shtg% = (Grey.Mts - Finish.Mts) / Grey.Mts x 100; by kgs when there are no metres. */
export const lineShortagePct = (line) => {
   const grey = Number(line.greyMts) || 0;
   const finish = Number(line.finishMts) || 0;
   const gKgs = Number(line.greyKgs) || 0;
   const rKgs = Number(line.recKgs) || 0;
   let pct = 0;
   if (grey !== 0) pct = ((grey - finish) / grey) * 100;
   else if (gKgs !== 0) pct = ((gKgs - rKgs) / gKgs) * 100;
   return Number.isFinite(pct) ? pct.toFixed(2) : '0.00';
};

/** Shtg.Kgs = Gry.Kgs - Rec.Kgs. */
export const lineShtgKgs = (line) => {
   const gKgs = Number(line.greyKgs) || 0;
   return gKgs !== 0 ? (gKgs - (Number(line.recKgs) || 0)).toFixed(3) : '0.000';
};

/** Job Amount by P/Q/K: P F.Pcs, K Rec.Kgs, F Final.Mts, G Gry.Kgs, otherwise (Q) Finish.Mts - times Job.Rate. */
export const lineJobAmt = (line) => {
   const rateVal = Number(line.jobRate) || 0;
   const basis = {
      P: Number(line.f1Pcs) || 0,
      K: Number(line.recKgs) || 0,
      F: Number(line.finalMts) || 0,
      G: Number(line.greyKgs) || 0,
   }[String(line.unitPQ || 'Q').toUpperCase()] ?? (Number(line.finishMts) || 0);
   return Number((basis * rateVal).toFixed(2));
};

export const UNIT_PQ = [['Q', 'Q - Finish Mts'], ['P', 'P - Pcs'], ['K', 'K - Rec Kgs'], ['G', 'G - Grey Kgs'], ['F', 'F - Final Mts']];
