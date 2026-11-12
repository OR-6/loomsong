// Draws the "how a row is made" gallery still on a canvas in the page (its fonts), returns a JPEG data URL.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    await document.fonts.load('64px "Lilita One"');
    await document.fonts.load('40px "Fraunces"');
    const W = 1500, H = 1000;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const ink = '#4a3527', paper = '#fbf3e4', wood = '#c98a4b', sq = '#e0e0dc';
    const RED = '#e8553e', TEAL = '#1fb3a0', YEL = '#f2b632', PIX = '#c8553a';
    // warm desk
    g.fillStyle = '#efd9b8'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 46) { g.fillStyle = y % 92 ? 'rgba(160,110,60,0.05)' : 'rgba(160,110,60,0.08)'; g.fillRect(0, y, W, 22); }
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const card = (x, y, w, h) => { g.save(); g.shadowColor = 'rgba(90,60,30,0.25)'; g.shadowBlur = 18; g.shadowOffsetY = 6; g.fillStyle = paper; rr(x, y, w, h, 18); g.fill(); g.restore(); };
    const text = (s, x, y, size, font = 'Fraunces', color = ink, align = 'left') => { g.fillStyle = color; g.font = `${size}px "${font}"`; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); };
    const N = 8, cell = 46, gap = 6;
    const rowAt = (x, y, mask, on, off = sq, mark = null) => {
      for (let i = 0; i < N; i++) {
        g.fillStyle = (mask >> i) & 1 ? on : off;
        rr(x + i * (cell + gap), y, cell, cell, 9); g.fill();
        if (mark && (mask >> i) & 1) { g.strokeStyle = mark; g.lineWidth = 4; rr(x + i * (cell + gap) + 2, y + 2, cell - 4, cell - 4, 8); g.stroke(); }
      }
    };
    const rowW = N * (cell + gap) - gap;
    // title
    text('How a row is made', W / 2, 92, 66, 'Lilita One', ink, 'center');
    // 1. the card's next row
    const want = 0b01101100; // threads 3, 4, 6, 7
    card(80, 150, 640, 230);
    text('1  The card shows the next row', 115, 208, 36, 'Lilita One');
    rowAt(115 + (570 - rowW) / 2, 250, want, PIX);
    text('Which threads must lift?', 115 + 285, 350, 30, 'Fraunces', '#7a6250', 'center');
    // 2. each lever lifts its own threads
    card(780, 150, 640, 470);
    text('2  Each lever lifts its own threads', 815, 208, 36, 'Lilita One');
    const levers = [[RED, 0b00001100, 'lever 1'], [TEAL, 0b01100000, 'lever 2'], [YEL, 0b00011000, 'lever 3']];
    levers.forEach(([c, m, name], k) => {
      const y = 250 + k * 118;
      g.fillStyle = c; g.beginPath(); g.arc(842, y + 24, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(834, y + 15, 9, 0, Math.PI * 2); g.fill();
      text(name, 842, y + 82, 24, 'Fraunces', '#7a6250', 'center');
      rowAt(895, y, m, c);
    });
    // 3. the answer
    card(80, 430, 640, 400);
    text('3  Lift the ones that make it', 115, 488, 36, 'Lilita One');
    const ly = 530;
    g.fillStyle = RED; g.beginPath(); g.arc(140, ly + 24, 22, 0, Math.PI * 2); g.fill();
    text('+', 182, ly + 36, 40, 'Lilita One', ink, 'center');
    g.fillStyle = TEAL; g.beginPath(); g.arc(224, ly + 24, 22, 0, Math.PI * 2); g.fill();
    text('lever 1 + lever 2', 262, ly + 36, 30, 'Fraunces');
    rowAt(115 + (570 - rowW) / 2, ly + 78, 0b00001100, RED);
    rowAt(115 + (570 - rowW) / 2, ly + 78, 0b01100000, TEAL, 'rgba(0,0,0,0)');
    text('= the row. Slide Pip across to weave it.', 400, ly + 186, 30, 'Fraunces', ink, 'center');
    text('Lever 3 would add a wrong thread.', 400, ly + 236, 26, 'Fraunces', '#9a5a40', 'center');
    // 4. planning
    card(780, 670, 640, 160);
    text('4  Levers stay up between rows', 815, 728, 36, 'Lilita One');
    text('Every move unties a bow: keep the right', 815, 774, 27, 'Fraunces', '#7a6250');
    text('ones up and three stars are yours.', 815, 808, 27, 'Fraunces', '#7a6250');
    text('At Night you can’t see what a lever lifts until you try it. Then it’s deduction.', W / 2, 915, 32, 'Fraunces', ink, 'center');
    return cv.toDataURL('image/jpeg', 0.92);
  });
}
