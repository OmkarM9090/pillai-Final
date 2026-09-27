HERO VIDEO FRAMES
=================
This is the scroll-scrubbed hero. It is NOT a video file — it's a sequence
of JPG frames drawn onto a canvas, and the frame shown is driven by scroll
position (scroll down = frame advances). This is the same technique the
reference project used.

What to add here:
  frame_0001.jpg
  frame_0002.jpg
  ...
  frame_0240.jpg

How to get these frames from your Google Flow / Veo generated video:
  ffmpeg -i your_resort_video.mp4 -vf fps=24 frame_%04d.jpg
  (adjust fps so total frame count lands around 240 — e.g. a 10s clip at 24fps = 240 frames)

If you end up with a different total frame count, update FRAME_COUNT
in src/components/ScrollVideo.jsx to match.

Recommended: export frames at 1920x1080, keep file sizes reasonable
(JPG quality ~80) since all frames preload on page load.
