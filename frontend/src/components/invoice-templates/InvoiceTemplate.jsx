import React from 'react';
import GstFormal from './templates/GstFormal';
import ErpClassic from './templates/ErpClassic';
import CommercePro from './templates/CommercePro';
import Executive from './templates/Executive';
import CompactThermal from './templates/CompactThermal';
import { normalizeTemplateId, TEMPLATE_CATALOG } from './templateCatalog';

export { TEMPLATE_CATALOG, normalizeTemplateId };

/**
 * Pure presentational template router.
 * All A4 themes share the same production tax-invoice data layout.
 */
export default function InvoiceTemplate({ variant = 'gst-formal', data, pageSize = 'a4' }) {
  if (!data) return null;
  const id = normalizeTemplateId(variant);

  switch (id) {
    case 'gst-formal':
      return <GstFormal data={data} />;
    case 'erp-classic':
      return <ErpClassic data={data} />;
    case 'commerce-pro':
      return <CommercePro data={data} />;
    case 'executive':
      return <Executive data={data} />;
    case 'compact-thermal':
      return (
        <CompactThermal
          data={data}
          pageSize={pageSize.startsWith('thermal') ? pageSize : 'thermal-80'}
        />
      );
    default:
      return <GstFormal data={data} />;
  }
}
