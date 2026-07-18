import { CommentFilter } from '../dist/utils/commentFilter.js';

console.log('=== Comprehensive Comment Filter Test ===\n');

const testCases = [
  // Synthetic legitimate comments (never copied from user input)
  {
    id: 'synthetic-legitimate-1',
    text: 'Could you explain how this option affects subtitle output?',
    authorChannelId: 'UC_SYNTHETIC_LEGITIMATE_001',
    expected: false,
    description: 'Synthetic technical question'
  },
  {
    id: 'synthetic-legitimate-2',
    text: '字幕の取得方法について詳しく教えてください。',
    authorChannelId: 'UC_SYNTHETIC_LEGITIMATE_002',
    expected: false,
    description: 'Synthetic Japanese question'
  },
  {
    id: 'synthetic-legitimate-3',
    text: 'Thanks for documenting the transcript modes clearly.',
    authorChannelId: 'UC_SYNTHETIC_LEGITIMATE_003',
    expected: false,
    description: 'Synthetic constructive feedback'
  },
  
  // Normal comments that should NOT be filtered
  {
    id: 'normal-1',
    text: 'Great tutorial! This helped me a lot.',
    authorChannelId: 'channel1',
    expected: false,
    description: 'Normal positive feedback'
  },
  {
    id: 'normal-2',
    text: 'I found the solution here: https://github.com/example/repo',
    authorChannelId: 'channel2',
    expected: false,
    description: 'Helpful comment with single URL'
  },
  {
    id: 'normal-3',
    text: 'エラーが出ました。解決方法を教えてください。',
    authorChannelId: 'channel3',
    expected: false,
    description: 'Question in Japanese'
  },
  {
    id: 'normal-4',
    text: 'Check the documentation for more details',
    authorChannelId: 'channel4',
    expected: false,
    description: 'Suggestion without promotional URL'
  },
  
  // Spam comments that SHOULD be filtered
  {
    id: 'spam-1',
    text: 'Check out my channel https://youtube.com/spam for more videos!',
    authorChannelId: 'spammer1',
    expected: true,
    description: 'Promotional phrase with URL'
  },
  {
    id: 'spam-2',
    text: 'Amazing content! bit.ly/getrich',
    authorChannelId: 'spammer2',
    expected: true,
    description: 'Comment with suspicious short URL'
  },
  {
    id: 'spam-3',
    text: 'Visit my profile for deals https://example.com https://another.com https://third.com',
    authorChannelId: 'spammer3',
    expected: true,
    description: 'Multiple URLs (3+) - likely spam'
  },
  {
    id: 'spam-4',
    text: 'Click my link tinyurl.com/amazing',
    authorChannelId: 'spammer4',
    expected: true,
    description: 'Suspicious short URL'
  },
  
  // Bot-like comments
  {
    id: 'bot-1',
    text: 'Who\'s watching in 2024?',
    authorChannelId: 'bot1',
    expected: true,
    description: 'Common bot pattern'
  },
  {
    id: 'bot-2',
    text: 'First!',
    authorChannelId: 'bot2',
    expected: true,
    description: 'First comment pattern'
  },
  {
    id: 'bot-3',
    text: 'Like if you love this song',
    authorChannelId: 'bot3',
    expected: true,
    description: 'Like-baiting comment'
  },
  
  // Noise comments
  {
    id: 'noise-1',
    text: '!!!!!!!!!!!!!!!!!!',
    authorChannelId: 'noise1',
    expected: true,
    description: 'Excessive repetition'
  },
  {
    id: 'noise-2',
    text: 'asdfasdfasdfasdf',
    authorChannelId: 'noise2',
    expected: true,
    description: 'Keyboard mashing'
  },
  {
    id: 'noise-3',
    text: '😀😀😀😀😀😀😀😀😀',
    authorChannelId: 'noise3',
    expected: true,
    description: 'Excessive emojis'
  },
  
  // Edge cases
  {
    id: 'edge-1',
    text: '',
    authorChannelId: 'edge1',
    expected: true,
    description: 'Empty comment'
  },
  {
    id: 'edge-2',
    text: '👍',
    authorChannelId: 'edge2',
    expected: false,
    description: 'Single emoji reaction'
  },
  {
    id: 'edge-3',
    text: 'a',
    authorChannelId: 'edge3',
    expected: false,
    description: 'Single character response'
  }
];

// Test with filtering enabled
const filterOptions = {
  enableFiltering: true,
  removeSpam: true,
  removeNoise: true,
  removeUnrelated: true
};

let passed = 0;
let failed = 0;
const failures = [];

console.log('Testing individual comments:\n');

testCases.forEach(testCase => {
  const result = CommentFilter.shouldFilterComment(
    { text: testCase.text, authorChannelId: testCase.authorChannelId },
    filterOptions
  );
  
  const success = result === testCase.expected;
  
  if (success) {
    passed++;
    console.log(`✓ ${testCase.id}: ${testCase.description}`);
  } else {
    failed++;
    failures.push(testCase);
    console.log(`✗ ${testCase.id}: ${testCase.description}`);
    console.log(`  Expected: ${testCase.expected ? 'filtered' : 'not filtered'}`);
    console.log(`  Got: ${result ? 'filtered' : 'not filtered'}`);
    console.log(`  Text: "${testCase.text.substring(0, 50)}${testCase.text.length > 50 ? '...' : ''}"`);
  }
});

console.log('\n=== Test Summary ===');
console.log(`Total tests: ${testCases.length}`);
console.log(`Passed: ${passed} (${(passed/testCases.length*100).toFixed(1)}%)`);
console.log(`Failed: ${failed} (${(failed/testCases.length*100).toFixed(1)}%)`);

if (failures.length > 0) {
  console.log('\n=== Failed Tests Details ===');
  failures.forEach(testCase => {
    console.log(`\nID: ${testCase.id}`);
    console.log(`Description: ${testCase.description}`);
    console.log(`Text: ${testCase.text}`);
    console.log(`Expected to be ${testCase.expected ? 'filtered' : 'kept'}, but was ${testCase.expected ? 'kept' : 'filtered'}`);
  });
}

// Test filter stats
console.log('\n=== Filter Statistics Test ===');
const allComments = testCases.map(tc => ({
  text: tc.text,
  authorChannelId: tc.authorChannelId
}));

const stats = CommentFilter.getFilterStats(allComments, filterOptions);
console.log('Stats:', stats);

// Test with filtering disabled
console.log('\n=== Testing with filtering disabled ===');
const disabledOptions = { enableFiltering: false };
const disabledFiltered = allComments.filter(c => 
  CommentFilter.shouldFilterComment(c, disabledOptions)
);
console.log(`Filtered with disabled filtering: ${disabledFiltered.length} (should be 0)`);

if (disabledFiltered.length !== 0) {
  console.log('ERROR: Filtering should not occur when disabled!');
}

// Final result
console.log('\n' + '='.repeat(50));
if (failed === 0) {
  console.log('✅ All tests passed!');
  process.exit(0);
} else {
  console.log(`❌ ${failed} test(s) failed`);
  process.exit(1);
}
