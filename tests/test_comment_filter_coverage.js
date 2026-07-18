#!/usr/bin/env node

// Extended tests for better coverage
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
  console.log('Running Extended Comment Filter Tests for Coverage...\n');

  // Previous tests
  const urlComments = [
    { text: 'Check out my channel https://spam.com' },
    { text: 'Visit bit.ly/xyz' },
    { text: 'Normal comment' }
  ];
  const urlFiltered = CommentFilter.filterComments(urlComments);
  assert(urlFiltered.length === 1, 'Should filter URL spam');

  // Test promotional patterns
  const promoComments = [
    { text: 'Click my channel for more' },
    { text: 'Watch our video here' },
    { text: 'See my profile for deals' },
    { text: 'Normal discussion' }
  ];
  const promoFiltered = CommentFilter.filterComments(promoComments);
  assert(promoFiltered.length === 1, 'Should filter promotional content');

  // Test short URL patterns
  const shortUrlComments = [
    { text: 'goo.gl/xyz123' },
    { text: 'Check tinyurl.com/abc' },
    { text: 'Visit short.link/test' },
    { text: 'Regular comment here' }
  ];
  const shortUrlFiltered = CommentFilter.filterComments(shortUrlComments);
  assert(shortUrlFiltered.length === 1, 'Should filter short URLs');

  // Test HTML entities
  const htmlEntityComments = [
    { text: 'Test &lt;script&gt; tag' },
    { text: 'Some &amp; text &quot;here&quot;' },
    { text: '&#123; code &#125;' },
    { text: 'Clean text only' }
  ];
  const htmlEntityFiltered = CommentFilter.filterComments(htmlEntityComments);
  assert(htmlEntityFiltered.length === 1, 'Should filter HTML entities');

  // Test repeated characters
  const repeatedCharComments = [
    { text: 'aaaaaaaaaaaa' },
    { text: '!!!!!!!!!!!!' },
    { text: '.........' },
    { text: 'Normal punctuation!' }
  ];
  const repeatedCharFiltered = CommentFilter.filterComments(repeatedCharComments);
  assert(repeatedCharFiltered.length === 1, 'Should filter repeated characters');

  // Test various bot patterns
  const botVariantComments = [
    { text: "Who's here in 2025?" },
    { text: 'Anyone watching from Japan?' },
    { text: 'Like if you agree' },
    { text: 'Thumbs up if you love this' },
    { text: 'Second!' },
    { text: '3rd!' },
    { text: 'Actual feedback on video' }
  ];
  const botVariantFiltered = CommentFilter.filterComments(botVariantComments);
  assert(botVariantFiltered.length === 1, 'Should filter bot variants');

  // Test keyboard patterns
  const keyboardComments = [
    { text: 'qwerqwerqwer' },
    { text: 'asdfasdfasdf' },
    { text: 'hjklhjklhjkl' },
    { text: 'abcdabcdabcd' },
    { text: '123412341234' },
    { text: 'Meaningful text here' }
  ];
  const keyboardFiltered = CommentFilter.filterComments(keyboardComments);
  assert(keyboardFiltered.length === 1, 'Should filter keyboard patterns');

  // Test consonant clusters
  const consonantComments = [
    { text: 'bdfgjklmnp' },
    { text: 'bcdfghjklmnpqrstvwxyz' },
    { text: 'English text with vowels' }
  ];
  const consonantFiltered = CommentFilter.filterComments(consonantComments);
  assert(consonantFiltered.length === 1, 'Should filter consonant clusters');

  // Test extremely short comments
  const shortComments = [
    { text: 'a' },
    { text: '!' },
    { text: '😀' },
    { text: 'OK' },  // Should keep this
    { text: 'Good video!' }
  ];
  const shortFiltered = CommentFilter.filterComments(shortComments);
  assert(shortFiltered.length === 5, 'Should keep short reactions and comments');

  // Test repeated words (high frequency)
  const repeatedWordComments = [
    { text: 'love love love love love love love love' },
    { text: 'buy buy buy buy buy buy' },
    { text: 'I love this video very much indeed' }
  ];
  const repeatedWordFiltered = CommentFilter.filterComments(repeatedWordComments);
  assert(repeatedWordFiltered.length === 1, 'Should filter repeated words');

  // Test mixed patterns
  const mixedComments = [
    { text: '🔥🔥🔥 Check bit.ly/xyz 🔥🔥🔥' },
    { text: 'Check out my channel https://spam.com' },
    { text: 'asdfghjkl who is watching?' },
    { text: 'Great tutorial, helped me understand the concept' }
  ];
  const mixedFiltered = CommentFilter.filterComments(mixedComments);
  assert(mixedFiltered.length === 1, 'Should filter mixed spam patterns');

  // Test disable specific filters
  const partialFilterComments = [
    { text: 'https://example.com' },
    { text: 'First!' },
    { text: 'Normal comment' }
  ];
  
  const noSpamFilter = CommentFilter.filterComments(partialFilterComments, { 
    removeSpam: false,
    removeNoise: true,
    removeUnrelated: true
  });
  assert(noSpamFilter.length === 2, 'Should respect removeSpam: false');

  const noNoiseFilter = CommentFilter.filterComments([
    { text: '🔥🔥🔥🔥🔥🔥' },
    { text: 'Regular text' }
  ], {
    removeSpam: true,
    removeNoise: false,
    removeUnrelated: true
  });
  assert(noNoiseFilter.length === 2, 'Should respect removeNoise: false');

  const noUnrelatedFilter = CommentFilter.filterComments([
    { text: 'First!' },
    { text: 'Normal text' }
  ], {
    removeSpam: true,
    removeNoise: true,
    removeUnrelated: false
  });
  assert(noUnrelatedFilter.length === 2, 'Should respect removeUnrelated: false');

  // Test edge cases
  const edgeCaseComments = [
    { text: null },
    { text: undefined },
    { text: '' },
    { text: '   ' },  // Only spaces
    { text: '\n\n\n' },  // Only newlines
    { text: 'Valid comment' }
  ];
  const edgeFiltered = CommentFilter.filterComments(edgeCaseComments);
  assert(edgeFiltered.length === 1, 'Should handle edge cases');

  // Test special characters only
  const specialCharComments = [
    { text: '@#$%^&*()' },
    { text: '+-=[]{}|;:' },
    { text: 'Text with @mentions and #hashtags' }
  ];
  const specialCharFiltered = CommentFilter.filterComments(specialCharComments);
  assert(specialCharFiltered.length === 3, 'Should keep unknown special-character comments');

  // Summary
  console.log(`\n========================================`);
  console.log(`Extended Tests completed: ${passed + failed}`);
  console.log(`${GREEN}Passed: ${passed}${NC}`);
  if (failed > 0) {
    console.log(`${RED}Failed: ${failed}${NC}`);
    process.exit(1);
  } else {
    console.log(`${GREEN}All tests passed!${NC}`);
  }
}

runTests();
