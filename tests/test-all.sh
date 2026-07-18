#!/bin/bash

set -o pipefail

# Test script for YouTube MCP Server
echo "========================================"
echo "Testing YouTube MCP Server Functionality"
echo "========================================"

# Set environment variables
export YOUTUBE_API_KEY="${YOUTUBE_API_KEY}"
export MCP_LOG_FILE="/tmp/mcp-test.log"

# Test 1: Search videos
echo -e "\n1. Testing search_videos..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_videos","arguments":{"query":"TypeScript tutorial","maxResults":2}},"id":1}' | node dist/index.js 2>/dev/null | jq -r '.content[0].text' | jq '.resultCount' 2>/dev/null && echo "✓ search_videos works" || echo "✗ search_videos failed"

# Test 2: Get video metadata
echo -e "\n2. Testing get_video_metadata..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_video_metadata","arguments":{"videoId":"dQw4w9WgXcQ"}},"id":2}' | node dist/index.js 2>/dev/null | jq -r '.content[0].text' | jq '.title' 2>/dev/null && echo "✓ get_video_metadata works" || echo "✗ get_video_metadata failed"

# Test 3: Get transcript
echo -e "\n3. Testing get_transcript..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_transcript","arguments":{"videoId":"dQw4w9WgXcQ","lang":"en"}},"id":3}' | node dist/index.js 2>/dev/null | jq -r '.content[0].text' | jq '.language' 2>/dev/null && echo "✓ get_transcript works" || echo "✗ get_transcript failed"

# Test 4: List available subtitles
echo -e "\n4. Testing list_available_subtitles..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_available_subtitles","arguments":{"videoUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}},"id":4}' | node dist/index.js 2>/dev/null | jq -r '.content[0].text' | jq '.totalLanguages' 2>/dev/null && echo "✓ list_available_subtitles works" || echo "✗ list_available_subtitles failed"

# Test 5: Get channel stats
echo -e "\n5. Testing get_channel_stats..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_channel_stats","arguments":{"channelId":"UCuAXFkgsw1L7xaCfnd5JJOw"}},"id":5}' | node dist/index.js 2>/dev/null | jq -r '.content[0].text' | jq '.title' 2>/dev/null && echo "✓ get_channel_stats works" || echo "✗ get_channel_stats failed"

# Test 6: Get channel videos
echo -e "\n6. Testing get_channel_videos..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_channel_videos","arguments":{"channelId":"UCuAXFkgsw1L7xaCfnd5JJOw","maxResults":2}},"id":6}' | node dist/index.js 2>/dev/null | jq -r '.content[0].text' | jq '.fetchedCount' 2>/dev/null && echo "✓ get_channel_videos works" || echo "✗ get_channel_videos failed"

# Test 7: Get trending videos
echo -e "\n7. Testing get_trending_videos..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_trending_videos","arguments":{"regionCode":"US","maxResults":2}},"id":7}' | node dist/index.js 2>/dev/null | jq -r '.content[0].text' | jq '.resultCount' 2>/dev/null && echo "✓ get_trending_videos works" || echo "✗ get_trending_videos failed"

# Test 8: Get comments
echo -e "\n8. Testing get_comments..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_comments","arguments":{"videoId":"dQw4w9WgXcQ","maxResults":2}},"id":8}' | node dist/index.js 2>/dev/null | jq -r '.content[0].text' | jq '.fetchedCount' 2>/dev/null && echo "✓ get_comments works" || echo "✗ get_comments failed"

# Test 9: Download subtitles (Japanese)
echo -e "\n9. Testing download_subtitles (Japanese)..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"download_subtitles","arguments":{"videoUrl":"https://www.youtube.com/watch?v=MBJgTBD6Lzk","lang":"ja"}},"id":9}' | node dist/index.js 2>/dev/null | jq -r '.content[0].text' | jq '.language' 2>/dev/null && echo "✓ download_subtitles (Japanese) works" || echo "✗ download_subtitles (Japanese) failed"

echo -e "\n========================================"
echo "Testing Complete"
echo "========================================"
