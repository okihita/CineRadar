#!/usr/bin/env node
import { execSync } from 'node:child_process';
import readline from 'node:readline';

const args = process.argv.slice(2);
const forceFlag = args.includes('--force') || args.includes('-f');
const requestedPorts = args.filter((a) => !a.startsWith('-')).map(Number).filter(Boolean);
const portsToCheck = requestedPorts.length > 0 ? requestedPorts : [3000, 3001];

function getProcessUsingPort(port) {
  try {
    const stdout = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    const lines = stdout.split('\n');
    if (lines.length <= 1) return null;

    // Header: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
    const parts = lines[1].trim().split(/\s+/);
    const command = parts[0] || 'unknown';
    const pid = parts[1];

    if (!pid || isNaN(Number(pid))) return null;
    return { pid: Number(pid), command };
  } catch {
    return null;
  }
}

function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function killProcess(pid) {
  try {
    process.kill(pid, 'SIGTERM');
    // Wait briefly and verify if process exited
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
    // If still running, force kill
    try {
      process.kill(pid, 0);
      process.kill(pid, 'SIGKILL');
    } catch {
      // Process already terminated
    }
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  for (const port of portsToCheck) {
    const proc = getProcessUsingPort(port);
    if (!proc) continue;

    console.log(`\n[!] Port ${port} is currently in use by process '${proc.command}' (PID ${proc.pid}).`);

    if (forceFlag) {
      console.log(`    [--force] Stopping PID ${proc.pid}...`);
      const killed = killProcess(proc.pid);
      if (killed) {
        console.log(`    Port ${port} freed.`);
      } else {
        console.error(`[ERROR] Failed to terminate PID ${proc.pid}.`);
        process.exit(1);
      }
      continue;
    }

    if (!isInteractive) {
      console.error(`[ERROR] Non-interactive environment detected. Cannot prompt to free port ${port}.`);
      console.error(`Please stop PID ${proc.pid} or free port ${port} before starting (or pass --force).`);
      process.exit(1);
    }

    const answer = await askConfirmation(`    Kill process ${proc.pid} (${proc.command}) and continue? [y/N]: `);

    if (answer === 'y' || answer === 'yes') {
      console.log(`    Stopping PID ${proc.pid}...`);
      const killed = killProcess(proc.pid);
      if (killed) {
        console.log(`    Port ${port} freed.`);
      } else {
        console.error(`[ERROR] Failed to terminate PID ${proc.pid}. Please terminate it manually.`);
        process.exit(1);
      }
    } else {
      console.log(`\n[ABORTED] Port ${port} remains occupied. Exiting.\n`);
      process.exit(0);
    }
  }
}

main().catch((err) => {
  console.error('[ERROR] Port check failed:', err);
  process.exit(1);
});
