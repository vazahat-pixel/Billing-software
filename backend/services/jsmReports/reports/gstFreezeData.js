'use strict';

/**
 * JSM: Reports > Gst Reports > 3B Monthly Return > 3B - Freeze DataEntry (GstFilingFreezeData)
 * Uses existing GstPeriod model (companyId, period: 'YYYY-MM', status: 'Open'|'Locked').
 */
const { orderRows } = require('../jcEngine');

function monthKeyFrom(p) {
  if (/^\d{4}-\d{2}$/.test(String(p.month || ''))) return String(p.month);
  if (p.from && /^\d{4}-\d{2}/.test(String(p.from))) return String(p.from).slice(0, 7);
  return '';
}

function monthBounds(ym) {
  const [y, m] = ym.split('-').map(Number);
  const startDate = new Date(Date.UTC(y, m - 1, 1));
  const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { startDate, endDate };
}

async function run(companyId, p = {}, deps = {}) {
  const GstPeriod = deps.GstPeriod || require('../../../models/GstPeriod');
  const ym = monthKeyFrom(p);

  if (p.action === 'Btn_Freeze_Data') {
    if (!ym) {
      const err = new Error('Select Month or From/To date before freezing data');
      err.status = 400;
      throw err;
    }
    const existing = await GstPeriod.findOne({ companyId, period: ym });
    if (existing) {
      existing.status = existing.status === 'Locked' ? 'Open' : 'Locked';
      existing.lockedAt = existing.status === 'Locked' ? new Date() : null;
      await existing.save();
    } else {
      const { startDate, endDate } = monthBounds(ym);
      await GstPeriod.create({
        companyId,
        period: ym,
        startDate,
        endDate,
        status: 'Locked',
        gstr1Status: 'Filed',
        gstr3bStatus: 'Filed',
        lockedAt: new Date(),
      });
    }
  }

  const periods = await GstPeriod.find({ companyId }).lean();
  const rows = periods.map((doc) => ({
    MONTH: doc.period || '',
    FROM_DATE: doc.startDate || null,
    TO_DATE: doc.endDate || null,
    FREEZE: doc.status === 'Locked' ? 'Y' : 'N',
    STATUS: doc.status || 'Open',
    GSTR1_STATUS: doc.gstr1Status || 'Pending',
    GSTR3B_STATUS: doc.gstr3bStatus || 'Pending',
    LAST_UPDATE: doc.lockedAt || doc.updatedAt || null,
  }));

  return {
    rows: orderRows(rows, ['MONTH']),
    grid: {
      layout: 'JSM_VW_GST_FREEZE_DATA',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: 'GST Filing Freeze Data Status',
      period: ym ? `Selected Month: ${ym}` : 'All Recorded Periods',
      pageWise: false,
      notice: p.action === 'Btn_Freeze_Data' ? `Updated freeze status for ${ym}` : '',
    },
  };
}

module.exports = { run, options: async () => ({}) };
