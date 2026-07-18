import { google } from 'googleapis';
import dotenv from 'dotenv';
import { CommentFilter } from '../dist/utils/commentFilter.js';

dotenv.config();

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

// Use a canonical public sample by default; optional IDs come only from the environment.
const publicDefaultVideoIds = ['dQw4w9WgXcQ'];
const configuredVideoIds = (process.env.FILTER_TEST_VIDEO_IDS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (configuredVideoIds.some((id) => !/^[A-Za-z0-9_-]{11}$/.test(id))) {
  console.error('FILTER_TEST_VIDEO_IDS contains an invalid video ID entry.');
  process.exit(1);
}

const useConfiguredVideos = configuredVideoIds.length > 0;
const testVideos = (useConfiguredVideos ? configuredVideoIds : publicDefaultVideoIds)
  .map((id, index) => ({
    id,
    title: `${useConfiguredVideos ? 'Configured' : 'Canonical public'} sample ${index + 1}`
  }));

async function fetchComments(videoId, maxComments = 100) {
  try {
    const response = await youtube.commentThreads.list({
      part: ['snippet'],
      videoId: videoId,
      maxResults: maxComments,
      order: 'relevance',
      textFormat: 'plainText'
    });

    if (!response.data.items) {
      return [];
    }

    return response.data.items.map(item => {
      const topComment = item.snippet.topLevelComment.snippet;
      return {
        id: item.id,
        text: topComment.textDisplay || topComment.textOriginal,
        author: topComment.authorDisplayName,
        authorChannelId: topComment.authorChannelId?.value,
        likes: topComment.likeCount || 0,
        publishedAt: topComment.publishedAt,
      };
    });
  } catch (error) {
    console.error(`Error fetching comments for ${videoId}:`, error.message);
    return [];
  }
}

async function analyzeVideo(videoInfo) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Analyzing: ${videoInfo.title}`);
  console.log(`Video ID: ${videoInfo.id}`);
  console.log('='.repeat(60));

  // Fetch comments
  const comments = await fetchComments(videoInfo.id);
  
  if (comments.length === 0) {
    console.log('No comments found or comments disabled');
    return null;
  }

  // Get video author channel ID
  let videoAuthorChannelId;
  try {
    const videoResponse = await youtube.videos.list({
      part: ['snippet'],
      id: [videoInfo.id]
    });
    if (videoResponse.data.items && videoResponse.data.items.length > 0) {
      videoAuthorChannelId = videoResponse.data.items[0].snippet.channelId;
    }
  } catch (error) {
    console.log('Could not fetch video author channel ID');
  }

  const filterOptions = {
    enableFiltering: true,
    removeSpam: true,
    removeNoise: true,
    removeUnrelated: true
  };

  // Analyze each comment
  const analysis = {
    total: comments.length,
    filtered: 0,
    kept: 0,
    byCategory: {
      spam: 0,
      noise: 0,
      bot: 0,
      legitimate: 0
    },
    samples: {
      filtered: [],
      kept: []
    }
  };

  comments.forEach(comment => {
    const shouldFilter = CommentFilter.shouldFilterComment(comment, filterOptions, videoAuthorChannelId);
    
    if (shouldFilter) {
      analysis.filtered++;
      
      // Categorize filtered comments
      const text = comment.text.toLowerCase();
      if (text.match(/https?:\/\/|bit\.ly|tinyurl/)) {
        analysis.byCategory.spam++;
      } else if (text.match(/who.*watching.*202\d|first!|like if/i)) {
        analysis.byCategory.bot++;
      } else {
        analysis.byCategory.noise++;
      }
      
      // Store samples
      if (analysis.samples.filtered.length < 3) {
        analysis.samples.filtered.push({
          text: comment.text.substring(0, 100) + (comment.text.length > 100 ? '...' : ''),
          likes: comment.likes
        });
      }
    } else {
      analysis.kept++;
      analysis.byCategory.legitimate++;
      
      // Store samples of kept comments
      if (analysis.samples.kept.length < 3) {
        analysis.samples.kept.push({
          text: comment.text.substring(0, 100) + (comment.text.length > 100 ? '...' : ''),
          likes: comment.likes
        });
      }
    }
  });

  // Calculate percentages
  analysis.filterRate = ((analysis.filtered / analysis.total) * 100).toFixed(1);
  analysis.keepRate = ((analysis.kept / analysis.total) * 100).toFixed(1);

  // Display results
  console.log('\n📊 Filtering Statistics:');
  console.log(`Total comments analyzed: ${analysis.total}`);
  console.log(`Comments filtered: ${analysis.filtered} (${analysis.filterRate}%)`);
  console.log(`Comments kept: ${analysis.kept} (${analysis.keepRate}%)`);
  
  console.log('\n📈 Filtered by category:');
  console.log(`  Spam/Promotional: ${analysis.byCategory.spam}`);
  console.log(`  Bot patterns: ${analysis.byCategory.bot}`);
  console.log(`  Noise/Gibberish: ${analysis.byCategory.noise}`);
  
  console.log('\n❌ Sample filtered comments:');
  analysis.samples.filtered.forEach((sample, i) => {
    console.log(`  ${i + 1}. "${sample.text}" (${sample.likes} likes)`);
  });
  
  console.log('\n✅ Sample kept comments:');
  analysis.samples.kept.forEach((sample, i) => {
    console.log(`  ${i + 1}. "${sample.text}" (${sample.likes} likes)`);
  });

  return analysis;
}

async function main() {
  console.log('YouTube Comment Filter Impact Analysis');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const video of testVideos) {
    const analysis = await analyzeVideo(video);
    if (analysis) {
      results.push({
        video: video.title,
        ...analysis
      });
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Overall summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 OVERALL SUMMARY');
  console.log('='.repeat(60));
  
  const totalComments = results.reduce((sum, r) => sum + r.total, 0);
  const totalFiltered = results.reduce((sum, r) => sum + r.filtered, 0);
  const totalKept = results.reduce((sum, r) => sum + r.kept, 0);
  
  console.log(`Total comments analyzed: ${totalComments}`);
  console.log(`Total filtered: ${totalFiltered} (${(totalFiltered/totalComments*100).toFixed(1)}%)`);
  console.log(`Total kept: ${totalKept} (${(totalKept/totalComments*100).toFixed(1)}%)`);
  
  console.log('\n📈 Filter rates by video:');
  results.forEach(r => {
    console.log(`  ${r.video}: ${r.filterRate}% filtered`);
  });
  
  console.log('\n✨ Filter is working appropriately if:');
  console.log('  - Technical videos have lower filter rates (10-30%)');
  console.log('  - Popular/music videos have higher filter rates (30-60%)');
  console.log('  - Legitimate discussions are preserved');
  console.log('  - Spam and bot comments are removed');
}

main().catch(console.error);
