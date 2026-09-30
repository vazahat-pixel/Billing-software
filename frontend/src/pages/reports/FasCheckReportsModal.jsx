import React, { useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { reportApi } from '../../api/report.api';
import { toast } from '../../store/useToastStore';
import { exportTableToExcel } from '../../utils/reportExport';

const todayISO = () => new Date().toISOString().split('T')[0];
const dmy = (iso) => {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : '';
};
const num = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const KINDS = {
  interest: { title: 'Ledger Interest', head: 'Interest on outstanding' },
  confirmation: { title: 'Confirmation', head: 'Balance confirmation' },
  aboveBelow: { title: 'Above Below Rs.', head: 'Accounts above / below amount' },
  importBank: { title: 'Import Bank', head: 'Bank statement match' },
  diffOpening: { title: 'Chek Diff Os.Bill/Op.Balance', head: 'Opening balance vs old bills' },
  diffYear: { title: 'Check Diff Os/Ledger Cur.Year', head: 'Bill outstanding vs ledger' },
};

function parseBankCsv(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const cells = (line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
  const header = cells(lines[0]).map((cell) => cell.toLowerCase());
  const find = (...names) => header.findIndex((cell) => names.includes(cell));
  let start = 0;
  let iDate = find('date', 'txn date', 'value date', 'transaction date');
  let iNarr = find('narration', 'description', 'particulars', 'remarks');
  let iDebit = find('debit', 'withdrawal', 'dr');
  let iCredit = find('credit', 'deposit', 'cr');
  let iRef = find('reference', 'ref', 'cheque', 'chq', 'utr');
  if (iDate >= 0) start = 1;
  else { iDate = 0; iNarr = 1; iDebit = 2; iCredit = 3; iRef = 4; }
  return lines.slice(start).map((line) => {
    const row = cells(line);
    return {
      date: row[iDate] || '',
      narration: row[iNarr] || '',
      debit: Number(String(row[iDebit] || '0').replace(/,/g, '')) || 0,
      credit: Number(String(row[iCredit] || '0').replace(/,/g, '')) || 0,
      reference: row[iRef] || '',
    };
  }).filter((row) => row.date || row.debit || row.credit);
}

export default function FasCheckReportsModal({ isOpen, onClose, kind = 'interest' }) {
  const spec = KINDS[kind] || KINDS.interest;
  const [stage, setStage] = useState('filter');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [asOn, setAsOn] = useState(todayISO);
  const [rate, setRate] = useState('18');
  const [minDays, setMinDays] = useState('0');
  const [osType, setOsType] = useState('receivable');
  const [amount, setAmount] = useState('10000');
  const [mode, setMode] = useState('above');
  const [side, setSide] = useState('all');
  const [csvText, setCsvText] = useState('');
  const [windowDays, setWindowDays] = useState('3');
  const [onlyDiff, setOnlyDiff] = useState(true);

  const run = async () => {
    setLoading(true);
    try {
      let res;
      if (kind === 'interest') {
        res = await reportApi.ledgerInterest({ asOn, rate, minDays, type: osType });
      } else if (kind === 'confirmation') {
        res = await reportApi.confirmation({ asOn });
      } else if (kind === 'aboveBelow') {
        res = await reportApi.aboveBelow({ asOn, amount, mode, side });
      } else if (kind === 'importBank') {
        const rows = parseBankCsv(csvText);
        if (!rows.length) {
          toast.warning('Paste a bank CSV first');
          setLoading(false);
          return;
        }
        res = await reportApi.importBank({ rows, windowDays: Number(windowDays) || 3 });
      } else if (kind === 'diffOpening') {
        res = await reportApi.diffOpening({ asOn, onlyDiff: onlyDiff ? '1' : '0' });
      } else {
        res = await reportApi.diffYear({ asOn, onlyDiff: onlyDiff ? '1' : '0' });
      }
      setData(res);
      setStage('screen');
    } catch (err) {
      toast.error(err, { fallback: 'Report failed' });
    } finally {
      setLoading(false);
    }
  };

  const onFilterKey = (e) => {
    if (e.key !== 'Enter' || e.target?.tagName === 'TEXTAREA') return;
    e.preventDefault();
    run();
  };

  const exportRows = () => {
    const rows = data?.rows || [];
    if (!rows.length) return toast.warning('Nothing to export');
    const columns = Object.keys(rows[0]).filter((key) => key !== 'match').map((key) => ({ key, label: key }));
    const flat = rows.map((row) => ({
      ...row,
      billDate: row.billDate ? dmy(row.billDate) : row.billDate,
      date: row.date ? dmy(row.date) : row.date,
      voucherNo: row.match?.voucherNo || row.voucherNo || '',
      party: row.match?.partyName || '',
    }));
    exportTableToExcel(spec.head, columns, flat);
  };

  const rows = data?.rows || [];
  const interestTotal = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.interest || 0), 0),
    [rows]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={stage === 'screen' ? () => setStage('filter') : onClose}
      title={stage === 'filter' ? spec.title : spec.head}
      className="max-w-5xl w-[980px]"
    >
      {stage === 'filter' ? (
        <div className="bg-[#d9e6f2] text-[13px] text-slate-900" onKeyDown={onFilterKey}>
          <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b border-[#b7c9dc]">
            {kind !== 'importBank' && (
              <label className="flex items-center gap-2 font-bold">
                As on
                <input type="date" value={asOn} onChange={(e) => setAsOn(e.target.value)} className="h-7 px-2 bg-[#ffe7c2] border border-slate-500" />
              </label>
            )}
            {kind === 'interest' && (
              <>
                <label className="flex items-center gap-2 font-bold">
                  Rate %
                  <input value={rate} onChange={(e) => setRate(e.target.value)} className="h-7 w-16 px-2 border border-slate-500" />
                </label>
                <label className="flex items-center gap-2 font-bold">
                  Min days
                  <input value={minDays} onChange={(e) => setMinDays(e.target.value)} className="h-7 w-16 px-2 border border-slate-500" />
                </label>
                <select value={osType} onChange={(e) => setOsType(e.target.value)} className="h-7 border border-slate-500">
                  <option value="receivable">Sales outstanding</option>
                  <option value="payable">Purchase outstanding</option>
                </select>
              </>
            )}
            {kind === 'aboveBelow' && (
              <>
                <select value={mode} onChange={(e) => setMode(e.target.value)} className="h-7 border border-slate-500">
                  <option value="above">Above</option>
                  <option value="below">Below</option>
                </select>
                <label className="flex items-center gap-2 font-bold">
                  Rs.
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} className="h-7 w-28 px-2 border border-slate-500" />
                </label>
                <select value={side} onChange={(e) => setSide(e.target.value)} className="h-7 border border-slate-500">
                  <option value="all">Dr and Cr</option>
                  <option value="Dr">Debit only</option>
                  <option value="Cr">Credit only</option>
                </select>
              </>
            )}
            {(kind === 'diffOpening' || kind === 'diffYear') && (
              <label className="flex items-center gap-2 font-bold">
                <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
                Only differences
              </label>
            )}
          </div>
          {kind === 'importBank' && (
            <div className="px-4 py-3">
              <p className="mb-2 text-[12px]">CSV columns: Date, Narration, Debit, Credit, Reference. Credit is money in (receipt). Debit is money out (payment).</p>
              <label className="flex items-center gap-2 font-bold mb-2">
                Match within days
                <input value={windowDays} onChange={(e) => setWindowDays(e.target.value)} className="h-7 w-16 px-2 border border-slate-500" />
              </label>
              <input
                type="file"
                accept=".csv,text/csv"
                className="mb-2 block text-[12px]"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  file.text().then(setCsvText).catch(() => toast.error('Could not read the file'));
                }}
              />
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={8}
                placeholder="Date,Narration,Debit,Credit,Reference"
                className="w-full border border-slate-500 p-2 text-[12px]"
              />
            </div>
          )}
          <div className="flex justify-end gap-2 px-4 py-3">
            <button type="button" className="h-8 px-4 bg-[#1d4ed8] text-white font-bold" onClick={run} disabled={loading}>
              {loading ? 'Loading…' : 'OK'}
            </button>
            <button type="button" className="h-8 px-4 border border-slate-500 bg-white font-bold" onClick={onClose}>Exit</button>
          </div>
        </div>
      ) : (
        <div className="bg-white text-[12px] text-slate-900">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#e8eef6] border-b">
            <button type="button" className="h-7 px-3 border border-slate-500 bg-white font-bold" onClick={() => setStage('filter')}>Back</button>
            <button type="button" className="h-7 px-3 border border-slate-500 bg-white font-bold" onClick={exportRows}>Excel</button>
            <button type="button" className="h-7 px-3 border border-slate-500 bg-white font-bold" onClick={() => window.print()}>Print</button>
            <span className="ml-auto font-bold">{rows.length} row{rows.length === 1 ? '' : 's'}</span>
          </div>
          <div className="max-h-[68vh] overflow-auto">
            {kind === 'interest' && <InterestTable rows={rows} total={data?.totalInterest ?? interestTotal} outstanding={data?.totalOutstanding} />}
            {kind === 'confirmation' && <ConfirmTable rows={rows} data={data} />}
            {kind === 'aboveBelow' && <AboveTable rows={rows} />}
            {kind === 'importBank' && <BankTable rows={rows} data={data} />}
            {kind === 'diffOpening' && <OpeningTable rows={rows} data={data} />}
            {kind === 'diffYear' && <YearTable rows={rows} data={data} />}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Grid({ children }) {
  return <table className="w-full border-collapse">{children}</table>;
}
function Head({ cols }) {
  return (
    <thead>
      <tr>{cols.map((col) => <th key={col} className="sticky top-0 bg-[#003087] text-white text-left px-2 py-1 border border-[#002060]">{col}</th>)}</tr>
    </thead>
  );
}
function Cell({ children, right }) {
  return <td className={`border border-slate-200 px-2 py-1 ${right ? 'text-right font-mono' : ''}`}>{children}</td>;
}

function InterestTable({ rows, total, outstanding }) {
  return (
    <Grid>
      <Head cols={['Party', 'Bill', 'Date', 'Days', 'Outstanding', 'Interest']} />
      <tbody>
        {rows.map((row, i) => (
          <tr key={`${row.billNo}-${i}`}>
            <Cell>{row.partyName}</Cell>
            <Cell>{row.billNo}</Cell>
            <Cell>{dmy(row.billDate)}</Cell>
            <Cell right>{row.days}</Cell>
            <Cell right>{num(row.outstanding)}</Cell>
            <Cell right>{num(row.interest)}</Cell>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={6} className="text-center py-6">No pending bills for this interest filter.</td></tr>}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="font-bold bg-slate-100">
            <td colSpan={4} className="px-2 py-1">Total</td>
            <td className="text-right px-2 py-1">{num(outstanding)}</td>
            <td className="text-right px-2 py-1">{num(total)}</td>
          </tr>
        </tfoot>
      )}
    </Grid>
  );
}

function ConfirmTable({ rows, data }) {
  return (
    <Grid>
      <Head cols={['Party', 'Address', 'GSTIN', 'Debit', 'Credit']} />
      <tbody>
        {rows.map((row) => (
          <tr key={row.partyName}>
            <Cell>{row.partyName}</Cell>
            <Cell>{row.address}</Cell>
            <Cell>{row.gstin}</Cell>
            <Cell right>{row.debit ? num(row.debit) : ''}</Cell>
            <Cell right>{row.credit ? num(row.credit) : ''}</Cell>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={5} className="text-center py-6">No party balance on this date.</td></tr>}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="font-bold bg-slate-100">
            <td colSpan={3} className="px-2 py-1">Total as on {dmy(data?.asOn)}</td>
            <td className="text-right px-2 py-1">{num(data?.totalDebit)}</td>
            <td className="text-right px-2 py-1">{num(data?.totalCredit)}</td>
          </tr>
        </tfoot>
      )}
    </Grid>
  );
}

function AboveTable({ rows }) {
  return (
    <Grid>
      <Head cols={['Account', 'Group', 'Debit', 'Credit']} />
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.name}-${row.group}`}>
            <Cell>{row.name}</Cell>
            <Cell>{row.subGroup || row.group}</Cell>
            <Cell right>{row.debit ? num(row.debit) : ''}</Cell>
            <Cell right>{row.credit ? num(row.credit) : ''}</Cell>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={4} className="text-center py-6">No account in this range.</td></tr>}
      </tbody>
    </Grid>
  );
}

function BankTable({ rows, data }) {
  return (
    <Grid>
      <Head cols={['Date', 'Narration', 'Debit', 'Credit', 'Status', 'Voucher', 'Party']} />
      <tbody>
        {rows.map((row) => (
          <tr key={row.index} className={row.status === 'Unmatched' ? 'bg-amber-50' : ''}>
            <Cell>{dmy(row.date)}</Cell>
            <Cell>{row.narration}</Cell>
            <Cell right>{row.debit ? num(row.debit) : ''}</Cell>
            <Cell right>{row.credit ? num(row.credit) : ''}</Cell>
            <Cell>{row.status}</Cell>
            <Cell>{row.match?.voucherNo || ''}</Cell>
            <Cell>{row.match?.partyName || ''}</Cell>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="font-bold bg-slate-100">
          <td colSpan={7} className="px-2 py-1">Matched {data?.matched || 0} · Unmatched {data?.unmatched || 0}</td>
        </tr>
      </tfoot>
    </Grid>
  );
}

function OpeningTable({ rows, data }) {
  return (
    <Grid>
      <Head cols={['Party', 'Opening', 'Type', 'Old receivable', 'Old payable', 'Difference']} />
      <tbody>
        {rows.map((row) => (
          <tr key={row.partyName} className={Math.abs(row.difference) >= 1 ? 'bg-amber-50' : ''}>
            <Cell>{row.partyName}</Cell>
            <Cell right>{num(row.opening)}</Cell>
            <Cell>{row.openingType}</Cell>
            <Cell right>{num(row.receivable)}</Cell>
            <Cell right>{num(row.payable)}</Cell>
            <Cell right>{num(row.difference)}</Cell>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={6} className="text-center py-6">No opening difference before {dmy(data?.fyStart)}.</td></tr>}
      </tbody>
    </Grid>
  );
}

function YearTable({ rows, data }) {
  return (
    <Grid>
      <Head cols={['Party', 'Bills receivable', 'Bills payable', 'Ledger Dr', 'Ledger Cr', 'Difference', 'Note']} />
      <tbody>
        {rows.map((row) => (
          <tr key={row.partyName} className={Math.abs(row.difference) >= 1 ? 'bg-amber-50' : ''}>
            <Cell>{row.partyName}</Cell>
            <Cell right>{num(row.receivable)}</Cell>
            <Cell right>{num(row.payable)}</Cell>
            <Cell right>{num(row.ledgerDebit)}</Cell>
            <Cell right>{num(row.ledgerCredit)}</Cell>
            <Cell right>{num(row.difference)}</Cell>
            <Cell>{row.note}</Cell>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={7} className="text-center py-6">No difference on {dmy(data?.asOn)}.</td></tr>}
      </tbody>
    </Grid>
  );
}
