import { CommentFilter } from '../dist/utils/commentFilter.js';

// Simulate various types of YouTube comments
const simulatedComments = [
  // Technical/Programming comments (typically good quality)
  { category: 'Technical', text: 'Great tutorial! I had an issue with step 6.2 but figured it out.', expected: 'keep' },
  { category: 'Technical', text: 'Error: cannot find module. Anyone else getting this?', expected: 'keep' },
  { category: 'Technical', text: 'The solution is on GitHub: https://github.com/example/repo', expected: 'keep' },
  { category: 'Technical', text: 'ありがとうございます。とても助かりました！', expected: 'keep' },
  
  // Spam comments
  { category: 'Spam', text: 'Check out my channel https://youtube.com/spam for more!', expected: 'filter' },
  { category: 'Spam', text: 'Amazing! Visit bit.ly/getrich', expected: 'filter' },
  { category: 'Spam', text: 'Click here tinyurl.com/win-prize', expected: 'filter' },
  { category: 'Spam', text: 'Buy now https://spam1.com https://spam2.com https://spam3.com', expected: 'filter' },
  
  // Bot patterns
  { category: 'Bot', text: 'Who\'s watching in 2024?', expected: 'filter' },
  { category: 'Bot', text: 'First!', expected: 'filter' },
  { category: 'Bot', text: 'Like if you agree', expected: 'filter' },
  { category: 'Bot', text: 'Anyone else here from TikTok?', expected: 'filter' },
  
  // Noise
  { category: 'Noise', text: '!!!!!!!!!!!!!', expected: 'filter' },
  { category: 'Noise', text: 'asdfasdfasdf', expected: 'filter' },
  { category: 'Noise', text: '😀😀😀😀😀😀😀', expected: 'filter' },
  { category: 'Noise', text: '', expected: 'filter' },
  
  // Normal reactions (should be kept)
  { category: 'Reaction', text: '👍', expected: 'keep' },
  { category: 'Reaction', text: 'Nice!', expected: 'keep' },
  { category: 'Reaction', text: 'Thanks', expected: 'keep' },
  { category: 'Reaction', text: '❤️', expected: 'keep' },
  
  // Mixed quality comments
  { category: 'Mixed', text: 'This helped me fix my Docker issue', expected: 'keep' },
  { category: 'Mixed', text: 'Same problem here, following for updates', expected: 'keep' },
  { category: 'Mixed', text: 'Check the documentation for more info', expected: 'keep' },
  { category: 'Mixed', text: 'I explained this in my video [no URL]', expected: 'keep' },
];

function analyzeFiltering() {
  console.log('YouTube Comment Filter Analysis');
  console.log('=' .repeat(60));
  
  const filterOptions = {
    enableFiltering: true,
    removeSpam: true,
    removeNoise: true,
    removeUnrelated: true
  };
  
  const stats = {
    total: simulatedComments.length,
    correctlyFiltered: 0,
    correctlyKept: 0,
    incorrectlyFiltered: 0,
    incorrectlyKept: 0,
    byCategory: {}
  };
  
  // Analyze each comment
  simulatedComments.forEach(item => {
    const shouldFilter = CommentFilter.shouldFilterComment(
      { text: item.text },
      filterOptions
    );
    
    const result = shouldFilter ? 'filter' : 'keep';
    const correct = result === item.expected;
    
    // Update category stats
    if (!stats.byCategory[item.category]) {
      stats.byCategory[item.category] = {
        total: 0,
        filtered: 0,
        kept: 0,
        accuracy: 0
      };
    }
    
    stats.byCategory[item.category].total++;
    if (shouldFilter) {
      stats.byCategory[item.category].filtered++;
    } else {
      stats.byCategory[item.category].kept++;
    }
    
    // Update overall stats
    if (correct) {
      if (shouldFilter) {
        stats.correctlyFiltered++;
      } else {
        stats.correctlyKept++;
      }
    } else {
      if (shouldFilter) {
        stats.incorrectlyFiltered++;
        console.log(`\n⚠️  Incorrectly filtered:`);
        console.log(`   Category: ${item.category}`);
        console.log(`   Text: "${item.text}"`);
      } else {
        stats.incorrectlyKept++;
        console.log(`\n⚠️  Incorrectly kept:`);
        console.log(`   Category: ${item.category}`);
        console.log(`   Text: "${item.text}"`);
      }
    }
  });
  
  // Calculate accuracy
  const accuracy = ((stats.correctlyFiltered + stats.correctlyKept) / stats.total * 100).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 FILTERING STATISTICS');
  console.log('='.repeat(60));
  
  console.log('\n✅ Overall Performance:');
  console.log(`   Total comments: ${stats.total}`);
  console.log(`   Correctly filtered: ${stats.correctlyFiltered}`);
  console.log(`   Correctly kept: ${stats.correctlyKept}`);
  console.log(`   Incorrectly filtered: ${stats.incorrectlyFiltered}`);
  console.log(`   Incorrectly kept: ${stats.incorrectlyKept}`);
  console.log(`   Accuracy: ${accuracy}%`);
  
  console.log('\n📈 Performance by Category:');
  Object.entries(stats.byCategory).forEach(([category, data]) => {
    const filterRate = (data.filtered / data.total * 100).toFixed(1);
    console.log(`\n   ${category}:`);
    console.log(`     Total: ${data.total}`);
    console.log(`     Filtered: ${data.filtered} (${filterRate}%)`);
    console.log(`     Kept: ${data.kept}`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  
  if (accuracy >= 90) {
    console.log('✅ Excellent: Filter is working very well!');
  } else if (accuracy >= 80) {
    console.log('👍 Good: Filter is working appropriately');
  } else if (accuracy >= 70) {
    console.log('⚠️  Fair: Filter needs some adjustments');
  } else {
    console.log('❌ Poor: Filter needs significant improvements');
  }
  
  console.log('\n🎯 Expected behavior:');
  console.log('   - Technical comments: Mostly kept (low filter rate)');
  console.log('   - Spam comments: Mostly filtered (high filter rate)');
  console.log('   - Bot patterns: Mostly filtered (high filter rate)');
  console.log('   - Noise: Mostly filtered (high filter rate)');
  console.log('   - Reactions: Mostly kept (low filter rate)');
  
  // Synthetic legitimate comment fixture (never copied from user input)
  console.log('\n' + '='.repeat(60));
  console.log('SYNTHETIC LEGITIMATE COMMENT CHECK');
  console.log('='.repeat(60));
  
  const sampleLegitimateComment = {
    text: 'Could you explain how this configuration affects subtitle output?',
    authorChannelId: 'UC_SYNTHETIC_LEGITIMATE_001'
  };
  
  const shouldFilterSampleComment = CommentFilter.shouldFilterComment(
    sampleLegitimateComment,
    filterOptions
  );
  
  console.log(`Result: ${shouldFilterSampleComment ? 'FILTERED' : 'KEPT'}`);
  console.log('Expected: KEPT (synthetic legitimate technical question)');
  
  if (!shouldFilterSampleComment) {
    console.log('PASS: synthetic legitimate comment was kept');
  } else {
    console.log('FAIL: synthetic legitimate comment was filtered');
  }
}

analyzeFiltering();
