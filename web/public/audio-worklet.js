// PCM capture worklet: forwards mono Float32 audio frames to the main thread.
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      // Copy so the main thread can safely transfer/hold the buffer.
      const copy = new Float32Array(input[0]);
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true;
  }
}
registerProcessor("pcm-processor", PCMProcessor);
