// src/services/AudioPlayerService.js
// Mirrors AudioPlayerService.cs — handles per-guild audio playback using
// @discordjs/voice instead of Discord.Net's raw PCM pipeline.
//
// Key differences from the C# version:
//   - We use @discordjs/voice's AudioPlayer + createAudioResource() instead of
//     piping raw PCM through FFmpeg manually.  play-dl returns an Opus/WebM stream
//     which @discordjs/voice can natively transcode via the built-in FFmpeg child
//     process, giving us the same reconnect behaviour with less boilerplate.
//   - "Pause" is a first-class operation on AudioPlayer (player.pause()), so the
//     C# workaround of cancelling the CTS and keeping the song in queue is no
//     longer necessary.  We keep the same external API (pause/unpause) so the
//     command handlers are identical in shape.
//   - AbortController replaces CancellationTokenSource.

import {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
} from '@discordjs/voice';
import { StreamType } from '@discordjs/voice';

export class AudioPlayerService {
  /**
   * @param {import('./GuildQueueService.js').GuildQueueService} queues
   * @param {import('./YoutubeService.js').YoutubeService} youtube
   * @param {import('../data/SongHistoryRepository.js').SongHistoryRepository} songHistory
   */
  constructor(queues, youtube, songHistory) {
    this.queues = queues;
    this.youtube = youtube;
    this.songHistory = songHistory;
  }

  /**
   * Starts playing the first song in the guild's queue.
   * Mirrors AudioPlayerService.PlayNextAsync().
   *
   * @param {string} guildId
   */
  async playNext(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue) return;

    if (queue.songs.length === 0) {
      queue.playing = false;
      return;
    }

    const song = queue.songs[0];
    console.log(`[Audio] Now playing: ${song.title}`);

    // Stop whatever is currently playing
    queue.audioPlayer?.stop(true);

    const player = queue.audioPlayer ?? createAudioPlayer();
    queue.audioPlayer = player;
    queue.playing = true;

    // AbortController mirrors CancellationTokenSource
    const ac = new AbortController();
    queue.abortController = ac;

    // Wire the player to the voice connection (idempotent)
    queue.connection?.subscribe(player);

    // Record the play
    await this.songHistory.addSongPlay(song).catch(() => {});

    // One-shot listener: when the player goes idle (song finished or stopped),
    // advance the queue — unless this song was explicitly stopped/skipped
    // (which sets queue.abortController to null before stopping).
    const onIdle = async () => {
      player.removeListener(AudioPlayerStatus.Idle, onIdle);

      // If aborted (skip/pause/disconnect), don't auto-advance
      if (ac.signal.aborted) return;

      if (!queue.loop && queue.songs.length > 0) {
        queue.songs.shift();
      }

      await this.playNext(guildId);
    };

    player.on(AudioPlayerStatus.Idle, onIdle);

    try {
      const source = await this.youtube.getAudioStream(song.url);
      const resource = createAudioResource(source.stream, {
        inputType: source.type,
      });
      player.play(resource);
    } catch (err) {
      console.error(`[Audio] Stream error for guild ${guildId}:`, err);
      // Remove the broken song and try the next one
      if (!queue.loop && queue.songs.length > 0) queue.songs.shift();
      player.removeListener(AudioPlayerStatus.Idle, onIdle);
      await this.playNext(guildId);
    }
  }

  /**
   * Skips the current song.
   * Mirrors AudioPlayerService.Skip().
   *
   * @param {string} guildId
   */
  skip(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue) return;

    // Remove the current song, mark abort so the Idle handler doesn't also shift
    if (queue.songs.length > 0) queue.songs.shift();
    if (queue.abortController) {
      queue.abortController.abort();
      queue.abortController = null;
    }

    // Stop the player; playNext is called explicitly below
    queue.audioPlayer?.stop(true);

    // Fire off the next song
    this.playNext(guildId).catch(console.error);
  }

  /**
   * Pauses playback.
   * Mirrors AudioPlayerService.Pause().
   *
   * @param {string} guildId
   */
  pause(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue) return;
    queue.audioPlayer?.pause();
    queue.playing = false;
  }

  /**
   * Resumes playback.
   * Mirrors AudioPlayerService.UnpauseAsync().
   *
   * @param {string} guildId
   */
  unpause(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue || queue.songs.length === 0) return;

    // If the player is paused we can resume it directly without re-fetching the stream
    if (queue.audioPlayer?.state.status === AudioPlayerStatus.Paused) {
      queue.audioPlayer.unpause();
      queue.playing = true;
    } else {
      // Player was stopped (e.g. old C#-style pause) — restart the song
      this.playNext(guildId).catch(console.error);
    }
  }
}
