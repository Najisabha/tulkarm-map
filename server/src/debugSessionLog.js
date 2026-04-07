import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.join(__dirname, '..', '..', 'debug-7f4b9d.log');

export function debugSessionLog(payload) {
  try {
    fs.appendFileSync(
      LOG_PATH,
      `${JSON.stringify({ sessionId: '7f4b9d', timestamp: Date.now(), ...payload })}\n`
    );
  } catch {
    /* ignore */
  }
}
