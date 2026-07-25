/**
 * Print stylesheet — full A4 width, no zoom shrink, no overlay overlap.
 */
export const invoicePrintCss = `
  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: auto !important;
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      overflow: visible !important;
    }

    body.invoice-printing * {
      visibility: hidden !important;
    }

    body.invoice-printing .invoice-pdf-overlay,
    body.invoice-printing .invoice-pdf-overlay * {
      visibility: visible !important;
    }

    .invoice-pdf-overlay {
      position: static !important;
      inset: auto !important;
      left: auto !important;
      top: auto !important;
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      overflow: visible !important;
      box-shadow: none !important;
      z-index: auto !important;
    }

    .invoice-pdf-toolbar,
    .invoice-pdf-sidebar,
    .invoice-template-picker,
    .invoice-field-warning,
    .print\\:hidden {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      overflow: hidden !important;
      visibility: hidden !important;
    }

    .invoice-print-body,
    .invoice-print-scale {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      zoom: 1 !important;
      transform: none !important;
      -webkit-transform: none !important;
    }

    .invoice-pdf-paper {
      display: block !important;
      box-shadow: none !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      background: #fff !important;
      overflow: visible !important;
    }

    .invoice-template {
      width: 100% !important;
      max-width: 100% !important;
    }

    .invoice-template table {
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse !important;
    }

    .invoice-template td,
    .invoice-template th {
      overflow: visible !important;
      word-wrap: break-word !important;
      position: static !important;
    }

    .invoice-avoid-break {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  }

  @page {
    size: A4 portrait;
    margin: 5mm;
  }
`;
