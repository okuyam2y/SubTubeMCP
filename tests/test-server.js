#!/usr/bin/env node

/**
 * YouTube MCP Server Test Script
 * 
 * This script tests various functions of the YouTube MCP server
 * without requiring YouTube API key for basic tests
 */

import { spawn } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class MCPTestClient {
  constructor() {
    this.server = null;
    this.requestId = 0;
  }

  async start() {
    console.log('Starting YouTube MCP Server...\n');
    
    this.server = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    this.server.stderr.on('data', (data) => {
      const message = data.toString();
      if (!message.includes('YouTube MCP server running')) {
        console.log('Server log:', message.trim());
      }
    });

    this.server.stdout.on('data', (data) => {
      try {
        const lines = data.toString().split('\n').filter(line => line.trim());
        for (const line of lines) {
          const response = JSON.parse(line);
          console.log('Response:', JSON.stringify(response, null, 2));
        }
      } catch (e) {
        // Ignore parse errors for partial data
      }
    });

    await this.delay(1000);
    console.log('Server started successfully!\n');
  }

  async sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params
    };

    console.log('\n📤 Sending request:', method);
    console.log('Parameters:', JSON.stringify(params, null, 2));
    
    this.server.stdin.write(JSON.stringify(request) + '\n');
    await this.delay(500);
  }

  async testListTools() {
    console.log('\n========================================');
    console.log('TEST: List Available Tools');
    console.log('========================================');
    await this.sendRequest('tools/list');
  }

  async testVideoMetadata() {
    console.log('\n========================================');
    console.log('TEST: Get Video Metadata (ytdl-core)');
    console.log('========================================');
    await this.sendRequest('tools/call', {
      name: 'get_video_metadata',
      arguments: {
        videoId: 'dQw4w9WgXcQ' // Rick Astley - Never Gonna Give You Up
      }
    });
  }

  async testListSubtitles() {
    console.log('\n========================================');
    console.log('TEST: List Available Subtitles (yt-dlp)');
    console.log('========================================');
    await this.sendRequest('tools/call', {
      name: 'list_available_subtitles',
      arguments: {
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      }
    });
  }

  async testTranscript() {
    console.log('\n========================================');
    console.log('TEST: Get Transcript');
    console.log('========================================');
    await this.sendRequest('tools/call', {
      name: 'get_transcript',
      arguments: {
        videoId: 'dQw4w9WgXcQ',
        lang: 'en'
      }
    });
  }

  async testAPIFeatures() {
    if (!process.env.YOUTUBE_API_KEY) {
      console.log('\n⚠️  Skipping API tests - YOUTUBE_API_KEY not set');
      return;
    }

    console.log('\n========================================');
    console.log('TEST: Search Videos (requires API key)');
    console.log('========================================');
    await this.sendRequest('tools/call', {
      name: 'search_videos',
      arguments: {
        query: 'typescript tutorial',
        maxResults: 3
      }
    });

    console.log('\n========================================');
    console.log('TEST: Get Trending Videos (requires API key)');
    console.log('========================================');
    await this.sendRequest('tools/call', {
      name: 'get_trending_videos',
      arguments: {
        regionCode: 'US',
        maxResults: 3
      }
    });
  }

  async testErrorHandling() {
    console.log('\n========================================');
    console.log('TEST: Error Handling');
    console.log('========================================');
    
    console.log('\n1. Testing with empty video ID:');
    await this.sendRequest('tools/call', {
      name: 'get_video_metadata',
      arguments: {
        videoId: ''
      }
    });

    console.log('\n2. Testing with invalid video ID:');
    await this.sendRequest('tools/call', {
      name: 'get_video_metadata',
      arguments: {
        videoId: 'invalid_video_id_12345'
      }
    });

    console.log('\n3. Testing with invalid URL:');
    await this.sendRequest('tools/call', {
      name: 'list_available_subtitles',
      arguments: {
        videoUrl: 'not_a_valid_url'
      }
    });
  }

  async runAllTests() {
    await this.start();
    
    await this.testListTools();
    await this.delay(1000);
    
    await this.testVideoMetadata();
    await this.delay(2000);
    
    await this.testListSubtitles();
    await this.delay(2000);
    
    await this.testTranscript();
    await this.delay(2000);
    
    await this.testErrorHandling();
    await this.delay(2000);
    
    await this.testAPIFeatures();
    
    console.log('\n========================================');
    console.log('All tests completed!');
    console.log('========================================\n');
    
    this.stop();
  }

  async interactiveMode() {
    await this.start();
    
    console.log('\nInteractive Mode - Available commands:');
    console.log('  list - List all available tools');
    console.log('  meta <videoId> - Get video metadata');
    console.log('  subs <videoUrl> - List available subtitles');
    console.log('  transcript <videoId> [lang] - Get transcript');
    console.log('  search <query> - Search videos (requires API key)');
    console.log('  exit - Exit the test client\n');

    const askCommand = () => {
      rl.question('> ', async (input) => {
        const [command, ...args] = input.trim().split(' ');
        
        switch (command) {
          case 'list':
            await this.testListTools();
            break;
          
          case 'meta':
            if (args[0]) {
              await this.sendRequest('tools/call', {
                name: 'get_video_metadata',
                arguments: { videoId: args[0] }
              });
            } else {
              console.log('Usage: meta <videoId>');
            }
            break;
          
          case 'subs':
            if (args[0]) {
              await this.sendRequest('tools/call', {
                name: 'list_available_subtitles',
                arguments: { videoUrl: args[0] }
              });
            } else {
              console.log('Usage: subs <videoUrl>');
            }
            break;
          
          case 'transcript':
            if (args[0]) {
              await this.sendRequest('tools/call', {
                name: 'get_transcript',
                arguments: {
                  videoId: args[0],
                  lang: args[1] || 'en'
                }
              });
            } else {
              console.log('Usage: transcript <videoId> [lang]');
            }
            break;
          
          case 'search':
            if (args.length > 0) {
              await this.sendRequest('tools/call', {
                name: 'search_videos',
                arguments: {
                  query: args.join(' '),
                  maxResults: 5
                }
              });
            } else {
              console.log('Usage: search <query>');
            }
            break;
          
          case 'exit':
            this.stop();
            rl.close();
            return;
          
          default:
            console.log('Unknown command. Type "exit" to quit.');
        }
        
        setTimeout(askCommand, 500);
      });
    };
    
    askCommand();
  }

  stop() {
    if (this.server) {
      console.log('Stopping server...');
      this.server.kill();
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
const client = new MCPTestClient();

const args = process.argv.slice(2);
if (args.includes('--interactive') || args.includes('-i')) {
  client.interactiveMode().catch(console.error);
} else {
  client.runAllTests().catch(console.error);
}

// Handle exit
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down...');
  client.stop();
  process.exit(0);
});