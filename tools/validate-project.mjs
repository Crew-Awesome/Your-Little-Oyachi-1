import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const exists = async (relativePath) => {
  try {
    await access(resolve(root, relativePath));
    return true;
  } catch {
    return false;
  }
};

const requireFile = async (relativePath) => {
  if (!(await exists(relativePath))) {
    errors.push(`Missing required file: ${relativePath}`);
  }
};

for (const file of [
  'game.html',
  'styles.css',
  'src/game/index.js',
  'src/game/config/assets.js',
  'assets/vendor/pixi.min.js',
  'neutralino.config.json',
  'package-lock.json',
]) {
  await requireFile(file);
}

const config = JSON.parse(await readFile(resolve(root, 'neutralino.config.json'), 'utf8'));
if (config.url !== '/game.html') {
  errors.push(`Neutralino URL must be /game.html, got ${config.url}`);
}
if (config.documentRoot !== config.cli?.resourcesPath) {
  errors.push('Neutralino documentRoot and cli.resourcesPath must match.');
}

const gameHtml = await readFile(resolve(root, 'game.html'), 'utf8');
for (const match of gameHtml.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const reference = match[1];
  if (/^(https?:)?\/\//.test(reference) || reference === 'neutralino.js') {
    continue;
  }
  await requireFile(reference.split('?')[0]);
}

const assetSources = new Set();
for (const file of ['src/game/config/assets.js', 'src/game/systems/audio-system.js']) {
  const source = await readFile(resolve(root, file), 'utf8');
  for (const match of source.matchAll(/assets\/[A-Za-z0-9_./-]+/g)) {
    assetSources.add(match[0]);
  }
}
for (const asset of assetSources) {
  await requireFile(asset);
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Project validation passed.');
}
