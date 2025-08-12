export interface VideoSearchArgs {
  query: string;
  maxResults?: number;
  order?: string;
}

export interface ChannelStatsArgs {
  channelId: string;
}

export interface TrendingVideosArgs {
  regionCode: string;
  categoryId?: string;
  maxResults?: number;
}

export interface VideoMetadataArgs {
  videoId: string;
}

export interface TranscriptArgs {
  videoId: string;
  lang?: string;
  mode?: 'full' | 'summary' | 'smart';  // smart: intro+middle+conclusion
  maxSegments?: number;
}

export interface SubtitleArgs {
  videoUrl: string;
  lang?: string;
  format?: string;
}

export interface CommentsArgs {
  videoId: string;
  maxResults?: number;
  sortBy?: string;
  lang?: string;
  pageToken?: string;
  fetchAll?: boolean;  // Fetch all comments using pagination
}

export interface ChannelVideosArgs {
  channelId: string;
  maxResults?: number;
  order?: string;
}