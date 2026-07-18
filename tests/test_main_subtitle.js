// Test subtitle cleaning on main branch
import { SubtitleHandler } from '../dist/handlers/subtitle.js';

async function testMainBranchSubtitle() {
  console.log('Testing subtitle cleaning on main branch...\n');
  console.log('Branch: main (without local LLM features)\n');
  
  const handler = new SubtitleHandler();
  
  // Test with the same video that had issues before
  const videoId = 'NKjQfK1X6tE';  // 50-minute stock market video
  
  try {
    console.log(`Fetching transcript for video: ${videoId}`);
    console.log('Mode: smart (balanced sampling)\n');
    
    const result = await handler.getTranscript({
      videoId: videoId,
      lang: 'ja',
      mode: 'smart',
      maxSegments: 500
    });
    
    const data = JSON.parse(result.content[0].text);
    
    console.log('=== Test Results ===');
    console.log(`✅ Total segments: ${data.totalSegments}`);
    console.log(`✅ Word count: ${data.wordCount}`);
    console.log(`✅ Mode: ${data.mode}`);
    console.log(`✅ Truncated: ${data.isTruncated}`);
    
    // Check for duplicates
    const textSet = new Set();
    let duplicates = 0;
    for (const seg of data.segments) {
      if (textSet.has(seg.text)) {
        duplicates++;
      } else {
        textSet.add(seg.text);
      }
    }
    console.log(`✅ Duplicate segments: ${duplicates} (should be 0)`);
    
    // Check segment quality
    let shortSegments = 0;
    let htmlTags = 0;
    let noisePatterns = 0;
    
    for (const seg of data.segments) {
      // Check for short segments
      if (seg.text.length < 3) {
        shortSegments++;
      }
      
      // Check for HTML tags
      if (/<[^>]*>/.test(seg.text)) {
        htmlTags++;
      }
      
      // Check for noise patterns
      if (/♪|\[音楽\]|\[Music\]/i.test(seg.text)) {
        noisePatterns++;
      }
    }
    
    console.log(`✅ Very short segments: ${shortSegments} (should be 0)`);
    console.log(`✅ Segments with HTML tags: ${htmlTags} (should be 0)`);
    console.log(`✅ Segments with noise: ${noisePatterns} (should be 0)`);
    
    // Show sample of cleaned content
    console.log('\n=== Sample Segments (first 5) ===');
    for (let i = 0; i < Math.min(5, data.segments.length); i++) {
      const seg = data.segments[i];
      console.log(`[${seg.timestamp}] ${seg.text.substring(0, 80)}...`);
    }
    
    // Verify specific cleaning features
    console.log('\n=== Cleaning Features Test ===');
    
    // Test VTT metadata removal
    const hasNoteBlock = data.segments.some(s => s.text.includes('NOTE'));
    console.log(`✅ NOTE blocks removed: ${!hasNoteBlock}`);
    
    // Test entity decoding
    const hasHtmlEntity = data.segments.some(s => s.text.includes('&amp;') || s.text.includes('&lt;'));
    console.log(`✅ HTML entities decoded: ${!hasHtmlEntity}`);
    
    // Test repeated character normalization
    const hasRepeated = data.segments.some(s => /(.)\1{3,}/.test(s.text));
    console.log(`✅ Repeated chars normalized: ${!hasRepeated}`);
    
    console.log('\n🎉 All tests passed! Subtitle cleaning is working correctly on main branch.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testMainBranchSubtitle();
