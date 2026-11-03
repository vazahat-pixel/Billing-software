'use strict';

/**
 * JSM's four bill registers, each as a Summary and a Detail screen:
 *   Reports › Purchase › Purchase Bill    › Summary / Detail      (Rpt_Jsm_Purchase)
 *   Reports › Purchase › Purchase Return  › Summary / Detail      (Rpt_Jsm_Purchase_Return)
 *   Reports › Sales    › Sales Return     › Summary / Detail      (Rpt_Jsm_Sales_Return)
 *   Others Reports › Old Reports › Sales  › SalesSummary / Detail (Rpt_Jsm_Sales)
 *
 * All four share one builder; only the data source, the captured views and the offered groupings
 * differ. See registerReport.js for how the screen's controls map onto JSM's layout variants.
 */
const { registerReport } = require('../registerReport');
const src = require('../sources/billRegister');

// Sales offers Item+PartyWise; JSM also lists SuitWise, which this software does not record, so it
// is not offered and asking for it is refused rather than answered with the wrong grouping.
const SALES_CATEGORIES = [1, 2, 3, 4, 5, 6, 7];
const PURCHASE_CATEGORIES = [1, 2, 3, 4, 5, 6];

const sales = registerReport({
  load: src.loadSalesRegisterRows,
  views: { short: 'JSM_VW_SALES_SMRY_SHORT', full: 'JSM_VW_SALES_SMRY_FULL', detail: 'JSM_VW_SALES_DTL' },
  categories: SALES_CATEGORIES,
  noun: 'Sales',
});

const purchase = registerReport({
  load: src.loadPurchaseRegisterRows,
  views: { short: 'JSM_VW_PURCHASE_SMRY_SHORT', full: 'JSM_VW_PURCHASE_SMRY_FULL', detail: 'JSM_VW_PURCHASE_DTL' },
  categories: PURCHASE_CATEGORIES,
  noun: 'Purchase',
});

const salesReturn = registerReport({
  load: (companyId) => src.loadReturnRegisterRows(companyId, 'Sales'),
  views: {
    short: 'JSM_VW_SALES_RETURN_SMRY_SHORT',
    full: 'JSM_VW_SALES_RETURN_SMRY_FULL',
    detail: 'JSM_VW_SALES_RETURN_DTL',
  },
  categories: SALES_CATEGORIES,
  noun: 'Sales Return',
});

const purchaseReturn = registerReport({
  load: (companyId) => src.loadReturnRegisterRows(companyId, 'Purchase'),
  views: {
    short: 'JSM_VW_PURCHASE_RETURN_SMRY_SHORT',
    full: 'JSM_VW_PURCHASE_RETURN_SMRY_FULL',
    detail: 'JSM_VW_PURCHASE_RETURN_DTL',
  },
  categories: PURCHASE_CATEGORIES,
  noun: 'Purchase Return',
});

module.exports = { sales, purchase, salesReturn, purchaseReturn };
