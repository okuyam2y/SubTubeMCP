export class Validator {
  static validateVideoId(videoId: string | undefined): string {
    if (!videoId || videoId.trim().length === 0) {
      throw new Error('Video ID cannot be empty');
    }
    
    // Extract video ID from URL if necessary
    let cleanVideoId = videoId;
    if (videoId.includes('youtube.com') || videoId.includes('youtu.be')) {
      const match = videoId.match(/(?:v=|\/)([\w-]{11})/);
      if (match) {
        cleanVideoId = match[1];
      }
    }
    
    return cleanVideoId;
  }

  static validateChannelId(channelId: string | undefined): string {
    if (!channelId || channelId.trim().length === 0) {
      throw new Error('Channel ID cannot be empty');
    }
    return channelId;
  }

  static validateMaxResults(maxResults: number | undefined, defaultValue: number, limit: number): number {
    const value = maxResults ?? defaultValue;
    return Math.min(Math.max(1, value), limit);
  }

  static validateVideoUrl(url: string): boolean {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^[\w-]+$/
    ];
    return patterns.some(pattern => pattern.test(url));
  }

  static sanitizeVideoId(videoId: string): string {
    return videoId.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  static validateLanguageCode(lang: string): boolean {
    const validLangPattern = /^[a-z]{2}(?:-[A-Z]{2})?$|^auto$|^auto-en$|^ja-auto$/;
    return validLangPattern.test(lang);
  }

  static validateSubtitleFormat(format: string): boolean {
    const validFormats = ['srt', 'vtt', 'json', 'best'];
    return validFormats.includes(format);
  }
}