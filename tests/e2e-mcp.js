#!/usr/bin/env node

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const REQUEST_TIMEOUT_MS = 10_000;
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const expectedToolNames = [
  'download_subtitles',
  'get_channel_stats',
  'get_channel_videos',
  'get_comments',
  'get_transcript',
  'get_trending_videos',
  'get_video_metadata',
  'list_available_subtitles',
  'search_videos'
];
const requestOptions = {
  timeout: REQUEST_TIMEOUT_MS,
  maxTotalTimeout: REQUEST_TIMEOUT_MS
};

const client = new Client({
  name: 'youtube-mcp-e2e-client',
  version: '1.0.0'
});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['dist/index.js'],
  cwd: projectRoot,
  stderr: 'pipe'
});

let connected = false;
let serverStderr = '';
const protocolErrors = [];

transport.stderr?.on('data', chunk => {
  serverStderr += chunk.toString();
});
client.onerror = error => {
  protocolErrors.push(error);
};

try {
  await client.connect(transport, requestOptions);
  connected = true;

  assert.equal(client.getServerVersion()?.name, 'youtube-mcp-server');
  assert.ok(client.getServerCapabilities()?.tools, 'server must advertise the tools capability');

  const { tools } = await client.listTools({}, requestOptions);
  const actualToolNames = tools.map(tool => tool.name).sort();

  assert.equal(new Set(actualToolNames).size, actualToolNames.length, 'tool names must be unique');
  assert.deepEqual(actualToolNames, expectedToolNames);
  for (const tool of tools) {
    assert.equal(tool.inputSchema?.type, 'object', `${tool.name} must declare an object input schema`);
  }

  const callResult = await client.callTool(
    {
      name: 'get_video_metadata',
      arguments: { videoId: '' }
    },
    undefined,
    requestOptions
  );

  assert.equal(callResult.isError, undefined, 'current server returns validation failures as normal tool results');
  assert.equal(callResult.content?.[0]?.type, 'text');
  assert.equal(callResult.content?.[0]?.text, 'Error: Video ID cannot be empty');
  assert.equal(protocolErrors.length, 0, `protocol errors: ${protocolErrors.map(String).join('; ')}`);

  console.log(`PASS MCP E2E: initialize, tools/list (${tools.length} tools), tools/call`);
} catch (error) {
  console.error('FAIL MCP E2E:', error);
  if (serverStderr.trim()) {
    console.error('Server stderr:');
    console.error(serverStderr.trim());
  }
  process.exitCode = 1;
} finally {
  try {
    if (connected) {
      await client.close();
    } else {
      await transport.close();
    }
  } catch (error) {
    console.error('FAIL MCP E2E cleanup:', error);
    process.exitCode = 1;
  }
}
