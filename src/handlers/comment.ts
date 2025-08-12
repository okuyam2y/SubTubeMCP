import { CommentsArgs } from '../types/index.js';
import { log } from '../utils/logger.js';
import { Validator } from '../utils/validation.js';
import { createJsonResponse, createErrorResponse } from '../utils/helpers.js';

export class CommentHandler {
  private youtube: any;

  constructor(youtube: any) {
    this.youtube = youtube;
  }

  async getComments(args: CommentsArgs) {
    const { videoId, maxResults = 20, sortBy = 'relevance', lang, pageToken, fetchAll = false } = args;
    
    const cleanVideoId = Validator.validateVideoId(videoId);
    const limitedMaxResults = Validator.validateMaxResults(maxResults, 20, 100);
    
    this.checkYouTubeAPI();

    try {
      // If fetchAll is true, recursively fetch all pages
      if (fetchAll) {
        log('DEBUG', `Fetching ALL comments for video ${cleanVideoId}`);
        return await this.fetchAllComments(cleanVideoId, sortBy, lang);
      }
      
      log('DEBUG', `Fetching comments for video ${cleanVideoId}, max: ${limitedMaxResults}, sort: ${sortBy}`);
      
      // Fetch comments using YouTube Data API
      const params: any = {
        part: ['snippet', 'replies'],
        videoId: cleanVideoId,
        maxResults: limitedMaxResults,
        order: sortBy === 'new' ? 'time' : 'relevance',
        textFormat: 'plainText'
      };
      
      if (pageToken) {
        params.pageToken = pageToken;
      }
      
      const response = await this.youtube.commentThreads.list(params);
      
      if (!response.data.items || response.data.items.length === 0) {
        return createJsonResponse({
          videoId: cleanVideoId,
          commentCount: 0,
          comments: [],
          message: 'No comments found or comments are disabled for this video'
        });
      }
      
      // Process comments
      let comments = response.data.items.map((item: any) => {
        const topComment = item.snippet.topLevelComment.snippet;
        const comment: any = {
          id: item.id,
          text: topComment.textDisplay || topComment.textOriginal,
          author: topComment.authorDisplayName,
          authorChannelId: topComment.authorChannelId?.value,
          authorProfileImage: topComment.authorProfileImageUrl,
          likes: topComment.likeCount || 0,
          publishedAt: topComment.publishedAt,
          updatedAt: topComment.updatedAt,
          replyCount: item.snippet.totalReplyCount || 0,
          replies: []
        };
        
        // Add replies if available
        if (item.replies?.comments) {
          comment.replies = item.replies.comments.slice(0, 5).map((reply: any) => ({
            id: reply.id,
            text: reply.snippet.textDisplay || reply.snippet.textOriginal,
            author: reply.snippet.authorDisplayName,
            authorChannelId: reply.snippet.authorChannelId?.value,
            authorProfileImage: reply.snippet.authorProfileImageUrl,
            likes: reply.snippet.likeCount || 0,
            publishedAt: reply.snippet.publishedAt,
            parentId: reply.snippet.parentId
          }));
        }
        
        return comment;
      });
      
      // Filter by language if specified
      if (lang) {
        const langPatterns: { [key: string]: RegExp } = {
          'ja': /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/,  // Japanese
          'ko': /[\uAC00-\uD7AF]/,  // Korean
          'zh': /[\u4E00-\u9FFF]/,  // Chinese
          'ar': /[\u0600-\u06FF]/,  // Arabic
          'ru': /[\u0400-\u04FF]/,  // Cyrillic
          'th': /[\u0E00-\u0E7F]/,  // Thai
          'en': /^[A-Za-z\s\d\W]+$/  // English (mostly ASCII)
        };
        
        if (langPatterns[lang]) {
          comments = comments.filter((comment: any) => 
            langPatterns[lang].test(comment.text)
          );
        }
      }
      
      const result = {
        videoId: cleanVideoId,
        totalResults: response.data.pageInfo?.totalResults || comments.length,
        fetchedCount: comments.length,
        sortBy: sortBy,
        language: lang || 'all',
        nextPageToken: response.data.nextPageToken,
        prevPageToken: response.data.prevPageToken,
        hasMore: !!response.data.nextPageToken,
        comments: comments
      };
      
      log('DEBUG', `Successfully fetched ${comments.length} comments`);
      return createJsonResponse(result);
    } catch (error: any) {
      if (error.code === 403) {
        if (error.message.includes('commentsDisabled')) {
          return createErrorResponse('Comments are disabled for this video', { videoId: cleanVideoId });
        }
        throw new Error('YouTube API quota exceeded or API key invalid');
      }
      throw new Error(`Failed to get comments: ${error.message}`);
    }
  }

  private async fetchAllComments(videoId: string, sortBy: string = 'relevance', lang?: string) {
    const allComments = [];
    let nextPageToken = undefined;
    let pageCount = 0;
    const maxPages = 10; // Limit to prevent quota exhaustion
    const maxCommentsPerPage = 100; // YouTube API maximum
    
    try {
      do {
        pageCount++;
        log('DEBUG', `Fetching page ${pageCount} of comments...`);
        
        const params: any = {
          part: ['snippet', 'replies'],
          videoId: videoId,
          maxResults: maxCommentsPerPage,
          order: sortBy === 'new' ? 'time' : 'relevance',
          textFormat: 'plainText'
        };
        
        if (nextPageToken) {
          params.pageToken = nextPageToken;
        }
        
        const response = await this.youtube.commentThreads.list(params);
        
        if (!response.data.items || response.data.items.length === 0) {
          break;
        }
        
        // Process comments
        const comments = response.data.items.map((item: any) => {
          const topComment = item.snippet.topLevelComment.snippet;
          const comment: any = {
            id: item.id,
            text: topComment.textDisplay || topComment.textOriginal,
            author: topComment.authorDisplayName,
            authorChannelId: topComment.authorChannelId?.value,
            authorProfileImage: topComment.authorProfileImageUrl,
            likes: topComment.likeCount || 0,
            publishedAt: topComment.publishedAt,
            updatedAt: topComment.updatedAt,
            replyCount: item.snippet.totalReplyCount || 0,
            replies: []
          };
          
          // Add ALL replies if available (not just first 5)
          if (item.replies?.comments) {
            comment.replies = item.replies.comments.map((reply: any) => ({
              id: reply.id,
              text: reply.snippet.textDisplay || reply.snippet.textOriginal,
              author: reply.snippet.authorDisplayName,
              authorChannelId: reply.snippet.authorChannelId?.value,
              authorProfileImage: reply.snippet.authorProfileImageUrl,
              likes: reply.snippet.likeCount || 0,
              publishedAt: reply.snippet.publishedAt,
              parentId: reply.snippet.parentId
            }));
            
            // Note: For threads with > 5 replies, need to fetch separately
            if (comment.replyCount > comment.replies.length) {
              comment.hasMoreReplies = true;
              comment.repliesFetched = comment.replies.length;
            }
          }
          
          return comment;
        });
        
        // Filter by language if specified
        let filteredComments = comments;
        if (lang) {
          const langPatterns: { [key: string]: RegExp } = {
            'ja': /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/,
            'ko': /[\uAC00-\uD7AF]/,
            'zh': /[\u4E00-\u9FFF]/,
            'ar': /[\u0600-\u06FF]/,
            'ru': /[\u0400-\u04FF]/,
            'th': /[\u0E00-\u0E7F]/,
            'en': /^[A-Za-z\s\d\W]+$/
          };
          
          if (langPatterns[lang]) {
            filteredComments = comments.filter((comment: any) => 
              langPatterns[lang].test(comment.text)
            );
          }
        }
        
        allComments.push(...filteredComments);
        nextPageToken = response.data.nextPageToken;
        
        // Safety check to prevent infinite loops or quota exhaustion
        if (pageCount >= maxPages) {
          log('WARN', `Reached maximum page limit (${maxPages}). Total comments so far: ${allComments.length}`);
          break;
        }
        
      } while (nextPageToken);
      
      const result = {
        videoId: videoId,
        totalResults: allComments.length,
        fetchedCount: allComments.length,
        sortBy: sortBy,
        language: lang || 'all',
        pagesProcessed: pageCount,
        comments: allComments,
        message: pageCount >= maxPages 
          ? `Fetched ${allComments.length} comments (limited to ${maxPages} pages to prevent quota exhaustion)` 
          : `Fetched all ${allComments.length} comments from ${pageCount} pages`
      };
      
      log('DEBUG', `Successfully fetched ${allComments.length} comments across ${pageCount} pages`);
      return createJsonResponse(result);
      
    } catch (error: any) {
      if (error.code === 403) {
        if (error.message.includes('commentsDisabled')) {
          return createErrorResponse('Comments are disabled for this video', { videoId });
        }
        throw new Error('YouTube API quota exceeded or API key invalid');
      }
      throw new Error(`Failed to fetch all comments: ${error.message}`);
    }
  }
  
  private checkYouTubeAPI() {
    if (!this.youtube) {
      throw new Error('YouTube API key not set. Please set YOUTUBE_API_KEY environment variable.');
    }
  }
}