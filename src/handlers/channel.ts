import { ChannelStatsArgs, ChannelVideosArgs } from '../types/index.js';
import { log } from '../utils/logger.js';
import { Validator } from '../utils/validation.js';
import { createJsonResponse, spawnAsync, checkYtDlp } from '../utils/helpers.js';

export class ChannelHandler {
  private youtube: any;

  constructor(youtube: any) {
    this.youtube = youtube;
  }

  async getChannelStats(args: ChannelStatsArgs) {
    this.checkYouTubeAPI();
    
    const channelId = Validator.validateChannelId(args.channelId);

    try {
      const response = await this.youtube.channels.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        id: [channelId]
      });

      const channel = response.data.items?.[0];
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const stats = {
        id: channel.id,
        title: channel.snippet?.title,
        description: channel.snippet?.description,
        customUrl: channel.snippet?.customUrl,
        publishedAt: channel.snippet?.publishedAt,
        country: channel.snippet?.country,
        statistics: {
          viewCount: parseInt(channel.statistics?.viewCount || '0'),
          subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
          videoCount: parseInt(channel.statistics?.videoCount || '0'),
          hiddenSubscriberCount: channel.statistics?.hiddenSubscriberCount || false
        },
        thumbnails: channel.snippet?.thumbnails,
        uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads
      };

      return createJsonResponse(stats);
    } catch (error: any) {
      if (error.code === 403) {
        throw new Error('YouTube API quota exceeded or API key invalid');
      }
      throw new Error(`YouTube API error: ${error.message}`);
    }
  }

  async getChannelVideos(args: ChannelVideosArgs) {
    const { channelId, maxResults = 10, order = 'date' } = args;
    
    const validChannelId = Validator.validateChannelId(channelId);
    const limitedMaxResults = Validator.validateMaxResults(maxResults, 10, 50);
    
    // First, try yt-dlp for real-time data if it's available and we want latest videos
    if (order === 'date') {
      const hasYtDlp = await checkYtDlp();
      if (hasYtDlp) {
        try {
          log('DEBUG', `Attempting to fetch channel videos with yt-dlp for real-time data: ${validChannelId}`);
          
          // Construct channel URL from ID
          const channelUrl = `https://www.youtube.com/channel/${validChannelId}`;
          
          // Use yt-dlp to get latest videos directly with spawn for security
          // Add ?sort=dd to force date sorting (newest first)
          const args = [
            '--flat-playlist',
            '--extractor-args', 'youtube:lang=ja',
            '--print', '%(id)s|%(title)s|%(upload_date)s|%(duration)s|%(view_count)s',
            '--playlist-items', `1:${limitedMaxResults}`,
            `${channelUrl}/videos?sort=dd`
          ];
          const { stdout } = await spawnAsync('yt-dlp', args);
          
          if (stdout && stdout.trim()) {
            const videos = stdout.trim().split('\n').filter(Boolean).map(line => {
              const [videoId, title, uploadDate, duration, viewCount] = line.split('|');
              return {
                videoId,
                title,
                description: 'Fetched via yt-dlp (description not available in flat mode)',
                publishedAt: uploadDate ? `${uploadDate.slice(0,4)}-${uploadDate.slice(4,6)}-${uploadDate.slice(6,8)}T00:00:00Z` : new Date().toISOString(),
                duration: duration || 'Unknown',
                viewCount: parseInt(viewCount || '0'),
                likeCount: 0, // Not available in flat mode
                commentCount: 0, // Not available in flat mode
                url: `https://www.youtube.com/watch?v=${videoId}`,
                source: 'yt-dlp'
              };
            });
            
            if (videos.length > 0) {
              // Sort by date to ensure correct order (newest first)
              videos.sort((a: any, b: any) => {
                const dateA = new Date(a.publishedAt).getTime();
                const dateB = new Date(b.publishedAt).getTime();
                return dateB - dateA; // Descending order (newest first)
              });
              
              log('DEBUG', `Successfully fetched ${videos.length} videos with yt-dlp (real-time)`);
              return createJsonResponse({
                channelId: validChannelId,
                totalVideos: videos.length,
                fetchedCount: videos.length,
                sortOrder: order,
                latestVideo: videos[0],
                videos: videos,
                dataSource: 'yt-dlp (real-time, no cache delay)'
              });
            }
          }
        } catch (ytdlpError: any) {
          log('WARN', `yt-dlp failed for channel ${validChannelId}, falling back to API: ${ytdlpError.message}`);
        }
      }
    }
    
    // Fall back to YouTube API
    this.checkYouTubeAPI();

    try {
      log('DEBUG', `Fetching videos for channel ${validChannelId} using YouTube API, max: ${limitedMaxResults}, order: ${order}`);
      
      // Use search API for more up-to-date results
      const searchResponse = await this.youtube.search.list({
        part: ['snippet'],
        channelId: validChannelId,
        maxResults: limitedMaxResults,
        order: order === 'viewCount' ? 'viewCount' : order === 'rating' ? 'rating' : 'date',
        type: ['video']
      });
      
      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        return createJsonResponse({
          channelId: validChannelId,
          videoCount: 0,
          videos: [],
          message: 'No videos found for this channel'
        });
      }
      
      // Get video IDs for additional details
      const videoIds = searchResponse.data.items.map((item: any) => item.id.videoId);
      
      // Get detailed video information
      const videosResponse = await this.youtube.videos.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        id: videoIds
      });
      
      // Process and sort videos
      let videos = videosResponse.data.items.map((video: any) => ({
        videoId: video.id,
        title: video.snippet.title,
        description: video.snippet.description?.substring(0, 200) + '...',
        publishedAt: video.snippet.publishedAt,
        thumbnails: video.snippet.thumbnails,
        duration: video.contentDetails.duration,
        viewCount: parseInt(video.statistics?.viewCount || '0'),
        likeCount: parseInt(video.statistics?.likeCount || '0'),
        commentCount: parseInt(video.statistics?.commentCount || '0'),
        url: `https://www.youtube.com/watch?v=${video.id}`
      }));
      
      // Sort videos based on the order parameter
      if (order === 'date') {
        videos.sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      } else if (order === 'viewCount') {
        videos.sort((a: any, b: any) => b.viewCount - a.viewCount);
      } else if (order === 'rating') {
        videos.sort((a: any, b: any) => b.likeCount - a.likeCount);
      }
      
      const result = {
        channelId: validChannelId,
        totalVideos: searchResponse.data.pageInfo?.totalResults || videos.length,
        fetchedCount: videos.length,
        sortOrder: order,
        latestVideo: videos[0],
        videos: videos
      };
      
      log('DEBUG', `Successfully fetched ${videos.length} videos from channel`);
      return createJsonResponse(result);
    } catch (error: any) {
      if (error.code === 403) {
        throw new Error('YouTube API quota exceeded or API key invalid');
      }
      throw new Error(`Failed to get channel videos: ${error.message}`);
    }
  }

  private checkYouTubeAPI() {
    if (!this.youtube) {
      throw new Error('YouTube API key not set. Please set YOUTUBE_API_KEY environment variable.');
    }
  }
}