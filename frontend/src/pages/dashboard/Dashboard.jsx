/**
 * @deprecated Unused marketing dashboard with hardcoded charts.
 * Main ERP home is `pages/Dashboard.jsx` (route `/`).
 */
import React from 'react';
import { Link } from 'react-router-dom';

export default function DeprecatedMarketingDashboard() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">This preview dashboard is retired</h1>
        <p className="text-sm text-slate-600">
          Open the live ERP from the home route — it uses your company&apos;s sales, purchase, and ledger data.
        </p>
        <Link to="/" className="inline-block px-4 py-2 bg-black text-white text-sm font-medium rounded-lg">
          Go to ERP
        </Link>
      </div>
    </div>
  );
}
