# 검증 도구

## 1. 가짜 허브에서 파이썬 실행 (mockhub)
Pybricks v4 펌웨어 소스에서 뽑은 메서드 이름·인자만 허용하는 엄격한 가짜 `pybricks` 패키지입니다.
틀린 API 이름·인자·형식을 쓰면 오류가 납니다. stdin 으로 웹 에디터 프레임을 넣을 수 있습니다.

```bash
# 파이썬 탭에서 .py 저장한 파일을 실행
printf 'H:1,2,40,60,5\nG:20,60,0,0,0,0,1,0\n' | python3 tests/mockhub/run.py main.py
```
`MOCK_PUP=bluepad` 를 주면 PUPDevice 가 LMS-ESP32 BluePad32 처럼 응답합니다.

## 2. 브라우저 전체 흐름 (e2e)
가짜 BLE/USB Pybricks 허브와 가짜 PS5 패드를 브라우저에 심어 실제 화면을 클릭하며 시험합니다.
```bash
python3 -m http.server 8765 &        # 프로젝트 폴더에서
pip install playwright && playwright install chromium
python3 tests/e2e/test_e2e.py
```

## 3. Pybricks 공식 가상 허브(virtualhub)에서 실행
진짜 Pybricks v4 MicroPython 런타임(모터 시뮬레이션 포함)에서 실행합니다.
```bash
git clone --recursive https://github.com/pybricks/pybricks-micropython && cd pybricks-micropython
git -c submodule.lib/btstack.update=checkout -c submodule.lib/umm_malloc.update=checkout submodule update --init lib/btstack lib/umm_malloc
pip install cairosvg freetype-py gitpython pillow
make mpy-cross
# CI 빌드는 stdin 을 끄므로, 웹 에디터 데이터(stdin) 시험용으로 두 곳의 CI 조건에 RM_STDIN 예외를 넣어 빌드
sed -i 's/^    #ifdef PBDRV_CONFIG_RUN_ON_CI$/    #if defined(PBDRV_CONFIG_RUN_ON_CI) \&\& !defined(RM_STDIN)/' lib/pbio/drv/usb/usb_simulation.c lib/pbio/platform/virtual_hub/platform.c
make -C bricks/virtualhub BUILD=build-stdin CI_MODE=1 COPT="-O0 -DRM_STDIN"
export PYBRICKS_VIRTUALHUB=$PWD/bricks/virtualhub/build-stdin/pybricks-virtualhub
# 다시 이 프로젝트에서
python3 tests/virtualhub/run_on_virtualhub.py main.py --frames 'H:1,2,40,60,5\nG:20,60,0,0,0,0,1,0\n'
```
(가상 허브는 시간이 빠르게 흐르는 시험용 시계를 써서, 무한 반복은 100회로 바꿔 실행합니다.)
