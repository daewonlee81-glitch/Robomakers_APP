import asyncio, os, json
from playwright.async_api import async_playwright
FAKE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fakehub.js')).read()
URL = os.environ.get('URL', 'http://localhost:8765/index.html') + '?lang=ko&nohelp'
CHROME = os.environ.get('CHROME')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'],
            **({'proxy': {'server': os.environ['HTTPS_PROXY'], 'bypass': 'localhost,127.0.0.1'}} if os.environ.get('HTTPS_PROXY') else {}))
        ctx = await b.new_context(viewport={'width':1440,'height':860}, ignore_https_errors=True, permissions=['camera'])
        await ctx.add_init_script(FAKE)
        pg = await ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(URL); await pg.wait_for_timeout(1200)
        await pg.evaluate("localStorage.clear()")
        async def term(): return await pg.inner_text('#terminal')
        ok = lambda c, m: print(('  ✔ ' if c else '  ✖ ') + m)

        print('[SPIKE Prime · 블루투스]')
        await pg.select_option('#hubSelect', 'prime')
        await pg.click('#btnConnect'); await pg.wait_for_timeout(500)
        ok('Pybricks 서비스로 장치 검색' if 'c5f50001' in await pg.evaluate('__hub.bleFilter') else 'filter', 'requestDevice 필터에 Pybricks 서비스 UUID')
        ok('연결 끊기' in await pg.inner_text('#btnConnect'), '연결 상태 표시: ' + await pg.inner_text('#hubName'))
        await pg.click('#btnExamples'); await pg.click('text=게임패드: 탱크 주행'); await pg.wait_for_timeout(400)
        await pg.click('#btnRun'); await pg.wait_for_timeout(2500)
        h = await pg.evaluate('({cmds: __hub.cmds.join(","), started: __hub.started, running: __hub.running})')
        ok(h['started'] is not None and h['running'], f"다운로드 후 허브에서 고른 슬롯 실행 (명령 순서 {h['cmds'][:30]}…)")
        # 허브 RAM 을 펌웨어 방식으로 해석
        mods = await pg.evaluate('''() => { const d = __hub.ram.subarray(0, __hub.size); let o = 0; const out = [];
            while (o + 4 < d.length) { const sz = d[o] | d[o+1]<<8 | d[o+2]<<16 | d[o+3]<<24; o += 4; let e = o; while (d[e]) e++;
              out.push(new TextDecoder().decode(d.subarray(o, e)) + '(' + sz + 'B, ' + String.fromCharCode(d[e+1]) + d[e+2] + ')'); o = e + 1 + sz; }
            return {mods: out, exact: o === d.length}; }''')
        ok(mods['exact'], '허브가 받은 프로그램 해석: ' + ', '.join(mods['mods']))
        t = await term(); ok('hello from hub' in t, '허브 출력(stdout)이 터미널에 표시')
        ok('running' in await pg.get_attribute('#hubStatus', 'class'), '실행 중 표시(노란 점)')
        await pg.wait_for_timeout(800)
        st = await pg.evaluate('__hub.stdin')
        gl = [l for l in st.split('\n') if l.startswith('G:')]
        ok(len(gl) >= 3, f'게임패드 값 중계 {len(gl)}회, 마지막 "{gl[-1] if gl else ""}"')
        if gl:
            v = list(map(int, gl[-1][2:].split(',')))
            ok(v[0] == 50 and v[1] == 80 and v[5] == 60 and v[6] & 1 and v[6] & (1 << 10) and v[7] == 1, 'LX=50 LY=80(위 +) RT=60 ✕버튼·방향키↑ 비트, dpad=1')
        # AI 카메라 켜서 H 프레임 확인
        await pg.click('.tab[data-pane=paneCam]'); await pg.click('#btnCam')
        for i in range(40):
            await pg.wait_for_timeout(1000)
            if '끄기' in await pg.inner_text('#btnCam'): break
        await pg.evaluate('__hub.stdin = ""')
        await pg.wait_for_timeout(5000)
        st = await pg.evaluate('__hub.stdin')
        hl = [l for l in st.split('\n') if l.startswith('H:')]
        ok(len(hl) >= 3, f'AI 카메라 값 중계 5초간 {len(hl)}회 (이 서버는 GPU 없음), 마지막 "{hl[-1] if hl else ""}"')
        await pg.click('#btnCam')
        await pg.click('#btnStop'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate('!__hub.running'), '정지 버튼 → 허브 프로그램 정지')
        # 허브에 다운로드 (저장만, 실행 안 함)
        await pg.evaluate('__hub.cmds = []; __hub.started = null')
        ok('슬롯 3' in (await pg.get_attribute('#btnUpload', 'title') or ''), '허브에 다운로드 버튼에 허브에서 고른 슬롯 표시: ' + (await pg.get_attribute('#btnUpload', 'title')))
        await pg.click('#btnUpload'); await pg.wait_for_timeout(1500)
        h = await pg.evaluate('({cmds: __hub.cmds.join(","), started: __hub.started, running: __hub.running, size: __hub.size})')
        ok(h['started'] is None and not h['running'] and h['cmds'].startswith('3,4') and h['cmds'].endswith('3') and h['size'] > 0, f"허브에 다운로드: 저장만 하고 실행 안 함 (명령 {h['cmds'][:12]}…{h['cmds'][-3:]}, {h['size']}바이트)")
        t2 = await term(); ok('저장했습니다 (슬롯 3)' in t2 and '가운데 버튼' in t2, '터미널 안내: ' + [l for l in t2.split(chr(10)) if '저장했습니다' in l][-1].strip())
        ok(await pg.evaluate('__hub.startLens.every(n => n === 1)'), '실행 명령은 슬롯 번호 없이 보냄 → 허브에서 고른 슬롯을 실행')
        n_before = len(await pg.evaluate('__hub.stdin'))
        await pg.wait_for_timeout(500)
        ok(len(await pg.evaluate('__hub.stdin')) == n_before, '정지 후에는 데이터 전송 멈춤')
        # 컴파일 오류 처리
        await pg.click('.tab[data-pane=panePython]'); await pg.check('#editToggle')
        await pg.fill('#codeEdit', 'print("x"\n')
        await pg.click('#btnRun'); await pg.wait_for_timeout(1500)
        t = await term(); ok('파이썬 오류' in t and 'SyntaxError' in t, '문법 오류가 터미널에 표시: ' + [l for l in t.split('\n') if 'Error' in l][-1].strip())
        await pg.fill('#codeEdit', 'print("직접 편집한 코드")\n')
        await pg.click('#btnRun'); await pg.wait_for_timeout(1500)
        ok(await pg.evaluate('__hub.started && __hub.running'), '직접 편집한 파이썬도 실행')
        await pg.uncheck('#editToggle')
        await pg.screenshot(path='/tmp/e2e_prime.png')
        await pg.click('#btnConnect'); await pg.wait_for_timeout(300)
        ok('허브 연결' in await pg.inner_text('#btnConnect'), '연결 끊기')

        print('[EV3 · USB]')
        await pg.evaluate('__hub.cmds = []; __hub.started = null; __hub.stdin = ""')
        await pg.select_option('#hubSelect', 'ev3'); await pg.wait_for_timeout(300)
        ok(await pg.input_value('#transportSelect') == 'usb', 'EV3 는 USB 로 자동 선택')
        cats = await pg.eval_on_selector_all('.blocklyTreeLabel', 'els => els.map(e => e.textContent)')
        ok('허스키렌즈' not in cats and 'ESP32' not in cats, 'EV3 툴박스: ' + ' · '.join(cats))
        await pg.click('#btnConnect'); await pg.wait_for_timeout(500)
        ok('"classCode":255' in await pg.evaluate('__hub.usbFilter') and await pg.evaluate('__hub.usbSubscribed') == 1, 'Pybricks USB 인터페이스 검색·이벤트 구독')
        await pg.click('#btnExamples'); await pg.click('text=AI 카메라: 손 모양으로'); await pg.wait_for_timeout(300)
        await pg.click('#btnRun'); await pg.wait_for_timeout(2500)
        h = await pg.evaluate('({cmds: __hub.cmds.join(","), started: __hub.started})')
        ok(h['started'] is not None, f"USB 다운로드·실행 (명령 {h['cmds']})")
        ok('hello from hub' in await term(), 'USB stdout 표시')
        await pg.wait_for_timeout(600)
        gl = [l for l in (await pg.evaluate('__hub.stdin')).split('\n') if l.startswith('G:')]
        ok(len(gl) >= 2, f'EV3 로 게임패드 웹 중계 {len(gl)}회')
        await pg.click('#btnStop'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate('!__hub.running'), 'USB 정지')

        print('[저장·불러오기]')
        await pg.reload(); await pg.wait_for_timeout(1500)
        ok(await pg.input_value('#hubSelect') == 'ev3' and 'rm_aicam' in await pg.inner_text('#codeView'), '새로고침 후 허브·블록 자동 복원')
        print('페이지 오류:', errs or '없음')
        await b.close()
asyncio.run(main())
