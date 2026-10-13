/**
 * E-Way Bill GSP Integration Client
 * Supports Masters India, ClearTax, Sandbox.co.in, Custom GSP, and Simulated/Sandbox Mode.
 *
 * Plug-and-play architecture:
 * As soon as real credentials are added to backend/.env, this automatically switches
 * from Simulated Mode to Live Government/GSP generation.
 */

class GspClient {
  constructor() {
    this.tokenCache = {
      token: null,
      expiresAt: 0,
    };
  }

  get config() {
    const provider = (process.env.EWAY_GSP_PROVIDER || 'mock').trim().toLowerCase();
    const clientId = (process.env.EWAY_GSP_CLIENT_ID || '').trim();
    const clientSecret = (process.env.EWAY_GSP_CLIENT_SECRET || '').trim();
    const username = (process.env.EWAY_GSP_USERNAME || '').trim();
    const password = (process.env.EWAY_GSP_PASSWORD || '').trim();
    const baseUrl = (process.env.EWAY_GSP_BASE_URL || '').trim();
    const isSandbox = String(process.env.EWAY_SANDBOX_MODE || 'true').toLowerCase() === 'true';

    const isLiveReady = Boolean(
      provider !== 'mock' &&
      (clientId || provider === 'custom') &&
      (clientSecret || provider === 'cleartax' || provider === 'custom')
    );

    return {
      provider,
      clientId,
      clientSecret,
      username,
      password,
      baseUrl,
      isSandbox,
      isLiveReady,
    };
  }

  getStatus() {
    const cfg = this.config;
    return {
      provider: cfg.provider,
      isConfigured: cfg.isLiveReady,
      mode: cfg.isLiveReady ? (cfg.isSandbox ? 'Sandbox (GSP Live Test)' : 'Production (GSP Live)') : 'Simulated / Ready for Keys',
      supportedProviders: ['masters_india', 'cleartax', 'sandbox', 'custom', 'mock'],
      requiredEnvVars: [
        'EWAY_GSP_PROVIDER',
        'EWAY_GSP_CLIENT_ID',
        'EWAY_GSP_CLIENT_SECRET',
        'EWAY_GSP_USERNAME',
        'EWAY_GSP_PASSWORD',
        'EWAY_SANDBOX_MODE'
      ],
    };
  }

  /**
   * Calculate validUpto as per CGST Rule 138(10):
   * 1 day per 200 km for normal cargo (or min 24 hours).
   */
  calculateValidity(distanceKm = 100, fromDate = new Date()) {
    const km = Math.max(1, Number(distanceKm) || 100);
    const days = Math.max(1, Math.ceil(km / 200));
    const validUpto = new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
    return validUpto;
  }

  /**
   * Generate E-Way Bill
   */
  async generate(nicPayload, companyAuth = {}) {
    const cfg = this.config;

    // 1. If real GSP is not configured or set to mock, run Simulated/Sandbox Engine
    if (!cfg.isLiveReady || cfg.provider === 'mock') {
      return this._generateMock(nicPayload);
    }

    // 2. Dispatch to configured GSP provider
    switch (cfg.provider) {
      case 'masters_india':
        return this._generateMastersIndia(nicPayload, companyAuth);
      case 'cleartax':
        return this._generateClearTax(nicPayload, companyAuth);
      case 'sandbox':
        return this._generateSandboxCo(nicPayload, companyAuth);
      case 'custom':
        return this._generateCustomGsp(nicPayload, companyAuth);
      default:
        return this._generateMock(nicPayload);
    }
  }

  /**
   * Simulated / Sandbox Mode
   * Generates a 12-digit Indian E-Way bill number matching government specification.
   */
  _generateMock(payload) {
    const random10 = Math.floor(1000000000 + Math.random() * 9000000000);
    const ewbNo = `91${random10}`;
    const ewbDate = new Date();
    const distance = Number(payload.transDistance || payload.distance || 100);
    const validUpto = this.calculateValidity(distance, ewbDate);

    return {
      success: true,
      ewbNo,
      ewbDate,
      validUpto,
      status: 'Generated',
      provider: 'Simulated (Plug in .env keys for live GSP)',
      qrCodeData: `EWB:${ewbNo}|DT:${ewbDate.toISOString().slice(0, 10)}|GSTIN:${payload.fromGstin || ''}|VAL:${payload.totalValue || 0}`,
      alert: 'E-Way Bill generated in simulated mode. Add EWAY_GSP credentials in .env to connect to live government servers.',
      rawResponse: {
        ewayBillNo: ewbNo,
        ewayBillDate: ewbDate.toISOString(),
        validUpto: validUpto.toISOString(),
        simulated: true,
      },
    };
  }

  /**
   * Masters India GSP
   */
  async _generateMastersIndia(payload, companyAuth) {
    const cfg = this.config;
    const baseUrl = cfg.baseUrl || (cfg.isSandbox ? 'https://sandbox.mastersindia.net' : 'https://api.mastersindia.net');

    // Get Auth Token
    const authRes = await fetch(`${baseUrl}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
      }),
    });

    if (!authRes.ok) {
      const errText = await authRes.text();
      throw new Error(`Masters India Auth Failed (${authRes.status}): ${errText}`);
    }

    const authData = await authRes.json();
    const token = authData.access_token || authData.data?.access_token;

    // Call E-Way Bill Generation API
    const username = companyAuth.ewayUsername || cfg.username;
    const password = companyAuth.ewayPassword || cfg.password;

    const apiRes = await fetch(`${baseUrl}/api/v1.0/ewaybill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        client_id: cfg.clientId,
        username: username,
        password: password,
        gstin: payload.fromGstin,
      },
      body: JSON.stringify(payload),
    });

    const resJson = await apiRes.json();
    if (!apiRes.ok || resJson.status === 0 || resJson.error) {
      const msg = resJson.error || resJson.message || JSON.stringify(resJson);
      throw new Error(`Masters India E-Way Generation Error: ${msg}`);
    }

    const res = resJson.results || resJson.data || resJson;
    return {
      success: true,
      ewbNo: String(res.ewayBillNo || res.ewbNo),
      ewbDate: res.ewayBillDate ? new Date(res.ewayBillDate) : new Date(),
      validUpto: res.validUpto ? new Date(res.validUpto) : this.calculateValidity(payload.transDistance),
      status: 'Generated',
      provider: 'Masters India',
      qrCodeData: res.qrCodeData || res.signedQRCode || '',
      rawResponse: resJson,
    };
  }

  /**
   * ClearTax GSP
   */
  async _generateClearTax(payload, companyAuth) {
    const cfg = this.config;
    const baseUrl = cfg.baseUrl || (cfg.isSandbox ? 'https://api-sandbox.cleartax.in' : 'https://api.cleartax.in');

    const apiRes = await fetch(`${baseUrl}/eway/v2/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cleartax-auth-token': cfg.clientSecret || cfg.clientId,
        gstin: payload.fromGstin,
      },
      body: JSON.stringify(payload),
    });

    const resJson = await apiRes.json();
    if (!apiRes.ok || resJson.error) {
      throw new Error(`ClearTax Error: ${resJson.error || JSON.stringify(resJson)}`);
    }

    const data = Array.isArray(resJson) ? resJson[0] : resJson;
    return {
      success: true,
      ewbNo: String(data.ewb_number || data.ewayBillNo),
      ewbDate: data.ewb_date ? new Date(data.ewb_date) : new Date(),
      validUpto: data.valid_until ? new Date(data.valid_until) : this.calculateValidity(payload.transDistance),
      status: 'Generated',
      provider: 'ClearTax',
      qrCodeData: data.qr_code || '',
      rawResponse: resJson,
    };
  }

  /**
   * Sandbox.co.in
   */
  async _generateSandboxCo(payload, companyAuth) {
    const cfg = this.config;
    const baseUrl = cfg.baseUrl || 'https://api.sandbox.co.in';

    // Auth
    const authRes = await fetch(`${baseUrl}/authenticate`, {
      method: 'POST',
      headers: {
        'x-api-key': cfg.clientId,
        'x-api-secret': cfg.clientSecret,
        'x-api-version': '1.0',
      },
    });

    if (!authRes.ok) {
      throw new Error(`Sandbox.co.in Auth Error: ${await authRes.text()}`);
    }
    const { access_token } = await authRes.json();

    // Generate E-Way Bill
    const apiRes = await fetch(`${baseUrl}/gsp/ewaybill/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: access_token,
        'x-api-key': cfg.clientId,
      },
      body: JSON.stringify(payload),
    });

    const resJson = await apiRes.json();
    if (!apiRes.ok || resJson.code !== 200) {
      throw new Error(`Sandbox E-Way Generation Error: ${resJson.message || JSON.stringify(resJson)}`);
    }

    const data = resJson.data || resJson;
    return {
      success: true,
      ewbNo: String(data.ewbNo || data.ewayBillNo),
      ewbDate: data.ewbDate ? new Date(data.ewbDate) : new Date(),
      validUpto: data.validUpto ? new Date(data.validUpto) : this.calculateValidity(payload.transDistance),
      status: 'Generated',
      provider: 'Sandbox.co.in',
      qrCodeData: data.signedQRCode || '',
      rawResponse: resJson,
    };
  }

  /**
   * Custom GSP Webhook / Endpoint
   */
  async _generateCustomGsp(payload, companyAuth) {
    const cfg = this.config;
    if (!cfg.baseUrl) throw new Error('EWAY_GSP_BASE_URL must be specified for custom GSP provider');

    const headers = { 'Content-Type': 'application/json' };
    if (cfg.clientSecret) headers['Authorization'] = `Bearer ${cfg.clientSecret}`;
    if (cfg.clientId) headers['x-client-id'] = cfg.clientId;

    const apiRes = await fetch(cfg.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ payload, companyAuth }),
    });

    const resJson = await apiRes.json();
    if (!apiRes.ok || resJson.error) {
      throw new Error(`Custom GSP Error: ${resJson.error || JSON.stringify(resJson)}`);
    }

    return {
      success: true,
      ewbNo: String(resJson.ewbNo || resJson.ewayBillNo),
      ewbDate: resJson.ewbDate ? new Date(resJson.ewbDate) : new Date(),
      validUpto: resJson.validUpto ? new Date(resJson.validUpto) : this.calculateValidity(payload.transDistance),
      status: 'Generated',
      provider: 'Custom GSP',
      qrCodeData: resJson.qrCodeData || '',
      rawResponse: resJson,
    };
  }

  /**
   * Format NIC Bulk JSON for direct upload on https://ewaybillgst.gov.in/
   */
  buildGovtPortalJson(doc, company, customer) {
    const fmtDt = (d) => {
      const dt = d ? new Date(d) : new Date();
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    return {
      version: '1.0.0',
      billLists: [
        {
          userGstin: company?.gstin || doc.fromGstin,
          supplyType: doc.supplyType || 'O',
          subSupplyType: '1',
          docType: 'INV',
          docNo: doc.docNo,
          docDate: fmtDt(doc.docDate),
          transType: '1',
          fromGstin: company?.gstin || doc.fromGstin,
          fromTrdName: company?.name || 'Seller',
          fromAddr1: company?.address || '',
          fromPlace: company?.city || company?.area || 'Surat',
          fromPincode: Number(company?.pincode || 395002),
          fromStateCode: Number(doc.fromStateCode || 24),
          actFromStateCode: Number(doc.fromStateCode || 24),
          toGstin: customer?.gstin || doc.toGstin || 'URP',
          toTrdName: customer?.name || 'Buyer',
          toAddr1: customer?.address || '',
          toPlace: customer?.city || customer?.station || 'Destination',
          toPincode: Number(customer?.pincode || 395002),
          toStateCode: Number(doc.toStateCode || 24),
          actToStateCode: Number(doc.toStateCode || 24),
          totalValue: Number(doc.totalValue || 0),
          cgstValue: Number(doc.cgstValue || 0),
          sgstValue: Number(doc.sgstValue || 0),
          igstValue: Number(doc.igstValue || 0),
          cessValue: 0,
          totInvValue: Number((doc.totalValue || 0) + (doc.cgstValue || 0) + (doc.sgstValue || 0) + (doc.igstValue || 0)),
          transMode: doc.transportMode || '1',
          transDistance: String(doc.distance || 100),
          transporterName: doc.transporterName || '',
          transporterId: doc.transporterId || '',
          transDocNo: doc.lrNo || '',
          transDocDate: doc.lrDate ? fmtDt(doc.lrDate) : '',
          vehicleNo: doc.vehicleNo || '',
          vehicleType: doc.vehicleType || 'R',
          itemList: (doc.requestPayload?.itemList || []).map((it, idx) => ({
            itemNo: idx + 1,
            productName: it.PrdDesc || it.name || 'Textile Goods',
            productDesc: it.PrdDesc || 'Fabric',
            hsnCode: Number(it.HsnCd || it.hsnCode || 5407),
            quantity: Number(it.Qty || it.mts || 1),
            qtyUnit: it.Unit || 'MTR',
            taxableAmount: Number(it.AssAmt || it.taxableAmount || 0),
            cgstRate: Number(doc.cgstValue > 0 ? 2.5 : 0),
            sgstRate: Number(doc.sgstValue > 0 ? 2.5 : 0),
            igstRate: Number(doc.igstValue > 0 ? 5.0 : 0),
            cessRate: 0,
          })),
        },
      ],
    };
  }
}

module.exports = new GspClient();
