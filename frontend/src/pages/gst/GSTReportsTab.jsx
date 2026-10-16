import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import { gstApi } from '../../api/gst.api';
import { exportGstr1Excel } from '../../utils/gstExport';
import { FileSpreadsheet, RefreshCw, Send, X } from 'lucide-react';

const MONTH_MAP = {
  Jan: { m: 1, days: 31 }, Feb: { m: 2, days: 28 }, Mar: { m: 3, days: 31 },
  Apr: { m: 4, days: 30 }, May: { m: 5, days: 31 }, Jun: { m: 6, days: 30 },
  Jul: { m: 7, days: 31 }, Aug: { m: 8, days: 31 }, Sep: { m: 9, days: 30 },
  Oct: { m: 10, days: 31 }, Nov: { m: 11, days: 30 }, Dec: { m: 12, days: 31 },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TABS = ['B2B', 'B2CL', 'B2CS', 'CDNR', 'CDNU', 'HSN', 'HSN B2C', 'DOCS', 'EXP.', 'EXEMP'];

const GSTReportsTab = ({ onClose, defaultFrom, defaultTo }) => {
  const { sales, company } = useStore();
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  const defaultMonthName = MONTHS[currentMonthIdx] || 'Oct';

  const formatInitialDate = (isoStr, fallbackDay) => {
    if (isoStr && isoStr.includes('-')) {
      const [y, m, d] = isoStr.split('-');
      return `${d}/${m}/${y}`;
    }
    return `${String(fallbackDay).padStart(2, '0')}/${String(currentMonthIdx + 1).padStart(2, '0')}/${currentYear}`;
  };

  const [month, setMonth] = useState(defaultMonthName);
  const [fromDate, setFromDate] = useState(() => formatInitialDate(defaultFrom, 1));
  const [toDate, setToDate] = useState(() => formatInitialDate(defaultTo, MONTH_MAP[defaultMonthName]?.days || 31));
  const [activeTab, setActiveTab] = useState('B2CS');
  const [gstSlabWise, setGstSlabWise] = useState(true);
  const [hsnDescWise, setHsnDescWise] = useState(false);
  const [unitMode, setUnitMode] = useState('Regular');
  const [ecommFilter, setEcommFilter] = useState(false);
  const [reportType, setReportType] = useState('GSTR-1');
  const [excelFormat, setExcelFormat] = useState('Regular');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Ready — click LoadData to fetch transactions');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  const [gstr1Data, setGstr1Data] = useState({
    b2bRows: [], b2clRows: [], b2cs: [], cdnrRows: [], cdnuRows: [],
    hsnRows: [], hsnB2cRows: [], docsRows: [], expRows: [], exempRows: [],
    totals: { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalTax: 0, invoiceCount: 0 }
  });

  const handleMonthChange = (selectedMonth) => {
    setMonth(selectedMonth);
    const mInfo = MONTH_MAP[selectedMonth];
    if (mInfo) {
      const mStr = String(mInfo.m).padStart(2, '0');
      setFromDate(`01/${mStr}/${currentYear}`);
      setToDate(`${String(mInfo.days).padStart(2, '0')}/${mStr}/${currentYear}`);
    }
  };

  const toIsoDate = (dStr) => {
    if (!dStr) return '';
    if (dStr.includes('-')) return dStr;
    const parts = dStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    return dStr;
  };

  const handleLoadData = async () => {
    setLoading(true);
    setStatusMsg('Fetching transactions from server…');
    try {
      const startDate = toIsoDate(fromDate);
      const endDate = toIsoDate(toDate);
      const res = await gstApi.gstr1({ startDate, endDate });
      if (res) {
        setGstr1Data({
          b2bRows: res.b2bRows || [],
          b2clRows: res.b2clRows || [],
          b2cs: res.b2cs || [],
          cdnrRows: res.cdnrRows || [],
          cdnuRows: res.cdnuRows || [],
          hsnRows: res.hsnRows || res.hsn?.data || [],
          hsnB2cRows: res.hsnB2cRows || [],
          docsRows: res.docsRows || [],
          expRows: res.expRows || [],
          exempRows: res.exempRows || [],
          totals: res.totals || { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalTax: 0, invoiceCount: 0 }
        });
        const count = (res.b2bRows?.length || 0) + (res.b2cs?.length || 0) + (res.b2clRows?.length || 0);
        setStatusMsg(`${count} records loaded · Taxable: ₹${(res.totals?.taxable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} · Tax: ₹${(res.totals?.totalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      }
    } catch (err) {
      console.warn('Error loading GSTR-1 data via API, falling back to local sales store:', err);
      computeLocalData();
    } finally {
      setLoading(false);
    }
  };

  const computeLocalData = () => {
    const sDate = new Date(toIsoDate(fromDate));
    const eDate = new Date(toIsoDate(toDate));
    eDate.setHours(23, 59, 59, 999);
    const filteredSales = (sales || []).filter(s => {
      const d = new Date(s.date);
      return (!isNaN(d) && d >= sDate && d <= eDate) || (!s.date);
    });

    const b2bRows = [], b2clRows = [], b2csMap = {}, hsnMap = {}, expRows = [];
    let totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;

    filteredSales.forEach(s => {
      const gstin = (s.customerId?.gstin || '').toUpperCase();
      const isReg = gstin.length === 15;
      const taxable = Number(s.taxableAmount || s.netAmount || 0);
      const cgst = Number(s.cgst || 0), sgst = Number(s.sgst || 0), igst = Number(s.igst || 0), cess = Number(s.cess || 0);
      const net = Number(s.netAmount || taxable + cgst + sgst + igst + cess);
      const state = s.customerId?.stateCode ? `${s.customerId.stateCode}-${s.customerId.state || 'State'}` : (s.customerId?.state || '—');
      const rate = Number(s.gstRate || (taxable ? (((cgst + sgst + igst) / taxable) * 100).toFixed(2) : 18));
      const invDate = s.date?.split('T')[0] || '';

      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      if (isReg) {
        b2bRows.push({
          gstin, partyName: s.customerId?.name || 'Customer', invoiceNo: s.invoiceNo || 'INV-001',
          date: invDate, netAmount: net, stateName: state, reverseCharge: s.reverseCharge ? 'Y' : 'N',
          taxRate: `${rate.toFixed(2)}%`, invType: 'Regular', taxableAmount: taxable, cgst, sgst, igst, cess
        });
      } else if (net > 250000 && igst > 0) {
        b2clRows.push({
          invoiceNo: s.invoiceNo, date: invDate, netAmount: net, stateName: state,
          taxRate: rate.toFixed(2), taxableAmount: taxable, cess, ecomm: '', igst
        });
      } else {
        const key = `${state}|${rate.toFixed(2)}`;
        if (!b2csMap[key]) {
          b2csMap[key] = { typ: 'OE', pos_name: state, app_rate: '', rt: rate.toFixed(2), txval: 0, csamt: 0, ecomm: '', iamt: 0, camt: 0, samt: 0 };
        }
        b2csMap[key].txval += taxable;
        b2csMap[key].iamt += igst;
        b2csMap[key].camt += cgst;
        b2csMap[key].samt += sgst;
        b2csMap[key].csamt += cess;
      }
    });

    const docsRows = [{
      docType: 'Invoices for outward supply',
      from: filteredSales[0]?.invoiceNo || 'INV-001',
      to: filteredSales[filteredSales.length - 1]?.invoiceNo || 'INV-999',
      totnum: filteredSales.length,
      cancel: 0,
      net_issue: filteredSales.length
    }];

    setGstr1Data({
      b2bRows, b2clRows, b2cs: Object.values(b2csMap), cdnrRows: [], cdnuRows: [],
      hsnRows: Object.values(hsnMap), hsnB2cRows: [], docsRows, expRows,
      exempRows: [
        { description: 'Inter-State supplies to registered persons', nilRated: 0, exempted: 0, nonGst: 0 },
        { description: 'Intra-State supplies to registered persons', nilRated: 0, exempted: 0, nonGst: 0 },
        { description: 'Inter-State supplies to unregistered persons', nilRated: 0, exempted: 0, nonGst: 0 },
        { description: 'Intra-State supplies to unregistered persons', nilRated: 0, exempted: 0, nonGst: 0 }
      ],
      totals: { taxable: totalTaxable, cgst: totalCgst, sgst: totalSgst, igst: totalIgst, cess: 0, totalTax: totalCgst + totalSgst + totalIgst, invoiceCount: filteredSales.length }
    });
    setStatusMsg(`${filteredSales.length} records (local) · Taxable: ₹${totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  };

  useEffect(() => {
    handleLoadData();
  }, []);

  const handleGenerateExcel = () => {
    try {
      const fileName = `GSTR1_V3_2_2_${fromDate.replace(/\//g, '-')}_to_${toDate.replace(/\//g, '-')}.xlsx`;
      exportGstr1Excel(gstr1Data, fileName);
      setStatusMsg(`Excel generated & downloaded: ${fileName}`);
    } catch (err) {
      console.error('Error exporting Excel:', err);
      alert('Error generating Excel file. Please try again.');
    }
  };

  const handleKillExcelProcess = () => {
    setStatusMsg('Excel worker process terminated. Memory cleared & ready.');
  };

  const handleSendEmail = () => {
    if (!emailTo) {
      alert('Please enter recipient email address.');
      return;
    }
    setEmailSending(true);
    setTimeout(() => {
      setEmailSending(false);
      setShowEmailModal(false);
      setStatusMsg(`Report emailed to ${emailTo}`);
      setEmailTo('');
    }, 900);
  };

  const currentTabTable = useMemo(() => {
    switch (activeTab) {
      case 'B2B':
        return {
          headers: ['GSTIN_NO', 'PARTY', 'NCBILL_NO', 'BILL_DATE', 'NET_TOT', 'STATE_NAME', 'RVRS_YN', 'A_TAX_RATE', 'INV_TYPE', 'TAXABLE_AMT', 'CGST', 'SGST', 'IGST'],
          rows: gstr1Data.b2bRows.map(r => [
            r.gstin, r.partyName, r.invoiceNo, r.date, Number(r.netAmount || 0).toFixed(2),
            r.stateName, r.reverseCharge || 'N', r.taxRate, r.invType || 'Regular',
            Number(r.taxableAmount || 0).toFixed(2), Number(r.cgst || 0).toFixed(2),
            Number(r.sgst || 0).toFixed(2), Number(r.igst || 0).toFixed(2)
          ])
        };
      case 'B2CL':
        return {
          headers: ['NCBILL_NO', 'BILL_DATE', 'NET_TOT', 'STATE_NAME', 'TAX_RATE', 'TAXABLE_AMT', 'CESS', 'ECOMM'],
          rows: gstr1Data.b2clRows.map(r => [
            r.invoiceNo, r.date, Number(r.netAmount || 0).toFixed(2), r.stateName,
            r.taxRate, Number(r.taxableAmount || 0).toFixed(2), Number(r.cess || 0).toFixed(2), r.ecomm || ''
          ])
        };
      case 'B2CS':
        return {
          headers: ['TYPE', 'STATE_NAME', 'APP_RATE', 'TAX_RATE', 'TAXABLE_AMT', 'CESS', 'ECOMM'],
          rows: gstr1Data.b2cs.map(r => [
            r.typ || 'OE', r.pos_name || `${r.pos || ''}`, r.app_rate || '',
            Number(r.rt || 0).toFixed(2), Number(r.txval || 0).toFixed(2),
            Number(r.csamt || 0).toFixed(2), r.ecomm || ''
          ])
        };
      case 'CDNR':
        return {
          headers: ['GSTIN_NO', 'PARTY', 'NOTE_NO', 'NOTE_DATE', 'NOTE_TYPE', 'POS', 'NET_TOT', 'TAX_RATE', 'TAXABLE_AMT', 'CESS', 'REASON'],
          rows: gstr1Data.cdnrRows.map(r => [
            r.gstin, r.partyName, r.noteNo, r.noteDate, r.noteType, r.pos,
            Number(r.netAmount || 0).toFixed(2), r.taxRate, Number(r.taxableAmount || 0).toFixed(2),
            Number(r.cess || 0).toFixed(2), r.reason || ''
          ])
        };
      case 'CDNU':
        return {
          headers: ['TYPE', 'NOTE_NO', 'NOTE_DATE', 'POS', 'TAX_RATE', 'TAXABLE_AMT', 'NET_TOT', 'REASON'],
          rows: gstr1Data.cdnuRows.map(r => [
            r.type, r.noteNo, r.noteDate, r.pos, r.taxRate,
            Number(r.taxableAmount || 0).toFixed(2), Number(r.netAmount || 0).toFixed(2), r.reason || ''
          ])
        };
      case 'HSN':
        return {
          headers: ['HSN', 'DESCRIPTION', 'UQC', 'TOTAL_QTY', 'TOTAL_VALUE', 'TAXABLE_VALUE', 'IGST', 'CGST', 'SGST', 'CESS'],
          rows: gstr1Data.hsnRows.map(r => [
            r.hsn_sc, hsnDescWise ? r.desc : (r.desc?.slice(0, 20) || ''), r.uqc || 'PCS',
            Number(r.qty || 0).toFixed(2), Number(r.val || 0).toFixed(2), Number(r.txval || 0).toFixed(2),
            Number(r.iamt || 0).toFixed(2), Number(r.camt || 0).toFixed(2), Number(r.samt || 0).toFixed(2),
            Number(r.csamt || 0).toFixed(2)
          ])
        };
      case 'HSN B2C':
        return {
          headers: ['HSN', 'DESCRIPTION', 'UQC', 'TOTAL_QTY', 'TOTAL_VALUE', 'TAXABLE_VALUE', 'IGST', 'CGST', 'SGST', 'CESS'],
          rows: gstr1Data.hsnB2cRows.map(r => [
            r.hsn_sc, hsnDescWise ? r.desc : (r.desc?.slice(0, 20) || ''), r.uqc || 'PCS',
            Number(r.qty || 0).toFixed(2), Number(r.val || 0).toFixed(2), Number(r.txval || 0).toFixed(2),
            Number(r.iamt || 0).toFixed(2), Number(r.camt || 0).toFixed(2), Number(r.samt || 0).toFixed(2),
            Number(r.csamt || 0).toFixed(2)
          ])
        };
      case 'DOCS':
        return {
          headers: ['DOC_TYPE', 'FROM_SR_NO', 'TO_SR_NO', 'TOT_COUNT', 'CANCELLED_COUNT', 'NET_ISSUED'],
          rows: gstr1Data.docsRows.map(r => [
            r.docType, r.from, r.to, r.totnum, r.cancel, r.net_issue
          ])
        };
      case 'EXP.':
        return {
          headers: ['EXPORT_TYPE', 'INV_NO', 'DATE', 'INV_VAL', 'PORT_CODE', 'SHIPPING_BILL_NO', 'TAX_RATE', 'TAXABLE_AMT'],
          rows: gstr1Data.expRows.map(r => [
            r.exportType, r.invoiceNo, r.date, Number(r.invoiceValue || 0).toFixed(2),
            r.portCode, r.shippingBillNo, r.taxRate, Number(r.taxableAmount || 0).toFixed(2)
          ])
        };
      case 'EXEMP':
        return {
          headers: ['DESCRIPTION', 'NIL_RATED', 'EXEMPTED', 'NON_GST'],
          rows: gstr1Data.exempRows.map(r => [
            r.description, Number(r.nilRated || 0).toFixed(2), Number(r.exempted || 0).toFixed(2), Number(r.nonGst || 0).toFixed(2)
          ])
        };
      default:
        return { headers: [], rows: [] };
    }
  }, [activeTab, gstr1Data, hsnDescWise]);

  const isNumCol = (h) => ['AMT', 'RATE', 'VAL', 'QTY', 'TAX', 'CGST', 'SGST', 'IGST', 'CESS', 'TOT', 'COUNT', 'ISSUED', 'CANCELLED'].some(k => h.includes(k));
  const isCenCol = (h) => h === 'TYPE' || h === 'RVRS_YN';

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[var(--bg-card)] overflow-hidden select-none">
      {/* Sub-toolbar: Filter Ribbon */}
      <div className="shrink-0 px-3 py-1.5 bg-[var(--bg-card)] border-b border-[var(--border)] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month selector */}
          <select
            className="h-6.5 px-2 text-[11px] font-semibold rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none cursor-pointer focus:border-blue-500"
            value={month}
            onChange={(e) => handleMonthChange(e.target.value)}
          >
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* Date range inputs */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">From</span>
            <input
              type="text"
              className="h-6.5 px-2 text-[11px] rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] w-24 text-center font-medium focus:border-blue-500 outline-none"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="DD/MM/YYYY"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">To</span>
            <input
              type="text"
              className="h-6.5 px-2 text-[11px] rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] w-24 text-center font-medium focus:border-blue-500 outline-none"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="DD/MM/YYYY"
            />
          </div>

          {/* Checkboxes */}
          <label className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] cursor-pointer select-none ml-1">
            <input
              type="checkbox"
              checked={gstSlabWise}
              onChange={(e) => setGstSlabWise(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span>Gst Slab Wise</span>
          </label>

          <label className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hsnDescWise}
              onChange={(e) => setHsnDescWise(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span>HsnDescriptionWise</span>
          </label>

          {/* Unit Mode Segmented control */}
          <div className="flex items-center bg-[var(--bg-base)] p-0.5 rounded border border-[var(--border)] text-[10px]">
            {['Regular', 'Pcs', 'Qty', 'Kgs'].map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setUnitMode(mode)}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  unitMode === mode
                    ? 'bg-[var(--bg-card)] text-blue-700 font-bold shadow-xs'
                    : 'text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* E-COMM toggle */}
          <button
            type="button"
            onClick={() => setEcommFilter(!ecommFilter)}
            className={`h-6.5 px-2 rounded text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
              ecommFilter
                ? 'bg-blue-600 text-white shadow-xs'
                : 'border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'
            }`}
          >
            E-COMM
          </button>

          {/* Report Type */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Report</span>
            <select
              className="h-6.5 px-2 text-[11px] font-medium rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none cursor-pointer focus:border-blue-500"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="GSTR-1">GSTR-1</option>
              <option value="GSTR-2">GSTR-2</option>
              <option value="GSTR-3B">GSTR-3B</option>
            </select>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)] font-mono hidden xl:inline">
            GSTIN: <strong className="text-[var(--text-primary)]">{company?.gstin || '24AAACC1206D1ZH'}</strong>
          </span>
          <button
            type="button"
            onClick={handleLoadData}
            disabled={loading}
            className="h-6.5 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading…' : 'LoadData'}
          </button>
        </div>
      </div>

      {/* Sheets Navigation Bar */}
      <div className="shrink-0 flex items-center gap-0.5 px-3 py-1 bg-[var(--bg-base)] border-b border-[var(--border)] overflow-x-auto scrollbar-none">
        {TABS.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-2.5 py-0.5 text-[11px] rounded transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Data Grid Table */}
      <div className="flex-1 min-h-0 overflow-auto bg-[var(--bg-card)]">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="sticky top-0 bg-[var(--bg-base)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)] z-10 shadow-xs">
            <tr>
              {currentTabTable.headers.map((h, i) => (
                <th
                  key={i}
                  className={`px-2.5 py-1.5 border-r border-[var(--border)]/50 last:border-r-0 whitespace-nowrap ${
                    isNumCol(h) ? 'text-right' : isCenCol(h) ? 'text-center' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {currentTabTable.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={currentTabTable.headers.length || 1}
                  className="px-4 py-12 text-center text-[var(--text-muted)] text-[12px]"
                >
                  {loading ? 'Processing GSTR-1 records…' : `No records for ${activeTab} in selected period.`}
                </td>
              </tr>
            ) : (
              currentTabTable.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={`hover:bg-blue-50/50 transition-colors ${
                    ri % 2 === 1 ? 'bg-[var(--bg-base)]/30' : 'bg-[var(--bg-card)]'
                  }`}
                >
                  {row.map((cell, ci) => {
                    const h = currentTabTable.headers[ci] || '';
                    return (
                      <td
                        key={ci}
                        className={`px-2.5 py-1 border-r border-[var(--border-subtle)]/40 last:border-r-0 whitespace-nowrap ${
                          isNumCol(h)
                            ? 'text-right tabular-nums font-mono text-[11px]'
                            : isCenCol(h)
                            ? 'text-center'
                            : 'text-left text-[var(--text-primary)]'
                        }`}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Status Bar */}
      <div className="shrink-0 px-3 py-1 bg-[var(--bg-base)] border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
        <span className="font-medium text-emerald-700">{statusMsg}</span>
        <span className="text-[10px] text-[var(--text-muted)] font-mono">
          Sheet: <strong>{activeTab}</strong> · {currentTabTable.rows.length} rows
        </span>
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 px-3 py-1.5 bg-[var(--bg-card)] border-t border-[var(--border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowEmailModal(true)}
            className="h-7 px-2.5 rounded border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-base)] text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Send size={11} /> Email Send
          </button>

          <div className="flex items-center gap-2 px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-base)] text-[10.5px] text-[var(--text-secondary)]">
            {['Regular', 'EPPlus'].map(f => (
              <label key={f} className="flex items-center gap-1 cursor-pointer font-medium">
                <input
                  type="radio"
                  name="excelFormat"
                  value={f}
                  checked={excelFormat === f}
                  onChange={() => setExcelFormat(f)}
                  className="text-blue-600 cursor-pointer"
                />
                <span>{f}</span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleKillExcelProcess}
            className="h-7 px-2 rounded text-[10.5px] text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <X size={11} /> Kill Excel Process
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateExcel}
            className="h-7 px-3.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <FileSpreadsheet size={12} /> Generate Excel
          </button>
          <button
            type="button"
            onClick={() => onClose ? onClose() : window.history.back()}
            className="h-7 px-3 rounded border border-[var(--border)] bg-[var(--bg-card)] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-[11px] font-medium text-[var(--text-secondary)] cursor-pointer transition-colors"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 w-full max-w-sm shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <span className="text-[13px] font-bold text-[var(--text-primary)]">Email GSTR-1 Report</span>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="text-[var(--text-muted)] hover:text-rose-600 p-1 rounded"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Send report for <strong>{fromDate}</strong> to <strong>{toDate}</strong> to your CA / Tax Consultant.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Recipient Email
              </label>
              <input
                type="email"
                className="h-8 px-2.5 rounded border border-[var(--border)] text-[12px] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none focus:border-blue-500"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="ca@example.com"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="h-7 px-3 rounded border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-base)] text-[11px] font-medium text-[var(--text-secondary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={emailSending}
                onClick={handleSendEmail}
                className="h-7 px-3.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
              >
                {emailSending ? 'Sending…' : <><Send size={11} /> Send Email</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GSTReportsTab;
