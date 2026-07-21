import { chmod, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entrypoint = resolve(root, 'extensions', 'discord-rpc', 'src', 'index.js');
const platform = process.env.DISCORD_RPC_PLATFORM ?? {
  win32: 'windows',
  linux: 'linux',
  darwin: 'macos',
}[process.platform];
const targetsByPlatform = {
  windows: [
    {
      target: 'bun-windows-x64',
      outfile: resolve(root, 'extensions', 'discord-rpc', 'bin', 'windows', 'oyachi-discord-rpc.exe'),
    },
  ],
  linux: [
    {
      target: 'bun-linux-x64',
      outfile: resolve(root, 'extensions', 'discord-rpc', 'bin', 'linux', 'oyachi-discord-rpc-x64'),
    },
    {
      target: 'bun-linux-arm64',
      outfile: resolve(root, 'extensions', 'discord-rpc', 'bin', 'linux', 'oyachi-discord-rpc-arm64'),
    },
  ],
  macos: [
    {
      target: 'bun-darwin-x64',
      outfile: resolve(root, 'extensions', 'discord-rpc', 'bin', 'macos', 'oyachi-discord-rpc-x64'),
    },
    {
      target: 'bun-darwin-arm64',
      outfile: resolve(root, 'extensions', 'discord-rpc', 'bin', 'macos', 'oyachi-discord-rpc-arm64'),
    },
  ],
};
const targets = targetsByPlatform[platform];

if (!targets) {
  throw new Error(`Unsupported Discord RPC build platform: ${platform}`);
}

await rm(
  resolve(root, 'extensions', 'discord-rpc', 'bin', 'linux', 'oyachi-discord-rpc'),
  { force: true },
);

for (const { target, outfile } of targets) {
  await mkdir(dirname(outfile), { recursive: true });
  const result = await Bun.build({
    entrypoints: [entrypoint],
    compile: { target, outfile },
  });
  if (!result.success) {
    result.logs.forEach((log) => console.error(log));
    process.exitCode = 1;
  }
}

for (const launcher of [
  resolve(root, 'extensions', 'discord-rpc', 'bin', 'linux', 'run.sh'),
  resolve(root, 'extensions', 'discord-rpc', 'bin', 'macos', 'run.sh'),
]) {
  await chmod(launcher, 0o755);
}
