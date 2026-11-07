# 로보메이커스 워드블럭 웹 에디터 (v0.1.3)

크롬에서 바로 쓰는 **SPIKE Prime · SPIKE Essential · EV3** 용 워드블럭 코딩 프로그램입니다.
허브에는 **Pybricks 최신 펌웨어(v4)** 가 설치되어 있어야 하며, 블록은 Pybricks 파이썬 코드로 바뀌어 허브에서 실행됩니다.

## 기능

| # | 요구사항 | 구현 |
|---|---|---|
| 1 | 크롬 웹 서비스 | 설치 없는 정적 웹앱 (HTML/JS). 크롬·엣지 데스크톱, 안드로이드 크롬 |
| 2 | Pybricks 펌웨어 + 워드블럭 | Blockly(zelos 렌더러, SPIKE 앱 스타일 색) 한국어 블록 → Pybricks 파이썬 → 브라우저에서 mpy-cross 컴파일 → 허브로 내려받아 실행 |
| 3 | 파이썬 코드 보기 | 오른쪽 「파이썬」 탭. 실시간 변환, 복사, `.py` 저장, **직접 편집 후 실행** 가능. 한글 변수·함수 이름 그대로 사용 |
| 4 | AI 카메라 (스켈레톤·손) | MediaPipe(브라우저 내 계산) 손 제스처 7종·손 위치·손가락 수, 스켈레톤(손 들기, 양팔 벌림, 몸 위치, 어깨 기울기). 값만 허브로 전송 |
| 5 | EV3 · Prime · Essential | Prime·Essential = 블루투스(Web Bluetooth), EV3 = USB(WebUSB), Prime USB 는 실험적 |
| 6 | 허스키렌즈 | `rm_husky.HuskyLens` — husky_spike_esp32 브리지(색 센서 위장)를 Pybricks 에서 읽음. 블록형/라인 추적형 모두 |
| 7 | Xbox / PS 조종기 | `rm_pad.Gamepad` — ① 웹 중계(PC에 연결한 Xbox·PS 패드, EV3 포함) ② Xbox 직접 연결(SPIKE) ③ LMS-ESP32 BluePad32 |
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
3. **▶ 실행** (Ctrl+Enter). 터미널에 `print` 출력과 오류가 보입니다
4. AI 카메라 / 웹 게임패드는 해당 탭을 켜 두면 **프로그램이 실행 중일 때** 0.08초마다 값을 허브로 보냅니다

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
tests/              검증 도구 (가짜 허브 실행기, 공식 가상 허브 실행기, 브라우저 e2e)
hublib/             허브로 함께 내려가는 파이썬 모듈 (사용한 것만 자동 포함)
  rm_link.py        웹 → 허브 데이터 수신 (stdin 한 줄 프레임)
  rm_aicam.py       AI 카메라 값
  rm_pad.py         게임패드 통합 클래스
  rm_husky.py       허스키렌즈
  rm_esp32.py       LMS-ESP32 (PUPRemote 래퍼)
  pupremote_hub.py  Anton's Mindstorms 원본 (GPL-3.0)
  bluepad.py        Anton's Mindstorms 원본 (GPL-3.0)
vendor/             Blockly 11 (Apache-2.0), mpy-cross v6 WASM (MIT)
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
