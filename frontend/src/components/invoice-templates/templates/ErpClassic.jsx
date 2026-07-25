import React from 'react';
import TaxInvoiceLayout from '../shared/TaxInvoiceLayout';

/** ERP Classic — Busy/Tally-style dense professional bill book. */
export default function ErpClassic({ data }) {
  return <TaxInvoiceLayout data={data} themeId="erp-classic" />;
}
