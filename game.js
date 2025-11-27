/* ===========================
   FIREBASE SETUP
   =========================== */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const HIGH_SCORE_KEY = "quantumFoxHighScore";
let db, auth, user;
let isFirebaseReady = false;
window.highScoreValue = 0;
window.qfoxUserId = "Anonymous";

/* Color schemes for floor & fog */
const colorSchemes = [
  // LEVEL 1 (Score 0-249): Dark Blue/Black
  { floor: new THREE.Color("#1f2937"), fog: new THREE.Color("#111827") }, // 0
  // LEVEL 2 (Score 250-499): Vibrant Red
  { floor: new THREE.Color("#A01010"), fog: new THREE.Color("#FF0000") }, // 1
  // LEVEL 3 (Score 500-749): Bright Green
  { floor: new THREE.Color("#008000"), fog: new THREE.Color("#00FF00") }, // 2
  // LEVEL 4 (Score 750-999): Electric Blue
  { floor: new THREE.Color("#1010A0"), fog: new THREE.Color("#00FFFF") }, // 3
  // LEVEL 5 (Score 1000-1249): Hot Pink/Magenta
  { floor: new THREE.Color("#A010A0"), fog: new THREE.Color("#FF00FF") }, // 4
  // LEVEL 6 (Score 1250+): Orange/Gold
  { floor: new THREE.Color("#B8860B"), fog: new THREE.Color("#FF8C00") }  // 5
];

// Reverse color schemes for the trail (opposite of floor progression)
const reverseColorSchemes = [...colorSchemes].slice().reverse();

const firebaseConfig = {
  apiKey: "AIzaSyBgfoQLeOOqbKBuM69SO88jhCpfwrz_koo",
  authDomain: "qfox-29287.firebaseapp.com",
  projectId: "qfox-29287",
  storageBucket: "qfox-29287.appspot.com",
  messagingSenderId: "778217166086",
  appId: "1:778217166086:web:1480312c499fdec6aafa87",
  measurementId: "G-VGEY7GV2QD"
};

async function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    await signInAnonymously(auth);

    onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        user = currentUser;
        window.qfoxUserId = user.uid.substring(0, 8);
        const uidEl = document.getElementById("user-id-display");
        if (uidEl) uidEl.textContent = window.qfoxUserId;
        isFirebaseReady = true;
        loadHighScore();
      } else {
        isFirebaseReady = false;
      }
    });
  } catch (error) {
    console.error("Firebase init error:", error);
  }
}

async function loadHighScore() {
  // Local
  try {
    const localScore = localStorage.getItem(HIGH_SCORE_KEY);
    if (localScore !== null) {
      window.highScoreValue = parseInt(localScore, 10) || 0;
      const hEl = document.getElementById("high-score-display");
      if (hEl) hEl.textContent = `High Score: ${window.highScoreValue}`;
    }
  } catch (e) {}

  // Firestore
  if (!isFirebaseReady || !user) return;

  try {
    const scoreDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(scoreDocRef);
    if (docSnap.exists()) {
      const firebaseScore = docSnap.data().highScore || 0;
      if (firebaseScore > window.highScoreValue) {
        window.highScoreValue = firebaseScore;
        const hEl = document.getElementById("high-score-display");
        if (hEl) hEl.textContent = `High Score: ${window.highScoreValue}`;
        try {
          localStorage.setItem(
            HIGH_SCORE_KEY,
            window.highScoreValue.toString()
          );
        } catch (e) {}
      }
    }
  } catch (error) {
    console.error("Load score error:", error);
  }
}

// Called by game logic when the run ends
window.handleGameOver = async function (finalScore) {
  if (finalScore > window.highScoreValue) {
    window.highScoreValue = finalScore;
    const hEl = document.getElementById("high-score-display");
    if (hEl) hEl.textContent = `High Score: ${window.highScoreValue}`;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, finalScore.toString());
    } catch (e) {}

    if (isFirebaseReady && user) {
      try {
        const scoreDocRef = doc(db, "users", user.uid);
        await setDoc(
          scoreDocRef,
          { highScore: finalScore, timestamp: serverTimestamp() },
          { merge: true }
        );
      } catch (e) {
        console.error("Save error:", e);
      }
    }
  }

  const form = document.getElementById("initials-form");
  if (form) form.style.display = "none";

  if (isFirebaseReady && user) {
    try {
      const leaderboardRef = collection(db, "leaderboard");
      const lowScoreQuery = query(
        leaderboardRef,
        orderBy("score", "desc"),
        limit(1000)
      );
      const querySnapshot = await getDocs(lowScoreQuery);

      let lowestTopScore = 0;
      if (!querySnapshot.empty) {
        const docs = querySnapshot.docs;
        lowestTopScore = docs[docs.length - 1].data().score || 0;
      }

      if (finalScore > lowestTopScore || querySnapshot.size < 1000) {
        showInitialsInput(finalScore);
      }
    } catch (error) {
      console.error("Leaderboard check failed:", error);
    }
  }
};

function showInitialsInput(score) {
  const form = document.getElementById("initials-form");
  const input = document.getElementById("initials-input");
  const btn = document.getElementById("submit-score-btn");

  if (!form || !input || !btn) return;

  form.style.display = "flex";
  input.value = "";
  try {
    input.focus();
  } catch (e) {}
  btn.textContent = "SUBMIT";
  btn.disabled = false;
  form.dataset.score = score;
}

// Submit initials (5 letters)
document
  .getElementById("submit-score-btn")
  .addEventListener("click", async () => {
    const form = document.getElementById("initials-form");
    const input = document.getElementById("initials-input");
    const btn = document.getElementById("submit-score-btn");
    if (!form || !input || !btn) return;

    // 5-letter initials, letters only
    let initials = input.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
    if (!initials) initials = "AAAAA";
    const score = parseInt(form.dataset.score || "0");

    btn.textContent = "SAVING...";
    btn.disabled = true;

    if (isFirebaseReady && user) {
      try {
        const leaderboardRef = collection(db, "leaderboard");
        await addDoc(leaderboardRef, {
          score: score,
          initials: initials,
          uid: user.uid,
          timestamp: serverTimestamp(),
        });

        btn.textContent = "SAVED!";
        setTimeout(() => {
          if (form) form.style.display = "none";
          window.showLeaderboard();
        }, 800);
      } catch (e) {
        console.error("Submit error:", e);
        btn.textContent = "ERROR";
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = "RETRY";
        }, 2000);
      }
    } else {
      // Offline fallback
      btn.textContent = "OFFLINE";
      setTimeout(() => {
        if (form) form.style.display = "none";
        window.showLeaderboard();
      }, 700);
    }
  });

document
  .getElementById("initials-input")
  .addEventListener("input", (e) => {
    // 5 letters max, uppercase only
    e.target.value = e.target.value
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 5);
  });

window.showLeaderboard = async function () {
  const screen = document.getElementById("leaderboard-screen");
  const list = document.getElementById("leaderboard-list");

  if (!screen || !list) return;

  screen.style.display = "flex";
  requestAnimationFrame(() => (screen.style.opacity = 1));

  list.innerHTML = '<div style="text-align:center; padding:20px;">Loading...</div>';

  if (!isFirebaseReady) {
    list.innerHTML = "Firebase not ready.";
    return;
  }

  try {
    const leaderboardRef = collection(db, "leaderboard");
    const q = query(leaderboardRef, orderBy("score", "desc"), limit(100));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      list.innerHTML = "Be the first to post a score!";
      return;
    }

    let html = "";
    snapshot.docs.forEach((docSnap, index) => {
      const data = docSnap.data();
      const rank = index + 1;
      const initials = data.initials || "???";
      const scoreVal = data.score || 0;
      const isMe =
        user && data.uid === user.uid
          ? "color:#fcd34d; font-weight:bold;"
          : "";

      html += `<div class="leaderboard-entry" style="${isMe}">
        <span class="rank">${rank}</span>
        <span class="initials">${initials}</span>
        <span class="score">${scoreVal.toLocaleString()}</span>
      </div>`;
    });

    list.innerHTML = html;
  } catch (error) {
    console.error("Leaderboard error:", error);
    list.innerHTML = `Error: ${error.message}`;
  }
};

initFirebase();

/* ===========================
   ASSET URLS
   =========================== */

const FOX_HEAD_URL = "assets/head.png";
const OBSTACLE_URL = "assets/orb.png";
const HALO_URL = "assets/halo.png";
const FLOOR_IMAGE_URL = "assets/floor.png";
const BACKGROUND_VIDEO_URL = "assets/background.mp4";
const MUSIC_URL = "assets/music.wav";

/* ===========================
   GLOBALS
   =========================== */

let bgm = null;

function initializeMusic() {
  bgm = new Audio(MUSIC_URL);
  bgm.loop = true;
  bgm.volume = 0.7;
}

let scene, camera, renderer;
let foxPlayer = null;
let floorTexture = null;
let floorMesh = null;
let score = 0;
let gameActive = false;
let lanePositions = [-3.5, 0, 3.5];
let currentLane = 1;
let obstacles = [];
let obstacleSpawnTimer = 0;
let gameSpeed = 0.25;
const BASE_GAME_SPEED = 0.25;
const SPEED_INCREASE_RATE = 0.0006;
let runningTime = 0;
const FOX_BASE_HEIGHT = 1.2;
let lastTime = performance.now();
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;
let firstRun = true; // only first run can be started with any key/tap

const container = document.getElementById("game-container");
const scoreDisplay = document.getElementById("score-display");
const gameOverScreen = document.getElementById("game-over-screen");
const finalScoreEl = document.getElementById("final-score");
const textureLoader = new THREE.TextureLoader();

/* ===========================
   VIDEO BACKGROUND
   =========================== */

function setupVideoBackground() {
  if (!scene) return;
  try {
    const vid = document.createElement("video");
    vid.src = BACKGROUND_VIDEO_URL;
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.play().catch(() => {});

    const vtex = new THREE.VideoTexture(vid);
    vtex.minFilter = THREE.LinearFilter;
    vtex.magFilter = THREE.LinearFilter;
    scene.background = vtex;
  } catch (e) {
    console.warn("Video background failed:", e);
  }
}

/* ===========================
   FOX / FLOOR / OBSTACLES
   =========================== */

function createFox() {
  const geo = new THREE.PlaneGeometry(1.8, 1.8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true });
  foxPlayer = new THREE.Mesh(geo, mat);

  textureLoader.load(FOX_HEAD_URL, (tex) => {
    tex.encoding = THREE.sRGBEncoding;
    foxPlayer.material = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.FrontSide
    });
    foxPlayer.material.needsUpdate = true;
  });

  foxPlayer.position.set(lanePositions[currentLane], FOX_BASE_HEIGHT, 5);
  foxPlayer.renderOrder = 2; // drawn over trail
  scene.add(foxPlayer);
}

function createTrack() {
  const trackWidth = 18;
  const trackLength = 600;
  const floorGeo = new THREE.PlaneGeometry(trackWidth, trackLength, 1, 1);

  const tex = textureLoader.load(FLOOR_IMAGE_URL, (t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 60);
    t.encoding = THREE.sRGBEncoding;
  });

  const floorMat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.DoubleSide
  });

  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, 0, 0);
  scene.add(floorMesh);
  floorTexture = tex;
}

function createObstacle(laneIndex) {
  if (!scene) return;

  const laneX = lanePositions[laneIndex];
  const startZ = -120;
  const size = 2.6;
  const haloSize = 3.0;
  const orbWidthRatio = 1.5; // wider orb based on image ratio

  // Halo
  const haloGeo = new THREE.PlaneGeometry(haloSize, haloSize);
  const haloMat = new THREE.MeshBasicMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.7
  });

  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.set(laneX, 1.35, startZ - 0.2);
  halo.userData.billboard = true;

  textureLoader.load(
    HALO_URL,
    (tex) => {
      tex.encoding = THREE.sRGBEncoding;
      halo.material.map = tex;
      halo.material.needsUpdate = true;
    },
    undefined,
    (err) => {
      console.warn("Halo texture failed to load:", err);
    }
  );

  halo.renderOrder = 1;
  scene.add(halo);

  // Orb
  const orbGeo = new THREE.PlaneGeometry(size * orbWidthRatio, size);
  const orbMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    side: THREE.DoubleSide
  });

  const orb = new THREE.Mesh(orbGeo, orbMat);
  orb.position.set(laneX, 1.35, startZ - 0.2);
  orb.userData.lane = laneIndex;
  orb.userData.billboard = true;
  orb.userData.halo = halo;

  textureLoader.load(
    OBSTACLE_URL,
    (tex) => {
      tex.encoding = THREE.sRGBEncoding;
      orb.material.map = tex;
      tex.minFilter = THREE.LinearMipMapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      orb.material.needsUpdate = true;
    },
    undefined,
    (err) => {
      console.warn("Orb texture failed to load:", err);
    }
  );

  orb.renderOrder = 2;
  obstacles.push(orb);
  scene.add(orb);
}

/* ===========================
   RIBBON TRAIL IMPLEMENTATION
   =========================== */

// These are tuned so the trail is behind the fox, not too wide, and smooth.
const TRAIL_SEGMENTS = 40;      // how many points (more = smoother)
const TRAIL_BASE_WIDTH = 0.9;   // narrower max width at the fox (was 1.6)
const TRAIL_MIN_WIDTH = 0.05;   // narrower tail width (was 0.12)
const TRAIL_SMOOTH = 0.28;      // smoothing factor for internal bending
const TRAIL_Z_OFFSET = 1.2;     // base offset behind fox along +Z
const TRAIL_Y_OFFSET = 0.4;     // lift ribbon slightly above the floor
const TRAIL_LENGTH = 18.0;      // how far the tail stretches behind the fox

let trailInitialized = false;
let trailPoints = [];
let trailGeometry = null;
let trailMesh = null;

function initRibbonTrail() {
  if (trailInitialized || !foxPlayer || !scene) return;
  trailInitialized = true;

  trailPoints = [];
  const startPos = foxPlayer.position.clone();
  startPos.y += TRAIL_Y_OFFSET;

  // Initialize trail to fox position so it doesn't explode on first frame
  for (let i = 0; i < TRAIL_SEGMENTS; i++) {
    trailPoints.push(startPos.clone());
  }

  const positionArray = new Float32Array(TRAIL_SEGMENTS * 2 * 3);
  const colorArray = new Float32Array(TRAIL_SEGMENTS * 2 * 3);

  trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
  trailGeometry.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));

  const indices = [];
  for (let i = 0; i < TRAIL_SEGMENTS - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  trailGeometry.setIndex(indices);
  trailGeometry.computeBoundingSphere();

  const trailMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  trailMesh = new THREE.Mesh(trailGeometry, trailMaterial);
  trailMesh.renderOrder = 0; // behind fox & orbs
  scene.add(trailMesh);
}

function updateRibbonTrail(deltaMultiplier) {
  if (!trailInitialized || !trailGeometry || !trailMesh || !foxPlayer) return;

  // Head of trail = fox position (slightly up)
  const headPos = foxPlayer.position.clone();
  headPos.y += TRAIL_Y_OFFSET;

  // Insert new head position at front
  trailPoints.unshift(headPos);
  if (trailPoints.length > TRAIL_SEGMENTS) {
    trailPoints.pop();
  }

  // Smooth internal points so the ribbon "lags" & bends when changing lanes
  for (let i = 1; i < trailPoints.length; i++) {
    trailPoints[i].lerp(trailPoints[i - 1], TRAIL_SMOOTH);
  }

  const positions = trailGeometry.attributes.position.array;
  const colors = trailGeometry.attributes.color.array;

  // Determine trail color based on reversed color schemes and score
  const numColors = reverseColorSchemes.length;
  const phase = (score / 250) % numColors;
  const baseIndex = Math.floor(phase) % numColors;
  const nextIndex = (baseIndex + 1) % numColors;
  const t = phase - Math.floor(phase);

  // This is the "head" color: a blend of two opposite-floor colors
  const colA = reverseColorSchemes[baseIndex].floor;
  const colB = reverseColorSchemes[nextIndex].floor;
  const headColor = colA.clone().lerp(colB, t);

  // We use lane direction and curve direction to compute sideways vector
  const laneDir = new THREE.Vector3(0, 0, 1);
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < TRAIL_SEGMENTS - 1; i++) {
    const tSeg = i / (TRAIL_SEGMENTS - 1); // 0 at head, 1 at tail

    const pCurr = trailPoints[i];
    const pNext = trailPoints[i + 1] || pCurr;

    // Direction along the trail
    const dir = new THREE.Vector3().subVectors(pNext, pCurr);
    let side = new THREE.Vector3().crossVectors(laneDir, dir);
    if (side.lengthSq() < 1e-6) {
      side.set(1, 0, 0); // fallback if fox is going perfectly straight
    } else {
      side.normalize();
    }

    // Taper width toward tail
    const width = THREE.MathUtils.lerp(TRAIL_BASE_WIDTH, TRAIL_MIN_WIDTH, tSeg);
    const halfWidth = width * 0.5;
    const offset = side.clone().multiplyScalar(halfWidth);

    const leftPos = pCurr.clone().add(offset);
    const rightPos = pCurr.clone().sub(offset);

    // Push ribbon BEHIND the fox along +Z, stretching farther for tail
    const stretch = TRAIL_LENGTH * tSeg;
    leftPos.z += (TRAIL_Z_OFFSET + stretch);
    rightPos.z += (TRAIL_Z_OFFSET + stretch);

    const vi = i * 2;

    positions[vi * 3 + 0] = leftPos.x;
    positions[vi * 3 + 1] = leftPos.y;
    positions[vi * 3 + 2] = leftPos.z;

    positions[(vi + 1) * 3 + 0] = rightPos.x;
    positions[(vi + 1) * 3 + 1] = rightPos.y;
    positions[(vi + 1) * 3 + 2] = rightPos.z;

    // Use the same headColor for the whole trail but fade to darker at tail.
    const fade = THREE.MathUtils.lerp(1.0, 0.1, tSeg);
    const r = headColor.r * fade;
    const g = headColor.g * fade;
    const b = headColor.b * fade;

    colors[vi * 3 + 0] = r;
    colors[vi * 3 + 1] = g;
    colors[vi * 3 + 2] = b;

    colors[(vi + 1) * 3 + 0] = r;
    colors[(vi + 1) * 3 + 1] = g;
    colors[(vi + 1) * 3 + 2] = b;
  }

  // Close last segment by copying previous one
  const lastIndex = (TRAIL_SEGMENTS - 1) * 2;
  const prevIndex = (TRAIL_SEGMENTS - 2) * 2;

  positions[lastIndex * 3 + 0] = positions[prevIndex * 3 + 0];
  positions[lastIndex * 3 + 1] = positions[prevIndex * 3 + 1];
  positions[lastIndex * 3 + 2] = positions[prevIndex * 3 + 2];

  positions[(lastIndex + 1) * 3 + 0] =
    positions[(prevIndex + 1) * 3 + 0];
  positions[(lastIndex + 1) * 3 + 1] =
    positions[(prevIndex + 1) * 3 + 1];
  positions[(lastIndex + 1) * 3 + 2] =
    positions[(prevIndex + 1) * 3 + 2];

  colors[lastIndex * 3 + 0] = colors[prevIndex * 3 + 0];
  colors[lastIndex * 3 + 1] = colors[prevIndex * 3 + 1];
  colors[lastIndex * 3 + 2] = colors[prevIndex * 3 + 2];

  colors[(lastIndex + 1) * 3 + 0] = colors[(prevIndex + 1) * 3 + 0];
  colors[(lastIndex + 1) * 3 + 1] = colors[(prevIndex + 1) * 3 + 1];
  colors[(lastIndex + 1) * 3 + 2] = colors[(prevIndex + 1) * 3 + 2];

  trailGeometry.attributes.position.needsUpdate = true;
  trailGeometry.attributes.color.needsUpdate = true;
  if (trailGeometry.boundingSphere) trailGeometry.boundingSphere = null;
  trailGeometry.computeBoundingSphere();
}

/* ===========================
   GAME CONTROL
   =========================== */

function startGame() {
  if (!scene || !renderer || !camera) {
    init();
  }

  if (bgm && bgm.paused) {
    bgm.play().catch((error) => {
      console.warn(
        "Audio playback failed (usually a mobile browser restriction):",
        error.message
      );
    });
  }

  gameActive = true;
  score = 0;
  gameSpeed = BASE_GAME_SPEED;
  currentLane = 1;

  if (foxPlayer) foxPlayer.position.x = lanePositions[currentLane];

  // Clear old obstacles
  obstacles.forEach((o) => {
    try {
      scene.remove(o);
      if (o.userData.halo) {
        scene.remove(o.userData.halo);
      }
    } catch (e) {}
  });
  obstacles = [];
  obstacleSpawnTimer = 0;

  const scoreEl = document.getElementById("score-display");
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;

  if (gameOverScreen) {
    gameOverScreen.style.display = "none";
    gameOverScreen.style.opacity = 0;
  }

  const lb = document.getElementById("leaderboard-screen");
  if (lb) lb.style.display = "none";

  const initialsForm = document.getElementById("initials-form");
  if (initialsForm) initialsForm.style.display = "none";
}

function moveFox(newLane) {
  // no starting the game from lane changes anymore
  if (!gameActive) return;
  if (!foxPlayer) return;
  if (newLane < 0 || newLane > 2) return;
  if (newLane === currentLane) return;

  currentLane = newLane;
  const targetX = lanePositions[currentLane];

  TWEEN.removeAll();
  new TWEEN.Tween(foxPlayer.position)
    .to({ x: targetX }, 150)
    .easing(TWEEN.Easing.Quadratic.Out)
    .start();
}

function updateObstacles(deltaMultiplier) {
  if (!foxPlayer) return;

  gameSpeed += SPEED_INCREASE_RATE * deltaMultiplier;

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.position.z += gameSpeed * deltaMultiplier;

    // Move halo with orb
    if (obs.userData.halo) {
      obs.userData.halo.position.x = obs.position.x;
      obs.userData.halo.position.z = obs.position.z - 0.2;
    }

    const foxZ = foxPlayer.position.z;
    const obsZ = obs.position.z;
    const collisionRange = 0.9;

    if (obsZ >= foxZ - collisionRange && obsZ <= foxZ + collisionRange) {
      if (obs.userData.lane === currentLane) {
        const foxX = foxPlayer.position.x;
        const obsX = obs.position.x;
        const lateralRange = 0.9;
        if (Math.abs(foxX - obsX) < lateralRange) {
          doGameOver();
          return;
        }
      }
    }

    if (obsZ > foxZ + 2 && !obs.userData.scored) {
      obs.userData.scored = true;
      score += 10;
      const scoreEl = document.getElementById("score-display");
      if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    }

    if (obsZ > 80) {
      try {
        scene.remove(obs);
        if (obs.userData.halo) {
          scene.remove(obs.userData.halo);
        }
      } catch (e) {}
      obstacles.splice(i, 1);
    }
  }

  obstacleSpawnTimer++;
  const spawnRate = Math.max(
    18,
    70 - Math.floor((gameSpeed - BASE_GAME_SPEED) * 140)
  );

  if (obstacleSpawnTimer >= spawnRate) {
    createObstacle(Math.floor(Math.random() * 3));
    obstacleSpawnTimer = 0;
  }
}

function doGameOver() {
  if (!gameActive) return;

  gameActive = false;
  if (bgm) bgm.pause();

  finalScoreEl.textContent = score;
  if (gameOverScreen) {
    gameOverScreen.style.display = "flex";
  }

  if (typeof window.handleGameOver === "function") {
    window.handleGameOver(score);
  }

  new TWEEN.Tween({ o: 0 })
    .to({ o: 1 }, 450)
    .onUpdate((obj) => {
      if (gameOverScreen) gameOverScreen.style.opacity = obj.o;
    })
    .start();

  // After this point, restart is ONLY allowed via the RESTART button.
}

/* ===========================
   INPUT HANDLING
   =========================== */

function onKeyDown(e) {
  const leaderboardScreen = document.getElementById("leaderboard-screen");
  if (leaderboardScreen && leaderboardScreen.style.display === "flex") {
    if (e.code === "Escape" || e.code === "KeyL") {
      leaderboardScreen.style.opacity = 0;
      setTimeout(() => (leaderboardScreen.style.display = "none"), 250);
    }
    return;
  }

  if (e.target && e.target.tagName === "INPUT") return;

  // First run: any key can start the game once
  if (!gameActive && firstRun) {
    firstRun = false;
    startGame();
    return;
  }

  // After first run, keys do NOT restart the game.
  if (!gameActive) return;

  // In-game controls
  if (e.code === "KeyA" || e.code === "ArrowLeft") moveFox(currentLane - 1);
  if (e.code === "KeyD" || e.code === "ArrowRight") moveFox(currentLane + 1);
}

function onTouchEnd(e) {
  if (!e.changedTouches || e.changedTouches.length === 0) return;

  const touchX = e.changedTouches[0].clientX;
  const screenWidth = window.innerWidth;

  // First run: a tap can start the game once
  if (!gameActive && firstRun) {
    firstRun = false;
    startGame();
    return;
  }

  // After that, touches don’t restart; they only move while active
  if (!gameActive) return;

  if (touchX < screenWidth / 2) {
    moveFox(currentLane - 1);
  } else {
    moveFox(currentLane + 1);
  }
}

/* ===========================
   INIT + ANIMATE
   =========================== */

let hasInited = false;

function init() {
  if (hasInited) return;
  hasInited = true;

  scene = new THREE.Scene();
  const initialFogColor = colorSchemes[0].fog;
  scene.fog = new THREE.Fog(initialFogColor, 40, 150);

  setupVideoBackground();

  camera = new THREE.PerspectiveCamera(
    72,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 3.5, 10);
  camera.lookAt(0, 1, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 20));
  const spot = new THREE.SpotLight(0xffffff, 20, 50, Math.PI / 6, 0.3);
  spot.position.set(0, 10, 10);
  scene.add(spot);

  createFox();
  createTrack();

  // Initialize ribbon trail shortly after fox exists
  setTimeout(() => {
    if (!trailInitialized) initRibbonTrail();
  }, 50);

  window.addEventListener("keydown", onKeyDown, false);
  window.addEventListener("resize", onWindowResize, false);
  document.addEventListener("touchend", onTouchEnd, { passive: true });

  const restartBtn = document.getElementById("restart-btn");
  if (restartBtn) {
    restartBtn.addEventListener("click", () => {
      // Restart is ONLY allowed by this button
      startGame();
    });
  }

  const leaderboardBtn = document.getElementById("leaderboard-btn");
  if (leaderboardBtn) {
    leaderboardBtn.addEventListener("click", () => window.showLeaderboard());
  }

  const closeLb = document.getElementById("close-leaderboard");
  if (closeLb) {
    closeLb.addEventListener("click", () => {
      const lb = document.getElementById("leaderboard-screen");
      if (lb) {
        lb.style.opacity = 0;
        setTimeout(() => (lb.style.display = "none"), 300);
      }
    });
  }
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateFloorAndBackground() {
  const numColors = colorSchemes.length;
  let levelIndex = Math.floor(score / 250) % numColors;
  const nextIndex = (levelIndex + 1) % numColors;
  const t = (score % 250) / 250;

  const currentFloorColor = colorSchemes[levelIndex].floor;
  const nextFloorColor = colorSchemes[nextIndex].floor;
  const interpolatedFloorColor = currentFloorColor.clone().lerp(nextFloorColor, t);

  if (floorMesh && floorMesh.material) {
    floorMesh.material.color = interpolatedFloorColor;
    floorMesh.material.needsUpdate = true;
  }

  const currentFogColor = colorSchemes[levelIndex].fog;
  const nextFogColor = colorSchemes[nextIndex].fog;
  const interpolatedFogColor = currentFogColor.clone().lerp(nextFogColor, t);

  if (scene.fog) {
    scene.fog.color = interpolatedFogColor;
  }
}

function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now();
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;
  const deltaMultiplier = deltaTime / FRAME_TIME;

  TWEEN.update();

  if (gameActive) {
    updateObstacles(deltaMultiplier);
    runningTime += 0.11 * deltaMultiplier;

    if (foxPlayer) {
      foxPlayer.position.y =
        FOX_BASE_HEIGHT + Math.sin(runningTime * 5) * 0.1;
    }

    if (floorTexture) {
      floorTexture.offset.y += gameSpeed * 0.02 * deltaMultiplier;
    }

    updateFloorAndBackground();
    updateRibbonTrail(deltaMultiplier);

    if (camera) {
      for (let obs of obstacles) {
        if (obs.userData && obs.userData.billboard && obs.lookAt) {
          obs.lookAt(camera.position);
        }
        if (obs.userData && obs.userData.halo && obs.userData.halo.lookAt) {
          obs.userData.halo.lookAt(camera.position);
        }
      }
    }
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/* ===========================
   BOOTSTRAP
   =========================== */

window.addEventListener("load", () => {
  initializeMusic();
  init();
  animate();
});

