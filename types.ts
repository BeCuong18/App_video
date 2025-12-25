
export type MvGenre = 'narrative' | 'cinematic-short-film' | 'performance' | 'dance-choreography' | 'lyrical' | 'conceptual' | 'abstract-visualizer' | 'scenic' | 'animation' | 'one-take' | 'surreal' | 'sci-fi' | 'horror' | 'historical-period' | 'retro-futurism' | 'social-commentary' | 'documentary';
export type VideoType = 'story' | 'in2v';
export type ActiveTab = 'generator' | 'tracker' | 'api-manager';
export type JobStatus = 'Pending' | 'Processing' | 'Generating' | 'Completed' | 'Failed';

export interface ScenePrompt {
  scene_number: number;
  scene_title: string;
  prompt_text: string;
}

export type Scene = ScenePrompt;

export interface UploadedImage {
  base64: string;
  mimeType: string;
  name: string;
}

export interface FormData {
  idea: string;
  in2vAtmosphere: string;
  uploadedImages: (UploadedImage | null)[];
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
  path?: string;
  targetDurationSeconds?: number;
}

export interface ApiKey {
  id: string;
  name: string;
  value: string;
}

export interface Preset {
    id: string;
    name: string;
    settings: Partial<FormData>;
}

export interface AppConfig {
  machineId?: string;
  licenseKey?: string;
  apiKeysEncrypted?: string;
  activeApiKeyId?: string;
  presets?: Preset[];
}

export interface DailyStats {
    date: string;
    count: number;
}

export interface StatsData {
    machineId: string;
    history: DailyStats[];
    total: number;
    promptCount: number;
    modelUsage: {
        [apiKeyId: string]: {
            [modelName: string]: number;
        }
    };
    totalCredits: number;
}
