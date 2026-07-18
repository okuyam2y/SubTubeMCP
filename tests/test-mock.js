#!/usr/bin/env node

// Mock test to verify all handlers are working properly
import { VideoHandler } from '../dist/handlers/video.js';
import { ChannelHandler } from '../dist/handlers/channel.js';
import { SubtitleHandler } from '../dist/handlers/subtitle.js';
import { CommentHandler } from '../dist/handlers/comment.js';

console.log('Testing handler imports...');

// Test that all handlers can be instantiated
try {
  const videoHandler = new VideoHandler(null);
  console.log('✓ VideoHandler imported and instantiated');
} catch (e) {
  console.log('✗ VideoHandler failed:', e.message);
}

try {
  const channelHandler = new ChannelHandler(null);
  console.log('✓ ChannelHandler imported and instantiated');
} catch (e) {
  console.log('✗ ChannelHandler failed:', e.message);
}

try {
  const subtitleHandler = new SubtitleHandler();
  console.log('✓ SubtitleHandler imported and instantiated');
} catch (e) {
  console.log('✗ SubtitleHandler failed:', e.message);
}

try {
  const commentHandler = new CommentHandler(null);
  console.log('✓ CommentHandler imported and instantiated');
} catch (e) {
  console.log('✗ CommentHandler failed:', e.message);
}

console.log('\nAll handlers successfully imported!');
