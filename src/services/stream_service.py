import av
import threading
import numpy as np
import queue
import time
from streamlit_webrtc import AudioProcessorBase
from src.services.audio_service import get_model

class StreamAudioProcessor(AudioProcessorBase):
    def __init__(self):
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_lock = threading.Lock()
        
        # Transcript storage (shared with UI)
        self.transcript_queue = queue.Queue()
        self.current_transcript = ""
        
        self.running = True
        self.thread = threading.Thread(target=self._process_loop)
        self.thread.daemon = True
        self.thread.start()
        
        self.model_lock = threading.Lock()
        
        # Resampler for 16kHz mono
        self.resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)
        
        # VAD / Silence Logic
        self.last_speech_time = time.time()
        self.silence_threshold = 0.01 # Tuning param for normalized float32
        self.silence_duration_limit = 1.0 # Reset after 1s silence

    def recv(self, frame: av.AudioFrame) -> av.AudioFrame:
        """
        Callback from WebRTC thread.
        Receives audio frames.
        """
        try:
            # Resample using PyAV
            chunk_frames = self.resampler.resample(frame)
            
            for digit_frame in chunk_frames:
                chunk_data = digit_frame.to_ndarray().flatten()
                
                # Normalize s16 to float32
                normalized = chunk_data.astype(np.float32) / 32768.0
                
                # Check Amplitude (Simple VAD)
                rms = np.sqrt(np.mean(normalized**2))
                
                current_time = time.time()
                if rms > self.silence_threshold:
                    self.last_speech_time = current_time
                else:
                    # Check silence duration
                    if current_time - self.last_speech_time > self.silence_duration_limit:
                        # Clear buffer on sustained silence (Enforce "One Breath")
                        with self.buffer_lock:
                            if len(self.audio_buffer) > 0:
                                # debug print
                                # print("Silence Reset Triggered")
                                self.audio_buffer = np.array([], dtype=np.float32)
                                
                with self.buffer_lock:
                    self.audio_buffer = np.concatenate((self.audio_buffer, normalized))
                    
        except Exception as e:
            print(f"Recv error: {e}")
             
        return frame

    def _process_loop(self):
        """
        Background thread to consume buffer and transcribe.
        """
        print("Stream Processor Started")
        
        while self.running:
            time.sleep(0.5) 
            
            # 1. Grab Buffer
            audio_to_process = None
            with self.buffer_lock:
                # Debug logging
                # print(f"Buffer size: {len(self.audio_buffer)}")
                
                # Process if we have enough audio (>= 0.5s)
                if len(self.audio_buffer) >= 16000 * 0.5: 
                    # Keep max 10s context 
                    if len(self.audio_buffer) > 16000 * 10:
                        self.audio_buffer = self.audio_buffer[-(16000*10):]
                        
                    audio_to_process = self.audio_buffer.copy()
            
            if audio_to_process is not None:
                try:
                    self.model_lock.acquire()
                    try:
                        # print("Running Transcription...")
                        model = get_model()
                        
                        # Use simple transcription
                        # Using small beam size for speed
                        segments, _ = model.transcribe(audio_to_process, beam_size=1, vad_filter=True) 
                        
                        full_text = " ".join([s.text for s in segments]).strip()
                        
                        # --- HALLUCINATION FILTERING ---
                        # 1. Common Hallucinations
                        hallucinations = ["You", "you", "MBC", "Reporter", "The end", "Okay", "Okay.", "okay", "Thank you"]
                        if full_text in hallucinations:
                             full_text = ""
                             
                        # 2. Repetition Filter ("Okay. Okay.")
                        # Check if over 50% of the string is just "Okay"
                        if "Okay" in full_text or "okay" in full_text:
                            clean_text = full_text.lower().replace("okay", "").replace(".", "").strip()
                            if len(clean_text) < 3: # Basically empty besides okay
                                full_text = ""
                        
                        if full_text:
                            print(f"Stream Transcript: '{full_text}'")
                             
                        # Update state
                        # Note: We don't clear self.current_transcript here if empty, 
                        # so the user can see their last attempt even after silence reset.
                        if full_text and full_text != self.current_transcript:
                             self.current_transcript = full_text
                             
                    finally:
                        self.model_lock.release()
                        
                except Exception as e:
                    print(f"Streaming Transcribe Error: {e}")
