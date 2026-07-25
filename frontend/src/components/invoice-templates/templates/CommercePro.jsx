import React from 'react';
import TaxInvoiceLayout from '../shared/TaxInvoiceLayout';

/** Commerce Pro — modern teal CRM invoice (Zoho / FreshBooks grade). */
export default function CommercePro({ data }) {
  return <TaxInvoiceLayout data={data} themeId="commerce-pro" />;
}
