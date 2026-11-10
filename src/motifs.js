/*
 * 母题。Small paintings ready to be written beside a scroll, each a list of strokes on the 100 × 100 ink box (x right,
 * y down). They are data in the same stroke format a script may write by hand, so each is also a worked example.
 * Composed for the lower right of a sheet: weight low and to the right, the upper left left empty.
 */
const leafKeys = [[0, 0.9], [0.3, 1], [0.7, 0.7], [1, 0.35]];

export const MOTIFS = {
  orchid: {
    name: '兰',
    strokes: [
      { path: [[70, 94], [58, 68], [40, 46], [12, 36]], width: 5.4, press: 'leaf', ink: 0.92, wet: 0.45, dry: 0.5, tint: 0.4, pace: 1.1, liberty: 'leaf' },
      { path: [[71, 94], [73, 70], [81, 48], [94, 34]], width: 4.4, press: 'leaf', ink: 0.88, wet: 0.45, dry: 0.45, pace: 1, pause: 220, liberty: 'leaf' },
      { path: [[69, 94], [56, 76], [50, 54], [55, 26]], width: 4, press: 'leaf', ink: 0.8, wet: 0.4, dry: 0.6, pace: 1, pause: 260, liberty: 'leaf' },
      { path: [[68, 95], [54, 86], [36, 85]], width: 3, press: 'fade', ink: 0.7, wet: 0.4, dry: 0.5, pace: 0.6, pause: 160, liberty: 'quick' },
      { path: [[72, 92], [77, 72], [75, 58]], width: 1.3, press: 'hair', ink: 0.55, wet: 0.4, dry: 0.3, pace: 0.7, pause: 320, liberty: 'calm' },
      { path: [[75, 58], [69, 52], [64, 45]], width: 4.4, press: 'press', ink: 0.32, wet: 1, dry: 0, pace: 0.6, pause: 200, liberty: 'still' },
      { path: [[75, 58], [80, 50], [87, 47]], width: 4.2, press: 'press', ink: 0.3, wet: 1, dry: 0, pace: 0.6, pause: 90, liberty: 'still' },
      { path: [[75, 57], [74, 48], [71, 41]], width: 3.6, press: 'press', ink: 0.28, wet: 1, dry: 0, pace: 0.6, pause: 90, liberty: 'still' },
      { path: [[73.6, 54.2], [74.6, 55.2]], width: 2.4, press: 'dot', ink: 1, wet: 0.85, dry: 0, pace: 0.5, pause: 260, liberty: 'still' },
    ],
  },
  bamboo: {
    name: '竹',
    strokes: [
      { path: [[82, 99], [80.5, 72]], width: 5.6, press: 'press', ink: 0.5, wet: 0.7, dry: 0.3, tint: -0.5, pace: 0.8, liberty: 'calm' },
      { path: [[80, 68], [78, 40]], width: 5.2, press: 'press', ink: 0.5, wet: 0.7, dry: 0.3, tint: -0.5, pace: 0.8, pause: 140, liberty: 'calm' },
      { path: [[77.6, 36], [75.5, 10]], width: 4.6, press: 'press', ink: 0.46, wet: 0.7, dry: 0.4, tint: -0.5, pace: 0.8, pause: 140, liberty: 'calm' },
      { path: [[76.5, 70], [84.5, 69.4]], width: 1.5, press: 'swell', ink: 1, wet: 0.6, dry: 0.1, pace: 0.5, pause: 200, liberty: 'still' },
      { path: [[74.5, 38], [82, 37.4]], width: 1.5, press: 'swell', ink: 1, wet: 0.6, dry: 0.1, pace: 0.5, pause: 80, liberty: 'still' },
      { path: [[76, 38], [60, 42], [40, 56]], width: 6, press: 'fade', ink: 0.96, wet: 0.5, dry: 0.4, pace: 0.55, pause: 320, liberty: 'leaf' },
      { path: [[76, 38], [62, 52], [52, 72]], width: 5.6, press: 'fade', ink: 0.92, wet: 0.5, dry: 0.4, pace: 0.55, pause: 120, liberty: 'leaf' },
      { path: [[76, 38], [60, 32], [44, 34]], width: 4.6, press: 'fade', ink: 0.84, wet: 0.5, dry: 0.5, pace: 0.5, pause: 120, liberty: 'leaf' },
      { path: [[80, 69], [90, 76], [97, 90]], width: 4.4, press: 'fade', ink: 0.6, wet: 0.55, dry: 0.4, pace: 0.5, pause: 260, liberty: 'leaf' },
    ],
  },
  mountain: {
    name: '远山',
    strokes: [
      { path: [[6, 66], [22, 50], [34, 56], [50, 34], [64, 50], [78, 44], [97, 58]], width: 9, press: 'ripple', ink: 0.26, wet: 1, dry: 0, pace: 1, liberty: 'calm' },
      { path: [[32, 82], [48, 68], [60, 74], [74, 60], [98, 72]], width: 6, press: 'ripple', ink: 0.58, wet: 0.6, dry: 0.5, tint: -0.5, pace: 0.9, pause: 300, liberty: 'free' },
      { path: [[20, 89], [24, 90.2], [29, 89.4]], width: 2.6, press: 'press', ink: 0.96, wet: 0.6, dry: 0.1, pace: 0.6, pause: 420, liberty: 'still' },
      { path: [[24.6, 88.6], [25.2, 83]], width: 1, press: 'hair', ink: 0.9, wet: 0.4, dry: 0.2, pace: 0.5, pause: 60, liberty: 'still' },
      { path: [[8, 95], [26, 94], [46, 95]], width: 1.2, press: 'hair', ink: 0.42, wet: 0.3, dry: 0.6, pace: 0.6, pause: 240, liberty: 'calm' },
      { path: [[40, 99], [58, 98], [72, 99]], width: 1.1, press: 'hair', ink: 0.34, wet: 0.3, dry: 0.6, pace: 0.6, pause: 120, liberty: 'calm' },
    ],
  },
  ripples: {
    name: '水',
    strokes: [
      { path: [[62, 30], [62.8, 33]], width: 3.4, press: 'dot', ink: 0.9, wet: 0.9, dry: 0, pace: 0.5, liberty: 'still' },
      { path: [[40, 56], [52, 52], [64, 51], [76, 53], [88, 57]], width: 2.6, press: 'swell', ink: 0.72, wet: 0.4, dry: 0.5, pace: 0.9, pause: 380, liberty: 'calm' },
      { path: [[26, 70], [44, 65], [64, 64], [84, 66], [98, 70]], width: 2.4, press: 'ripple', ink: 0.5, wet: 0.4, dry: 0.6, pace: 1, pause: 240, liberty: 'calm' },
      { path: [[14, 86], [38, 80], [66, 79], [92, 82]], width: 2, press: 'ripple', ink: 0.3, wet: 0.5, dry: 0.7, pace: 1.1, pause: 240, liberty: 'calm' },
    ],
  },
  moon: {
    name: '月',
    strokes: [
      { circle: { centre: [60, 38], radius: 21, gap: 150, gapAt: 160 }, width: 8, press: 'taper', ink: 0.9, wet: 0.45, dry: 0.45, pace: 1.1, liberty: 'calm' },
      { path: [[16, 62], [38, 56], [60, 61], [80, 56], [97, 59]], width: 6, press: 'ripple', ink: 0.2, wet: 1, dry: 0, pace: 1, pause: 360, liberty: 'free' },
      { path: [[36, 84], [56, 82], [80, 83], [94, 85]], width: 1.6, press: 'hair', ink: 0.5, wet: 0.3, dry: 0.6, pace: 0.8, pause: 300, liberty: 'calm' },
      { path: [[52, 93], [66, 92], [80, 93]], width: 1.2, press: 'hair', ink: 0.36, wet: 0.3, dry: 0.6, pace: 0.8, pause: 120, liberty: 'calm' },
    ],
  },
  plum: {
    name: '梅',
    strokes: [
      { path: [[100, 80], [82, 71], [63, 75], [45, 63], [30, 50]], width: 6.2, press: leafKeys, ink: 0.95, wet: 0.2, dry: 0.9, tint: 0.45, pace: 0.9, liberty: 'leaf' },
      { path: [[63, 75], [59, 55], [63, 35]], width: 2.8, press: 'fade', ink: 0.92, wet: 0.3, dry: 0.6, pace: 0.6, pause: 220, liberty: 'quick' },
      { path: [[45, 63], [35, 71], [22, 73]], width: 2.2, press: 'fade', ink: 0.9, wet: 0.3, dry: 0.5, pace: 0.5, pause: 140, liberty: 'quick' },
      { path: [[26.2, 42.5], [27.8, 43.5]], width: 7.36, press: 'dot', ink: 0.3, wet: 1, dry: 0, pace: 0.6, pause: 380, liberty: 'still' },
      { path: [[64.2, 27.5], [65.8, 28.5]], width: 6.44, press: 'dot', ink: 0.3, wet: 1, dry: 0, pace: 0.6, pause: 140, liberty: 'still' },
      { path: [[52.2, 50.5], [53.8, 51.5]], width: 5.98, press: 'dot', ink: 0.28, wet: 1, dry: 0, pace: 0.6, pause: 140, liberty: 'still' },
      { path: [[15.2, 69.5], [16.8, 70.5]], width: 4.83, press: 'dot', ink: 0.28, wet: 1, dry: 0, pace: 0.6, pause: 140, liberty: 'still' },
      { path: [[26.4, 42.4], [27.4, 43.4]], width: 1.3, press: 'dot', ink: 1, wet: 0.8, dry: 0, pace: 0.5, pause: 240, liberty: 'still' },
      { path: [[64.5, 27.5], [65.4, 28.4]], width: 1.2, press: 'dot', ink: 1, wet: 0.8, dry: 0, pace: 0.5, pause: 80, liberty: 'still' },
      { path: [[52.6, 50.6], [53.4, 51.4]], width: 1.2, press: 'dot', ink: 1, wet: 0.8, dry: 0, pace: 0.5, pause: 80, liberty: 'still' },
    ],
  },
};

export const MOTIF_NAMES = Object.keys(MOTIFS);
