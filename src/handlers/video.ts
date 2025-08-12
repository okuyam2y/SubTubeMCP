import ytdl from 'ytdl-core';
import { VideoSearchArgs, VideoMetadataArgs, TrendingVideosArgs } from '../types/index.js';
import { log } from '../utils/logger.js';
import { Validator } from '../utils/validation.js';
import { spawnAsync, formatDuration, checkYtDlp, createJsonResponse } from '../utils/helpers.js';

export class VideoHandler {
  private youtube: any;

  constructor(youtube: any) {
    this.youtube = youtube;
  }

  async searchVideos(args: VideoSearchArgs) {
    this.checkYouTubeAPI();
    
    const { query, maxResults = 10, order = 'relevance' } = args;
    
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }
    
    const limitedMaxResults = Validator.validateMaxResults(maxResults, 10, 50);

    try {
      const response = await this.youtube.search.list({
        part: ['snippet'],
        q: query,
        maxResults: limitedMaxResults,
        order,
        type: ['video']
      });

      const videos = response.data.items?.map((item: any) => ({
        videoId: item.id?.videoId,
        title: item.snippet?.title,
        description: item.snippet?.description,
        channelTitle: item.snippet?.channelTitle,
        channelId: item.snippet?.channelId,
        publishedAt: item.snippet?.publishedAt,
        thumbnails: item.snippet?.thumbnails,
        url: `https://www.youtube.com/watch?v=${item.id?.videoId}`
      })) || [];

      return createJsonResponse({
        resultCount: videos.length,
        videos
      });
    } catch (error: any) {
      if (error.code === 403) {
        throw new Error('YouTube API quota exceeded or API key invalid');
      }
      throw new Error(`YouTube API error: ${error.message}`);
    }
  }

  async getTrendingVideos(args: TrendingVideosArgs) {
    this.checkYouTubeAPI();
    
    const { regionCode, categoryId, maxResults = 10 } = args;
    
    if (!regionCode || regionCode.length !== 2) {
      throw new Error('Invalid region code. Must be ISO 3166-1 alpha-2 country code');
    }
    
    const limitedMaxResults = Validator.validateMaxResults(maxResults, 10, 50);

    try {
      const params: any = {
        part: ['snippet', 'statistics'],
        chart: 'mostPopular',
        regionCode: regionCode.toUpperCase(),
        maxResults: limitedMaxResults
      };

      if (categoryId) {
        params.videoCategoryId = categoryId;
      }

      const response = await this.youtube.videos.list(params);

      const videos = response.data.items?.map((item: any) => ({
        videoId: item.id,
        title: item.snippet?.title,
        description: item.snippet?.description,
        channelTitle: item.snippet?.channelTitle,
        channelId: item.snippet?.channelId,
        publishedAt: item.snippet?.publishedAt,
        viewCount: parseInt(item.statistics?.viewCount || '0'),
        likeCount: parseInt(item.statistics?.likeCount || '0'),
        commentCount: parseInt(item.statistics?.commentCount || '0'),
        thumbnails: item.snippet?.thumbnails,
        url: `https://www.youtube.com/watch?v=${item.id}`
      })) || [];

      return createJsonResponse({
        region: regionCode.toUpperCase(),
        categoryId,
        resultCount: videos.length,
        videos
      });
    } catch (error: any) {
      if (error.code === 403) {
        throw new Error('YouTube API quota exceeded or API key invalid');
      }
      throw new Error(`YouTube API error: ${error.message}`);
    }
  }

  async getVideoMetadata(args: VideoMetadataArgs) {
    const { videoId } = args;
    const cleanVideoId = Validator.validateVideoId(videoId);

    // First try with yt-dlp if available
    const hasYtDlp = await checkYtDlp();
    if (hasYtDlp) {
      try {
        log('DEBUG', `Attempting to get metadata with yt-dlp for video: ${cleanVideoId}`);
        
        const sanitizedVideoId = Validator.sanitizeVideoId(cleanVideoId);
        const url = `https://www.youtube.com/watch?v=${sanitizedVideoId}`;
        
        // Use spawn for secure command execution
        const args = [
          '--dump-json',
          '--no-warnings',
          '--extractor-args', 'youtube:lang=ja',
          url
        ];
        const { stdout } = await spawnAsync('yt-dlp', args);
        const ytdlpInfo = JSON.parse(stdout);
        
        const metadata = {
          videoId: ytdlpInfo.id,
          title: ytdlpInfo.title,
          description: ytdlpInfo.description,
          lengthSeconds: ytdlpInfo.duration || 0,
          lengthFormatted: formatDuration(ytdlpInfo.duration || 0),
          keywords: ytdlpInfo.tags || [],
          channelId: ytdlpInfo.channel_id,
          channelName: ytdlpInfo.channel || ytdlpInfo.uploader,
          channelUrl: ytdlpInfo.channel_url || ytdlpInfo.uploader_url,
          uploadDate: ytdlpInfo.upload_date,
          viewCount: ytdlpInfo.view_count || 0,
          likes: ytdlpInfo.like_count || 0,
          dislikes: ytdlpInfo.dislike_count,
          commentCount: ytdlpInfo.comment_count,
          category: ytdlpInfo.categories ? ytdlpInfo.categories[0] : null,
          ageLimit: ytdlpInfo.age_limit,
          isLive: ytdlpInfo.is_live || false,
          wasLive: ytdlpInfo.was_live || false,
          thumbnails: ytdlpInfo.thumbnails || [],
          averageRating: ytdlpInfo.average_rating,
          chapters: ytdlpInfo.chapters || [],
          subtitles: ytdlpInfo.subtitles ? Object.keys(ytdlpInfo.subtitles) : [],
          automaticCaptions: ytdlpInfo.automatic_captions ? Object.keys(ytdlpInfo.automatic_captions) : [],
          availableFormats: ytdlpInfo.formats ? ytdlpInfo.formats.length : 0,
          url: ytdlpInfo.webpage_url || url
        };
        
        log('DEBUG', 'Successfully retrieved metadata with yt-dlp');
        return createJsonResponse(metadata);
      } catch (ytdlpError: any) {
        log('WARN', `yt-dlp failed, falling back to ytdl-core: ${ytdlpError.message}`);
      }
    }

    // Fallback to ytdl-core
    try {
      log('DEBUG', `Attempting to get metadata with ytdl-core for video: ${cleanVideoId}`);
      const info = await ytdl.getInfo(cleanVideoId);
      
      const metadata = {
        videoId: info.videoDetails.videoId,
        title: info.videoDetails.title,
        description: info.videoDetails.description,
        lengthSeconds: parseInt(info.videoDetails.lengthSeconds),
        lengthFormatted: formatDuration(parseInt(info.videoDetails.lengthSeconds)),
        keywords: info.videoDetails.keywords || [],
        channelId: info.videoDetails.channelId,
        channelName: info.videoDetails.author.name,
        channelUrl: info.videoDetails.author.channel_url,
        uploadDate: info.videoDetails.uploadDate,
        viewCount: parseInt(info.videoDetails.viewCount),
        likes: info.videoDetails.likes,
        category: info.videoDetails.category,
        isLiveContent: info.videoDetails.isLiveContent,
        isPrivate: info.videoDetails.isPrivate,
        isUnlisted: info.videoDetails.isUnlisted,
        thumbnails: info.videoDetails.thumbnails,
        availableQualities: [...new Set(info.formats
          .filter(f => f.qualityLabel)
          .map(f => f.qualityLabel))],
        url: info.videoDetails.video_url
      };

      return createJsonResponse(metadata);
    } catch (error: any) {
      if (error.message.includes('Video unavailable')) {
        throw new Error(`Video unavailable or private: ${cleanVideoId}`);
      }
      throw new Error(`Failed to get video metadata: ${error.message}`);
    }
  }

  private checkYouTubeAPI() {
    if (!this.youtube) {
      throw new Error('YouTube API key not set. Please set YOUTUBE_API_KEY environment variable.');
    }
  }
}