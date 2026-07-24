/**
 * k6 stress / scale ladder — Stage 8.11.
 * Simulates ramp: 100 → 500 → 1000 VUs (adjust for CI with STRESS_PROFILE=ci).
 * Run: k6 run performance/k6/load-stress.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const ci = __ENV.STRESS_PROFILE === 'ci';

export const options = ci
  ? {
      stages: [
        { duration: '20s', target: 20 },
        { duration: '30s', target: 50 },
        { duration: '20s', target: 0 },
      ],
      thresholds: {
        http_req_failed: ['rate<0.1'],
        http_req_duration: ['p(95)<1500'],
      },
    }
  : {
      stages: [
        { duration: '1m', target: 100 },
        { duration: '2m', target: 500 },
        { duration: '2m', target: 1000 },
        { duration: '1m', target: 0 },
      ],
      thresholds: {
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<2000'],
      },
    };

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:5000';

export default function () {
  const res = http.get(`${BASE}/health`);
  check(res, { 'ok': (r) => r.status === 200 });
  sleep(1);
}
