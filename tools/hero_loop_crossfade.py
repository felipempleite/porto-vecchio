"""Make the hero loop: crossfade the generated clip's tail into its head (seamless wrap), then
paste the 16:9 clip back into the 3:2 still (rows 90..1170) with a feathered seam, so the video
has exactly the poster's framing at every viewport size."""
import subprocess, numpy as np, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else "kling.mp4"
STILL = sys.argv[2] if len(sys.argv) > 2 else "still.rgb"      # raw rgb24 1920x1280 of the poster
OUT = sys.argv[3] if len(sys.argv) > 3 else "kling-loop.mp4"
W,H,SH,Y0,FEATHER=1920,1080,1280,90,32
FS=W*H*3
HEAD0,N,X=3,145,36   # head = frames 3..38 ; body = 39..end ; last X body frames crossfade into head
still=np.fromfile(STILL,np.uint8).reshape(SH,W,3).astype(np.float32)
alpha=np.ones((H,1,1),np.float32)
ramp=np.linspace(0,1,FEATHER,dtype=np.float32)
alpha[:FEATHER,0,0]=ramp; alpha[-FEATHER:,0,0]=ramp[::-1]
dec=subprocess.Popen(["ffmpeg","-v","error","-i",SRC,"-f","rawvideo","-pix_fmt","rgb24","-"],stdout=subprocess.PIPE)
frames=[]
for i in range(N):
    b=dec.stdout.read(FS)
    if len(b)<FS: break
    frames.append(np.frombuffer(b,np.uint8).reshape(H,W,3))
head=frames[HEAD0:HEAD0+X]; body=frames[HEAD0+X:]
enc=subprocess.Popen(["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{SH}","-r","24","-i","-","-c:v","libx264","-crf","12","-preset","slow","-pix_fmt","yuv420p",OUT],stdin=subprocess.PIPE)
L=len(body)
for k,fr in enumerate(body):
    f=fr.astype(np.float32); j=k-(L-X)
    if j>=0:
        a=(j+1)/X
        f=f*(1-a)+head[j].astype(np.float32)*a
    out=still.copy()
    out[Y0:Y0+H]=still[Y0:Y0+H]*(1-alpha)+f*alpha
    enc.stdin.write(out.round().astype(np.uint8).tobytes())
enc.stdin.close(); enc.wait(); print("frames",L)
