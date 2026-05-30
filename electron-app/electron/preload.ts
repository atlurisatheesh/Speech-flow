import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  transcribeFinal: (audioBlob: ArrayBuffer) => ipcRenderer.invoke('transcribe-final', audioBlob),
  transcribeText: (audioBlob: ArrayBuffer) => ipcRenderer.invoke('transcribe-text', audioBlob),
  enhanceText: (text: string) => ipcRenderer.invoke('enhance-text', text),
  getClipboard: () => ipcRenderer.invoke('get-clipboard'),
  getActiveWindow: () => ipcRenderer.invoke('get-active-window'),
  pasteText: (text: string) => ipcRenderer.send('paste-text', text),
  resizeWindow: (width: number, height: number) => ipcRenderer.send('resize-window', width, height),
  updateSettings: (settings: object) => ipcRenderer.send('update-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  onToggleDictation: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('toggle-dictation', handler);
    return () => {
      ipcRenderer.removeListener('toggle-dictation', handler);
    };
  }
});
