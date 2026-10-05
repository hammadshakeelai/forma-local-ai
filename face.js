import { TalkingHead } from '@met4citizen/talkinghead';
import { HeadAudio } from './public/face/headaudio.min.mjs';

let head, lips, source;
const base = import.meta.env.BASE_URL;

export async function initFace() {
  head = new TalkingHead(document.getElementById('avatar-stage'), {
    cameraView: 'head', cameraDistance: 0.2, cameraY: 0.65,
    lipsyncModules: [], ttsEndpoint: null,
    modelPixelRatio: 1,
    lightAmbientIntensity: 2, lightDirectIntensity: 8,
  });
  await head.showAvatar({ url: `${base}face/julia.glb`, body: 'F', avatarMood: 'neutral' });
  await head.audioCtx.audioWorklet.addModule(`${base}face/headworklet.min.mjs`);
  lips = new HeadAudio(head.audioCtx, { parameterData: { silMode: 0 } });
  await lips.loadModel(`${base}face/model-en-mixed.bin`);
  lips.onvalue = (key, value) => {
    if (head.mtAvatar[key]) Object.assign(head.mtAvatar[key], { newvalue: value, needsUpdate: true });
  };
  head.opt.update = lips.update.bind(lips);
  document.getElementById('avatar-panel').classList.add('face-ready');
}

export async function unlockFace() {
  if (head) await head.audioCtx.resume();
}

export function connectFace(audio) {
  if (!lips) return;
  source?.disconnect();
  source = head.audioCtx.createMediaElementSource(audio);
  source.connect(lips);
  source.connect(head.audioCtx.destination);
}

export function stopFace() {
  source?.disconnect(); source = null;
  if (lips) lips.visemeActive = -1;
}
