#!/usr/bin/env python3
"""워드블럭 에디터의 새 블록 · 허브 라이브러리를 로보메이커스 캐드(시뮬레이터)로 옮깁니다.

    python3 tools/sync_cad.py [캐드 저장소 경로]   (기본: ../mindstorms-cad)

만드는 파일: <캐드>/wordblock-sync.js
  · 에디터 언어 파일(js/lang)에서 새 블록 문구를 가져옵니다 (캐드 언어: ko en ja zh es)
  · hublib/ 의 허브 라이브러리를 그대로 넣습니다
  · 틀은 tools/cad/wordblock-sync.tpl.js 입니다 — 블록을 더 옮기려면 틀과 아래 WANT 를 고치세요
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAD = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'mindstorms-cad'))
LANGS = {'ko': 'ko', 'en': 'en', 'ja': 'ja', 'zh': 'zh-CN', 'es': 'es'}
LIBS = ['rm_aicam', 'rm_esp32', 'rm_husky', 'rm_link', 'rm_pad', 'pupremote_hub', 'bluepad']
WANT = r'^(b\.rm_ai_(obj|teach|color|lcolor)_|b\.rm_eio_|b\.rm_es_|b\.rm_motor_pair_|tb\.es(dist|color|voice|oled|setup)$|mp\.[a-z]+$|o\.(objv|teachv|colorv|lcolv|onoff|pull|eskind|essize|esvoice|escolor)\.|o\.color\.[A-Z]+$)'
WANT_KEYS = {'coco.any', 'teach.class', 'color.slot', 'tb.object', 'tb.teach', 'tb.color', 'tb.lcolor', 'tb.espio', 'tb.neopixel'}

# 시뮬레이터에서는 다르게 안내할 문구
SIM = {
    'ko': {
        'b.rm_ai_obj_seen.tip': '실행하면 카메라가 켜지고 생활 속 사물 80가지(COCO)를 알아봅니다.',
        'b.rm_ai_teach_is.tip': '사물 학습은 워드블럭 에디터의 AI 카메라 탭에서 하세요. 같은 브라우저에 저장된 학습 결과를 시뮬레이터도 씁니다.',
        'b.rm_ai_color_is.tip': '실행하면 카메라가 켜지고 화면 가운데 네모 안의 색을 읽습니다.',
        'b.rm_ai_lcolor_seen.tip': '색 학습은 워드블럭 에디터의 AI 카메라 탭에서 하세요. 같은 브라우저에 저장된 학습 결과를 시뮬레이터도 씁니다.',
        'tb.espio': 'ESP32 핀 (GPIO·PWM·서보) — 실제 허브에서만 동작 · ESP32 의 main.py 는 워드블럭 에디터에서 받으세요',
        'wb.toEditor': '✏️ 워드블럭 에디터로',
        'wb.toEditorTitle': '지금 블록을 워드블럭 에디터로 가져갑니다',
        'wb.fromEditor': '워드블럭 에디터에서 블록을 가져왔습니다',
        'wb.unknown': '시뮬레이터에 없는 블록이 있어 일부를 불러오지 못했을 수 있습니다: {0}',
    },
    'en': {
        'b.rm_ai_obj_seen.tip': 'When the program runs, the camera turns on and recognises 80 everyday objects (COCO).',
        'b.rm_ai_teach_is.tip': 'Teach objects in the AI camera tab of the word-block editor. The simulator uses the results saved in this browser.',
        'b.rm_ai_color_is.tip': 'When the program runs, the camera turns on and reads the colour inside the centre square.',
        'b.rm_ai_lcolor_seen.tip': 'Teach colours in the AI camera tab of the word-block editor. The simulator uses the results saved in this browser.',
        'tb.espio': 'ESP32 pins (GPIO · PWM · servo) — real hub only · get the ESP32 main.py from the word-block editor',
        'wb.toEditor': '✏️ To word-block editor',
        'wb.toEditorTitle': 'Take these blocks to the word-block editor',
        'wb.fromEditor': 'Blocks loaded from the word-block editor',
        'wb.unknown': 'Some blocks are not in the simulator and may not have loaded: {0}',
    },
    'ja': {
        'b.rm_ai_obj_seen.tip': '実行するとカメラがつき、身の回りの物 80 種類(COCO)を見分けます。',
        'b.rm_ai_teach_is.tip': '物の学習はワードブロックエディターの AI カメラタブで行います。このブラウザーに保存された学習結果をシミュレーターでも使います。',
        'b.rm_ai_color_is.tip': '実行するとカメラがつき、画面中央の四角の中の色を読みます。',
        'b.rm_ai_lcolor_seen.tip': '色の学習はワードブロックエディターの AI カメラタブで行います。このブラウザーに保存された学習結果をシミュレーターでも使います。',
        'tb.espio': 'ESP32 ピン (GPIO・PWM・サーボ) — 実際のハブでのみ動作 · ESP32 の main.py はワードブロックエディターで取得',
        'wb.toEditor': '✏️ ワードブロックエディターへ',
        'wb.toEditorTitle': '今のブロックをワードブロックエディターへ持っていきます',
        'wb.fromEditor': 'ワードブロックエディターからブロックを読み込みました',
        'wb.unknown': 'シミュレーターにないブロックがあり、一部を読み込めなかった可能性があります: {0}',
    },
    'zh': {
        'b.rm_ai_obj_seen.tip': '运行后摄像头会打开，识别 80 种日常物体（COCO）。',
        'b.rm_ai_teach_is.tip': '请在文字积木编辑器的 AI 摄像头标签中学习物体。模拟器使用保存在此浏览器中的学习结果。',
        'b.rm_ai_color_is.tip': '运行后摄像头会打开，读取画面中央方框内的颜色。',
        'b.rm_ai_lcolor_seen.tip': '请在文字积木编辑器的 AI 摄像头标签中学习颜色。模拟器使用保存在此浏览器中的学习结果。',
        'tb.espio': 'ESP32 引脚（GPIO·PWM·舵机）— 仅在真实主机上运行 · ESP32 的 main.py 请在文字积木编辑器中获取',
        'wb.toEditor': '✏️ 去文字积木编辑器',
        'wb.toEditorTitle': '把当前积木带到文字积木编辑器',
        'wb.fromEditor': '已从文字积木编辑器载入积木',
        'wb.unknown': '有些积木模拟器中没有，可能未能载入：{0}',
    },
    'es': {
        'b.rm_ai_obj_seen.tip': 'Al ejecutar, la cámara se enciende y reconoce 80 objetos cotidianos (COCO).',
        'b.rm_ai_teach_is.tip': 'Enseña los objetos en la pestaña de cámara IA del editor de bloques. El simulador usa los resultados guardados en este navegador.',
        'b.rm_ai_color_is.tip': 'Al ejecutar, la cámara se enciende y lee el color dentro del cuadro central.',
        'b.rm_ai_lcolor_seen.tip': 'Enseña los colores en la pestaña de cámara IA del editor de bloques. El simulador usa los resultados guardados en este navegador.',
        'tb.espio': 'Pines ESP32 (GPIO · PWM · servo) — solo en el hub real · obtén el main.py del ESP32 en el editor de bloques',
        'wb.toEditor': '✏️ Al editor de bloques',
        'wb.toEditorTitle': 'Llevar estos bloques al editor de bloques',
        'wb.fromEditor': 'Bloques cargados desde el editor de bloques',
        'wb.unknown': 'Algunos bloques no existen en el simulador y puede que no se hayan cargado: {0}',
    },
}

NODE = r"""
const [root, langs] = [process.argv[1], JSON.parse(process.argv[2])];
const coco = (await import(root + '/js/lang/coco.js')).default;
const src = (await import('fs')).readFileSync(root + '/js/aicam.js', 'utf8');
const COCO = eval(src.match(/export const COCO = (\[[\s\S]*?\]);/)[1]);
const out = {};
for (const [cad, ed] of Object.entries(langs)) {
  const d = (await import(root + '/js/lang/' + ed + '.js')).default;
  out[cad] = { dict: d, coco: coco[ed] || coco.en };
}
out.__COCO = COCO;
console.log(JSON.stringify(out));
"""


def main():
    if not os.path.isfile(os.path.join(CAD, 'app.js')):
        sys.exit(f'캐드 저장소를 찾을 수 없습니다: {CAD}')
    raw = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', NODE, ROOT, json.dumps(LANGS)]))
    want = re.compile(WANT)
    msgs = {}
    for cad in LANGS:
        d = raw[cad]['dict']
        m = {k: v for k, v in d.items() if want.match(k) or k in WANT_KEYS}
        m.update(SIM[cad])
        m['__coco'] = raw[cad]['coco']
        msgs[cad] = m
    msgs['en']['__cocoKeys'] = raw['__COCO']
    libs = {n: open(os.path.join(ROOT, 'hublib', n + '.py'), encoding='utf-8').read() for n in LIBS}
    ver = re.search(r"version:\s*'([^']+)'", open(os.path.join(ROOT, 'js', 'config.js'), encoding='utf-8').read()).group(1)
    tpl = open(os.path.join(ROOT, 'tools', 'cad', 'wordblock-sync.tpl.js'), encoding='utf-8').read()
    js = (tpl.replace('/*@MSGS@*/ {}', json.dumps(msgs, ensure_ascii=False))
             .replace('/*@LIBS@*/ {}', json.dumps(libs, ensure_ascii=False))
             .replace('@VERSION@', ver)
             .replace('/*@MULTIPORT@*/', open(os.path.join(ROOT, 'js', 'multiport.js'), encoding='utf-8').read().replace('export function', 'function').replace('export const', 'const')))
    out = os.path.join(CAD, 'wordblock-sync.js')
    open(out, 'w', encoding='utf-8').write(js)
    # 캐드 index.html 이 새 파일을 받도록 주소에 ?v=<버전> 을 붙입니다
    idx = os.path.join(CAD, 'index.html')
    html = open(idx, encoding='utf-8').read()
    html2 = re.sub(r'<script src="wordblock-sync\.js[^"]*"></script>', f'<script src="wordblock-sync.js?v={ver}"></script>', html)
    if 'wordblock-sync.js' not in html2:
        html2 = re.sub(r'(<script src="app\.js[^"]*"></script>)', lambda m: m.group(1) + f'\n<script src="wordblock-sync.js?v={ver}"></script>', html2, count=1)
    if html2 != html:
        open(idx, 'w', encoding='utf-8').write(html2)
    n = len(msgs['ko']) - 1
    print(f'{out}  ({len(js) // 1024} KB · 문구 {n}개 × {len(LANGS)}개 언어 · 라이브러리 {len(libs)}개 · 에디터 v{ver})')


if __name__ == '__main__':
    main()
