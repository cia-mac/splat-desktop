import sys, time, json, statistics as st
import numpy as np, coremltools as ct
from PIL import Image
path = "coreml/DepthAnythingV2SmallF16.mlpackage"
img = Image.open(sys.argv[1]).convert("RGB")
res = {}
for name, cu in [("ALL", ct.ComputeUnit.ALL), ("CPU_AND_NE", ct.ComputeUnit.CPU_AND_NE), ("CPU_AND_GPU", ct.ComputeUnit.CPU_AND_GPU), ("CPU_ONLY", ct.ComputeUnit.CPU_ONLY)]:
    t0 = time.perf_counter()
    try:
        m = ct.models.MLModel(path, compute_units=cu)
    except Exception as e:
        res[name] = {"error": str(e)[:300]}; continue
    load = (time.perf_counter() - t0) * 1000
    spec = m.get_spec(); inp = spec.description.input[0]
    if name == "ALL":
        res["input"] = {"name": inp.name, "type": inp.type.WhichOneof("Type"), "w": inp.type.imageType.width, "h": inp.type.imageType.height}
        res["output"] = [ (o.name, o.type.WhichOneof("Type")) for o in spec.description.output ]
    w, h = inp.type.imageType.width, inp.type.imageType.height
    im = img.resize((w, h), Image.BICUBIC)
    try:
        for _ in range(3): m.predict({inp.name: im})           # warmup
        ts = []
        for _ in range(30):
            t = time.perf_counter(); out = m.predict({inp.name: im}); ts.append((time.perf_counter() - t) * 1000)
        res[name] = {"loadMs": round(load, 1), "med": round(st.median(ts), 2), "p90": round(sorted(ts)[27], 2), "min": round(min(ts), 2)}
    except Exception as e:
        res[name] = {"loadMs": round(load, 1), "error": str(e)[:300]}
print(json.dumps(res, indent=1))
