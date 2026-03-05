#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(name, cwd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(args[0], args.slice(1), {
      cwd,
      stdio: 'inherit',
      shell: true,
    });

    proc.on('error', (err) => {
      log(colors.red, `[${name}] Failed to start: ${err.message}`);
      reject(err);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        log(colors.red, `[${name}] Process exited with code ${code}`);
        reject(new Error(`${name} exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  log(colors.cyan, 'Starting Kyush LLM Router development environment...');
  log(colors.cyan, '===============================================');

  const serverDir = path.join(__dirname, '..', 'server');
  const clientDir = path.join(__dirname, '..', 'client');

  const serverProcess = spawn('npm', ['run', 'dev'], {
    cwd: serverDir,
    stdio: 'inherit',
    shell: true,
  });

  const clientProcess = spawn('npm', ['run', 'dev'], {
    cwd: clientDir,
    stdio: 'inherit',
    shell: true,
  });

  log(colors.green, '===============================================');
  log(colors.green, 'Development servers started:');
  log(colors.green, `  - Express API Server: http://localhost:3000`);
  log(colors.green, `  - Vite Admin Dashboard: http://localhost:3001`);
  log(colors.green, '===============================================');
  log(colors.yellow, 'Press Ctrl+C to stop all servers');

  process.on('SIGINT', () => {
    log(colors.yellow, '\nShutting down...');
    serverProcess.kill('SIGINT');
    clientProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log(colors.yellow, '\nShutting down...');
    serverProcess.kill('SIGTERM');
    clientProcess.kill('SIGTERM');
    process.exit(0);
  });

  await Promise.all([
    new Promise((_, reject) => serverProcess.on('error', reject)),
    new Promise((_, reject) => clientProcess.on('error', reject)),
  ]);
}

main().catch((err) => {
  log(colors.red, `Fatal error: ${err.message}`);
  process.exit(1);
});
