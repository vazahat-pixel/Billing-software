/**
 * In-process event bus — prepare Event Architecture without forcing rewrite of services.
 * Emitters: purchase.created, sales.created, inventory.updated, etc.
 * Sprint 1.4: persists DomainEvent for audit/outbox; Sprint 2+ can swap for Redis/Bull.
 */
const { EventEmitter } = require('events');
const logger = require('../utils/logger');

class AppEventBus extends EventEmitter {
  emitSafe(event, payload = {}) {
    try {
      logger.debug(`event:${event}`, { companyId: payload.companyId });
      // Fire-and-forget persistence
      setImmediate(() => {
        try {
          const DomainEvent = require('../models/DomainEvent');
          DomainEvent.create({
            companyId: payload.companyId || null,
            eventType: event,
            aggregateType: payload.aggregateType || event.split('.')[0] || '',
            aggregateId: payload.aggregateId || payload.salesId || payload.purchaseId || payload.jobId || null,
            payload,
            userId: payload.userId || null,
            requestId: payload.requestId || '',
          }).catch((err) => logger.debug('domain event persist skipped', { error: err.message }));
        } catch (err) {
          logger.debug('domain event persist unavailable', { error: err.message });
        }
      });
      return this.emit(event, payload);
    } catch (err) {
      logger.error(`event handler error: ${event}`, { error: err.message });
      return false;
    }
  }
}

const bus = new AppEventBus();
bus.setMaxListeners(50);

module.exports = bus;
