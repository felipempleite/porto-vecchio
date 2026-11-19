import subprocess, numpy as np, json, glob, re, difflib
from faster_whisper import WhisperModel
m = WhisperModel("small", device="cpu", compute_type="int8")
def load(f): return np.frombuffer(subprocess.run(["ffmpeg","-v","error","-i",f,"-f","f32le","-ac","1","-ar","16000","-"],capture_output=True).stdout,np.float32)
norm=lambda s: re.sub(r"[^a-zàâçéèêëîïôûùüÿœ0-9 ]"," ",s.lower().replace("’","'").replace("'"," ")).split()
for f in sorted(glob.glob("raw-*.mp3")):
    n=f.split('-')[1]; src=open(glob.glob(f"sec-{n}-*.txt")[0]).read()
    segs,_=m.transcribe(load(f),language="fr"); hyp=" ".join(s.text for s in segs)
    a,b=norm(src),norm(hyp); r=difflib.SequenceMatcher(None,a,b).ratio()
    print(f"{f} ratio={r:.3f}")
    for op,i1,i2,j1,j2 in difflib.SequenceMatcher(None,a,b).get_opcodes():
        if op!='equal' and (i2-i1>2 or j2-j1>2): print("   ",op," ".join(a[i1:i2]),"=>"," ".join(b[j1:j2]))
