#!/usr/bin/env node

import assert from 'node:assert/strict';
import { VideoHandler } from '../dist/handlers/video.js';

const videoId = 'dQw4w9WgXcQ';
const response = await new VideoHandler(null).getVideoMetadata({ videoId });
const metadata = JSON.parse(response.content[0].text);

assert.equal(metadata.videoId, videoId);
assert.equal(typeof metadata.title, 'string');
assert.ok(metadata.title.length > 0);

console.log(`PASS video metadata: ${metadata.title}`);
