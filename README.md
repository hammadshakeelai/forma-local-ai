# Forma — a tiny, local AI companion for the web

A static website for GitHub Pages. Chat, listening, speech, and face animation run on the visitor's device. No Python, API keys, hosted inference, or database.

[Public repository](https://github.com/hammadshakeelai/forma-local-ai) · [Website](https://hammadshakeelai.github.io/forma-local-ai/)

**Prototype status:** The current visual component is a 3D avatar, not a video-generation model. A real talking-face video model remains to be implemented. The build passes, but chat and voice still need complete browser verification. Do not treat this as a finished working release.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173 in desktop Chrome or Edge with WebGPU enabled. Models download on first use and browser storage caches them. Performance depends on the device. First-time downloads can take several minutes.

## Four local models

| Part | Model | What it does |
| --- | --- | --- |
| Chat | SmolLM2 135M Instruct, 4-bit ONNX | Short conversational replies |
| Listening | Whisper Tiny English, 8-bit ONNX | Recorded speech to text |
| Voice | Kitten TTS Nano, 15M parameters, about 26 MB | English speech synthesis |
| Face | HeadAudio, 14,352-byte trained classifier | Audio-driven visemes on a rendered human avatar |

The face is a real-time 3D animation, **not a photorealistic video-generation model**. HeadAudio predicts mouth shapes from audio using learned Gaussian prototypes; TalkingHead renders and animates the avatar, including blinking. This keeps the visual model extremely small. The avatar GLB is about 4.7 MB.

Type a message or choose a starter. For voice, select **Use your voice**, tap the mic, speak, tap again to stop, review, then send. Recording stops after 30 seconds. The speaker control enables or mutes generated replies. First use downloads models; progress appears below the input.

The small chat model has limited reasoning and factual accuracy. English only. Text chat can attempt a slower WASM fallback; Kitten voice needs WebGPU. Browser storage can evict model caches. Offline inference depends on cached assets; the site itself still needs to be loaded, so full offline website support is not claimed.

## Publish to GitHub Pages

GitHub Pages is configured for this repository. The included workflow builds and publishes `dist/` on pushes to `main`. For a fork, enable **GitHub Actions** under **Settings → Pages → Build and deployment**.

Use `npm run build` to create a static production build and `npm run preview` to check it. Relative asset paths support a project URL such as `https://YOUR-NAME.github.io/YOUR-REPO/`.

GitHub Pages only serves code and assets. Models are downloaded from Hugging Face and run locally in the visitor's browser. Model weights aren't committed to the repository. Conversation text and recordings aren't sent to a remote inference API.

## Small codebase

- `app.js`: chat controls, microphone recording, audio playback.
- `engine.js`: three browser inference functions.
- `face.js`: 3D avatar + tiny audio-to-viseme model.
- `index.html` / `styles.css`: interface.
- `public/face`: avatar, classifier weights, worklet, MIT license.
- `.github/workflows/pages.yml`: static publishing workflow.

## Credits and licenses

[Transformers.js](https://github.com/huggingface/transformers.js), [SmolLM2 ONNX](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct), [Whisper ONNX](https://huggingface.co/onnx-community/whisper-tiny.en), [Kitten TTS WebGPU](https://github.com/svenflow/kitten-tts-webgpu), [Kitten models](https://github.com/KittenML/KittenTTS), [TalkingHead](https://github.com/met4citizen/TalkingHead), and [HeadAudio](https://github.com/met4citizen/HeadAudio). The Julia avatar and vendored HeadAudio files are from HeadAudio's MIT-licensed repository. Its license is preserved in `public/face/LICENSE`.

Application source is MIT licensed. Third-party software, avatars, and model weights retain their own licenses; see `THIRD_PARTY.md`.
