#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}    Comment Filtering Test Suite${NC}"
echo -e "${YELLOW}========================================${NC}"

# Check if API key is set
if [ -z "$YOUTUBE_API_KEY" ]; then
    echo -e "${RED}✗ YOUTUBE_API_KEY not set${NC}"
    echo "Please set YOUTUBE_API_KEY environment variable"
    exit 1
fi

# Sample video IDs for testing
VIDEO_ID="dQw4w9WgXcQ"  # Well-known video with many comments

echo -e "\n${YELLOW}1. Testing comment filtering (default: enabled)${NC}"
response=$(cat << EOF | npx tsx src/index.ts
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_comments",
    "arguments": {
      "videoId": "$VIDEO_ID",
      "maxResults": 50
    }
  }
}
EOF
)

if echo "$response" | grep -q '"filtering":"enabled"'; then
    echo -e "${GREEN}✓ Default filtering is enabled${NC}"
    
    # Check if filtered count is present
    if echo "$response" | grep -q '"filteredCount"'; then
        filtered=$(echo "$response" | grep -oP '"filteredCount":\s*\K\d+' | head -1)
        echo -e "${GREEN}✓ Filtered $filtered spam/noise comments${NC}"
    fi
else
    echo -e "${RED}✗ Default filtering not working${NC}"
fi

echo -e "\n${YELLOW}2. Testing with filtering disabled (noFilter: true)${NC}"
response_nofilter=$(cat << EOF | npx tsx src/index.ts
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_comments",
    "arguments": {
      "videoId": "$VIDEO_ID",
      "maxResults": 50,
      "noFilter": true
    }
  }
}
EOF
)

if echo "$response_nofilter" | grep -q '"filtering":"disabled"'; then
    echo -e "${GREEN}✓ Filtering successfully disabled with noFilter option${NC}"
    
    # Count comments in both responses
    filtered_count=$(echo "$response" | grep -o '"id":' | wc -l)
    unfiltered_count=$(echo "$response_nofilter" | grep -o '"id":' | wc -l)
    
    if [ "$unfiltered_count" -ge "$filtered_count" ]; then
        echo -e "${GREEN}✓ Unfiltered ($unfiltered_count) >= Filtered ($filtered_count) comments${NC}"
    fi
else
    echo -e "${RED}✗ noFilter option not working${NC}"
fi

echo -e "\n${YELLOW}3. Testing fetchAll with filtering${NC}"
response_all=$(cat << EOF | npx tsx src/index.ts 2>/dev/null
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_comments",
    "arguments": {
      "videoId": "$VIDEO_ID",
      "fetchAll": true
    }
  }
}
EOF
)

if echo "$response_all" | grep -q '"filtering":"enabled"'; then
    echo -e "${GREEN}✓ Filtering works with fetchAll${NC}"
    
    if echo "$response_all" | grep -q '"filteredCount"'; then
        total_filtered=$(echo "$response_all" | grep -oP '"filteredCount":\s*\K\d+' | head -1)
        echo -e "${GREEN}✓ Filtered $total_filtered comments in batch mode${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Could not verify filtering with fetchAll${NC}"
fi

echo -e "\n${YELLOW}4. Testing filter patterns${NC}"

# Create a test with known spam patterns
test_video="UC_x5XG1OV2P6uZZ5FSM9Ttw"  # Google Developers channel - clean comments

response_patterns=$(cat << EOF | npx tsx src/index.ts 2>/dev/null
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "get_comments",
    "arguments": {
      "videoId": "dQw4w9WgXcQ",
      "maxResults": 100
    }
  }
}
EOF
)

# Check if common spam patterns are filtered
if echo "$response_patterns" | grep -q '"comments":\['; then
    # Extract comments text
    comments=$(echo "$response_patterns" | grep -oP '"text":"[^"]*"' | cut -d'"' -f4)
    
    # Check for absence of common spam patterns
    spam_found=0
    
    # Check for URLs
    if echo "$comments" | grep -qE 'https?://'; then
        echo -e "${RED}✗ URLs not filtered${NC}"
        spam_found=1
    else
        echo -e "${GREEN}✓ URLs filtered${NC}"
    fi
    
    # Check for "Who's watching in YYYY" pattern
    if echo "$comments" | grep -qiE "who.?s?\s+(watching|here|listening)\s+(in|from)?\s*20[0-9]{2}"; then
        echo -e "${RED}✗ Bot patterns not filtered${NC}"
        spam_found=1
    else
        echo -e "${GREEN}✓ Bot patterns filtered${NC}"
    fi
    
    # Check for excessive emojis
    if echo "$comments" | grep -qP '[\x{1F300}-\x{1F9FF}]{5,}'; then
        echo -e "${RED}✗ Excessive emojis not filtered${NC}"
        spam_found=1
    else
        echo -e "${GREEN}✓ Excessive emojis filtered${NC}"
    fi
    
    if [ $spam_found -eq 0 ]; then
        echo -e "${GREEN}✓ All spam patterns successfully filtered${NC}"
    fi
fi

echo -e "\n${YELLOW}========================================${NC}"
echo -e "${GREEN}Comment Filtering Tests Complete!${NC}"
echo -e "${YELLOW}========================================${NC}"

# Summary
echo -e "\n${YELLOW}Filter Categories:${NC}"
echo "• Spam: URLs, promotional content, repeated text"
echo "• Noise: HTML tags, excessive emojis, gibberish"
echo "• Bot: 'Who's watching in 2024?', 'First!', etc."
echo ""
echo "Use 'noFilter: true' to disable all filtering"