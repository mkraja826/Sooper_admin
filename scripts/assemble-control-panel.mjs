import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function assemble(prefix, partCount, output) {
  const parts = [];

  for (let index = 1; index <= partCount; index += 1) {
    const file = path.join(root, `${prefix}.part${index}`);
    parts.push(await readFile(file, 'utf8'));
  }

  await writeFile(path.join(root, output), parts.join(''), 'utf8');
}

await assemble('src/control-panel/ControlPanelDashboard', 8, 'src/ControlPanelDashboard.tsx');
await assemble('src/control-panel/css', 6, 'src/control-panel.css');

console.log('Assembled SooperAdmin control panel sources.');
