/**
 * A4 print — exact page size, content fits printable area.
 * A4 = 210mm × 297mm. Margins 5mm → content ~200 × 287mm.
 */
export const invoicePrintCss = `
  @media print {
    @page {
      size: 210mm 297mm;
      margin: 5mm;
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
      width: 200mm !important;
      max-width: 200mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      overflow: hidden !important;
      visibility: visible !important;
    }

    body.invoice-printing #invoice-print-root,
    body.invoice-printing #invoice-print-root * {
      visibility: visible !important;
    }

    body.invoice-printing #invoice-print-clone {
      display: block !important;
      width: 200mm !important;
      max-width: 200mm !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      background: #fff !important;
      transform-origin: top left !important;
    }

    body.invoice-printing #invoice-print-clone .invoice-template {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }

    body.invoice-printing #invoice-print-clone table {
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
    }

    body.invoice-printing #invoice-print-clone td,
    body.invoice-printing #invoice-print-clone th {
      box-sizing: border-box !important;
    }

    body.invoice-printing .invoice-avoid-break {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  }
`;
