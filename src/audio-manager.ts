// ============================================================================
// HEX DOMINION - Audio Manager
// ============================================================================

export type SfxId =
  | 'click'
  | 'confirm'
  | 'cancel'
  | 'select'
  | 'attack'
  | 'hit'
  | 'death'
  | 'build'
  | 'capture'
  | 'income'
  | 'turn-end'
  | 'victory'
  | 'defeat';

export type MusicId = 'menu' | 'battle';

interface AudioSettings {
  masterVolume: number;  // 0-1
  musicVolume: number;   // 0-1
  sfxVolume: number;     // 0-1
  muted: boolean;
}

const AUDIO_SETTINGS_KEY = 'hex_dominion_audio_settings';

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  muted: false,
};

// Audio file paths
// Many sounds share the same file for now - can be replaced with unique sounds later
const SFX_PATHS: Record<SfxId, string | null> = {
  'click': 'audio/sfx/click.mp3',
  'confirm': 'audio/sfx/click.mp3',
  'cancel': 'audio/sfx/click.mp3',
  'select': 'audio/sfx/click.mp3',
  'attack': 'audio/sfx/click.mp3',
  'hit': 'audio/sfx/hit.mp3',
  'death': 'audio/sfx/death.mp3',
  'build': 'audio/sfx/build.mp3',
  'capture': 'audio/sfx/capture.mp3',
  'income': 'audio/sfx/click.mp3',
  'turn-end': 'audio/sfx/click.mp3',
  'victory': 'audio/sfx/victory.mp3',
  'defeat': null,  // No sound for now
};

const MUSIC_PATHS: Record<MusicId, string> = {
  'menu': 'audio/music/battle.mp3',
  'battle': 'audio/music/battle.mp3',
};

class AudioManager {
  private audioContext: AudioContext | null = null;
  private settings: AudioSettings;
  private sfxBuffers: Map<SfxId, AudioBuffer> = new Map();
  private musicBuffers: Map<MusicId, AudioBuffer> = new Map();
  private currentMusicSource: AudioBufferSourceNode | null = null;
  private currentMusicGain: GainNode | null = null;
  private currentMusicId: MusicId | null = null;
  private musicStartTime: number = 0;
  private musicPauseOffset: number = 0;
  private isInitialized = false;
  private loadingPromise: Promise<void> | null = null;

  constructor() {
    this.settings = this.loadSettings();
    this.setupVisibilityHandler();
  }

  private loadSettings(): AudioSettings {
    try {
      const saved = localStorage.getItem(AUDIO_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // Ignore parse errors
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors
    }
  }

  private setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseMusic();
      } else {
        this.resumeMusic();
      }
    });
  }

  /**
   * Initialize the audio context. Must be called after user interaction.
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this._doInit();
    await this.loadingPromise;
  }

  private async _doInit(): Promise<void> {
    try {
      this.audioContext = new AudioContext();
      await this.preloadAllAudio();
      this.isInitialized = true;
      console.log('Audio system initialized');
    } catch (error) {
      console.warn('Failed to initialize audio:', error);
    }
  }

  private async preloadAllAudio(): Promise<void> {
    if (!this.audioContext) return;

    const loadPromises: Promise<void>[] = [];

    // Load SFX - dedupe paths since multiple IDs may share the same file
    const pathToBuffer = new Map<string, Promise<AudioBuffer | null>>();
    for (const [id, path] of Object.entries(SFX_PATHS)) {
      if (path) {
        if (!pathToBuffer.has(path)) {
          pathToBuffer.set(path, this.loadAudioFile(path));
        }
        loadPromises.push(pathToBuffer.get(path)!.then(buffer => {
          if (buffer) this.sfxBuffers.set(id as SfxId, buffer);
        }));
      }
    }

    // Load Music
    for (const [id, path] of Object.entries(MUSIC_PATHS)) {
      loadPromises.push(this.loadAudioFile(path).then(buffer => {
        if (buffer) this.musicBuffers.set(id as MusicId, buffer);
      }));
    }

    await Promise.all(loadPromises);
    console.log(`Loaded ${this.sfxBuffers.size} SFX and ${this.musicBuffers.size} music tracks`);
  }

  private async loadAudioFile(path: string): Promise<AudioBuffer | null> {
    if (!this.audioContext) return null;

    try {
      const response = await fetch(path);
      if (!response.ok) {
        console.warn(`Audio file not found: ${path}`);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      return await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.warn(`Failed to load audio: ${path}`, error);
      return null;
    }
  }

  /**
   * Play a sound effect
   */
  playSfx(id: SfxId): void {
    if (!this.isInitialized || !this.audioContext || this.settings.muted) return;

    const buffer = this.sfxBuffers.get(id);
    if (!buffer) return;

    // Resume context if suspended (browsers require user gesture)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.settings.masterVolume * this.settings.sfxVolume;

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    source.start(0);
  }

  /**
   * Start playing background music (loops)
   */
  playMusic(id: MusicId): void {
    if (!this.isInitialized || !this.audioContext) return;

    // If any music is already playing, don't restart (continuous playback)
    if (this.currentMusicSource) return;

    const buffer = this.musicBuffers.get(id);
    if (!buffer) return;

    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gainNode = this.audioContext.createGain();
    const volume = this.settings.muted ? 0 : this.settings.masterVolume * this.settings.musicVolume;
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    source.start(0);

    this.currentMusicSource = source;
    this.currentMusicGain = gainNode;
    this.currentMusicId = id;
    this.musicStartTime = this.audioContext.currentTime;
    this.musicPauseOffset = 0;
  }

  /**
   * Stop current background music
   */
  stopMusic(): void {
    if (this.currentMusicSource) {
      try {
        this.currentMusicSource.stop();
      } catch {
        // Ignore if already stopped
      }
      this.currentMusicSource.disconnect();
      this.currentMusicSource = null;
    }
    if (this.currentMusicGain) {
      this.currentMusicGain.disconnect();
      this.currentMusicGain = null;
    }
    this.currentMusicId = null;
    this.musicPauseOffset = 0;
  }

  private pauseMusic(): void {
    if (!this.audioContext || !this.currentMusicSource || !this.currentMusicId) return;

    // Calculate current position in the track
    const buffer = this.musicBuffers.get(this.currentMusicId);
    if (!buffer) return;

    const elapsed = this.audioContext.currentTime - this.musicStartTime + this.musicPauseOffset;
    this.musicPauseOffset = elapsed % buffer.duration;

    // Stop the source
    try {
      this.currentMusicSource.stop();
    } catch {
      // Ignore
    }
    this.currentMusicSource.disconnect();
    this.currentMusicSource = null;
  }

  private resumeMusic(): void {
    if (!this.audioContext || this.currentMusicSource || !this.currentMusicId) return;

    const buffer = this.musicBuffers.get(this.currentMusicId);
    if (!buffer) return;

    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    if (!this.currentMusicGain) {
      this.currentMusicGain = this.audioContext.createGain();
      const volume = this.settings.muted ? 0 : this.settings.masterVolume * this.settings.musicVolume;
      this.currentMusicGain.gain.value = volume;
      this.currentMusicGain.connect(this.audioContext.destination);
    }

    source.connect(this.currentMusicGain);
    source.start(0, this.musicPauseOffset);

    this.currentMusicSource = source;
    this.musicStartTime = this.audioContext.currentTime;
  }

  // Volume controls

  setMasterVolume(value: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, value));
    this.updateMusicVolume();
    this.saveSettings();
  }

  setMusicVolume(value: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, value));
    this.updateMusicVolume();
    this.saveSettings();
  }

  setSfxVolume(value: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, value));
    this.saveSettings();
  }

  private updateMusicVolume(): void {
    if (this.currentMusicGain && this.audioContext) {
      const volume = this.settings.muted ? 0 : this.settings.masterVolume * this.settings.musicVolume;
      this.currentMusicGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
  }

  toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    this.updateMusicVolume();
    this.saveSettings();
    return this.settings.muted;
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.updateMusicVolume();
    this.saveSettings();
  }

  // Getters

  getMasterVolume(): number {
    return this.settings.masterVolume;
  }

  getMusicVolume(): number {
    return this.settings.musicVolume;
  }

  getSfxVolume(): number {
    return this.settings.sfxVolume;
  }

  isMuted(): boolean {
    return this.settings.muted;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
export const audioManager = new AudioManager();
