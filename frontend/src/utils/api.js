/**
 * Single Axios instance — all modules must import from here or from ../api/client.
 * Dual client (this file vs api/client) removed; one interceptor chain for JWT + offline.
 */
export { default, onApiLoadingChange } from '../api/client';
