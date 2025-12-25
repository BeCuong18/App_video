
// main.js
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { execFile, spawn, execSync } = require('child_process');
const XLSX = require('xlsx');
const { randomUUID } = require('crypto');

// Configure logging for autoUpdater
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

const fileWatchers = new Map();
const jobStateTimestamps = new Map(); 
const fileJobStates = new Map();

const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'app-config.json');
const statsPath = path.join(userDataPath, 'stats.json'); 
let mainWindow;

const ADMIN_CREDENTIALS = {
    username: 'bescuong',
    password: '285792684'
};

/**
 * CƠ CHẾ GỐC: Lấy UUID phần cứng để làm Machine ID ổn định
 */
function getSystemId() {
    try {
        let id = '';
        if (process.platform === 'win32') {
            const output = execSync('wmic csproduct get uuid').toString();
            id = output.split('\n')[1]?.trim();
        } else if (process.platform === 'darwin') {
            id = execSync("ioreg -rd1 -c IOPlatformExpertDevice | grep -E 'IOPlatformUUID' | awk '{print $3}' | tr -d '\"'").toString().trim();
        } else {
            id = execSync('cat /var/lib/dbus/machine-id || cat /etc/machine-id').toString().trim();
        }
        return id || null;
    } catch (e) {
        console.error("Failed to get hardware ID", e);
        return null;
    }
}

function readConfig() {
  try {
    const hardwareId = getSystemId();
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (hardwareId) {
          config.machineId = hardwareId;
      } else if (!config.machineId) {
          config.machineId = randomUUID();
      }
      return config;
    } else {
        const newConfig = { machineId: hardwareId || randomUUID() };
        writeConfig(newConfig);
        return newConfig;
    }
  } catch (error) {
    console.error('Error reading config file:', error);
  }
  return { machineId: getSystemId() || randomUUID() };
}

function writeConfig(config) {
  try {
    if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error writing config file:', error);
  }
}

function readStats() {
    try {
        if (fs.existsSync(statsPath)) {
            const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
            return checkAndResetModelUsage(stats);
        }
    } catch (e) {
        console.error("Error reading stats:", e);
    }
    return { history: {}, promptCount: 0, modelUsage: {}, lastResetModelUsage: new Date().toISOString() }; 
}

/**
 * Reset modelUsage nếu đã qua mốc 17:00 (5h chiều) gần nhất
 */
function checkAndResetModelUsage(stats) {
    const now = new Date();
    const resetHour = 17; // 17:00 = 5 PM
    
    // Tìm mốc 17:00 gần nhất trước thời điểm hiện tại
    let mostRecentReset = new Date();
    mostRecentReset.setHours(resetHour, 0, 0, 0);
    
    // Nếu bây giờ chưa đến 17h, mốc reset gần nhất là 17h ngày hôm qua
    if (now < mostRecentReset) {
        mostRecentReset.setDate(mostRecentReset.getDate() - 1);
    }
    
    const lastReset = stats.lastResetModelUsage ? new Date(stats.lastResetModelUsage) : new Date(0);
    
    if (lastReset < mostRecentReset) {
        console.log("Đã qua 17:00. Reset giới hạn sử dụng Model...");
        stats.modelUsage = {};
        stats.lastResetModelUsage = now.toISOString();
        writeStats(stats);
    }
    return stats;
}

function writeStats(stats) {
    try {
        if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
        fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    } catch (e) {
        console.error("Error writing stats:", e);
    }
}

function incrementDailyStat() {
    const today = new Date().toISOString().split('T')[0];
    const stats = readStats();
    if (!stats.history) stats.history = {};
    if (!stats.history[today]) stats.history[today] = { count: 0 };
    stats.history[today].count += 1;
    writeStats(stats);
    return stats.history[today].count;
}

function incrementPromptCount(modelName, apiKeyId) {
    const stats = readStats(); // readStats đã bao gồm logic reset 5h chiều
    if (typeof stats.promptCount !== 'number') stats.promptCount = 0;
    stats.promptCount += 1;

    if (!stats.modelUsage) stats.modelUsage = {};
    if (!stats.modelUsage[apiKeyId]) stats.modelUsage[apiKeyId] = {};
    if (!stats.modelUsage[apiKeyId][modelName]) stats.modelUsage[apiKeyId][modelName] = 0;
    
    stats.modelUsage[apiKeyId][modelName] += 1;

    writeStats(stats);
    return stats.modelUsage[apiKeyId][modelName];
}

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
        } catch (e) {}
    });
    return files;
}

function scanVideosInternal(jobs, excelFilePath) {
    const rootDir = path.dirname(excelFilePath);
    const excelNameNoExt = path.basename(excelFilePath, '.xlsx');
    const subDir = path.join(rootDir, excelNameNoExt);
    const videoFiles = getFilesFromDirectories([rootDir, subDir]);
    
    return jobs.map(job => {
        if (job.videoPath && fs.existsSync(job.videoPath)) return job;
        const jobId = job.id; 
        if (jobId) {
            const idNumber = jobId.replace(/[^0-9]/g, '');
            if (idNumber) {
               const regex = new RegExp(`Job_0*${idNumber}(?:[^0-9]|$)`, 'i');
               const matchedFile = videoFiles.find(f => regex.test(path.basename(f)));
               if (matchedFile) return { ...job, videoPath: matchedFile, status: 'Completed' };
            }
        }
        if (job.videoName) {
             const cleanName = job.videoName.trim();
             const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
             const nameRegex = new RegExp(`${escapedName}(?:[^0-9]|$)`, 'i');
             const matchedFileByName = videoFiles.find(f => nameRegex.test(path.basename(f, path.extname(f))));
             if (matchedFileByName) return { ...job, videoPath: matchedFileByName, status: 'Completed' };
        }
        return job;
    });
}

function syncStatsAndState(filePath, jobs, explicitInit = false) {
    if (!fileJobStates.has(filePath)) {
        fileJobStates.set(filePath, new Set());
    }
    const knownCompletedSet = fileJobStates.get(filePath);
    const updatedJobs = scanVideosInternal(jobs, filePath);
    updatedJobs.forEach(job => {
        const hasVideo = !!job.videoPath;
        const jobId = job.id;
        if (hasVideo) {
            if (!knownCompletedSet.has(jobId)) {
                knownCompletedSet.add(jobId);
                if (!explicitInit) incrementDailyStat();
            }
        } else {
            if (knownCompletedSet.has(jobId)) knownCompletedSet.delete(jobId);
        }
    });
    return { updatedJobs };
}

function getFfmpegPath() {
    const binary = 'ffmpeg';
    const binaryName = process.platform === 'win32' ? `${binary}.exe` : binary;
    const basePath = app.isPackaged ? path.join(process.resourcesPath, 'ffmpeg') : path.join(__dirname, 'resources', 'ffmpeg');
    const platformFolder = process.platform === 'win32' ? 'win' : 'mac';
    return path.join(basePath, platformFolder, binaryName);
}

function parseExcelData(data) {
    try {
        const workbook = XLSX.read(data, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const dataAsArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
        if (!dataAsArrays || dataAsArrays.length < 2) return [];
        const headerMap = {};
        dataAsArrays[0].forEach((h, i) => { headerMap[String(h).trim()] = i; });
        return dataAsArrays.slice(1).map((rowArray, index) => {
            const get = (h) => rowArray[headerMap[h]] || '';
            const statusStr = String(get('STATUS')).trim();
            return {
                id: get('JOB_ID') || `job_${index + 1}`,
                prompt: get('PROMPT') || '',
                imagePath: get('IMAGE_PATH') || '',
                imagePath2: get('IMAGE_PATH_2') || '',
                imagePath3: get('IMAGE_PATH_3') || '',
                status: ['Pending', 'Processing', 'Generating', 'Completed', 'Failed'].includes(statusStr) ? statusStr : 'Pending',
                videoName: get('VIDEO_NAME') || '',
                typeVideo: get('TYPE_VIDEO') || '',
                videoPath: get('VIDEO_PATH') || undefined,
            };
        }).filter(job => job.id);
    } catch (e) { return []; }
}

async function updateExcelStatus(filePath, jobIdsToUpdate, newStatus = '') {
    try {
        const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const dataAsArrays = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
        const headers = dataAsArrays[0].map(h => String(h).trim());
        const jIdx = headers.indexOf('JOB_ID'), sIdx = headers.indexOf('STATUS');
        for (let i = 1; i < dataAsArrays.length; i++) if (jobIdsToUpdate.includes(dataAsArrays[i][jIdx])) dataAsArrays[i][sIdx] = newStatus;
        const newWs = XLSX.utils.aoa_to_sheet(dataAsArrays);
        const newWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWb, newWs, sheetName);
        fs.writeFileSync(filePath, XLSX.write(newWb, { bookType: 'xlsx', type: 'buffer' }));
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

function showWindowAndNotify(title, message, type = 'completion') {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.webContents.send('show-alert-modal', { title, message, type });
    }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920, height: 1080,
    webPreferences: { contextIsolation: false, nodeIntegration: true },
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png')
  });
  mainWindow.loadFile(app.isPackaged ? path.join(__dirname, 'dist', 'index.html') : 'index.html');
  autoUpdater.on('update-downloaded', () => showWindowAndNotify('Có bản cập nhật mới!', 'Vui lòng nhấn OK để khởi động lại.', 'update'));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [{ role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }] },
    { label: 'Help', submenu: [{ label: 'Hướng dẫn sử dụng', click: () => {
        const guideWin = new BrowserWindow({ width: 900, height: 700, title: 'Hướng dẫn sử dụng' });
        guideWin.loadFile(app.isPackaged ? path.join(__dirname, 'dist', 'guide.html') : 'guide.html');
        guideWin.setMenu(null);
    }}] }
  ]));
  createWindow();
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  
  // Timer định kỳ kiểm tra stuck jobs và reset giới hạn 5h chiều
  setInterval(() => {
    // Tự động kiểm tra reset 5h chiều
    readStats();

    const now = Date.now();
    for (const [filePath, jobMap] of jobStateTimestamps.entries()) {
        const stuckIds = [];
        for (const [id, state] of jobMap.entries()) if (['Processing', 'Generating'].includes(state.status) && (now - state.timestamp > 300000)) stuckIds.push(id); // Giới hạn 5 phút (300,000ms)
        if (stuckIds.length > 0) {
            console.log(`Auto-resetting ${stuckIds.length} stuck jobs in ${filePath}`);
            updateExcelStatus(filePath, stuckIds, '');
        }
    }
  }, 60000);
});

ipcMain.handle('get-app-config', () => readConfig());
ipcMain.handle('save-app-config', async (e, cfg) => { writeConfig({ ...readConfig(), ...cfg }); return { success: true }; });
ipcMain.handle('verify-admin', async (e, { username, password }) => (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) ? { success: true } : { success: false, error: 'Sai thông tin' });
ipcMain.handle('delete-all-stats', async () => { writeStats({ history: {}, promptCount: 0, modelUsage: {}, lastResetModelUsage: new Date().toISOString() }); return { success: true }; });
ipcMain.handle('get-stats', async () => {
    const stats = readStats(), config = readConfig();
    const history = Object.entries(stats.history || {}).map(([date, d]) => ({ date, count: d.count })).sort((a,b) => new Date(b.date) - new Date(a.date));
    return {
        machineId: config.machineId || 'Unknown',
        history,
        total: history.reduce((s, i) => s + i.count, 0),
        promptCount: stats.promptCount || 0,
        modelUsage: stats.modelUsage || {},
        totalCredits: history.reduce((s, i) => s + i.count, 0) * 10
    };
});

ipcMain.handle('increment-prompt-count', async (event, { modelName, apiKeyId }) => {
    try {
        const count = incrementPromptCount(modelName, apiKeyId);
        return { success: true, count };
    } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('save-file-dialog', async (event, { defaultPath, fileContent }) => {
    const res = await dialog.showSaveDialog(mainWindow, { title: 'Lưu Kịch Bản', defaultPath, filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
    if (res.filePath) {
        fs.writeFileSync(res.filePath, Buffer.from(fileContent));
        return { success: true, filePath: res.filePath };
    }
    return { success: false };
});

ipcMain.handle('open-file-dialog', async () => {
    const res = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
    if (res.canceled) return { success: false };
    return { success: true, files: res.filePaths.map(p => ({ path: p, name: path.basename(p), content: fs.readFileSync(p) })) };
});

ipcMain.on('start-watching-file', (event, filePath) => {
    if (fileWatchers.has(filePath)) return;
    jobStateTimestamps.set(filePath, new Map());
    try { if (fs.existsSync(filePath)) syncStatsAndState(filePath, parseExcelData(fs.readFileSync(filePath)), true); } catch (e) {}
    let debounce;
    fileWatchers.set(filePath, fs.watch(filePath, (ev) => {
        if (ev === 'change') {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => {
                if (!fs.existsSync(filePath)) return;
                const buf = fs.readFileSync(filePath), raw = parseExcelData(buf);
                const { updatedJobs } = syncStatsAndState(filePath, raw, false);
                const jobMap = jobStateTimestamps.get(filePath), now = Date.now();
                updatedJobs.forEach(j => {
                    if (['Processing', 'Generating'].includes(j.status)) {
                        if (!jobMap.has(j.id) || jobMap.get(j.id).status !== j.status) jobMap.set(j.id, { status: j.status, timestamp: now });
                    } else jobMap.delete(j.id);
                });
                event.sender.send('file-content-updated', { path: filePath, content: buf });
                if (updatedJobs.length > 0 && updatedJobs.every(j => !!j.videoPath || j.status === 'Completed')) showWindowAndNotify('Hoàn tất xử lý!', `File "${path.basename(filePath)}" đã xong.`, 'completion');
            }, 100);
        }
    }));
});

ipcMain.on('stop-watching-file', (e, p) => { if (fileWatchers.has(p)) { fileWatchers.get(p).close(); fileWatchers.delete(p); } jobStateTimestamps.delete(p); });
ipcMain.handle('find-videos-for-jobs', async (e, { jobs, excelFilePath }) => ({ success: true, jobs: syncStatsAndState(excelFilePath, jobs, false).updatedJobs }));
ipcMain.handle('check-ffmpeg', async () => ({ found: fs.existsSync(getFfmpegPath()) }));
ipcMain.handle('open-video-file-dialog', async () => {
    const res = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Videos', extensions: ['mp4','mov','avi','mkv'] }] });
    return !res.canceled ? { success: true, path: res.filePaths[0] } : { success: false };
});

ipcMain.handle('execute-ffmpeg-combine', async (event, { jobs, targetDuration, mode, excelFileName }) => {
    const res = await dialog.showSaveDialog(mainWindow, { title: 'Lưu Video', defaultPath: `Combined_${excelFileName.replace('.xlsx', '')}.mp4`, filters: [{ name: 'MP4', extensions: ['mp4'] }] });
    if (res.canceled) return { success: false };
    const listPath = path.join(path.dirname(res.filePath), `list_${Date.now()}.txt`);
    fs.writeFileSync(listPath, jobs.map(j => `file '${j.videoPath.replace(/'/g, "'\\''")}'`).join('\n'));
    const args = ['-f', 'concat', '-safe', '0', '-i', listPath];
    if (mode === 'timed' && targetDuration) args.push('-t', String(targetDuration));
    args.push('-c', 'copy', '-y', res.filePath);
    return new Promise(r => execFile(getFfmpegPath(), args, (err) => { try{fs.unlinkSync(listPath);}catch(e){} r(err ? { success: false, error: err.message } : { success: true, filePath: res.filePath }); }));
});

ipcMain.on('open-folder', (e, p) => fs.existsSync(p) && shell.openPath(p));
ipcMain.on('open-video-path', (e, p) => fs.existsSync(p) && shell.openPath(p));
ipcMain.handle('delete-video-file', async (e, p) => {
    const choice = await dialog.showMessageBox(mainWindow, { type: 'question', buttons: ['Hủy', 'Xóa'], title: 'Xác nhận', message: 'Xóa video?' });
    if (choice.response === 1 && fs.existsSync(p)) { fs.unlinkSync(p); return { success: true }; }
    return { success: false };
});

ipcMain.handle('retry-job', async (e, { filePath, jobId }) => updateExcelStatus(filePath, [jobId], ''));
ipcMain.handle('retry-stuck-jobs', async (e, { filePath }) => {
    const jobs = parseExcelData(fs.readFileSync(filePath));
    const stuck = jobs.filter(j => ['Processing','Generating'].includes(j.status)).map(j => j.id);
    return stuck.length ? updateExcelStatus(filePath, stuck, '') : { success: true };
});

ipcMain.handle('open-tool-flow', async () => {
    const p = readConfig().toolFlowPath;
    if (p && fs.existsSync(p)) { spawn(p, [], { detached: true, stdio: 'ignore' }).unref(); return { success: true }; }
    return { success: false };
});

ipcMain.handle('set-tool-flow-path', async () => {
    const res = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Executables', extensions: ['exe'] }] });
    if (!res.canceled) { writeConfig({ ...readConfig(), toolFlowPath: res.filePaths[0] }); return { success: true, path: res.filePaths[0] }; }
    return { success: false };
});

ipcMain.on('restart_app', () => autoUpdater.quitAndInstall());
