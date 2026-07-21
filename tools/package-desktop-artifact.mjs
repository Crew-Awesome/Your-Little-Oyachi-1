import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const platform = process.env.RELEASE_PLATFORM;
const buildRoot = resolve(root, 'dist', 'your-little-oyachi');
const output = resolve(root, 'dist', 'platform-build');
const binaries = {
  windows: ['your-little-oyachi-win_x64.exe'],
  linux: ['your-little-oyachi-linux_x64', 'your-little-oyachi-linux_arm64'],
  macos: [
    'your-little-oyachi-mac_x64',
    'your-little-oyachi-mac_arm64',
    'your-little-oyachi-mac_universal',
  ],
}[platform];

if (!binaries) {
  throw new Error(`Unsupported release platform: ${platform}`);
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(buildRoot, 'resources.neu'), resolve(output, 'resources.neu'));
for (const binary of binaries) {
  await cp(resolve(buildRoot, binary), resolve(output, binary));
}
