#!/usr/bin/env node

// Simple unit tests for comment filter without external dependencies
import { CommentFilter } from '../dist/utils/commentFilter.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const NC = '\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`${GREEN}✓${NC} ${message}`);
    passed++;
  } else {
    console.log(`${RED}✗${NC} ${message}`);
    failed++;
  }
}

function runTests() {
  console.log('Running Comment Filter Tests...\n');

  // Test 1: Filter URLs
  const urlComments = [
    { text: 'Check out my channel https://spam.com' },
    { text: 'Visit bit.ly/xyz' },
    { text: 'Normal comment' }
  ];
  const urlFiltered = CommentFilter.filterComments(urlComments);
  assert(urlFiltered.length === 1, 'Should filter URL spam');
  assert(urlFiltered[0].text === 'Normal comment', 'Should keep normal comments');

  // Test 2: Filter bot patterns
  const botComments = [
    { text: "Who's watching in 2024?" },
    { text: 'First!' },
    { text: 'Good explanation' }
  ];
  const botFiltered = CommentFilter.filterComments(botComments);
  assert(botFiltered.length === 1, 'Should filter bot comments');

  // Test 3: Filter excessive emojis
  const emojiComments = [
    { text: '🔥🔥🔥🔥🔥🔥🔥' },
    { text: 'Nice! 👍' }
  ];
  const emojiFiltered = CommentFilter.filterComments(emojiComments);
  assert(emojiFiltered.length === 1, 'Should filter excessive emojis');

  // Test 4: Filter HTML
  const htmlComments = [
    { text: '<script>alert("test")</script>' },
    { text: 'Normal text' }
  ];
  const htmlFiltered = CommentFilter.filterComments(htmlComments);
  assert(htmlFiltered.length === 1, 'Should filter HTML tags');

  // Test 5: No filter option
  const noFilterComments = [
    { text: 'https://test.com' },
    { text: 'First!' }
  ];
  const noFiltered = CommentFilter.filterComments(noFilterComments, { enableFiltering: false });
  assert(noFiltered.length === 2, 'Should not filter when disabled');

  // Test 6: Filter statistics
  const statsComments = [
    { text: 'Check out my channel https://spam.com' },
    { text: 'Normal 1' },
    { text: 'Normal 2' }
  ];
  const stats = CommentFilter.getFilterStats(statsComments);
  assert(stats.total === 3, 'Should count total correctly');
  assert(stats.filtered === 1, 'Should count filtered correctly');
  assert(stats.kept === 2, 'Should count kept correctly');

  // Test 7: Filter replies
  const replyComments = [{
    text: 'Main comment',
    replies: [
      { text: 'Check out my channel!' },
      { text: 'Thanks!' }
    ]
  }];
  const replyFiltered = CommentFilter.filterComments(replyComments);
  assert(replyFiltered[0].replies.length === 1, 'Should filter spam in replies');

  // Test 8: Gibberish detection
  const gibberishComments = [
    { text: 'asdfghjkl' },
    { text: 'Real comment here' }
  ];
  const gibberishFiltered = CommentFilter.filterComments(gibberishComments);
  assert(gibberishFiltered.length === 1, 'Should filter gibberish');

  // Test 9: Repeated text
  const repeatedComments = [
    { text: 'spam spam spam spam spam' },
    { text: 'I really love this video' }
  ];
  const repeatedFiltered = CommentFilter.filterComments(repeatedComments);
  assert(repeatedFiltered.length === 1, 'Should filter repeated spam');

  // Test 10: Empty/null handling
  const emptyComments = [
    { text: '' },
    { text: null },
    { text: 'Valid' }
  ];
  const emptyFiltered = CommentFilter.filterComments(emptyComments);
  assert(emptyFiltered.length === 1, 'Should handle empty/null text');

  // Summary
  console.log(`\n========================================`);
  console.log(`Tests completed: ${passed + failed}`);
  console.log(`${GREEN}Passed: ${passed}${NC}`);
  if (failed > 0) {
    console.log(`${RED}Failed: ${failed}${NC}`);
    process.exit(1);
  } else {
    console.log(`${GREEN}All tests passed!${NC}`);
  }
}

runTests();
