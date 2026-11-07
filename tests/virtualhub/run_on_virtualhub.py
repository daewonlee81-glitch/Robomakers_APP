# 워드블럭에서 저장한 .py 를 Pybricks 공식 가상 허브(virtualhub)에서 실행합니다.
#   python3 tests/virtualhub/run_on_virtualhub.py main.py [--frames 'H:1,2,40,60,5\nG:...']
# 가상 허브: 포트 A·B 중형 모터, C·F 대형 모터, E 소형 모터 (센서·매트릭스·스피커·PUPDevice·Xbox 없음)
import os, re, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
VH = os.environ.get('PYBRICKS_VIRTUALHUB', 'pybricks-virtualhub')
src, frames = sys.argv[1], ''
if '--frames' in sys.argv: frames = sys.argv[sys.argv.index('--frames') + 1].encode().decode('unicode_escape')
c = open(src, encoding='utf-8').read()
c = re.sub(r'from pybricks\.hubs import (PrimeHub|EssentialHub)', r'from hubshim import \1', c)
c = c.replace('while True:', 'for _loop in range(100):')
if frames:
    c = c.replace('# 프로그램 시작', 'import rm_link\nfor _i in range(300000):\n    rm_link.update()\n    if rm_link._data:\n        break\n\n# 프로그램 시작', 1)
for m in sorted(set(re.findall(r'^(motor_[A-F]) = ', c, re.M))): c += f'\nprint("{m} 각도/속도", {m}.angle(), {m}.speed())'
if 'drive_base = ' in c: c += '\nprint("drive_base 거리/각도", drive_base.distance(), drive_base.angle())\n'
d = tempfile.mkdtemp()
for f in os.listdir(os.path.join(HERE, '..', '..', 'hublib')):
    if f.endswith('.py'): shutil.copy(os.path.join(HERE, '..', '..', 'hublib', f), d)
shutil.copy(os.path.join(HERE, 'hubshim.py'), d)
open(os.path.join(d, 'main.py'), 'w', encoding='utf-8').write(c)
feed = f"(sleep 0.8; printf '{frames}'; sleep 4) | " if frames else ''
sys.exit(subprocess.call(f"{feed}{VH} main.py" + ('' if frames else ' < /dev/null'), shell=True, cwd=d))
