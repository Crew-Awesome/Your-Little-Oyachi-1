const { appendFileSync, mkdirSync, readFileSync } = require('node:fs');
const net = require('node:net');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');

const CLIENT_ID = '1529196811254894603';
const HANDSHAKE = 0;
const FRAME = 1;
const CLOSE = 2;
const extensionConfig = JSON.parse(readFileSync(0, 'utf8'));
const extensionUrl =
  `ws://localhost:${extensionConfig.nlPort}` +
  `?extensionId=${extensionConfig.nlExtensionId}` +
  `&connectToken=${extensionConfig.nlConnectToken}`;
const logPath = resolve(process.cwd(), '.tmp', 'discord-rpc.log');

const log = (message) => {
  try {
    mkdirSync(resolve(process.cwd(), '.tmp'), { recursive: true });
    appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Logging must never prevent the game or its presence integration from running.
  }
};

const getDiscordPipePath = (index) => {
  if (process.platform === 'win32') {
    return `\\\\?\\pipe\\discord-ipc-${index}`;
  }
  const runtimePath =
    process.env.XDG_RUNTIME_DIR ||
    process.env.TMPDIR ||
    process.env.TMP ||
    process.env.TEMP ||
    '/tmp';
  return `${runtimePath.replace(/\/$/, '')}/discord-ipc-${index}`;
};

const connectToDiscordPipe = (index = 0) =>
  new Promise((resolvePipe, reject) => {
    if (index >= 10) {
      reject(new Error('No Discord RPC pipe was found.'));
      return;
    }
    const socket = net.createConnection({ path: getDiscordPipePath(index) });
    const tryNextPipe = () => {
      socket.destroy();
      connectToDiscordPipe(index + 1).then(resolvePipe, reject);
    };
    socket.once('error', tryNextPipe);
    socket.once('connect', () => {
      socket.removeListener('error', tryNextPipe);
      resolvePipe(socket);
    });
  });

const encodeFrame = (opcode, payload) => {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const frame = Buffer.alloc(8 + body.length);
  frame.writeUInt32LE(opcode, 0);
  frame.writeUInt32LE(body.length, 4);
  body.copy(frame, 8);
  return frame;
};

let discordSocket = null;
let receiveBuffer = Buffer.alloc(0);
let rpcReady = false;
let connectingToDiscord = false;
let reconnectTimer = null;
let handshakeTimer = null;
let latestPresence = {
  details: 'Taking care of Oyachi',
  state: 'In the room',
  startTimestamp: Date.now(),
};

const writeDiscordFrame = (opcode, payload) => {
  if (!discordSocket || discordSocket.destroyed) {
    return false;
  }
  return discordSocket.write(encodeFrame(opcode, payload));
};

const applyPresence = () => {
  if (!rpcReady) {
    return;
  }
  writeDiscordFrame(FRAME, {
    cmd: 'SET_ACTIVITY',
    nonce: randomUUID(),
    args: {
      pid: process.pid,
      activity: {
        details: latestPresence.details,
        state: latestPresence.state,
        timestamps: { start: latestPresence.startTimestamp },
        assets: {
          large_image: 'oyachi',
          large_text: 'Your Little Oyachi',
        },
      },
    },
  });
  log('Rich Presence updated.');
};

const scheduleDiscordReconnect = () => {
  if (rpcReady || reconnectTimer) {
    return;
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectDiscord();
  }, 5000);
};

const disconnectFromDiscord = (reason) => {
  clearTimeout(handshakeTimer);
  handshakeTimer = null;
  connectingToDiscord = false;
  rpcReady = false;
  if (discordSocket && !discordSocket.destroyed) {
    discordSocket.destroy();
  }
  discordSocket = null;
  receiveBuffer = Buffer.alloc(0);
  log(`Discord disconnected: ${reason}`);
  scheduleDiscordReconnect();
};

const processDiscordFrames = () => {
  while (receiveBuffer.length >= 8) {
    const opcode = receiveBuffer.readUInt32LE(0);
    const length = receiveBuffer.readUInt32LE(4);
    if (receiveBuffer.length < length + 8) {
      return;
    }
    const body = receiveBuffer.subarray(8, length + 8);
    receiveBuffer = receiveBuffer.subarray(length + 8);
    let message;
    try {
      message = JSON.parse(body.toString('utf8'));
    } catch {
      continue;
    }
    if (opcode === FRAME && message.evt === 'READY') {
      clearTimeout(handshakeTimer);
      handshakeTimer = null;
      connectingToDiscord = false;
      rpcReady = true;
      log('Connected to Discord.');
      applyPresence();
    } else if (opcode === CLOSE) {
      disconnectFromDiscord(message?.data?.message || 'Discord closed the RPC connection.');
    }
  }
};

const connectDiscord = () => {
  if (rpcReady || connectingToDiscord) {
    return;
  }
  connectingToDiscord = true;
  connectToDiscordPipe()
    .then((socket) => {
      discordSocket = socket;
      socket.on('data', (chunk) => {
        receiveBuffer = Buffer.concat([receiveBuffer, chunk]);
        processDiscordFrames();
      });
      socket.on('error', (error) => disconnectFromDiscord(error.message));
      socket.on('close', () => {
        if (discordSocket === socket) {
          disconnectFromDiscord('Discord RPC connection closed.');
        }
      });
      writeDiscordFrame(HANDSHAKE, { v: 1, client_id: CLIENT_ID });
      handshakeTimer = setTimeout(() => {
        if (!rpcReady) {
          disconnectFromDiscord('Discord RPC handshake timed out.');
        }
      }, 5000);
    })
    .catch((error) => {
      connectingToDiscord = false;
      log(`Discord connection failed: ${error.message}`);
      scheduleDiscordReconnect();
    });
};

const socket = new WebSocket(extensionUrl);
socket.onopen = () => {
  log('Connected to Neutralino.');
};
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  const dispatch = message.event === 'eventToExtension' ? message.data : message;
  if (dispatch?.event !== 'setPresence') {
    return;
  }
  latestPresence = { ...latestPresence, ...dispatch.data };
  log('Received a presence update from the game.');
  applyPresence();
};
socket.onclose = () => {
  log('Neutralino connection closed.');
  clearTimeout(reconnectTimer);
  clearTimeout(handshakeTimer);
  discordSocket?.destroy();
  process.exit(0);
};
socket.onerror = () => {
  log('Neutralino connection failed.');
};

connectDiscord();
