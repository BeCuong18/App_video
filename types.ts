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
  aspectRatio: '16:9' | '9:16';
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
  }
  
export interface TrackedFile {
  name: string;
  jobs: VideoJob[];
}
