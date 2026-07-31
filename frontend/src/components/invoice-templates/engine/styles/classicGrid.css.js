/** Classic Surat textile invoice grid — full borders, ERP print fidelity */
export const CLASSIC_BORDER = '1px solid #000000';
export const CLASSIC_PAD = '2mm 2.5mm';

export const classicGridStyles = `
  .ipe-classic-doc {
    border: ${CLASSIC_BORDER};
    font-family: 'Times New Roman', Times, Georgia, serif;
    color: #000;
    font-size: 9pt;
    line-height: 1.3;
  }

  .ipe-classic-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .ipe-classic-grid th,
  .ipe-classic-grid td {
    border: ${CLASSIC_BORDER};
    padding: ${CLASSIC_PAD};
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }

  .ipe-classic-grid thead th {
    font-weight: 700;
    font-size: 8pt;
    text-align: center;
    background: #fff;
    padding: 2mm 1.5mm;
  }

  .ipe-classic-grid tfoot td {
    font-weight: 700;
    background: #fff;
  }

  .ipe-classic-grid .ipe-num {
    font-variant-numeric: tabular-nums;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 8.5pt;
  }

  .ipe-classic-label {
    font-weight: 700;
    font-size: 8pt;
  }

  .ipe-classic-header-name {
    font-size: 16pt;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .ipe-classic-title-bar td {
    font-weight: 700;
    font-size: 9.5pt;
    padding: 1.5mm 2.5mm;
  }

  .invoice-engine-textile-pro.invoice-print-engine {
    padding: 6mm 8mm !important;
    min-height: auto !important;
  }

  @media print {
    .invoice-engine-textile-pro.invoice-print-engine {
      padding: 0 !important;
    }
    .ipe-classic-doc {
      border: ${CLASSIC_BORDER} !important;
    }
    .ipe-classic-grid th,
    .ipe-classic-grid td {
      border: ${CLASSIC_BORDER} !important;
    }
  }
`;
