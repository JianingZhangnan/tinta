"""Fresh-process measurements; OS/filesystem caches are left warm.

Measures process InputIdle and the fork's own native EndDraw/MathJax events.
Memory is private committed memory summed over this process and its children;
working sets are reported separately and may double-count shared pages.
No existing Tinta process is terminated or reconfigured.
"""
import os,sys,time,json,shutil,subprocess,statistics,ctypes
from pathlib import Path
sys.path.insert(0,r'D:\Program Files\_cache\Tinta\benchmark-python')
import psutil
root=Path(__file__).resolve().parents[1]
out=root/'build-fpks'/'benchmark';out.mkdir(parents=True,exist_ok=True)
logs=Path(os.environ['APPDATA'])/'Tinta'/'fpks-metrics.log'
docs=out/'docs';docs.mkdir(exist_ok=True)
(docs/'plain.md').write_text('# Single file\n\nA short **Markdown** document without equations.\n',encoding='utf8')
base='''[Settings]
themeIndex=0
themeName=Paper
followSystemTheme=0
zoomFactor=1
windowX=150
windowY=120
windowWidth=1000
windowHeight=800
windowMaximized=0
hasAskedFileAssociation=1
checkUpdates=0
openInTabs=0
reopenTabs=0
'''
variants={
 'original':Path(r'D:\Program Files\Tinta\tinta.exe'),
 'fpks':root/'build-fpks'/'tinta.exe',
}
bins={}
for label,exe in variants.items():
 d=out/label;d.mkdir(exist_ok=True);shutil.copy2(exe,d/'tinta.exe');bins[label]=d
 if label=='fpks':
  shutil.copy2(root/'build-fpks'/'WebView2Loader.dll',d/'WebView2Loader.dll')
  shutil.copytree(root/'web'/'dist',d/'fpks',dirs_exist_ok=True)
def launch(label,case,run):
 d=bins[label];(d/'settings.ini').write_text(base,encoding='utf8')
 file={'plain':docs/'plain.md','math':root/'tests/fixtures/fpks-math.md','90MiB':Path(r'D:\Downloads\test-90MB.txt')}[case]
 env=os.environ.copy();env['TINTA_FPKS_CACHE']=str(out/'runtime-cache')
 started=time.perf_counter();p=subprocess.Popen([str(d/'tinta.exe'),str(file)],cwd=d,env=env)
 idle=ctypes.windll.user32.WaitForInputIdle(int(p._handle),25000)
 input_ms=(time.perf_counter()-started)*1000
 proc=psutil.Process(p.pid);deadline=time.perf_counter()+(4 if case=='math' else 1)
 events=[]
 while time.perf_counter()<deadline:
  if p.poll() is not None:raise RuntimeError(f'Unexpected exit {label} {case}: {p.returncode}')
  time.sleep(.1)
 if logs.exists():events=[line.split(' ',1)[1] for line in logs.read_text(encoding='utf8').splitlines() if line.startswith(str(p.pid)+' ')]
 children=proc.children(recursive=True);memory=[]
 for item in [proc,*children]:
  try:
   m=item.memory_info();memory.append({'pid':item.pid,'name':item.name(),'private':m.private,'working_set':m.rss})
  except psutil.NoSuchProcess:pass
 row={'variant':label,'case':case,'run':run,'input_idle_ms':input_ms,'input_idle_result':idle,'processes':len(memory),
      'private_mib':sum(m['private'] for m in memory)/2**20,'working_set_sum_mib':sum(m['working_set'] for m in memory)/2**20,'events':events}
 for item in reversed(children):
  try:item.terminate()
  except psutil.NoSuchProcess:pass
 p.terminate();p.wait(timeout=10)
 print(json.dumps(row),flush=True);return row
rows=[]
for case in ['plain','math','90MiB']:
 for label in variants:
  for run in range(3 if case!='90MiB' else 1):rows.append(launch(label,case,run))
summary=[]
for case in ['plain','math','90MiB']:
 for label in variants:
  group=[r for r in rows if r['case']==case and r['variant']==label]
  summary.append({'variant':label,'case':case,'runs':len(group),**{key:statistics.median(r[key] for r in group) for key in ['input_idle_ms','private_mib','working_set_sum_mib']}})
(out/'results.json').write_text(json.dumps({'measure':'Fresh processes, warm OS caches; milliseconds and MiB','rows':rows,'summary':summary},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(summary,indent=2))
