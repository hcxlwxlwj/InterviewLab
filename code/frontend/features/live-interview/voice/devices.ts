export type PreparedVoiceDevices = {
  context: AudioContext;
  media: MediaStream;
  camera: MediaStream | null;
};

/** Autoplay policy may leave resume pending until another gesture; surface a recoverable state. */
export async function resumeVoiceContext(context: AudioContext): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      context.resume(),
      new Promise<void>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('浏览器尚未允许声音，请点击重试设备检查。')),
          4000,
        );
      }),
    ]);
    if (context.state !== 'running') throw new Error('浏览器音频尚未启动，请点击重试设备检查。');
  } finally {
    clearTimeout(timer);
  }
}

export function voiceDeviceError(error: unknown, video = false): Error {
  if (error instanceof DOMException && error.name === 'NotAllowedError')
    return new Error(
      video
        ? '未获得麦克风或摄像头权限，请在浏览器地址栏允许后重试。'
        : '未获得麦克风权限，请在浏览器地址栏允许麦克风后重试。',
    );
  if (error instanceof DOMException && error.name === 'NotFoundError')
    return new Error('找不到所选麦克风或摄像头，请选择其他输入设备后重试。');
  if (error instanceof DOMException && error.name === 'NotReadableError')
    return new Error('浏览器无法读取媒体设备，请检查设备占用并重新选择输入设备。');
  if (error instanceof DOMException && error.name === 'OverconstrainedError')
    return new Error('所选媒体设备已不可用，请选择其他输入设备后重试。');
  return error instanceof Error ? error : new Error('无法启动媒体设备。');
}

/** Call directly from the launch click, before waiting for creation or preparation requests. */
export async function prepareVoiceDevices(video: boolean): Promise<PreparedVoiceDevices> {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode || !window.isSecureContext)
    throw new Error('当前浏览器无法使用实时语音，请使用新版 Chrome 并通过本机地址或 HTTPS 访问。');
  const context = new AudioContext();
  let media: MediaStream | undefined;
  let camera: MediaStream | null = null;
  try {
    await resumeVoiceContext(context);
    media = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    if (!media.getAudioTracks().length)
      throw new Error('浏览器未提供麦克风音轨，请选择其他输入设备。');
    if (video) {
      camera = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      if (!camera.getVideoTracks().length)
        throw new Error('浏览器未提供摄像头画面，请选择其他设备。');
    }
    return { context, media, camera };
  } catch (error) {
    media?.getTracks().forEach((track) => track.stop());
    camera?.getTracks().forEach((track) => track.stop());
    await context.close().catch(() => {});
    throw voiceDeviceError(error, video);
  }
}

export function releaseVoiceDevices(devices: PreparedVoiceDevices): void {
  devices.media.getTracks().forEach((track) => track.stop());
  devices.camera?.getTracks().forEach((track) => track.stop());
  if (devices.context.state !== 'closed') void devices.context.close().catch(() => {});
}
