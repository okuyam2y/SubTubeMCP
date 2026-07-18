#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const NC = '\x1b[0m';

console.log(`${YELLOW}========================================${NC}`);
console.log(`${YELLOW}  Comment Filtering Impact Analysis${NC}`);
console.log(`${YELLOW}========================================${NC}`);

// Test videos with different comment patterns
const testVideos = [
  { id: 'dQw4w9WgXcQ', name: 'Popular Music Video (many spam)' },
  { id: 'jNQXAC9IVRw', name: 'First YouTube Video (historical)' },
  { id: '9bZkp7q19f0', name: 'K-Pop Video (mixed languages)' },
];

async function measureVideo(videoId, videoName) {
  console.log(`\n${BLUE}Testing: ${videoName}${NC}`);
  console.log(`Video ID: ${videoId}`);
  
  try {
    // Get comments WITH filtering (default)
    const filteredResponse = execSync(`cat << EOF | npx tsx src/index.ts 2>/dev/null
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_comments",
    "arguments": {
      "videoId": "${videoId}",
      "maxResults": 100
    }
  }
}
EOF`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

    // Get comments WITHOUT filtering
    const unfilteredResponse = execSync(`cat << EOF | npx tsx src/index.ts 2>/dev/null
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_comments",
    "arguments": {
      "videoId": "${videoId}",
      "maxResults": 100,
      "noFilter": true
    }
  }
}
EOF`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

    // Parse responses
    const filtered = JSON.parse(filteredResponse);
    const unfiltered = JSON.parse(unfilteredResponse);
    
    // Extract data
    const filteredComments = filtered.content?.[0]?.text ? JSON.parse(filtered.content[0].text).comments : [];
    const unfilteredComments = unfiltered.content?.[0]?.text ? JSON.parse(unfiltered.content[0].text).comments : [];
    
    // Calculate metrics
    const originalCount = unfilteredComments.length;
    const filteredCount = filteredComments.length;
    const removedCount = originalCount - filteredCount;
    const removalRate = originalCount > 0 ? (removedCount / originalCount * 100).toFixed(1) : 0;
    
    // Calculate data size reduction
    const unfilteredSize = JSON.stringify(unfilteredComments).length;
    const filteredSize = JSON.stringify(filteredComments).length;
    const sizeReduction = unfilteredSize - filteredSize;
    const sizeReductionRate = unfilteredSize > 0 ? (sizeReduction / unfilteredSize * 100).toFixed(1) : 0;
    
    // Analyze removed content
    const removedComments = [];
    const spamPatterns = {
      urls: 0,
      bots: 0,
      excessive_emoji: 0,
      gibberish: 0,
      promotional: 0,
      repeated: 0
    };
    
    // Find what was filtered
    unfilteredComments.forEach(comment => {
      const found = filteredComments.find(c => c.id === comment.id);
      if (!found) {
        removedComments.push(comment.text);
        
        // Categorize filtered content
        if (/https?:\/\/[^\s]+/i.test(comment.text)) spamPatterns.urls++;
        if (/who.?s?\s+(watching|here|listening)\s+(in|from)?\s*20\d{2}/i.test(comment.text)) spamPatterns.bots++;
        if (/[\u{1F300}-\u{1F9FF}]{5,}/u.test(comment.text)) spamPatterns.excessive_emoji++;
        if (/^[^a-zA-Z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF]+$/.test(comment.text)) spamPatterns.gibberish++;
        if (/check\s+(my|our)\s+(channel|profile|video)/i.test(comment.text)) spamPatterns.promotional++;
        if (/^(first|second|third|\d+(?:st|nd|rd|th))!?$/i.test(comment.text)) spamPatterns.bots++;
      }
    });
    
    // Display results
    console.log(`\n${GREEN}📊 Results:${NC}`);
    console.log(`├─ Original comments: ${originalCount}`);
    console.log(`├─ After filtering: ${filteredCount}`);
    console.log(`├─ Removed: ${removedCount} (${removalRate}%)`);
    console.log(`├─ Data size: ${(unfilteredSize/1024).toFixed(1)}KB → ${(filteredSize/1024).toFixed(1)}KB`);
    console.log(`└─ Size reduction: ${(sizeReduction/1024).toFixed(1)}KB (${sizeReductionRate}%)`);
    
    if (removedCount > 0) {
      console.log(`\n${YELLOW}🔍 Filtered Content Analysis:${NC}`);
      if (spamPatterns.urls > 0) console.log(`├─ URLs/Links: ${spamPatterns.urls}`);
      if (spamPatterns.bots > 0) console.log(`├─ Bot comments: ${spamPatterns.bots}`);
      if (spamPatterns.promotional > 0) console.log(`├─ Promotional: ${spamPatterns.promotional}`);
      if (spamPatterns.excessive_emoji > 0) console.log(`├─ Excessive emojis: ${spamPatterns.excessive_emoji}`);
      if (spamPatterns.gibberish > 0) console.log(`└─ Gibberish/Noise: ${spamPatterns.gibberish}`);
      
      // Show sample of filtered comments
      console.log(`\n${YELLOW}Sample filtered comments:${NC}`);
      removedComments.slice(0, 3).forEach((text, i) => {
        const preview = text.length > 60 ? text.substring(0, 60) + '...' : text;
        console.log(`${i + 1}. "${preview}"`);
      });
    }
    
    return {
      videoId,
      videoName,
      originalCount,
      filteredCount,
      removedCount,
      removalRate: parseFloat(removalRate),
      unfilteredSize,
      filteredSize,
      sizeReduction,
      sizeReductionRate: parseFloat(sizeReductionRate)
    };
    
  } catch (error) {
    console.log(`${RED}✗ Error processing video: ${error.message}${NC}`);
    return null;
  }
}

// Run analysis
async function runAnalysis() {
  const results = [];
  
  for (const video of testVideos) {
    const result = await measureVideo(video.id, video.name);
    if (result) results.push(result);
  }
  
  // Calculate averages
  if (results.length > 0) {
    const avgRemovalRate = (results.reduce((sum, r) => sum + r.removalRate, 0) / results.length).toFixed(1);
    const avgSizeReduction = (results.reduce((sum, r) => sum + r.sizeReductionRate, 0) / results.length).toFixed(1);
    const totalOriginal = results.reduce((sum, r) => sum + r.originalCount, 0);
    const totalFiltered = results.reduce((sum, r) => sum + r.filteredCount, 0);
    const totalRemoved = results.reduce((sum, r) => sum + r.removedCount, 0);
    
    console.log(`\n${YELLOW}========================================${NC}`);
    console.log(`${GREEN}📈 Overall Statistics:${NC}`);
    console.log(`${YELLOW}========================================${NC}`);
    console.log(`Total comments analyzed: ${totalOriginal}`);
    console.log(`Total after filtering: ${totalFiltered}`);
    console.log(`Total removed: ${totalRemoved}`);
    console.log(`Average removal rate: ${avgRemovalRate}%`);
    console.log(`Average data reduction: ${avgSizeReduction}%`);
    
    // Performance impact
    console.log(`\n${GREEN}💡 Impact Summary:${NC}`);
    if (avgRemovalRate > 30) {
      console.log(`• High spam detection: ${avgRemovalRate}% of comments filtered`);
      console.log(`• Significant data reduction: ${avgSizeReduction}% less data to process`);
      console.log(`• Improved signal-to-noise ratio for content analysis`);
    } else if (avgRemovalRate > 15) {
      console.log(`• Moderate filtering: ${avgRemovalRate}% of comments removed`);
      console.log(`• Good data reduction: ${avgSizeReduction}% smaller payload`);
      console.log(`• Cleaner dataset for analysis`);
    } else {
      console.log(`• Light filtering: ${avgRemovalRate}% of comments removed`);
      console.log(`• Data reduction: ${avgSizeReduction}%`);
      console.log(`• Most content preserved`);
    }
    
    // Save results to file
    const report = {
      timestamp: new Date().toISOString(),
      videos: results,
      summary: {
        avgRemovalRate,
        avgSizeReduction,
        totalOriginal,
        totalFiltered,
        totalRemoved
      }
    };
    
    writeFileSync('filter-impact-report.json', JSON.stringify(report, null, 2));
    console.log(`\n${GREEN}✓ Full report saved to filter-impact-report.json${NC}`);
  }
}

// Check API key
if (!process.env.YOUTUBE_API_KEY) {
  console.log(`${RED}✗ YOUTUBE_API_KEY not set${NC}`);
  console.log('Please set YOUTUBE_API_KEY environment variable');
  process.exit(1);
}

runAnalysis().catch(console.error);