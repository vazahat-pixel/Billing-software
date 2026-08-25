import React, { useState, useRef } from 'react';
import useStore from '../../store/useStore';
import { ModalLoader } from '../../components/ui/loaders';
import { downloadCsv } from '../../utils/reportExport';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REPORT_TABS = ['B2B', 'B2CL', 'B2CS', 'CDNR', 'CDNU', 'HSN', 'HSN B2C', 'DOCS', 'EXP.', 'EXEMP'];

const GSTReportsTab = () => {
  const { sales, purchases } = useStore();
  const [month, setMonth] = useState('Oct');
  const [fromDate, setFromDate] = useState('01/04/2026');
  const [toDate, setToDate] = useState('25/08/2026');
  const [activeTab, setActiveTab] = useState('B2B');
  const [gstSlabWise, setGstSlabWise] = useState(true);
  const [hsnDescWise, setHsnDescWise] = useState(false);
  const [reportType, setReportType] = useState('GSTR-1');
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const tableRef = useRef(null);

  const handleLoadData = () => {
    setIsLoading(true);
    setTimeout(() => {
      // Simulate data loading
      const mockData = sales.slice(0, 5).map((s, idx) => ({
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
      setIsLoading(false);
    }, 300);
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
    <div style={{ backgroundColor: '#d0dced', padding: '8px', fontFamily: 'Arial, sans-serif' }}>
      {isLoading && <ModalLoader message="Loading..." />}

      {/* Top Row Controls */}
      <div style={{ backgroundColor: '#d0dced', marginBottom: '8px', padding: '8px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '8px' }}>
          {/* Month Dropdown */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Oct</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)}
              style={{ border: '1px solid #666', padding: '4px 8px', fontWeight: 'bold', backgroundColor: 'white' }}>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* From/To Dates */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block' }}>From</label>
              <input type="text" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                style={{ border: '2px solid #666', padding: '4px', fontWeight: 'bold', width: '100px', textAlign: 'center', backgroundColor: '#fffacd' }} />
            </div>
            <div style={{ fontWeight: 'bold' }}>To</div>
            <div>
              <input type="text" value={toDate} onChange={(e) => setToDate(e.target.value)}
                style={{ border: '2px solid #666', padding: '4px', fontWeight: 'bold', width: '100px', textAlign: 'center', backgroundColor: '#fffacd' }} />
            </div>
          </div>

          {/* Checkboxes */}
          <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="checkbox" checked={gstSlabWise} onChange={(e) => setGstSlabWise(e.target.checked)}
                style={{ backgroundColor: '#fffacd' }} /> Gst Slab Wise
            </label>
            <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="checkbox" checked={hsnDescWise} onChange={(e) => setHsnDescWise(e.target.checked)} /> HsnDescriptionWise
            </label>
          </div>

          {/* Report Type & LoadData */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block' }}>Report Type</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)}
                style={{ border: '2px solid #666', padding: '4px', fontWeight: 'bold', backgroundColor: 'white' }}>
                <option>GSTR-1</option>
                <option>GSTR-2</option>
                <option>GSTR-3B</option>
              </select>
            </div>
            <button onClick={handleLoadData}
              style={{ backgroundColor: '#0066ff', color: 'white', border: 'none', padding: '6px 12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>
              LoadData
            </button>
            <div style={{ backgroundColor: '#0066ff', color: 'white', fontWeight: 'bold', padding: '6px 12px', fontSize: '11px' }}>
              E-COMM
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: '0px', borderBottom: '2px solid #666' }}>
          {REPORT_TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 12px',
                fontWeight: 'bold',
                fontSize: '11px',
                border: '1px solid #666',
                borderBottom: activeTab === tab ? '3px solid #0066ff' : '1px solid #666',
                backgroundColor: activeTab === tab ? '#0066ff' : '#c0c0c0',
                color: activeTab === tab ? 'white' : 'black',
                cursor: 'pointer',
              }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', border: '2px solid #666', marginBottom: '8px', overflow: 'hidden' }}>
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
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
                  <td colSpan="9" style={{ border: '1px solid #999', padding: '100px 4px', textAlign: 'center', color: '#999' }}>
                    No data loaded
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={idx}>
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
      </div>

      {/* #lbl indicator */}
      <div style={{ backgroundColor: '#ccff00', padding: '4px 8px', marginBottom: '8px', fontWeight: 'bold', width: 'fit-content', fontSize: '12px' }}>
        #lbl
      </div>

      {/* Bottom Buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button style={{ padding: '6px 16px', fontWeight: 'bold', border: '1px solid #666', backgroundColor: '#e0e0e0', cursor: 'pointer', fontSize: '11px' }}>
          Email Send
        </button>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="radio" name="format" value="regular" defaultChecked style={{ cursor: 'pointer' }} />
          <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Regular</label>
          <input type="radio" name="format" value="epplus" style={{ cursor: 'pointer', marginLeft: '12px' }} />
          <label style={{ fontSize: '11px', fontWeight: 'bold' }}>EPPlus</label>
        </div>
        <button style={{ padding: '6px 16px', fontWeight: 'bold', border: '1px solid #666', backgroundColor: '#e0e0e0', cursor: 'pointer', fontSize: '11px', marginLeft: 'auto' }}>
          Kill Excel Process
        </button>
        <button onClick={handleGenerateExcel} style={{ padding: '6px 16px', fontWeight: 'bold', border: '1px solid #666', backgroundColor: '#e0e0e0', cursor: 'pointer', fontSize: '11px' }}>
          Generate Excel
        </button>
        <button style={{ padding: '6px 16px', fontWeight: 'bold', border: '1px solid #666', backgroundColor: '#e0e0e0', cursor: 'pointer', fontSize: '11px' }}>
          Exit
        </button>
      </div>
    </div>
  );
};

export default GSTReportsTab;
