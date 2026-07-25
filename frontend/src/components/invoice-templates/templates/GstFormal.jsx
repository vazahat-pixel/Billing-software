import React from 'react';
import TaxInvoiceLayout from '../shared/TaxInvoiceLayout';

/** Textile tax invoice — black formal grid (production CRM default). */
export default function GstFormal({ data }) {
  return <TaxInvoiceLayout data={data} themeId="gst-formal" />;
}
