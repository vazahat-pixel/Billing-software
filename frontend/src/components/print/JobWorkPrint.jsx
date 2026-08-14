import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { resolveCompanyProfile } from '../../utils/invoiceHelpers';

/**
 * Print / preview for the four job-work documents that previously had no print at all:
 *
 *   millIssue   Mill Issue      -> MILL CHALLAN
 *   millReceive Mill Receive    -> Job Card / Cutting Report
 *   jobIssue    Job Issue       -> JOBWORK BOOK challan
 *   jobReceive  Job Receive     -> JOBWORK BOOK bill
 *
 * Every value rendered here is passed in by the calling modal straight from the state it
 * is already displaying — this component performs NO independent lookups and re-derives
 * no monetary figure, so the sheet can never drift from the form the operator is looking
 * at. Totals that the modal already computes are passed in and printed verbatim; the only
 * arithmetic done here is summing columns the modal does not itself total.
 */

// Never let a stray non-numeric cell render as "NaN" on a document that goes to a party.
const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const money = (v) => n(v).toFixed(2);
const qty = (v) => n(v).toFixed(2);
const txt = (v) => (v === 0 ? '0' : v ? String(v) : '');

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
};

/* ── Shared chrome ───────────────────────────────────────────────── */

const Header = ({ firm, title, gstinLabel = true }) => (
  <div className="jwp-head">
    <div className="jwp-firm">{firm.name}</div>
    {firm.addressLine ? <div className="jwp-addr">{firm.addressLine}</div> : null}
    {firm.phone ? <div className="jwp-addr">{firm.phone}</div> : null}
    <div className="jwp-gst-row">
      {gstinLabel && firm.gstin ? <span className="jwp-gstin">GSTIN :- {firm.gstin}</span> : <span />}
      <span className="jwp-doctitle">{title}</span>
    </div>
  </div>
);

const Field = ({ label, value, w }) => (
  <div className="jwp-f" style={w ? { minWidth: w } : undefined}>
    <span className="jwp-f-l">{label}</span>
    <span className="jwp-f-v">{txt(value)}</span>
  </div>
);

/* ── 1. Mill Issue — MILL CHALLAN ────────────────────────────────── */

const MillIssueSheet = ({ d, firm }) => {
  // Reference sheet lays takas out in four vertical blocks (A/B/C/D) of 12 rows.
  // Only blocks the form actually has data for are filled; the rest stay blank exactly
  // as the reference prints them.
  const ROWS = 12;
  const takas = Array.isArray(d.takas) ? d.takas.filter((t) => n(t.meters) > 0) : [];
  const blocks = [0, 1, 2, 3].map((b) => takas.slice(b * ROWS, b * ROWS + ROWS));
  const blockTotal = (b) => blocks[b].reduce((s, t) => s + n(t.meters), 0);

  return (
    <div className="jwp-sheet">
      <Header firm={firm} title={`MILL CHALLAN (${d.procType || 'Process'})`} />

      <div className="jwp-band">
        <div className="jwp-col">
          <Field label="M/s. :" value={d.millName} />
        </div>
        <div className="jwp-col jwp-right">
          <Field label="Challan No.   :" value={d.challanNo} />
          <Field label="Challan Date :" value={fmtDate(d.date)} />
          <Field label="Pu.BillNo     :" value={d.puBillNo} />
        </div>
      </div>

      <div className="jwp-band">
        <Field label="GST :" value={d.millGstin} />
        <Field label="State Code :" value={d.millStateCode} />
      </div>
      <div className="jwp-band">
        <Field label="Item :" value={d.itemName} />
        <Field label="HSN ACS :" value={d.hsnCd} />
        <Field label="Weaver :" value={d.weaver} />
      </div>

      <table className="jwp-grid">
        <thead>
          <tr>
            <th className="w-a">A</th><th>Meter</th>
            <th className="w-a">B</th><th>Meter</th>
            <th className="w-a">C</th><th>Meter</th>
            <th className="w-a">D</th><th>Meter</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROWS }).map((_, r) => (
            <tr key={r}>
              {[0, 1, 2, 3].map((b) => {
                const t = blocks[b][r];
                return (
                  <React.Fragment key={b}>
                    <td className="jwp-c">{t ? txt(t.label ?? b * ROWS + r + 1) : (b === 0 ? r + 1 : '')}</td>
                    <td className="jwp-r">{t ? qty(t.meters) : ''}</td>
                  </React.Fragment>
                );
              })}
            </tr>
          ))}
          <tr className="jwp-tot">
            {[0, 1, 2, 3].map((b) => (
              <React.Fragment key={b}>
                <td />
                <td className="jwp-r">{qty(blockTotal(b))}</td>
              </React.Fragment>
            ))}
          </tr>
        </tbody>
      </table>

      <div className="jwp-band jwp-foot">
        <div className="jwp-col">
          <Field label="Total Taka :" value={d.totalTaka} />
          <Field label="Total Mts. :" value={qty(d.totalMts)} />
          <Field label="Remark" value={d.remark} />
        </div>
        <div className="jwp-col">
          <Field label="Taxable Amt :" value={money(d.taxableAmt)} />
          <Field label="Rate :" value={money(d.rate)} />
        </div>
        <div className="jwp-col jwp-right">
          <div className="jwp-for">For : {firm.name}</div>
        </div>
      </div>

      <div className="jwp-sign">
        <span>Recieved By : ____________________</span>
        <span>Authorised Signatory</span>
      </div>
    </div>
  );
};

/* ── 2. Mill Receive — Job Card / Cutting Report ─────────────────── */

const MillReceiveSheet = ({ d, firm }) => (
  <div className="jwp-sheet">
    <div className="jwp-head">
      <div className="jwp-firm">{firm.name}</div>
      {firm.addressLine ? <div className="jwp-addr">{firm.addressLine}</div> : null}
    </div>

    <div className="jwp-band jwp-mono">
      <div className="jwp-col">
        <Field label="REPORT :" value="Job Card/Cutting Report" />
        <Field label="Weaver :" value={d.weaver} />
        <Field label="Mill    :" value={d.millName} />
        <Field label="Bill No" value={d.billGpNo} />
      </div>
      <div className="jwp-col">
        <Field label="Quality :" value={d.quality} />
        <Field label="Chln No.:" value={d.chlnNo} />
      </div>
      <div className="jwp-col jwp-right">
        <Field label="S.r. No :" value={d.serialNo} />
        <Field label="LotNo:" value={d.lotNo} />
      </div>
    </div>

    <table className="jwp-grid jwp-mono">
      <thead>
        <tr>
          <th>SrNo.</th><th className="jwp-r">Grey Mts.</th><th className="jwp-r">Rec Mts.</th>
          <th className="jwp-r">Shortage</th><th>Remark</th>
          <th className="jwp-r">Chek Mts.</th><th className="jwp-r">Second Mts</th><th>Rec Date</th>
        </tr>
      </thead>
      <tbody>
        {(d.lines || []).map((l, i) => (
          <tr key={i}>
            <td className="jwp-c">{i + 1}</td>
            <td className="jwp-r">{qty(l.greyMts)}</td>
            <td className="jwp-r">{qty(l.recMts)}</td>
            <td className="jwp-r">{qty(l.shortage)}</td>
            <td>{txt(l.remark)}</td>
            <td className="jwp-r">{l.chekMts === '' || l.chekMts == null ? '' : qty(l.chekMts)}</td>
            <td className="jwp-r">{l.secondMts === '' || l.secondMts == null ? '' : qty(l.secondMts)}</td>
            <td className="jwp-c">{fmtDate(l.recDate)}</td>
          </tr>
        ))}
        {!(d.lines || []).length && (
          <tr><td colSpan={8} className="jwp-empty">&nbsp;</td></tr>
        )}
      </tbody>
    </table>

    <div className="jwp-band jwp-foot jwp-mono">
      <Field label="Totel Pcs :" value={d.totalPcs} />
      <Field label="TP Pcs :" value={d.tpPcs} />
      <Field label="Shortage :" value={qty(d.totalShortage)} />
    </div>
    <div className="jwp-band jwp-mono">
      <Field label="Pu.Rate" value={money(d.puRate)} />
      <Field label="Pu.Amt" value={money(d.puAmt)} />
      <Field label="Gp.Rate:" value={money(d.gpRate)} />
      <Field label="Gp.Amount" value={money(d.gpAmount)} />
    </div>
  </div>
);

/* ── 3. Job Issue — JOBWORK BOOK challan ─────────────────────────── */

const JobIssueSheet = ({ d, firm }) => {
  const totPcs = (d.lines || []).reduce((s, l) => s + n(l.pcs), 0);
  const totQty = (d.lines || []).reduce((s, l) => s + n(l.qty), 0);
  return (
    <div className="jwp-sheet">
      <div className="jwp-invoke">!! Shree Ganeshay Namah !!</div>
      <Header firm={firm} title={d.book || 'JOBWORK BOOK'} />

      <div className="jwp-band">
        <div className="jwp-col">
          <Field label="M/s." value={d.partyName} />
        </div>
        <div className="jwp-col jwp-right">
          <Field label="Challan No :" value={d.challanNo} />
          <Field label="Challan Date:" value={fmtDate(d.date)} />
        </div>
      </div>

      <div className="jwp-band">
        <Field label="Ph No.:" value={d.partyPhone} />
        <Field label="GST :" value={d.gstin} />
        <Field label="State Code :" value={d.stateCode} />
        <Field label="Broker:" value={d.broker} />
      </div>

      <table className="jwp-grid">
        <thead>
          <tr>
            <th className="w-sr">SR</th><th>Description</th><th>HSN ACS</th>
            <th className="jwp-r">Cut</th><th className="jwp-r">Pcs</th><th className="jwp-r">Qty</th>
            <th className="jwp-r">Rate</th><th className="jwp-r">PuRate</th>
          </tr>
        </thead>
        <tbody>
          {(d.lines || []).map((l, i) => (
            <tr key={i}>
              <td className="jwp-c">{i + 1}</td>
              <td>{txt(l.itemName)}</td>
              <td className="jwp-c">{txt(l.hsnCd)}</td>
              <td className="jwp-r">{money(l.cut)}</td>
              <td className="jwp-r">{txt(n(l.pcs))}</td>
              <td className="jwp-r">{money(l.qty)}</td>
              <td className="jwp-r">{money(l.rate)}</td>
              <td className="jwp-r">{money(l.fabRate)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="jwp-tot">
            <td colSpan={4} />
            <td className="jwp-r">{txt(totPcs)}</td>
            <td className="jwp-r">{money(totQty)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>

      <div className="jwp-sign">
        <span>Receiver&apos;s sign</span>
        <span>For : {firm.name}<br />Authorized Signature</span>
      </div>
    </div>
  );
};

/* ── 4. Job Receive — JOBWORK BOOK bill ──────────────────────────── */

const JobReceiveSheet = ({ d, firm }) => (
  <div className="jwp-sheet">
    <Header firm={firm} title={d.book || 'JOBWORK BOOK'} gstinLabel={false} />

    <div className="jwp-band">
      <div className="jwp-col">
        <Field label="M/s.  :" value={d.partyName} />
        <Field label="Broker :" value={d.broker} />
      </div>
      <div className="jwp-col jwp-right">
        <Field label="Sral No :" value={d.serialNo} />
        <Field label="Bill No :" value={d.billChNo} />
        <Field label="Rec. Date :" value={fmtDate(d.date)} />
      </div>
    </div>

    <table className="jwp-grid">
      <thead>
        <tr>
          <th>ChNo</th><th>Item Name</th>
          <th className="jwp-r">Cut</th><th className="jwp-r">Pcs</th>
          <th className="jwp-r">Qty</th><th className="jwp-r">Rate</th><th className="jwp-r">Amount</th>
        </tr>
      </thead>
      <tbody>
        {(d.lines || []).map((l, i) => (
          <tr key={i}>
            <td className="jwp-c">{txt(l.chlnNo || i + 1)}</td>
            <td>{txt(l.itemName)}</td>
            <td className="jwp-r">{money(l.cut)}</td>
            <td className="jwp-r">{txt(n(l.recPcs))}</td>
            <td className="jwp-r">{money(l.recMts)}</td>
            <td className="jwp-r">{money(l.jRate)}</td>
            <td className="jwp-r">{money(l.jobAmt)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="jwp-tot">
          <td colSpan={3}>Total :</td>
          <td className="jwp-r">{txt(d.totalPcs)}</td>
          <td className="jwp-r">{money(d.totalQty)}</td>
          <td />
          <td className="jwp-r">{money(d.gross)}</td>
        </tr>
      </tfoot>
    </table>

    <div className="jwp-band jwp-foot">
      <div className="jwp-col">
        <Field label="Remark" value={d.remark} />
      </div>
      <div className="jwp-col">
        <Field label="Tds%" value={money(d.tdsPercent)} />
        <Field label="" value={money(d.tdsAmt)} />
      </div>
      <div className="jwp-col jwp-totals">
        <div><span>Add</span><b>{money(d.addAmt)}</b></div>
        <div><span>Less</span><b>{money(d.lessAmt)}</b></div>
        <div><span>Other.Less</span><b>{money(d.otherLess)}</b></div>
        <div className="jwp-net"><span>Net.Amount</span><b>{money(d.final)}</b></div>
      </div>
    </div>
  </div>
);

/* ── Shell ───────────────────────────────────────────────────────── */

const SHEETS = {
  millIssue: MillIssueSheet,
  millReceive: MillReceiveSheet,
  jobIssue: JobIssueSheet,
  jobReceive: JobReceiveSheet,
};

export default function JobWorkPrint({ variant, data, company, onClose }) {
  const firm = useMemo(() => {
    const f = resolveCompanyProfile(company) || {};
    const area = Array.isArray(f.area) ? f.area.filter(Boolean).join(', ') : f.area;
    return {
      name: f.name || 'Company',
      addressLine: [f.address, area].filter(Boolean).join(', '),
      phone: f.phone ? `Phone : ${f.phone}` : '',
      gstin: f.gstin || '',
    };
  }, [company]);

  const Sheet = SHEETS[variant];
  if (!Sheet || !data) return null;

  return createPortal(
    <div className="jwp-overlay" role="dialog" aria-label="Print preview">
      <style>{PRINT_CSS}</style>
      <div className="jwp-bar no-print">
        <span className="jwp-bar-title">Print Preview</span>
        <div className="jwp-bar-actions">
          <button type="button" className="jwp-btn jwp-btn-primary" onClick={() => window.print()}>Print</button>
          <button type="button" className="jwp-btn" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="jwp-scroll">
        <div className="jwp-paper" id="jwp-paper">
          <Sheet d={data} firm={firm} />
        </div>
      </div>
    </div>,
    document.body
  );
}

const PRINT_CSS = `
.jwp-overlay { position: fixed; inset: 0; z-index: 10000; background: rgba(15,23,42,0.55); display: flex; flex-direction: column; }
.jwp-bar { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; background: #1e293b; color: #fff; }
.jwp-bar-title { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.jwp-bar-actions { display: flex; gap: 8px; }
.jwp-btn { font-size: 12px; font-weight: 700; padding: 5px 14px; border: 1px solid #94a3b8; background: #f1f5f9; color: #0f172a; border-radius: 3px; cursor: pointer; }
.jwp-btn-primary { background: #2563eb; border-color: #1d4ed8; color: #fff; }
.jwp-scroll { flex: 1; overflow: auto; padding: 18px; display: flex; justify-content: center; align-items: flex-start; }
.jwp-paper { background: #fff; width: 210mm; min-height: 148mm; padding: 8mm; box-shadow: 0 10px 30px rgba(0,0,0,.35); }

.jwp-sheet { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11px; border: 1px solid #000; padding: 6px 8px; }
.jwp-invoke { text-align: center; font-size: 10px; font-weight: 700; margin-bottom: 2px; }
.jwp-head { text-align: center; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 4px; }
.jwp-firm { font-size: 19px; font-weight: 700; letter-spacing: .02em; }
.jwp-addr { font-size: 10.5px; }
.jwp-gst-row { display: flex; align-items: center; justify-content: space-between; margin-top: 3px; }
.jwp-gstin { font-size: 10.5px; font-weight: 700; background: #e2e8f0; padding: 0 4px; }
.jwp-doctitle { font-size: 12px; font-weight: 700; }

.jwp-band { display: flex; flex-wrap: wrap; gap: 4px 22px; padding: 3px 0; border-bottom: 1px solid #000; }
.jwp-band:last-of-type { border-bottom: none; }
.jwp-col { display: flex; flex-direction: column; gap: 2px; }
.jwp-col.jwp-right { margin-left: auto; }
.jwp-f { display: flex; gap: 5px; align-items: baseline; }
.jwp-f-l { font-weight: 700; white-space: nowrap; }
.jwp-f-v { font-family: inherit; }
.jwp-mono, .jwp-mono .jwp-f-l, .jwp-mono th, .jwp-mono td { font-family: "Courier New", ui-monospace, monospace; }

.jwp-grid { width: 100%; border-collapse: collapse; margin: 4px 0; }
.jwp-grid th, .jwp-grid td { border: 1px solid #000; padding: 2px 4px; font-size: 10.5px; }
.jwp-grid th { font-weight: 700; text-align: center; }
.jwp-grid td.jwp-r, .jwp-grid th.jwp-r { text-align: right; }
.jwp-grid td.jwp-c { text-align: center; }
.jwp-grid .w-a { width: 26px; }
.jwp-grid .w-sr { width: 30px; }
.jwp-tot td { font-weight: 700; border-top: 2px solid #000; }
.jwp-empty { height: 90px; }

.jwp-foot { align-items: flex-start; }
.jwp-totals { margin-left: auto; min-width: 190px; }
.jwp-totals > div { display: flex; justify-content: space-between; gap: 18px; }
.jwp-net { border-top: 1px solid #000; margin-top: 2px; padding-top: 2px; font-size: 12px; }
.jwp-for { font-weight: 700; }
.jwp-sign { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 22px; font-size: 10.5px; }

@media print {
  body * { visibility: hidden !important; }
  .jwp-overlay, .jwp-overlay * { visibility: visible !important; }
  .jwp-overlay { position: absolute !important; inset: 0; background: #fff !important; display: block !important; }
  .jwp-scroll { overflow: visible !important; padding: 0 !important; display: block !important; }
  .jwp-paper { width: auto !important; box-shadow: none !important; padding: 0 !important; min-height: 0 !important; }
  .no-print { display: none !important; }
  @page { size: A4; margin: 10mm; }
}
`;
