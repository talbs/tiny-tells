const TRAIL = [
  [18, 0.14],
  [12, 0.22],
  [6, 0.34],
];

export const onionSkin = ({ frames = 19 } = {}) => {
  let buffer = [];
  const tint = document.createElement('canvas'),
    tinted = tint.getContext('2d');
  return {
    reset: () => (buffer = []),
    draw(ghost, src, color) {
      const size = src.width;
      if (ghost.width !== size) {
        ghost.width = ghost.height = size;
        buffer = [];
      }
      const snap = buffer.length >= frames ? buffer.shift() : document.createElement('canvas');
      snap.width = snap.height = size;
      snap.getContext('2d').drawImage(src, 0, 0);
      buffer.push(snap);
      const g = ghost.getContext('2d');
      g.clearRect(0, 0, size, size);
      tint.width = tint.height = size;
      TRAIL.forEach(([back, alpha]) => {
        const frame = buffer[buffer.length - 1 - back];
        if (!frame) return;
        tinted.globalCompositeOperation = 'source-over';
        tinted.clearRect(0, 0, size, size);
        tinted.drawImage(frame, 0, 0);
        tinted.globalCompositeOperation = 'source-in';
        tinted.fillStyle = color;
        tinted.fillRect(0, 0, size, size);
        g.globalAlpha = alpha;
        g.drawImage(tint, 0, 0);
      });
      g.globalAlpha = 1;
    },
  };
};
