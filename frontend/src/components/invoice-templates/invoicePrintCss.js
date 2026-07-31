/**
 * A4 print CSS — supports v2 multi-page print engine and legacy thermal.
 * v2 engine: natural page flow, repeating table headers, fixed footer.
 */
export const invoicePrintCss = `
  @media print {
    @page {
      size: 210mm 297mm;
      margin: 10mm 10mm 14mm 10mm;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 210mm !important;
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body.invoice-printing > *:not(#invoice-print-root) {
      display: none !important;
    }

    body.invoice-printing #invoice-print-root {
      display: block !important;
      position: static !important;
      width: 190mm !important;
      max-width: 190mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      overflow: visible !important;
      visibility: visible !important;
    }

    body.invoice-printing #invoice-print-root,
    body.invoice-printing #invoice-print-root * {
      visibility: visible !important;
    }

    body.invoice-printing #invoice-print-clone {
      display: block !important;
      width: 190mm !important;
      max-width: 190mm !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      background: #fff !important;
      transform-origin: top left !important;
      overflow: visible !important;
    }

    body.invoice-printing #invoice-print-clone .invoice-template,
    body.invoice-printing #invoice-print-clone .invoice-print-engine {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }

    /* v2 engine — allow multi-page flow */
    body.invoice-printing #invoice-print-clone [data-print-engine="v2"] {
      padding: 0 !important;
      min-height: auto !important;
      overflow: visible !important;
    }

    body.invoice-printing #invoice-print-clone table {
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
    }

    body.invoice-printing #invoice-print-clone thead {
      display: table-header-group !important;
    }

    body.invoice-printing #invoice-print-clone tfoot {
      display: table-footer-group !important;
    }

    body.invoice-printing #invoice-print-clone tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    body.invoice-printing #invoice-print-clone td,
    body.invoice-printing #invoice-print-clone th {
      box-sizing: border-box !important;
    }

    body.invoice-printing .invoice-avoid-break,
    body.invoice-printing .ipe-avoid-break {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    body.invoice-printing .ipe-print-footer {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
    }
  }
`;
