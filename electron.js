// electron.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // WARNING: In a production app, it's more secure to set contextIsolation to true
      // and use a preload script to expose specific functionalities.
      // For this project's structure, these settings help everything work out of the box.
      contextIsolation: false,
      nodeIntegration: true,
    },
    // The icon path assumes you will create an 'assets' folder.
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // Load the index.html file of the app.
  mainWindow.loadFile('index.html');

  // Optional: Uncomment the line below to open developer tools on startup.
  // mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished initialization
// and is ready to create browser windows.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
