#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';

// Import types
import * as Types from './types/index.js';

// Import handlers
import { VideoHandler } from './handlers/video.js';
import { ChannelHandler } from './handlers/channel.js';
import { SubtitleHandler } from './handlers/subtitle.js';
import { CommentHandler } from './handlers/comment.js';

// Import utilities
import { log } from './utils/logger.js';

class YouTubeMCPServer {
  private server: Server;
  private youtube: any;
  private videoHandler: VideoHandler;
  private channelHandler: ChannelHandler;
  private subtitleHandler: SubtitleHandler;
  private commentHandler: CommentHandler;

  constructor() {
    this.server = new Server(
      {
        name: 'youtube-mcp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Initialize YouTube API if key is available
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) {
      // Validate API key format (basic check)
      if (apiKey.length < 10 || apiKey.length > 100) {
        log('WARN', 'YOUTUBE_API_KEY appears to be invalid');
      }
      this.youtube = google.youtube({
        version: 'v3',
        auth: apiKey
      });
    }

    // Initialize handlers
    this.videoHandler = new VideoHandler(this.youtube);
    this.channelHandler = new ChannelHandler(this.youtube);
    this.subtitleHandler = new SubtitleHandler();
    this.commentHandler = new CommentHandler(this.youtube);

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      log('DEBUG', 'ListTools request received');
      return {
        tools: [
          {
            name: 'search_videos',
            description: 'Search YouTube videos by query (requires YOUTUBE_API_KEY)',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                maxResults: { type: 'number', description: 'Maximum number of results (1-50, default: 10)' },
                order: { 
                  type: 'string', 
                  enum: ['date', 'rating', 'relevance', 'title', 'videoCount', 'viewCount'],
                  description: 'Order of results: date (latest first), relevance (default), viewCount (most viewed), rating (highest rated)'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'get_channel_stats',
            description: 'Get channel statistics and information (requires YOUTUBE_API_KEY)',
            inputSchema: {
              type: 'object',
              properties: {
                channelId: { type: 'string', description: 'YouTube channel ID' }
              },
              required: ['channelId']
            }
          },
          {
            name: 'get_trending_videos',
            description: 'Get trending videos by region (requires YOUTUBE_API_KEY)',
            inputSchema: {
              type: 'object',
              properties: {
                regionCode: { type: 'string', description: 'ISO 3166-1 alpha-2 country code (e.g., US, JP)' },
                categoryId: { type: 'string', description: 'Video category ID (optional)' },
                maxResults: { type: 'number', description: 'Maximum number of results (1-50, default: 10)' }
              },
              required: ['regionCode']
            }
          },
          {
            name: 'get_video_metadata',
            description: 'Get detailed video metadata using ytdl-core',
            inputSchema: {
              type: 'object',
              properties: {
                videoId: { type: 'string', description: 'YouTube video ID or URL' }
              },
              required: ['videoId']
            }
          },
          {
            name: 'get_transcript',
            description: 'Get video transcript/captions with smart sampling options',
            inputSchema: {
              type: 'object',
              properties: {
                videoId: { type: 'string', description: 'YouTube video ID or URL' },
                lang: { type: 'string', description: 'Language code (e.g., ja, en, ko, default: ja)' },
                mode: { 
                  type: 'string', 
                  enum: ['full', 'smart', 'summary'],
                  description: 'Processing mode: full (all segments, default), smart (20% intro + 30% middle + 50% conclusion), summary (10% intro + 20% middle + 70% conclusion)'
                },
                maxSegments: { type: 'number', description: 'Maximum number of segments to return (default: 5000)' }
              },
              required: ['videoId']
            }
          },
          {
            name: 'download_subtitles',
            description: 'Download subtitles using yt-dlp (requires yt-dlp installation)',
            inputSchema: {
              type: 'object',
              properties: {
                videoUrl: { type: 'string', description: 'YouTube video URL' },
                lang: { type: 'string', description: 'Language code (e.g., ja, en, auto for Japanese auto-generated, auto-en for English auto-generated)' },
                format: { 
                  type: 'string', 
                  enum: ['srt', 'vtt', 'json', 'best'],
                  description: 'Subtitle format (default: srt)'
                }
              },
              required: ['videoUrl']
            }
          },
          {
            name: 'list_available_subtitles',
            description: 'List all available subtitles for a video (requires yt-dlp)',
            inputSchema: {
              type: 'object',
              properties: {
                videoUrl: { type: 'string', description: 'YouTube video URL' }
              },
              required: ['videoUrl']
            }
          },
          {
            name: 'get_comments',
            description: 'Get comments from a YouTube video with pagination support (requires YOUTUBE_API_KEY)',
            inputSchema: {
              type: 'object',
              properties: {
                videoId: { type: 'string', description: 'YouTube video ID or URL' },
                maxResults: { type: 'number', description: 'Maximum number of comments per page (default: 20, max: 100)' },
                sortBy: { 
                  type: 'string', 
                  enum: ['relevance', 'new'],
                  description: 'Sort order for comments (default: relevance)'
                },
                lang: { type: 'string', description: 'Filter comments by language (e.g., ja, en)' },
                pageToken: { type: 'string', description: 'Page token for pagination' },
                fetchAll: { type: 'boolean', description: 'Fetch all comments using pagination (limited to 10 pages)' }
              },
              required: ['videoId']
            }
          },
          {
            name: 'get_channel_videos',
            description: 'Get latest videos from a YouTube channel (requires YOUTUBE_API_KEY)',
            inputSchema: {
              type: 'object',
              properties: {
                channelId: { type: 'string', description: 'YouTube channel ID' },
                maxResults: { type: 'number', description: 'Maximum number of videos to fetch (default: 10, max: 50)' },
                order: { 
                  type: 'string', 
                  enum: ['date', 'viewCount', 'rating'],
                  description: 'Sort order for videos (default: date for latest videos)'
                }
              },
              required: ['channelId']
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      log('DEBUG', `CallTool request received: ${name}`, args);

      try {
        // Validate input arguments are an object
        if (!args || typeof args !== 'object') {
          throw new Error('Invalid arguments: must be an object');
        }

        switch (name) {
          case 'search_videos':
            return await this.videoHandler.searchVideos(args as unknown as Types.VideoSearchArgs);
          
          case 'get_channel_stats':
            return await this.channelHandler.getChannelStats(args as unknown as Types.ChannelStatsArgs);
          
          case 'get_trending_videos':
            return await this.videoHandler.getTrendingVideos(args as unknown as Types.TrendingVideosArgs);
          
          case 'get_video_metadata':
            return await this.videoHandler.getVideoMetadata(args as unknown as Types.VideoMetadataArgs);
          
          case 'get_transcript':
            return await this.subtitleHandler.getTranscript(args as unknown as Types.TranscriptArgs);
          
          case 'download_subtitles':
            return await this.subtitleHandler.downloadSubtitles(args as unknown as Types.SubtitleArgs);
          
          case 'list_available_subtitles':
            return await this.subtitleHandler.listAvailableSubtitles(args as unknown as Types.SubtitleArgs);
          
          case 'get_comments':
            return await this.commentHandler.getComments(args as unknown as Types.CommentsArgs);
          
          case 'get_channel_videos':
            return await this.channelHandler.getChannelVideos(args as unknown as Types.ChannelVideosArgs);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        log('ERROR', `Error in tool ${name}:`, error.message, error.stack);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message || 'An unknown error occurred'}`
            }
          ]
        };
      }
    });
  }

  async run() {
    log('INFO', 'Starting YouTube MCP server...');
    log('INFO', `Log file: ${process.env.MCP_LOG_FILE || 'Not configured (use MCP_LOG_FILE env var)'}`);
    
    const transport = new StdioServerTransport();
    log('DEBUG', 'Connecting to transport...');
    
    await this.server.connect(transport);
    log('INFO', 'YouTube MCP server running on stdio');
    log('INFO', `API Key: ${process.env.YOUTUBE_API_KEY ? 'Set' : 'Not set (API features disabled)'}`);
    
    // Check yt-dlp availability
    const { checkYtDlp } = await import('./utils/helpers.js');
    const hasYtDlp = await checkYtDlp();
    log('INFO', `yt-dlp: ${hasYtDlp ? 'Installed' : 'Not installed (subtitle features disabled)'}`);
    log('INFO', 'Server initialization complete');
  }
}

const server = new YouTubeMCPServer();
server.run().catch((error) => {
  log('ERROR', 'Failed to start server:', error.message, error.stack);
  process.exit(1);
});