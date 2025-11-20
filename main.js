
// main.js
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { execFile } = require('child_process');
const XLSX = require('xlsx');
const { randomUUID } = require('crypto');

// Configure logging for autoUpdater
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

const fileWatchers = new Map();
const jobStateTimestamps = new Map(); // Map<filePath, Map<jobId, { status, timestamp }>>
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'app-config.json');

// --- Helper functions ---
function readConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (!config.machineId) {
          config.machineId = randomUUID();
          writeConfig(config);
      }
      return config;
    }
  } catch (error) {
    console.error('Error reading config file:', error);
  }
  const newConfig = { machineId: randomUUID() };
  writeConfig(newConfig);
  return newConfig;
}

function writeConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error writing config file:', error);
  }
}

async function findFilesRecursively(dir) {
    if (!fs.existsSync(dir)) return [];
    const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? findFilesRecursively(res) : res;
    }));
    return Array.prototype.concat(...files);
}

const isPackaged = app.isPackaged;
function getFfmpegPath(binary) {
    const binaryName = process.platform === 'win32' ? `${binary}.exe` : binary;
    const basePath = isPackaged
        ? path.join(process.resourcesPath, 'ffmpeg')
        : path.join(__dirname, 'resources', 'ffmpeg');
    const platformFolder = process.platform === 'win32' ? 'win' : 'mac';
    return path.join(basePath, platformFolder, binaryName);
}

function parseExcelData(data) {
    const workbook = XLSX.read(data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const dataAsArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
    if (dataAsArrays.length < 2) return [];

    const headers = dataAsArrays[0].map(h => String(h).trim());
    const headerMap = {};
    headers.forEach((h, i) => { headerMap[h] = i; });
    
    const dataRows = dataAsArrays.slice(1);
    const validStatuses = ['Pending', 'Processing', 'Generating', 'Completed', 'Failed'];

    return dataRows.map((rowArray, index) => {
        const get = (headerName) => rowArray[headerMap[headerName]] || '';
        let statusStr = String(get('STATUS')).trim();
        let status = 'Pending';
        if (statusStr && validStatuses.includes(statusStr)) {
            status = statusStr;
        }

        return {
            id: get('JOB_ID') || `job_${index + 1}`,
            prompt: get('PROMPT') || '',
            imagePath: get('IMAGE_PATH') || '',
            imagePath2: get('IMAGE_PATH_2') || '',
            imagePath3: get('IMAGE_PATH_3') || '',
            status: status,
            videoName: get('VIDEO_NAME') || '',
            typeVideo: get('TYPE_VIDEO') || '',
            videoPath: get('VIDEO_PATH') || undefined,
        };
    }).filter(job => job.id && String(job.id).trim());
}

async function updateExcelStatus(filePath, jobIdsToUpdate, newStatus = '') {
    try {
        const fileContent = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileContent, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const dataAsArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (dataAsArrays.length < 2) return { success: true }; 

        const headers = dataAsArrays[0].map(h => String(h).trim());
        const jobIdIndex = headers.indexOf('JOB_ID');
        const statusIndex = headers.indexOf('STATUS');
        if (jobIdIndex === -1 || statusIndex === -1) {
            throw new Error('Could not find required JOB_ID or STATUS columns in the Excel file.');
        }
        
        for (let i = 1; i < dataAsArrays.length; i++) {
            if (jobIdsToUpdate.includes(dataAsArrays[i][jobIdIndex])) {
                dataAsArrays[i][statusIndex] = newStatus;
            }
        }

        const newWorksheet = XLSX.utils.aoa_to_sheet(dataAsArrays);
        if (worksheet['!cols']) newWorksheet['!cols'] = worksheet['!cols'];
        
        const newWorkbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);
        const newFileContent = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'buffer' });
        fs.writeFileSync(filePath, newFileContent);
        
        return { success: true };
    } catch (error) {
        console.error('Error updating Excel file:', error);
        return { success: false, error: error.message };
    }
}


function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  autoUpdater.on('update-downloaded', () => {
      mainWindow.webContents.send('show-alert-modal', {
          title: 'Có bản cập nhật mới!',
          message: 'Bản cập nhật mới đã được tải về. Vui lòng khởi động lại ứng dụng để áp dụng các thay đổi.',
          type: 'update'
      });
  });
}

app.whenReady().then(() => {
  const menuTemplate = [
    { label: 'File', submenu: [{ role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Hướng dẫn sử dụng',
          click: () => {
            const guideWindow = new BrowserWindow({ width: 900, height: 700, title: 'Hướng dẫn sử dụng - Prompt Generator Pro', icon: path.join(__dirname, 'assets/icon.png') });
            guideWindow.loadFile(path.join(__dirname, 'dist', 'guide.html'));
            guideWindow.setMenu(null);
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              dialog.showMessageBox(focusedWindow, { type: 'info', title: 'About Prompt Generator Pro', message: `Prompt Generator Pro v${app.getVersion()}`, detail: 'An application to generate professional visual scripts for Music Videos and Live Shows.\n\nCreated by Cường-VFATS.' });
            }
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();

  // --- Auto-retry stuck jobs interval ---
  // 4 MINUTES TIMEOUT
  const STUCK_JOB_TIMEOUT = 4 * 60 * 1000; 

  setInterval(() => {
    const now = Date.now();
    for (const [filePath, jobMap] of jobStateTimestamps.entries()) {
        const stuckJobIds = [];
        for (const [jobId, state] of jobMap.entries()) {
            if ((state.status === 'Processing' || state.status === 'Generating') && (now - state.timestamp > STUCK_JOB_TIMEOUT)) {
                stuckJobIds.push(jobId);
            }
        }
        if (stuckJobIds.length > 0) {
            console.log(`Found ${stuckJobIds.length} stuck jobs in ${filePath}. Resetting...`);
            updateExcelStatus(filePath, stuckJobIds, '')
                .then(result => {
                    if (!result.success) {
                        console.error(`Failed to reset stuck jobs for ${filePath}:`, result.error);
                    }
                });
        }
    }
  }, 60 * 1000); // Check every minute
});

// --- IPC Handlers ---
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-app-config', () => readConfig());
ipcMain.handle('save-app-config', async (event, configToSave) => {
    try {
        writeConfig({ ...readConfig(), ...config