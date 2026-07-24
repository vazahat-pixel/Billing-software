import { parseApiError } from './errors';
import { toast } from '../store/useToastStore';

/** Show a professional toast for unexpected API failures when callers opt in. */
export function handleGlobalError(err, fallback) {
  return toast.error(err, { fallback: fallback || 'Something went wrong. Please try again.' });
}

export { parseApiError };

