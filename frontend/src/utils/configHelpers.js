/** Helpers for dynamic config bundle (Phase 3) */

export const buildModuleConfig = (bundle, fallback) => {
  if (bundle?.modules) {
    return {
      modules: bundle.modules,
      subMenus: bundle.subMenus || {},
      fields: bundle.fields || {}
    };
  }
  return fallback || { modules: {}, subMenus: {}, fields: {} };
};

export const isModuleEnabled = (bundle, moduleKey, fallback = true) => {
  if (!bundle?.modules) return fallback;
  return bundle.modules[moduleKey] !== false;
};

export const isSubMenuEnabled = (bundle, moduleKey, label, fallback = true) => {
  if (!bundle?.subMenus?.[moduleKey]) return fallback;
  return bundle.subMenus[moduleKey][label] !== false;
};

export const isFieldEnabled = (bundle, moduleKey, fieldKey, fallback = true) => {
  if (!bundle?.fields?.[moduleKey]) return fallback;
  const val = bundle.fields[moduleKey][fieldKey];
  return val !== false;
};

export const isFlagEnabled = (bundle, flagKey, fallback = true) => {
  if (!bundle?.featureFlags) return fallback;
  const flags = bundle.featureFlags;
  if (Array.isArray(flags)) {
    const hit = flags.find((f) => (f.flagKey || f.key) === flagKey);
    if (!hit) return fallback;
    return hit.enabled !== false;
  }
  if (typeof flags === 'object') {
    if (!(flagKey in flags)) return fallback;
    return flags[flagKey] !== false;
  }
  return fallback;
};

export const isBillFieldVisible = (bundle, billType, fieldKey, section = 'header', fallback = true) => {
  const bill = bundle?.bills?.[billType];
  if (!bill) return fallback;
  const arr = section === 'header'
    ? bill.headerFields
    : section === 'footer'
      ? bill.footerFields
      : bill.lineColumns;
  const field = arr?.find((f) => f.key === fieldKey);
  if (!field) return fallback;
  return field.visible !== false;
};

export const applyColumnConfig = (bundle, tableKey, defaultColumns) => {
  const cfg = bundle?.columns?.[tableKey];
  if (!cfg?.columns?.length) return defaultColumns;

  const sorted = [...cfg.columns]
    .filter((c) => c.visible !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const result = [];
  for (const col of sorted) {
    const def = defaultColumns.find((d) => d.key === col.key);
    if (def) {
      result.push({
        ...def,
        label: col.label || def.label,
        align: col.align || def.align
      });
    }
  }

  const actionsCol = defaultColumns.find((d) => d.key === 'actions');
  if (actionsCol && !result.find((r) => r.key === 'actions')) {
    result.push(actionsCol);
  }

  return result.length ? result : defaultColumns;
};

export const resolveSalesFieldVisibility = (bundle, user, plan) => {
  const fallbackBroker = user?.moduleConfig?.fields?.sales?.broker ?? (plan?.fields?.sales?.broker !== false);
  const fallbackChallan = user?.moduleConfig?.fields?.sales?.challan ?? (plan?.fields?.sales?.challan !== false);

  const showBroker = isFieldEnabled(bundle, 'sales', 'broker', fallbackBroker)
    && isFlagEnabled(bundle, 'sales_broker', fallbackBroker)
    && isBillFieldVisible(bundle, 'sales', 'broker', 'header', fallbackBroker);

  const showChallan = isFieldEnabled(bundle, 'sales', 'challan', fallbackChallan)
    && isFlagEnabled(bundle, 'sales_challan', fallbackChallan)
    && (isBillFieldVisible(bundle, 'sales', 'challanNo', 'header', fallbackChallan)
      || isBillFieldVisible(bundle, 'sales', 'chDate', 'header', fallbackChallan));

  return { showBroker, showChallan };
};

export const resolvePurchaseFieldVisibility = (bundle, user, plan) => {
  const fallbackBroker = user?.moduleConfig?.fields?.purchase?.broker ?? (plan?.fields?.purchase?.broker !== false);
  const fallbackDiscount2 = user?.moduleConfig?.fields?.purchase?.discount2 ?? (plan?.fields?.purchase?.discount2 !== false);

  const showBroker = isFieldEnabled(bundle, 'purchase', 'broker', fallbackBroker)
    && isFlagEnabled(bundle, 'purchase_broker', fallbackBroker)
    && isBillFieldVisible(bundle, 'purchase', 'broker', 'header', fallbackBroker);

  const showDiscount2 = isFieldEnabled(bundle, 'purchase', 'discount2', fallbackDiscount2)
    && isFlagEnabled(bundle, 'purchase_discount2', fallbackDiscount2)
    && (isBillFieldVisible(bundle, 'purchase', 'dis2Per', 'line', fallbackDiscount2)
      || isBillFieldVisible(bundle, 'purchase', 'dis2Amt', 'line', fallbackDiscount2));

  return { showBroker, showDiscount2 };
};

/** Generic bill field visibility map for any bill type (sales, purchase, millIssue, …) */
export const buildBillFieldVisibility = (bundle, billType) => {
  const vis = (key, section = 'header', fallback = true) =>
    isBillFieldVisible(bundle, billType, key, section, fallback);

  return {
    show: vis,
    header: (key, fallback = true) => vis(key, 'header', fallback),
    footer: (key, fallback = true) => vis(key, 'footer', fallback),
    line: (key, fallback = true) => vis(key, 'line', fallback),
  };
};
