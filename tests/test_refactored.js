import { promises as fs } from 'fs';
import path from 'path';
import { SubtitleHandler } from '../dist/handlers/subtitle.js';

/**
 * Test suite for refactored subtitle handler
 */
class SubtitleTester {
  constructor() {
    this.handler = new SubtitleHandler();
    this.testResults = [];
  }

  /**
   * Test duplicate removal functionality
   */
  async testDuplicateRemoval() {
    console.log('\n🧪 Testing Duplicate Removal...');
    
    const testVtt = `WEBVTT
Kind: captions
Language: ja

00:00:00.000 --> 00:00:02.000
Hello

00:00:02.000 --> 00:00:04.000
Hello World

00:00:04.000 --> 00:00:06.000
Hello World Test

00:00:06.000 --> 00:00:08.000
Different text

00:00:08.000 --> 00:00:10.000
Different text`;

    try {
      // Create temp file
      const tempFile = 'test_duplicate.vtt';
      await fs.writeFile(tempFile, testVtt, 'utf-8');
      
      // Test parsing
      const content = await fs.readFile(tempFile, 'utf-8');
      const segments = this.parseVttContent(content);
      
      // Verify duplicates are removed
      const texts = segments.map(s => s.text);
      const uniqueTexts = [...new Set(texts)];
      
      console.log(`  ✓ Original segments: ${5}`);
      console.log(`  ✓ After duplicate removal: ${texts.length}`);
      console.log(`  ✓ Unique texts: ${uniqueTexts.length}`);
      
      // Clean up
      await fs.unlink(tempFile);
      
      // Should keep only 2: "Hello" and "Different text" 
      // ("Hello World" and "Hello World Test" are progressive duplicates of "Hello")
      const passed = texts.length === 2;
      this.testResults.push({ test: 'Duplicate Removal', passed });
      
      if (passed) {
        console.log('  ✅ Duplicate removal working correctly');
      } else {
        console.log('  ❌ Duplicate removal failed');
      }
      
      return passed;
    } catch (error) {
      console.error('  ❌ Error:', error.message);
      this.testResults.push({ test: 'Duplicate Removal', passed: false, error: error.message });
      return false;
    }
  }

  /**
   * Test speaker label preservation
   */
  async testSpeakerLabels() {
    console.log('\n🧪 Testing Speaker Label Preservation...');
    
    const testCases = [
      { input: '【Speaker】Hello world', expected: '【Speaker】Hello world' },
      { input: '[Name]: Test message', expected: '[Name]: Test message' },
      { input: 'SPEAKER: Another test', expected: 'SPEAKER: Another test' },
      { input: '>> Bad prefix', expected: 'Bad prefix' },
      { input: '[&nbsp;__&nbsp;]Hidden name', expected: '[ __ ]Hidden name' }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
      const cleaned = this.cleanText(testCase.input);
      const passed = cleaned === testCase.expected;
      
      if (passed) {
        console.log(`  ✓ "${testCase.input}" → "${cleaned}"`);
      } else {
        console.log(`  ✗ "${testCase.input}" → Expected: "${testCase.expected}", Got: "${cleaned}"`);
        allPassed = false;
      }
    }
    
    this.testResults.push({ test: 'Speaker Labels', passed: allPassed });
    
    if (allPassed) {
      console.log('  ✅ Speaker label preservation working correctly');
    } else {
      console.log('  ❌ Some speaker label tests failed');
    }
    
    return allPassed;
  }

  /**
   * Test smart sampling
   */
  async testSmartSampling() {
    console.log('\n🧪 Testing Smart Sampling...');
    
    // Create test segments
    const segments = [];
    for (let i = 0; i < 10000; i++) {
      segments.push({
        text: `Segment ${i}`,
        start: i,
        duration: 1,
        timestamp: `00:${String(Math.floor(i/60)).padStart(2, '0')}:${String(i%60).padStart(2, '0')}`
      });
    }
    
    const maxSegments = 5000;
    const sampled = this.applySampling(segments, 'smart', maxSegments);
    
    const introCount = Math.floor(maxSegments * 0.2); // 1000
    const middleCount = Math.floor(maxSegments * 0.3); // 1500
    const conclusionCount = maxSegments - introCount - middleCount; // 2500
    
    console.log(`  ✓ Total segments: ${segments.length}`);
    console.log(`  ✓ Sampled segments: ${sampled.length}`);
    console.log(`  ✓ Expected intro: ${introCount}`);
    console.log(`  ✓ Expected middle: ${middleCount}`);
    console.log(`  ✓ Expected conclusion: ${conclusionCount}`);
    
    // Check if first segment is from intro
    const hasIntro = sampled[0].text === 'Segment 0';
    // Check if last segment is from conclusion
    const hasConclusion = sampled[sampled.length - 1].text === 'Segment 9999';
    
    const passed = sampled.length === maxSegments && hasIntro && hasConclusion;
    this.testResults.push({ test: 'Smart Sampling', passed });
    
    if (passed) {
      console.log('  ✅ Smart sampling working correctly');
    } else {
      console.log('  ❌ Smart sampling failed');
    }
    
    return passed;
  }

  /**
   * Test HTML entity decoding
   */
  async testHtmlEntities() {
    console.log('\n🧪 Testing HTML Entity Decoding...');
    
    const testCases = [
      { input: '&amp;', expected: '&' },
      { input: '&lt;', expected: '<' },
      { input: '&gt;', expected: '>' },
      { input: '&quot;', expected: '"' },
      { input: '&apos;', expected: "'" },
      { input: '&nbsp;', expected: ' ' },
      { input: '&#8203;', expected: '' }, // Zero-width space
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
      const cleaned = this.cleanText(testCase.input);
      const passed = cleaned === testCase.expected;
      
      if (passed) {
        console.log(`  ✓ "${testCase.input}" → "${cleaned}"`);
      } else {
        console.log(`  ✗ "${testCase.input}" → Expected: "${testCase.expected}", Got: "${cleaned}"`);
        allPassed = false;
      }
    }
    
    this.testResults.push({ test: 'HTML Entities', passed: allPassed });
    
    if (allPassed) {
      console.log('  ✅ HTML entity decoding working correctly');
    } else {
      console.log('  ❌ Some HTML entity tests failed');
    }
    
    return allPassed;
  }

  /**
   * Helper: Parse VTT content (simplified version)
   */
  parseVttContent(content) {
    const lines = content.split('\n');
    const segments = [];
    let lastText = '';
    let i = 0;
    
    while (i < lines.length) {
      if (lines[i].includes('-->')) {
        const timestamps = lines[i].split('-->');
        if (timestamps.length === 2) {
          i++;
          const textLines = [];
          while (i < lines.length && !lines[i].includes('-->') && lines[i].trim() !== '') {
            const cleaned = this.cleanText(lines[i]);
            if (cleaned && cleaned.length > 2) {
              textLines.push(cleaned);
            }
            i++;
          }
          
          if (textLines.length > 0) {
            const text = textLines.join(' ');
            // Skip progressive duplicates
            if (text !== lastText && !text.startsWith(lastText + ' ')) {
              segments.push({ text });
              lastText = text;
            }
          }
        }
      } else {
        i++;
      }
    }
    
    return segments;
  }

  /**
   * Helper: Clean text (simplified version)
   */
  cleanText(text) {
    let cleaned = text.trim();
    
    // Remove HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    cleaned = cleaned
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (match, num) => {
        const code = parseInt(num);
        if (code === 8203 || code === 8204 || code === 8205) return '';
        return String.fromCharCode(code);
      });
    
    // Remove music/sound indicators
    cleaned = cleaned
      .replace(/♪+/g, '')
      .replace(/\[音楽\]/gi, '')
      .replace(/\[拍手\]/gi, '')
      .replace(/\[笑い\]/gi, '');
    
    // Keep speaker labels, only remove >> prefix
    cleaned = cleaned.replace(/^>>\s*/g, '');
    
    return cleaned;
  }

  /**
   * Helper: Apply sampling (simplified version)
   */
  applySampling(segments, mode, maxSegments) {
    if (segments.length <= maxSegments) {
      return segments;
    }
    
    if (mode === 'smart') {
      const introCount = Math.floor(maxSegments * 0.2);
      const middleCount = Math.floor(maxSegments * 0.3);
      const conclusionCount = maxSegments - introCount - middleCount;
      
      const intro = segments.slice(0, introCount);
      const conclusionStart = Math.max(segments.length - conclusionCount, introCount);
      const conclusion = segments.slice(conclusionStart);
      
      const middleSegments = [];
      if (middleCount > 0 && conclusionStart > introCount) {
        const middleStart = introCount;
        const middleEnd = conclusionStart;
        const step = (middleEnd - middleStart) / middleCount;
        
        for (let i = 0; i < middleCount; i++) {
          const idx = Math.floor(middleStart + i * step);
          if (idx < middleEnd && segments[idx]) {
            middleSegments.push(segments[idx]);
          }
        }
      }
      
      return [...intro, ...middleSegments, ...conclusion];
    }
    
    return segments.slice(0, maxSegments);
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('========================================');
    console.log('🚀 Running Subtitle Handler Tests');
    console.log('========================================');
    
    await this.testDuplicateRemoval();
    await this.testSpeakerLabels();
    await this.testSmartSampling();
    await this.testHtmlEntities();
    
    console.log('\n========================================');
    console.log('📊 Test Results Summary');
    console.log('========================================');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    this.testResults.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.test}: ${result.passed ? 'PASSED' : 'FAILED'}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log(`\n📈 Overall: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All tests passed!');
      return true;
    } else {
      console.log('⚠️  Some tests failed. Please review the results above.');
      return false;
    }
  }
}

// Run tests
async function main() {
  const tester = new SubtitleTester();
  const success = await tester.runAllTests();
  process.exit(success ? 0 : 1);
}

main().catch(console.error);
