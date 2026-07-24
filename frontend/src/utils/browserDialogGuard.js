import { toast } from '../store/useToastStore';

let installed = false;

/** Block native browser dialogs — route alerts to toast instead. */
export function installBrowserDialogGuard() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.alert = (message) => {
    toast.warning(String(message ?? ''));
  };

  window.confirm = () => {
    console.warn('[ERP] window.confirm is blocked. Use erpConfirm() instead.');
    toast.warning('Please confirm using the in-app dialog.');
    return false;
  };

  window.prompt = () => {
    console.warn('[ERP] window.prompt is not supported in ERP UI.');
    toast.warning('Input prompt is not available. Use an in-app form instead.');
    return null;
  };
}
