export CUDA_VISIBLE_DEVICES=0
export GGML_CUDA_NO_PINNED=1  # 如果遇到内存问题

./build/bin/whisper-server \
  --model /data2/hezm/project/gaowei-meeting-v2/gaowei-meeting-ai/packages/whisper-engine/src/whisper-cpp-server/models/whisper-large-v3-ggml/ggml-model.bin \
  --port 8081 \
  --host 0.0.0.0 \
  --flash-attn \
  --no-context \
  --threads 4 \
  --processors 1
