let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];

export async function startRecording(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.start();
}

export async function stopRecording(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) return reject(new Error('No active recording'));

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      // Stop all tracks to release the mic indicator
      mediaRecorder!.stream.getTracks().forEach((t) => t.stop());
      mediaRecorder = null;
      chunks = [];
      resolve(blob);
    };

    mediaRecorder.stop();
  });
}
