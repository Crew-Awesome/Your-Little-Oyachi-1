import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, 'desktop-resources');

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

const resourcePaths = [
  'favicon.ico',
  'game.html',
  'styles.css',
  'src',
  'assets/audio',
  'assets/characters',
  'assets/fonts',
  'assets/site/cover-art.png',
  'assets/site/favicon-big.png',
  'assets/toys',
  'assets/ui',
  'assets/vendor',
];

for (const path of resourcePaths) {
  await cp(resolve(root, path), resolve(destination, path), { recursive: true });
}

const desktopGamePath = resolve(destination, 'game.html');
const desktopGame = await readFile(desktopGamePath, 'utf8');
const gameScriptMarker = '    <script type="module" src="src/game/index.js?v=2026-01-20"></script>';
if (!desktopGame.includes(gameScriptMarker)) {
  throw new Error('Could not find the game entry script while preparing desktop resources.');
}
await writeFile(
  desktopGamePath,
  desktopGame.replace(
    gameScriptMarker,
    `    <script src="neutralino.js"></script>\n${gameScriptMarker}`,
  ),
);

await cp(
  resolve(root, 'node_modules/@neutralinojs/lib/dist/neutralino.js'),
  resolve(destination, 'neutralino.js'),
);

console.log(`Prepared Neutralino resources in ${destination}`);
