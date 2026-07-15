/**
 * Sprint 2.6 — Automation listeners registered on app bootstrap.
 * Does NOT re-post accounting (already inline in domain services).
 * Orchestrates: notifications, outstanding refresh, low-stock alerts, approval notices.
 */
const eventBus = require('./eventBus');
const logger = require('../utils/logger');
const DomainEvent = require('../models/DomainEvent');
const notificationDispatch = require('../services/notificationDispatchService');
const outstandingRefresh = require('../services/outstandingRefreshService');
const inventoryEngineService = require('../services/inventoryEngineService');

let registered = false;

async function markLatestProcessed(companyId, eventType) {
  try {
    const ev = await DomainEvent.findOne({ companyId, eventType, processedAt: null }).sort({ createdAt: -1 });
    if (ev) {
      await DomainEvent.updateOne({ _id: ev._id }, { $set: { processedAt: new Date() } });
    }
  } catch (err) {
    logger.debug('automation.markProcessed skipped', { error: err.message });
  }
}

async function onSalesCreated(payload = {}) {
  const { companyId, salesId, invoiceNo, netAmount, customerId } = payload;
  if (!companyId) return;
  try {
    await notificationDispatch.dispatch(companyId, 'sales.created', {
      title: `Sales invoice ${invoiceNo || ''}`.trim(),
      body: `Invoice posted — ₹${netAmount ?? ''}`,
      severity: 'info',
      referenceType: 'Sales',
      referenceId: salesId,
      meta: payload,
    });
    if (customerId) {
      await outstandingRefresh.refreshPartyOutstanding(companyId, customerId);
    } else {
      await outstandingRefresh.refreshCompanyOutstandingSummary(companyId);
    }
    await markLatestProcessed(companyId, 'sales.created');
  } catch (err) {
    logger.warn('automation.sales.created failed', { error: err.message });
  }
}

async function onPurchaseCreated(payload = {}) {
  const { companyId, purchaseId, invoiceNo, netAmount, supplierId } = payload;
  if (!companyId) return;
  try {
    await notificationDispatch.dispatch(companyId, 'purchase.created', {
      title: `Purchase bill ${invoiceNo || ''}`.trim(),
      body: `Purchase posted — ₹${netAmount ?? ''}`,
      severity: 'info',
      referenceType: 'Purchase',
      referenceId: purchaseId,
      meta: payload,
    });
    if (supplierId) {
      await outstandingRefresh.refreshPartyOutstanding(companyId, supplierId);
    }
    await markLatestProcessed(companyId, 'purchase.created');
  } catch (err) {
    logger.warn('automation.purchase.created failed', { error: err.message });
  }
}

async function onJobReceived(payload = {}) {
  const { companyId, jobId, jobCardNo } = payload;
  if (!companyId) return;
  try {
    await notificationDispatch.dispatch(companyId, 'job.received', {
      title: `Job received ${jobCardNo || ''}`.trim(),
      body: 'Finished goods received into stock',
      severity: 'info',
      referenceType: 'Job',
      referenceId: jobId,
      meta: payload,
    });
    // Opportunistic low-stock scan (throttled by catching errors)
    try {
      const alerts = await inventoryEngineService.lowStockAlerts(companyId);
      if (alerts.length) {
        await notificationDispatch.dispatch(companyId, 'automation.low_stock', {
          title: `Low stock after job (${alerts.length} items)`,
          body: alerts.slice(0, 3).map((a) => a.itemName).join(', '),
          severity: 'warning',
          meta: { count: alerts.length },
        });
      }
    } catch {
      /* optional */
    }
    await markLatestProcessed(companyId, 'job.received');
  } catch (err) {
    logger.warn('automation.job.received failed', { error: err.message });
  }
}

async function onSalesOrderCreated(payload = {}) {
  const { companyId, orderId, orderNo } = payload;
  if (!companyId) return;
  try {
    await notificationDispatch.dispatch(companyId, 'automation.approval_pending', {
      title: `Sales order ${orderNo || ''}`.trim(),
      body: 'Order created — stock reserved if approved',
      severity: 'info',
      referenceType: 'Order',
      referenceId: orderId,
      meta: payload,
    });
  } catch (err) {
    logger.warn('automation.sales.order failed', { error: err.message });
  }
}

async function onPurchaseOrderCreated(payload = {}) {
  const { companyId, orderId, orderNo } = payload;
  if (!companyId) return;
  try {
    await notificationDispatch.dispatch(companyId, 'automation.approval_pending', {
      title: `Purchase order ${orderNo || ''}`.trim(),
      body: 'PO created / pending approval',
      severity: 'info',
      referenceType: 'Order',
      referenceId: orderId,
      meta: payload,
    });
  } catch (err) {
    logger.warn('automation.purchase.order failed', { error: err.message });
  }
}

function registerAutomationListeners() {
  if (registered) return;
  registered = true;

  eventBus.on('sales.created', (p) => {
    setImmediate(() => onSalesCreated(p));
  });
  eventBus.on('purchase.created', (p) => {
    setImmediate(() => onPurchaseCreated(p));
  });
  eventBus.on('job.received', (p) => {
    setImmediate(() => onJobReceived(p));
  });
  eventBus.on('sales.order.created', (p) => {
    setImmediate(() => onSalesOrderCreated(p));
  });
  eventBus.on('purchase.order.created', (p) => {
    setImmediate(() => onPurchaseOrderCreated(p));
  });
  eventBus.on('purchase.grn.created', (p) => {
    setImmediate(() => {
      if (!p.companyId) return;
      notificationDispatch.dispatch(p.companyId, 'purchase.created', {
        title: `GRN ${p.grnNo || ''}`,
        body: 'Goods receipt noted',
        severity: 'info',
        referenceType: 'Grn',
        referenceId: p.grnId,
        meta: p,
      }).catch(() => {});
    });
  });

  logger.info('automation listeners registered');
}

module.exports = {
  registerAutomationListeners,
  onSalesCreated,
  onPurchaseCreated,
  onJobReceived,
};
