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
  normalizeTemplateId,
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
    setSelectedTemplateId,
    setPageSize,
    setZoom,
    setCopyLabel,
    hydrateFromSettings,
  } = useInvoiceTemplateStore();

  const companySettings = useConfigStore((s) => s.companySettings);
  const configCompany = useConfigStore((s) => s.company);

  useEffect(() => {
    if (companySettings) hydrateFromSettings(companySettings);
  }, [companySettings, hydrateFromSettings]);

  // Prefer last chosen professional template; map deleted festive → formal
  useEffect(() => {
    const id = normalizeTemplateId(selectedTemplateId);
    if (id !== selectedTemplateId) setSelectedTemplateId(id);
    if (pageSize.startsWith('thermal') && id !== 'compact-thermal') {
      setPageSize('a4');
    }
  }, [invoice?._id || invoice?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live company settings always win over any stale prop
  const firm = useMemo(
    () => resolveCompanyProfile(company),
    [company, companySettings, configCompany]
  );

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
  }, [type, invoice, parties, items, company, copyLabel, firm, companySettings]);

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
    const paper = paperRef.current;
    if (!paper) return;

    // Force A4 for tax-invoice print (thermal stays thermal)
    const isThermal = String(effectivePageSize || '').startsWith('thermal');
    const pageWmm = isThermal
      ? effectivePageSize === 'thermal-58'
        ? 58
        : 80
      : 210;
    const pageHmm = isThermal ? 297 : 297;
    const marginMm = isThermal ? 2 : 5;
    const contentWmm = pageWmm - marginMm * 2;
    const contentHmm = pageHmm - marginMm * 2;

    let styleEl = document.getElementById('invoice-print-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'invoice-print-style';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = isThermal
      ? invoicePrintCss.replace('210mm 297mm', `${pageWmm}mm ${pageHmm}mm`).replace(/200mm/g, `${contentWmm}mm`).replace('margin: 5mm', `margin: ${marginMm}mm`)
      : invoicePrintCss;

    const mmToPx = (mm) => (mm * 96) / 25.4;
    const contentWpx = mmToPx(contentWmm);
    const contentHpx = mmToPx(contentHmm);

    const root = document.createElement('div');
    root.id = 'invoice-print-root';
    root.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      `width:${contentWmm}mm`,
      'margin:0',
      'padding:0',
      'background:#fff',
      'overflow:hidden',
      'z-index:2147483647',
    ].join(';');

    const clone = paper.cloneNode(true);
    clone.id = 'invoice-print-clone';
    clone.style.cssText = [
      `width:${contentWmm}mm`,
      'max-width:100%',
      'margin:0',
      'padding:0',
      'box-shadow:none',
      'background:#fff',
      'transform-origin:top left',
      'zoom:1',
    ].join(';');
    root.appendChild(clone);
    document.body.appendChild(root);
    document.body.classList.add('invoice-printing');

    const isV2Engine = !!clone.querySelector?.('[data-print-engine="v2"]');

    // v2 engine: natural multi-page flow — do not squash to single page
    if (!isV2Engine) {
      const naturalH = clone.scrollHeight || clone.offsetHeight;
      const naturalW = clone.scrollWidth || contentWpx;
      const scaleH = naturalH > 0 ? contentHpx / naturalH : 1;
      const scaleW = naturalW > 0 ? contentWpx / naturalW : 1;
      const fit = Math.min(1, scaleH, scaleW);

      if (fit < 0.999) {
        clone.style.zoom = String(fit);
      }
    } else {
      clone.style.overflow = 'visible';
      root.style.overflow = 'visible';
    }

    const cleanup = () => {
      document.body.classList.remove('invoice-printing');
      root.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        setTimeout(cleanup, 2000);
      });
    });
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
      const isThermal = String(effectivePageSize || '').startsWith('thermal');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: effectivePageSize === 'a5' ? 'a5' : isThermal
          ? [
              effectivePageSize === 'thermal-58' ? 58 : 80,
              Math.max(
                120,
                (canvas.height * (effectivePageSize === 'thermal-58' ? 58 : 80)) / canvas.width
              ),
            ]
          : 'a4',
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = isThermal ? 2 : 5;
      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - margin * 2;
      let imgWidth = maxW;
      let imgHeight = (canvas.height * imgWidth) / canvas.width;
      if (imgHeight > maxH) {
        imgHeight = maxH;
        imgWidth = (canvas.width * imgHeight) / canvas.height;
      }
      const x = margin + (maxW - imgWidth) / 2;
      const y = margin;
      pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);

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
      className={`invoice-pdf-overlay invoice-page-${effectivePageSize} fixed inset-0 z-[10000] bg-[#2a2a2a]/80 flex flex-col print:static print:inset-auto print:block print:h-auto print:min-h-0 print:bg-white print:z-auto`}
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

      <div className="flex-1 flex min-h-0 print:block print:h-auto print:min-h-0 print:overflow-visible">
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
          </div>

          {viewModel.warnings?.length ? (
            <div className="mt-auto p-2 border-t border-[#c4b8a8]">
              <WarningsBanner warnings={viewModel.warnings} />
            </div>
          ) : null}
        </aside>

        <div
          ref={previewPaneRef}
          className="invoice-print-body flex-1 overflow-auto p-4 bg-[#d6d0c4] print:p-0 print:m-0 print:overflow-visible print:bg-white print:h-auto print:min-h-0"
        >
          <div
            className="invoice-print-scale mx-auto print:!transform-none print:!zoom-100 print:m-0 print:w-full"
            style={{
              width: paperWidth,
              zoom: scale,
              transform:
                typeof CSS !== 'undefined' && !CSS.supports?.('zoom', '1')
                  ? `scale(${scale})`
                  : undefined,
              transformOrigin: 'top left',
            }}
          >
            <div
              ref={paperRef}
              id="invoice-pdf-paper"
              className="invoice-pdf-paper bg-white print:shadow-none print:m-0 print:w-full"
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
