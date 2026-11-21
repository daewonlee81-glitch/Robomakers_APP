#!/usr/bin/env python3
"""허스키렌즈 여러 대상(브리지 펌웨어 mode7 HLALL) 글 — 7개 언어.

    python3 tools/husky2_text.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS_RE = r"(?:o\.husky\.(?:height|count)|o\.huskyof\.\d|b\.rm_husky_(?:of_id|value)\.tip|b\.rm_husky_of_id|husky\.(?:help|count|h|more|oldFw|newFw))"

TEXT = {
'ko': {
 'o.husky.height': '세로 H', 'o.husky.count': '보이는 대상 수',
 'o.huskyof.0': '중심 X', 'o.huskyof.1': '중심 Y', 'o.huskyof.2': '가로 W', 'o.huskyof.3': '세로 H',
 'b.rm_husky_of_id': '🔍 허스키렌즈 %1 ID %2 인 대상의 %3',
 'b.rm_husky_of_id.tip': '화면에 여러 개가 보일 때 원하는 ID 의 위치를 읽습니다. 보이지 않으면 -1. 새 브리지 펌웨어가 필요하며, 앞의 3개 중에서 찾습니다.',
 'b.rm_husky_value.tip': '「세로 H」와 「보이는 대상 수」는 새 브리지 펌웨어(여러 대상 모드)에서 정확합니다. 옛 펌웨어는 세로 = 가로, 개수 = 0 또는 1 입니다.',
 'husky.count': '보이는 수', 'husky.h': '세로 H', 'husky.more': '+{0}개 더',
 'husky.oldFw': '옛 브리지 펌웨어 — 첫 번째 대상만',
 'husky.newFw': '여러 대상 모드',
 'husky.help': '<b>husky_spike_esp32</b> 브리지(ESP32 가 SPIKE 색 센서로 위장)를 읽습니다. <b>새 브리지 펌웨어</b>는 보이는 대상을 최대 3개까지 세로 길이와 함께 보내 모두 그립니다(좌표는 2 단위). 옛 펌웨어는 첫 번째 대상 하나만 보내고 높이를 가로 W 로 어림합니다 — 브리지 설치 페이지에서 펌웨어를 다시 넣으면 바뀝니다. 파란 띠는 예제에서 「가운데」로 쓰는 X 120~200 입니다. 오른쪽 글자는 SPIKE App 워드 블럭에서 같은 값의 이름입니다.',
},
'en': {
 'o.husky.height': 'height H', 'o.husky.count': 'number of objects seen',
 'o.huskyof.0': 'center X', 'o.huskyof.1': 'center Y', 'o.huskyof.2': 'width W', 'o.huskyof.3': 'height H',
 'b.rm_husky_of_id': '🔍 HuskyLens %1 object with ID %2 : %3',
 'b.rm_husky_of_id.tip': 'Reads the position of a given ID when several objects are on screen. −1 if it is not seen. Needs the new bridge firmware; searches the first three objects.',
 'b.rm_husky_value.tip': '“height H” and “number of objects” are exact with the new bridge firmware (multi-object mode). With the old firmware height = width and the count is 0 or 1.',
 'husky.count': 'seen', 'husky.h': 'height H', 'husky.more': '+{0} more',
 'husky.oldFw': 'old bridge firmware — first object only',
 'husky.newFw': 'multi-object mode',
 'husky.help': 'Reads the <b>husky_spike_esp32</b> bridge (an ESP32 posing as a SPIKE color sensor). The <b>new bridge firmware</b> sends up to three visible objects with their height and all of them are drawn (coordinates in steps of 2). The old firmware sends only the first object and the height is estimated from the width W — reinstall the firmware from the bridge installer page to upgrade. The blue band is X 120–200, the “centre” used in the examples. The text on the right is the name of the same value in the SPIKE App word blocks.',
},
'ja': {
 'o.husky.height': '高さ H', 'o.husky.count': '見えている数',
 'o.huskyof.0': '中心 X', 'o.huskyof.1': '中心 Y', 'o.huskyof.2': '幅 W', 'o.huskyof.3': '高さ H',
 'b.rm_husky_of_id': '🔍 HuskyLens %1 ID %2 の対象の %3',
 'b.rm_husky_of_id.tip': '画面に複数見えるとき、指定した ID の位置を読みます。見えなければ −1。新しいブリッジファームウェアが必要で、最初の3つの中から探します。',
 'b.rm_husky_value.tip': '「高さ H」と「見えている数」は新しいブリッジファームウェア(複数対象モード)で正確です。古いファームウェアでは高さ = 幅、数は 0 か 1 です。',
 'husky.count': '見えている数', 'husky.h': '高さ H', 'husky.more': 'ほか {0} 個',
 'husky.oldFw': '古いブリッジファームウェア — 最初の対象のみ',
 'husky.newFw': '複数対象モード',
 'husky.help': '<b>husky_spike_esp32</b> ブリッジ(ESP32 が SPIKE カラーセンサーのふりをする)を読みます。<b>新しいブリッジファームウェア</b>は見えている対象を最大3つ、高さも含めて送り、すべて描きます(座標は2刻み)。古いファームウェアは最初の対象1つだけで、高さは幅 W から推定します — ブリッジのインストールページでファームウェアを入れ直すと切り替わります。青い帯は例で「真ん中」として使う X 120〜200 です。右の文字は SPIKE App のワードブロックで同じ値の名前です。',
},
'zh-CN': {
 'o.husky.height': '高度 H', 'o.husky.count': '看到的目标数',
 'o.huskyof.0': '中心 X', 'o.huskyof.1': '中心 Y', 'o.huskyof.2': '宽度 W', 'o.huskyof.3': '高度 H',
 'b.rm_husky_of_id': '🔍 HuskyLens %1 ID 为 %2 的目标的 %3',
 'b.rm_husky_of_id.tip': '画面上有多个目标时,读取指定 ID 的位置。看不到时为 −1。需要新的桥接固件,在前 3 个目标中查找。',
 'b.rm_husky_value.tip': '“高度 H”和“看到的目标数”在新桥接固件(多目标模式)下才准确。旧固件中高度 = 宽度,数量为 0 或 1。',
 'husky.count': '看到', 'husky.h': '高度 H', 'husky.more': '还有 {0} 个',
 'husky.oldFw': '旧桥接固件 — 只有第一个目标',
 'husky.newFw': '多目标模式',
 'husky.help': '读取 <b>husky_spike_esp32</b> 桥接(ESP32 伪装成 SPIKE 颜色传感器)。<b>新桥接固件</b>最多发送 3 个可见目标及其高度,并全部画出(坐标以 2 为单位)。旧固件只发送第一个目标,高度用宽度 W 估算 — 在桥接安装页面重新写入固件即可升级。蓝色带是示例中当作“中间”的 X 120~200。右侧文字是 SPIKE App 积木中同一值的名称。',
},
'zh-TW': {
 'o.husky.height': '高度 H', 'o.husky.count': '看到的目標數',
 'o.huskyof.0': '中心 X', 'o.huskyof.1': '中心 Y', 'o.huskyof.2': '寬度 W', 'o.huskyof.3': '高度 H',
 'b.rm_husky_of_id': '🔍 HuskyLens %1 ID 為 %2 的目標的 %3',
 'b.rm_husky_of_id.tip': '畫面上有多個目標時,讀取指定 ID 的位置。看不到時為 −1。需要新的橋接韌體,在前 3 個目標中尋找。',
 'b.rm_husky_value.tip': '「高度 H」和「看到的目標數」在新橋接韌體(多目標模式)下才準確。舊韌體中高度 = 寬度,數量為 0 或 1。',
 'husky.count': '看到', 'husky.h': '高度 H', 'husky.more': '還有 {0} 個',
 'husky.oldFw': '舊橋接韌體 — 只有第一個目標',
 'husky.newFw': '多目標模式',
 'husky.help': '讀取 <b>husky_spike_esp32</b> 橋接(ESP32 偽裝成 SPIKE 顏色感測器)。<b>新橋接韌體</b>最多傳送 3 個可見目標及其高度,並全部畫出(座標以 2 為單位)。舊韌體只傳送第一個目標,高度用寬度 W 估算 — 在橋接安裝頁面重新寫入韌體即可升級。藍色帶是範例中當作「中間」的 X 120~200。右側文字是 SPIKE App 積木中同一值的名稱。',
},
'es': {
 'o.husky.height': 'alto H', 'o.husky.count': 'número de objetos vistos',
 'o.huskyof.0': 'centro X', 'o.huskyof.1': 'centro Y', 'o.huskyof.2': 'ancho W', 'o.huskyof.3': 'alto H',
 'b.rm_husky_of_id': '🔍 HuskyLens %1 objeto con ID %2 : %3',
 'b.rm_husky_of_id.tip': 'Lee la posición de un ID cuando hay varios objetos en pantalla. −1 si no se ve. Requiere el nuevo firmware del puente; busca entre los tres primeros objetos.',
 'b.rm_husky_value.tip': '«alto H» y «número de objetos» son exactos con el nuevo firmware del puente (modo multiobjeto). Con el firmware antiguo alto = ancho y el número es 0 o 1.',
 'husky.count': 'vistos', 'husky.h': 'alto H', 'husky.more': '+{0} más',
 'husky.oldFw': 'firmware antiguo del puente — solo el primer objeto',
 'husky.newFw': 'modo multiobjeto',
 'husky.help': 'Lee el puente <b>husky_spike_esp32</b> (una ESP32 que se hace pasar por sensor de color SPIKE). El <b>nuevo firmware del puente</b> envía hasta tres objetos visibles con su alto y se dibujan todos (coordenadas de 2 en 2). El firmware antiguo envía solo el primer objeto y el alto se estima con el ancho W — reinstala el firmware desde la página del instalador del puente para actualizar. La franja azul es X 120–200, el «centro» de los ejemplos. El texto de la derecha es el nombre del mismo valor en los bloques de SPIKE App.',
},
'th': {
 'o.husky.height': 'ความสูง H', 'o.husky.count': 'จำนวนวัตถุที่เห็น',
 'o.huskyof.0': 'กึ่งกลาง X', 'o.huskyof.1': 'กึ่งกลาง Y', 'o.huskyof.2': 'ความกว้าง W', 'o.huskyof.3': 'ความสูง H',
 'b.rm_husky_of_id': '🔍 HuskyLens %1 วัตถุ ID %2 : %3',
 'b.rm_husky_of_id.tip': 'อ่านตำแหน่งของ ID ที่ต้องการเมื่อเห็นหลายวัตถุบนจอ ถ้าไม่เห็นได้ −1 ต้องใช้เฟิร์มแวร์บริดจ์ใหม่ และค้นหาใน 3 วัตถุแรก',
 'b.rm_husky_value.tip': '“ความสูง H” และ “จำนวนวัตถุที่เห็น” แม่นยำกับเฟิร์มแวร์บริดจ์ใหม่ (โหมดหลายวัตถุ) เฟิร์มแวร์เก่าความสูง = ความกว้าง และจำนวนเป็น 0 หรือ 1',
 'husky.count': 'ที่เห็น', 'husky.h': 'ความสูง H', 'husky.more': 'อีก {0} ชิ้น',
 'husky.oldFw': 'เฟิร์มแวร์บริดจ์เก่า — เฉพาะวัตถุแรก',
 'husky.newFw': 'โหมดหลายวัตถุ',
 'husky.help': 'อ่านบริดจ์ <b>husky_spike_esp32</b> (ESP32 ปลอมตัวเป็นเซนเซอร์สี SPIKE) <b>เฟิร์มแวร์บริดจ์ใหม่</b>ส่งวัตถุที่เห็นได้สูงสุด 3 ชิ้นพร้อมความสูง และวาดทั้งหมด (พิกัดทีละ 2) เฟิร์มแวร์เก่าส่งเพียงวัตถุแรกและประมาณความสูงจากความกว้าง W — ติดตั้งเฟิร์มแวร์ใหม่จากหน้าติดตั้งบริดจ์เพื่ออัปเกรด แถบสีฟ้าคือ X 120–200 ที่ตัวอย่างใช้เป็น “ตรงกลาง” ข้อความด้านขวาคือชื่อค่าเดียวกันในบล็อกของ SPIKE App',
},
}


def main():
    keys = list(TEXT['ko'])
    for lang, d in TEXT.items():
        assert list(d) == keys, (lang, set(keys) ^ set(d))
        p = os.path.join(ROOT, 'js', 'lang', lang + '.js')
        s = open(p, encoding='utf-8').read()
        s = re.sub(r"\n  ['\"]" + KEYS_RE + r"['\"]: .*", '', s)
        block = ''.join(f'\n  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},' for k, v in d.items())
        m = re.search(r"\n};\s*$", s)
        s = s[:m.start()] + block + s[m.start():]
        open(p, 'w', encoding='utf-8').write(s)
    print(f'{len(TEXT)}개 언어 × {len(keys)}개 키')


if __name__ == '__main__':
    main()
