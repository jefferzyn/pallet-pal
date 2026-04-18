// Extract evenly-spaced JPEG frames from a video File using a hidden video + canvas.
export async function extractFrames(file: File, count = 6, maxWidth = 720): Promise<string[]> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Failed to load video"));
    });

    const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const canvas = document.createElement("canvas");
    const ratio = video.videoWidth ? Math.min(1, maxWidth / video.videoWidth) : 1;
    canvas.width = Math.round((video.videoWidth || maxWidth) * ratio);
    canvas.height = Math.round((video.videoHeight || maxWidth) * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");

    const frames: string[] = [];
    for (let i = 0; i < count; i++) {
      const t = (duration * (i + 0.5)) / count;
      await seek(video, Math.min(t, duration - 0.05));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.7));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}
