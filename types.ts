

export type MvGenre = 'narrative' | 'performance' | 'conceptual' | 'lyrical' | 'animation' | 'one-take' | 'scenic' | 'surreal' | 'sci-fi' | 'horror' | 'retro-futurism' | 'documentary' | 'dance-choreography' | 'abstract-visualizer' | 'social-commentary' | 'historical-period' | 'cinematic-short-film';
export type VideoType = 'story' | 'live';
export type ActiveTab = 'generator' | 'tracker';
export type JobStatus = 'Pending' | 'Processing' | 'Generating' | 'Completed' | 'Failed';


export interface ScenePrompt {
  scene_number: number;
  scene_title: string;
  prompt_text: string;
}

// The Scene type is now simplified, as video generation is handled externally.
export type Scene = ScenePrompt;

export interface UploadedImage {
  base64: string;
  mimeType: string;
}

export interface FormData {
  idea: string;
  liveAtmosphere: string;
  liveArtistImage: UploadedImage | null;
  liveArtistName: string;
  liveArtist: string;
  songMinutes: string;
  songSeconds: string;
  projectName: string;
  model: string;
  mvGenre: MvGenre;
  filmingStyle: string;
  country: string;
  musicGenre: string;
  customMusicGenre: string;
  characterConsistency: boolean;
  characterCount: number;
  temperature: number;
}

export interface VideoJob {
    id: string;
    prompt: string;
    imagePath: string;
    imagePath2: string;
    imagePath3: string;
    status: JobStatus;
    videoName: string;
    typeVideo: string;
    videoPath?: string;
  }
  
export interface TrackedFile {
  name: string;
  jobs: VideoJob[];
  path?: string; // Path to the file on disk for watching
  targetDurationSeconds?: number;
}

export interface ApiKey {
  id: string;
  name: string;
  value: string;
}

export interface AppConfig {
  machineId?: string;
  licenseKey?: string;
  apiKeysEncrypted?: string;
  activeApiKeyId?: string;
}