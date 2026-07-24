import { toast } from '../store/useToastStore';

export function notifySuccess(message, options) {
  return toast.success(message, options);
}

export function notifyError(err, fallback) {
  return toast.error(err, { fallback: fallback || 'Something went wrong. Please try again.' });
}

export function notifyWarning(message, options) {
  return toast.warning(message, options);
}

export function notifyInfo(message, options) {
  return toast.info(message, options);
}

/** After save — invoice / voucher saved with reference */
export function notifySaved(label, reference, options = {}) {
  const ref = reference ? ` · ${reference}` : '';
  return toast.success(`✓ ${label} saved${ref}`, {
    duration: 4500,
    ...options,
  });
}

export function notifyLoading(message) {
  return toast.loading(message);
}

export function dismissToast(id) {
  if (id) toast.dismiss(id);
}
