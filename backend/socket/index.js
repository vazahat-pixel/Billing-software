/**
 * Socket layer — Stage 6 bridges eventBus → optional Socket.IO gateway.
 * Attach io via attachSocket(server) when realtime is enabled.
 */
const logger = require('../utils/logger');

let io = null;
let bridged = false;

function attachSocket(httpServer, { corsOrigin } = {}) {
  try {
    // Optional dependency — do not crash if socket.io not installed
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    const { Server } = require('socket.io');
    io = new Server(httpServer, {
      cors: { origin: corsOrigin || '*', methods: ['GET', 'POST'] },
      path: '/socket.io',
    });
    io.on('connection', (socket) => {
      socket.on('join:company', (companyId) => {
        if (companyId) socket.join(`company:${companyId}`);
      });
    });
    bridgeEventBus();
    module.exports.ready = true;
    logger.info('socket gateway attached');
    return io;
  } catch (err) {
    logger.info('socket.io not available — in-app polling remains primary', { error: err.message });
    module.exports.ready = false;
    module.exports.note = err.message;
    return null;
  }
}

function bridgeEventBus() {
  if (bridged) return;
  bridged = true;
  try {
    const eventBus = require('../events/eventBus');
    const relay = (event, payload = {}) => {
      if (!io || !payload.companyId) return;
      io.to(`company:${payload.companyId}`).emit('enterprise:event', { event, payload });
      if (String(event).includes('notification') || event.endsWith('.created')) {
        io.to(`company:${payload.companyId}`).emit('enterprise:notification', {
          event,
          title: payload.title || event,
          body: payload.body || '',
        });
      }
    };
    eventBus.on('sales.created', (p) => relay('sales.created', p));
    eventBus.on('purchase.created', (p) => relay('purchase.created', p));
    eventBus.on('job.received', (p) => relay('job.received', p));
  } catch (err) {
    logger.debug('socket event bridge skipped', { error: err.message });
  }
}

function emitToCompany(companyId, event, data) {
  if (!io || !companyId) return false;
  io.to(`company:${companyId}`).emit(event, data);
  return true;
}

module.exports = {
  ready: false,
  note: 'Call attachSocket(httpServer) to enable realtime; otherwise Notification Center polls.',
  attachSocket,
  emitToCompany,
  bridgeEventBus,
};
