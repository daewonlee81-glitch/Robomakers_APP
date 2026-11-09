#!/usr/bin/env python3
"""AI 카메라 「학습 방법 안내」 글 (7개 언어). 실행하면 js/lang/*.js 의 cam.guide · aiguide.* 키를 새로 씁니다.

    python3 tools/aiguide_text.py

aiguide.html 안의 {svg} 자리에 「가장 비슷한 사진 5장」 그림이 들어갑니다 (js/aiguide.js).
id="aig-teach" · id="aig-color" 는 사물 학습 · 색 학습 칸의 📖 버튼이 바로 그 부분을 엽니다.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TEXT = {
'ko': {
 'cam.guide': '📖 학습 방법',
 'aiguide.title': 'AI 카메라 학습 방법 안내',
 'aiguide.svgAlt': '새 사진과 가장 비슷한 학습 사진 5장을 고르는 그림',
 'aiguide.svgA': '사물 1 학습 사진',
 'aiguide.svgB': '사물 2 학습 사진',
 'aiguide.html': '''<div class="guide">
<h4>🧠 AI는 어떻게 배울까요?</h4>
<p>AI는 카메라 사진 한 장을 <b>특징 숫자 1,024개</b>로 바꿉니다. 학습이란 「이런 숫자가 나오면 <b>빨간 컵</b>이야」 하고 <b>예시 사진을 많이 알려 주는 것</b>이에요.</p>
<p>새 사진이 들어오면 AI는 학습 사진 가운데 <b>가장 비슷한 5장</b>을 찾아, 그중 많은 쪽으로 답합니다 (최근접 이웃 방법). 5장 중 4장이 「사물 1」이면 <b>확신도 80%</b> 입니다. 그래서 <b>좋은 예시를 많이</b> 줄수록 똑똑해집니다.</p>
{svg}
<p class="tip">💡 따로 「학습시키기」 버튼은 없습니다. 📸 로 사진을 모으는 순간 바로 배우고, 바로 시험할 수 있어요.</p>

<h4 id="aig-teach">📦 사물 학습 — 5단계</h4>
<ol>
<li><b>준비</b> — 위쪽 칩에서 <b>🎓 사물 학습</b>을 켜고 <b>카메라 켜기</b>를 누릅니다.</li>
<li><b>무엇을 구분할지 정하기</b> — 최대 5가지. 이름 칸에 <i>빨간 컵 / 파란 공 / 배경</i> 처럼 씁니다 (블록 목록에도 이 이름이 나와요). <b>배경(아무것도 없음)</b> 종류를 꼭 하나 두세요. 그래야 물건이 없을 때 「없다」고 답합니다.</li>
<li><b>사진 모으기</b> — 줄마다 <b>📸 누르고 있기</b>를 누르고 있는 동안 사진이 쌓입니다. 종류마다 <b>30~50장</b> (최대 100장). 물건을 <b>돌리고, 가까이·멀리, 왼쪽·오른쪽</b>으로 움직이며 찍으세요.</li>
<li><b>시험하기</b> — 물건을 보여 주면 그 줄이 밝아지고 확신도 막대가 올라갑니다. 틀리게 답하면 <b>그 상황의 사진을 더 찍어</b> 주세요. 잘못 찍은 줄은 🗑 로 지우고 다시 찍습니다.</li>
<li><b>블록으로 쓰기</b> — <code>📷 학습한 사물이 [빨간 컵] 인가?</code> 를 <code>만약</code> 이나 <code>~까지 기다리기</code> 에 넣어 로봇을 움직입니다. <code>📷 학습한 사물 [확신도]</code> 로 「80% 넘을 때만」 처럼 조건을 더 단단하게 할 수 있어요.</li>
</ol>
<p class="tip">💡 <b>잘 배우게 하는 법</b>: 종류마다 사진 수를 비슷하게 · <b>로봇을 쓸 장소와 조명</b>에서 학습 · 배경은 단순하게 · 손이 함께 찍히면 AI가 「손」을 배울 수 있으니 <b>배경 종류에도 손을 넣어</b> 찍기</p>

<h4 id="aig-color">🎨 색 학습 — 4단계</h4>
<ol>
<li>위쪽 칩에서 <b>🎨 색 인식·학습</b>을 켜고 카메라를 켭니다.</li>
<li>색 물건(공, 색종이 등)을 화면 <b>가운데 네모 안에 가득</b> 차게 댑니다.</li>
<li><b>색 1</b> 줄의 <b>학습</b>을 누릅니다. 최대 5가지 색을 기억합니다. 화면에서 그 색 덩어리에 표시가 붙는지 확인하세요.</li>
<li><code>📷 학습한 [색 1] 이 보이나?</code> · <code>📷 학습한 [색 1] 의 [X 위치]</code> 로 공을 따라가는 로봇을 만듭니다. X 는 왼쪽 0 ~ 오른쪽 100, 크기는 화면에서 차지하는 % 입니다.</li>
</ol>
<p class="tip">💡 <b>선명한 색</b>일수록 잘 찾습니다. 흰색·검정·회색은 밝기로만 구분해서 배경과 헷갈리기 쉬워요. 조명이 바뀌면 다시 학습하세요. 「가운데 색」 블록(빨강·파랑…)은 학습 없이 바로 쓸 수 있습니다.</p>

<h4>🔌 로봇에서 쓰려면</h4>
<ul>
<li>허브를 연결하고 <b>▶ 실행</b>으로 돌리는 동안 <b>카메라가 켜져 있어야</b> 값이 로봇으로 갑니다. 「허브에 다운로드」 후 허브 버튼으로 실행하면 카메라 값은 들어오지 않아요.</li>
<li>학습 내용은 <b>이 브라우저에 저장</b>됩니다. 다른 컴퓨터로 옮기려면 <b>내보내기</b>로 받은 <i>프로젝트이름-ai.json</i> 을 그곳에서 <b>불러오기</b> 하세요.</li>
<li>🧪 시뮬레이터도 같은 브라우저의 학습 결과를 그대로 씁니다.</li>
</ul>

<h4>🤖 예제 아이디어</h4>
<ul>
<li><b>분류 로봇</b>: <code>학습한 사물이 [빨간 컵] 인가?</code> 이면 모터 A 한 바퀴, <code>[파란 공]</code> 이면 반대로 한 바퀴</li>
<li><b>색 따라가기</b>: 무한 반복 — <code>[색 1] 의 X 위치</code> 가 40보다 작으면 왼쪽, 60보다 크면 오른쪽으로 돌기 (예제 메뉴 「색 학습: 학습한 색 1 따라가기」)</li>
<li><b>확신도 게이지</b>: <code>모터 A 를 [학습한 사물 확신도] % 속도로 계속 돌리기</code> — AI가 확실할수록 빨리 돕니다</li>
<li><b>숫자로 보기</b>: 예제 메뉴 「사물 학습: 사물 1·2 를 숫자로 보이기」로 허브 화면에 학습 결과를 띄워 보세요</li>
</ul>
<p class="muted">🔒 AI 계산은 이 컴퓨터 안에서만 이루어지고, 영상은 어디에도 보내지 않습니다. 허브에는 숫자만 전달됩니다.</p>
</div>''',
},
'en': {
 'cam.guide': '📖 How to teach',
 'aiguide.title': 'How to teach the AI camera',
 'aiguide.svgAlt': 'Picture: choosing the 5 training photos most similar to a new photo',
 'aiguide.svgA': 'Object 1 photos',
 'aiguide.svgB': 'Object 2 photos',
 'aiguide.html': '''<div class="guide">
<h4>🧠 How does the AI learn?</h4>
<p>The AI turns each camera photo into <b>1,024 feature numbers</b>. Teaching means <b>showing it many example photos</b>: “when numbers like these appear, it is the <b>red cup</b>.”</p>
<p>For a new photo, the AI finds the <b>5 most similar training photos</b> and answers with the class most of them belong to (nearest-neighbour method). If 4 of the 5 are “Object 1”, the <b>confidence is 80%</b>. So the <b>more good examples</b> you give, the smarter it gets.</p>
{svg}
<p class="tip">💡 There is no separate “train” button. The AI learns the moment you collect photos with 📸, and you can test right away.</p>

<h4 id="aig-teach">📦 Object learning — 5 steps</h4>
<ol>
<li><b>Get ready</b> — turn on the <b>🎓 Teach objects</b> chip at the top and press <b>Start camera</b>.</li>
<li><b>Decide what to tell apart</b> — up to 5 things. Type names such as <i>red cup / blue ball / background</i> (the block lists use these names). Always keep a <b>background (nothing)</b> class, so the AI can answer “nothing” when no object is there.</li>
<li><b>Collect photos</b> — photos pile up while you hold <b>📸 Hold</b> on a row. Take <b>30–50 photos</b> per class (up to 100). <b>Turn the object, move it near and far, left and right</b> while recording.</li>
<li><b>Test</b> — show an object: its row lights up and the confidence bar rises. If the answer is wrong, <b>take more photos of that situation</b>. Clear a badly recorded row with 🗑 and record again.</li>
<li><b>Use it in blocks</b> — put <code>📷 taught object is [red cup] ?</code> in an <code>if</code> or <code>wait until</code> to move the robot. Use <code>📷 taught object [confidence]</code> to make conditions firmer, e.g. “only above 80%”.</li>
</ol>
<p class="tip">💡 <b>Tips</b>: keep the number of photos similar for each class · teach <b>where the robot will be used, in the same light</b> · keep the background simple · if your hand appears in the photos the AI may learn “hand”, so <b>put your hand in the background class too</b></p>

<h4 id="aig-color">🎨 Color learning — 4 steps</h4>
<ol>
<li>Turn on the <b>🎨 Colors</b> chip at the top and turn the camera on.</li>
<li>Hold a colored object (ball, colored paper…) so it <b>fills the square in the centre</b> of the picture.</li>
<li>Press <b>Learn</b> on the <b>Color 1</b> row. It remembers up to 5 colors. Check that a mark appears on that color in the picture.</li>
<li>Build a ball-following robot with <code>📷 learned [color 1] visible?</code> and <code>📷 learned [color 1] [X position]</code>. X goes from 0 (left) to 100 (right); size is the % of the picture it covers.</li>
</ol>
<p class="tip">💡 <b>Vivid colors</b> are found best. White, black and grey are told apart only by brightness, so they mix up with the background easily. Teach again when the light changes. The “centre color” blocks (red, blue…) work without any teaching.</p>

<h4>🔌 Using it on the robot</h4>
<ul>
<li>Connect the hub and <b>keep the camera on</b> while the program runs with <b>▶ Run</b> — that is how the values reach the robot. A program started from the hub button after “Download to hub” gets no camera values.</li>
<li>Teaching is <b>saved in this browser</b>. To move it to another computer, <b>Export</b> the <i>project-ai.json</i> file and <b>Import</b> it there.</li>
<li>The 🧪 simulator uses the teaching saved in the same browser.</li>
</ul>

<h4>🤖 Project ideas</h4>
<ul>
<li><b>Sorting robot</b>: if <code>taught object is [red cup] ?</code> turn motor A one turn, if <code>[blue ball]</code> one turn back</li>
<li><b>Color follower</b>: forever — turn left when <code>[Color 1] X position</code> is below 40, right when above 60 (Examples menu “Learned color: follow color 1”)</li>
<li><b>Confidence gauge</b>: <code>run motor A at [taught object confidence] % speed</code> — the surer the AI, the faster it spins</li>
<li><b>Show it as a number</b>: try the example “Teach objects: show a number for item 1/2” to display the result on the hub</li>
</ul>
<p class="muted">🔒 All AI work happens on this computer and no video is sent anywhere. Only numbers go to the hub.</p>
</div>''',
},
'ja': {
 'cam.guide': '📖 学習のしかた',
 'aiguide.title': 'AI カメラ 学習のしかた',
 'aiguide.svgAlt': '新しい写真にいちばん似た学習写真 5 枚を選ぶ図',
 'aiguide.svgA': '物 1 の学習写真',
 'aiguide.svgB': '物 2 の学習写真',
 'aiguide.html': '''<div class="guide">
<h4>🧠 AI はどうやって学ぶの?</h4>
<p>AI はカメラの写真 1 枚を<b>特徴の数 1,024 個</b>に変えます。学習とは「こんな数が出たら<b>赤いコップ</b>だよ」と<b>例の写真をたくさん教えること</b>です。</p>
<p>新しい写真が来ると、AI は学習写真の中から<b>いちばん似た 5 枚</b>を探し、多いほうで答えます(最近傍法)。5 枚のうち 4 枚が「物 1」なら<b>確信度 80%</b> です。だから<b>よい例をたくさん</b>あげるほど賢くなります。</p>
{svg}
<p class="tip">💡「学習させる」ボタンはありません。📸 で写真を集めたしゅんかんに学び、すぐにためせます。</p>

<h4 id="aig-teach">📦 物の学習 — 5 ステップ</h4>
<ol>
<li><b>準備</b> — 上のチップで<b>🎓 物体を学習</b>をオンにし、<b>カメラをオン</b>を押します。</li>
<li><b>何を見分けるか決める</b> — 最大 5 つ。名前の欄に<i>赤いコップ / 青いボール / 背景</i>のように書きます(ブロックの一覧にもこの名前が出ます)。<b>背景(何もない)</b>の種類をかならず 1 つ作りましょう。物がないときに「ない」と答えられます。</li>
<li><b>写真を集める</b> — 行ごとに<b>📸 押し続ける</b>を押している間、写真がたまります。種類ごとに<b>30〜50 枚</b>(最大 100 枚)。物を<b>回したり、近く・遠く、左・右</b>に動かしながら撮りましょう。</li>
<li><b>ためす</b> — 物を見せるとその行が明るくなり、確信度のバーが上がります。まちがえたら<b>その場面の写真をもっと撮って</b>ください。失敗した行は 🗑 で消して撮りなおします。</li>
<li><b>ブロックで使う</b> — <code>📷 学習した物が [赤いコップ] ?</code> を<code>もし</code>や<code>〜まで待つ</code>に入れてロボットを動かします。<code>📷 学習した物の [確信度]</code> で「80% をこえたときだけ」のように条件をしっかりできます。</li>
</ol>
<p class="tip">💡 <b>上手に教えるこつ</b>: 種類ごとの写真の数をそろえる · <b>ロボットを使う場所と明るさ</b>で学習 · 背景はシンプルに · 手がいっしょに写ると AI が「手」を覚えることがあるので<b>背景の種類にも手を入れて</b>撮る</p>

<h4 id="aig-color">🎨 色の学習 — 4 ステップ</h4>
<ol>
<li>上のチップで<b>🎨 色認識・学習</b>をオンにしてカメラをつけます。</li>
<li>色のある物(ボール、色紙など)を画面<b>まん中の四角いっぱい</b>に近づけます。</li>
<li><b>色 1</b> の行の<b>学習</b>を押します。最大 5 色おぼえます。画面でその色のかたまりに印がつくか見ましょう。</li>
<li><code>📷 学習した [色 1] が見える?</code> · <code>📷 学習した [色 1] の [X 位置]</code> でボールを追いかけるロボットを作ります。X は左 0 〜右 100、大きさは画面にしめる % です。</li>
</ol>
<p class="tip">💡 <b>あざやかな色</b>ほどよく見つかります。白・黒・灰色は明るさだけで区別するので背景とまちがえやすいです。明るさが変わったら学習しなおしましょう。「まん中の色」ブロック(赤・青…)は学習なしですぐ使えます。</p>

<h4>🔌 ロボットで使うには</h4>
<ul>
<li>ハブをつないで<b>▶ 実行</b>で動かしている間、<b>カメラがオンになっている</b>と値がロボットに届きます。「ハブにダウンロード」してハブのボタンで動かすと、カメラの値は届きません。</li>
<li>学習した内容は<b>このブラウザーに保存</b>されます。ほかのパソコンに移すには<b>書き出し</b>でできた<i>プロジェクト名-ai.json</i>を、そこで<b>読み込み</b>ます。</li>
<li>🧪 シミュレーターも同じブラウザーの学習結果を使います。</li>
</ul>

<h4>🤖 作品のアイデア</h4>
<ul>
<li><b>仕分けロボット</b>: <code>学習した物が [赤いコップ] ?</code> ならモーター A を 1 回転、<code>[青いボール]</code> なら反対に 1 回転</li>
<li><b>色を追いかける</b>: ずっと — <code>[色 1] の X 位置</code> が 40 より小さければ左、60 より大きければ右へ回る(例「色の学習: 色 1 を追いかける」)</li>
<li><b>確信度メーター</b>: <code>モーター A を [学習した物の確信度] % の速さで回しつづける</code> — AI が自信があるほど速く回ります</li>
<li><b>数字で見る</b>: 例「物体の学習: 物 1・2 を数字で表示」で、ハブの画面に結果を出してみよう</li>
</ul>
<p class="muted">🔒 AI の計算はこのパソコンの中だけで行い、映像はどこにも送りません。ハブには数字だけが届きます。</p>
</div>''',
},
'zh-CN': {
 'cam.guide': '📖 训练方法',
 'aiguide.title': 'AI 摄像头训练方法',
 'aiguide.svgAlt': '选出与新照片最相似的 5 张训练照片的示意图',
 'aiguide.svgA': '物体 1 训练照片',
 'aiguide.svgB': '物体 2 训练照片',
 'aiguide.html': '''<div class="guide">
<h4>🧠 AI 是怎么学习的？</h4>
<p>AI 把每张摄像头照片变成 <b>1,024 个特征数字</b>。训练就是<b>给它看很多示例照片</b>，告诉它“出现这样的数字就是<b>红色杯子</b>”。</p>
<p>来了一张新照片，AI 会在训练照片里找出<b>最相似的 5 张</b>，按其中多数的类别回答（最近邻方法）。5 张里有 4 张是“物体 1”，<b>置信度就是 80%</b>。所以给的<b>好例子越多</b>，AI 就越聪明。</p>
{svg}
<p class="tip">💡 没有单独的“开始训练”按钮。用 📸 收集照片的那一刻就学会了，可以马上测试。</p>

<h4 id="aig-teach">📦 物体学习 — 5 步</h4>
<ol>
<li><b>准备</b> — 在上方打开 <b>🎓 物体学习</b>，再按<b>打开摄像头</b>。</li>
<li><b>决定要区分什么</b> — 最多 5 种。在名称栏写上 <i>红色杯子 / 蓝色球 / 背景</i>（积木列表里也会出现这些名字）。一定要有一个<b>背景（什么都没有）</b>类别，这样没有物体时它才会回答“没有”。</li>
<li><b>收集照片</b> — 按住每一行的 <b>📸 按住</b>，照片就会一直增加。每类 <b>30~50 张</b>（最多 100 张）。拍摄时把物体<b>转一转，放近、放远，往左、往右</b>移动。</li>
<li><b>测试</b> — 给它看物体，对应的行会亮起来，置信度条会升高。答错了就<b>多拍一些那个情况的照片</b>。拍坏的行用 🗑 删除后重拍。</li>
<li><b>用积木</b> — 把 <code>📷 学习的物体是 [红色杯子] 吗？</code> 放进<code>如果</code>或<code>等待直到</code>，让机器人动起来。用 <code>📷 学习物体的 [置信度]</code> 可以把条件定得更严，比如“超过 80% 才动”。</li>
</ol>
<p class="tip">💡 <b>训练技巧</b>：每类照片数量差不多 · 在<b>机器人实际使用的地方和光线</b>下训练 · 背景简单 · 手被拍进去 AI 可能会学“手”，所以<b>背景类里也拍进手</b></p>

<h4 id="aig-color">🎨 颜色学习 — 4 步</h4>
<ol>
<li>在上方打开 <b>🎨 颜色识别·学习</b>，再打开摄像头。</li>
<li>把彩色物体（球、彩纸等）靠近，让它<b>填满画面中央的方框</b>。</li>
<li>按 <b>颜色 1</b> 这一行的<b>学习</b>。最多记住 5 种颜色。看看画面里那块颜色上是否出现标记。</li>
<li>用 <code>📷 看到已学的 [颜色 1] ?</code> 和 <code>📷 已学 [颜色 1] 的 [X 位置]</code> 做一个追球机器人。X 从左 0 到右 100，大小是占画面的 %。</li>
</ol>
<p class="tip">💡 <b>颜色越鲜艳</b>越容易找到。白、黑、灰只能按亮度区分，容易和背景混淆。光线变了就重新学习。“中间颜色”积木（红、蓝……）不用学习就能直接用。</p>

<h4>🔌 在机器人上使用</h4>
<ul>
<li>连接主机后用 <b>▶ 运行</b>时，<b>摄像头要一直开着</b>，数值才会传到机器人。“下载到主机”后用主机按钮运行时，收不到摄像头数值。</li>
<li>训练内容<b>保存在这个浏览器</b>里。要换到别的电脑，用<b>导出</b>得到 <i>项目名-ai.json</i>，在那台电脑上<b>导入</b>。</li>
<li>🧪 模拟器也直接使用同一浏览器里的训练结果。</li>
</ul>

<h4>🤖 作品点子</h4>
<ul>
<li><b>分类机器人</b>：如果 <code>学习的物体是 [红色杯子] 吗？</code> 电机 A 转一圈，是 <code>[蓝色球]</code> 就反转一圈</li>
<li><b>追颜色</b>：重复执行 — <code>[颜色 1] 的 X 位置</code> 小于 40 向左，大于 60 向右转（示例菜单“颜色学习：跟随颜色 1”）</li>
<li><b>置信度仪表</b>：<code>电机 A 以 [学习物体的 置信度] % 速度持续转动</code> — AI 越确定转得越快</li>
<li><b>用数字看</b>：试试示例“物体学习：用数字显示物体 1/2”，把结果显示在主机屏幕上</li>
</ul>
<p class="muted">🔒 AI 计算只在这台电脑里进行，影像不会发送到任何地方。传给主机的只有数字。</p>
</div>''',
},
'zh-TW': {
 'cam.guide': '📖 訓練方法',
 'aiguide.title': 'AI 攝影機訓練方法',
 'aiguide.svgAlt': '選出與新照片最相似的 5 張訓練照片的示意圖',
 'aiguide.svgA': '物體 1 訓練照片',
 'aiguide.svgB': '物體 2 訓練照片',
 'aiguide.html': '''<div class="guide">
<h4>🧠 AI 是怎麼學習的？</h4>
<p>AI 把每張攝影機照片變成 <b>1,024 個特徵數字</b>。訓練就是<b>給它看很多範例照片</b>，告訴它「出現這樣的數字就是<b>紅色杯子</b>」。</p>
<p>來了一張新照片，AI 會在訓練照片裡找出<b>最相似的 5 張</b>，依其中多數的類別回答（最近鄰方法）。5 張裡有 4 張是「物體 1」，<b>信心度就是 80%</b>。所以給的<b>好例子越多</b>，AI 就越聰明。</p>
{svg}
<p class="tip">💡 沒有單獨的「開始訓練」按鈕。用 📸 收集照片的那一刻就學會了，可以馬上測試。</p>

<h4 id="aig-teach">📦 物體學習 — 5 步</h4>
<ol>
<li><b>準備</b> — 在上方打開 <b>🎓 物體學習</b>，再按<b>開啟攝影機</b>。</li>
<li><b>決定要區分什麼</b> — 最多 5 種。在名稱欄寫上 <i>紅色杯子 / 藍色球 / 背景</i>（積木清單裡也會出現這些名字）。一定要有一個<b>背景（什麼都沒有）</b>類別，這樣沒有物體時它才會回答「沒有」。</li>
<li><b>收集照片</b> — 按住每一列的 <b>📸 按住</b>，照片就會一直增加。每類 <b>30~50 張</b>（最多 100 張）。拍攝時把物體<b>轉一轉，放近、放遠，往左、往右</b>移動。</li>
<li><b>測試</b> — 給它看物體，對應的列會亮起來，信心度條會升高。答錯了就<b>多拍一些那個情況的照片</b>。拍壞的列用 🗑 刪除後重拍。</li>
<li><b>用積木</b> — 把 <code>📷 學習的物體是 [紅色杯子] 嗎？</code> 放進<code>如果</code>或<code>等待直到</code>，讓機器人動起來。用 <code>📷 學習物體的 [信心度]</code> 可以把條件定得更嚴，例如「超過 80% 才動」。</li>
</ol>
<p class="tip">💡 <b>訓練技巧</b>：每類照片數量差不多 · 在<b>機器人實際使用的地方和光線</b>下訓練 · 背景簡單 · 手被拍進去 AI 可能會學「手」，所以<b>背景類裡也拍進手</b></p>

<h4 id="aig-color">🎨 顏色學習 — 4 步</h4>
<ol>
<li>在上方打開 <b>🎨 顏色辨識·學習</b>，再開啟攝影機。</li>
<li>把彩色物體（球、色紙等）靠近，讓它<b>填滿畫面中央的方框</b>。</li>
<li>按 <b>顏色 1</b> 這一列的<b>學習</b>。最多記住 5 種顏色。看看畫面裡那塊顏色上是否出現標記。</li>
<li>用 <code>📷 看到已學的 [顏色 1] ?</code> 和 <code>📷 已學 [顏色 1] 的 [X 位置]</code> 做一個追球機器人。X 從左 0 到右 100，大小是佔畫面的 %。</li>
</ol>
<p class="tip">💡 <b>顏色越鮮豔</b>越容易找到。白、黑、灰只能依亮度區分，容易和背景混淆。光線變了就重新學習。「中間顏色」積木（紅、藍……）不用學習就能直接用。</p>

<h4>🔌 在機器人上使用</h4>
<ul>
<li>連接集線器後用 <b>▶ 執行</b>時，<b>攝影機要一直開著</b>，數值才會傳到機器人。「下載到集線器」後用集線器按鈕執行時，收不到攝影機數值。</li>
<li>訓練內容<b>儲存在這個瀏覽器</b>裡。要換到別的電腦，用<b>匯出</b>得到 <i>專案名-ai.json</i>，在那台電腦上<b>匯入</b>。</li>
<li>🧪 模擬器也直接使用同一瀏覽器裡的訓練結果。</li>
</ul>

<h4>🤖 作品點子</h4>
<ul>
<li><b>分類機器人</b>：如果 <code>學習的物體是 [紅色杯子] 嗎？</code> 馬達 A 轉一圈，是 <code>[藍色球]</code> 就反轉一圈</li>
<li><b>追顏色</b>：重複執行 — <code>[顏色 1] 的 X 位置</code> 小於 40 向左，大於 60 向右轉（範例選單「顏色學習：跟隨顏色 1」）</li>
<li><b>信心度儀表</b>：<code>馬達 A 以 [學習物體的 信心度] % 速度持續轉動</code> — AI 越確定轉得越快</li>
<li><b>用數字看</b>：試試範例「物體學習：用數字顯示物體 1/2」，把結果顯示在集線器螢幕上</li>
</ul>
<p class="muted">🔒 AI 計算只在這台電腦裡進行，影像不會傳送到任何地方。傳給集線器的只有數字。</p>
</div>''',
},
'es': {
 'cam.guide': '📖 Cómo enseñar',
 'aiguide.title': 'Cómo enseñar a la cámara IA',
 'aiguide.svgAlt': 'Dibujo: elegir las 5 fotos de entrenamiento más parecidas a una foto nueva',
 'aiguide.svgA': 'Fotos del objeto 1',
 'aiguide.svgB': 'Fotos del objeto 2',
 'aiguide.html': '''<div class="guide">
<h4>🧠 ¿Cómo aprende la IA?</h4>
<p>La IA convierte cada foto de la cámara en <b>1.024 números de características</b>. Enseñar es <b>mostrarle muchas fotos de ejemplo</b>: «cuando salgan números así, es el <b>vaso rojo</b>».</p>
<p>Con una foto nueva, la IA busca las <b>5 fotos de entrenamiento más parecidas</b> y responde con la clase que más se repite (método del vecino más cercano). Si 4 de las 5 son «Objeto 1», la <b>confianza es 80%</b>. Por eso, cuantos <b>más buenos ejemplos</b> le des, más lista será.</p>
{svg}
<p class="tip">💡 No hay un botón aparte de «entrenar». La IA aprende en cuanto reúnes fotos con 📸 y puedes probar enseguida.</p>

<h4 id="aig-teach">📦 Aprender objetos — 5 pasos</h4>
<ol>
<li><b>Preparar</b> — activa el chip <b>🎓 Enseñar objetos</b> arriba y pulsa <b>Encender cámara</b>.</li>
<li><b>Decidir qué distinguir</b> — hasta 5 cosas. Escribe nombres como <i>vaso rojo / pelota azul / fondo</i> (las listas de bloques usan estos nombres). Ten siempre una clase de <b>fondo (nada)</b>, para que la IA responda «nada» cuando no haya objeto.</li>
<li><b>Reunir fotos</b> — las fotos se acumulan mientras mantienes <b>📸 Mantener</b> en una fila. Toma <b>30–50 fotos</b> por clase (hasta 100). <b>Gira el objeto, acércalo y aléjalo, muévelo a izquierda y derecha</b> mientras grabas.</li>
<li><b>Probar</b> — enseña un objeto: su fila se ilumina y sube la barra de confianza. Si se equivoca, <b>toma más fotos de esa situación</b>. Borra con 🗑 una fila mal grabada y vuelve a grabarla.</li>
<li><b>Usarlo en bloques</b> — pon <code>📷 ¿el objeto enseñado es [vaso rojo] ?</code> en un <code>si</code> o <code>esperar hasta</code> para mover el robot. Con <code>📷 objeto enseñado [confianza]</code> puedes hacer la condición más firme, p. ej. «solo por encima del 80%».</li>
</ol>
<p class="tip">💡 <b>Consejos</b>: número de fotos parecido en cada clase · enseña <b>donde se usará el robot, con la misma luz</b> · fondo sencillo · si tu mano sale en las fotos la IA puede aprender «mano», así que <b>pon la mano también en la clase de fondo</b></p>

<h4 id="aig-color">🎨 Aprender colores — 4 pasos</h4>
<ol>
<li>Activa el chip <b>🎨 Colores</b> arriba y enciende la cámara.</li>
<li>Acerca un objeto de color (pelota, papel de color…) hasta que <b>llene el cuadro del centro</b> de la imagen.</li>
<li>Pulsa <b>Aprender</b> en la fila <b>color 1</b>. Recuerda hasta 5 colores. Comprueba que aparece una marca sobre ese color en la imagen.</li>
<li>Haz un robot que siga una pelota con <code>📷 ¿se ve el [color 1] aprendido?</code> y <code>📷 [color 1] aprendido [posición X]</code>. X va de 0 (izquierda) a 100 (derecha); el tamaño es el % de la imagen que ocupa.</li>
</ol>
<p class="tip">💡 Los <b>colores vivos</b> se encuentran mejor. Blanco, negro y gris solo se distinguen por el brillo y se confunden fácilmente con el fondo. Vuelve a enseñar si cambia la luz. Los bloques de «color central» (rojo, azul…) funcionan sin enseñar nada.</p>

<h4>🔌 Usarlo en el robot</h4>
<ul>
<li>Conecta el hub y <b>deja la cámara encendida</b> mientras el programa funciona con <b>▶ Ejecutar</b>: así llegan los valores al robot. Un programa iniciado con el botón del hub tras «Descargar al hub» no recibe valores de la cámara.</li>
<li>Lo aprendido se <b>guarda en este navegador</b>. Para llevarlo a otro ordenador, usa <b>Exportar</b> para obtener <i>proyecto-ai.json</i> e <b>Importar</b> allí.</li>
<li>El 🧪 simulador usa lo aprendido en el mismo navegador.</li>
</ul>

<h4>🤖 Ideas de proyectos</h4>
<ul>
<li><b>Robot clasificador</b>: si <code>¿el objeto enseñado es [vaso rojo]?</code> gira el motor A una vuelta; si es <code>[pelota azul]</code>, una vuelta al revés</li>
<li><b>Seguidor de color</b>: siempre — gira a la izquierda si <code>posición X de [color 1]</code> es menor que 40 y a la derecha si es mayor que 60 (ejemplo «Color aprendido: seguir el color 1»)</li>
<li><b>Medidor de confianza</b>: <code>girar el motor A a [confianza del objeto enseñado] % de velocidad</code>: cuanto más segura está la IA, más rápido gira</li>
<li><b>Verlo como número</b>: prueba el ejemplo «Enseñar objetos: mostrar un número para el elemento 1/2» para ver el resultado en el hub</li>
</ul>
<p class="muted">🔒 Todo el cálculo de la IA ocurre en este ordenador y el vídeo no se envía a ningún sitio. Al hub solo llegan números.</p>
</div>''',
},
'th': {
 'cam.guide': '📖 วิธีสอน',
 'aiguide.title': 'วิธีสอนกล้อง AI',
 'aiguide.svgAlt': 'ภาพการเลือกรูปฝึก 5 รูปที่คล้ายรูปใหม่ที่สุด',
 'aiguide.svgA': 'รูปฝึกวัตถุ 1',
 'aiguide.svgB': 'รูปฝึกวัตถุ 2',
 'aiguide.html': '''<div class="guide">
<h4>🧠 AI เรียนรู้อย่างไร?</h4>
<p>AI เปลี่ยนรูปจากกล้องแต่ละรูปเป็น<b>ตัวเลขลักษณะ 1,024 ตัว</b> การสอนคือ<b>ให้ดูรูปตัวอย่างเยอะ ๆ</b> ว่า “ถ้าตัวเลขแบบนี้คือ<b>แก้วสีแดง</b>”</p>
<p>เมื่อมีรูปใหม่ AI จะหา<b>รูปฝึก 5 รูปที่คล้ายที่สุด</b> แล้วตอบตามกลุ่มที่มีมากที่สุด (วิธีเพื่อนบ้านใกล้สุด) ถ้า 4 ใน 5 รูปคือ “วัตถุ 1” <b>ความมั่นใจคือ 80%</b> ดังนั้นยิ่งให้<b>ตัวอย่างดี ๆ มาก</b> AI ก็ยิ่งเก่ง</p>
{svg}
<p class="tip">💡 ไม่มีปุ่ม “ฝึก” แยก AI เรียนรู้ทันทีที่เก็บรูปด้วย 📸 และทดสอบได้เลย</p>

<h4 id="aig-teach">📦 สอนวัตถุ — 5 ขั้น</h4>
<ol>
<li><b>เตรียม</b> — เปิดชิป <b>🎓 สอนวัตถุ</b> ด้านบน แล้วกด<b>เปิดกล้อง</b></li>
<li><b>กำหนดว่าจะแยกอะไร</b> — ได้สูงสุด 5 อย่าง พิมพ์ชื่อเช่น <i>แก้วแดง / ลูกบอลฟ้า / พื้นหลัง</i> (รายการในบล็อกจะใช้ชื่อนี้) ต้องมีกลุ่ม<b>พื้นหลัง (ไม่มีอะไร)</b> เสมอ AI จะได้ตอบว่า “ไม่มี” เมื่อไม่มีวัตถุ</li>
<li><b>เก็บรูป</b> — กด<b>📸 กดค้าง</b>ในแต่ละแถว รูปจะสะสมไปเรื่อย ๆ กลุ่มละ <b>30–50 รูป</b> (สูงสุด 100) ระหว่างถ่ายให้<b>หมุนวัตถุ ขยับใกล้-ไกล ซ้าย-ขวา</b></li>
<li><b>ทดสอบ</b> — ยื่นวัตถุให้ดู แถวนั้นจะสว่างและแถบความมั่นใจจะขึ้น ถ้าตอบผิด ให้<b>ถ่ายรูปสถานการณ์นั้นเพิ่ม</b> แถวที่ถ่ายพลาดให้ลบด้วย 🗑 แล้วถ่ายใหม่</li>
<li><b>ใช้ในบล็อก</b> — ใส่ <code>📷 วัตถุที่สอนคือ [แก้วแดง] ?</code> ใน <code>ถ้า</code> หรือ <code>รอจนกว่า</code> เพื่อให้หุ่นยนต์ทำงาน ใช้ <code>📷 วัตถุที่สอน [ความมั่นใจ]</code> ทำเงื่อนไขให้แน่นขึ้น เช่น “เฉพาะเมื่อเกิน 80%”</li>
</ol>
<p class="tip">💡 <b>เคล็ดลับ</b>: จำนวนรูปแต่ละกลุ่มใกล้เคียงกัน · สอน<b>ในที่และแสงที่จะใช้หุ่นยนต์จริง</b> · พื้นหลังเรียบง่าย · ถ้ามือติดในรูป AI อาจเรียน “มือ” จึง<b>ใส่มือในกลุ่มพื้นหลังด้วย</b></p>

<h4 id="aig-color">🎨 สอนสี — 4 ขั้น</h4>
<ol>
<li>เปิดชิป <b>🎨 จดจำ·สอนสี</b> ด้านบนแล้วเปิดกล้อง</li>
<li>ยื่นวัตถุสี (ลูกบอล กระดาษสี ฯลฯ) ให้<b>เต็มกรอบสี่เหลี่ยมกลางภาพ</b></li>
<li>กด<b>สอน</b>ในแถว<b>สี 1</b> จำได้สูงสุด 5 สี ดูว่ามีเครื่องหมายขึ้นบนก้อนสีนั้นในภาพไหม</li>
<li>สร้างหุ่นยนต์ไล่ลูกบอลด้วย <code>📷 เห็น [สี 1] ที่สอน?</code> และ <code>📷 [สี 1] ที่สอน [ตำแหน่ง X]</code> X คือซ้าย 0 ถึงขวา 100 ขนาดคือ % ของภาพ</li>
</ol>
<p class="tip">💡 <b>สีสด</b>ยิ่งหาง่าย ขาว ดำ เทา แยกได้แค่ด้วยความสว่าง จึงสับสนกับพื้นหลังง่าย ถ้าแสงเปลี่ยนให้สอนใหม่ บล็อก “สีตรงกลาง” (แดง ฟ้า…) ใช้ได้ทันทีโดยไม่ต้องสอน</p>

<h4>🔌 ใช้กับหุ่นยนต์</h4>
<ul>
<li>เชื่อมต่อฮับแล้ว<b>เปิดกล้องค้างไว้</b>ระหว่างที่โปรแกรมทำงานด้วย <b>▶ รัน</b> ค่าจึงจะไปถึงหุ่นยนต์ ถ้า “ดาวน์โหลดลงฮับ” แล้วกดปุ่มบนฮับ จะไม่ได้รับค่าจากกล้อง</li>
<li>สิ่งที่สอนจะ<b>บันทึกในเบราว์เซอร์นี้</b> ถ้าจะย้ายไปเครื่องอื่น ให้<b>ส่งออก</b>ไฟล์ <i>ชื่อโปรเจกต์-ai.json</i> แล้ว<b>นำเข้า</b>ที่เครื่องนั้น</li>
<li>🧪 ซิมูเลเตอร์ใช้สิ่งที่สอนไว้ในเบราว์เซอร์เดียวกัน</li>
</ul>

<h4>🤖 ไอเดียผลงาน</h4>
<ul>
<li><b>หุ่นยนต์คัดแยก</b>: ถ้า <code>วัตถุที่สอนคือ [แก้วแดง] ไหม?</code> ให้มอเตอร์ A หมุน 1 รอบ ถ้า <code>[ลูกบอลฟ้า]</code> หมุนกลับ 1 รอบ</li>
<li><b>ไล่ตามสี</b>: วนซ้ำตลอด — ถ้า <code>ตำแหน่ง X ของ [สี 1]</code> น้อยกว่า 40 เลี้ยวซ้าย มากกว่า 60 เลี้ยวขวา (ตัวอย่าง “สีที่สอน: ตามสี 1”)</li>
<li><b>มาตรวัดความมั่นใจ</b>: <code>หมุนมอเตอร์ A ด้วยความเร็ว [ความมั่นใจของวัตถุที่สอน] %</code> — AI ยิ่งมั่นใจยิ่งหมุนเร็ว</li>
<li><b>ดูเป็นตัวเลข</b>: ลองตัวอย่าง “สอนวัตถุ: แสดงตัวเลขของวัตถุ 1/2” เพื่อแสดงผลบนจอฮับ</li>
</ul>
<p class="muted">🔒 การคำนวณ AI ทำในคอมพิวเตอร์เครื่องนี้เท่านั้น ไม่ส่งวิดีโอไปที่ใด ฮับได้รับแค่ตัวเลข</p>
</div>''',
},
}


def main():
    keys = list(TEXT['ko'])
    for lang, d in TEXT.items():
        assert list(d) == keys, (lang, set(keys) ^ set(d))
        p = os.path.join(ROOT, 'js', 'lang', lang + '.js')
        s = open(p, encoding='utf-8').read()
        s = re.sub(r"\n  ['\"](?:aiguide\.[^'\"]+|cam\.guide)['\"]: .*", '', s)
        block = ''.join(f'\n  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},' for k, v in d.items())
        m = re.search(r"\n};\s*$", s)
        assert m, lang
        s = s[:m.start()] + block + s[m.start():]
        open(p, 'w', encoding='utf-8').write(s)
    print(f'{len(TEXT)}개 언어 × {len(keys)}개 키')


if __name__ == '__main__':
    main()
