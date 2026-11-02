// Kinora Form Coach – exercise definitions.
//
// Each exercise says which joint angle drives a repetition ("driver"), the
// thresholds that start and finish a rep, and the checks run on every rep
// (repChecks) or every frame (live). Checks only run in the camera views
// where they can be measured reliably ("views": front | side | angled).
//
// All angles are in degrees. 180° = joint straight. Metric names come from
// computeMetrics() in engine.js.

const avg = (a, b) => (a + b) / 2;

export const EXERCISES = {
  squat: {
    name: 'Squat', icon: 'squat', type: 'reps', dir: 'down',
    blurb: 'Bodyweight, goblet or barbell squat.',
    setup: 'Side view: depth, back angle and heels. Front view: knee alignment and balance.',
    driver: (m) => (m.view === 'front' ? avg(m.kneeL, m.kneeR) : m.knee),
    start: 155, end: 163, minTravel: 15,
    repChecks: [
      { f: 'shallow_squat', t: (r) => r.ext > 112 },
      { f: 'knee_valgus', views: ['front'], t: (r) => r.max.kneeIn > 0.07 || (r.bottom.valgusOk && r.bottom.valgus < 0.8) },
      { f: 'forward_lean', views: ['side', 'angled'], t: (r) => r.max.trunkLean > 55 },
      { f: 'heel_lift', views: ['side'], t: (r) => r.max.heelRise - r.start.heelRise > 0.05 },
      { f: 'asymmetry', views: ['front'], t: (r) => r.bottom.kneeSym > 18 || Math.abs(r.bottom.shift) > 0.25 },
      { f: 'fast_tempo', t: (r) => r.ecc < 0.45 },
    ],
    live: [
      { f: 'knee_valgus', views: ['front'], t: (m, ph) => ph === 'down' && m.kneeIn > 0.08 },
      { f: 'forward_lean', views: ['side', 'angled'], t: (m, ph) => ph === 'down' && m.trunkLean > 58 },
      { f: 'heel_lift', views: ['side'], t: (m, ph, s) => ph === 'down' && s.rep && m.heelRise - s.rep.start.heelRise > 0.06 },
    ],
    metrics: [
      { label: 'Knee flexion at bottom', get: (r) => 180 - r.ext, target: [80, 140], plane: 'Sagittal' },
      { label: 'Hip flexion at bottom', get: (r) => 180 - r.bottom.hip, target: [70, 140], plane: 'Sagittal' },
      { label: 'Maximum trunk lean', get: (r) => r.max.trunkLean, target: [0, 50], plane: 'Sagittal', views: ['side', 'angled'] },
      { label: 'Knee drift inwards (% leg length)', get: (r) => r.max.kneeIn * 100, target: [-100, 6], unit: '%', plane: 'Frontal', views: ['front'] },
      { label: 'Left / right knee difference', get: (r) => r.bottom.kneeSym, target: [0, 12], plane: 'Frontal', views: ['front'] },
    ],
    anatomy: {
      prime: 'Quadriceps (rectus femoris, vastus lateralis, medialis, intermedius), gluteus maximus, adductor magnus',
      stab: 'Transversus abdominis, obliques, erector spinae, gluteus medius, soleus and gastrocnemius',
      joints: 'Hip and knee flexion-extension and ankle dorsiflexion in the sagittal plane; knee tracking over the 2nd toe in the frontal plane',
    },
  },

  lunge: {
    name: 'Lunge / split squat', icon: 'lunge', type: 'reps', dir: 'down',
    blurb: 'Static split squat, forward or reverse lunge.',
    setup: 'Side view: depth and torso. Front view: front-knee alignment.',
    driver: (m) => Math.min(m.kneeL, m.kneeR),
    start: 150, end: 160, minTravel: 15,
    repChecks: [
      { f: 'lunge_depth', t: (r) => r.ext > 112 },
      { f: 'lunge_lean', views: ['side', 'angled'], t: (r) => r.max.trunkLean > 25 },
      { f: 'knee_valgus', views: ['front'], t: (r) => r.max.frontKneeIn > 0.08 },
      { f: 'fast_tempo', t: (r) => r.ecc < 0.45 },
    ],
    live: [
      { f: 'lunge_lean', views: ['side', 'angled'], t: (m, ph) => ph === 'down' && m.trunkLean > 28 },
      { f: 'knee_valgus', views: ['front'], t: (m, ph) => ph === 'down' && m.frontKneeIn > 0.09 },
    ],
    metrics: [
      { label: 'Front-knee flexion at bottom', get: (r) => 180 - r.ext, target: [75, 110], plane: 'Sagittal' },
      { label: 'Maximum trunk lean', get: (r) => r.max.trunkLean, target: [0, 20], plane: 'Sagittal', views: ['side', 'angled'] },
      { label: 'Front knee drift inwards (% leg length)', get: (r) => r.max.frontKneeIn * 100, target: [-100, 7], unit: '%', plane: 'Frontal', views: ['front'] },
    ],
    anatomy: {
      prime: 'Quadriceps and gluteus maximus of the front leg',
      stab: 'Gluteus medius, adductors, core, hip flexors of the back leg (iliopsoas, rectus femoris) under stretch',
      joints: 'Hip and knee flexion in the sagittal plane; single-leg stability in the frontal plane',
    },
  },

  pushup: {
    name: 'Push-up', icon: 'pushup', type: 'reps', dir: 'down',
    blurb: 'Full push-up from the toes.',
    setup: 'Side view only, whole body visible, camera at floor or knee height.',
    gate: (m) => m.horizontal,
    driver: (m) => (m.view === 'front' ? avg(m.elbowL, m.elbowR) : m.elbow),
    start: 150, end: 157, minTravel: 20,
    line: 'ankle',
    repChecks: [
      { f: 'pushup_shallow', t: (r) => r.ext > 100 },
      { f: 'hip_sag', views: ['side', 'angled'], t: (r) => r.max.sag > 15 },
      { f: 'hip_pike', views: ['side', 'angled'], t: (r) => r.max.pike > 20 },
      { f: 'head_drop', views: ['side', 'angled'], t: (r) => r.min.neck < 145 },
      { f: 'pushup_lockout', t: (r) => r.prevTop < 158 },
      { f: 'fast_tempo', t: (r) => r.ecc < 0.4 },
    ],
    live: [
      { f: 'hip_sag', views: ['side', 'angled'], t: (m) => m.sag > 16 },
      { f: 'hip_pike', views: ['side', 'angled'], t: (m) => m.pike > 22 },
      { f: 'head_drop', views: ['side', 'angled'], t: (m) => m.neck < 140 },
    ],
    metrics: [
      { label: 'Elbow flexion at bottom', get: (r) => 180 - r.ext, target: [80, 130], plane: 'Sagittal' },
      { label: 'Hip sag (max, ° off the line)', get: (r) => r.max.sag, target: [0, 12], plane: 'Sagittal', views: ['side', 'angled'] },
      { label: 'Hip pike (max, ° off the line)', get: (r) => r.max.pike, target: [0, 15], plane: 'Sagittal', views: ['side', 'angled'] },
      { label: 'Neck alignment (ear-shoulder-hip)', get: (r) => r.min.neck, target: [150, 180], plane: 'Sagittal', views: ['side', 'angled'] },
    ],
    anatomy: {
      prime: 'Pectoralis major, anterior deltoid, triceps brachii',
      stab: 'Serratus anterior, rectus abdominis, transversus abdominis, obliques, gluteus maximus, quadriceps',
      joints: 'Shoulder horizontal flexion and elbow extension; the whole spine held neutral as a plank',
    },
  },

  kneepushup: {
    name: 'Knee push-up', icon: 'pushup', type: 'reps', dir: 'down',
    blurb: 'Push-up from the knees, a great progression.',
    setup: 'Side view only, whole body visible, camera at floor or knee height.',
    gate: (m) => m.horizontalKnee,
    driver: (m) => (m.view === 'front' ? avg(m.elbowL, m.elbowR) : m.elbow),
    start: 150, end: 157, minTravel: 20,
    line: 'knee',
    repChecks: [
      { f: 'pushup_shallow', t: (r) => r.ext > 100 },
      { f: 'hip_sag', views: ['side', 'angled'], t: (r) => r.max.sagK > 15 },
      { f: 'hip_pike', views: ['side', 'angled'], t: (r) => r.max.pikeK > 25 },
      { f: 'head_drop', views: ['side', 'angled'], t: (r) => r.min.neck < 145 },
      { f: 'pushup_lockout', t: (r) => r.prevTop < 158 },
    ],
    live: [
      { f: 'hip_sag', views: ['side', 'angled'], t: (m) => m.sagK > 16 },
      { f: 'hip_pike', views: ['side', 'angled'], t: (m) => m.pikeK > 28 },
      { f: 'head_drop', views: ['side', 'angled'], t: (m) => m.neck < 140 },
    ],
    metrics: [
      { label: 'Elbow flexion at bottom', get: (r) => 180 - r.ext, target: [80, 130], plane: 'Sagittal' },
      { label: 'Hip sag (max, ° off the line)', get: (r) => r.max.sagK, target: [0, 12], plane: 'Sagittal', views: ['side', 'angled'] },
      { label: 'Neck alignment (ear-shoulder-hip)', get: (r) => r.min.neck, target: [150, 180], plane: 'Sagittal', views: ['side', 'angled'] },
    ],
    anatomy: {
      prime: 'Pectoralis major, anterior deltoid, triceps brachii',
      stab: 'Serratus anterior, abdominal wall, gluteus maximus',
      joints: 'Shoulder horizontal flexion and elbow extension; spine neutral from shoulders to knees',
    },
  },

  plank: {
    name: 'Plank', icon: 'plank', type: 'hold',
    blurb: 'Forearm or high plank hold.',
    setup: 'Side view only, whole body visible, camera at floor height.',
    gate: (m) => m.horizontal,
    live: [
      { f: 'hip_sag', views: ['side', 'angled'], t: (m) => m.sag > 12 },
      { f: 'hip_pike', views: ['side', 'angled'], t: (m) => m.pike > 18 },
      { f: 'head_drop', views: ['side', 'angled'], t: (m) => m.neck < 145 },
    ],
    metrics: [
      { label: 'Average body-line deviation', key: 'lineDev', target: [0, 10], plane: 'Sagittal' },
      { label: 'Average neck alignment', key: 'neck', target: [150, 180], plane: 'Sagittal' },
    ],
    anatomy: {
      prime: 'Transversus abdominis, rectus abdominis, internal and external obliques (isometric)',
      stab: 'Serratus anterior, deltoids, gluteus maximus, quadriceps, erector spinae',
      joints: 'Anti-extension of the lumbar spine; shoulder girdle stability',
    },
  },

  bridge: {
    name: 'Glute bridge', icon: 'bridge', type: 'reps', dir: 'up',
    blurb: 'Lying glute bridge or hip thrust.',
    setup: 'Side view, lying down, camera at floor height.',
    driver: (m) => m.hip,
    start: 140, end: 132, minTravel: 12,
    repChecks: [
      { f: 'bridge_low', t: (r) => r.ext < 163 },
      { f: 'fast_tempo', t: (r) => r.ecc < 0.4 },
    ],
    live: [],
    metrics: [
      { label: 'Hip extension at the top', get: (r) => r.ext, target: [165, 190], plane: 'Sagittal' },
      { label: 'Knee angle at the top', get: (r) => r.bottom.knee, target: [75, 110], plane: 'Sagittal' },
    ],
    anatomy: {
      prime: 'Gluteus maximus, hamstrings',
      stab: 'Gluteus medius, core, adductors',
      joints: 'Hip extension in the sagittal plane with a neutral lumbar spine',
    },
  },

  hinge: {
    name: 'Hip hinge / deadlift', icon: 'hinge', type: 'reps', dir: 'down',
    blurb: 'Romanian deadlift, good morning or kettlebell hinge.',
    setup: 'Side view only, whole body visible.',
    driver: (m) => m.hip,
    start: 160, end: 167, minTravel: 20,
    repChecks: [
      { f: 'hinge_knee_bend', t: (r) => r.min.knee < 125 },
      { f: 'hinge_shallow', t: (r) => r.ext > 115 },
      { f: 'head_drop', views: ['side', 'angled'], t: (r) => r.min.neck < 140 },
      { f: 'fast_tempo', t: (r) => r.ecc < 0.5 },
    ],
    live: [
      { f: 'hinge_knee_bend', t: (m, ph) => ph === 'down' && m.knee < 120 },
    ],
    metrics: [
      { label: 'Hip flexion at bottom', get: (r) => 180 - r.ext, target: [65, 120], plane: 'Sagittal' },
      { label: 'Smallest knee angle', get: (r) => r.min.knee, target: [130, 180], plane: 'Sagittal' },
      { label: 'Neck alignment', get: (r) => r.min.neck, target: [145, 180], plane: 'Sagittal', views: ['side', 'angled'] },
    ],
    anatomy: {
      prime: 'Hamstrings (biceps femoris, semitendinosus, semimembranosus), gluteus maximus',
      stab: 'Erector spinae (isometric), latissimus dorsi, core, forearm grip muscles',
      joints: 'Hip flexion-extension with a neutral spine and slightly bent knees',
    },
  },

  press: {
    name: 'Overhead press', icon: 'press', type: 'reps', dir: 'up',
    blurb: 'Dumbbell or bodyweight overhead press / arm raise.',
    setup: 'Front view for symmetry, side view for lower-back arching.',
    driver: (m) => (m.view === 'front' ? avg(m.shoulderL, m.shoulderR) : m.shoulder),
    start: 120, end: 105, minTravel: 25,
    repChecks: [
      { f: 'press_lockout', t: (r) => Math.min(r.bottom.elbowL, r.bottom.elbowR) < 155 },
      { f: 'press_overhead', t: (r) => r.ext < 155 },
      { f: 'press_backbend', views: ['side', 'angled'], t: (r) => r.min.trunkLeanSigned < -12 },
      { f: 'press_asym', views: ['front'], t: (r) => r.bottom.elbowSym > 18 || r.bottom.shoulderSym > 15 },
    ],
    live: [
      { f: 'press_backbend', views: ['side', 'angled'], t: (m, ph) => ph === 'down' && m.trunkLeanSigned < -14 },
    ],
    metrics: [
      { label: 'Shoulder flexion at the top', get: (r) => r.ext, target: [160, 190], plane: 'Sagittal' },
      { label: 'Elbow extension at the top', get: (r) => Math.min(r.bottom.elbowL, r.bottom.elbowR), target: [160, 190], plane: 'Sagittal' },
      { label: 'Backward lean (lower-back arch)', get: (r) => -Math.min(0, r.min.trunkLeanSigned), target: [0, 10], plane: 'Sagittal', views: ['side', 'angled'] },
      { label: 'Left / right elbow difference', get: (r) => r.bottom.elbowSym, target: [0, 12], plane: 'Frontal', views: ['front'] },
    ],
    anatomy: {
      prime: 'Anterior and lateral deltoid, triceps brachii, upper trapezius',
      stab: 'Serratus anterior, rotator cuff, lower trapezius, core and glutes',
      joints: 'Shoulder flexion with scapular upward rotation; elbow extension; thoracic extension',
    },
  },

  posture: {
    name: 'Posture check', icon: 'posture', type: 'posture',
    blurb: 'Standing posture, front or side. Perfect with a photo.',
    setup: 'Stand relaxed, arms by your sides. Take one front photo and one side photo.',
    checks: [
      { f: 'shoulder_tilt', views: ['front'], t: (m) => m.shoulderTilt > 3.5 },
      { f: 'hip_tilt', views: ['front'], t: (m) => m.hipTilt > 3.5 },
      { f: 'lateral_shift', views: ['front'], t: (m) => Math.abs(m.shift) > 0.15 },
      { f: 'forward_head', views: ['side', 'angled'], t: (m) => m.headFwd > 18 },
      { f: 'sway_back', views: ['side', 'angled'], t: (m) => m.trunkLeanSigned < -6 },
    ],
    live: [],
    metrics: [
      { label: 'Shoulder tilt', key: 'shoulderTilt', target: [0, 3.5], plane: 'Frontal', views: ['front'], fmt: 1 },
      { label: 'Pelvis tilt', key: 'hipTilt', target: [0, 3.5], plane: 'Frontal', views: ['front'], fmt: 1 },
      { label: 'Side shift (% hip width)', key: 'shiftPct', target: [-15, 15], unit: '%', plane: 'Frontal', views: ['front'] },
      { label: 'Head forward angle', key: 'headFwd', target: [-10, 18], plane: 'Sagittal', views: ['side', 'angled'] },
      { label: 'Trunk lean (+ forward / − back)', key: 'trunkLeanSigned', target: [-6, 8], plane: 'Sagittal', views: ['side', 'angled'], fmt: 1 },
    ],
    anatomy: {
      prime: 'Postural muscles: deep neck flexors, lower trapezius, erector spinae, gluteus medius',
      stab: 'Core, hip abductors, foot arches',
      joints: 'Head over shoulders over hips over ankles (side); level shoulders and pelvis (front)',
    },
  },
};

export const EXERCISE_ORDER = ['squat', 'lunge', 'hinge', 'bridge', 'pushup', 'kneepushup', 'plank', 'press', 'posture'];
