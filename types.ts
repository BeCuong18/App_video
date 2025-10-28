export type VideoType = 'story' | 'live';

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