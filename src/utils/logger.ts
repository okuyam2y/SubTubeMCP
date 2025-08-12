import { appendFileSync } from 'fs';
import path from 'path';

const LOG_FILE = process.env.MCP_LOG_FILE ? path.resolve(process.env.MCP_LOG_FILE) : null;

export function log(level: string, message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  const fullMessage = args.length > 0 ? `${logMessage} ${JSON.stringify(args)}` : logMessage;
  
  // Output to stderr
  console.error(fullMessage);
  
  // Write to file if configured
  if (LOG_FILE) {
    try {
      appendFileSync(LOG_FILE, fullMessage + '\n');
    } catch (error) {
      // Ignore file write errors
    }
  }
}