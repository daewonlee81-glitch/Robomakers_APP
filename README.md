# 로보메이커스 워드블럭 웹 에디터 (v0.3.1)

크롬에서 바로 쓰는 **SPIKE Prime · SPIKE Essential · EV3** 용 워드블럭 코딩 프로그램입니다.
허브에는 **Pybricks 최신 펌웨어(v4)** 가 설치되어 있어야 하며, 블록은 Pybricks 파이썬 코드로 바뀌어 허브에서 실행됩니다.

## 기능

| # | 요구사항 | 구현 |
|---|---|---|
| 1 | 크롬 웹 서비스 | 설치 없는 정적 웹앱 (HTML/JS). 크롬·엣지 데스크톱, 안드로이드 크롬 |
| 2 | Pybricks 펌웨어 + 워드블럭 | Blockly(zelos 렌더러, SPIKE 앱 스타일 색) 한국어 블록 → Pybricks 파이썬 → 브라우저에서 mpy-cross 컴파일 → 허브로 내려받아 실행 |
| 3 | 파이썬 코드 보기 | 오른쪽 「파이썬」 탭. 실시간 변환, 복사, `.py` 저장, **직접 편집 후 실행** 가능. 한글 변수·함수 이름 그대로 사용 |
| 4 | AI 카메라 (스켈레톤·손·사물·색) | MediaPipe(브라우저 내 계산). 손 제스처 7종·손 위치·손가락 수, 스켈레톤(손 들기, 양팔 벌림, 몸 위치, 어깨 기울기), **사물 인식** 80종(위치·크기·확신도), **사물 학습** 5종(📸 누르고 있기로 사진 모으기, 내보내기/불러오기), **색 인식**(가운데 네모 색 10가지·RGB), **색 학습** 5가지(가운데 색을 학습해 화면에서 그 색 덩어리 위치·크기 추적). 값만 허브로 전송 |
| 5 | EV3 · Prime · Essential | Prime·Essential = 블루투스(Web Bluetooth), EV3 = USB(WebUSB), Prime USB 는 실험적 |
| 6 | 허스키렌즈 | `rm_husky.HuskyLens` — husky_spike_esp32 브리지(색 센서 위장)를 Pybricks 에서 읽음. 블록형/라인 추적형 모두 |
| 7 | Xbox / PS 조종기 | `rm_pad.Gamepad` — ① 웹 중계(PC에 연결한 Xbox·PS 패드, EV3 포함) ② Xbox 직접 연결(SPIKE) ③ LMS-ESP32 BluePad32 |
| + | 다국어 | 한국어 · English · 日本語 · 简体中文 · 繁體中文 · Español · ไทย — 블록·메뉴·메시지·예제·사용법·생성 코드 주석까지. 위쪽 언어 선택 (또는 주소 뒤 `?lang=ja`) |
| + | 허브에 다운로드 | 📥 버튼: 실행하지 않고 허브에 저장 → 컴퓨터 없이 허브 버튼으로 실행. 허브에서 고른 슬롯에 저장 (Prime 5개·EV3 4개), ▶ 실행도 고른 슬롯 실행 |
| + | 다운로드 | ⬇ 다운로드: 파이썬 `.py` / 파이썬 + 허브 라이브러리 `.zip` (Pybricks Code 에서 열기) / 블록 프로젝트 `.json` |
| + | 사용 방법 팝업 | 처음 접속 때 자동 표시, ❓ 버튼으로 다시 열기, 아무 곳이나 클릭하면 닫힘. 펌웨어 설치(Prime·Essential·EV3), Windows·macOS·크롬북·Linux/안드로이드 설정, 버그 신고(메일 + 신고 내용 복사) |
| 8 | 안톤 마인드스톰 ESP32 | `rm_esp32.ESP32` — PUPRemote(`pupremote_hub`) 래퍼. 여러 포트 동시 사용, 채널/명령 블록 |

## 실행 방법 (로컬 웹)

압축을 푼 폴더에서 운영체제에 맞는 파일을 **더블클릭**하면 이 컴퓨터 안에서 웹 서버가 켜지고 크롬이 열립니다.
열린 검은 창(서버)을 닫으면 종료됩니다. 주소는 `http://localhost:8000` (사용 중이면 8001, 8002 …).

| 운영체제 | 실행 파일 | 필요한 것 |
|---|---|---|
| Windows 10/11 | `start-windows.bat` | 없음 (윈도우 기본 PowerShell 사용) |
| macOS | `start-mac.command` | python3 (처음 한 번 `xcode-select --install`). 처음엔 우클릭 → 열기 |
| Linux · 크롬북(Linux) | `start-linux.sh` | python3 |

- Web Bluetooth·WebUSB·카메라는 `localhost` 에서 동작합니다. `index.html` 을 파일로 직접 열면(`file://`) 동작하지 않습니다.
- 블록 코딩·컴파일·허브 연결은 인터넷 없이 됩니다. **AI 카메라**와 글꼴(Pretendard)만 처음에 인터넷(CDN)에서 받습니다.
- 다른 컴퓨터에서 접속하게 하려면 GitHub Pages 등 HTTPS 호스팅에 폴더째 올리세요.

### 사용 순서
1. 위쪽에서 허브 종류 선택 → **허브 연결** (Prime/Essential 은 허브 전원 켜고 블루투스 목록에서 선택, EV3 는 USB 케이블 연결 후 선택)
2. 블록을 「▶ 프로그램 시작할 때」 아래에 붙이기 (떨어진 블록은 실행되지 않음)
3. **▶ 실행** (Ctrl+Enter). 터미널에 `print` 출력과 오류가 보입니다. 컴퓨터 없이 쓰려면 **📥 허브에 다운로드** (저장만) → 허브 버튼으로 실행
4. AI 카메라 / 웹 게임패드는 해당 탭을 켜 두면 **프로그램이 실행 중일 때** 0.08초마다 값을 허브로 보냅니다


### AI 카메라 사물·색 (v0.3.0 추가)

- 카메라 탭 위의 칩(손 / 스켈레톤 / 사물 / 사물 학습 / 색)으로 쓸 기능만 켭니다. 많이 켤수록 느려집니다.
- **사물 학습**: 1~5번 이름을 쓰고 「📸 누르고 있기」를 누른 채 물건을 여러 각도로 비춥니다(번호마다 20장 이상 권장, 최대 100장). 아무것도 없는 배경도 한 번호로 학습하면 더 정확합니다.
- **색 학습**: 물건을 화면 가운데 네모에 대고 「학습」. 같은 색 덩어리를 화면 전체에서 찾아 X·Y(0~100)·크기(%)를 보냅니다.
- 학습 내용은 이 브라우저에 저장되고, 「내보내기」로 `.json` 파일을 만들어 다른 컴퓨터에서 「불러오기」 할 수 있습니다.
- 허브로 보내는 줄: `O:`(사물 3개) `T:`(학습 사물 번호, 확신도) `C:`(가운데 색, RGB) `K:`(학습 색 5개).

### LMS-ESP32 (PUPRemote) 연결 (v0.3.1)

- **⬇ 다운로드 → ESP32 쪽 파일**: 허브 프로그램의 「ESP32 채널/명령 등록」 블록에 맞춘 `main.py` + `lpf2.py`·`pupremote.py`(PUPRemote 2.1.3) 를 zip 으로 받습니다. 포트가 여럿이면 `port_A/`, `port_B/` … 로 나뉩니다.
- **Pybricks 4.x 허브는 ESP32 쪽 lpf2.py 2.1 이상이 필요**합니다 (2026-06 PUPRemote 수정). 옛 펌웨어에 든 lpf2 로는 허브에서 `OSError: [Errno 19] ENODEV` 가 납니다. 복사한 파일이 펌웨어 내장본보다 먼저 쓰이고, ESP32 터미널에 `lpf2 2.1.3` 이 찍힙니다.
- 허브는 ESP32 를 최대 4초 기다린 뒤 오류를 냅니다. ENODEV 가 나면 터미널에 확인 목록(💡)이 나옵니다 (ESP32·BluePad32·허스키렌즈 각각).
- `power=True` 에서 채널/명령 이름은 영문 5글자 이하. 등록 순서·이름·형식은 허브와 ESP32 가 같아야 합니다.

## 업데이트 올리는 법 (GitHub Pages)

GitHub Pages 는 파일을 브라우저에 **10분 동안 캐시**합니다. 그래서 새 파일을 올려도 바로 안 보이거나, 옛 파일과 새 파일이 섞여 화면이 이상해질 수 있습니다.

1. 코드를 고쳤다면 `python3 tools/set_version.py 0.3.1` 처럼 **버전을 올립니다**. 모든 파일 주소 뒤에 `?v=버전` 이 붙어, 브라우저가 새 파일을 바로 받습니다.
2. 폴더 전체를 저장소에 올립니다 (`index.html` 이 저장소 맨 위에 있어야 함).
3. 1~2분 뒤 **강력 새로고침**: Windows·크롬북 `Ctrl + Shift + R`, Mac `Cmd + Shift + R`.

## 설정 바꾸기

- **버그 신고 연락처·버전**: `js/config.js` 의 `contactEmail`, `contactName`, `version` (GitHub 이슈 주소를 `issuesUrl` 에 넣으면 버튼이 생깁니다)
- **언어 추가**: `js/lang/en.js` 를 복사해 `js/lang/<코드>.js` 로 번역 → `js/i18n.js` 의 `LANGS` 에 한 줄 추가 → Blockly 기본 메시지(`node_modules/blockly/msg/<코드>.js`)를 `vendor/blockly/msg/` 에 복사
- 사용 방법 팝업은 버전(0.2 등)이 바뀌면 다시 한 번 자동으로 뜹니다. 주소 뒤에 `?nohelp` 를 붙이면 뜨지 않습니다.

## 폴더 구조

```
index.html          화면
img/                로고 (logo.png, favicon.png)
start-windows.bat   로컬 실행 (Windows) — tools/server.ps1
start-mac.command   로컬 실행 (macOS)
start-linux.sh      로컬 실행 (Linux)
css/app.css
js/app.js           화면 연결, 저장/불러오기, 실행, 데이터 중계
js/blocks.js        블록 정의 + 파이썬 생성기
js/toolbox.js       허브별 블록 꾸러미
js/hubs.js          허브별 포트·기능 표
js/pybricks.js      Pybricks BLE/USB 프로토콜, 다중 모듈 컴파일·다운로드
js/aicam.js         MediaPipe 손·스켈레톤
js/gamepad.js       Gamepad API (Xbox/PS)
js/examples.js      예제 6종
js/i18n.js          다국어 (언어 감지·선택, t() 번역 함수)
js/lang/*.js        언어별 번역 (en 이 기준, 키 325개)
js/help.js          사용 방법 팝업 + 버그 신고
js/config.js        버전·버그 신고 연락처
js/zip.js           .zip 다운로드
tests/              검증 도구 (가짜 허브 실행기, 공식 가상 허브 실행기, 브라우저 e2e)
hublib/             허브로 함께 내려가는 파이썬 모듈 (사용한 것만 자동 포함)
  rm_link.py        웹 → 허브 데이터 수신 (stdin 한 줄 프레임)
  rm_aicam.py       AI 카메라 값
  rm_pad.py         게임패드 통합 클래스
  rm_husky.py       허스키렌즈
  rm_esp32.py       LMS-ESP32 (PUPRemote 래퍼)
  pupremote_hub.py  Anton's Mindstorms 원본 (GPL-3.0)
  bluepad.py        Anton's Mindstorms 원본 (GPL-3.0)
vendor/             Blockly 11 + 기본 메시지 7개 언어 (Apache-2.0), mpy-cross v6 WASM (MIT)
```

## 동작 원리

- **컴파일**: 메인 코드의 `import` 를 따라가 `hublib/` 모듈을 찾아 각각 mpy-cross(ABI 6)로 컴파일하고
  `[크기 u32][이름\0][mpy]` 형식으로 이어 붙입니다 (Pybricks Code 와 같은 방식, 첫 모듈이 `__main__`).
- **다운로드**: Pybricks Profile 명령 `WRITE_USER_PROGRAM_META(0)` → `WRITE_USER_RAM` 조각들 → `META(크기)` → `START_USER_PROGRAM(슬롯 0)`.
  USB 는 같은 명령 앞에 메시지 종류 바이트(0x02)를 붙이고 응답을 기다립니다.
- **웹 → 허브 데이터**: 실행 중인 프로그램의 stdin 으로 한 줄 프레임을 보냅니다.
  `H:감지,제스처,X,Y,손가락` / `P:감지,코X,코Y,왼손,오른손,몸X,기울기,양팔` / `G:LX,LY,RX,RY,LT,RT,버튼비트,방향키`.
  1.5초 동안 새 값이 없으면 허브 쪽은 "끊김"(0)으로 처리합니다.

## 허스키렌즈 펌웨어 권장 수정 (선택)

`husky_spike_esp32/firmware/main.py` 의 mode5 4번째 값에 ID 를 넣으면 Pybricks 에서 모드 전환 없이 한 번에 읽어 더 빠르고 안정적입니다.
SPIKE App 워드블럭(원시 빨강/초록/파랑)에는 영향이 없습니다.

```python
# 284, 290행
lp.mode_values = {0: [oid], 1: [0], 5: [v1, v2, v3, oid]}
lp.load_payload([v1, v2, v3, oid], 5)
```

수정하지 않아도 동작합니다 (이때는 mode0 을 따로 읽어 ID 를 얻습니다).

## 검증 결과 (v0.3.0 추가분)

| 검증 | 결과 |
|---|---|
| 7개 언어 × 블록 27묶음 컴파일, 번역 누락·글자 넘침 | 모두 통과 |
| 가상 카메라(파랑/빨강 영상): 사물 학습 2종 분류, 색 학습 덩어리 추적, O/T/C/K 전송, 새로고침 후 학습 유지 | 13/13 통과 |
| 가상 카메라(정지 표지판 영상): 사물 인식 | 「정지 표지판 92% (X 70, Y 39)」 |
| Pybricks 가상 허브에서 새 블록 11개·예제 3종 실행 (프레임 주입) | 모두 통과 (값 30·95·87·220·72 등 일치, 예제 회전·숫자 표시 동작) |
| 블루투스/USB e2e, 다운로드 메뉴 | 26/26 통과 |

- 실제 물건·조명에서의 인식률은 아직 확인하지 않았습니다(합성 영상으로만 검증).

## 검증 결과 (v0.1.1, 샌드박스)

| 검증 | 방법 | 결과 |
|---|---|---|
| 블록 → 파이썬 → 컴파일 | 허브별 전체 블록(67~78개)·예제 6종·게임패드 3방식, mpy-cross ABI6 | 25/25 통과 |
| **Pybricks 공식 가상 허브** | pybricks-micropython v4 소스로 virtualhub 빌드 → 예제·모터/주행/제어/연산 블록 프로그램 9종 실제 실행, stdin 으로 AI 카메라·게임패드 프레임 주입 (`tests/virtualhub`) | 9/9 통과. 주행 600mm·180° 정확, 손바닥 → 306°/s 전진, 패드 탱크 731/292°/s, 한글 변수·함수 동작 |
| 파이썬 실행 | `tests/mockhub` — Pybricks v4 소스에서 뽑은 API만 허용하는 가짜 허브에서 실제 실행 + stdin 프레임 주입 | 25/25 통과, 모터·불빛 출력 값 확인 |
| 블루투스 흐름 (Prime) | `tests/e2e` — 가짜 Pybricks BLE 허브: 연결 → 다운로드 → 실행 → stdout → 게임패드/AI 카메라 값 중계 → 정지 → 끊기 | 통과 (허브 RAM 을 펌웨어 방식으로 해석해 모듈 일치 확인) |
| USB 흐름 (EV3) | 가짜 WebUSB Pybricks 장치: 인터페이스 검색·구독·응답 대기·실행·정지 | 통과 |
| 오류 처리 | 문법 오류 표시, 직접 편집 코드 실행, 새로고침 복원 | 통과 |

- AI 카메라: 가상 카메라로 모델 로딩·추론·중계 확인. 테스트 서버는 GPU 가 없어 초당 1~2회였고, 일반 PC(GPU)는 훨씬 빠릅니다. 계산은 초당 최대 15회로 제한했습니다.
- 가상 허브에 없는 기능(센서, 매트릭스 화면, 스피커, IMU, PUPDevice, Xbox)은 가짜 허브(mockhub)로만 확인했습니다.
- 실기에서 확인이 필요한 것: 실제 허브 BLE/USB, 허스키렌즈 브리지를 Pybricks `PUPDevice` 로 읽기, LMS-ESP32 BluePad32 버튼·방향키 비트 순서, Prime USB(펌웨어 실험 기능)
- EV3 에는 허스키렌즈·ESP32·Xbox 직접 연결 블록을 숨겼습니다 (Pybricks EV3 에 해당 기능이 없거나 브리지가 SPIKE 전용)

## 라이선스

이 에디터 코드는 로보메이커스 소유. 포함된 오픈소스: Blockly(Apache-2.0), @pybricks/mpy-cross-v6(MIT),
MediaPipe Tasks(Apache-2.0, CDN 로드), Pybricks 프로토콜 구현 참고(pybricks-code, MIT),
`hublib/pupremote_hub.py`·`hublib/bluepad.py`(Anton Vanhoucke & Ste7an, **GPL-3.0** — 이 두 파일을 수정·배포할 때 GPL 조건 적용).
