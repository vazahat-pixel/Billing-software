'use strict';

/**
 * JSM: Others Reports > Old Reports > Extra Reports > Reminder (FrmReminder_All_Details)
 * Supports Create/Update (btn_Save), Delete (Btn_Delete), and List view via additive Reminder model.
 */
const { orderRows, round } = require('../jcEngine');

async function run(companyId, p = {}, deps = {}) {
  const Reminder = deps.Reminder || require('../../../models/Reminder');
  let notice = '';

  if (p.action === 'btn_Save') {
    const desc = String(p.description || '').trim();
    if (!desc) {
      const err = new Error('Description is required to save reminder');
      err.status = 400;
      throw err;
    }
    const payload = {
      companyId,
      date: p.date ? new Date(p.date) : new Date(),
      description: desc,
      amount: round(p.amount || 0),
      beforeRemindDays: Math.max(0, Number(p.beforeRemindDays || 0)),
      isActive: p.isActive !== false,
      reminderFor: ['Daily', 'Monthly', 'Quarterly', 'Yearly', 'Half Yearly'].includes(p.reminderFor) ? p.reminderFor : 'Monthly',
    };
    if (p.id && /^[0-9a-f]{24}$/i.test(String(p.id))) {
      await Reminder.updateOne({ _id: p.id, companyId }, { $set: payload });
      notice = 'Reminder updated successfully.';
    } else {
      await Reminder.create(payload);
      notice = 'Reminder added successfully.';
    }
  } else if (p.action === 'Btn_Delete') {
    if (!p.id) {
      const err = new Error('Enter Reminder ID in ID box to delete');
      err.status = 400;
      throw err;
    }
    await Reminder.deleteOne({ _id: p.id, companyId });
    notice = 'Reminder deleted successfully.';
  }

  const docs = await Reminder.find({ companyId }).sort({ date: 1 }).lean();
  const rows = docs.map((d) => ({
    ID: String(d._id),
    DATE: d.date,
    DESCRIPTION: d.description,
    AMOUNT: round(d.amount || 0),
    BEFORE_REMIND_DAYS: Number(d.beforeRemindDays || 0),
    REMINDER_FOR: d.reminderFor || 'Monthly',
    IS_ACTIVE: d.isActive ? 'Y' : 'N',
  }));

  return {
    rows: orderRows(rows, ['DATE', 'DESCRIPTION']),
    grid: {
      layout: 'JSM_VW_REMINDER_DETAILS',
      variant: 1,
      groupColumns: ['REMINDER_FOR'],
      groupDisplays: ['FREQUENCY'],
      captions: {},
      title: 'Reminder Details',
      period: `${rows.length} reminder(s)`,
      pageWise: false,
      notice,
    },
  };
}

module.exports = { run, options: async () => ({}) };

