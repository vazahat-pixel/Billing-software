const jobService = require('../services/jobService');

exports.issueToJob = async (req, res) => {
  try {
    const job = await jobService.issueToJob(req.body);
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.receiveFromJob = async (req, res) => {
  try {
    const result = await jobService.receiveFromJob(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateProcess = async (req, res) => {
  try {
    const { jobId, status, companyId } = req.body;
    const job = await jobService.updateProcess(jobId, status, companyId);
    res.status(200).json({ success: true, data: job });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getJobs = async (req, res) => {
  try {
    const { companyId } = req.query;
    const jobs = await jobService.getJobs(companyId);
    res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
