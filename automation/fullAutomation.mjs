import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { config as loadEnv } from 'dotenv';
import { runFlowAutomation } from './flowAutomation.mjs';
import { storySystemPrompt, liveSystemPrompt } from './systemPrompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolveFromCwd = (maybePath, fallback) => {
  if (!maybePath) {
    return fallback;
  }
  return path.resolve(process.cwd(), maybePath);
};

const detectMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return null;
};

const ensureNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readConfig = async (configPath) => {
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Không tìm thấy file cấu hình tại ${configPath}. Hãy sao chép automation/config.sample.json thành config.json và chỉnh sửa nội dung.`);
    }
    throw new Error(`Không thể đọc file cấu hình: ${error.message}`);
  }
};

const buildUserPrompt = (config, sceneCount) => {
  let prompt = 'Generate prompts for a music video.';

  if (config.videoType === 'story') {
    if (!config.idea?.trim()) {
      throw new Error('Thiếu "idea" trong cấu hình cho video dạng cốt truyện.');
    }
    prompt += ` The core idea is: "${config.idea.trim()}".`;
  } else {
    const hasLiveInfo = Boolean(config.liveAtmosphere?.trim() || config.liveArtistName?.trim() || config.liveArtist?.trim() || config.liveArtistImagePath?.trim());
    if (!hasLiveInfo) {
      throw new Error('Vui lòng cung cấp ít nhất một trường trong số liveAtmosphere, liveArtistName, liveArtist hoặc liveArtistImagePath cho video dạng live performance.');
    }
    if (config.liveAtmosphere?.trim()) {
      prompt += ` The Stage & Atmosphere is: "${config.liveAtmosphere.trim()}".`;
    }
    if (config.liveArtistName?.trim()) {
      prompt += ` The Artist Name is: "${config.liveArtistName.trim()}".`;
    }
    if (config.liveArtist?.trim()) {
      prompt += ` The Artist & Performance Style is: "${config.liveArtist.trim()}".`;
    }
  }

  prompt += ` The video should have exactly ${sceneCount} scenes, structured with a clear visual arc. The aspect ratio will be ${config.aspectRatio}.`;
  return prompt;
};

const readInlineImage = async (imagePath) => {
  if (!imagePath) {
    return null;
  }

  const resolvedPath = resolveFromCwd(imagePath);
  const mimeType = detectMimeType(resolvedPath);
  if (!mimeType) {
    throw new Error(`Không nhận diện được định dạng ảnh hỗ trợ từ đường dẫn ${imagePath}. Hãy sử dụng PNG, JPG hoặc WEBP.`);
  }

  try {
    const buffer = await fs.readFile(resolvedPath);
    return {
      inlineData: {
        mimeType,
        data: buffer.toString('base64')
      }
    };
  } catch (error) {
    throw new Error(`Không thể đọc ảnh tại ${resolvedPath}: ${error.message}`);
  }
};

const writePromptsFile = async (outputPath, projectName, prompts) => {
  const payload = {
    projectName,
    prompts: prompts.map((item) => ({
      scene_number: item.scene_number,
      scene_title: item.scene_title,
      prompt_text: item.prompt_text
    }))
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log('💾 Đã lưu prompts tại:', outputPath);
  return payload;
};

const main = async () => {
  const [, , configArg, downloadArg] = process.argv;

  const configPath = resolveFromCwd(configArg, path.resolve(__dirname, 'config.json'));
  const cliDownloadDirectory = resolveFromCwd(downloadArg, path.resolve(process.cwd(), 'google-flow-downloads'));

  loadEnv({ path: path.resolve(process.cwd(), '.env.local') });
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY. Hãy thêm vào file .env.local hoặc biến môi trường hệ thống.');
  }

  console.log('🛠 Đang đọc cấu hình từ:', configPath);
  const config = await readConfig(configPath);
  const videoType = config.videoType === 'live' ? 'live' : 'story';
  const model = config.model || 'gemini-flash-lite-latest';
  const aspectRatio = config.aspectRatio || '16:9';
  const downloadDirectory = resolveFromCwd(config.downloadDirectory, cliDownloadDirectory);

  const minutes = ensureNumber(config.songMinutes);
  const seconds = ensureNumber(config.songSeconds);
  const totalSeconds = minutes * 60 + seconds;
  if (totalSeconds <= 0) {
    throw new Error('Thời lượng bài hát không hợp lệ. Hãy cập nhật songMinutes và songSeconds trong file cấu hình.');
  }

  let sceneCount = Math.round(totalSeconds / 7);
  if (sceneCount < 3) {
    sceneCount = 3;
  }

  const userPrompt = buildUserPrompt({ ...config, videoType, aspectRatio }, sceneCount);
  console.log(`🎬 Sẽ tạo ${sceneCount} cảnh cho dự án ${config.projectName || ''}`);
  const parts = [{ text: userPrompt }];

  if (videoType === 'live' && config.liveArtistImagePath) {
    const inlineImage = await readInlineImage(config.liveArtistImagePath);
    if (inlineImage) {
      parts.push(inlineImage);
    }
  }

  console.log('🤖 Đang gọi Gemini để sinh prompts...');
  const ai = new GoogleGenAI({ apiKey });
  const systemInstruction =
    videoType === 'story'
      ? config.storySystemPromptOverride || storySystemPrompt
      : config.liveSystemPromptOverride || liveSystemPrompt;

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prompts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                scene_number: { type: Type.INTEGER },
                scene_title: { type: Type.STRING },
                prompt_text: { type: Type.STRING }
              },
              required: ['scene_number', 'scene_title', 'prompt_text']
            }
          }
        },
        required: ['prompts']
      }
    }
  });

  let jsonText = null;
  if (typeof response.text === 'function') {
    jsonText = await response.text();
  } else if (typeof response.response?.text === 'function') {
    jsonText = await response.response.text();
  } else {
    jsonText = response.text ?? response.response?.text();
  }

  if (!jsonText) {
    throw new Error('Gemini không trả về nội dung nào.');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Không thể parse JSON từ Gemini: ${error.message}`);
  }

  if (!Array.isArray(parsed.prompts)) {
    throw new Error('Gemini trả về dữ liệu không hợp lệ (thiếu mảng prompts).');
  }

  const projectName = config.projectName?.trim() || 'Prompt Project';
  const prompts = parsed.prompts;

  const outputPath = resolveFromCwd(config.promptsOutputPath, path.resolve(__dirname, 'latest-prompts.json'));
  const payload = await writePromptsFile(outputPath, projectName, prompts);

  const batchSize = ensureNumber(config.batchSize, 3) || 3;
  const googleEmail = config.googleFlowEmail?.trim() || config.googleEmail?.trim() || '';
  const googlePassword = config.googleFlowPassword || config.googlePassword || '';

  if (!googleEmail || !googlePassword) {
    console.log('⚠️ Chưa cung cấp googleFlowEmail/googleFlowPassword trong cấu hình. Script sẽ giả định bạn đã đăng nhập sẵn.');
  }

  console.log('🚗 Bắt đầu tự động hoá Google Flow...');
  await runFlowAutomation({
    promptsData: payload,
    downloadDirectory,
    batchSize,
    headless: Boolean(config.headless),
    browserExecutablePath: config.browserExecutablePath,
    userDataDir: config.userDataDir,
    googleEmail,
    googlePassword
  });
};

main().catch((error) => {
  console.error('\n❌ Có lỗi xảy ra:', error.message);
  process.exitCode = 1;
});

