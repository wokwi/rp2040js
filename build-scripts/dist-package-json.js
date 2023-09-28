import fs from 'fs';
import path from 'path';
import * as url from 'url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

fs.writeFileSync(
  path.join(__dirname, '../dist/cjs/package.json'),
  JSON.stringify({
    type: 'commonjs',
  }),
);
