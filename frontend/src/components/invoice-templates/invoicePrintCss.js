/**
 * Print stylesheet — content-sized bill on A4 page (no forced empty middle).
 */
export const invoicePrintCss = `
  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body * {
      visibility: hidden !important;
    }
    .invoice-pdf-overlay,
    .invoice-pdf-overlay * {
      visibility: visible !important;
    }
    .invoice-pdf-overlay {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      height: auto !important;
      background: #fff !important;
      display: block !important;
      overflow: visible !important;
      box-shadow: none !important;
    }
    .invoice-pdf-toolbar,
    .invoice-pdf-sidebar,
    .invoice-template-picker,
    .invoice-field-warning,
    .print\\:hidden {
      display: none !important;
    }
    .invoice-pdf-paper {
      box-shadow: none !important;
      margin: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      background: #fff !important;
    }
    .invoice-template {
      width: 100% !important;
    }
    .invoice-avoid-break {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  }

  @page {
    size: A4 portrait;
    margin: 8mm;
  }
`;
