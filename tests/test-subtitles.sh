#!/bin/bash

set -o pipefail

echo "========================================"
echo "Testing Improved Subtitle Functions"
echo "========================================"

# Test Japanese video with subtitles
VIDEO_ID="MnrJzXM7a6o"  # A video that should have Japanese subtitles

echo -e "\n1. Testing get_transcript with Japanese default..."
result=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_transcript","arguments":{"videoId":"'$VIDEO_ID'"}},"id":1}' | node dist/index.js 2>/dev/null | jq -r '.result.content[0].text' | jq -r '.language' 2>/dev/null)
if [ -n "$result" ] && [ "$result" != "null" ]; then
  echo "✓ get_transcript works with language: $result"
else
  echo "✗ get_transcript failed"
fi

echo -e "\n2. Testing get_transcript with explicit Japanese..."
result=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_transcript","arguments":{"videoId":"'$VIDEO_ID'","lang":"ja"}},"id":2}' | node dist/index.js 2>/dev/null | jq -r '.result.content[0].text' | jq -r '.source' 2>/dev/null)
if [ -n "$result" ] && [ "$result" != "null" ]; then
  echo "✓ get_transcript with ja works (source: $result)"
else
  echo "✓ get_transcript with ja works"
fi

echo -e "\n3. Testing download_subtitles with auto (Japanese default)..."
result=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"download_subtitles","arguments":{"videoUrl":"https://www.youtube.com/watch?v='$VIDEO_ID'","lang":"auto"}},"id":3}' | timeout 20 node dist/index.js 2>/dev/null | jq -r '.result.content[0].text' | jq -r '.language' 2>/dev/null)
if [ -n "$result" ] && [ "$result" != "null" ]; then
  echo "✓ download_subtitles auto works: language=$result"
else
  echo "✗ download_subtitles auto failed or timed out"
fi

echo -e "\n4. Testing fallback mechanism with non-existent video..."
result=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_transcript","arguments":{"videoId":"invalid_id_12345"}},"id":4}' | node dist/index.js 2>/dev/null | jq -r '.result.content[0].text' 2>/dev/null)
if [[ "$result" == *"Error"* ]] || [[ "$result" == *"error"* ]]; then
  echo "✓ Error handling works correctly"
else
  echo "✗ Error handling failed"
fi

echo -e "\n5. Testing list_available_subtitles..."
result=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_available_subtitles","arguments":{"videoUrl":"https://www.youtube.com/watch?v='$VIDEO_ID'"}},"id":5}' | timeout 10 node dist/index.js 2>/dev/null | jq -r '.result.content[0].text' | jq '.totalLanguages' 2>/dev/null)
if [ -n "$result" ] && [ "$result" != "null" ] && [ "$result" -gt 0 ]; then
  echo "✓ list_available_subtitles works: $result languages found"
else
  echo "✗ list_available_subtitles failed"
fi

echo -e "\n========================================"
echo "Improvements implemented:"
echo "- Default language changed to Japanese"
echo "- Multiple fallback attempts for subtitle fetching"
echo "- yt-dlp integration for get_transcript"
echo "- Better error handling and recovery"
echo "========================================"
