export interface IElectronAPI {
  transcribeFinal: (audioBlob: ArrayBuffer) => Promise<string>;
  enhanceText: (text: string) => Promise<string>;
  getClipboard: () => Promise<string>;
  pasteText: (text: string) => void;
  resizeWindow: (width: number, height: number) => void;
  onToggleDictation: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}
