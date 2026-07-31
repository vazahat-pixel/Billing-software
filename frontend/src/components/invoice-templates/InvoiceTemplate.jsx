import React from 'react';

import ModernEnterprise from './templates/ModernEnterprise';
import LuxuryCorporate from './templates/LuxuryCorporate';
import PremiumMinimal from './templates/PremiumMinimal';
import TextilePro from './templates/TextilePro';
import InternationalBiz from './templates/InternationalBiz';
import CompactThermal from './templates/CompactThermal';
import SuratBold from './templates/SuratBold';
import RoyalGold from './templates/RoyalGold';
import OceanBlue from './templates/OceanBlue';
import SlateElegant from './templates/SlateElegant';

import { normalizeTemplateId, TEMPLATE_CATALOG } from './templateCatalog';

export { TEMPLATE_CATALOG, normalizeTemplateId };

/**
 * Professional invoice print engine — routes to distinct layout families.
 * Each template has a unique visual hierarchy; shared data via buildInvoiceViewModel.
 */
export default function InvoiceTemplate({ variant = 'surat-bold', data, pageSize = 'a4' }) {
  if (!data) return null;

  const id = normalizeTemplateId(variant);

  switch (id) {
    case 'surat-bold':
      return <SuratBold data={data} />;

    case 'royal-gold':
      return <RoyalGold data={data} />;

    case 'ocean-blue':
      return <OceanBlue data={data} />;

    case 'slate-elegant':
      return <SlateElegant data={data} />;

    case 'modern-enterprise':
      return <ModernEnterprise data={data} />;

    case 'luxury-corporate':
      return <LuxuryCorporate data={data} />;

    case 'premium-minimal':
      return <PremiumMinimal data={data} />;

    case 'textile-pro':
      return <TextilePro data={data} />;

    case 'international-biz':
      return <InternationalBiz data={data} />;

    case 'compact-thermal':
      return (
        <CompactThermal
          data={data}
          pageSize={pageSize.startsWith('thermal') ? pageSize : 'thermal-80'}
        />
      );

    default:
      return <SuratBold data={data} />;
  }
}
