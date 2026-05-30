// Tiny in-memory settings store for the scaffold (no extra deps).
// The assistant uses preset neural voices (per product decision — no voice cloning).
export const VOICE_OPTIONS = ['nova', 'alloy', 'echo', 'onyx', 'shimmer', 'sage'];

const state = {
  voice: 'nova',
};

export const getVoice = () => state.voice;
export const setVoice = (v) => {
  if (VOICE_OPTIONS.includes(v)) state.voice = v;
};
