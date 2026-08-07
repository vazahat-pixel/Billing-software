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
    // Only hydrate from settings if user hasn't manually picked a template
    if (companySettings) {
      const { forceTemplate } = useInvoiceTemplateStore.getState();
      if (!forceTemplate) {
        hydrateFromSettings(companySettings);
      }
    }
  }, [companySettings, hydrateFromSettings]);

  // Normalize deleted/renamed template IDs only once on first open
  useEffect(() => {
    const id = normalizeTemplateId(selectedTemplateId);
    if (id !== selectedTemplateId) setSelectedTemplateId(id);
    if (pageSize.startsWith('thermal') && id !== 'compact-thermal') {
      setPageSize('a4');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      className={`invoice-pdf-overlay invoice-page-${effectivePageSize} fixed inset-0 z-[10000] bg-[#1e293b]/90 flex flex-col print:static print:inset-auto print:block print:h-auto print:min-h-0 print:bg-white print:z-auto`}
    >
      {/* ── Compact Sleek Top Toolbar ── */}
      <div className="invoice-pdf-toolbar shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#0f172a] text-white border-b border-slate-700 shadow-md print:hidden text-xs">
        {/* Left: Invoice Title + Template Selector + Copy + Paper + Zoom */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="font-bold text-amber-400 text-sm">{docTitle}</span>
            <span className="text-slate-400 text-[11px] font-mono">#{docNo}</span>
          </div>

          {/* Design Dropdown */}
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded border border-slate-600">
            <span className="text-slate-400 font-bold text-[10px] uppercase">Design:</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
            >
              <option value="surat-bold" className="bg-slate-900 text-white">🧵 Surat Bold (Recommended)</option>
              <option value="textile-pro" className="bg-slate-900 text-white">📄 Textile Pro (Classic Grid)</option>
              <option value="royal-gold" className="bg-slate-900 text-white">👑 Royal Gold (Luxury)</option>
              <option value="ocean-blue" className="bg-slate-900 text-white">🌊 Ocean Blue (Corporate)</option>
              <option value="slate-elegant" className="bg-slate-900 text-white">⚡ Slate Elegant (Modern)</option>
              <option value="modern-enterprise" className="bg-slate-900 text-white">🏢 Modern Enterprise (ERP)</option>
              <option value="luxury-corporate" className="bg-slate-900 text-white">💼 Luxury Corporate</option>
              <option value="premium-minimal" className="bg-slate-900 text-white">✨ Premium Minimal</option>
              <option value="international-biz" className="bg-slate-900 text-white">🌐 International Business</option>
              <option value="compact-thermal" className="bg-slate-900 text-white">🖨️ Thermal POS</option>
            </select>
          </div>

          {/* Copy Selector */}
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded border border-slate-600">
            <span className="text-slate-400 font-bold text-[10px] uppercase">Copy:</span>
            <select
              value={copyLabel}
              onChange={(e) => setCopyLabel(e.target.value)}
              className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
            >
              <option value="ORIGINAL" className="bg-slate-900 text-white">Original</option>
              <option value="DUPLICATE" className="bg-slate-900 text-white">Duplicate</option>
              <option value="TRIPLICATE" className="bg-slate-900 text-white">Triplicate</option>
            </select>
          </div>

          {/* Paper Selector */}
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded border border-slate-600">
            <span className="text-slate-400 font-bold text-[10px] uppercase">Paper:</span>
            <select
              value={effectivePageSize}
              onChange={(e) => setPageSize(e.target.value)}
              className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
            >
              <option value="a4" className="bg-slate-900 text-white">A4</option>
              <option value="a5" className="bg-slate-900 text-white">A5</option>
              <option value="thermal-80" className="bg-slate-900 text-white">Thermal 80mm</option>
              <option value="thermal-58" className="bg-slate-900 text-white">Thermal 58mm</option>
            </select>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded border border-slate-600">
            <button type="button" onClick={() => setZoom(Math.max(50, zoom - 5))} className="px-1 font-bold text-slate-300 hover:text-white">
              −
            </button>
            <span className="font-mono text-xs font-bold w-9 text-center text-amber-300">{zoom}%</span>
            <button type="button" onClick={() => setZoom(Math.min(130, zoom + 5))} className="px-1 font-bold text-slate-300 hover:text-white">
              +
            </button>
            <button
              type="button"
              className="ml-1 text-[10px] font-bold px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200"
              onClick={() => {
                const pane = previewPaneRef.current;
                if (!pane) return;
                const avail = pane.clientWidth - 32;
                const targetMm = effectivePageSize === 'a5' ? 148 : 210;
                const targetPx = (targetMm / 25.4) * 96;
                setZoom(Math.min(100, Math.max(55, Math.floor((avail / targetPx) * 100))));
              }}
            >
              Fit
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow text-xs flex items-center gap-1"
          >
            {downloading ? <ButtonLoader label="PDF…" /> : 'Export PDF'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded shadow text-xs"
          >
            Print
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow text-xs"
          >
            WhatsApp
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded text-xs ml-1"
          >
            Close ✕
          </button>
        </div>
      </div>

      {/* ── Main Full-Width Centered Preview Body ── */}
      <div className="flex-1 flex min-h-0 print:block print:h-auto print:min-h-0 print:overflow-visible">
        <div
          ref={previewPaneRef}
          className="invoice-print-body flex-1 overflow-auto p-4 bg-slate-900/90 flex justify-center print:p-0 print:m-0 print:overflow-visible print:bg-white print:h-auto print:min-h-0"
        >
          <div
            className="invoice-print-scale print:!transform-none print:!zoom-100 print:m-0 print:w-full"
            style={{
              width: paperWidth,
              zoom: scale,
              transform:
                typeof CSS !== 'undefined' && !CSS.supports?.('zoom', '1')
                  ? `scale(${scale})`
                  : undefined,
              transformOrigin: 'top center',
            }}
          >
            <div
              ref={paperRef}
              id="invoice-pdf-paper"
              className="invoice-pdf-paper bg-white print:shadow-none print:m-0 print:w-full"
              style={{
                width: paperWidth,
                boxSizing: 'border-box',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
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
