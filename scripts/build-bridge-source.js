import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bridgePath = path.join(__dirname, '..', 'devtools', 'bridge.js');
const outPath = path.join(__dirname, '..', 'devtools', 'bridgeSource.js');

const source = fs.readFileSync(bridgePath, 'utf8');
const escaped = JSON.stringify(source);

const content = `// Auto-generated from bridge.js. Do not edit manually.\nexport const BRIDGE_SOURCE = ${escaped};\n`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('Successfully generated devtools/bridgeSource.js');
