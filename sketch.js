let shapes = ['circle', 'square', 'triangle'];
let colors = ['#00FFFF', '#FF00FF', '#39FF14', '#FFFF00']; // 龐克霓虹配色
let target, comparison;
let score = 0;
let timeLeft = 60;
let previewTimer = 3;
let gameState = 'START'; // START, PREVIEW, PLAY, END
let lastCheckTime = 0;
let buttons = [];

// 攝影機與手勢偵測變數
let video = null;
let handPose = null;
let hands = [];
let gestureTimer = 0;
let lastGesture = -1; // -1: 無, 0: 握拳, 1-3: 指尖
let detectionReady = false; 

let gestureCooldown = 0; // 防止連續觸發點擊

// 視覺回饋變數
let feedbackAlpha = 0;
let feedbackType = ''; // 'CORRECT' 或 'WRONG'
let bgDecorations = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // 初始化攝影機與 ml5
  try {
    video = createCapture(VIDEO, () => {
      video.size(640, 480);
      video.hide();
      
      handPose = ml5.handPose({ flipped: true }, () => { 
        detectionReady = true; 
        handPose.detectStart(video, (results) => { hands = results; });
      });
    });
  } catch (e) {
    console.error("攝影機或模型啟動失敗:", e);
  }

  // 初始化題目，避免變數 undefined 導致當機
  generateQuestion(true);

  textAlign(CENTER, CENTER);
  setupButtons();
  
  // 初始化背景裝飾線條
  for(let i=0; i<20; i++) {
    bgDecorations.push({x: random(width), y: random(height), w: random(100, 300), h: random(2, 5)});
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  setupButtons();
}

function setupButtons() {
  let btnW = 150;
  let btnH = 60;
  let spacing = 20;
  let startX = width / 2 - (btnW * 1.5 + spacing);
  
  buttons = [
    { label: "1根手指: 相同", x: startX, y: height - 120, w: btnW, h: btnH, id: 'SAME' },
    { label: "2根手指: 部分", x: startX + btnW + spacing, y: height - 120, w: btnW, h: btnH, id: 'PART' },
    { label: "3根手指: 不同", x: startX + (btnW + spacing) * 2, y: height - 120, w: btnW, h: btnH, id: 'DIFF' }
  ];
}

function drawPunkBackground() {
  background(15, 15, 25); // 極深藍色背景
  noStroke();
  fill(40, 40, 60, 100);
  for(let d of bgDecorations) {
    rect(d.x, d.y, d.w, d.h);
  }
  // 掃描線效果
  stroke(255, 255, 255, 10);
  for(let i=0; i<height; i+=10) line(0, i, width, i);
}

function draw() {
  drawPunkBackground();

  // 每幀優先更新手部數據與座標映射
  updateHandData();

  // 繪製攝影機鏡像背景 (安全檢查)
  if (video && video.loadedmetadata) {
    push();
    translate(width, 0);
    scale(-1, 1);
    tint(255, 60); 
    image(video, 0, 0, width, height);
    pop();
  }

  if (gameState === 'START') {
    drawStartScreen();
    handleStartGesture();
  } else if (gameState === 'PREVIEW') {
    drawPreviewScreen();
    handlePreviewTimer();
  } else if (gameState === 'PLAY') {
    drawGameScreen();
    handleGestureLogic();
    updateTimer();
  } else if (gameState === 'END') {
    drawEndScreen();
    handleStartGesture();
  }
  
  drawFeedback();
}

function drawFeedback() {
  if (feedbackAlpha > 0) {
    push();
    rectMode(CORNER);
    noStroke();
    if (feedbackType === 'CORRECT') fill(57, 255, 20, feedbackAlpha);
    else fill(255, 0, 80, feedbackAlpha);
    rect(0, 0, width, height);
    // 顯示大大的回饋文字
    fill(255, feedbackAlpha * 2);
    textSize(80);
    textStyle(BOLD);
    text(feedbackType === 'CORRECT' ? "+10" : "-5", width/2, height/2 - 250);
    textStyle(NORMAL);
    pop();
    
    feedbackAlpha -= 15;
  }
}

function drawStartScreen() {
  rectMode(CENTER);
  // 標題框
  fill(0, 0, 0, 180);
  stroke(0, 255, 255);
  strokeWeight(3);
  rect(width / 2, height / 2 - 55, 350, 100);

  noStroke();
  fill(0, 255, 255);
  textSize(64);
  textStyle(BOLD);
  text("急速判定", width / 2, height / 2 - 50);
  
  textStyle(NORMAL);
  // 指令框
  stroke(255, 0, 255);
  fill(25, 25, 45, 200);
  let boxW = 350;
  rect(width/2, height/2 + 45, boxW, 50);
  
  noStroke();
  fill(255);
  textSize(24);
  
  // 顯示狀態
  push();
  fill(255, 255, 0);
  let debugText = hands.length > 0 ? (countFingers() === 0 ? "已握拳" : "請握拳") : "未偵測到手";
  text("狀態: " + debugText, width / 2, height / 2 + 100);
  pop();
  text(detectionReady ? "請握拳以開始遊戲" : "偵測器啟動中...", width / 2, height / 2 + 45);

  // 握拳進度條顯示
  if (lastGesture === 0 && hands.length > 0 && countFingers() === 0) {
    let progress = map(millis() - gestureTimer, 0, 1000, 0, boxW);
    push();
    noStroke();
    fill(57, 255, 20, 150);
    rectMode(CORNER);
    rect(width/2 - boxW/2, height/2 + 20, min(progress, boxW), 50);
    pop();
  }
}

function drawCard(x, y, w, h) {
  push();
  rectMode(CENTER);
  // 卡片陰影/發光
  noStroke();
  fill(255, 0, 255, 40);
  rect(x + 8, y + 8, w, h, 2);
  // 卡片主體 (帶有科技感的深色紙張)
  fill(25, 25, 45);
  stroke(0, 255, 255);
  strokeWeight(2);
  rect(x, y, w, h, 2);
  // 裝飾邊角
  strokeWeight(4);
  line(x - w/2, y - h/2 + 15, x - w/2, y - h/2);
  line(x - w/2, y - h/2, x - w/2 + 15, y - h/2);
  pop();
}

function drawPreviewScreen() {
  rectMode(CENTER);
  // 倒數框
  fill(0, 0, 0, 150);
  stroke(255, 255, 0);
  strokeWeight(2);
  rect(width / 2, 80, 250, 60);

  noStroke();
  fill(255, 255, 0);
  textSize(40);
  text(`鏈接倒數: ${ceil(previewTimer)}`, width / 2, 80);
  
  drawCard(width / 2, height / 2, 300, 300);
  // 只顯示目標圖案
  drawShape(target.type, target.color, width / 2, height / 2, 200);
  
  fill(255);
  textSize(24);
  stroke(255);
  fill(0, 0, 0, 150);
  rect(width/2, height/2 + 220, 300, 40);
  noStroke();
  fill(255);
  text("記憶目標圖案", width / 2, height / 2 + 220);
}

function drawGameScreen() {
  rectMode(CENTER);
  // 得分框
  fill(0, 0, 0, 150);
  stroke(57, 255, 20);
  rect(100, 50, 160, 50);
  noStroke();
  fill(57, 255, 20);
  textSize(28);
  text(`得分: ${score}`, 100, 50);

  // 時間框
  // 新增：遊戲中的偵測提示
  push();
  fill(255, 255, 0);
  textSize(20);
  let debugText = hands.length > 0 ? "手部已鏈接" : "手部遺失";
  text("狀態: " + debugText, width / 2, 40);
  pop();
  fill(0, 0, 0, 150);
  stroke(255, 0, 80);
  rect(width - 120, 50, 180, 50);
  noStroke();
  fill(255, 0, 80);
  text(`剩餘: ${ceil(timeLeft)}s`, width - 120, 50);

  // 繪製兩張卡片
  drawCard(width / 2 - 250, height / 2 - 100, 300, 350);
  drawCard(width / 2 + 250, height / 2 - 100, 300, 350);

  // 繪製圖案
  drawShape(target.type, target.color, width / 2 - 250, height / 2 - 100, 220);
  drawShape(comparison.type, comparison.color, width / 2 + 250, height / 2 - 100, 220);

  // 繪製手指引導與按鈕狀態
  drawGestureGuide();
}

function updateHandData() {
  // 此處僅確保數據更新，邏輯移至 handleGestureLogic
}

function drawGestureGuide() {
  rectMode(CORNER);
  let currentFingers = countFingers();
  
  for (let i = 0; i < buttons.length; i++) {
    let btn = buttons[i];
    // 根據手指數亮起對應按鈕 (1根手指對應第一個按鈕，依此類推)
    let isActive = currentFingers === (i + 1);
    
    strokeWeight(3);
    stroke(isActive ? "#39FF14" : 100);
    fill(isActive ? color(57, 255, 20, 200) : color(20, 20, 40));
    rect(btn.x, btn.y, btn.w, btn.h, 10);
    
    fill(isActive ? 255 : 200);
    noStroke();
    textSize(20);
    text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);

    // 如果正在感應中，繪製進度條
    if (isActive && lastGesture === currentFingers && gameState === 'PLAY') {
      let progress = map(millis() - gestureTimer, 0, 500, 0, btn.w);
      stroke(255, 255, 0);
      strokeWeight(4);
      line(btn.x, btn.y + btn.h + 5, btn.x + min(progress, btn.w), btn.y + btn.h + 5);
    }
  }
}

function drawEndScreen() {
  rectMode(CENTER);
  // 停機框
  fill(0, 0, 0, 200);
  stroke(255, 0, 80);
  strokeWeight(4);
  rect(width / 2, height / 2 - 45, 450, 120);

  noStroke();
  fill(255, 0, 80);
  textSize(72);
  textStyle(BOLD);
  text("遊戲結束", width / 2, height / 2 - 40);
  
  // 分數框
  fill(25, 25, 45, 200);
  stroke(0, 255, 255);
  strokeWeight(2);
  rect(width / 2, height / 2 + 45, 300, 60);

  noStroke();
  fill(0, 255, 255);
  textSize(40);
  text(`最終得分: ${score}`, width / 2, height / 2 + 45);

  fill(255);
  textSize(24);
  push();
  fill(255, 255, 0);
  let debugText = hands.length > 0 ? (countFingers() === 0 ? "已握拳" : "請握拳") : "未偵測到手";
  text("狀態: " + debugText, width / 2, height / 2 + 140);
  pop();
  text("請握拳以再次遊玩", width / 2, height / 2 + 110);

  // 握拳進度條顯示
  if (lastGesture === 0 && hands.length > 0 && countFingers() === 0) {
    let progress = map(millis() - gestureTimer, 0, 1000, 0, 300);
    push();
    noStroke();
    fill(57, 255, 20, 150);
    rectMode(CORNER);
    rect(width/2 - 150, height/2 + 125, min(progress, 300), 10);
    pop();
  }
}

function resetGame() {
  score = 0;
  timeLeft = 60;
  previewTimer = 3;
  generateQuestion(true);
  gameState = 'PREVIEW';
  lastCheckTime = millis();
}

function drawShape(type, col, x, y, size) {
  push();
  rectMode(CENTER);

  fill(col);
  stroke(255);
  strokeWeight(2);
  if (type === 'circle') ellipse(x, y, size, size);
  else if (type === 'square') {
    rect(x, y, size, size);
  }
  else if (type === 'triangle') {
    let h = size * (sqrt(3)/2);
    triangle(x, y - h/2, x - size/2, y + h/2, x + size/2, y + h/2);
  }
  pop();
}

function countFingers() {
  if (hands.length === 0) return -1; // 無偵測到手
  let hand = hands[0];
  if (!hand.keypoints) return -1;

  let count = 0;
  // 8:食指尖, 12:中指尖, 16:無名指尖, 20:小指尖
  const fingerTips = [8, 12, 16, 20]; 
  // 使用 5, 9, 13, 17 (指根大關節) 作為判定基準會比 6, 10, 14, 18 更穩定
  const fingerBases = [5, 9, 13, 17]; 

  for (let i = 0; i < fingerTips.length; i++) {
    // y 坐標越小代表在畫面上方，加上 -15 偏移量避免抖動誤判
    if (hand.keypoints[fingerTips[i]].y < hand.keypoints[fingerBases[i]].y - 15) count++;
  }
  // 拇指偵測邏輯可視需求加入，目前以四指判斷握拳已足夠穩定
  return count;
}

function keyPressed() {
  if (gameState === 'PLAY') {
    if (key === '1') checkAnswer('SAME');
    if (key === '2') checkAnswer('PART');
    if (key === '3') checkAnswer('DIFF');
  } else if (gameState === 'START' || gameState === 'END') {
    if (key === ' ') resetGame(); // 空白鍵也可以開始
  }
}

function handleGestureLogic() {
  if (!detectionReady) return;
  
  if (hands.length === 0) {
    lastGesture = -1;
    return;
  }
  if (gestureCooldown > millis()) return;
  
  let fingers = countFingers();
  let choices = ['SAME', 'PART', 'DIFF'];
  
  if (fingers >= 1 && fingers <= 3) {
    if (lastGesture === fingers) {
      if (millis() - gestureTimer > 500) { // 持續 0.5 秒則判定
        checkAnswer(choices[fingers - 1]);
        gestureCooldown = millis() + 1000; // 判定後冷卻 1 秒
        lastGesture = -1;
      }
    } else {
      lastGesture = fingers;
      gestureTimer = millis();
    }
  } else {
    lastGesture = -1;
  }
}

function handleStartGesture() {
  if (!detectionReady) return;
  
  let fingers = countFingers();
  if (fingers === 0) { // 握拳 (0根手指伸出)
    if (lastGesture === 0) {
      if (millis() - gestureTimer > 1000) { // 持續 1 秒
        resetGame();
        lastGesture = -1;
      }
    } else {
      lastGesture = 0;
      gestureTimer = millis();
    }
  } else {
    lastGesture = -1;
  }
}

function generateQuestion(firstTime = true) {
  target = firstTime ? { type: random(shapes), color: random(colors) } : comparison;
  
  let r = random();
  if (r < 0.3) {
    // 1. 完全相同 (SAME) - 30%
    comparison = { type: target.type, color: target.color };
  } else if (r < 0.6) {
    // 2. 部分相同 (PART: 只有形狀相同或只有顏色相同) - 30%
    if (random() < 0.5) {
      // 同形狀，不同顏色
      let otherColors = colors.filter(c => c !== target.color);
      comparison = { type: target.type, color: random(otherColors) };
    } else {
      // 同顏色，不同形狀
      let otherShapes = shapes.filter(s => s !== target.type);
      comparison = { type: random(otherShapes), color: target.color };
    }
  } else {
    // 3. 完全不同 (DIFF: 形狀與顏色皆不同) - 40%
    let otherShapes = shapes.filter(s => s !== target.type);
    let otherColors = colors.filter(c => c !== target.color);
    comparison = { 
      type: random(otherShapes), 
      color: random(otherColors) 
    };
  }
}

function handlePreviewTimer() {
  if (millis() - lastCheckTime > 1000) {
    previewTimer--;
    lastCheckTime = millis();
  }
  if (previewTimer <= 0) {
    gameState = 'PLAY';
    lastCheckTime = millis();
  }
}

function updateTimer() {
  if (millis() - lastCheckTime > 1000) {
    timeLeft--;
    lastCheckTime = millis();
  }
  if (timeLeft <= 0) gameState = 'END';
}

function checkAnswer(choice) {
  let correctId;
  if (target.type === comparison.type && target.color === comparison.color) {
    correctId = 'SAME';
  } else if (target.type === comparison.type || target.color === comparison.color) {
    correctId = 'PART';
  } else {
    correctId = 'DIFF';
  }

  if (choice === correctId) {
    score += 10;
    feedbackType = 'CORRECT';
  } else {
    score = max(0, score - 5);
    feedbackType = 'WRONG';
  }
  feedbackAlpha = 150; // 觸發閃爍
  generateQuestion(false);
}

function mousePressed() {
  if (gameState === 'START' || gameState === 'END') {
    resetGame();
    return;
  }

  if (gameState === 'PLAY') {
    // 恢復點擊判斷
    for (let btn of buttons) {
      if (mouseX > btn.x && mouseX < btn.x + btn.w && 
          mouseY > btn.y && mouseY < btn.y + btn.h) {
        let choice = btn.id;
        checkAnswer(choice);
        break;
      }
    }
  }
}