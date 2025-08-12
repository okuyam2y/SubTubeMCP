import { exec, spawn } from 'child_process';
import { promisify } from 'util';

export const execAsync = promisify(exec);

/**
 * Secure command execution using spawn to prevent shell injection
 * @param command The command to execute
 * @param args Array of arguments (will be passed safely)
 * @param options Spawn options
 * @returns Promise with stdout and stderr
 */
export function spawnAsync(
  command: string, 
  args: string[], 
  options?: { cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const spawnOptions: any = {
      cwd: options?.cwd,
      env: options?.env || process.env,
      shell: false // Explicitly disable shell to prevent injection
    };

    const child = spawn(command, args, spawnOptions);
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Set timeout if specified
    const timer = options?.timeout ? setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${options.timeout}ms`));
    }, options.timeout) : null;

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      if (!timedOut) reject(error);
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (!timedOut) {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const error = new Error(`Command failed with exit code ${code}: ${stderr}`);
          (error as any).code = code;
          (error as any).stdout = stdout;
          (error as any).stderr = stderr;
          reject(error);
        }
      }
    });
  });
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function parseDuration(iso8601: string): number {
  // Parse ISO 8601 duration format (e.g., PT4M13S, PT1H2M3S)
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

export async function checkYtDlp(): Promise<boolean> {
  try {
    // Cross-platform check for yt-dlp using spawn for safety
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'where' : 'which';
    await spawnAsync(command, ['yt-dlp']);
    return true;
  } catch {
    return false;
  }
}

export function createJsonResponse(data: any) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }]
  };
}

export function createErrorResponse(error: string, details?: any) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ error, ...details }, null, 2)
    }]
  };
}