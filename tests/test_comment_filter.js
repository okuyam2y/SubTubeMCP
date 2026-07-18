import assert from 'node:assert/strict';
import nodeTest from 'node:test';
import { CommentFilter } from '../dist/utils/commentFilter.js';

const test = (name, callback) => nodeTest(name, () => callback({
  is: (actual, expected) => assert.equal(actual, expected),
  false: value => assert.equal(value, false),
}));

test('should filter URLs and links', t => {
  const comments = [
    { text: 'Great video! Check out my channel https://spam.com' },
    { text: 'Visit my channel at bit.ly/xyz' },
    { text: 'This is a normal comment without links' }
  ];
  
  const filtered = CommentFilter.filterComments(comments);
  t.is(filtered.length, 1);
  t.is(filtered[0].text, 'This is a normal comment without links');
});

test('should filter bot patterns', t => {
  const comments = [
    { text: "Who's watching in 2024?" },
    { text: 'First!' },
    { text: 'Anyone else here from TikTok?' },
    { text: 'This video helped me understand the concept' }
  ];
  
  const filtered = CommentFilter.filterComments(comments);
  t.is(filtered.length, 1);
  t.is(filtered[0].text, 'This video helped me understand the concept');
});

test('should filter excessive emojis', t => {
  const comments = [
    { text: '🔥🔥🔥🔥🔥🔥🔥🔥' },
    { text: 'Great! 👍' },
    { text: '😂😂😂😂😂😂😂😂😂😂' }
  ];
  
  const filtered = CommentFilter.filterComments(comments);
  t.is(filtered.length, 1);
  t.is(filtered[0].text, 'Great! 👍');
});

test('should filter HTML tags and entities', t => {
  const comments = [
    { text: '<script>alert("hack")</script>' },
    { text: 'Normal comment with &lt;brackets&gt;' },
    { text: 'Clean comment without HTML' }
  ];
  
  const filtered = CommentFilter.filterComments(comments);
  t.is(filtered.length, 1);
  t.is(filtered[0].text, 'Clean comment without HTML');
});

test('should filter promotional content', t => {
  const comments = [
    { text: 'Check out my channel for more content' },
    { text: 'Visit our profile for amazing videos' },
    { text: 'Thanks for the tutorial' }
  ];
  
  const filtered = CommentFilter.filterComments(comments);
  t.is(filtered.length, 1);
  t.is(filtered[0].text, 'Thanks for the tutorial');
});

test('should filter gibberish and keyboard mashing', t => {
  const comments = [
    { text: 'asdfghjkl' },
    { text: 'qwerqwerqwer' },
    { text: 'aaaaaaaaaaaa' },
    { text: 'This makes sense' }
  ];
  
  const filtered = CommentFilter.filterComments(comments);
  t.is(filtered.length, 1);
  t.is(filtered[0].text, 'This makes sense');
});

test('should filter repeated text spam', t => {
  const comments = [
    { text: 'spam spam spam spam spam spam' },
    { text: 'love love love love love love love' },
    { text: 'I love this video very much' }
  ];
  
  const filtered = CommentFilter.filterComments(comments);
  t.is(filtered.length, 1);
  t.is(filtered[0].text, 'I love this video very much');
});

test('should respect noFilter option', t => {
  const comments = [
    { text: 'Check out my channel https://spam.com' },
    { text: 'First!' },
    { text: 'Normal comment' }
  ];
  
  const filtered = CommentFilter.filterComments(comments, { enableFiltering: false });
  t.is(filtered.length, 3);
});

test('should filter replies within comments', t => {
  const comments = [
    {
      text: 'Good video',
      replies: [
        { text: 'Check out my channel!' },
        { text: 'Thanks for sharing' }
      ]
    }
  ];
  
  const filtered = CommentFilter.filterComments(comments);
  t.is(filtered.length, 1);
  t.is(filtered[0].replies.length, 1);
  t.is(filtered[0].replies[0].text, 'Thanks for sharing');
});

test('should calculate filter statistics correctly', t => {
  const comments = [
    { text: 'Check out my channel https://spam.com' },
    { text: 'First!' },
    { text: 'Normal comment 1' },
    { text: 'Normal comment 2' }
  ];
  
  const stats = CommentFilter.getFilterStats(comments);
  t.is(stats.total, 4);
  t.is(stats.filtered, 2);
  t.is(stats.kept, 2);
  t.is(stats.filterRate, '50.0%');
});

test('should handle empty comments array', t => {
  const filtered = CommentFilter.filterComments([]);
  t.is(filtered.length, 0);
  
  const stats = CommentFilter.getFilterStats([]);
  t.is(stats.total, 0);
  t.is(stats.filterRate, '0%');
});

test('should handle comments with missing text', t => {
  const comments = [
    { text: null },
    { text: undefined },
    { text: '' },
    { text: 'Valid comment' }
  ];
  
  const filtered = CommentFilter.filterComments(comments);
  t.is(filtered.length, 1);
  t.is(filtered[0].text, 'Valid comment');
});

test('should preserve legitimate comments with numbers', t => {
  const comments = [
    { text: 'The answer is 42' },
    { text: 'Released in 2023' },
    { text: '123456789' }  // Only numbers - should be filtered
  ];
  
  const filtered = CommentFilter.filterComments(comments);
  t.is(filtered.length, 2);
  t.false(filtered.some(c => c.text === '123456789'));
});

test('should handle mixed language comments', t => {
  const comments = [
    { text: 'これは日本語のコメントです' },
    { text: '这是中文评论' },
    { text: '한국어 댓글입니다' },
    { text: 'مرحبا بالعربية' },
    { text: '!!!!!!!!!!' }  // Should be filtered
  ];
  
  const filtered = CommentFilter.filterComments(comments);
  t.is(filtered.length, 4);
  t.false(filtered.some(c => c.text === '!!!!!!!!!!'));
});
