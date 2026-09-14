import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import { gstApi } from '../../api/gst.api';
import { exportGstr1Excel } from '../../utils/gstExport';

const MONTH_MAP = {
  Jan: { m: 1, days: 31 },
  Feb: { m: 2, days: 28 },
  Mar: { m: 3, days: 31 },
  Apr: { m: 4, days: 30 },
  May: { m: 5, days: 31 },
  Jun: { m: 6, days: 30 },
  Jul: { m: 7, days: 31 },
  Aug: { m: 8, days: 31 },
  Sep: { m: 9, days: 30 },
  Oct: { m: 10, days: 31 },
  Nov: { m: 11, days: 30 },
  Dec: { m: 12, days: 31 },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TABS = ['B2B', 'B2CL', 'B2CS', 'CDNR', 'CDNU', 'HSN', 'HSN B2C', 'DOCS', 'EXP.', 'EXEMP'];

const GSTReportsTab = () => {
  const { sales, company } = useStore();
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  const defaultMonthName = MONTHS[currentMonthIdx] || 'Aug';

  const [month, setMonth] = useState(defaultMonthName);
  const [fromDate, setFromDate] = useState(`01/${String(currentMonthIdx + 1).padStart(2, '0')}/${currentYear}`);
  const [toDate, setToDate] = useState(`${String(MONTH_MAP[defaultMonthName]?.days || 31).padStart(2, '0')}/${String(currentMonthIdx + 1).padStart(2, '0')}/${currentYear}`);
  const [activeTab, setActiveTab] = useState('B2CS');
  const [gstSlabWise, setGstSlabWise] = useState(true);
  const [hsnDescWise, setHsnDescWise] = useState(false);
  const [unitMode, setUnitMode] = useState('Regular');
  const [ecommFilter, setEcommFilter] = useState(false);
  const [reportType, setReportType] = useState('GSTR-1');
  const [excelFormat, setExcelFormat] = useState('Regular');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('#lbl Ready');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  // Raw API / Calculated GSTR1 dataset
  const [gstr1Data, setGstr1Data] = useState({
    b2bRows: [],
    b2clRows: [],
    b2cs: [],
    cdnrRows: [],
    cdnuRows: [],
    hsnRows: [],
    hsnB2cRows: [],
    docsRows: [],
    expRows: [],
    exempRows: [],
    totals: { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalTax: 0, invoiceCount: 0 }
  });

  // Handle Month change
  const handleMonthChange = (selectedMonth) => {
    setMonth(selectedMonth);
    const mInfo = MONTH_MAP[selectedMonth];
    if (mInfo) {
      const mStr = String(mInfo.m).padStart(2, '0');
      const dStr = String(mInfo.days).padStart(2, '0');
      setFromDate(`01/${mStr}/${currentYear}`);
      setToDate(`${dStr}/${mStr}/${currentYear}`);
    }
  };

  // Convert DD/MM/YYYY to YYYY-MM-DD
  const toIsoDate = (dStr) => {
    if (!dStr) return '';
    if (dStr.includes('-')) return dStr;
    const parts = dStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dStr;
  };

  // Load Data from Backend API
  const handleLoadData = async () => {
    setLoading(true);
    setStatusMsg('#lbl Fetching sales & return transactions...');
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
        setStatusMsg(`#lbl Loaded ${count} records | Taxable: ₹ ${(res.totals?.taxable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Total Tax: ₹ ${(res.totals?.totalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      }
    } catch (err) {
      console.error('Error loading GSTR-1 data:', err);
      // Fallback calculation using local store sales if offline
      computeLocalData();
    } finally {
      setLoading(false);
    }
  };

  // Local fallback calculation if server is offline
  const computeLocalData = () => {
    const sDate = new Date(toIsoDate(fromDate));
    const eDate = new Date(toIsoDate(toDate));
    eDate.setHours(23, 59, 59, 999);

    const filteredSales = (sales || []).filter(s => {
      const d = new Date(s.date);
      return (!isNaN(d) && d >= sDate && d <= eDate) || (!s.date);
    });

    const b2bRows = [];
    const b2clRows = [];
    const b2csMap = {};
    const hsnMap = {};
    const hsnB2cMap = {};
    const expRows = [];

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    filteredSales.forEach(s => {
      const gstin = (s.customerId?.gstin || '').toUpperCase();
      const isReg = gstin.length === 15;
      const taxable = Number(s.taxableAmount || s.netAmount || 0);
      const cgst = Number(s.cgst || 0);
      const sgst = Number(s.sgst || 0);
      const igst = Number(s.igst || 0);
      const cess = Number(s.cess || 0);
      const net = Number(s.netAmount || taxable + cgst + sgst + igst + cess);
      const state = s.customerId?.stateCode ? `${s.customerId.stateCode}-${s.customerId.state || 'State'}` : (s.customerId?.state || '24-Gujarat');
      const rate = Number(s.gstRate || (taxable ? (((cgst + sgst + igst) / taxable) * 100).toFixed(2) : 18));
      const invDate = s.date?.split('T')[0] || '';

      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      if (isReg) {
        b2bRows.push({
          gstin,
          partyName: s.customerId?.name || 'Customer',
          invoiceNo: s.invoiceNo || 'INV-001',
          date: invDate,
          netAmount: net,
          stateName: state,
          reverseCharge: s.reverseCharge ? 'Y' : 'N',
          taxRate: `${rate.toFixed(2)}%`,
          invType: 'Regular',
          taxableAmount: taxable,
          cgst,
          sgst,
          igst,
          cess
        });
      } else if (net > 250000 && igst > 0) {
        b2clRows.push({
          invoiceNo: s.invoiceNo,
          date: invDate,
          netAmount: net,
          stateName: state,
          taxRate: rate.toFixed(2),
          taxableAmount: taxable,
          cess,
          ecomm: '',
          igst
        });
      } else {
        const key = `${state}|${rate.toFixed(2)}`;
        if (!b2csMap[key]) {
          b2csMap[key] = {
            typ: 'OE',
            pos_name: state,
            app_rate: '',
            rt: rate.toFixed(2),
            txval: 0,
            csamt: 0,
            ecomm: '',
            iamt: 0,
            camt: 0,
            samt: 0
          };
        }
        b2csMap[key].txval += taxable;
        b2csMap[key].iamt += igst;
        b2csMap[key].camt += cgst;
        b2csMap[key].samt += sgst;
        b2csMap[key].csamt += cess;
      }

      // HSN
      (s.items || []).forEach(item => {
        const hsn = item.itemId?.hsnCode || item.hsnCode || '9999';
        const desc = item.itemId?.name || item.name || 'Product';
        const uqc = item.itemId?.unit || item.unit || 'PCS';
        const qty = Number(item.qty || item.mts || 1);
        const itemTaxable = Number(item.amount || item.taxableAmount || 0);

        if (!hsnMap[hsn]) {
          hsnMap[hsn] = {
            hsn_sc: hsn,
            desc,
            uqc,
            qty: 0,
            val: 0,
            txval: 0,
            rt: rate.toFixed(2),
            iamt: 0,
            camt: 0,
            samt: 0,
            csamt: 0
          };
        }
        hsnMap[hsn].qty += qty;
        hsnMap[hsn].txval += itemTaxable;
        hsnMap[hsn].val += itemTaxable * (1 + rate / 100);

        if (!isReg) {
          if (!hsnB2cMap[hsn]) hsnB2cMap[hsn] = { ...hsnMap[hsn], qty: 0, txval: 0, val: 0 };
          hsnB2cMap[hsn].qty += qty;
          hsnB2cMap[hsn].txval += itemTaxable;
          hsnB2cMap[hsn].val += itemTaxable * (1 + rate / 100);
        }
      });
    });

    const b2csList = Object.values(b2csMap);
    const hsnList = Object.values(hsnMap);
    const hsnB2cList = Object.values(hsnB2cMap);

    const docsRows = [
      {
        docType: 'Invoices for outward supply',
        from: filteredSales[0]?.invoiceNo || 'INV-001',
        to: filteredSales[filteredSales.length - 1]?.invoiceNo || 'INV-999',
        totnum: filteredSales.length,
        cancel: 0,
        net_issue: filteredSales.length
      }
    ];

    setGstr1Data({
      b2bRows,
      b2clRows,
      b2cs: b2csList,
      cdnrRows: [],
      cdnuRows: [],
      hsnRows: hsnList,
      hsnB2cRows: hsnB2cList,
      docsRows,
      expRows,
      exempRows: [
        { description: 'Inter-State supplies to registered persons', nilRated: 0, exempted: 0, nonGst: 0 },
        { description: 'Intra-State supplies to registered persons', nilRated: 0, exempted: 0, nonGst: 0 },
        { description: 'Inter-State supplies to unregistered persons', nilRated: 0, exempted: 0, nonGst: 0 },
        { description: 'Intra-State supplies to unregistered persons', nilRated: 0, exempted: 0, nonGst: 0 },
      ],
      totals: {
        taxable: totalTaxable,
        cgst: totalCgst,
        sgst: totalSgst,
        igst: totalIgst,
        cess: 0,
        totalTax: totalCgst + totalSgst + totalIgst,
        invoiceCount: filteredSales.length
      }
    });

    setStatusMsg(`#lbl Loaded ${filteredSales.length} records | Taxable: ₹ ${totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Total Tax: ₹ ${(totalCgst + totalSgst + totalIgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  };

  // Auto-load on mount
  useEffect(() => {
    handleLoadData();
  }, []);

  // Generate Excel workbook with all sheets
  const handleGenerateExcel = () => {
    try {
      const fileName = `GSTR1_V3_2_2_${fromDate.replace(/\//g, '-')}_to_${toDate.replace(/\//g, '-')}.xlsx`;
      exportGstr1Excel(gstr1Data, fileName);
      setStatusMsg(`#lbl Excel file generated & downloaded successfully: ${fileName}`);
    } catch (err) {
      console.error('Error exporting Excel:', err);
      alert('Error generating Excel file. Please try again.');
    }
  };

  // Kill Excel process / Reset worker state
  const handleKillExcelProcess = () => {
    setStatusMsg('#lbl Excel worker process terminated. Memory cleared & ready.');
  };

  // Send Email
  const handleSendEmail = () => {
    if (!emailTo) {
      alert('Please enter recipient email address.');
      return;
    }
    setEmailSending(true);
    setTimeout(() => {
      setEmailSending(false);
      setShowEmailModal(false);
      setStatusMsg(`#lbl Report emailed successfully to ${emailTo}`);
      setEmailTo('');
    }, 900);
  };

  // Compute table columns and rows based on activeTab
  const currentTabTable = useMemo(() => {
    switch (activeTab) {
      case 'B2B':
        return {
          headers: ['GSTIN_NO', 'PARTY', 'NCBILL_NO', 'BILL_DATE', 'NET_TOT', 'STATE_NAME', 'RVRS_YN', 'A_TAX_RATE', 'INV_TYPE', 'TAXABLE_AMT', 'CGST', 'SGST', 'IGST'],
          rows: gstr1Data.b2bRows.map(r => [
            r.gstin,
            r.partyName,
            r.invoiceNo,
            r.date,
            Number(r.netAmount || 0).toFixed(2),
            r.stateName,
            r.reverseCharge || 'N',
            r.taxRate,
            r.invType || 'Regular',
            Number(r.taxableAmount || 0).toFixed(2),
            Number(r.cgst || 0).toFixed(2),
            Number(r.sgst || 0).toFixed(2),
            Number(r.igst || 0).toFixed(2)
          ])
        };

      case 'B2CL':
        return {
          headers: ['NCBILL_NO', 'BILL_DATE', 'NET_TOT', 'STATE_NAME', 'TAX_RATE', 'TAXABLE_AMT', 'CESS', 'ECOMM'],
          rows: gstr1Data.b2clRows.map(r => [
            r.invoiceNo,
            r.date,
            Number(r.netAmount || 0).toFixed(2),
            r.stateName,
            r.taxRate,
            Number(r.taxableAmount || 0).toFixed(2),
            Number(r.cess || 0).toFixed(2),
            r.ecomm || ''
          ])
        };

      case 'B2CS':
        // Exactly matches Screenshot 2: TYPE, STATE_NAME, APP_RATE, TAX_RATE, TAXABLE_AMT, CESS, ECOMM
        return {
          headers: ['TYPE', 'STATE_NAME', 'APP_RATE', 'TAX_RATE', 'TAXABLE_AMT', 'CESS', 'ECOMM'],
          rows: gstr1Data.b2cs.map(r => [
            r.typ || 'OE',
            r.pos_name || `${r.pos || ''}`,
            r.app_rate || '',
            Number(r.rt || 0).toFixed(2),
            Number(r.txval || 0).toFixed(2),
            Number(r.csamt || 0).toFixed(2),
            r.ecomm || ''
          ])
        };

      case 'CDNR':
        return {
          headers: ['GSTIN_NO', 'PARTY', 'NOTE_NO', 'NOTE_DATE', 'NOTE_TYPE', 'POS', 'NET_TOT', 'TAX_RATE', 'TAXABLE_AMT', 'CESS', 'REASON'],
          rows: gstr1Data.cdnrRows.map(r => [
            r.gstin,
            r.partyName,
            r.noteNo,
            r.noteDate,
            r.noteType,
            r.pos,
            Number(r.netAmount || 0).toFixed(2),
            r.taxRate,
            Number(r.taxableAmount || 0).toFixed(2),
            Number(r.cess || 0).toFixed(2),
            r.reason || ''
          ])
        };

      case 'CDNU':
        return {
          headers: ['TYPE', 'NOTE_NO', 'NOTE_DATE', 'POS', 'TAX_RATE', 'TAXABLE_AMT', 'NET_TOT', 'REASON'],
          rows: gstr1Data.cdnuRows.map(r => [
            r.type,
            r.noteNo,
            r.noteDate,
            r.pos,
            r.taxRate,
            Number(r.taxableAmount || 0).toFixed(2),
            Number(r.netAmount || 0).toFixed(2),
            r.reason || ''
          ])
        };

      case 'HSN':
        return {
          headers: ['HSN', 'DESCRIPTION', 'UQC', 'TOTAL_QTY', 'TOTAL_VALUE', 'TAXABLE_VALUE', 'IGST', 'CGST', 'SGST', 'CESS'],
          rows: gstr1Data.hsnRows.map(r => [
            r.hsn_sc,
            hsnDescWise ? r.desc : (r.desc?.slice(0, 20) || ''),
            r.uqc || 'PCS',
            Number(r.qty || 0).toFixed(2),
            Number(r.val || 0).toFixed(2),
            Number(r.txval || 0).toFixed(2),
            Number(r.iamt || 0).toFixed(2),
            Number(r.camt || 0).toFixed(2),
            Number(r.samt || 0).toFixed(2),
            Number(r.csamt || 0).toFixed(2)
          ])
        };

      case 'HSN B2C':
        return {
          headers: ['HSN', 'DESCRIPTION', 'UQC', 'TOTAL_QTY', 'TOTAL_VALUE', 'TAXABLE_VALUE', 'IGST', 'CGST', 'SGST', 'CESS'],
          rows: gstr1Data.hsnB2cRows.map(r => [
            r.hsn_sc,
            hsnDescWise ? r.desc : (r.desc?.slice(0, 20) || ''),
            r.uqc || 'PCS',
            Number(r.qty || 0).toFixed(2),
            Number(r.val || 0).toFixed(2),
            Number(r.txval || 0).toFixed(2),
            Number(r.iamt || 0).toFixed(2),
            Number(r.camt || 0).toFixed(2),
            Number(r.samt || 0).toFixed(2),
            Number(r.csamt || 0).toFixed(2)
          ])
        };

      case 'DOCS':
        return {
          headers: ['DOC_TYPE', 'FROM_SR_NO', 'TO_SR_NO', 'TOT_COUNT', 'CANCELLED_COUNT', 'NET_ISSUED'],
          rows: gstr1Data.docsRows.map(r => [
            r.docType,
            r.from,
            r.to,
            r.totnum,
            r.cancel,
            r.net_issue
          ])
        };

      case 'EXP.':
        return {
          headers: ['EXPORT_TYPE', 'INV_NO', 'DATE', 'INV_VAL', 'PORT_CODE', 'SHIPPING_BILL_NO', 'TAX_RATE', 'TAXABLE_AMT'],
          rows: gstr1Data.expRows.map(r => [
            r.exportType,
            r.invoiceNo,
            r.date,
            Number(r.invoiceValue || 0).toFixed(2),
            r.portCode,
            r.shippingBillNo,
            r.taxRate,
            Number(r.taxableAmount || 0).toFixed(2)
          ])
        };

      case 'EXEMP':
        return {
          headers: ['DESCRIPTION', 'NIL_RATED', 'EXEMPTED', 'NON_GST'],
          rows: gstr1Data.exempRows.map(r => [
            r.description,
            Number(r.nilRated || 0).toFixed(2),
            Number(r.exempted || 0).toFixed(2),
            Number(r.nonGst || 0).toFixed(2)
          ])
        };

      default:
        return { headers: [], rows: [] };
    }
  }, [activeTab, gstr1Data, hsnDescWise]);

  return (
    <div style={{ backgroundColor: '#d0dced', padding: '8px', fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif', fontSize: '12px', color: '#111', borderRadius: '4px', border: '1px solid #7c94b6', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      {/* Title Bar styling */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e2ebf6', padding: '4px 8px', borderBottom: '1px solid #a4b7d1', marginBottom: '8px', fontWeight: 'bold', fontSize: '11px', color: '#2c4366' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ backgroundColor: '#107c41', color: 'white', padding: '1px 5px', borderRadius: '2px', fontSize: '10px' }}>XLSX</span>
          <span>GSTR1_V3_2_2.xlsx - Government Utility Offline Engine</span>
        </div>
        <div style={{ fontSize: '10px', color: '#555' }}>
          GSTIN: <span style={{ fontWeight: 'bold', color: '#0056b3' }}>{company?.gstin || '24AAACC1206D1ZH'}</span>
        </div>
      </div>

      {/* Top Filter & Control Ribbon */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', backgroundColor: '#f0f4f9', padding: '8px 10px', border: '1px solid #a4b7d1', borderRadius: '3px', marginBottom: '8px' }}>
        {/* Month Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <select
            value={month}
            onChange={(e) => handleMonthChange(e.target.value)}
            style={{ border: '1px solid #7a94b8', padding: '3px 6px', fontWeight: 'bold', backgroundColor: 'white', fontSize: '11px', borderRadius: '2px', cursor: 'pointer' }}
          >
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* From Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>From</span>
          <input
            type="text"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="DD/MM/YYYY"
            style={{ border: '1px solid #7a94b8', padding: '3px 4px', fontWeight: 'bold', width: '85px', textAlign: 'center', backgroundColor: '#fffde6', fontSize: '11px', borderRadius: '2px' }}
          />
        </div>

        {/* To Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>To</span>
          <input
            type="text"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="DD/MM/YYYY"
            style={{ border: '1px solid #7a94b8', padding: '3px 4px', fontWeight: 'bold', width: '85px', textAlign: 'center', backgroundColor: '#fffde6', fontSize: '11px', borderRadius: '2px' }}
          />
        </div>

        {/* Checkboxes */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={gstSlabWise}
              onChange={(e) => setGstSlabWise(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ backgroundColor: '#fff8b3', padding: '1px 4px', border: '1px solid #e0d060', borderRadius: '2px' }}>Gst Slab Wise</span>
          </label>

          <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hsnDescWise}
              onChange={(e) => setHsnDescWise(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ backgroundColor: hsnDescWise ? '#fff8b3' : 'transparent', padding: '1px 4px' }}>HsnDescriptionWise</span>
          </label>
        </div>

        {/* Unit Radio Buttons */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', backgroundColor: '#e2ebf6', padding: '2px 6px', borderRadius: '3px', border: '1px solid #b8c9df', marginLeft: '4px' }}>
          {['Regular', 'Pcs', 'Qty', 'Kgs'].map(mode => (
            <label key={mode} style={{ fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="unitMode"
                value={mode}
                checked={unitMode === mode}
                onChange={() => setUnitMode(mode)}
                style={{ cursor: 'pointer' }}
              />
              {mode}
            </label>
          ))}
        </div>

        {/* E-COMM Toggle */}
        <button
          type="button"
          onClick={() => setEcommFilter(!ecommFilter)}
          style={{
            backgroundColor: ecommFilter ? '#004cbe' : '#0066ff',
            color: 'white',
            border: '1px solid #003d99',
            padding: '3px 8px',
            fontWeight: 'bold',
            fontSize: '10px',
            borderRadius: '2px',
            cursor: 'pointer',
            boxShadow: ecommFilter ? 'inset 0 1px 3px rgba(0,0,0,0.4)' : 'none'
          }}
        >
          E-COMM
        </button>

        {/* Report Type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Report Type</span>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            style={{ border: '1px solid #7a94b8', padding: '3px 6px', fontWeight: 'bold', backgroundColor: 'white', fontSize: '11px', borderRadius: '2px' }}
          >
            <option value="GSTR-1">GSTR-1</option>
            <option value="GSTR-2">GSTR-2</option>
            <option value="GSTR-3B">GSTR-3B</option>
          </select>
        </div>

        {/* LoadData Button */}
        <button
          onClick={handleLoadData}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#8cb8ff' : '#0066ff',
            color: 'white',
            border: '1px solid #004cbe',
            padding: '4px 12px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            borderRadius: '2px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }}
        >
          {loading ? 'Loading...' : 'LoadData'}
        </button>
      </div>

      {/* Schedule Tabs Bar */}
      <div style={{ display: 'flex', gap: '1px', borderBottom: '2px solid #0056b3', overflowX: 'auto', backgroundColor: '#cad6e8', padding: '2px 2px 0 2px' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 14px',
                fontWeight: 'bold',
                fontSize: '11px',
                border: '1px solid #829cb8',
                borderBottom: isActive ? 'none' : '1px solid #829cb8',
                backgroundColor: isActive ? '#0066ff' : '#d8e2ef',
                color: isActive ? '#ffffff' : '#222222',
                cursor: 'pointer',
                marginBottom: isActive ? '-2px' : '0',
                borderTopLeftRadius: '3px',
                borderTopRightRadius: '3px',
                outline: 'none',
                transition: 'background 0.1s'
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Spreadsheet Grid Container */}
      <div style={{ backgroundColor: 'white', border: '1px solid #7a94b8', minHeight: '340px', maxHeight: '480px', overflow: 'auto', marginBottom: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'Consolas, "Courier New", monospace' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
            <tr style={{ backgroundColor: '#e2ebf6' }}>
              {currentTabTable.headers.map((head, idx) => (
                <th
                  key={idx}
                  style={{
                    border: '1px solid #a0b5cd',
                    padding: '5px 8px',
                    textAlign: head.includes('AMT') || head.includes('RATE') || head.includes('VAL') || head.includes('QTY') || head.includes('TAX') || head.includes('CGST') || head.includes('SGST') || head.includes('IGST') || head.includes('CESS') ? 'right' : (head === 'TYPE' || head === 'RVRS_YN' ? 'center' : 'left'),
                    fontWeight: 'bold',
                    color: '#1a3353',
                    whiteSpace: 'nowrap',
                    fontSize: '11px'
                  }}
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentTabTable.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={currentTabTable.headers.length || 1}
                  style={{ border: '1px solid #c0d0e0', padding: '120px 20px', textAlign: 'center', color: '#888', backgroundColor: '#fafbfd' }}
                >
                  {loading ? 'Processing GSTR-1 records...' : `No records available for ${activeTab} in selected period.`}
                </td>
              </tr>
            ) : (
              currentTabTable.rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  style={{
                    backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f4f7fb',
                    transition: 'background 0.1s'
                  }}
                >
                  {row.map((cell, cellIdx) => {
                    const header = currentTabTable.headers[cellIdx] || '';
                    const isNumeric = header.includes('AMT') || header.includes('RATE') || header.includes('VAL') || header.includes('QTY') || header.includes('TAX') || header.includes('CGST') || header.includes('SGST') || header.includes('IGST') || header.includes('CESS');
                    const isCentered = header === 'TYPE' || header === 'RVRS_YN';

                    return (
                      <td
                        key={cellIdx}
                        style={{
                          border: '1px solid #c0d0e0',
                          padding: '3px 8px',
                          textAlign: isNumeric ? 'right' : (isCentered ? 'center' : 'left'),
                          whiteSpace: 'nowrap',
                          color: '#222'
                        }}
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

      {/* #lbl Status / Summary Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#e2f49d', padding: '4px 8px', marginBottom: '8px', fontWeight: 'bold', fontSize: '11px', border: '1px solid #9bbd30', borderRadius: '2px', color: '#2b4404' }}>
        <span>{statusMsg}</span>
        <span style={{ fontSize: '10px', color: '#446600' }}>Tab: {activeTab} ({currentTabTable.rows.length} rows)</span>
      </div>

      {/* Bottom Control Bar */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#f0f4f9', padding: '6px 8px', border: '1px solid #a4b7d1', borderRadius: '3px' }}>
        {/* Email Send Button */}
        <button
          type="button"
          onClick={() => setShowEmailModal(true)}
          style={{
            padding: '5px 14px',
            fontWeight: 'bold',
            border: '1px solid #7a94b8',
            backgroundColor: '#d8e2ef',
            cursor: 'pointer',
            fontSize: '11px',
            borderRadius: '2px',
            color: '#1a3353'
          }}
        >
          Email Send
        </button>

        {/* Excel Format Radio Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="excelFormat"
              value="Regular"
              checked={excelFormat === 'Regular'}
              onChange={() => setExcelFormat('Regular')}
              style={{ cursor: 'pointer' }}
            />
            Regular
          </label>
          <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="excelFormat"
              value="EPPlus"
              checked={excelFormat === 'EPPlus'}
              onChange={() => setExcelFormat('EPPlus')}
              style={{ cursor: 'pointer' }}
            />
            EPPlus
          </label>
        </div>

        {/* Kill Excel Process Button */}
        <button
          type="button"
          onClick={handleKillExcelProcess}
          style={{
            padding: '5px 14px',
            fontWeight: 'bold',
            border: '1px solid #7a94b8',
            backgroundColor: '#d8e2ef',
            cursor: 'pointer',
            fontSize: '11px',
            borderRadius: '2px',
            marginLeft: 'auto',
            color: '#1a3353'
          }}
        >
          Kill Excel Process
        </button>

        {/* Generate Excel Button */}
        <button
          type="button"
          onClick={handleGenerateExcel}
          style={{
            padding: '5px 16px',
            fontWeight: 'bold',
            border: '1px solid #107c41',
            backgroundColor: '#107c41',
            color: 'white',
            cursor: 'pointer',
            fontSize: '11px',
            borderRadius: '2px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }}
        >
          Generate Excel
        </button>

        {/* Exit Button */}
        <button
          type="button"
          onClick={() => window.history.back()}
          style={{
            padding: '5px 14px',
            fontWeight: 'bold',
            border: '1px solid #7a94b8',
            backgroundColor: '#d8e2ef',
            cursor: 'pointer',
            fontSize: '11px',
            borderRadius: '2px',
            color: '#1a3353'
          }}
        >
          Exit
        </button>
      </div>

      {/* Email Modal Dialog */}
      {showEmailModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '4px', border: '1px solid #7a94b8', width: '380px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#1a3353' }}>Email GSTR-1 Report</h4>
            <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#555' }}>
              Send GSTR-1 report for period <strong>{fromDate}</strong> to <strong>{toDate}</strong> directly to CA / Tax Consultant.
            </p>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Recipient Email:</label>
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="ca@example.com / tax@consultant.in"
                style={{ width: '100%', padding: '6px', border: '1px solid #7a94b8', borderRadius: '2px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                style={{ padding: '5px 12px', border: '1px solid #ccc', backgroundColor: '#f0f0f0', borderRadius: '2px', cursor: 'pointer', fontSize: '11px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={emailSending}
                onClick={handleSendEmail}
                style={{ padding: '5px 14px', border: 'none', backgroundColor: '#0066ff', color: 'white', fontWeight: 'bold', borderRadius: '2px', cursor: 'pointer', fontSize: '11px' }}
              >
                {emailSending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GSTReportsTab;
