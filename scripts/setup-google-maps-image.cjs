#!/usr/bin/env node
/**
 * Install Python dependencies for Google Maps image generation.
 * Requires Python and pip to be installed.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const serverDir = path.join(__dirname, '..', 'server');
const reqPath = path.join(serverDir, 'google-maps-image', 'requirements.txt');
if (!fs.existsSync(reqPath)) {
  console.error('requirements.txt not found at', reqPath);
  process.exit(1);
}

const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
// Use -m pip so we install to the exact Python that runs the script
const args = ['-m', 'pip', 'install', '-r', 'google-maps-image/requirements.txt'];
const proc = spawn(pythonCmd, args, { stdio: 'inherit', cwd: serverDir });

proc.on('close', (code) => {
  if (code === 0) {
    console.log('\nGoogle Maps image dependencies installed. Ensure Chrome is installed for screenshots.');
  } else {
    console.error(`\npip install failed (code ${code}). Try manually: pip install -r server/google-maps-image/requirements.txt`);
    process.exit(code);
  }
});

proc.on('error', (err) => {
  console.error('Failed to run pip:', err.message);
  console.error('Install manually: pip install selenium Pillow psutil');
  process.exit(1);
});
