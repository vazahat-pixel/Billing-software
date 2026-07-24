/**
 * k6 smoke load — Stage 8.11 performance certification.
 * Run: k6 run performance/k6/load-smoke.js
 * Env: BASE_URL (default http://127.0.0.1:5000)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
  },
};

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:5000';

export default function () {
  const res = http.get(`${BASE}/health`);
  check(res, {
    'health status 200': (r) => r.status === 200,
    'health latency < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(0.5);
}
