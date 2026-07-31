import { A4, PRINT_FONT, INK } from './constants';

/** Shared print-engine CSS — injected once per template */
export const enginePrintCss = `
  .invoice-print-engine {
    font-family: ${PRINT_FONT.family};
    font-size: ${PRINT_FONT.size.base};
    color: ${INK.body};
    line-height: 1.35;
    -webkit-font-smoothing: antialiased;
    box-sizing: border-box;
    width: 100%;
    background: #fff;
  }

  .invoice-print-engine *,
  .invoice-print-engine *::before,
  .invoice-print-engine *::after {
    box-sizing: border-box;
  }

  .ipe-muted { color: ${INK.muted}; }
  .ipe-faint { color: ${INK.faint}; }
  .ipe-dark { color: ${INK.dark}; }
  .ipe-bold { font-weight: 700; }
  .ipe-semibold { font-weight: 600; }
  .ipe-upper { text-transform: uppercase; letter-spacing: 0.04em; }
  .ipe-tabular { font-variant-numeric: tabular-nums; }
  .ipe-right { text-align: right; }
  .ipe-center { text-align: center; }
  .ipe-left { text-align: left; }
  .ipe-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .ipe-rule { border: none; border-top: 1px solid ${INK.rule}; margin: 0; }
  .ipe-rule-dark { border: none; border-top: 1.5px solid ${INK.ruleDark}; margin: 0; }
  .ipe-rule-double { border: none; border-top: 3px double ${INK.ruleDark}; margin: 0; }

  .ipe-copy-badge {
    position: absolute;
    top: 2mm;
    right: 0;
    font-size: ${PRINT_FONT.size.xs};
    font-weight: 700;
    letter-spacing: 0.12em;
    color: ${INK.faint};
    text-transform: uppercase;
  }

  .ipe-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: ${PRINT_FONT.size.sm};
  }

  .ipe-table thead {
    display: table-header-group;
  }

  .ipe-table th {
    font-weight: 700;
    font-size: ${PRINT_FONT.size.xs};
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${INK.dark};
    padding: 2.5mm 1.5mm;
    border-bottom: 1.5px solid ${INK.ruleDark};
    vertical-align: bottom;
    background: #fff;
  }

  .ipe-table td {
    padding: 2mm 1.5mm;
    vertical-align: top;
    border-bottom: 0.5px solid ${INK.rule};
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }

  .ipe-table tbody tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .ipe-table .ipe-item-sub {
    font-size: ${PRINT_FONT.size.xs};
    color: ${INK.muted};
    margin-top: 0.5mm;
    line-height: 1.3;
  }

  .ipe-table tfoot td {
    font-weight: 700;
    border-top: 1.5px solid ${INK.ruleDark};
    border-bottom: none;
    background: ${INK.wash};
  }

  .ipe-avoid-break {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .ipe-print-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 2mm ${A4.marginLeftMm}mm;
    font-size: ${PRINT_FONT.size.xs};
    color: ${INK.faint};
    display: flex;
    justify-content: space-between;
    border-top: 0.5px solid ${INK.rule};
    background: #fff;
  }

  @media print {
    .invoice-print-engine {
      width: ${A4.contentWidthMm}mm !important;
      max-width: ${A4.contentWidthMm}mm !important;
    }

    .ipe-table thead {
      display: table-header-group !important;
    }

    .ipe-table tfoot {
      display: table-footer-group !important;
    }

    .ipe-avoid-break {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .ipe-print-footer {
      position: fixed !important;
      bottom: 0 !important;
    }
  }
`;

export const engineScreenCss = `
  .invoice-print-engine {
    padding: ${A4.marginTopMm}mm ${A4.marginRightMm}mm ${A4.marginBottomMm}mm ${A4.marginLeftMm}mm;
    min-height: 297mm;
    position: relative;
  }
`;
