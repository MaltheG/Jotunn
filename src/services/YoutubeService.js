// src/services/YoutubeService.js
// Mirrors YoutubeService.cs — resolves YouTube URLs/searches to Song objects.
// Uses play-dl for metadata/search, and yt-dlp for the actual audio stream
// (play-dl's stream extractor is broken against current YouTube).

import { spawn } from 'node:child_process';
import playdl from 'play-dl';
import { StreamType } from '@discordjs/voice';

// How to invoke yt-dlp. Override with e.g. YTDLP_CMD="yt-dlp" if you have the
// standalone binary on PATH; defaults to the pip module install under Python.
const YTDLP_CMD = process.env.YTDLP_CMD ?? 'python';
const YTDLP_ARGS_PREFIX = process.env.YTDLP_CMD ? [] : ['-m', 'yt_dlp'];

/**
 * @typedef {Object} Song
 * @property {string} title
 * @property {string} url
 * @property {string} id
 * @property {string} duration
 * @property {string} thumbnail
 * @property {string} guildId
 * @property {string} authorId
 * @property {number} position
 */

/** @param {import('play-dl').YouTubeVideo} video */
function formatDuration(video) {
  const secs = video.durationInSec;
  if (!secs) return 'Live';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** @param {import('play-dl').YouTubeVideo} video */
function toSong(video, guildId, authorId, position) {
  return {
    title: video.title ?? 'Unknown',
    url: video.url,
    id: video.id ?? '',
    duration: formatDuration(video),
    thumbnail: `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`,
    guildId,
    authorId,
    position,
  };
}

export class YoutubeService {
  /**
   * Resolves a query (URL or search terms) to a list of Songs.
   * Mirrors YoutubeService.ResolveAsync().
   *
   * @param {string} query
   * @param {string} guildId
   * @param {string} authorId
   * @returns {Promise<{ type: 'video' | 'playlist', songs: Song[] }>}
   */
  async resolve(query, guildId, authorId) {
    const type = playdl.yt_validate(query);

    // YouTube video URL
    if (type === 'video') {
      const info = await playdl.video_info(query);
      const video = info.video_details;
      return { type: 'video', songs: [toSong(video, guildId, authorId, 0)] };
    }

    // YouTube playlist URL
    if (type === 'playlist') {
      const playlist = await playdl.playlist_info(query, { incomplete: true });
      const videos = await playlist.all_videos();
      return {
        type: 'playlist',
        songs: videos.map((v, i) => toSong(v, guildId, authorId, i)),
      };
    }

    // Text search — take the top result
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (!results.length) {
      throw new Error('No results found for query.');
    }
    return { type: 'video', songs: [toSong(results[0], guildId, authorId, 0)] };
  }

  /**
   * Gets a streamable audio source for a video URL.
   * Spawns yt-dlp to pipe the best audio track to stdout; @discordjs/voice
   * transcodes it to Opus via the bundled ffmpeg (StreamType.Arbitrary).
   *
   * @param {string} videoUrl
   * @returns {Promise<{ stream: import('stream').Readable, type: import('@discordjs/voice').StreamType }>}
   */
  async getAudioStream(videoUrl) {
    const args = [
      ...YTDLP_ARGS_PREFIX,
      '-f', 'bestaudio',
      '-o', '-',            // stream to stdout
      '--no-playlist',
      '--quiet',
      '--no-warnings',
      videoUrl,
    ];

    const proc = spawn(YTDLP_CMD, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => proc.stdout.destroy(err));
    proc.on('close', (code) => {
      if (code !== 0 && code !== null) {
        proc.stdout.destroy(new Error(`yt-dlp exited ${code}: ${stderr.trim()}`));
      }
    });

    return { stream: proc.stdout, type: StreamType.Arbitrary };
  }
}
