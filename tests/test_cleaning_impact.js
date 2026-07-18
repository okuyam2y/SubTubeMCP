// Test impact of subtitle cleaning on segment count
import { SubtitleHandler } from '../dist/handlers/subtitle.js';

async function testCleaningImpact() {
  console.log('Testing subtitle cleaning impact on segment count...\n');
  
  const handler = new SubtitleHandler();
  
  // Use the 50-minute stock market video
  const videoId = 'NKjQfK1X6tE';  // ~50 minutes
  
  try {
    console.log('Fetching transcript for 50-minute video...');
    const result = await handler.getTranscript({
      videoId: videoId,
      lang: 'ja',
      mode: 'full',
      maxSegments: 3000  // High limit to get all
    });
    
    const data = JSON.parse(result.content[0].text);
    
    console.log('=== Results with Cleaning ===');
    console.log(`Video ID: ${videoId}`);
    console.log(`Video duration: ~50 minutes`);
    console.log(`Total segments AFTER cleaning: ${data.totalSegments}`);
    console.log(`Word count: ${data.wordCount}`);
    
    // Calculate coverage
    const minutesPerSegment = 50 / data.totalSegments;
    const segmentsFor25min = Math.floor(25 / minutesPerSegment);
    const segmentsFor100min = Math.floor(100 / minutesPerSegment);
    
    console.log('\n=== Segment Density ===');
    console.log(`Average: ${minutesPerSegment.toFixed(2)} minutes per segment`);
    console.log(`Or: ${(60 / minutesPerSegment).toFixed(1)} segments per minute`);
    
    console.log('\n=== Coverage Estimates ===');
    console.log(`500 segments would cover: ~${Math.floor(500 * minutesPerSegment)} minutes`);
    console.log(`1000 segments would cover: ~${Math.floor(1000 * minutesPerSegment)} minutes`);
    console.log(`2000 segments would cover: ~${Math.floor(2000 * minutesPerSegment)} minutes`);
    
    console.log('\n=== Reverse Calculation ===');
    console.log(`25-minute video needs: ~${segmentsFor25min} segments`);
    console.log(`100-minute video needs: ~${segmentsFor100min} segments`);
    
    // Note about cleaning
    console.log('\n=== Cleaning Impact ===');
    console.log('Before cleaning (from previous tests): ~2024 segments');
    console.log(`After cleaning: ${data.totalSegments} segments`);
    console.log(`Reduction: ${Math.round((1 - data.totalSegments/2024) * 100)}%`);
    
    console.log('\n=== Conclusion ===');
    if (data.totalSegments > 1000) {
      console.log('📊 This 50-minute video has >1000 segments AFTER cleaning');
      console.log('📊 500 segments = ~25 minutes is based on CLEANED data');
      console.log('📊 2000 segments = ~100 minutes is a conservative estimate');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCleaningImpact();
