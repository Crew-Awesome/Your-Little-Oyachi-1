import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const destination = resolve(root, 'desktop-resources');

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const path of ['game.html', 'styles.css', 'src', 'assets']) {
  await cp(resolve(root, path), resolve(destination, path), { recursive: true });
}

await cp(
  resolve(root, 'node_modules/@neutralinojs/lib/dist/neutralino.js'),
  resolve(destination, 'neutralino.js'),
);

console.log(`Prepared Neutralino resources in ${destination}`);
