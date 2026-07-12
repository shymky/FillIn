
import os
import tempfile
from pydub import AudioSegment
from moviepy import VideoFileClip, TextClip, CompositeVideoClip, AudioFileClip, ColorClip, ImageClip, concatenate_videoclips
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from src.services.audio_service import generate_audio_path
from src.database.models import Vocabulary

# Ensure TextClip can find ImageMagick or use simple method?
# Since we are on Mac, maybe we don't need explicit config if installed.
# Actually, TextClip often causes issues. We can generate text images with Pillow and use ImageClip.
# This is safer and cleaner than relying on ImageMagick.

class MediaService:
    def __init__(self):
        self.tmp_dir = tempfile.gettempdir()

    def _create_silence(self, duration_ms: int) -> AudioSegment:
        return AudioSegment.silent(duration=duration_ms)

    def generate_combined_audio(self, vocab: Vocabulary) -> str:
        """
        Generates combined audio: JP -> Silence -> EN -> Silence
        Returns path to MP3 file.
        """
        jp_path = generate_audio_path(vocab.japanese_meaning, lang="ja")
        en_path = generate_audio_path(vocab.english_phrase, lang="en")
        
        if not jp_path or not en_path:
            return None
            
        jp_audio = AudioSegment.from_file(jp_path)
        en_audio = AudioSegment.from_file(en_path)
        
        # Calculate gaps
        # Gap 1: after JP (Reduced for better tempo)
        gap1_dur = int((len(vocab.japanese_meaning) * 0.1 + 0.5) * 1000)
        gap1 = self._create_silence(gap1_dur)
        
        # Gap 2: after EN (Reduced for better tempo)
        gap2_dur = int((len(vocab.english_phrase) * 0.05 + 0.8) * 1000)
        gap2 = self._create_silence(gap2_dur)
        
        # Combine
        # Pattern: JP -> Gap -> EN -> Gap
        combined = jp_audio + gap1 + en_audio + gap2
        
        outfile = os.path.join(self.tmp_dir, f"fillin_audio_{vocab.id}.mp3")
        combined.export(outfile, format="mp3")
        return outfile

    def _create_text_image(self, text_jp, text_en, hidden_en=False, size=(1920, 1080)):
        """Creates an image with the text content."""
        # White/Off-white background
        img = Image.new('RGB', size, color=(255, 255, 255)) 
        draw = ImageDraw.Draw(img)
        
        # We need a font. MacOS system font.
        try:
            # Attempt to use specific fonts, fallback to default
            font_path_jp = "/System/Library/Fonts/Hiragino Sans GB.ttc"
            font_path_en = "/System/Library/Fonts/Helvetica.ttc"
            
            # Fallback handling
            if not os.path.exists(font_path_jp): font_path_jp = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"
            
            # Increased Font Sizes
            font_jp = ImageFont.truetype(font_path_jp, 100, index=0)
            font_en = ImageFont.truetype(font_path_en if os.path.exists(font_path_en) else font_path_jp, 140) # Much larger English
        except Exception as e:
             print(f"Font loading error: {e}")
             font_jp = ImageFont.load_default()
             font_en = ImageFont.load_default()

        # Position JP
        bbox_jp = draw.textbbox((0, 0), text_jp, font=font_jp)
        w_jp = bbox_jp[2] - bbox_jp[0]
        h_jp = bbox_jp[3] - bbox_jp[1]
        x_jp = (size[0] - w_jp) / 2
        y_jp = size[1] / 2 - 200 # Moved up
        
        draw.text((x_jp, y_jp), text_jp, font=font_jp, fill=(80, 80, 80)) # Dark Grey
        
        # Position EN
        if hidden_en:
             # Draw placeholder or nothing
             pass
        else:
            bbox_en = draw.textbbox((0, 0), text_en, font=font_en)
            w_en = bbox_en[2] - bbox_en[0]
            x_en = (size[0] - w_en) / 2
            y_en = size[1] / 2 + 50
            
            # Green/Teal Color (Duolingo-ish Green: #58cc02 -> (88, 204, 2))
            # Or "Pale Blue/Green" -> Maybe Teal #1abc9c
            # Let's use a nice vibrant Green
            draw.text((x_en, y_en), text_en, font=font_en, fill=(46, 204, 113))
            
        # Draw Logo/Footer
        font_small = ImageFont.truetype(font_path_en if os.path.exists(font_path_en) else font_path_jp, 40)
        draw.text((50, size[1]-100), "FillIn App", font=font_small, fill=(200, 200, 200))
            
        return np.array(img)

    def generate_video(self, vocab: Vocabulary) -> str:
        """
        Generates video:
        - Segment 1: JP text shown, Audio = JP + Gap.
        - Segment 2: JP + EN text shown, Audio = EN + Gap.
        """
        jp_path = generate_audio_path(vocab.japanese_meaning, lang="ja")
        en_path = generate_audio_path(vocab.english_phrase, lang="en")
        
        if not jp_path or not en_path:
            return None
            
        # 1. Create Audio Clips
        audio_jp = AudioFileClip(jp_path)
        audio_en = AudioFileClip(en_path)
        
        # Calculate Durations
        gap1_dur = (len(vocab.japanese_meaning) * 0.1 + 0.5)
        gap2_dur = (len(vocab.english_phrase) * 0.05 + 0.8)
        
        # Segment 1 Duration: JP Audio + Gap
        seg1_dur = audio_jp.duration + gap1_dur
        
        # Segment 2 Duration: EN Audio + Gap
        seg2_dur = audio_en.duration + gap2_dur
        
        # 2. Create Image Clips (Visuals)
        # Image 1: JP Only
        img1 = self._create_text_image(vocab.japanese_meaning, vocab.english_phrase, hidden_en=True)
        clip1 = ImageClip(img1).with_duration(seg1_dur)
        
        # Image 2: JP + EN
        img2 = self._create_text_image(vocab.japanese_meaning, vocab.english_phrase, hidden_en=False)
        clip2 = ImageClip(img2).with_duration(seg2_dur)
        
        # 3. specific Audio Composition for Clips?
        # Actually simplest way is to make the full audio first, then match video duration.
        # But wait, we want the "reveal" to happen exactly when EN starts.
        # So:
        # Clip 1 Audio: JP Audio starts at 0. Remainder is silence.
        # Clip 2 Audio: EN Audio starts at 0. Remainder is silence.
        
        # Composite Audio for Clip 1
        # audio_jp is shorter than seg1_dur.
        clip1 = clip1.with_audio(audio_jp) # This will loop or cut? default is loop. NO.
        # We need to compose audio with silence padding.
        # MoviePy 2.0 changes:
        # Actually easier: Create the master audio first using Pydub logic (since it's robust), save it.
        # Then create one big video clip with transitions?
        # Or just concatenate clips.
        
        # Let's stick to Moviepy composition if possible to avoid double dependency mess, 
        # BUT Pydub is perfect for gap calculation.
        
        # Let's use the combined MP3 from `generate_combined_audio` as the master track.
        # And we just need to know WHEN the EN starts.
        
        full_audio_path = self.generate_combined_audio(vocab)
        full_audio = AudioFileClip(full_audio_path)
        
        # Calculate split point (Time when EN starts)
        # JP Audio duration + Gap 1 duration IS WRONG because Pydub/Gap calculation might be slightly different?
        # Actually, let's recalculate simply using the files:
        audio_jp_check = AudioSegment.from_file(jp_path)
        split_point_sec = (len(audio_jp_check) / 1000.0) + gap1_dur
        
        # Validate total duration
        total_dur = full_audio.duration
        
        # Clip 1 (Hidden EN): 0 to split_point_sec
        clip1 = ImageClip(img1).with_duration(split_point_sec)
        
        # Clip 2 (Shown EN): split_point_sec to End
        clip2_dur = total_dur - split_point_sec
        if clip2_dur < 0: clip2_dur = 0.1 # safety
        clip2 = ImageClip(img2).with_duration(clip2_dur)
        
        # Concatenate Video
        final_video = concatenate_videoclips([clip1, clip2])
        
        # Set Audio
        final_video = final_video.with_audio(full_audio)
        
        outfile = os.path.join(self.tmp_dir, f"fillin_video_{vocab.id}.mp4")
        final_video.write_videofile(outfile, fps=24, codec="libx264", audio_codec="aac")
        return outfile

    def generate_playlist_audio(self, vocabs: list[Vocabulary]) -> str:
        """
        Concatenates combined audio for a list of vocab.
        Returns path to single MP3 file.
        """
        if not vocabs: return None
        
        final_audio = AudioSegment.empty()
        
        for vocab in vocabs:
            # Re-use single generation logic but we need the AudioSegment object, not file.
            # So I will refactor slightly or just load the file.
            # Loading file is safer to avoid complex refactor now.
            path = self.generate_combined_audio(vocab)
            if path and os.path.exists(path):
                segment = AudioSegment.from_file(path)
                final_audio += segment
                
                # Add small pause between items?
                final_audio += self._create_silence(1000)
            
        outfile = os.path.join(self.tmp_dir, f"fillin_playlist_{len(vocabs)}_items.mp3")
        final_audio.export(outfile, format="mp3")
        return outfile

    def generate_playlist_video(self, vocabs: list[Vocabulary]) -> str:
        """
        Concatenates video clips for a list of vocab.
        Returns path to single MP4 file.
        WARNING: Heavy operation.
        """
        if not vocabs: return None
        
        clips = []
        
        for vocab in vocabs:
            path = self.generate_video(vocab)
            if path and os.path.exists(path):
                # Load as VideoFileClip to avoid memory leaks if possible?
                # Actually, appending VideoFileClip keeps file open.
                # Better to use concatenate_videoclips with paths? No, it needs clips.
                clip = VideoFileClip(path)
                clips.append(clip)
        
        if not clips: return None
        
        final_video = concatenate_videoclips(clips, method="compose") # compose is safer but slower
        
        outfile = os.path.join(self.tmp_dir, f"fillin_playlist_{len(vocabs)}_items.mp4")
        final_video.write_videofile(outfile, fps=24, codec="libx264", audio_codec="aac")
        return outfile

# Utility to avoid instantiation if just helper
_service = MediaService()
def get_media_service():
    return _service
