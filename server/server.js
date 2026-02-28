const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const findDevices = require('local-devices');
require('dotenv').config();

let Cap, decoders, PROTOCOL;
try {
  const cap = require('cap');
  Cap = cap.Cap;
  decoders = cap.decoders;
  PROTOCOL = cap.PROTOCOL;
} catch (e) {
  console.log('Cap module not found, using simulation mode only.');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3001;

// Initial State
let activeDevices = [
  { ip: '192.168.0.1', name: 'wifi-gateway', label: process.env.ROUTER_SSID || 'AX1800 Router', type: 'router', status: 'Online', ssid: process.env.ROUTER_SSID || 'TIME2E30' },
  { ip: '127.0.0.1', name: 'wifi-device-0', label: 'This PC', type: 'pc', status: 'Active', connectionType: 'wired' }
];

// Persist friendly labels so they don't shuffle on re-scan
const deviceLabelMap = {};

const deviceNamesByType = {
  mobile: ['My Phone', 'Android Phone', 'iPhone', 'Galaxy Phone', 'Pixel Phone', 'Xiaomi Phone'],
  pc: ['My Laptop', 'Windows PC', 'MacBook', 'Desktop PC', 'Surface Laptop', 'Chromebook'],
  tv: ['Smart TV', 'Streaming Box', 'Fire TV', 'Apple TV', 'Chromecast'],
  iot: ['Smart Device', 'IoT Sensor', 'Smart Plug', 'Security Camera'],
};

function getDeviceLabel(mac, type) {
  if (deviceLabelMap[mac]) return deviceLabelMap[mac];
  const options = deviceNamesByType[type] || deviceNamesByType['iot'];
  // Use MAC to deterministically pick a name (same device = same label)
  const idx = mac ? mac.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % options.length : Math.floor(Math.random() * options.length);
  const label = options[idx];
  deviceLabelMap[mac] = label;
  return label;
}

async function discoverDevices() {
  console.log('--- STARTING NETWORK SCAN ---');
  try {
    const devices = await findDevices();
    console.log(`Physically found ${devices.length} devices.`);

    // Keep the base devices
    const newDeviceList = [
      { ip: '192.168.0.1', name: 'wifi-gateway', type: 'router', status: 'Online', ssid: 'TIME2E30' },
      { ip: '127.0.0.1', name: 'wifi-device-0', type: 'pc', status: 'Active' }
    ];

    let deviceCounter = 1;
    devices.forEach(d => {
      // Don't duplicate base devices
      if (d.ip === '192.168.0.1' || d.ip === '127.0.0.1') return;

      const vendor = guessVendor(d.mac);
      const shortId = d.ip.split('.').pop();
      const displayName = vendor !== 'Generic' ? `${vendor}-${shortId}` : `wireless-${shortId}`;
      const deviceType = guessDeviceType(d.name, d.mac);
      const friendlyLabel = getDeviceLabel(d.mac, deviceType);

      newDeviceList.push({
        ip: d.ip,
        mac: d.mac,
        name: displayName,
        label: friendlyLabel,
        vendor: vendor,
        type: deviceType,
        status: 'Active',
        connectionType: Math.random() > 0.3 ? 'wireless' : 'wired',
        signal: Math.random() > 0.5 ? `-${Math.floor(Math.random() * 20 + 40)} dBm` : `-${Math.floor(Math.random() * 20 + 60)} dBm`,
        uptime: `${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`
      });
    });

    activeDevices = newDeviceList;
    console.log(`EMITTING deviceUpdate: ${activeDevices.length} nodes total.`);
    io.emit('deviceUpdate', activeDevices);
  } catch (err) {
    console.error('Scan Error:', err);
  }
}

function guessVendor(mac) {
  if (!mac) return 'Unknown';
  const prefix = mac.toLowerCase().slice(0, 8);
  if (prefix.startsWith('bc:d1:d3')) return 'Samsung';
  if (prefix.startsWith('00:0c:29')) return 'VMware';
  if (prefix.startsWith('a4:77:33')) return 'Google';
  if (prefix.startsWith('f0:18:98')) return 'Apple';
  return 'Generic';
}

function guessDeviceType(name, mac) {
  const n = (name || '').toLowerCase();
  if (n.includes('iphone') || n.includes('phone') || n.includes('android') || n.includes('mobile') || n.includes('pixel') || n.includes('galaxy')) return 'mobile';
  if (n.includes('tv') || n.includes('roku') || n.includes('fire') || n.includes('appletv')) return 'tv';
  if (n.includes('pc') || n.includes('laptop') || n.includes('macbook') || n.includes('desktop') || n.includes('windows') || n.includes('surface')) return 'pc';
  // Default: randomly assign mobile or pc (most common home devices)
  return Math.random() > 0.5 ? 'mobile' : 'pc';
}

// Routes
app.get('/api/devices', (req, res) => res.json(activeDevices));
app.post('/api/scan', async (req, res) => {
  await discoverDevices();
  res.json({ success: true, count: activeDevices.length });
});

// Periodic Scan
discoverDevices();
setInterval(discoverDevices, 60000); // Every minute

// Admin Actions
const blockedDevices = new Set();

io.on('connection', (socket) => {
  socket.on('blockDevice', (ip) => {
    blockedDevices.add(ip);
    console.log(`[ADMIN] Blocked device: ${ip}`);
    io.emit('deviceBlocked', ip);
  });

  socket.on('unblockDevice', (ip) => {
    blockedDevices.delete(ip);
    console.log(`[ADMIN] Unblocked device: ${ip}`);
    io.emit('deviceUnblocked', ip);
  });
});

// Simulation Logic
function startSimulation() {
  setInterval(() => {
    if (activeDevices.length <= 2) return;

    // Pick a random device that is NOT the router and IS NOT blocked
    const nonRouterDevices = activeDevices.filter(d =>
      d.type !== 'router' && !blockedDevices.has(d.ip)
    );

    if (nonRouterDevices.length === 0) return;

    const sourceDevice = nonRouterDevices[Math.floor(Math.random() * nonRouterDevices.length)];

    const apps = [
      { port: 443, name: 'Web/HTTPS' },
      { port: 80, name: 'Web/HTTP' },
      { port: 53, name: 'DNS Query' },
      { port: 3478, name: 'STUN/VoIP' }
    ];
    const app = apps[Math.floor(Math.random() * apps.length)];

    const countries = [
      { name: 'USA', flag: '🇺🇸', range: '142.250' },
      { name: 'Germany', flag: '🇩🇪', range: '52.28' },
      { name: 'Japan', flag: '🇯🇵', range: '106.12' },
      { name: 'Singapore', flag: '🇸🇬', range: '18.139' },
      { name: 'Australia', flag: '🇦🇺', range: '1.1' }
    ];
    const country = countries[Math.floor(Math.random() * countries.length)];

    io.emit('packet', {
      src: sourceDevice.ip,
      dest: `${country.range}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      len: Math.floor(Math.random() * 1500),
      protocol: 'TCP',
      destPort: app.port,
      appName: app.name,
      country: country.name,
      flag: country.flag,
      timestamp: Date.now()
    });
  }, 200);
}

startSimulation();

server.listen(PORT, () => {
  console.log(`Backend Active: http://localhost:${PORT}`);
});
