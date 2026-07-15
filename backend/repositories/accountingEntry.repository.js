const AccountingEntry = require('../models/AccountingEntry');
const BaseRepository = require('./BaseRepository');

class AccountingEntryRepository extends BaseRepository {
  constructor() {
    super(AccountingEntry);
  }
}

module.exports = new AccountingEntryRepository();
