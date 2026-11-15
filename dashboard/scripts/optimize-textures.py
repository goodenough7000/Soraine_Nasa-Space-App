from pathlib import Path
from PIL import Image
import numpy as np

root=Path(__file__).resolve().parents[1]/'dist/assets'
for name in ['earth.png','earth-night.png','moon-lroc.jpg','mars-viking.jpg']:
    p=root/name
    with Image.open(p) as im:
        im=im.convert('RGB')
        im.thumbnail((1536,768),Image.Resampling.LANCZOS)
        dest=root/(p.stem+'-mobile.webp')
        im.save(dest,'WEBP',quality=88,method=6)
        print(name,p.stat().st_size,'->',dest.name,dest.stat().st_size,im.size)
with Image.open(root/'moon-normal.png') as im:
    im=im.convert('RGB').resize((1024,512),Image.Resampling.LANCZOS)
    normals=np.asarray(im,dtype=np.float32)/127.5-1.0
    normals/=np.maximum(np.linalg.norm(normals,axis=2,keepdims=True),1e-6)
    dest=root/'moon-normal-mobile.webp'
    Image.fromarray(np.clip((normals+1)*127.5,0,255).astype('uint8')).save(dest,'WEBP',lossless=True,method=6)
    print('moon-normal.png', (root/'moon-normal.png').stat().st_size,'->',dest.name,dest.stat().st_size)

