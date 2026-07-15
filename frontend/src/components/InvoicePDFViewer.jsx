import React, { useRef, useState } from 'react';
import {
  resolveCompanyProfile,
  fmtMoney,
  fmtNum,
  fmtDate,
  amountInWords,
  resolveParty,
  resolveItemName,
  buildWhatsAppMessage,
  openWhatsAppShare
} from '../utils/invoiceHelpers';

/**
 * Professional A4 invoice PDF preview — sales & purchase.
 * Print / Download PDF / WhatsApp share.
 */
const InvoicePDFViewer = ({
  type = 'sale',
  invoice,
  parties = [],
  items = [],
  company,
  onClose
}) => {
  const paperRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  if (!invoice) return null;

  const firm = resolveCompanyProfile(company);

  const isSale = type === 'sale';
  const partyRef = isSale ? invoice.customerId : invoice.supplierId;
  const party =
    resolveParty(partyRef, parties) ||
    (isSale
      ? { name: invoice.customerName || 'Cash Customer' }
      : { name: invoice.supplierName || 'Vendor' });

  const docTitle = isSale ? 'TAX INVOICE' : 'PURCHASE VOUCHER';
  const docNo = invoice.invoiceNo || '—';
  const docDate = fmtDate(invoice.date || invoice.createdAt);
  const taxable = Number(invoice.taxableAmount ?? invoice.totals?.subtotal ?? 0);
  const gst = Number(invoice.gstAmount || 0);
  const net = Number(invoice.netAmount ?? invoice.totals?.total ?? taxable + gst);
  const isIgst = invoice.gstType === 'IGST' || /OUT OF STATE/i.test(invoice.type || '');
  const cgst = Number(invoice.cgst ?? (isIgst ? 0 : gst / 2));
  const sgst = Number(invoice.sgst ?? (isIgst ? 0 : gst / 2));
  const igst = Number(invoice.igst ?? (isIgst ? gst : 0));
  const lines = Array.isArray(invoice.items) ? invoice.items : [];

  const handlePrint = () => {
    document.body.classList.add('invoice-printing');
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('invoice-printing'), 500);
    }, 80);
  };

  const handleDownloadPdf = async () => {
    if (!paperRef.current) {
      const { toast } = await import('../store/useToastStore');
      toast.warning('Invoice preview not ready. Please wait a second and try again.');
      return;
    }
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);

      const el = paperRef.current;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 2) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const filename = `${isSale ? 'Invoice' : 'Purchase'}_${String(docNo).replace(/[^\w.-]+/g, '_')}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('PDF download failed:', err);
      const { toast } = await import('../store/useToastStore');
      toast.error('PDF download failed. Use Print → Save as PDF as a fallback.');
    } finally {
      setDownloading(false);
    }
  };

  const handleWhatsApp = () => {
    const msg = buildWhatsAppMessage({ type, invoice, party, company: firm });
    openWhatsAppShare(msg, party?.phone || party?.mobile || '');
  };

  return (
    <div className="invoice-pdf-overlay fixed inset-0 z-[10000] bg-slate-900/70 backdrop-blur-sm flex flex-col print:static print:bg-white print:z-auto">
      {/* Toolbar */}
      <div className="invoice-pdf-toolbar shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-white border-b border-slate-200 shadow-sm print:hidden">
        <div>
          <p className="text-[13px] font-bold text-slate-900">{docTitle}</p>
          <p className="text-[11px] text-slate-500">{docNo} · {docDate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="h-10 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold tracking-wide disabled:opacity-60 shadow-md"
          >
            {downloading ? '⏳ Preparing PDF…' : '⬇ Download PDF'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold uppercase tracking-wide"
          >
            🖨 Print
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wide"
          >
            WhatsApp
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-bold uppercase tracking-wide hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>

      {/* Scrollable preview */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:overflow-visible">
        <div
          ref={paperRef}
          id="invoice-pdf-paper"
          className="invoice-pdf-paper bg-white mx-auto shadow-2xl print:shadow-none"
          style={{
            width: '210mm',
            minHeight: '297mm',
            maxWidth: '100%',
            fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
            color: '#0f172a',
            boxSizing: 'border-box'
          }}
        >
          {/* Accent bar */}
          <div style={{ height: 6, background: 'linear-gradient(90deg, #1e3a8a, #2563eb, #1e40af)' }} />

          <div style={{ padding: '18mm 14mm 14mm' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 18,
                      letterSpacing: '-0.02em',
                      flexShrink: 0
                    }}
                  >
                    {(firm.name || 'C').charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', lineHeight: 1.15 }}>
                      {firm.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {firm.tagline}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.55 }}>
                  <div>{firm.address}</div>
                  <div>{firm.area}</div>
                  <div>Ph: {firm.phone} · {firm.email}</div>
                  <div style={{ marginTop: 4, fontWeight: 700, color: '#1e40af' }}>
                    GSTIN: {firm.gstin || '—'} · PAN: {firm.pan || '—'}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', minWidth: 170 }}>
                <div
                  style={{
                    display: 'inline-block',
                    background: isSale ? '#eff6ff' : '#f0fdf4',
                    color: isSale ? '#1e40af' : '#166534',
                    border: `1px solid ${isSale ? '#bfdbfe' : '#bbf7d0'}`,
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    marginBottom: 10
                  }}
                >
                  {docTitle}
                </div>
                <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.7 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>Doc No</span>
                    <br />
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{docNo}</span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontWeight: 600 }}>Date</span>
                    <br />
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{docDate}</span>
                  </div>
                  {!isSale && invoice.supplierInvoiceNo && (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontWeight: 600 }}>Supplier Bill</span>
                      <br />
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{invoice.supplierInvoiceNo}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Party + meta cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '12px 14px',
                  background: '#f8fafc'
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                  {isSale ? 'Bill To' : 'Supplier'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{party?.name || '—'}</div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
                  {party?.address && <div>{party.address}</div>}
                  {(party?.city || party?.station) && (
                    <div>{[party.city || party.station, party.state].filter(Boolean).join(', ')}</div>
                  )}
                  {party?.gstin && (
                    <div style={{ marginTop: 4, fontWeight: 700, color: '#1e40af' }}>GSTIN: {party.gstin}</div>
                  )}
                  {(party?.phone || party?.mobile) && (
                    <div>Ph: {party.phone || party.mobile}</div>
                  )}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  fontSize: 10
                }}
              >
                <Meta label="Book" value={invoice.bookId || (isSale ? 'SALES BOOK' : 'PURCHASE BOOK')} />
                <Meta label="GST Type" value={isIgst ? 'IGST (Inter-State)' : 'CGST + SGST'} />
                {isSale && <Meta label="Challan" value={invoice.challanNo || '—'} />}
                {isSale && <Meta label="Transport" value={invoice.transport || '—'} />}
                {isSale && <Meta label="LR / E-Way" value={[invoice.lrNo, invoice.eway].filter(Boolean).join(' / ') || '—'} />}
                {!isSale && <Meta label="Challan" value={invoice.challanNo || '—'} />}
                {!isSale && <Meta label="Reverse Charge" value={invoice.reverseCharge || 'No'} />}
                <Meta label="Due Date" value={fmtDate(invoice.dueDate) !== '—' ? fmtDate(invoice.dueDate) : '—'} />
                {invoice.offlinePending && <Meta label="Status" value="Offline Pending Sync" />}
              </div>
            </div>

            {/* Items table */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 10,
                marginBottom: 14
              }}
            >
              <thead>
                <tr style={{ background: 'linear-gradient(180deg, #1e3a8a, #1e40af)', color: '#fff' }}>
                  <Th style={{ width: 28, textAlign: 'center' }}>#</Th>
                  <Th style={{ textAlign: 'left' }}>Item / Description</Th>
                  <Th style={{ width: 44, textAlign: 'center' }}>HSN</Th>
                  {isSale && <Th style={{ width: 40, textAlign: 'center' }}>Fold</Th>}
                  {isSale && <Th style={{ width: 40, textAlign: 'center' }}>Cut</Th>}
                  <Th style={{ width: 40, textAlign: 'center' }}>Pcs</Th>
                  <Th style={{ width: 52, textAlign: 'right' }}>Mtrs</Th>
                  <Th style={{ width: 58, textAlign: 'right' }}>Rate</Th>
                  <Th style={{ width: 72, textAlign: 'right' }}>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={isSale ? 9 : 7} style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>
                      No line items
                    </td>
                  </tr>
                )}
                {lines.map((line, idx) => {
                  const name = resolveItemName(line, items);
                  const hsn = line.hsn || line.itemId?.hsn || '—';
                  const zebra = idx % 2 === 1;
                  return (
                    <tr key={idx} style={{ background: zebra ? '#f8fafc' : '#fff' }}>
                      <Td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</Td>
                      <Td style={{ textAlign: 'left', fontWeight: 600 }}>
                        {name}
                        {line.desc ? (
                          <div style={{ fontWeight: 400, color: '#64748b', fontSize: 9 }}>{line.desc}</div>
                        ) : null}
                      </Td>
                      <Td style={{ textAlign: 'center', color: '#64748b' }}>{hsn}</Td>
                      {isSale && <Td style={{ textAlign: 'center' }}>{line.fold || 0}</Td>}
                      {isSale && <Td style={{ textAlign: 'center' }}>{line.cut || 0}</Td>}
                      <Td style={{ textAlign: 'center' }}>{line.pcs || 0}</Td>
                      <Td style={{ textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{fmtNum(line.mts)}</Td>
                      <Td style={{ textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{fmtNum(line.rate)}</Td>
                      <Td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
                        {fmtNum(line.amount)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals + words */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 14, marginBottom: 18 }}>
              <div>
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '12px 14px',
                    background: '#fffbeb',
                    marginBottom: 10
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#92400e', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Amount in Words
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#78350f', fontStyle: 'italic' }}>
                    {amountInWords(net)}
                  </div>
                </div>
                <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.55 }}>
                  <div style={{ fontWeight: 700, color: '#334155', marginBottom: 2 }}>Bank Details</div>
                  <div>{firm.bankName || '—'}</div>
                  <div>A/c: {firm.accountNo || '—'} · IFSC: {firm.ifsc || '—'}</div>
                  <div style={{ marginTop: 8, fontWeight: 700, color: '#334155' }}>Declaration</div>
                  <div>
                    We declare that this invoice shows the actual price of the goods described and that all
                    particulars are true and correct.
                  </div>
                  {invoice.remarks || invoice.narration ? (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontWeight: 700 }}>Remarks: </span>
                      {invoice.remarks || invoice.narration}
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  overflow: 'hidden',
                  fontSize: 10
                }}
              >
                <TotalRow label="Taxable Amount" value={fmtMoney(taxable)} />
                {!isIgst ? (
                  <>
                    <TotalRow label="CGST" value={fmtMoney(cgst)} />
                    <TotalRow label="SGST" value={fmtMoney(sgst)} />
                  </>
                ) : (
                  <TotalRow label="IGST" value={fmtMoney(igst)} />
                )}
                {(invoice.tcs > 0 || invoice.tcsAmount > 0) && (
                  <TotalRow
                    label={`TCS${invoice.tcsPer ? ` (${invoice.tcsPer}%)` : ''}`}
                    value={fmtMoney(invoice.tcs || invoice.tcsAmount)}
                  />
                )}
                {Number(invoice.roundOff || 0) !== 0 && (
                  <TotalRow label="Round Off" value={fmtMoney(invoice.roundOff)} />
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 13
                  }}
                >
                  <span>Grand Total</span>
                  <span style={{ fontFamily: 'ui-monospace, monospace' }}>{fmtMoney(net)}</span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginTop: 28 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ borderTop: '1.5px solid #cbd5e1', paddingTop: 8, fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Customer Signature
                </div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 28 }}>For {firm.name}</div>
                <div style={{ borderTop: '1.5px solid #1e40af', paddingTop: 8, fontSize: 9, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Authorised Signatory
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 10,
                borderTop: '1px dashed #e2e8f0',
                textAlign: 'center',
                fontSize: 8,
                color: '#94a3b8',
                letterSpacing: '0.04em'
              }}
            >
              Computer generated invoice · {firm.name}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body.invoice-printing * { visibility: hidden !important; }
          body.invoice-printing .invoice-pdf-overlay,
          body.invoice-printing .invoice-pdf-overlay * { visibility: visible !important; }
          body.invoice-printing .invoice-pdf-overlay {
            position: static !important;
            background: white !important;
            display: block !important;
          }
          body.invoice-printing .invoice-pdf-toolbar { display: none !important; }
          body.invoice-printing .invoice-pdf-paper {
            box-shadow: none !important;
            margin: 0 !important;
            width: 100% !important;
          }
          @page { size: A4; margin: 8mm; }
        }
      `}</style>
    </div>
  );
};

const Th = ({ children, style }) => (
  <th
    style={{
      padding: '8px 6px',
      fontWeight: 700,
      fontSize: 9,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      ...style
    }}
  >
    {children}
  </th>
);

const Td = ({ children, style }) => (
  <td style={{ padding: '7px 6px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'top', ...style }}>
    {children}
  </td>
);

const Meta = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </div>
    <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{value || '—'}</div>
  </div>
);

const TotalRow = ({ label, value }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 14px',
      borderBottom: '1px solid #f1f5f9',
      color: '#475569'
    }}
  >
    <span>{label}</span>
    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#0f172a' }}>{value}</span>
  </div>
);

export default InvoicePDFViewer;
