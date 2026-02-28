const findDevices = require('local-devices');

console.log('Test Scan Started...');
findDevices().then(devices => {
    console.log('Devices found:', devices.length);
    console.log(JSON.stringify(devices, null, 2));
}).catch(err => {
    console.error('Scan failed:', err);
});
