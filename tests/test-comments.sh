#!/bin/bash

set -o pipefail

echo "========================================"
echo "Testing Comment Fetching Improvements"
echo "========================================"

# Use a canonical public sample with many comments.
VIDEO_ID="dQw4w9WgXcQ"

# Require the API key from the environment; never read a local key file.
if [ -z "${YOUTUBE_API_KEY:-}" ]; then
  echo "❌ YOUTUBE_API_KEY is not set. Skipping tests."
  exit 1
fi

echo -e "\n1. Testing default comment fetch (20 comments)..."
result=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_comments","arguments":{"videoId":"'$VIDEO_ID'"}},"id":1}' | YOUTUBE_API_KEY="$YOUTUBE_API_KEY" node dist/index.js 2>/dev/null | jq -r '.result.content[0].text' | jq '{fetchedCount, hasMore}' 2>/dev/null)
echo "$result"

echo -e "\n2. Testing with maxResults=50..."
result=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_comments","arguments":{"videoId":"'$VIDEO_ID'","maxResults":50}},"id":2}' | YOUTUBE_API_KEY="$YOUTUBE_API_KEY" node dist/index.js 2>/dev/null | jq -r '.result.content[0].text' | jq '{fetchedCount, hasMore}' 2>/dev/null)
echo "$result"

echo -e "\n3. Testing fetchAll=true (gets all comments up to 10 pages)..."
result=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_comments","arguments":{"videoId":"'$VIDEO_ID'","fetchAll":true}},"id":3}' | YOUTUBE_API_KEY="$YOUTUBE_API_KEY" timeout 30 node dist/index.js 2>/dev/null | jq -r '.result.content[0].text' | jq '{fetchedCount, pagesProcessed, message}' 2>/dev/null)
echo "$result"

echo -e "\n========================================"
echo "Improvements implemented:"
echo "- Pagination support with pageToken"
echo "- fetchAll option to get all comments (up to 10 pages)"
echo "- Returns all replies instead of just first 5"
echo "- Shows hasMore flag for pagination"
echo "- Prevents quota exhaustion with page limit"
echo "========================================"
