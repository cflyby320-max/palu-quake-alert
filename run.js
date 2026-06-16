// Entry point. Run: `node --env-file=.env run.js` (or see `node run.js --help`).
import { main } from './src/monitor.js';

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
