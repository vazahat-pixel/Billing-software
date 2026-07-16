/**
 * Execute tasks with bounded concurrency and progress callbacks.
 */
async function runBatched(items, worker, { concurrency = 5, onProgress } = {}) {
  const results = { success: [], failed: [] };
  let index = 0;
  let completed = 0;

  async function runOne() {
    while (index < items.length) {
      const i = index++;
      const item = items[i];
      try {
        const value = await worker(item, i);
        results.success.push({ item, value, index: i });
      } catch (err) {
        results.failed.push({ item, error: err.message || String(err), index: i });
      }
      completed += 1;
      if (onProgress) onProgress({ completed, total: items.length, failed: results.failed.length });
    }
  }

  const pool = Array.from({ length: Math.min(concurrency, items.length) }, () => runOne());
  await Promise.all(pool);
  return results;
}

module.exports = { runBatched };
