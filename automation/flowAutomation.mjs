import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedPuppeteer = null;

const loadPuppeteer = async () => {
  if (!cachedPuppeteer) {
    try {
      const module = await import('puppeteer');
      cachedPuppeteer = module.default || module;
    } catch (error) {
      throw new Error('Không tìm thấy thư viện puppeteer. Hãy chạy "npm install" để cài đặt devDependencies trước khi dùng tự động hoá.');
    }
  }
  return cachedPuppeteer;
};

const chunkPrompts = (items, size) => {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const readPrompts = async (filePath) => {
  const fileContent = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(fileContent);
  if (!Array.isArray(data.prompts) || data.prompts.length === 0) {
    throw new Error('File prompts không hợp lệ. Vui lòng kiểm tra lại.');
  }
  return {
    projectName: data.projectName || 'project',
    prompts: data.prompts.map((item, index) => ({
      index: index + 1,
      title: item.scene_title || item.title || `Prompt ${index + 1}`,
      text: item.prompt_text || item.prompt || String(item)
    }))
  };
};

const ensureDownloadFolder = async (directory) => {
  await fs.mkdir(directory, { recursive: true });
  return directory;
};

const listFiles = async (directory) => {
  try {
    const files = await fs.readdir(directory);
    return files;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const waitForNewDownload = async (directory, existingFiles, timeout = 600000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const currentFiles = await listFiles(directory);
    const finishedFiles = currentFiles.filter((file) => !file.endsWith('.crdownload'));
    const newFiles = finishedFiles.filter((file) => !existingFiles.includes(file));
    if (newFiles.length > 0) {
      return newFiles[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Quá thời gian chờ tải video. Vui lòng kiểm tra lại.');
};

const clickButtonByText = async (page, text, { timeout = 60000, optional = false } = {}) => {
  const lowerText = text.toLowerCase();
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const clicked = await page.evaluate((searchText) => {
      const elements = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
      const target = elements.find((element) => {
        const content = (element.textContent || element.innerText || '').toLowerCase();
        const aria = (element.getAttribute('aria-label') || '').toLowerCase();
        return content.includes(searchText) || aria.includes(searchText);
      });
      if (target) {
        target.scrollIntoView({ block: 'center', behavior: 'instant' });
        target.click();
        return true;
      }
      return false;
    }, lowerText);

    if (clicked) {
      return true;
    }

    await page.waitForTimeout(500);
  }

  if (optional) {
    return false;
  }
  throw new Error(`Không tìm thấy nút với nội dung "${text}".`);
};

const getPromptInput = async (page) => {
  const handle = await page.waitForFunction(() => {
    const candidates = Array.from(document.querySelectorAll('textarea, [contenteditable="true"]'));
    return (
      candidates.find((element) => {
        const placeholder = (element.getAttribute('placeholder') || '').toLowerCase();
        const aria = (element.getAttribute('aria-label') || '').toLowerCase();
        return (
          placeholder.includes('tạo video bằng văn bản') ||
          aria.includes('tạo video bằng văn bản') ||
          placeholder.includes('create video from text') ||
          aria.includes('create video from text') ||
          placeholder.includes('text to video') ||
          aria.includes('text to video')
        );
      }) || null
    );
  }, { timeout: 60000 });

  const element = handle.asElement();
  if (!element) {
    throw new Error('Không tìm thấy vùng nhập "Tạo video bằng văn bản".');
  }
  return element;
};

const typePromptAndGenerate = async (page, inputHandle, prompt) => {
  await inputHandle.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(200);
  await page.keyboard.type(prompt, { delay: 15 });
  await page.keyboard.press('Enter');
};

const waitForDownloadMenu = async (page) => {
  await page.waitForFunction(() => {
    const elements = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
    return elements.some((element) => {
      const text = (element.textContent || element.innerText || '').toLowerCase();
      const aria = (element.getAttribute('aria-label') || '').toLowerCase();
      return text.includes('tải xuống') || text.includes('download') || aria.includes('tải xuống') || aria.includes('download');
    });
  }, { timeout: 600000 });
};

const openDownloadMenu = async (page) => {
  const opened = await clickButtonByText(page, 'tải xuống', { timeout: 120000, optional: true });
  if (!opened) {
    await clickButtonByText(page, 'download', { timeout: 120000 });
  }
  await page.waitForTimeout(800);
};

const chooseResolution = async (page) => {
  const options = [
    'kích thước gốc (720)',
    '720',
    'original size (720)',
    'original 720',
    'original size'
  ];

  for (const option of options) {
    const clicked = await clickButtonByText(page, option, { timeout: 5000, optional: true });
    if (clicked) {
      return;
    }
  }

  throw new Error('Không tìm thấy tuỳ chọn tải "Kích thước gốc (720)".');
};

export const runFlowAutomation = async ({
  promptsPath,
  promptsData,
  downloadDirectory,
  batchSize = 3,
  headless = false,
  browserExecutablePath,
  userDataDir
} = {}) => {
  let resolvedPromptsPath = null;
  let projectName;
  let prompts;

  if (promptsData && Array.isArray(promptsData.prompts)) {
    projectName = promptsData.projectName || 'project';
    prompts = promptsData.prompts.map((item, index) => ({
      index: index + 1,
      title: item.scene_title || item.title || `Prompt ${index + 1}`,
      text: item.prompt_text || item.prompt || item.text || String(item)
    }));
  } else {
    resolvedPromptsPath = promptsPath
      ? path.resolve(process.cwd(), promptsPath)
      : path.resolve(__dirname, 'prompts.json');
    const parsed = await readPrompts(resolvedPromptsPath);
    projectName = parsed.projectName;
    prompts = parsed.prompts;
  }

  const resolvedDownloadDirectory = downloadDirectory
    ? path.resolve(process.cwd(), downloadDirectory)
    : path.resolve(process.cwd(), 'google-flow-downloads');

  await ensureDownloadFolder(resolvedDownloadDirectory);

  if (resolvedPromptsPath) {
    console.log('📄 Đang xử lý file prompts:', resolvedPromptsPath);
  } else {
    console.log('📄 Đang sử dụng prompts có sẵn trong bộ nhớ.');
  }
  console.log('📂 Tên dự án:', projectName);
  console.log('📁 Thư mục tải video:', resolvedDownloadDirectory);
  console.log(`🎯 Tổng số prompt: ${prompts.length}`);
  console.log('👉 Lưu ý: Nếu Chrome yêu cầu chọn thư mục tải xuống, hãy chọn đúng thư mục rồi nhấn Save.');

  const launchOptions = {
    headless,
    defaultViewport: null,
    args: ['--start-maximized']
  };

  if (browserExecutablePath) {
    launchOptions.executablePath = browserExecutablePath;
  }

  if (userDataDir) {
    launchOptions.userDataDir = path.resolve(process.cwd(), userDataDir);
  }

  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch(launchOptions);

  try {
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: resolvedDownloadDirectory
    });

    await page.goto('https://labs.google/fx/vi/tools/flow', { waitUntil: 'networkidle2' });
    await clickButtonByText(page, 'dự án mới', { timeout: 120000 });
    await page.waitForTimeout(2000);

    const batches = chunkPrompts(prompts, batchSize);
    let processed = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batch = batches[batchIndex];
      console.log(`\n🚀 Bắt đầu nhóm prompt ${batchIndex + 1}/${batches.length}`);

      for (const item of batch) {
        processed += 1;
        console.log(`\n📝 Prompt ${processed}/${prompts.length}: ${item.title}`);

        const inputHandle = await getPromptInput(page);
        await typePromptAndGenerate(page, inputHandle, item.text);
        await inputHandle.dispose();

        console.log('⏳ Đang đợi video render...');
        await waitForDownloadMenu(page);
        console.log('✅ Video đã sẵn sàng, mở menu tải xuống.');

        const existingFiles = await listFiles(resolvedDownloadDirectory);
        await openDownloadMenu(page);
        await chooseResolution(page);

        const downloadedFile = await waitForNewDownload(resolvedDownloadDirectory, existingFiles);
        console.log(`⬇️ Đã tải xong: ${downloadedFile}`);

        await page.waitForTimeout(2000);
      }

      if (batchIndex < batches.length - 1) {
        console.log('\n🔁 Chuẩn bị cho nhóm prompt tiếp theo.');
        const resetClicked = await clickButtonByText(page, 'dự án mới', { timeout: 60000, optional: true });
        if (!resetClicked) {
          await clickButtonByText(page, 'tạo video mới', { timeout: 60000, optional: true });
        }
        await page.waitForTimeout(2000);
      }
    }

    console.log(`\n🎉 Hoàn tất! Đã xử lý ${processed} prompt cho dự án ${projectName}.`);
  } finally {
    console.log('🛑 Đóng trình duyệt trong 5 giây...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await browser.close();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const [, , promptsArg, downloadArg] = process.argv;
  runFlowAutomation({
    promptsPath: promptsArg,
    downloadDirectory: downloadArg
  }).catch((error) => {
    console.error('\n❌ Có lỗi xảy ra:', error.message);
    process.exitCode = 1;
  });
}
