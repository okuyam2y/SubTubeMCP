#!/bin/bash

set -o pipefail

echo "========================================"
echo "Testing Transcript Modes"
echo "========================================"

VIDEO_ID="oMBStpvOLjo"  # Long video with 3086 segments

echo -e "\n1. Testing SMART mode (default)..."
result=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_transcript","arguments":{"videoId":"'$VIDEO_ID'","lang":"ja"}},"id":1}' | node dist/index.js 2>/dev/null | jq -r '.result.content[0].text' | jq '{mode, totalSegments, message}' 2>/dev/null)
echo "$result"

echo -e "\n2. Testing SUMMARY mode (focus on conclusion)..."
result=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_transcript","arguments":{"videoId":"'$VIDEO_ID'","lang":"ja","mode":"summary"}},"id":2}' | node dist/index.js 2>/dev/null | jq -r '.result.content[0].text' | jq '{mode, totalSegments, message}' 2>/dev/null)
echo "$result"

echo -e "\n3. Testing FULL mode (beginning only)..."
result=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_transcript","arguments":{"videoId":"'$VIDEO_ID'","lang":"ja","mode":"full","maxSegments":100}},"id":3}' | node dist/index.js 2>/dev/null | jq -r '.result.content[0].text' | jq '{mode, totalSegments, message}' 2>/dev/null)
echo "$result"

echo -e "\n========================================"
echo "Mode Explanations:"
echo "- SMART: 20% intro + 30% middle samples + 50% conclusion"
echo "- SUMMARY: 10% intro + 20% middle samples + 70% conclusion (best for getting the conclusion)"
echo "- FULL: Beginning segments only (might miss the conclusion)"
echo "========================================"
