const FinancialYear = require('../models/FinancialYear');
const VoucherSeries = require('../models/VoucherSeries');
const AppError = require('../utils/AppError');

class SetupMasterService {
  async listFinancialYears(companyId) {
    return FinancialYear.find({ companyId }).sort({ startDate: -1 });
  }

  async createFinancialYear(companyId, data) {
    const code = String(data.code || '').trim();
    if (!code || !data.startDate || !data.endDate) {
      throw AppError.badRequest('code, startDate, endDate required');
    }
    if (data.isActive) {
      await FinancialYear.updateMany({ companyId, isActive: true }, { isActive: false });
    }
    return FinancialYear.create({
      companyId,
      code,
      label: data.label || code,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      isActive: !!data.isActive,
      isLocked: !!data.isLocked,
    });
  }

  async setActiveFinancialYear(id, companyId) {
    const fy = await FinancialYear.findOne({ _id: id, companyId });
    if (!fy) throw AppError.notFound('Financial year not found');
    await FinancialYear.updateMany({ companyId }, { isActive: false });
    fy.isActive = true;
    await fy.save();
    return fy;
  }

  async listVoucherSeries(companyId, { module } = {}) {
    const filter = { companyId };
    if (module) filter.module = module;
    return VoucherSeries.find(filter).sort({ module: 1, name: 1 });
  }

  async createVoucherSeries(companyId, data) {
    if (!data.module || !data.prefix || !data.name) {
      throw AppError.badRequest('module, name, prefix required');
    }
    if (data.isDefault) {
      await VoucherSeries.updateMany(
        { companyId, module: data.module, isDefault: true },
        { isDefault: false }
      );
    }
    return VoucherSeries.create({
      companyId,
      module: data.module,
      name: data.name,
      prefix: String(data.prefix).toUpperCase(),
      padLength: data.padLength || 4,
      financialYearCode: data.financialYearCode || '',
      isDefault: !!data.isDefault,
      status: data.status || 'Active',
    });
  }
}

module.exports = new SetupMasterService();
