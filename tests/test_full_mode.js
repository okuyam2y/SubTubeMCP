// Test that full mode is now the default
import { SubtitleHandler } from '../dist/handlers/subtitle.js';

async function testFullModeDefault() {
  console.log('Testing default mode change to "full"...\n');
  
  const handler = new SubtitleHandler();
  
  // Short video for testing
  const videoId = 'dQw4w9WgXcQ';  // Rick Astley - Never Gonna Give You Up (3:33)
  
  try {
    // Test 1: Call without specifying mode (should use full)
    console.log('Test 1: Calling get_transcript WITHOUT mode parameter');
    const result1 = await handler.getTranscript({
      videoId: videoId,
      lang: 'en'
    });
    
    const data1 = JSON.parse(result1.content[0].text);
    console.log(`✅ Mode used: ${data1.mode}`);
    console.log(`✅ Total segments: ${data1.totalSegments}`);
    console.log(`✅ Returned segments: ${data1.segments.length}`);
    console.log(`✅ Is truncated: ${data1.isTruncated}`);
    
    // Test 2: Explicitly use smart mode for comparison
    console.log('\nTest 2: Calling get_transcript WITH mode="smart"');
    const result2 = await handler.getTranscript({
      videoId: videoId,
      lang: 'en',
      mode: 'smart'
    });
    
    const data2 = JSON.parse(result2.content[0].text);
    console.log(`✅ Mode used: ${data2.mode}`);
    console.log(`✅ Total segments: ${data2.totalSegments}`);
    console.log(`✅ Returned segments: ${data2.segments.length}`);
    console.log(`✅ Is truncated: ${data2.isTruncated}`);
    
    // Test 3: Explicitly use full mode
    console.log('\nTest 3: Calling get_transcript WITH mode="full"');
    const result3 = await handler.getTranscript({
      videoId: videoId,
      lang: 'en',
      mode: 'full'
    });
    
    const data3 = JSON.parse(result3.content[0].text);
    console.log(`✅ Mode used: ${data3.mode}`);
    console.log(`✅ Total segments: ${data3.totalSegments}`);
    console.log(`✅ Returned segments: ${data3.segments.length}`);
    console.log(`✅ Is truncated: ${data3.isTruncated}`);
    
    // Verify default is full
    console.log('\n=== Verification ===');
    if (data1.mode === 'full') {
      console.log('✅ SUCCESS: Default mode is now "full"');
    } else {
      console.log(`❌ FAILED: Default mode is "${data1.mode}" instead of "full"`);
    }
    
    // Compare segment counts
    if (data1.segments.length === data3.segments.length) {
      console.log('✅ Default behavior matches explicit "full" mode');
    } else {
      console.log('⚠️  Default behavior differs from explicit "full" mode');
    }
    
    if (data2.mode === 'smart' && data2.message && data2.message.includes('Smart sampling')) {
      console.log('✅ Smart mode still works correctly with sampling');
    }
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testFullModeDefault();
