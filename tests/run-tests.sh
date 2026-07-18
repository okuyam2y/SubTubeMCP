#!/bin/bash

echo "========================================="
echo "YouTube MCP Server Test Suite"
echo "========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_pattern="$3"
    
    echo -n "Testing $test_name... "
    
    output=$(eval "$command" 2>&1)
    status=$?
    
    if [ "$status" -eq 0 ] && echo "$output" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Exit status: $status"
        echo "  Expected pattern: $expected_pattern"
        echo "  Got: $(echo "$output" | head -3)"
        ((TESTS_FAILED++))
        return 1
    fi
}

# 1. Test Node.js and npm installation
echo "1. Environment Check"
echo "--------------------"
run_test "Node.js version" "node --version" "^v[0-9]"
run_test "npm version" "npm --version" "^[0-9]"
run_test "yt-dlp version" "yt-dlp --version" "^202"
echo ""

# 2. Test build
echo "2. Build Test"
echo "-------------"
run_test "TypeScript build" "npm run build 2>&1" "youtube-mcp-server@.* build"
run_test "Build output exists" "ls dist/index.js 2>&1" "dist/index.js"
echo ""

# 3. Test server startup
echo "3. Server Startup Test"
echo "----------------------"
run_test "Server starts" "node dist/index.js < /dev/null 2>&1" "YouTube MCP server running"
echo ""

# 4. Test yt-dlp with impersonation
echo "4. yt-dlp Impersonation Test"
echo "-----------------------------"
YT_DLP_CMD='yt-dlp --list-subs --skip-download --user-agent "Mozilla/5.0" "https://www.youtube.com/watch?v=dQw4w9WgXcQ" 2>&1'
run_test "yt-dlp subtitle listing" "$YT_DLP_CMD" "Available.*captions"
echo ""

# 5. Test video metadata extraction (no API key needed)
echo "5. Video Metadata Test (server implementation path)"
echo "--------------------------------------------------"
run_test "video metadata" "node tests/test_video_metadata.js" "PASS video metadata:"
echo ""

# 6. Test MCP protocol
echo "6. MCP Protocol Test"
echo "--------------------"
MCP_TEST='echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}" | node dist/index.js 2>/dev/null'
run_test "MCP tools/list response" "$MCP_TEST" "search_videos\|jsonrpc"
echo ""

# 7. Test TypeScript compilation
echo "7. TypeScript Quality Check"
echo "----------------------------"
run_test "Type checking" "npm run typecheck 2>&1" "youtube-mcp-server@.* typecheck"
echo ""

# Summary
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed successfully!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the output above.${NC}"
    exit 1
fi
