# Depth prototype (Phase 0)

Browser prototype for `docs/SPLAT_DEPTH_PLAN_v1.md`: Depth Anything V2 Small on WebGPU drives depth-lifted surfels, points and sorted Gaussians under a bounded orbit. Findings are in `RESULTS_v1.md` to `RESULTS_v9.md` and `AUDIT_v1.md`; read the audit before trusting v1 to v4.

## Restore the files git does not keep

They are large or derived, so they are git-ignored. From this folder:

```
# Model (Apache-2.0), onnx-community/depth-anything-v2-small
curl -L -o models/model_fp16.onnx  https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_fp16.onnx
curl -L -o models/model_q4f16.onnx https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_q4f16.onnx

# onnxruntime-web 1.30.0 WASM (MIT); the .mjs files are committed
curl -L https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.30.0.tgz | tar -xz -C /tmp
cp /tmp/package/dist/ort-wasm-simd-threaded*.wasm vendor/ort/

# Test clips (from ciamac-site/deploy/pointfield) and the matched-test frames
ffmpeg -ss 4 -i ~/Developer/ciamac-site/deploy/pointfield/default.mp4 -t 10 -an -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart media/default-10s.mp4
ffmpeg -ss 4 -i ~/Developer/ciamac-site/deploy/pointfield/luchi.mp4   -t 10 -an -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart media/luchi-10s.mp4
ffmpeg -ss 4 -i ~/Developer/ciamac-site/deploy/pointfield/claudia.mp4 -t 10 -an -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart media/claudia-10s.mp4
ffmpeg -ss 4 -i ~/Developer/ciamac-site/deploy/pointfield/default.mp4 -t 30 -an -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart media/default30-10s.mp4
mkdir -p frames && ffmpeg -i media/default30-10s.mp4 -q:v 2 -start_number 0 frames/f_%04d.jpg
```

## Run

```
python3 server.py 8791     # port 8765 is AutoMedia's
```

Open http://127.0.0.1:8791/ in Safari and keep the window in front (a background window gives stale video frames and slow bakes; see AUDIT_v1).

- `?bench=1&parts=...`: automated measurements (infer, render, shots, video, rec, bake, persist, longbake).
- `?matched=1&targets=...&edge=|snap=|tilt=|motion=...`: matched-frame tests on ffmpeg frames.

Results POST to `results/`. Full-resolution screenshots, recordings and .pfd sidecars stay local.
