const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

async function getAvailablePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(port) {
  const url = `http://127.0.0.1:${port}/api/spot/products`;
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(url);
      return res;
    } catch (err) {
      // ignore until server is ready
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`Servidor não respondeu em ${url}`);
}

test('serve.js expõe o contrato de /api/spot/products', async () => {
  const port = await getAvailablePort();
  const child = spawn(process.execPath, ['serve.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      ACCESS_KEY: '',
      PORT: String(port),
      ORDER_ADMIN_KEY: 'test-order-admin-key'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', chunk => {
    output += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    output += chunk.toString();
  });

  try {
    const res = await waitForServer(port);
    const data = await res.json();
    assert.ok([200, 503].includes(res.status));

    if (res.status === 200) {
      assert.ok(Array.isArray(data?.Products));
    } else {
      assert.equal(data?.error, 'Spot credentials not configured');
    }

    const orderResponse = await fetch(`http://127.0.0.1:${port}/api/spot/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    assert.equal(orderResponse.status, 401);
  } finally {
    child.kill('SIGTERM');
  }
});
