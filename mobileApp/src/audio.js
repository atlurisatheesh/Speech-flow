import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// Request mic permission + configure audio mode for recording.
export async function ensureAudioReady() {
  const perm = await Audio.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Microphone permission denied');
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
}

export async function startRecording() {
  await ensureAudioReady();
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  return recording;
}

export async function stopRecording(recording) {
  await recording.stopAndUnloadAsync();
  // Restore normal playback routing after recording (iOS)
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
  return recording.getURI();
}

// Play an mp3 returned as base64 (assistant voice reply).
export async function playBase64Audio(base64) {
  if (!base64) return;
  const path = `${FileSystem.cacheDirectory}reply-${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  const { sound } = await Audio.Sound.createAsync({ uri: path });
  await sound.playAsync();
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.didJustFinish) sound.unloadAsync();
  });
}
