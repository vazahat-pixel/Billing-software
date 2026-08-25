import React, { useState } from 'react';
import useStore from '../../store/useStore';
import { downloadCsv } from '../../utils/reportExport';

const GSTReportsTab = () => {
  const { sales } = useStore();
  const [month, setMonth] = useState('Oct');
  const [fromDate, setFromDate] = useState('01/04/2026');
  const [toDate, setToDate] = useState('25/08/2026');
  const [activeTab, setActiveTab] = useState('B2B');
  const [gstSlabWise, setGstSlabWise] = useState(true);
  const [hsnDescWise, setHsnDescWise] = useState(false);
  const [reportType, setReportType] = useState('GSTR-1');
  const [rows, setRows] = useState([]);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const TABS = ['B2B', 'B2CL', 'B2CS', 'CDNR', 'CDNU', 'HSN', 'HSN B2C', 'DOCS', 'EXP.', 'EXEMP'];

  const handleLoadData = () => {
    const mockData = sales.slice(0, 5).map((s) => ({
      GSTIN_NO: s.customerId?.gstin || 'N/A',
      PARTY: s.customerId?.name || 'N/A',
      NCBILL_NO: s.invoiceNo || 'N/A',
      BILL_DATE: s.date?.split('T')[0] || 'N/A',
      NET_TOT: (s.netAmount || 0).toFixed(2),
      STATE_NAME: s.customerId?.state || 'N/A',
      RVRS_YN: 'N',
      A_TAX_RATE: s.igst ? '18%' : '9%',
      INV_TYPE: 'REG',
    }));
    setRows(mockData);
  };

  const handleGenerateExcel = () => {
    if (rows.length === 0) {
      alert('Please load data first');
      return;
    }
    const headers = Object.keys(rows[0] || {});
    const csvRows = rows.map(r => headers.map(h => r[h]));
    downloadCsv(`GSTR1_${fromDate}_to_${toDate}.csv`, headers, csvRows);
  };

  return (
    <div style={{ backgroundColor: '#d0dced', padding: '12px', fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
      {/* Top Control Bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '12px', backgroundColor: '#e0e0e0', padding: '8px', border: '1px solid #999' }}>
        {/* Month Dropdown */}
        <div>
          <label style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Month</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ border: '1px solid #666', padding: '4px 6px', fontWeight: 'bold', backgroundColor: 'white', fontSize: '11px' }}>
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* From Date */}
        <div>
          <label style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>From</label>
          <input type="text" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ border: '1px solid #666', padding: '4px', fontWeight: 'bold', width: '90px', textAlign: 'center', backgroundColor: '#fffacd', fontSize: '11px' }} />
        </div>

        {/* To Date */}
        <div>
          <label style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>To</label>
          <input type="text" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ border: '1px solid #666', padding: '4px', fontWeight: 'bold', width: '90px', textAlign: 'center', backgroundColor: '#fffacd', fontSize: '11px' }} />
        </div>

        {/* Checkboxes */}
        <div style={{ display: 'flex', gap: '16px', marginLeft: '12px', alignItems: 'center' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input type="checkbox" checked={gstSlabWise} onChange={(e) => setGstSlabWise(e.target.checked)} style={{ cursor: 'pointer' }} />
            <span style={{ backgroundColor: '#fffacd', padding: '2px 4px' }}>Gst Slab Wise</span>
          </label>
          <label style={{ fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input type="checkbox" checked={hsnDescWise} onChange={(e) => setHsnDescWise(e.target.checked)} style={{ cursor: 'pointer' }} />
            <span>HsnDescriptionWise</span>
          </label>
        </div>

        {/* Report Type */}
        <div style={{ marginLeft: '12px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Report Type</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ border: '1px solid #666', padding: '4px', fontWeight: 'bold', backgroundColor: 'white', fontSize: '11px' }}>
            <option>GSTR-1</option>
            <option>GSTR-2</option>
            <option>GSTR-3B</option>
          </select>
        </div>

        {/* LoadData Button */}
        <button onClick={handleLoadData} style={{ backgroundColor: '#0066ff', color: 'white', border: 'none', padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', marginLeft: '12px' }}>LoadData</button>
      </div>

      {/* Tab Buttons */}
      <div style={{ display: 'flex', gap: '0px', marginBottom: '12px', borderBottom: '2px solid #999' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '6px 12px',
            fontWeight: 'bold',
            fontSize: '10px',
            border: '1px solid #999',
            borderBottom: activeTab === tab ? 'none' : '1px solid #999',
            backgroundColor: activeTab === tab ? '#0066ff' : '#c0c0c0',
            color: activeTab === tab ? 'white' : 'black',
            cursor: 'pointer',
            marginBottom: '-2px'
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <div style={{ backgroundColor: 'white', border: '2px solid #999', marginBottom: '12px', minHeight: '300px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', fontFamily: 'monospace' }}>
          <thead style={{ backgroundColor: '#e0e0e0', position: 'sticky', top: 0 }}>
            <tr>
              <th style={{ border: '1px solid #999', padding: '4px', textAlign: 'left', fontWeight: 'bold' }}>GSTIN_NO</th>
              <th style={{ border: '1px solid #999', padding: '4px', textAlign: 'left', fontWeight: 'bold' }}>PARTY</th>
              <th style={{ border: '1px solid #999', padding: '4px', textAlign: 'left', fontWeight: 'bold' }}>NCBILL_NO</th>
              <th style={{ border: '1px solid #999', padding: '4px', textAlign: 'left', fontWeight: 'bold' }}>BILL_DATE</th>
              <th style={{ border: '1px solid #999', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>NET_TOT</th>
              <th style={{ border: '1px solid #999', padding: '4px', textAlign: 'left', fontWeight: 'bold' }}>STATE_NAME</th>
              <th style={{ border: '1px solid #999', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>RVRS_YN</th>
              <th style={{ border: '1px solid #999', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>A_TAX_RATE</th>
              <th style={{ border: '1px solid #999', padding: '4px', textAlign: 'left', fontWeight: 'bold' }}>INV_TYPE</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ border: '1px solid #999', padding: '150px 4px', textAlign: 'center', color: '#999' }}>No data loaded</td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f5f5f5' }}>
                  <td style={{ border: '1px solid #999', padding: '2px 4px' }}>{row.GSTIN_NO}</td>
                  <td style={{ border: '1px solid #999', padding: '2px 4px' }}>{row.PARTY}</td>
                  <td style={{ border: '1px solid #999', padding: '2px 4px' }}>{row.NCBILL_NO}</td>
                  <td style={{ border: '1px solid #999', padding: '2px 4px' }}>{row.BILL_DATE}</td>
                  <td style={{ border: '1px solid #999', padding: '2px 4px', textAlign: 'right' }}>{row.NET_TOT}</td>
                  <td style={{ border: '1px solid #999', padding: '2px 4px' }}>{row.STATE_NAME}</td>
                  <td style={{ border: '1px solid #999', padding: '2px 4px', textAlign: 'center' }}>{row.RVRS_YN}</td>
                  <td style={{ border: '1px solid #999', padding: '2px 4px', textAlign: 'right' }}>{row.A_TAX_RATE}</td>
                  <td style={{ border: '1px solid #999', padding: '2px 4px' }}>{row.INV_TYPE}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* #lbl Indicator */}
      <div style={{ backgroundColor: '#ccff00', padding: '6px 8px', marginBottom: '12px', fontWeight: 'bold', width: 'fit-content', fontSize: '11px', border: '1px solid #999' }}>
        #lbl
      </div>

      {/* Bottom Control Bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: '#e0e0e0', padding: '8px', border: '1px solid #999' }}>
        <button style={{ padding: '6px 14px', fontWeight: 'bold', border: '1px solid #666', backgroundColor: '#c0c0c0', cursor: 'pointer', fontSize: '11px' }}>Email Send</button>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '12px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input type="radio" name="format" value="regular" defaultChecked style={{ cursor: 'pointer' }} /> Regular
          </label>
          <label style={{ fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input type="radio" name="format" value="epplus" style={{ cursor: 'pointer' }} /> EPPlus
          </label>
        </div>

        <button style={{ padding: '6px 14px', fontWeight: 'bold', border: '1px solid #666', backgroundColor: '#c0c0c0', cursor: 'pointer', fontSize: '11px', marginLeft: 'auto' }}>Kill Excel Process</button>
        <button onClick={handleGenerateExcel} style={{ padding: '6px 14px', fontWeight: 'bold', border: '1px solid #666', backgroundColor: '#c0c0c0', cursor: 'pointer', fontSize: '11px' }}>Generate Excel</button>
        <button style={{ padding: '6px 14px', fontWeight: 'bold', border: '1px solid #666', backgroundColor: '#c0c0c0', cursor: 'pointer', fontSize: '11px' }}>Exit</button>
      </div>
    </div>
  );
};

export default GSTReportsTab;
