
// main.js
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { execFile, spawn } = require('child_process');
const XLSX = require('xlsx');
const { randomUUID } = require('crypto');

// Configure logging for autoUpdater
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

const fileWatchers = new Map();
const jobStateTimestamps = new Map(); // Map<filePath, Map<jobId, { status, timestamp }>>
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'app-config.json');
const statsPath = path.join(userDataPath, 'stats.json'); // Path for statistics file
let mainWindow;

// --- Global Error Handler ---
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (mainWindow) {
        dialog.showErrorBox('Lỗi Hệ Thống', error.stack || error.message);
    }
});

// --- Admin Credentials ---
const ADMIN_CREDENTIALS = {
    username: 'bescuong',
    password: '285792684'
};

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

// --- Stats Helpers ---
function readStats() {
    try {
        if (fs.existsSync(statsPath)) {
            return JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
        }
    } catch (e) {
        console.error("Error reading stats:", e);
    }
    return { history: {} }; // Structure: { history: { "YYYY-MM-DD": { count: 0, files: ["path1", ...] } } }
}

function writeStats(stats) {
    try {
        fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    } catch (e) {
        console.error("Error writing stats:", e);
    }
}

function saveVideoStats(videoPath) {
    if (!videoPath) return;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const stats = readStats();

    if (!stats.history) stats.history = {};
    if (!stats.history[today]) {
        stats.history[today] = { count: 0, files: [] };
    }

    // Check if file already counted for today to prevent double counting
    // We use the full path as a unique identifier
    if (!stats.history[today].files.includes(videoPath)) {
        stats.history[today].files.push(videoPath);
        stats.history[today].count += 1;
        writeStats(stats);
    }
}

// UPDATED: Helper to get files strictly from specific directories (Non-recursive)
function getFilesFromDirectories(dirs) {
    let files = [];
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    
    dirs.forEach(dir => {
        try {
            if (fs.existsSync(dir)) {
                const dirents = fs.readdirSync(dir, { withFileTypes: true });
                const videoFiles = dirents
                    .filter(dirent => dirent.isFile() && videoExtensions.includes(path.extname(dirent.name).toLowerCase()))
                    .map(dirent => path.join(dir, dirent.name));
                files = [...files, ...videoFiles];
            }
        } catch (e) {
            console.error(`Error reading directory ${dir}:`, e);
        }
    });
    return files;
}

const isPackaged = app.isPackaged;
function getFfmpegPath() {
    const binary = 'ffmpeg';
    const binaryName = process.platform === 'win32' ? `${binary}.exe` : binary;
    const basePath = isPackaged
        ? path.join(process.resourcesPath, 'ffmpeg')
        : path.join(__dirname, 'resources', 'ffmpeg');
    const platformFolder = process.platform === 'win32' ? 'win' : 'mac';
    return path.join(basePath, platformFolder, binaryName);
}

function parseExcelData(data) {
    try {
        const workbook = XLSX.read(data, { type: 'buffer' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) return [];
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const dataAsArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
        if (!dataAsArrays || dataAsArrays.length < 2) return [];

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
    } catch (e) {
        console.error("Error parsing excel:", e);
        return [];
    }
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });
  
  const startUrl = app.isPackaged 
    ? path.join(__dirname, 'dist', 'index.html') 
    : path.join(__dirname, 'index.html');

  mainWindow.loadFile(startUrl);
  
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
            const guideUrl = app.isPackaged
                ? path.join(__dirname, 'dist', 'guide.html')
                : path.join(__dirname, 'guide.html');
            guideWindow.loadFile(guideUrl);
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
  autoUpdater.checkForUpdatesAndNotify().catch(err => console.log('Updater error:', err));

  // --- Auto-retry stuck jobs interval ---
  const STUCK_JOB_TIMEOUT = 5 * 60 * 1000; 

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- IPC Handlers ---
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-app-config', () => readConfig());
ipcMain.handle('save-app-config', async (event, configToSave) => {
    try {
        writeConfig({ ...readConfig(), ...configToSave });
        return { success: true };
    } catch (error) {
        console.error('Error saving config:', error);
        return { success: false, error: error.message };
    }
});

// Admin Handlers
ipcMain.handle('verify-admin', async (event, { username, password }) => {
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        return { success: true };
    }
    return { success: false, error: 'Tài khoản hoặc mật khẩu không chính xác' };
});

ipcMain.handle('delete-all-stats', async () => {
    try {
        const resetStats = { history: {} };
        writeStats(resetStats);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('delete-stat-date', async (event, date) => {
    try {
        const stats = readStats();
        if (stats.history && stats.history[date]) {
            delete stats.history[date];
            writeStats(stats);
            return { success: true };
        }
        return { success: false, error: 'Date not found' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// New IPC to get stats
ipcMain.handle('get-stats', async () => {
    const stats = readStats();
    const config = readConfig();
    
    const historyArray = Object.entries(stats.history || {}).map(([date, data]) => ({
        date,
        count: data.count
    })).sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort newest first

    const total = historyArray.reduce((sum, item) => sum + item.count, 0);

    return {
        machineId: config.machineId || 'Unknown',
        history: historyArray,
        total
    };
});

ipcMain.handle('save-file-dialog', async (event, { defaultPath, fileContent }) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: 'No active window' };

    const result = await dialog.showSaveDialog(win, {
        title: 'Lưu Kịch Bản Prompt',
        defaultPath: defaultPath,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
    });

    if (result.canceled || !result.filePath) {
        return { success: false, error: 'Save dialog canceled' };
    }

    try {
        fs.writeFileSync(result.filePath, Buffer.from(fileContent));
        return { success: true, filePath: result.filePath };
    } catch (err) {
        console.error('Failed to save file:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('open-file-dialog', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: 'No active window' };

    const result = await dialog.showOpenDialog(win, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'User canceled' };
    }

    try {
        const files = result.filePaths.map(filePath => ({
            path: filePath,
            name: path.basename(filePath),
            content: fs.readFileSync(filePath)
        }));
        return { success: true, files };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.on('start-watching-file', (event, filePath) => {
    if (fileWatchers.has(filePath)) return;

    // Initialize timestamp map for this file
    if (!jobStateTimestamps.has(filePath)) {
        jobStateTimestamps.set(filePath, new Map());
    }

    let debounceTimer;
    const watcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                // Wait a bit more to ensure file write is complete by external process
                setTimeout(() => {
                    try {
                        if (fs.existsSync(filePath)) {
                            const buffer = fs.readFileSync(filePath);
                            const newJobs = parseExcelData(buffer);
                            
                            // Update Timestamps for stuck detection
                            const jobMap = jobStateTimestamps.get(filePath);
                            const now = Date.now();
                            newJobs.forEach(job => {
                                if (job.status === 'Processing' || job.status === 'Generating') {
                                    if (!jobMap.has(job.id) || jobMap.get(job.id).status !== job.status) {
                                        jobMap.set(job.id, { status: job.status, timestamp: now });
                                    }
                                } else {
                                    jobMap.delete(job.id);
                                }
                            });

                            event.sender.send('file-content-updated', { path: filePath, content: buffer });

                            // LOGIC: Only notify if list is not empty AND all are strictly 'Completed'
                            if (newJobs.length > 0) {
                                const allCompleted = newJobs.every(j => j.status === 'Completed');

                                if (allCompleted) {
                                    new Notification({
                                        title: 'Hoàn thành!',
                                        body: `File "${path.basename(filePath)}" đã hoàn thành 100%.`
                                    }).show();
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`Error reading watched file ${filePath}:`, err);
                    }
                }, 500);
            }, 100); 
        }
    });
    fileWatchers.set(filePath, watcher);
});

ipcMain.on('stop-watching-file', (event, filePath) => {
    if (fileWatchers.has(filePath)) {
        fileWatchers.get(filePath).close();
        fileWatchers.delete(filePath);
    }
    if (jobStateTimestamps.has(filePath)) {
        jobStateTimestamps.delete(filePath);
    }
});

ipcMain.handle('find-videos-for-jobs', async (event, { jobs, excelFilePath }) => {
    try {
        // UPDATED LOGIC: Search only in Excel directory and Subdirectory with same name
        const rootDir = path.dirname(excelFilePath);
        const excelNameNoExt = path.basename(excelFilePath, '.xlsx');
        const subDir = path.join(rootDir, excelNameNoExt);
        
        const targetDirs = [rootDir, subDir];
        const videoFiles = getFilesFromDirectories(targetDirs);
        
        const updatedJobs = jobs.map(job => {
            // If already has a valid video path, check if it still exists
            if (job.videoPath && fs.existsSync(job.videoPath)) return job;
            if (job.status !== 'Completed') return job;

            const jobId = job.id; // Expected format "Job_1"
            
            if (jobId) {
                // STRICT MATCHING LOGIC
                const idNumber = jobId.replace(/[^0-9]/g, '');
                
                if (idNumber) {
                   const regex = new RegExp(`Job_0*${idNumber}(?:[^0-9]|$)`, 'i');
                   
                   const matchedFile = videoFiles.find(f => {
                        const fileName = path.basename(f);
                        return regex.test(fileName);
                   });

                   if (matchedFile) {
                        // *** STATS LOGIC: Save stats when video found ***
                        saveVideoStats(matchedFile); 
                        return { ...job, videoPath: matchedFile };
                   }
                }
            }
            
            // Fallback: Try matching by videoName if Job ID match fails (keeping strict boundary)
            if (job.videoName) {
                 const cleanName = job.videoName.trim();
                 const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                 const nameRegex = new RegExp(`${escapedName}(?:[^0-9]|$)`, 'i');
                 
                 const matchedFileByName = videoFiles.find(f => {
                     const fileName = path.basename(f, path.extname(f));
                     return nameRegex.test(fileName);
                 });
                 
                 if (matchedFileByName) {
                     // *** STATS LOGIC: Save stats when video found ***
                     saveVideoStats(matchedFileByName);
                     return { ...job, videoPath: matchedFileByName };
                 }
            }

            return job;
        });
        
        return { success: true, jobs: updatedJobs };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('check-ffmpeg', async () => {
    const ffmpegPath = getFfmpegPath();
    return { found: fs.existsSync(ffmpegPath) };
});

ipcMain.handle('open-video-file-dialog', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: 'No active window' };
    const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, path: result.filePaths[0] };
    }
    return { success: false, error: 'Canceled' };
});

ipcMain.handle('execute-ffmpeg-combine', async (event, { jobs, targetDuration, mode, excelFileName }) => {
    const ffmpegPath = getFfmpegPath();
    if (!fs.existsSync(ffmpegPath)) return { success: false, error: 'FFmpeg executable not found.' };

    const win = BrowserWindow.getFocusedWindow();
    const saveResult = await dialog.showSaveDialog(win, {
        title: 'Lưu Video Đã Ghép',
        defaultPath: `Combined_${excelFileName.replace('.xlsx', '')}.mp4`,
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
    });

    if (saveResult.canceled || !saveResult.filePath) return { success: false, error: 'Save dialog canceled' };

    const outputPath = saveResult.filePath;
    const listPath = path.join(path.dirname(outputPath), `concat_list_${Date.now()}.txt`);

    try {
        // Create concat list file
        const fileContent = jobs.map(j => `file '${j.videoPath.replace(/'/g, "'\\''")}'`).join('\n');
        fs.writeFileSync(listPath, fileContent);

        const args = ['-f', 'concat', '-safe', '0', '-i', listPath];
        
        if (mode === 'timed' && targetDuration) {
             args.push('-t', String(targetDuration));
        }

        args.push('-c', 'copy', '-y', outputPath);

        return new Promise((resolve) => {
            execFile(ffmpegPath, args, (error, stdout, stderr) => {
                // Clean up list file
                try { fs.unlinkSync(listPath); } catch (e) {}

                if (error) {
                    console.error('FFmpeg error:', stderr);
                    resolve({ success: false, error: `FFmpeg failed: ${stderr}` });
                } else {
                    resolve({ success: true, filePath: outputPath });
                }
            });
        });

    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('execute-ffmpeg-combine-all', async (event, filesToProcess) => {
    const ffmpegPath = getFfmpegPath();
    if (!fs.existsSync(ffmpegPath)) return { canceled: false, successes: [], failures: ["FFmpeg not found"] };

    const win = BrowserWindow.getFocusedWindow();
    const folderResult = await dialog.showOpenDialog(win, {
        title: 'Chọn thư mục lưu các video đã ghép',
        properties: ['openDirectory']
    });

    if (folderResult.canceled || folderResult.filePaths.length === 0) return { canceled: true, successes: [], failures: [] };
    
    const outputDir = folderResult.filePaths[0];
    const successes = [];
    const failures = [];

    for (const file of filesToProcess) {
        const safeName = file.name.replace('.xlsx', '');
        const outputPath = path.join(outputDir, `Combined_${safeName}.mp4`);
        const listPath = path.join(outputDir, `concat_list_${safeName}_${Date.now()}.txt`);

        try {
            const fileContent = file.jobs.map(j => `file '${j.videoPath.replace(/'/g, "'\\''")}'`).join('\n');
            fs.writeFileSync(listPath, fileContent);

            const args = ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-y', outputPath];
            
            await new Promise((resolve) => {
                execFile(ffmpegPath, args, (error, stdout, stderr) => {
                    try { fs.unlinkSync(listPath); } catch (e) {}
                    if (error) {
                        console.error(`Failed to combine ${file.name}:`, stderr);
                        failures.push(file.name);
                    } else {
                        successes.push(file.name);
                    }
                    resolve();
                });
            });
        } catch (err) {
            failures.push(file.name);
        }
    }
    return { canceled: false, successes, failures };
});

ipcMain.on('open-folder', (event, dirPath) => {
    if (dirPath && fs.existsSync(dirPath)) {
        shell.openPath(dirPath);
    }
});

ipcMain.on('open-video-path', (event, videoPath) => {
    if (videoPath && fs.existsSync(videoPath)) {
        shell.openPath(videoPath);
    }
});

ipcMain.on('show-video-in-folder', (event, videoPath) => {
    if (videoPath && fs.existsSync(videoPath)) {
        shell.showItemInFolder(videoPath);
    }
});

ipcMain.handle('delete-video-file', async (event, videoPath) => {
    const win = BrowserWindow.getFocusedWindow();
    const choice = await dialog.showMessageBox(win, {
        type: 'question',
        buttons: ['Hủy', 'Xóa'],
        defaultId: 1,
        title: 'Xác nhận xóa',
        message: 'Bạn có chắc chắn muốn xóa file video này không? Hành động này không thể hoàn tác.'
    });

    if (choice.response === 1) {
        try {
            if (fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
                return { success: true };
            } else {
                return { success: false, error: 'File not found' };
            }
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
    return { success: false, error: 'User canceled deletion.' };
});

ipcMain.handle('retry-job', async (event, { filePath, jobId }) => {
    return await updateExcelStatus(filePath, [jobId], '');
});

ipcMain.handle('retry-stuck-jobs', async (event, { filePath }) => {
    try {
        const buffer = fs.readFileSync(filePath);
        const jobs = parseExcelData(buffer);
        const stuckIds = jobs
            .filter(j => j.status === 'Processing' || j.status === 'Generating')
            .map(j => j.id);
        
        if (stuckIds.length === 0) return { success: true };
        return await updateExcelStatus(filePath, stuckIds, '');
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('open-tool-flow', async () => {
    const config = readConfig();
    if (config.toolFlowPath && fs.existsSync(config.toolFlowPath)) {
        spawn(config.toolFlowPath, [], { detached: true, stdio: 'ignore' }).unref();
        return { success: true };
    }
    return { success: false, error: 'Path not configured or invalid' };
});

ipcMain.handle('set-tool-flow-path', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [{ name: 'Executables', extensions: ['exe'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const newPath = result.filePaths[0];
        writeConfig({ ...readConfig(), toolFlowPath: newPath });
        return { success: true, path: newPath };
    }
    return { success: false, error: 'User canceled selection.' };
});

ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});
