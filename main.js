
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
        writeConfig({ ...readConfig(), ...configToSave });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
ipcMain.handle('save-file-dialog', async (event, { defaultPath, fileContent }) => {
    const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), { title: 'Lưu Kịch Bản Prompt', defaultPath, filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }] });
    if (canceled || !filePath) return { success: false, error: 'Save dialog canceled' };
    try {
        fs.writeFileSync(filePath, Buffer.from(fileContent));
        return { success: true, filePath: filePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
});
ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), { title: 'Chọn file Excel để theo dõi', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Excel Files', extensions: ['xlsx'] }] });
    if (canceled || !filePaths.length) return { success: false, error: 'User canceled selection' };
    try {
        const files = filePaths.map(filePath => ({ path: filePath, name: path.basename(filePath), content: fs.readFileSync(filePath) }));
        return { success: true, files };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});

function areAllTrackedFilesComplete() {
   if (jobStateTimestamps.size === 0) return false;
   for (const [path, jobs] of jobStateTimestamps) {
       for (const [jobId, state] of jobs) {
           if (state.status !== 'Completed') return false;
       }
   }
   return true;
}

ipcMain.on('start-watching-file', (event, filePath) => {
    if (fileWatchers.has(filePath)) return;
    try {
        const initialContent = fs.readFileSync(filePath);
        const initialJobs = parseExcelData(initialContent);
        const initialJobMap = new Map();
        initialJobs.forEach(job => initialJobMap.set(job.id, { status: job.status, timestamp: Date.now() }));
        jobStateTimestamps.set(filePath, initialJobMap);
    } catch(err) {
        console.error(`Failed to read initial state for ${filePath}:`, err);
        return;
    }
    const watcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
            try {
                const content = fs.readFileSync(filePath);
                const newJobs = parseExcelData(content);
                
                // Update internal map
                const oldJobMap = jobStateTimestamps.get(filePath) || new Map();
                const newJobMap = new Map();
                
                // Check status transition for notification logic
                const newJobsAllCompleted = newJobs.every(j => j.status === 'Completed');
                const oldJobsNotCompleted = Array.from(oldJobMap.values()).length > 0 && Array.from(oldJobMap.values()).some(j => j.status !== 'Completed');

                newJobs.forEach(newJob => {
                    const oldState = oldJobMap.get(newJob.id);
                    if (oldState && oldState.status === newJob.status) {
                        newJobMap.set(newJob.id, oldState);
                    } else {
                        newJobMap.set(newJob.id, { status: newJob.status, timestamp: Date.now() });
                    }
                });
                jobStateTimestamps.set(filePath, newJobMap);
                
                // Send content update to UI
                event.sender.send('file-content-updated', { path: filePath, content });

                // 1. Single File Completion Notification (System Notification)
                if (newJobsAllCompleted && oldJobsNotCompleted) {
                     if (Notification.isSupported()) {
                        new Notification({
                            title: 'File Hoàn Thành!',
                            body: `File "${path.basename(filePath)}" đã hoàn tất xử lý video.`,
                            silent: false,
                            icon: path.join(__dirname, 'assets/icon.png')
                        }).show();
                    }
                }

                // 2. Global Completion Alert (Modal)
                if (areAllTrackedFilesComplete()) {
                    // Only trigger modal if this specific file update was the "tipping point"
                    if (newJobsAllCompleted && oldJobsNotCompleted) {
                        event.sender.send('show-alert-modal', {
                            title: 'Dự án Hoàn Thành Xuất Sắc!',
                            message: 'Tuyệt vời! Tất cả các file bạn đang theo dõi đều đã hoàn thành 100%.',
                            type: 'completion'
                        });
                    }
                }

            } catch (error) {
                console.error(`Error processing file change for ${filePath}:`, error);
            }
        }
    });
    watcher.on('error', (error) => {
        console.error(`Watcher error for ${filePath}:`, error);
        if (fileWatchers.has(filePath)) {
            fileWatchers.get(filePath).close();
            fileWatchers.delete(filePath);
        }
        jobStateTimestamps.delete(filePath);
    });
    fileWatchers.set(filePath, watcher);
});
ipcMain.on('stop-watching-file', (event, filePath) => {
    if (fileWatchers.has(filePath)) {
        fileWatchers.get(filePath).close();
        fileWatchers.delete(filePath);
    }
    jobStateTimestamps.delete(filePath);
});
ipcMain.handle('find-videos-for-jobs', async (event, { jobs, excelFilePath }) => {
    if (!excelFilePath) return { success: false, jobs, error: 'Excel file path is missing.' };
    try {
        const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
        const basePath = path.dirname(excelFilePath);
        const excelFileNameWithoutExt = path.basename(excelFilePath, '.xlsx');
        const specificSearchPath = path.join(basePath, excelFileNameWithoutExt);
        let allFiles = [];
        if (fs.existsSync(specificSearchPath) && fs.lstatSync(specificSearchPath).isDirectory()) {
            allFiles = await findFilesRecursively(specificSearchPath);
        } else {
            allFiles = await findFilesRecursively(basePath);
        }
        const videoFiles = allFiles.filter(file => videoExtensions.includes(path.extname(file).toLowerCase()));
        const updatedJobs = jobs.map(job => {
            if (job.videoPath && !fs.existsSync(job.videoPath)) job.videoPath = undefined;
            if (job.status === 'Completed' && !job.videoPath && job.videoName && job.id) {
                const expectedPrefix = `Video_${job.id}_${job.videoName}`.toLowerCase();
                const foundVideo = videoFiles.find(file => path.basename(file, path.extname(file)).toLowerCase().startsWith(expectedPrefix));
                if (foundVideo) return { ...job, videoPath: foundVideo };
            }
            return job;
        });
        return { success: true, jobs: updatedJobs };
    } catch (error) {
        return { success: false, jobs, error: error.message };
    }
});
ipcMain.handle('check-ffmpeg', async () => {
    try {
        await fs.promises.access(getFfmpegPath('ffmpeg'), fs.constants.X_OK);
        return { found: true };
    } catch (error) {
        return { found: false };
    }
});
ipcMain.handle('open-video-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), { title: 'Chọn file Video', properties: ['openFile'], filters: [{ name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }] });
    if (canceled || !filePaths.length) return { success: false, error: 'User canceled selection' };
    return { success: true, path: filePaths[0] };
});
ipcMain.handle('execute-ffmpeg-combine', async (event, { jobs, targetDuration, mode, excelFileName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), { title: 'Lưu Video Đã Ghép', defaultPath: mode === 'timed' ? `${excelFileName.replace(/\.xlsx$/, '')}_timed.mp4` : `${excelFileName.replace(/\.xlsx$/, '')}_combined.mp4`, filters: [{ name: 'MP4 Video', extensions: ['mp4'] }] });
    if (canceled || !filePath) return { success: false, error: 'Save dialog canceled' };
    
    const videoPaths = jobs.map(j => j.videoPath);
    const tempFilePath = path.join(app.getPath('temp'), `filelist-${Date.now()}.txt`);
    fs.writeFileSync(tempFilePath, videoPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
    let args;
    if (mode === 'timed' && targetDuration) {
        let totalInputDuration = 0;
        for (const videoPath of videoPaths) {
            try {
                const probeOutput = await new Promise((resolve, reject) => execFile(getFfmpegPath('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath], (error, stdout) => error ? reject(error) : resolve(stdout)));
                totalInputDuration += parseFloat(probeOutput);
            } catch(e) { console.error("ffprobe error:", e) }
        }
        const speedFactor = totalInputDuration > 0 ? totalInputDuration / targetDuration : 1;
        args = ['-f', 'concat', '-safe', '0', '-i', tempFilePath, '-filter_complex', `[0:v]setpts=${1/speedFactor}*PTS[v];[0:a]atempo=${speedFactor}[a]`, '-map', '[v]', '-map', '[a]', '-y', filePath];
    } else {
        args = ['-f', 'concat', '-safe', '0', '-i', tempFilePath, '-c', 'copy', '-y', filePath];
    }
    return new Promise(resolve => execFile(getFfmpegPath('ffmpeg'), args, (error, _, stderr) => {
        fs.unlinkSync(tempFilePath);
        error ? resolve({ success: false, error: stderr || error.message }) : resolve({ success: true, filePath: filePath });
    }));
});
ipcMain.handle('execute-ffmpeg-combine-all', async (event, filesToProcess) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), { title: 'Chọn thư mục để lưu tất cả video đã ghép', properties: ['openDirectory'] });
    if (canceled || !filePaths.length) return { canceled: true };
    const outputDir = filePaths[0];
    const successes = [], failures = [];
    for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        BrowserWindow.getFocusedWindow().webContents.send('combine-all-progress', { message: `Đang xử lý file ${i + 1}/${filesToProcess.length}: ${file.name}` });
        const outputFilePath = path.join(outputDir, `${file.name.replace(/\.xlsx$/, '')}_combined.mp4`);
        const tempFilePath = path.join(app.getPath('temp'), `filelist-all-${Date.now()}.txt`);
        fs.writeFileSync(tempFilePath, file.jobs.map(j => `file '${j.videoPath.replace(/'/g, "'\\''")}'`).join('\n'));
        await new Promise(resolve => execFile(getFfmpegPath('ffmpeg'), ['-f', 'concat', '-safe', '0', '-i', tempFilePath, '-c', 'copy', '-y', outputFilePath], error => {
            fs.unlinkSync(tempFilePath);
            error ? failures.push({ name: file.name, error: error.message }) : successes.push({ name: file.name, path: outputFilePath });
            resolve();
        }));
    }
    return { successes, failures };
});
ipcMain.on('open-folder', (_, folderPath) => shell.openPath(folderPath).catch(err => console.error('Failed to open folder:', err)));
ipcMain.handle('open-tool-flow', async () => {
    const { toolFlowPath } = readConfig();
    if (!toolFlowPath || !fs.existsSync(toolFlowPath)) return { success: false, error: 'Đường dẫn ToolFlows chưa được thiết lập hoặc không hợp lệ.' };
    return shell.openPath(toolFlowPath) ? { success: true } : { success: false, error: 'Could not open path.' };
});
ipcMain.handle('set-tool-flow-path', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), { title: 'Chọn file thực thi ToolFlows', properties: ['openFile'], filters: process.platform === 'win32' ? [{ name: 'Executable', extensions: ['exe'] }] : [] });
    if (canceled || !filePaths.length) return { success: false, error: 'User canceled selection.' };
    const selectedPath = filePaths[0];
    writeConfig({ ...readConfig(), toolFlowPath: selectedPath });
    return { success: true, path: selectedPath };
});
ipcMain.on('open-video-path', (_, videoPath) => shell.openPath(videoPath).catch(err => console.error('Failed to open video:', err)));
ipcMain.on('show-video-in-folder', (_, videoPath) => shell.showItemInFolder(videoPath));
ipcMain.handle('delete-video-file', async (_, videoPath) => {
    const { response } = await dialog.showMessageBox(BrowserWindow.getFocusedWindow(), { type: 'warning', buttons: ['Xóa', 'Hủy'], defaultId: 1, title: 'Xác nhận xóa video', message: 'Bạn có chắc chắn muốn xóa file video này không?', detail: `Đường dẫn: ${videoPath}\nHành động này không thể hoàn tác.` });
    if (response === 1) return { success: false, error: 'User canceled deletion.' };
    try {
        fs.unlinkSync(videoPath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
ipcMain.handle('retry-job', (_, { filePath, jobId }) => updateExcelStatus(filePath, [jobId]));
ipcMain.handle('retry-stuck-jobs', async (_, { filePath }) => {
    try {
        const jobs = parseExcelData(fs.readFileSync(filePath));
        const stuckJobIds = jobs.filter(j => j.status === 'Processing' || j.status === 'Generating').map(j => j.id);
        if (stuckJobIds.length === 0) return { success: true };
        return await updateExcelStatus(filePath, stuckJobIds);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
