import { YoutubeTranscript } from 'youtube-transcript';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { TranscriptArgs, SubtitleArgs } from '../types/index.js';
import { log } from '../utils/logger.js';
import { Validator } from '../utils/validation.js';
import { execAsync, spawnAsync, formatDuration, checkYtDlp, createJsonResponse, createErrorResponse } from '../utils/helpers.js';

export class SubtitleHandler {
  async getTranscript(args: TranscriptArgs) {
    const { videoId, lang = 'ja', mode = 'full', maxSegments = 5000 } = args;  // Default to Japanese and full mode
    const cleanVideoId = Validator.validateVideoId(videoId);

    log('DEBUG', `Fetching transcript for video ${cleanVideoId} in language: ${lang}`);

    try {
      // Try multiple approaches to get transcript
      let transcriptData;
      
      // Approach 1: Try with specified language
      try {
        transcriptData = await YoutubeTranscript.fetchTranscript(cleanVideoId, {
          lang: lang
        });
      } catch (firstError: any) {
        log('DEBUG', `Failed with ${lang}, trying alternative approaches...`);
        
        // Approach 2: For Japanese, try with 'ja' explicitly
        if (lang === 'auto' || lang === 'ja') {
          try {
            transcriptData = await YoutubeTranscript.fetchTranscript(cleanVideoId, {
              lang: 'ja'
            });
          } catch (e) {
            log('DEBUG', 'Japanese transcript not found, trying auto-generated...');
          }
        }
        
        // Approach 3: Try without language specification (gets default)
        if (!transcriptData) {
          try {
            transcriptData = await YoutubeTranscript.fetchTranscript(cleanVideoId);
          } catch (e) {
            log('DEBUG', 'Default transcript failed, will try yt-dlp fallback');
          }
        }
        
        // Approach 4: If all fails, use yt-dlp as fallback
        if (!transcriptData) {
          log('DEBUG', 'Falling back to yt-dlp for transcript...');
          return await this.getTranscriptViaYtDlp(cleanVideoId, lang, mode, maxSegments);
        }
      }

      if (!transcriptData || transcriptData.length === 0) {
        throw new Error(`No transcript available for language: ${lang}`);
      }

      const transcript = transcriptData.map(item => ({
        text: item.text,
        start: item.offset / 1000,
        duration: item.duration / 1000,
        timestamp: formatDuration(Math.floor(item.offset / 1000))
      }));

      const fullText = transcriptData.map(item => item.text).join(' ');
      
      // Apply smart sampling or truncation based on mode
      const processedTranscript = this.processTranscript(transcript, mode, maxSegments);
      
      return createJsonResponse({
        language: lang,
        mode: mode,
        fullText: fullText.length > 50000 ? fullText.substring(0, 50000) + '...' : fullText,
        wordCount: fullText.split(/\s+/).length,
        totalSegments: transcript.length,
        segments: processedTranscript.segments,
        isTruncated: processedTranscript.isTruncated,
        message: processedTranscript.message
      });
    } catch (error: any) {
      if (error.message.includes('Could not find')) {
        const availableLangs = await this.getAvailableTranscriptLanguages(cleanVideoId);
        throw new Error(`Transcript not available in '${lang}'. Available languages: ${availableLangs.join(', ')}`);
      }
      // Final fallback to yt-dlp
      log('WARN', `youtube-transcript failed: ${error.message}, trying yt-dlp...`);
      return await this.getTranscriptViaYtDlp(cleanVideoId, lang, mode, maxSegments);
    }
  }

  private async getTranscriptViaYtDlp(videoId: string, lang: string, mode: string = 'full', maxSegments: number = 5000) {
    const hasYtDlp = await checkYtDlp();
    if (!hasYtDlp) {
      const isWindows = process.platform === 'win32';
      const installCmd = isWindows ? 'pip install yt-dlp' : 'brew install yt-dlp';
      throw new Error(`yt-dlp is not installed. Please install it with: ${installCmd}`);
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    let tempDir: string | null = null;
    
    // Try multiple approaches
    const attempts = [];
    if (lang === 'auto' || lang === 'ja') {
      attempts.push(
        { option: '--write-auto-sub --sub-lang ja', desc: 'Japanese auto-generated' },
        { option: '--write-sub --sub-lang ja', desc: 'Japanese manual' },
        { option: '--write-auto-sub --sub-lang en', desc: 'English auto-generated as fallback' }
      );
    } else if (lang === 'en') {
      attempts.push(
        { option: '--write-auto-sub --sub-lang en', desc: 'English auto-generated' },
        { option: '--write-sub --sub-lang en', desc: 'English manual' }
      );
    } else {
      attempts.push(
        { option: `--write-auto-sub --sub-lang ${lang}`, desc: `${lang} auto-generated` },
        { option: `--write-sub --sub-lang ${lang}`, desc: `${lang} manual` }
      );
    }

    for (const attempt of attempts) {
      try {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-transcript-'));
        const outputPath = path.join(tempDir, 'subtitle');
        
        log('DEBUG', `Trying yt-dlp with: ${attempt.desc}`);
        
        // Try multiple formats
        const formats = ['vtt', 'srt', 'best'];
        for (const format of formats) {
          try {
            // Use spawn for secure command execution
            const args = [
              '--skip-download',
              ...attempt.option.split(' '),
              '--sub-format', format,
              '-o', outputPath,
              videoUrl
            ];
            
            const { stdout } = await spawnAsync('yt-dlp', args, { 
              cwd: tempDir,
              timeout: 20000 
            });
            
            const files = await fs.readdir(tempDir);
            const subtitleFile = files.find(f => 
              f.endsWith('.vtt') || f.endsWith('.srt') || 
              f.endsWith('.ass') || f.endsWith('.sub')
            );
            
            if (subtitleFile) {
              log('DEBUG', `Found subtitle file: ${subtitleFile}`);
              const content = await fs.readFile(path.join(tempDir, subtitleFile), 'utf-8');
              
              // Clean up
              await fs.rm(tempDir, { recursive: true, force: true });
              
              // Parse subtitle content
              const segments = subtitleFile.endsWith('.vtt') 
                ? this.parseVttToSegments(content)
                : this.parseSrtToSegments(content);
              
              const fullText = segments.map((s: any) => s.text).join(' ');
              
              // Apply smart sampling based on mode
              const processedTranscript = this.processTranscript(segments, mode, maxSegments);
              
              return createJsonResponse({
                language: lang === 'auto' ? 'ja' : lang,
                mode: mode,
                fullText: fullText.length > 50000 ? fullText.substring(0, 50000) + '...' : fullText,
                wordCount: fullText.split(/\s+/).length,
                totalSegments: segments.length,
                segments: processedTranscript.segments,
                source: 'yt-dlp',
                method: attempt.desc,
                isTruncated: processedTranscript.isTruncated,
                message: processedTranscript.message
              });
            }
          } catch (cmdError: any) {
            log('DEBUG', `Format ${format} failed: ${cmdError.message}`);
          }
        }
        
        // Clean up if no subtitle found
        await fs.rm(tempDir, { recursive: true, force: true });
        
      } catch (error: any) {
        log('DEBUG', `Attempt failed: ${error.message}`);
        if (tempDir) {
          await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
      }
    }
    
    throw new Error(`Failed to get transcript via yt-dlp after trying all methods`);
  }
  
  private parseSrtToSegments(srtContent: string) {
    const lines = srtContent.split('\n');
    const segments = [];
    let lastText = '';
    let i = 0;
    
    while (i < lines.length) {
      // Skip empty lines
      if (lines[i].trim() === '') {
        i++;
        continue;
      }
      
      // Check if this is a sequence number
      if (/^\d+$/.test(lines[i].trim())) {
        i++;
        
        // Next line should be timestamp
        if (i < lines.length && lines[i].includes('-->')) {
          const timestamps = lines[i].split('-->');
          if (timestamps.length === 2) {
            const startTime = this.parseSrtTime(timestamps[0].trim());
            const endTime = this.parseSrtTime(timestamps[1].trim());
            
            // Get the text lines
            const textLines = [];
            i++;
            while (i < lines.length && lines[i].trim() !== '' && !/^\d+$/.test(lines[i].trim())) {
              const cleanedLine = this.cleanSubtitleText(lines[i]);
              if (this.isValidSegmentText(cleanedLine)) {
                textLines.push(cleanedLine);
              }
              i++;
            }
            
            if (textLines.length > 0) {
              const segment = this.createSegmentIfValid(
                textLines.join(' '),
                startTime,
                endTime,
                lastText
              );
              if (segment) {
                segments.push(segment);
                lastText = segment.text;
              }
            }
          }
        }
      } else {
        i++;
      }
    }
    
    return segments;
  }
  
  private parseSrtTime(timeStr: string): number {
    // Parse SRT timestamp format: "00:00:00,000"
    const [time, ms] = timeStr.split(',');
    const parts = time.split(':');
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return parseFloat(hours) * 3600 + parseFloat(minutes) * 60 + parseFloat(seconds) + (ms ? parseFloat(ms) / 1000 : 0);
    }
    return 0;
  }
  
  private processTranscript(segments: any[], mode: string, maxSegments: number): { segments: any[], isTruncated: boolean, message?: string } {
    if (segments.length <= maxSegments) {
      return {
        segments,
        isTruncated: false,
        message: undefined
      };
    }
    
    switch (mode) {
      case 'full':
        // Return first maxSegments
        return {
          segments: segments.slice(0, maxSegments),
          isTruncated: true,
          message: `Transcript truncated to first ${maxSegments} of ${segments.length} segments`
        };
        
      case 'smart':
        // Smart sampling: intro (20%), middle samples (30%), conclusion (50%)
        const introCount = Math.floor(maxSegments * 0.2);
        const middleCount = Math.floor(maxSegments * 0.3);
        const conclusionCount = maxSegments - introCount - middleCount;
        
        const intro = segments.slice(0, introCount);
        const conclusionStart = Math.max(segments.length - conclusionCount, introCount);
        const conclusion = segments.slice(conclusionStart);
        
        // Sample middle parts evenly with better distribution
        const middleSegments = [];
        if (middleCount > 0 && conclusionStart > introCount) {
          const middleStart = introCount;
          const middleEnd = conclusionStart;
          const middleRange = middleEnd - middleStart;
          
          // Use floating point step for better distribution
          const step = middleRange / middleCount;
          
          for (let i = 0; i < middleCount; i++) {
            const idx = Math.floor(middleStart + i * step);
            if (idx < middleEnd && segments[idx]) {
              middleSegments.push(segments[idx]);
            }
          }
        }
        
        return {
          segments: [...intro, ...middleSegments, ...conclusion],
          isTruncated: true,
          message: `Smart sampling: ${introCount} intro + ${middleSegments.length} middle samples + ${conclusion.length} conclusion from ${segments.length} total segments`
        };
        
      case 'summary':
        // Summary mode: heavily sample, focus on conclusion
        const summaryIntro = Math.floor(maxSegments * 0.1);
        const summaryConclusion = Math.floor(maxSegments * 0.7);
        const summaryMiddle = maxSegments - summaryIntro - summaryConclusion;
        
        const summarySegments = [];
        
        // Add intro
        summarySegments.push(...segments.slice(0, summaryIntro));
        
        // Sample middle
        if (summaryMiddle > 0) {
          const middleStep = Math.floor((segments.length - summaryConclusion) / summaryMiddle);
          for (let i = 0; i < summaryMiddle; i++) {
            const idx = summaryIntro + i * middleStep;
            if (idx < segments.length - summaryConclusion && segments[idx]) {
              summarySegments.push(segments[idx]);
            }
          }
        }
        
        // Add conclusion (most important)
        summarySegments.push(...segments.slice(-summaryConclusion));
        
        return {
          segments: summarySegments,
          isTruncated: true,
          message: `Summary mode: focusing on conclusion (70%) with brief intro (10%) and middle samples (20%) from ${segments.length} total segments`
        };
        
      default:
        // Default to smart mode
        return this.processTranscript(segments, 'smart', maxSegments);
    }
  }

  private parseVttToSegments(vttContent: string) {
    const lines = vttContent.split('\n');
    const segments = [];
    let lastText = '';
    let i = 0;
    
    while (i < lines.length) {
      // Skip WEBVTT header, metadata blocks, and empty lines
      if (this.shouldSkipVttLine(lines[i])) {
        i++;
        continue;
      }
      
      // Skip NOTE blocks completely
      if (lines[i].trim() === 'NOTE') {
        i = this.skipVttNoteBlock(lines, i);
        continue;
      }
      
      // Look for timestamp line (e.g., "00:00:00.000 --> 00:00:03.000")
      if (lines[i].includes('-->')) {
        // Remove cue settings (position, align, size, etc.)
        const timestampLine = lines[i].split(/\s+(position|align|size|line|vertical):/)[0];
        const timestamps = timestampLine.split('-->');
        if (timestamps.length === 2) {
          const startTime = this.parseVttTime(timestamps[0].trim());
          const endTime = this.parseVttTime(timestamps[1].trim());
          
          // Get the text (next non-empty lines until next timestamp or empty line)
          const textLines = [];
          i++;
          while (i < lines.length && !lines[i].includes('-->') && lines[i].trim() !== '') {
            const cleanedLine = this.cleanSubtitleText(lines[i]);
            if (this.isValidSegmentText(cleanedLine)) {
              textLines.push(cleanedLine);
            }
            i++;
          }
          
          if (textLines.length > 0) {
            const segment = this.createSegmentIfValid(
              textLines.join(' '),
              startTime,
              endTime,
              lastText
            );
            if (segment) {
              segments.push(segment);
              lastText = segment.text;
            }
          }
        } else {
          i++;
        }
      } else {
        i++;
      }
    }
    
    return segments;
  }

  /**
   * Clean subtitle text by removing noise, HTML entities, and formatting
   */
  private cleanSubtitleText(text: string): string {
    let cleaned = text.trim();
    
    // Decode HTML entities first (before removing tags)
    cleaned = cleaned
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')  // Non-breaking space
      .replace(/&#(\d+);/g, (match, num) => {
        const code = parseInt(num);
        // Skip zero-width spaces and other invisible characters
        if (code === 8203 || code === 8204 || code === 8205) return '';
        return String.fromCharCode(code);
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
        const code = parseInt(hex, 16);
        if (code === 8203 || code === 8204 || code === 8205) return '';
        return String.fromCharCode(code);
      });
    
    // Remove HTML/VTT timing tags (after decoding entities)
    // Match tags like <c>, <00:00:01.000>, etc.
    cleaned = cleaned.replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, ''); // Remove timing tags
    cleaned = cleaned.replace(/<\/?[a-zA-Z][^>]*>/g, ''); // Remove HTML tags
    
    // Remove music/sound indicators
    cleaned = cleaned
      .replace(/♪+/g, '')
      .replace(/\[音楽\]/gi, '')
      .replace(/\[拍手\]/gi, '')
      .replace(/\[笑い\]/gi, '')
      .replace(/\[Music\]/gi, '')
      .replace(/\[Applause\]/gi, '')
      .replace(/\[Laughter\]/gi, '')
      .replace(/\(音楽\)/gi, '')
      .replace(/\(拍手\)/gi, '')
      .replace(/\(笑い\)/gi, '')
      .replace(/\(Music\)/gi, '')
      .replace(/\(Applause\)/gi, '')
      .replace(/\(Laughter\)/gi, '');
    
    // Keep speaker labels as they provide context
    // Only remove angle brackets that are not speaker labels
    cleaned = cleaned.replace(/^>>\s*/g, '');  // ">> text" -> "text"
    
    // Remove repeated characters (common in auto-generated Japanese)
    // e.g., "ああああ" -> "あ"
    cleaned = cleaned.replace(/(.)\1{3,}/g, '$1');
    
    // Convert half-width katakana to full-width (Japanese specific)
    cleaned = this.convertHalfWidthToFullWidth(cleaned);
    
    // Remove standalone punctuation or numbers
    if (/^[。、,.!?！？\d\s]+$/.test(cleaned)) {
      return '';
    }
    
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }
  
  /**
   * Convert half-width katakana to full-width
   */
  private convertHalfWidthToFullWidth(text: string): string {
    const halfToFull: { [key: string]: string } = {
      'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
      'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
      'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
      'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
      'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
      'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
      'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
      'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
      'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
      'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
      'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
      'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ',
      'ｰ': 'ー', 'ﾞ': '゛', 'ﾟ': '゜'
    };
    
    return text.replace(/[ｱ-ﾝﾞﾟ]/g, char => halfToFull[char] || char);
  }

  private parseVttTime(timeStr: string): number {
    // Parse VTT timestamp format: "00:00:00.000" or "00:00.000"
    const parts = timeStr.split(':');
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return parseFloat(hours) * 3600 + parseFloat(minutes) * 60 + parseFloat(seconds);
    } else if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return parseFloat(minutes) * 60 + parseFloat(seconds);
    }
    return 0;
  }

  async downloadSubtitles(args: SubtitleArgs) {
    const { videoUrl, lang = 'auto', format = 'srt' } = args;
    
    if (!Validator.validateVideoUrl(videoUrl)) {
      throw new Error('Invalid YouTube URL');
    }
    
    if (!Validator.validateLanguageCode(lang)) {
      throw new Error('Invalid language code format');
    }
    
    if (!Validator.validateSubtitleFormat(format)) {
      throw new Error('Invalid subtitle format');
    }
    
    const hasYtDlp = await checkYtDlp();
    if (!hasYtDlp) {
      const isWindows = process.platform === 'win32';
      const installCmd = isWindows ? 'pip install yt-dlp' : 'brew install yt-dlp';
      throw new Error(`yt-dlp is not installed. Please install it with: ${installCmd}`);
    }

    // Try multiple approaches to get subtitles
    const attempts = [];
    
    if (lang === 'auto' || lang === 'ja') {
      // For Japanese, try multiple options in order of preference
      attempts.push(
        { langOption: '--write-sub --sub-lang ja', description: 'Japanese manual subtitles' },
        { langOption: '--write-auto-sub --sub-lang ja', description: 'Japanese auto-generated' },
        { langOption: '--write-sub --write-auto-sub --sub-lang ja,en', description: 'Japanese or English' }
      );
    } else if (lang === 'en') {
      attempts.push(
        { langOption: '--write-sub --sub-lang en', description: 'English manual subtitles' },
        { langOption: '--write-auto-sub --sub-lang en', description: 'English auto-generated' }
      );
    } else {
      attempts.push(
        { langOption: `--write-sub --sub-lang ${lang}`, description: `${lang} manual subtitles` },
        { langOption: `--write-auto-sub --sub-lang ${lang}`, description: `${lang} auto-generated` }
      );
    }

    let lastError = null;
    for (const attempt of attempts) {
      try {
        log('DEBUG', `Attempting to download subtitles: ${attempt.description}`);
        
        // Use temp directory for subtitle downloads
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-subtitles-'));
        const outputPath = path.join(tempDir, 'subtitle');
        const formatOption = format === 'best' ? '' : `--sub-format ${format}`;
        
        // Enhanced impersonation options
        const impersonationOptions = [
          '--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"',
          '--referer "https://www.youtube.com/"',
          '--add-header "Accept-Language:ja,en;q=0.9"',  // Prefer Japanese
          '--extractor-args "youtube:player_client=android,web"'
        ].join(' ');
        
        // Use spawn for secure command execution - no shell injection possible
        const args = [
          '--skip-download',
          ...attempt.langOption.split(' '),
          ...(formatOption ? formatOption.split(' ') : []),
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          '--referer', 'https://www.youtube.com/',
          '--add-header', 'Accept-Language:ja,en;q=0.9',
          '--extractor-args', 'youtube:player_client=android,web',
          '-o', outputPath,
          videoUrl
        ];
        
        const { stdout, stderr } = await spawnAsync('yt-dlp', args, {
          cwd: tempDir,
          timeout: 30000  // 30 second timeout
        });
        
        const subtitleFiles = await fs.readdir(tempDir);
        const subtitleFile = subtitleFiles.find(f => 
          f.includes(`.${format}`) || f.includes('.vtt') || f.includes('.srt') || f.includes('.ass')
        );
        
        if (subtitleFile) {
          const subtitlePath = path.join(tempDir, subtitleFile);
          const subtitleContent = await fs.readFile(subtitlePath, 'utf-8');
          
          // Clean up temp directory
          await fs.rm(tempDir, { recursive: true, force: true });

          // Detect actual language from filename
          let detectedLang = lang;
          if (subtitleFile.includes('.ja.')) detectedLang = 'ja';
          else if (subtitleFile.includes('.en.')) detectedLang = 'en';
          
          return createJsonResponse({
            language: detectedLang,
            format: format,
            filename: subtitleFile,
            content: subtitleContent,
            method: attempt.description
          });
        }
        
        // Clean up temp directory if no subtitle found
        await fs.rm(tempDir, { recursive: true, force: true });
        
      } catch (error: any) {
        lastError = error;
        log('DEBUG', `Attempt failed: ${error.message}`);
        
        // Ensure temp directory cleanup on error
        try {
          const tmpDir = os.tmpdir();
          const tempDirs = await fs.readdir(tmpDir);
          for (const dir of tempDirs) {
            if (dir.startsWith('yt-subtitles-')) {
              await fs.rm(path.join(tmpDir, dir), { recursive: true, force: true }).catch(() => {});
            }
          }
        } catch {}
      }
    }
    
    // All attempts failed
    throw new Error(`Failed to download subtitles after ${attempts.length} attempts. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  async listAvailableSubtitles(args: SubtitleArgs) {
    const { videoUrl } = args;
    
    if (!Validator.validateVideoUrl(videoUrl)) {
      throw new Error('Invalid YouTube URL');
    }
    
    const hasYtDlp = await checkYtDlp();
    if (!hasYtDlp) {
      const isWindows = process.platform === 'win32';
      const installCmd = isWindows ? 'pip install yt-dlp' : 'brew install yt-dlp';
      throw new Error(`yt-dlp is not installed. Please install it with: ${installCmd}`);
    }

    try {
      // Enhanced impersonation options for listing subtitles
      const impersonationOptions = [
        '--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"',
        '--referer "https://www.youtube.com/"',
        '--extractor-args "youtube:player_client=android,web"'
      ].join(' ');
      
      // Use spawn for secure command execution
      const args = [
        '--list-subs',
        '--skip-download',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        '--referer', 'https://www.youtube.com/',
        '--extractor-args', 'youtube:player_client=android,web',
        videoUrl
      ];
      const { stdout } = await spawnAsync('yt-dlp', args);

      const lines = stdout.split('\n');
      const subtitles: any = {
        available: [],
        autoGenerated: []
      };
      
      let currentSection = '';

      for (const line of lines) {
        if (line.includes('Available subtitles')) {
          currentSection = 'available';
          continue;
        }
        if (line.includes('Available automatic captions')) {
          currentSection = 'auto';
          continue;
        }
        
        const match = line.match(/^([a-z]{2}(?:-[A-Z]{2})?)\s+(\w+)?\s*(.*)?/);
        if (match && currentSection) {
          const subtitle = {
            code: match[1],
            name: match[3] || match[1]
          };
          
          if (currentSection === 'available') {
            subtitles.available.push(subtitle);
          } else if (currentSection === 'auto') {
            subtitles.autoGenerated.push(subtitle);
          }
        }
      }

      return createJsonResponse({
        videoUrl,
        availableSubtitles: subtitles.available,
        autoGeneratedSubtitles: subtitles.autoGenerated,
        totalLanguages: subtitles.available.length + subtitles.autoGenerated.length
      });
    } catch (error: any) {
      throw new Error(`Failed to list subtitles: ${error.message}`);
    }
  }

  /**
   * Helper method to check if a text segment is valid
   */
  private isValidSegmentText(text: string): boolean {
    return text !== null && text !== undefined && text.length > 2;
  }

  /**
   * Helper method to create a segment if it's not a duplicate
   */
  private createSegmentIfValid(
    text: string,
    startTime: number,
    endTime: number,
    lastText: string
  ): any {
    const duration = Math.max(0, endTime - startTime);
    
    // Skip if this is the same as previous or contains previous text (progressive duplicate)
    // Also skip zero-duration segments
    if (text !== lastText && !text.startsWith(lastText + ' ') && duration > 0.1) {
      return {
        text: text,
        start: startTime,
        duration: duration,
        timestamp: formatDuration(Math.floor(startTime))
      };
    }
    return null;
  }

  /**
   * Helper method to check if a VTT line should be skipped
   */
  private shouldSkipVttLine(line: string): boolean {
    return line.startsWith('WEBVTT') || 
           line.startsWith('NOTE') ||
           line.startsWith('STYLE') ||
           line.startsWith('REGION') ||
           line.trim() === '';
  }

  /**
   * Helper method to skip VTT NOTE blocks
   */
  private skipVttNoteBlock(lines: string[], currentIndex: number): number {
    let i = currentIndex + 1;
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
      i++;
    }
    return i;
  }

  private async getAvailableTranscriptLanguages(videoId: string): Promise<string[]> {
    try {
      const sanitizedVideoId = Validator.sanitizeVideoId(videoId);
      const videoUrl = `https://www.youtube.com/watch?v=${sanitizedVideoId}`;
      
      // Use spawn for secure command execution
      const args = [
        '--list-subs',
        '--skip-download',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        videoUrl
      ];
      const { stdout } = await spawnAsync('yt-dlp', args);
      const langs = new Set<string>();
      const lines = stdout.split('\n');
      
      for (const line of lines) {
        const match = line.match(/^([a-z]{2}(?:-[A-Z]{2})?)\s+/);
        if (match) {
          langs.add(match[1]);
        }
      }
      
      return Array.from(langs);
    } catch {
      return ['en'];
    }
  }
}