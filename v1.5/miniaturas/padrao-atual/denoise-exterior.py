"""OIDN's dedicated HDR lightmap denoiser, using its official 2.3.3 runtime."""
from pathlib import Path
import ctypes as c,os,json,time
import numpy as np
H=Path(__file__).resolve().parent;O=H/'exterior-v3';n=json.loads((O/'bake.json').read_text())['size']
libdir=Path(r'C:\Users\respawn\AppData\Local\CodexBlenderStudy\oidn-2.3.3.x64.windows\bin')
handle=os.add_dll_directory(str(libdir));rootHandle=os.add_dll_directory(str(libdir.parent))
os.environ['PATH']=str(libdir)+os.pathsep+str(libdir.parent)+os.pathsep+os.environ['PATH']
plugin=c.CDLL(str(libdir/'OpenImageDenoise_device_cpu.dll'));lib=c.CDLL(str(libdir/'OpenImageDenoise.dll'))
def api(name,args,restype=None):
 f=getattr(lib,name);f.argtypes=args;f.restype=restype;return f
newdev=api('oidnNewDevice',[c.c_int],c.c_void_p);commitdev=api('oidnCommitDevice',[c.c_void_p])
newfilter=api('oidnNewFilter',[c.c_void_p,c.c_char_p],c.c_void_p)
setimage=api('oidnSetSharedFilterImage',[c.c_void_p,c.c_char_p,c.c_void_p,c.c_int,c.c_size_t,c.c_size_t,c.c_size_t,c.c_size_t,c.c_size_t])
commitfilter=api('oidnCommitFilter',[c.c_void_p]);execute=api('oidnExecuteFilter',[c.c_void_p])
geterror=api('oidnGetDeviceError',[c.c_void_p,c.POINTER(c.c_char_p)],c.c_int)
source=np.fromfile(O/'irradiance.f32',dtype=np.float32).reshape(n,n,4);rgb=np.ascontiguousarray(source[:,:,:3]);out=np.empty_like(rgb)
t=time.perf_counter();dev=newdev(1);commitdev(dev);f=newfilter(dev,b'RTLightmap')
for name,a in [(b'color',rgb),(b'output',out)]:setimage(f,name,a.ctypes.data,3,n,n,0,12,n*12)
commitfilter(f);execute(f);msg=c.c_char_p();err=geterror(dev,c.byref(msg));assert not err,(err,msg.value)
assert np.isfinite(out).all();out=np.maximum(out,0);out.tofile(O/'irradiance-denoised.f32')
(O/'denoise.json').write_text(json.dumps({'filter':'OIDN RTLightmap','device':'CPU','seconds':time.perf_counter()-t,'size':n},indent=2))
api('oidnReleaseFilter',[c.c_void_p])(f);api('oidnReleaseDevice',[c.c_void_p])(dev);print('DENOISED',time.perf_counter()-t,flush=True)
