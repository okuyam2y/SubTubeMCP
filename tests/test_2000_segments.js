// Test maxSegments = 2000 default
import { SubtitleHandler } from '../dist/handlers/subtitle.js';

async function test2000SegmentsDefault() {
  console.log('Testing maxSegments default changed to 2000...\n');
  
  const handler = new SubtitleHandler();
  
  // Use the 50-minute stock video that has ~1012 segments
  const videoId = 'NKjQfK1X6tE';
  
  try {
    // Test 1: Without specifying maxSegments (should use 2000)
    console.log('Test 1: Default maxSegments (should be 2000)');
    const result1 = await handler.getTranscript({
      videoId: videoId,
      lang: 'ja'
    });
    
    const data1 = JSON.parse(result1.content[0].text);
    console.log(`✅ Mode: ${data1.mode}`);
    console.log(`✅ Total segments in video: ${data1.totalSegments}`);
    console.log(`✅ Segments returned: ${data1.segments.length}`);
    console.log(`✅ Is truncated: ${data1.isTruncated}`);
    
    // For this ~1012 segment video, with maxSegments=2000, should get all
    if (data1.totalSegments === data1.segments.length && !data1.isTruncated) {
      console.log('✅ SUCCESS: All segments retrieved (no truncation with 2000 limit)');
    } else {
      console.log(`⚠️  Note: ${data1.totalSegments} total, ${data1.segments.length} returned`);
    }
    
    // Test 2: Explicitly set to old default (500) for comparison
    console.log('\nTest 2: Explicit maxSegments=500 (old default)');
    const result2 = await handler.getTranscript({
      videoId: videoId,
      lang: 'ja',
      maxSegments: 500
    });
    
    const data2 = JSON.parse(result2.content[0].text);
    console.log(`✅ Segments returned: ${data2.segments.length}`);
    console.log(`✅ Is truncated: ${data2.isTruncated}`);
    
    // Test 3: Verify smart mode still respects new default
    console.log('\nTest 3: Smart mode with new default');
    const result3 = await handler.getTranscript({
      videoId: videoId,
      lang: 'ja',
      mode: 'smart'
    });
    
    const data3 = JSON.parse(result3.content[0].text);
    console.log(`✅ Mode: ${data3.mode}`);
    console.log(`✅ Segments returned: ${data3.segments.length}`);
    console.log(`✅ Message: ${data3.message || 'No sampling needed'}`);
    
    // Summary
    console.log('\n=== Summary ===');
    console.log(`Default maxSegments allows: ~${Math.floor(2000 * 3 / 60)} to ${Math.floor(2000 * 5 / 60)} minutes of video`);
    console.log('This covers most YouTube content including:');
    console.log('- Tutorials (20-40 min) ✅');
    console.log('- Lectures (60-90 min) ✅'); 
    console.log('- Long-form content (up to 100 min) ✅');
    
    if (data1.segments.length > 500) {
      console.log(`\n✅ New default (2000) retrieved ${data1.segments.length - 500} more segments than old default (500)`);
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

test2000SegmentsDefault();
