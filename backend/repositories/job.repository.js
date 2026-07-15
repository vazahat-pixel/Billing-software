const Job = require('../models/Job');
const BaseRepository = require('./BaseRepository');

class JobRepository extends BaseRepository {
  constructor() {
    super(Job);
  }
}

module.exports = new JobRepository();
