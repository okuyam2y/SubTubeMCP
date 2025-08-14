export interface CommentFilterOptions {
  enableFiltering?: boolean;
  removeSpam?: boolean;
  removeNoise?: boolean;
  removeUnrelated?: boolean;
}

export class CommentFilter {
  private static readonly SPAM_PATTERNS = [
    // Suspicious short URLs anywhere in text
    /\b(?:bit\.ly|tinyurl\.com|goo\.gl|short\.link|cutt\.ly|ow\.ly|tiny\.cc)\b/gi,  // Short URL domains
    // Promotional patterns - either with URLs or specific keywords
    /(?:check\s*out|visit|click|watch|see)\s+(?:my|our)\s+(?:channel|profile|video|link)/gi,  // Self-promotion
    // Multiple URLs in one comment (likely spam)
    /(?:https?:\/\/[^\s]+.*){3,}/gi,  // 3 or more URLs
  ];

  private static readonly NOISE_PATTERNS = [
    /<[^>]+>/g,  // HTML tags
    /&lt;|&gt;|&amp;|&quot;|&#\d+;/g,  // HTML entities
    /(.)\1{5,}/g,  // Repeated characters (e.g., "!!!!!!!")
    /[\u{1F300}-\u{1F9FF}]{5,}/gu,  // Excessive emojis (5 or more in a row)
    // Removed pattern that was filtering single emojis
  ];

  private static readonly BOT_PATTERNS = [
    /who(?:'s| is)?\s+(?:watching|here|listening)\s+(?:in|from)?\s*\d{4}/gi,  // "Who's watching in 2024?"
    /^(?:first|second|third|\d+(?:st|nd|rd|th))!?$/i,  // "First!" comments
    /^(?:anyone|who)\s+(?:else\s+)?(?:here|watching|listening)/i,  // "Anyone else here?"
    /^(?:like|thumbs?\s*up)\s+if\s+you/i,  // "Like if you..."
  ];

  static shouldFilterComment(comment: any, options: CommentFilterOptions = {}, videoAuthorChannelId?: string): boolean {
    // If filtering is disabled, don't filter anything
    if (options.enableFiltering === false) {
      return false;
    }

    // Never filter comments from the video author/uploader
    if (videoAuthorChannelId && comment.authorChannelId === videoAuthorChannelId) {
      return false;
    }

    const text = comment.text || '';
    
    // Check for spam (enabled by default)
    if (options.removeSpam !== false) {
      for (const pattern of this.SPAM_PATTERNS) {
        pattern.lastIndex = 0; // Reset regex state for global patterns
        if (pattern.test(text)) {
          console.log(`[FILTER DEBUG] Comment filtered by SPAM_PATTERN: ${pattern}`);
          console.log(`[FILTER DEBUG] Text: ${text.substring(0, 100)}...`);
          return true;
        }
      }
      
      // Check for repeated comments (spam indicator)
      if (this.isRepeatedText(text)) {
        console.log(`[FILTER DEBUG] Comment filtered by repeated text`);
        console.log(`[FILTER DEBUG] Text: ${text.substring(0, 100)}...`);
        return true;
      }
    }

    // Check for noise (enabled by default)
    if (options.removeNoise !== false) {
      for (const pattern of this.NOISE_PATTERNS) {
        pattern.lastIndex = 0; // Reset regex state for global patterns
        if (pattern.test(text)) {
          return true;
        }
      }
      
      // Check for extremely short comments, but allow single emojis or characters
      const trimmedText = text.trim();
      // Allow single emoji reactions or single character responses
      if (trimmedText.length === 0) {
        console.log(`[FILTER DEBUG] Comment filtered by empty text`);
        console.log(`[FILTER DEBUG] Text: ${text}`);
        return true;
      }
      
      // Check for gibberish (random character sequences)
      if (this.isGibberish(text)) {
        console.log(`[FILTER DEBUG] Comment filtered by gibberish detection`);
        console.log(`[FILTER DEBUG] Text: ${text.substring(0, 100)}...`);
        return true;
      }
    }

    // Check for unrelated/bot comments (enabled by default)
    if (options.removeUnrelated !== false) {
      for (const pattern of this.BOT_PATTERNS) {
        pattern.lastIndex = 0; // Reset regex state for global patterns
        if (pattern.test(text)) {
          console.log(`[FILTER DEBUG] Comment filtered by BOT_PATTERN: ${pattern}`);
          console.log(`[FILTER DEBUG] Text: ${text.substring(0, 100)}...`);
          return true;
        }
      }
    }

    return false;
  }

  private static isRepeatedText(text: string): boolean {
    // Check if the same word/phrase is repeated many times
    const words = text.toLowerCase().split(/\s+/);
    if (words.length < 5) return false;
    
    const wordCounts = new Map<string, number>();
    for (const word of words) {
      if (word.length > 2) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
    
    // If any word appears more than 40% of the time, it's likely spam
    for (const count of wordCounts.values()) {
      if (count > words.length * 0.4) {
        return true;
      }
    }
    
    return false;
  }

  private static isGibberish(text: string): boolean {
    // Remove spaces and common punctuation
    const cleanText = text.replace(/[\s\.,!?;:'"]/g, '');
    
    // Skip if too short
    if (cleanText.length < 8) return false;
    
    // Skip if contains common legitimate tech terms/URLs
    const legitimatePatterns = [
      /github/i,
      /stackoverflow/i,
      /https?:\/\//i,
      /error:|warning:|fatal:/i,
      /npm|yarn|pip|docker|git/i
    ];
    
    for (const pattern of legitimatePatterns) {
      if (pattern.test(text)) {
        return false;  // Not gibberish if contains legitimate tech content
      }
    }
    
    // Check for keyboard mashing patterns
    const keyboardPatterns = [
      /^(asdf|qwer|zxcv|hjkl|yuio)+$/i,
      /^(abcd|efgh|ijkl|mnop|qrst|uvwx)+$/i,
      /^[1234567890]+$/,
    ];
    
    for (const pattern of keyboardPatterns) {
      if (pattern.test(cleanText)) {
        return true;
      }
    }
    
    // Check if entire text is keyboard mashing
    if (/^[asdfghjkl]+$/i.test(cleanText)) {
      return true;
    }
    
    // Check for too many consonants in a row (likely gibberish)
    // But exclude if it contains URLs or technical terms
    const consonantRuns = cleanText.match(/[bcdfghjklmnpqrstvwxyz]{8,}/gi);  // Increased threshold from 6 to 8
    if (consonantRuns && consonantRuns.length > 0) {
      return true;
    }
    
    return false;
  }

  static filterComments(comments: any[], options: CommentFilterOptions = {}, videoAuthorChannelId?: string): any[] {
    if (options.enableFiltering === false) {
      return comments;
    }

    return comments.filter(comment => {
      // Keep the comment if it shouldn't be filtered
      const keepComment = !this.shouldFilterComment(comment, options, videoAuthorChannelId);
      
      // Also filter replies if the comment has them
      if (keepComment && comment.replies && Array.isArray(comment.replies)) {
        comment.replies = comment.replies.filter((reply: any) => 
          !this.shouldFilterComment(reply, options, videoAuthorChannelId)
        );
      }
      
      return keepComment;
    });
  }

  static getFilterStats(comments: any[], options: CommentFilterOptions = {}, videoAuthorChannelId?: string): {
    total: number;
    filtered: number;
    kept: number;
    filterRate: string;
  } {
    const total = comments.length;
    const filtered = comments.filter(c => this.shouldFilterComment(c, options, videoAuthorChannelId)).length;
    const kept = total - filtered;
    const filterRate = total > 0 ? ((filtered / total) * 100).toFixed(1) : '0';
    
    return {
      total,
      filtered,
      kept,
      filterRate: `${filterRate}%`
    };
  }
}