/**
 * Wire JWT companyId into services without changing business algorithms.
 * Services keep their existing Model usage; repositories are available for new code.
 */
const partyRepository = require('../repositories/party.repository');
const itemRepository = require('../repositories/item.repository');

module.exports = {
  partyRepository,
  itemRepository,
};
