import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  resolveCompanyProfile,
  buildWhatsAppMessage,
  openWhatsAppShare,
  resolveParty,
} from '../utils/invoiceHelpers';
import {
  InvoiceTemplate,
  TemplatePicker,
  buildInvoiceViewModel,
  invoicePrintCss,
} from './invoice-templates';
import { WarningsBanner } from './invoice-templates/shared/FieldWarning';
import useInvoiceTemplateStore from '../store/useInvoiceTemplateStore';
import useConfigStore from '../store/useConfigStore';
import { ButtonLoader } from './ui/loaders';

/**
 * Invoice preview / print / PDF shell — compact ERP layout with left sidebar.
 */
const InvoicePDFViewer = ({
  type = 'sale',
  invoice,
  parties = [],
  items = [],
  company,
  onClose,
}) => {
  const paperRef = useRef(null);
  const previewPaneRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const {
    selectedTemplateId,
    pageSize,
    zoom,
    copyLabel,
    showFestivalGreeting,
    setSelectedTemplateId,
    setPageSize,
    setZoom,
    setCopyLabel,
    setShowFestivalGreeting,
    hydrateFromSettings,
  } = useInvoiceTemplateStore();

  const companySettings = useConfigStore((s) => s.companySettings);

  useEffect(() => {
    if (companySettings) hydrateFromSettings(companySettings);
  }, [companySettings, hydrateFromSettings]);

  // Always open on professional GST Formal (avoid festive/other leftovers)
  useEffect(() => {
    setSelectedTemplateId('gst-formal');
    setPageSize('a4');
  }, [invoice?._id || invoice?.id, setSelectedTemplateId, setPageSize]);

  const firm = useMemo(() => resolveCompanyProfile(company), [company]);

  const effectivePageSize =
    selectedTemplateId === 'compact-thermal'
      ? pageSize.startsWith('thermal')
        ? pageSize
        : 'thermal-80'
      : pageSize.startsWith('thermal')
        ? 'a4'
        : pageSize;

  // Auto-fit A4 width into the preview pane (no side / center empty look)
  useEffect(() => {
    const pane = previewPaneRef.current;
    if (!pane || effectivePageSize.startsWith('thermal')) return undefined;

    const fit = () => {
      const avail = pane.clientWidth - 32;
      const targetMm = effectivePageSize === 'a5' ? 148 : 210;
      const targetPx = (targetMm / 25.4) * 96;
      if (targetPx <= 0) return;
      const next = Math.floor((avail / targetPx) * 100);
      setZoom(Math.min(100, Math.max(55, next)));
    };

    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(pane);
    window.addEventListener('resize', fit);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [effectivePageSize, setZoom]);

  const viewModel = useMemo(() => {
    if (!invoice) return null;
    return buildInvoiceViewModel({
      type,
      invoice,
      parties,
      items,
      company,
      copyLabel,
      festival: null,
      showFestivalGreeting: false,
      showLogo: firm.showLogo !== false,
    });
  }, [type, invoice, parties, items, company, copyLabel, firm.showLogo]);

  if (!invoice || !viewModel) return null;

  const isSale = type === 'sale';
  const partyRef = isSale ? invoice.customerId : invoice.supplierId;
  const party =
    resolveParty(partyRef, parties) ||
    (isSale
      ? { name: invoice.customerName || 'Cash Customer' }
      : { name: invoice.supplierName || 'Vendor' });

  const docNo = viewModel.meta.invoiceNo;
  const docDate = viewModel.meta.date;
  const docTitle = viewModel.docTitle;

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
        import('jspdf'),
      ]);

      const el = paperRef.current;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const format =
        effectivePageSize === 'a5'
          ? 'a5'
          : effectivePageSize.startsWith('thermal')
            ? [
                effectivePageSize === 'thermal-58' ? 58 : 80,
                Math.max(
                  120,
                  (canvas.height * (effectivePageSize === 'thermal-58' ? 58 : 80)) / canvas.width
                ),
              ]
            : 'a4';
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: Array.isArray(format) ? format : format,
      });
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

  const paperWidth =
    effectivePageSize === 'a5'
      ? '148mm'
      : effectivePageSize === 'thermal-58'
        ? '58mm'
        : effectivePageSize === 'thermal-80'
          ? '80mm'
          : '210mm';

  const btn =
    'h-8 px-3 border border-[#3d2914] bg-[#f5f0e8] text-[#3d2914] text-[11px] font-bold hover:bg-[#3d2914] hover:text-white disabled:opacity-50';
  const btnPrimary =
    'h-8 px-3 border border-[#3d2914] bg-[#3d2914] text-white text-[11px] font-bold hover:bg-[#2a1c0e] disabled:opacity-50';

  const scale = zoom / 100;

  return (
    <div
      className={`invoice-pdf-overlay invoice-page-${effectivePageSize} fixed inset-0 z-[10000] bg-[#2a2a2a]/80 flex flex-col print:static print:bg-white print:z-auto`}
    >
      <div className="invoice-pdf-toolbar shrink-0 flex items-center justify-between gap-3 px-3 py-2 bg-[#f5f0e8] border-b border-[#3d2914] print:hidden">
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-[#3d2914] tracking-wide">{docTitle}</div>
          <div className="text-[11px] text-slate-600">
            No. {docNo} · {docDate}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={handleDownloadPdf} disabled={downloading} className={btnPrimary}>
            {downloading ? <ButtonLoader label="Preparing PDF…" /> : 'Export PDF'}
          </button>
          <button type="button" onClick={handlePrint} className={btnPrimary}>
            Print
          </button>
          <button type="button" onClick={handleWhatsApp} className={btn}>
            WhatsApp
          </button>
          <button type="button" onClick={onClose} className={btn}>
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 print:block">
        <aside className="invoice-pdf-sidebar print:hidden w-[200px] shrink-0 bg-[#faf8f5] border-r border-[#c4b8a8] overflow-y-auto flex flex-col">
          <div className="px-2.5 py-2 border-b border-[#c4b8a8] bg-[#efe8dc]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#3d2914]">Invoice Style</div>
          </div>
          <div className="p-2">
            <TemplatePicker selectedId={selectedTemplateId} onSelect={setSelectedTemplateId} />
          </div>

          <div className="px-2.5 py-2 border-y border-[#c4b8a8] bg-[#efe8dc] mt-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#3d2914]">Options</div>
          </div>
          <div className="p-2.5 flex flex-col gap-2.5 text-[11px]">
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-slate-600">Copy</span>
              <select
                value={copyLabel}
                onChange={(e) => setCopyLabel(e.target.value)}
                className="h-8 border border-slate-400 bg-white px-2 text-[11px] font-semibold"
              >
                <option value="ORIGINAL">Original</option>
                <option value="DUPLICATE">Duplicate</option>
                <option value="TRIPLICATE">Triplicate</option>
              </select>
            </label>

            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-slate-600">Paper</span>
              <select
                value={effectivePageSize}
                onChange={(e) => setPageSize(e.target.value)}
                className="h-8 border border-slate-400 bg-white px-2 text-[11px] font-semibold"
              >
                <option value="a4">A4</option>
                <option value="a5">A5</option>
                <option value="thermal-80">Thermal 80mm</option>
                <option value="thermal-58">Thermal 58mm</option>
              </select>
            </label>

            <div>
              <span className="font-bold text-slate-600 block mb-1">Zoom</span>
              <div className="flex items-center border border-slate-400 bg-white h-8">
                <button type="button" onClick={() => setZoom(zoom - 5)} className="w-8 font-bold text-slate-700">
                  −
                </button>
                <span className="flex-1 text-center text-[11px] font-bold">{zoom}%</span>
                <button type="button" onClick={() => setZoom(zoom + 5)} className="w-8 font-bold text-slate-700">
                  +
                </button>
              </div>
              <button
                type="button"
                className="mt-1 w-full h-7 border border-slate-400 bg-white text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  const pane = previewPaneRef.current;
                  if (!pane) return;
                  const avail = pane.clientWidth - 32;
                  const targetMm = effectivePageSize === 'a5' ? 148 : 210;
                  const targetPx = (targetMm / 25.4) * 96;
                  setZoom(Math.min(100, Math.max(55, Math.floor((avail / targetPx) * 100))));
                }}
              >
                Fit to width
              </button>
            </div>

            {selectedTemplateId === 'festive-edition' && (
              <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={showFestivalGreeting}
                  onChange={(e) => setShowFestivalGreeting(e.target.checked)}
                />
                Festival greeting
              </label>
            )}
          </div>

          {viewModel.warnings?.length ? (
            <div className="mt-auto p-2 border-t border-[#c4b8a8]">
              <WarningsBanner warnings={viewModel.warnings} />
            </div>
          ) : null}
        </aside>

        <div
          ref={previewPaneRef}
          className="flex-1 overflow-auto p-4 bg-[#d6d0c4] print:p-0 print:overflow-visible print:bg-white"
        >
          <div
            className="mx-auto print:!transform-none print:!w-auto"
            style={{
              width: paperWidth,
              // zoom shrinks layout box (unlike transform) — no fake empty center
              zoom: scale,
              // Firefox fallback
              transform: typeof CSS !== 'undefined' && !CSS.supports?.('zoom', '1') ? `scale(${scale})` : undefined,
              transformOrigin: 'top center',
            }}
          >
            <div
              ref={paperRef}
              id="invoice-pdf-paper"
              className="invoice-pdf-paper bg-white"
              style={{
                width: paperWidth,
                boxSizing: 'border-box',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              <InvoiceTemplate
                variant={selectedTemplateId}
                data={viewModel}
                pageSize={effectivePageSize}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{invoicePrintCss}</style>
    </div>
  );
};

export default InvoicePDFViewer;
