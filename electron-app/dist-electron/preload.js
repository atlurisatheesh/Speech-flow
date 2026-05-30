"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    transcribeFinal: (audioBlob) => electron_1.ipcRenderer.invoke('transcribe-final', audioBlob),
    transcribeText: (audioBlob) => electron_1.ipcRenderer.invoke('transcribe-text', audioBlob),
    enhanceText: (text) => electron_1.ipcRenderer.invoke('enhance-text', text),
    getClipboard: () => electron_1.ipcRenderer.invoke('get-clipboard'),
    getActiveWindow: () => electron_1.ipcRenderer.invoke('get-active-window'),
    pasteText: (text) => electron_1.ipcRenderer.send('paste-text', text),
    resizeWindow: (width, height) => electron_1.ipcRenderer.send('resize-window', width, height),
    updateSettings: (settings) => electron_1.ipcRenderer.send('update-settings', settings),
    getSettings: () => electron_1.ipcRenderer.invoke('get-settings'),
    onToggleDictation: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('toggle-dictation', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('toggle-dictation', handler);
        };
    }
});
