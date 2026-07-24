import React from 'react';
import GstFormal from './templates/GstFormal';
import ClassicLedger from './templates/ClassicLedger';
import CorporateMinimal from './templates/CorporateMinimal';
import GoldLetterhead from './templates/GoldLetterhead';
import FestiveEdition from './templates/FestiveEdition';
import CompactThermal from './templates/CompactThermal';
import { normalizeTemplateId, TEMPLATE_CATALOG } from './templateCatalog';

export { TEMPLATE_CATALOG, normalizeTemplateId };

/**
 * Pure presentational template router.
 * Receives existing invoice view-model — no upstream data reshaping.
 */
export default function InvoiceTemplate({ variant = 'gst-formal', data, pageSize = 'a4' }) {
  if (!data) return null;
  const id = normalizeTemplateId(variant);

  switch (id) {
    case 'gst-formal':
      return <GstFormal data={data} />;
    case 'corporate-minimal':
      return <CorporateMinimal data={data} />;
    case 'gold-letterhead':
      return <GoldLetterhead data={data} />;
    case 'festive-edition':
      return <FestiveEdition data={data} />;
    case 'compact-thermal':
      return <CompactThermal data={data} pageSize={pageSize.startsWith('thermal') ? pageSize : 'thermal-80'} />;
    case 'classic-ledger':
      return <ClassicLedger data={data} />;
    default:
      return <GstFormal data={data} />;
  }
}
