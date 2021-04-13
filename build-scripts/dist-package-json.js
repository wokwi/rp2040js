const fs = require('fs');
const path = require('path');

fs.writeFileSync(
  path.join(__dirname, '../dist/cjs/package.json'),
  JSON.stringify({
    type: 'commonjs',
  })
);

fs.writeFileSync(
  path.join(__dirname, '../dist/esm/package.json'),
  JSON.stringify({
    type: 'esm',
  })
);
