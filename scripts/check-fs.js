const fs = require('fs');
const path = require('path');

const legacyPath = path.join(__dirname, '..', 'node_modules', 'expo-file-system', 'legacy.js');
const legacyDir = path.join(__dirname, '..', 'node_modules', 'expo-file-system', 'legacy');

console.log('Checking for legacy expo-file-system...');
if (fs.existsSync(legacyPath) || fs.existsSync(legacyDir) || fs.existsSync(legacyPath.replace('.js', '.d.ts'))) {
  console.log('Legacy entry point exists.');
} else {
  console.log('Legacy entry point NOT found.');
  // List files in expo-file-system to see what's there
  const modDir = path.join(__dirname, '..', 'node_modules', 'expo-file-system');
  if (fs.existsSync(modDir)) {
    console.log('Files in expo-file-system:', fs.readdirSync(modDir));
  }
}
