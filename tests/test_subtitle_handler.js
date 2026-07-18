import { SubtitleHandler } from '../dist/handlers/subtitle.js';
import { promises as fs } from 'fs';
import assert from 'assert';

/**
 * Comprehensive test suite for SubtitleHandler with coverage
 */
class SubtitleHandlerTest {
  constructor() {
    this.handler = new SubtitleHandler();
    this.testsPassed = 0;
    this.testsFailed = 0;
  }

  /**
   * Test helper methods
   */
  async testHelperMethods() {
    console.log('\n🧪 Testing Helper Methods...');
    
    // Test isValidSegmentText
    const validTextTests = [
      { input: 'Valid text', expected: true },
      { input: 'ab', expected: false }, // Too short
      { input: 'abc', expected: true },
      { input: '', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false }
    ];
    
    for (const test of validTextTests) {
      const result = this.handler.isValidSegmentText(test.input);
      assert.strictEqual(result, test.expected, 
        `isValidSegmentText('${test.input}') should be ${test.expected}`);
    }
    console.log('  ✓ isValidSegmentText tests passed');
    
    // Test shouldSkipVttLine
    const skipTests = [
      { input: 'WEBVTT', expected: true },
      { input: 'NOTE', expected: true },
      { input: 'STYLE', expected: true },
      { input: 'REGION', expected: true },
      { input: '', expected: true },
      { input: '  ', expected: true },
      { input: 'Regular text', expected: false }
    ];
    
    for (const test of skipTests) {
      const result = this.handler.shouldSkipVttLine(test.input);
      assert.strictEqual(result, test.expected,
        `shouldSkipVttLine('${test.input}') should be ${test.expected}`);
    }
    console.log('  ✓ shouldSkipVttLine tests passed');
    
    // Test createSegmentIfValid
    const segment1 = this.handler.createSegmentIfValid('Hello', 0, 2, '');
    assert(segment1 !== null, 'Should create segment for new text');
    assert.strictEqual(segment1.text, 'Hello');
    assert.strictEqual(segment1.duration, 2);
    
    const segment2 = this.handler.createSegmentIfValid('Hello', 2, 4, 'Hello');
    assert(segment2 === null, 'Should not create duplicate segment');
    
    const segment3 = this.handler.createSegmentIfValid('Hello World', 4, 6, 'Hello');
    assert(segment3 === null, 'Should not create progressive duplicate');
    
    const segment4 = this.handler.createSegmentIfValid('Different', 6, 8, 'Hello');
    assert(segment4 !== null, 'Should create segment for different text');
    
    console.log('  ✓ createSegmentIfValid tests passed');
    
    this.testsPassed++;
  }

  /**
   * Test cleanSubtitleText method
   */
  async testCleanSubtitleText() {
    console.log('\n🧪 Testing cleanSubtitleText...');
    
    const tests = [
      // HTML entities
      { input: '&amp; &lt; &gt;', expected: '& < >' },
      { input: '&quot;test&apos;', expected: '"test\'' },
      { input: '&nbsp;space', expected: 'space' },
      { input: '&#8203;', expected: '' }, // Zero-width space
      
      // HTML tags
      { input: '<c>text</c>', expected: 'text' },
      { input: '<00:00:01.000>text', expected: 'text' },
      
      // Music/sound indicators
      { input: '[音楽] text', expected: 'text' },
      { input: 'text [拍手]', expected: 'text' },
      { input: '[笑い] middle [Music]', expected: 'middle' },
      
      // Speaker labels (should be kept)
      { input: '【Speaker】text', expected: '【Speaker】text' },
      { input: '[Name]: text', expected: '[Name]: text' },
      { input: 'SPEAKER: text', expected: 'SPEAKER: text' },
      { input: '>> text', expected: 'text' },
      
      // Repeated characters
      { input: 'ああああああ', expected: 'あ' },
      { input: 'Hellooooo', expected: 'Hello' },
      
      // Half-width katakana
      { input: 'ｱｲｳｴｵ', expected: 'アイウエオ' },
      { input: 'ｶﾞｷﾞｸﾞ', expected: 'ガギグ' },
      
      // Complex case
      { input: '[音楽]&nbsp;【Speaker】&lt;test&gt;', expected: '【Speaker】<test>' }
    ];
    
    for (const test of tests) {
      const result = this.handler.cleanSubtitleText(test.input);
      assert.strictEqual(result, test.expected,
        `cleanSubtitleText('${test.input}') should be '${test.expected}' but got '${result}'`);
    }
    
    console.log('  ✓ All cleanSubtitleText tests passed');
    this.testsPassed++;
  }

  /**
   * Test parseVttToSegments
   */
  async testParseVttToSegments() {
    console.log('\n🧪 Testing parseVttToSegments...');
    
    const vttContent = `WEBVTT
Kind: captions
Language: en

NOTE
This is a note block
Should be skipped

00:00:00.000 --> 00:00:02.000 align:start position:0%
First line

00:00:02.000 --> 00:00:04.000
First line
Second line

00:00:04.000 --> 00:00:06.000
Different text

00:00:06.000 --> 00:00:08.000
[音楽]

00:00:08.000 --> 00:00:10.000
【Speaker】Hello`;
    
    const segments = this.handler.parseVttToSegments(vttContent);
    
    assert.strictEqual(segments.length, 3, 'Should have 3 segments after deduplication');
    assert.strictEqual(segments[0].text, 'First line');
    assert.strictEqual(segments[1].text, 'Different text');
    assert.strictEqual(segments[2].text, '【Speaker】Hello');
    
    console.log('  ✓ parseVttToSegments tests passed');
    this.testsPassed++;
  }

  /**
   * Test parseSrtToSegments
   */
  async testParseSrtToSegments() {
    console.log('\n🧪 Testing parseSrtToSegments...');
    
    const srtContent = `1
00:00:00,000 --> 00:00:02,000
First subtitle

2
00:00:02,000 --> 00:00:04,000
First subtitle
With continuation

3
00:00:04,000 --> 00:00:06,000
Different subtitle

4
00:00:06,000 --> 00:00:08,000
[音楽]

5
00:00:08,000 --> 00:00:10,000
【Speaker】Test`;
    
    const segments = this.handler.parseSrtToSegments(srtContent);
    
    assert.strictEqual(segments.length, 3, 'Should have 3 segments after deduplication');
    assert.strictEqual(segments[0].text, 'First subtitle');
    assert.strictEqual(segments[1].text, 'Different subtitle');
    assert.strictEqual(segments[2].text, '【Speaker】Test');
    
    console.log('  ✓ parseSrtToSegments tests passed');
    this.testsPassed++;
  }

  /**
   * Test processTranscript with different modes
   */
  async testProcessTranscript() {
    console.log('\n🧪 Testing processTranscript...');
    
    // Create 10000 test segments
    const segments = [];
    for (let i = 0; i < 10000; i++) {
      segments.push({
        text: `Segment ${i}`,
        start: i,
        duration: 1,
        timestamp: `00:${String(Math.floor(i/60)).padStart(2, '0')}:${String(i%60).padStart(2, '0')}`
      });
    }
    
    // Test full mode
    const fullResult = this.handler.processTranscript(segments, 'full', 5000);
    assert.strictEqual(fullResult.segments.length, 5000, 'Full mode should return maxSegments');
    assert.strictEqual(fullResult.segments[0].text, 'Segment 0', 'Full mode should start from beginning');
    assert.strictEqual(fullResult.isTruncated, true, 'Should be marked as truncated');
    
    // Test smart mode
    const smartResult = this.handler.processTranscript(segments, 'smart', 5000);
    assert.strictEqual(smartResult.segments.length, 5000, 'Smart mode should return maxSegments');
    assert.strictEqual(smartResult.segments[0].text, 'Segment 0', 'Smart mode should include intro');
    assert.strictEqual(smartResult.segments[smartResult.segments.length - 1].text, 'Segment 9999', 
      'Smart mode should include conclusion');
    
    // Test summary mode
    const summaryResult = this.handler.processTranscript(segments, 'summary', 5000);
    assert.strictEqual(summaryResult.segments.length, 5000, 'Summary mode should return maxSegments');
    
    // Test with segments less than maxSegments
    const smallSegments = segments.slice(0, 100);
    const smallResult = this.handler.processTranscript(smallSegments, 'smart', 5000);
    assert.strictEqual(smallResult.segments.length, 100, 'Should return all segments when less than max');
    assert.strictEqual(smallResult.isTruncated, false, 'Should not be truncated');
    
    console.log('  ✓ processTranscript tests passed');
    this.testsPassed++;
  }

  /**
   * Test time parsing methods
   */
  async testTimeParsing() {
    console.log('\n🧪 Testing Time Parsing...');
    
    // Test VTT time parsing
    assert.strictEqual(this.handler.parseVttTime('00:00:00.000'), 0);
    assert.strictEqual(this.handler.parseVttTime('00:01:30.500'), 90.5);
    assert.strictEqual(this.handler.parseVttTime('01:00:00.000'), 3600);
    assert.strictEqual(this.handler.parseVttTime('10:30.500'), 630.5); // MM:SS format
    
    // Test SRT time parsing
    assert.strictEqual(this.handler.parseSrtTime('00:00:00,000'), 0);
    assert.strictEqual(this.handler.parseSrtTime('00:01:30,500'), 90.5);
    assert.strictEqual(this.handler.parseSrtTime('01:00:00,000'), 3600);
    
    console.log('  ✓ Time parsing tests passed');
    this.testsPassed++;
  }

  /**
   * Test half-width to full-width conversion
   */
  async testHalfWidthConversion() {
    console.log('\n🧪 Testing Half-Width Conversion...');
    
    const tests = [
      { input: 'ｱｲｳｴｵ', expected: 'アイウエオ' },
      { input: 'ｶｷｸｹｺ', expected: 'カキクケコ' },
      { input: 'ｻｼｽｾｿ', expected: 'サシスセソ' },
      { input: 'ﾀﾁﾂﾃﾄ', expected: 'タチツテト' },
      { input: 'ﾅﾆﾇﾈﾉ', expected: 'ナニヌネノ' },
      { input: 'ﾊﾋﾌﾍﾎ', expected: 'ハヒフヘホ' },
      { input: 'ﾏﾐﾑﾒﾓ', expected: 'マミムメモ' },
      { input: 'ﾔﾕﾖ', expected: 'ヤユヨ' },
      { input: 'ﾗﾘﾙﾚﾛ', expected: 'ラリルレロ' },
      { input: 'ﾜｦﾝ', expected: 'ワヲン' },
      { input: 'ｧｨｩｪｫ', expected: 'ァィゥェォ' },
      { input: 'ｬｭｮｯ', expected: 'ャュョッ' },
      { input: 'ｰﾞﾟ', expected: 'ー゛゜' }
    ];
    
    for (const test of tests) {
      const result = this.handler.convertHalfWidthToFullWidth(test.input);
      assert.strictEqual(result, test.expected,
        `convertHalfWidthToFullWidth('${test.input}') should be '${test.expected}'`);
    }
    
    console.log('  ✓ Half-width conversion tests passed');
    this.testsPassed++;
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('=====================================');
    console.log('🚀 SubtitleHandler Test Suite');
    console.log('=====================================');
    
    try {
      await this.testHelperMethods();
      await this.testCleanSubtitleText();
      await this.testParseVttToSegments();
      await this.testParseSrtToSegments();
      await this.testProcessTranscript();
      await this.testTimeParsing();
      await this.testHalfWidthConversion();
      
      console.log('\n=====================================');
      console.log('✅ Test Results');
      console.log('=====================================');
      console.log(`Tests Passed: ${this.testsPassed}`);
      console.log(`Tests Failed: ${this.testsFailed}`);
      
      if (this.testsFailed === 0) {
        console.log('\n🎉 All tests passed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Some tests failed');
        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ Test failed with error:', error.message);
      console.error(error.stack);
      this.testsFailed++;
      process.exit(1);
    }
  }
}

// Run the tests
const tester = new SubtitleHandlerTest();
tester.runAllTests();
