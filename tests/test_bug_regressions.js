import assert from 'node:assert/strict';
import { YoutubeTranscript } from 'youtube-transcript';
import { SubtitleHandler } from '../dist/handlers/subtitle.js';
import { CommentFilter } from '../dist/utils/commentFilter.js';

function captureStdout(callback) {
  const originalWrite = process.stdout.write;
  let captured = '';

  process.stdout.write = (chunk, encoding, callbackArg) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString(encoding);
    if (typeof callbackArg === 'function') callbackArg();
    return true;
  };

  try {
    callback();
  } finally {
    process.stdout.write = originalWrite;
  }

  return captured;
}

function testCommentFilterKeepsStdoutClean() {
  const filteredComments = [
    { text: 'visit my channel' },
    { text: 'spam spam spam spam spam' },
    { text: '' },
    { text: 'asdfasdfasdf' },
    { text: 'first!' }
  ];

  const stdout = captureStdout(() => {
    for (const comment of filteredComments) {
      assert.equal(CommentFilter.shouldFilterComment(comment), true);
    }
  });

  assert.equal(stdout, '', 'comment filtering must not write to MCP stdout');
}

function testSubtitleCleaningEdgeCases() {
  const handler = new SubtitleHandler();

  assert.equal(
    handler.cleanSubtitleText('[音楽]&nbsp;【Speaker】&lt;test&gt;'),
    '【Speaker】<test>',
    'escaped literal angle brackets must survive HTML tag removal'
  );
  assert.equal(handler.convertHalfWidthToFullWidth('ｶﾞｷﾞｸﾞ'), 'ガギグ');
  assert.equal(handler.convertHalfWidthToFullWidth('ﾜｦﾝ'), 'ワヲン');
  assert.equal(handler.convertHalfWidthToFullWidth('ｰﾞﾟ'), 'ー゛゜');
  assert.equal(handler.shouldSkipVttLine('WEBVTT'), true);
  assert.equal(handler.shouldSkipVttLine('WEBVTT - captions'), true);
  assert.equal(handler.shouldSkipVttLine('WEBVTT-like'), false);
}

function testVttMetadataBlocksCannotBecomeCues() {
  const handler = new SubtitleHandler();
  const segments = handler.parseVttToSegments(`WEBVTT

NOTE metadata with a label
00:00:00.000 --> 00:00:01.000
must not become a subtitle

STYLE
00:00:01.000 --> 00:00:02.000
also not a subtitle

REGION
00:00:02.000 --> 00:00:03.000
still metadata

00:00:03.000 --> 00:00:04.000
real subtitle`);

  assert.deepEqual(segments.map(segment => segment.text), ['real subtitle']);
}

async function getTranscriptWithText(handler, text, maxSegments = 5000) {
  YoutubeTranscript.fetchTranscript = async () => [{
    text,
    offset: 0,
    duration: 1000
  }];

  const response = await handler.getTranscript({
    videoId: 'dQw4w9WgXcQ',
    lang: 'ja',
    mode: 'full',
    maxSegments
  });

  return JSON.parse(response.content[0].text);
}

async function testFullTextTruncationIsDisclosed() {
  const handler = new SubtitleHandler();
  const originalFetchTranscript = YoutubeTranscript.fetchTranscript;

  try {
    const truncated = await getTranscriptWithText(handler, 'x'.repeat(50001));
    assert.equal(truncated.fullTextTruncated, true);
    assert.equal(truncated.fullTextOriginalLength, 50001);
    assert.equal(truncated.fullTextReturnedLength, 50000);
    assert.deepEqual(truncated.fullTextRange, { start: 0, endExclusive: 50000 });
    assert.equal(truncated.segmentTruncated, false);
    assert.equal(truncated.isTruncated, true);
    assert.match(truncated.message, /50001/);

    const complete = await getTranscriptWithText(handler, 'x'.repeat(50000));
    assert.equal(complete.fullTextTruncated, false);
    assert.equal(complete.fullTextOriginalLength, 50000);
    assert.equal(complete.fullTextReturnedLength, 50000);
    assert.equal(complete.segmentTruncated, false);
    assert.equal(complete.isTruncated, false);
    assert.equal('message' in complete, false);

    const fallbackResponse = handler.createTranscriptResponse({
      language: 'ja',
      mode: 'full',
      fullText: 'y'.repeat(50001),
      totalSegments: 1,
      processedTranscript: {
        segments: [{ text: 'y'.repeat(50001) }],
        isTruncated: false
      },
      source: 'yt-dlp',
      method: 'regression fixture'
    });
    const fallback = JSON.parse(fallbackResponse.content[0].text);
    assert.equal(fallback.source, 'yt-dlp');
    assert.equal(fallback.method, 'regression fixture');
    assert.equal(fallback.fullTextTruncated, true);
    assert.equal(fallback.isTruncated, true);
  } finally {
    YoutubeTranscript.fetchTranscript = originalFetchTranscript;
  }
}

testCommentFilterKeepsStdoutClean();
testSubtitleCleaningEdgeCases();
testVttMetadataBlocksCannotBecomeCues();
await testFullTextTruncationIsDisclosed();
console.log('PASS bug regressions');
