// All inference runs on the visitor's device. No chat or audio API calls.
let generator, recognizer, transformers, kitten, voiceEngine;

async function library() {
  if (!transformers) {
    transformers = await import('@huggingface/transformers');
    transformers.env.allowLocalModels = false;
    transformers.env.useBrowserCache = true;
    transformers.env.backends.onnx.wasm.numThreads = 1;
  }
  return transformers;
}
function progress(label, report) {
  return event => {
    if (event.status === 'progress') report(`${label}: ${Math.round(event.progress || 0)}% (${event.file || 'model'})`);
  };
}

export async function chat(messages, report) {
  if (!generator) {
    report('Downloading the small chat model. First run can take a few minutes…');
    const { pipeline } = await library();
    generator = await pipeline('text-generation', 'HuggingFaceTB/SmolLM2-135M-Instruct', {
      dtype: 'q4', device: navigator.gpu ? 'webgpu' : 'wasm',
      progress_callback: progress('Loading chat', report),
    });
  }
  report('Ava is thinking');
  const context = [{ role: 'system', content: 'You are Ava, a warm AI companion. Reply in 1 to 3 short sentences in English. Be honest that you are an AI.' }, ...messages.slice(-5)];
  const result = await generator(context, { max_new_tokens: 100, do_sample: false });
  const generated = result[0].generated_text;
  return Array.isArray(generated) ? generated.at(-1).content : generated;
}

export async function transcribe(blob, report) {
  if (!recognizer) {
    report('Downloading Whisper Tiny for local listening…');
    const { pipeline } = await library();
    recognizer = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', {
      dtype: 'q8', device: 'wasm', progress_callback: progress('Loading listening', report),
    });
  }
  report('Transcribing on your device');
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const result = await recognizer(decoded.getChannelData(0), { chunk_length_s: 30, stride_length_s: 5 });
    return result.text.trim();
  } finally { await ctx.close(); }
}

export async function speak(text, report, signal) {
  if (!navigator.gpu) throw new Error('The tiny voice model needs WebGPU. Try a desktop Chrome or Edge browser. Text chat still works.');
  if (!kitten) kitten = await import('kitten-tts-webgpu');
  if (!voiceEngine) {
    report('Downloading the tiny voice model (about 26 MB)…');
    const urls = [
      'https://huggingface.co/KittenML/kitten-tts-nano-0.8-int8/resolve/main/kitten_tts_nano_v0_8.onnx',
      'https://huggingface.co/KittenML/kitten-tts-nano-0.8-int8/resolve/main/voices.npz',
    ];
    const local = [];
    try {
      const cache = await caches.open('forma-voice-v1').catch(() => null);
      for (const url of urls) {
        let response = await cache?.match(url);
        if (!response) {
          const timeout = AbortSignal.timeout(600000);
          response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
          if (!response.ok) throw new Error('Voice model download failed. Check your connection and try again.');
          const total = Number(response.headers.get('Content-Length'));
          const reader = response.body.getReader();
          const chunks = []; let received = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value); received += value.length;
            report(total ? `Loading voice: ${Math.round(received / total * 100)}%` : `Loading voice: ${(received / 1048576).toFixed(1)} MB`);
          }
          const blob = new Blob(chunks);
          response = new Response(blob);
          if (cache) await cache.put(url, new Response(blob)).catch(() => {});
        }
        local.push(URL.createObjectURL(await response.blob()));
      }
      const candidate = new kitten.KittenTTSEngine();
      await candidate.init();
      await candidate.loadModel(local[0], local[1]);
      voiceEngine = candidate;
    } finally { local.forEach(url => URL.revokeObjectURL(url)); }
  }
  report('Generating speech on your device');
  const clean = text.slice(0, 450);
  const { ids } = await kitten.textToInputIds(clean);
  const { waveform } = await voiceEngine.generate(ids, 'Bella', 1, clean.length);
  return kitten.float32ToWav(waveform, 24000);
}
