import * as engine from './engine.js';
import { initFace, unlockFace, connectFace, stopFace } from './face.js';
const $ = id => document.getElementById(id);
let history = [], busy = false, spoken = false, recording = null, stream = null;
let audio = null, audioUrl = null, generation = 0, controller = null, recordTimer = null;
let inferenceQueue = Promise.resolve();
const input = $('message-input');
function presence(text, state = '') {
  $('presence-label').textContent = text; $('chat-status').textContent = text;
  $('avatar-panel').classList.remove('speaking', 'listening');
  if (state) $('avatar-panel').classList.add(state);
}
function message(text, role = 'assistant') {
  const node = document.createElement('div'); node.className = `message ${role}`;
  const label = document.createElement('span'); label.className = 'message-label'; label.textContent = role === 'user' ? 'YOU' : 'AVA';
  const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = text;
  node.append(label, bubble); $('messages').append(node); $('messages').scrollTop = $('messages').scrollHeight; return node;
}
function stopAudio() {
  stopFace();
  audio?.pause(); audio = null;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
}
function setBusy(value) {
  busy = value; $('send-button').disabled = value; $('mic-button').disabled = value;
  $('preview-button').disabled = value;
}
async function infer(kind, data, signal) {
  const token = generation;
  const report = text => { if (token === generation) $('feedback').textContent = text; };
  const work = inferenceQueue.catch(() => {}).then(async () => {
  if (signal?.aborted) throw new DOMException('Canceled', 'AbortError');
  if (kind === 'chat') return engine.chat(data, report);
  if (kind === 'listen') return engine.transcribe(data, report);
  return engine.speak(data, report, signal);
  });
  inferenceQueue = work;
  return work;
}
async function send(text) {
  if (busy || recording || !text.trim()) return;
  const token = generation;
  stopAudio(); setBusy(true); unlockFace().catch(() => {}); $('feedback').textContent = ''; input.value = ''; $('suggestions').hidden = true;
  const userMessage = { role: 'user', content: text.trim().slice(0, 600) };
  message(userMessage.content, 'user'); presence('Ava is thinking');
  const thinking = message('•••'); thinking.classList.add('typing'); controller = new AbortController();
  try {
    const reply = await infer('chat', [...history, userMessage], controller.signal);
    if (token !== generation) return;
    thinking.remove(); message(reply);
    history = [...history, userMessage, { role: 'assistant', content: reply }].slice(-8);
    presence('Ready when you are'); $('feedback').textContent = '';
    if (spoken) {
      presence('Preparing voice');
      const blob = await infer('speak', reply, controller.signal);
      if (token !== generation || !spoken) return;
      audioUrl = URL.createObjectURL(blob); audio = new Audio(audioUrl); connectFace(audio);
      audio.onended = () => { if (token === generation) { stopAudio(); presence('Ready when you are'); } };
      await audio.play(); presence('Ava is speaking', 'speaking'); $('feedback').textContent = '';
    }
  } catch (error) {
    if (token === generation && error.name !== 'AbortError') { thinking.remove(); $('feedback').textContent = error.message || 'Couldn’t connect. Make sure server.py is running.'; presence('Ready when you are'); }
  } finally { if (token === generation) setBusy(false); }
}
function reset() {
  generation++; controller?.abort(); clearTimeout(recordTimer);
  if (recording?.state === 'recording') recording.stop();
  recording = null; stream?.getTracks().forEach(track => track.stop()); stream = null;
  stopAudio(); setBusy(false); history = []; input.value = '';
  $('messages').replaceChildren(); message('Hey, I’m Ava. 👋\nI run locally in your browser. What’s on your mind?');
  $('suggestions').hidden = false; $('feedback').textContent = ''; $('mic-button').setAttribute('aria-label', 'Start recording'); presence('Ready when you are');
}
$('chat-form').addEventListener('submit', event => { event.preventDefault(); send(input.value); });
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => send(button.dataset.prompt)));
$('reset-button').addEventListener('click', reset);
function sound(enabled) {
  unlockFace().catch(() => {});
  spoken = enabled; $('sound-button').classList.toggle('sound-on', enabled);
  $('sound-button').setAttribute('aria-pressed', String(enabled)); $('sound-button').setAttribute('aria-label', `Turn spoken replies ${enabled ? 'off' : 'on'}`);
  if (!enabled) { stopAudio(); if (!busy) presence('Ready when you are'); }
}
$('sound-button').addEventListener('click', () => sound(!spoken));
// Preview the small voice and face models without downloading the chat model.
$('preview-button').addEventListener('click', async () => {
  if (busy || recording) return;
  const token = generation; stopAudio(); setBusy(true); unlockFace().catch(() => {});
  controller = new AbortController();
  try {
    const blob = await infer('speak', 'Hi, I am Ava. My voice and my face run right here in your browser. What is on your mind?', controller.signal);
    if (token !== generation) return;
    audioUrl = URL.createObjectURL(blob); audio = new Audio(audioUrl); connectFace(audio);
    audio.onended = () => { if (token === generation) { stopAudio(); presence('Ready when you are'); } };
    await audio.play(); presence('Ava is speaking', 'speaking'); $('feedback').textContent = '';
  } catch (error) {
    if (token === generation && error.name !== 'AbortError') { $('feedback').textContent = error.message; presence('Ready when you are'); }
  } finally { if (token === generation) setBusy(false); }
});
function mode(voice) {
  if (recording || busy) return;
  $('voice-mode').classList.toggle('selected', voice); $('text-mode').classList.toggle('selected', !voice);
  $('voice-mode').setAttribute('aria-pressed', String(voice)); $('text-mode').setAttribute('aria-pressed', String(!voice));
  $('mic-button').hidden = !voice;
  input.placeholder = voice ? 'Tap the mic, then say hello…' : 'What’s on your mind?';
  $('composer-note').textContent = voice ? 'Tap to record. Tap again to stop. Review, then send.' : 'Local AI. Your conversation stays on this computer.';
  if (voice) sound(true);
}
$('voice-mode').addEventListener('click', () => mode(true)); $('text-mode').addEventListener('click', () => mode(false));
$('mic-button').addEventListener('click', async () => {
  if (busy) return;
  if (recording?.state === 'recording') { recording.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { $('feedback').textContent = 'Open this page on localhost in a current browser to record.'; return; }
  const token = generation; setBusy(true); stopAudio(); $('feedback').textContent = '';
  try {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (token !== generation) { mic.getTracks().forEach(track => track.stop()); return; }
    stream = mic; const recorder = new MediaRecorder(mic); recording = recorder; const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      clearTimeout(recordTimer); mic.getTracks().forEach(track => track.stop());
      if (token !== generation) return;
      recording = null; stream = null; setBusy(true); presence('Transcribing locally');
      $('mic-button').setAttribute('aria-label', 'Start recording'); controller = new AbortController();
      try {
        const text = await infer('listen', new Blob(chunks, { type: recorder.mimeType }), controller.signal);
        if (token !== generation) return;
        input.value = text; $('feedback').textContent = text ? 'Review your words, then press send.' : 'No speech detected. Try recording again.'; input.focus();
      } catch (error) { if (token === generation && error.name !== 'AbortError') $('feedback').textContent = error.message; }
      finally { if (token === generation) { setBusy(false); presence('Ready when you are'); } }
    };
    recorder.start(); setBusy(false); presence('Listening to you', 'listening'); $('mic-button').setAttribute('aria-label', 'Stop recording');
    recordTimer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 30000);
  } catch (error) {
    if (token === generation) { stream?.getTracks().forEach(track => track.stop()); stream = null; recording = null; setBusy(false); $('feedback').textContent = error.name === 'NotAllowedError' ? 'Allow microphone access in browser settings, or type a message.' : 'Microphone couldn’t start. Check that one is connected.'; presence('Ready when you are'); }
  }
});
const dialog = $('about-dialog'); $('about-button').onclick = () => dialog.showModal();
$('close-about').onclick = $('back-to-chat').onclick = () => dialog.close();
window.addEventListener('pagehide', () => { controller?.abort(); stream?.getTracks().forEach(track => track.stop()); stopAudio(); });
reset();
initFace().catch(error => { $('feedback').textContent = 'The 3D face couldn’t load. Text chat is still available.'; console.error(error); });
