import React, { useEffect, useState } from 'react';
import { CreditCard, Check, Loader2, ArrowLeft, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { billingApi } from '../../api/billing.api';
import { toast } from '../../store/useToastStore';
import { notifyError } from '../../utils/notify';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/**
 * Tenant SaaS subscription portal — renew / upgrade plan.
 * Does not touch ERP sales/purchase screens.
 */
const SubscriptionBillingPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cycle, setCycle] = useState('monthly');

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await billingApi.me();
      setData(res?.data || res);
    } catch (err) {
      notifyError(err, 'Could not load billing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const payForPlan = async (planId) => {
    setBusy(true);
    try {
      const res = await billingApi.checkout({ planId, billingCycle: cycle });
      const payload = res?.data || res;

      if (payload.applied) {
        toast.success('Plan activated');
        await refresh();
        return;
      }

      if (payload.checkout?.orderId) {
        const ok = await loadRazorpayScript();
        if (!ok || !window.Razorpay) {
          toast.error('Razorpay script failed to load');
          return;
        }
        const options = {
          key: payload.checkout.key,
          amount: payload.checkout.amount,
          currency: payload.checkout.currency,
          name: payload.checkout.name,
          description: payload.checkout.description,
          order_id: payload.checkout.orderId,
          handler: async (response) => {
            try {
              await billingApi.confirm({
                orderId: payload.order._id || payload.order.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success('Payment successful — subscription renewed');
              await refresh();
            } catch (err) {
              notifyError(err, 'Payment verification failed');
            }
          },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
        return;
      }

      toast.success(payload.message || 'Payment order created — admin will confirm shortly');
      await refresh();
    } catch (err) {
      notifyError(err, 'Checkout failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="animate-spin" /> Loading subscription…
      </div>
    );
  }

  const sub = data?.subscription;
  const plans = data?.plans || [];
  const ent = data?.entitlement || {};

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link to="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-white mb-2">
              <ArrowLeft size={12} /> Back to ERP
            </Link>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <CreditCard className="text-violet-400" size={22} /> Subscription
            </h1>
            <p className="text-slate-500 text-sm mt-1">{data?.company?.name}</p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div className="font-bold uppercase tracking-widest text-slate-500">Status</div>
            <div className="text-lg font-black text-emerald-400 capitalize">{ent.status || sub?.status || '—'}</div>
            {ent.daysLeft != null && <div>{ent.daysLeft} days left</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-wrap gap-6 items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Current plan</p>
            <p className="text-xl font-black">{sub?.planId?.name || data?.company?.plan?.name || '—'}</p>
            <p className="text-xs text-slate-500 mt-1">
              Policy: {data?.company?.commercialPolicy || 'legacy_open'} · Ends {sub?.endDate ? new Date(sub.endDate).toLocaleDateString() : '—'}
            </p>
          </div>
          <div className="flex gap-2 bg-slate-900 rounded-xl p-1">
            {['monthly', 'yearly'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${cycle === c ? 'bg-violet-600 text-white' : 'text-slate-400'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan._id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col">
              <h3 className="font-black text-lg">{plan.name}</h3>
              <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{plan.description || ' '}</p>
              <p className="mt-3">
                <span className="text-2xl font-black">₹{cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly}</span>
                <span className="text-slate-500 text-xs">/{cycle === 'yearly' ? 'yr' : 'mo'}</span>
              </p>
              <ul className="mt-4 space-y-1 text-xs text-slate-400 flex-1">
                <li className="flex gap-2"><Check size={12} className="text-emerald-400" /> {plan.limits?.users || 1} users</li>
                <li className="flex gap-2"><Check size={12} className="text-emerald-400" /> {plan.limits?.invoicesPerMonth || 100} invoices/mo</li>
                {plan.trialDays > 0 && (
                  <li className="flex gap-2"><Shield size={12} className="text-violet-400" /> {plan.trialDays}-day trial on signup</li>
                )}
              </ul>
              <button
                type="button"
                disabled={busy}
                onClick={() => payForPlan(plan._id)}
                className="mt-4 w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-sm disabled:opacity-50"
              >
                {busy ? 'Please wait…' : 'Choose plan'}
              </button>
            </div>
          ))}
        </div>

        {(data?.orders || []).length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Recent orders</h2>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-white/5 text-slate-500">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Amount</th>
                    <th className="text-left p-3">Cycle</th>
                    <th className="text-left p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o._id} className="border-t border-white/5">
                      <td className="p-3">{new Date(o.createdAt).toLocaleString()}</td>
                      <td className="p-3">₹{(o.amountPaise / 100).toFixed(2)}</td>
                      <td className="p-3 capitalize">{o.billingCycle}</td>
                      <td className="p-3 capitalize">{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionBillingPage;
