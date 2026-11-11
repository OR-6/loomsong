// E2E: the picture of the day. Hidden in the tutorial; after the first picture a
// gift-wrapped ball offers today's picture; a poke starts it; weaving it puts its
// plush on the desk and counts the day; the ball then says "tomorrow".
import { run, wait, freshSession, setTable, calibrate, poke, check, done } from './e2e-lib.mjs';
await freshSession();
await setTable();
let w = run('tools/daily-where.mjs');
check('no daily ball during the first picture', !w.visible && !w.ball, JSON.stringify({ visible: w.visible }));
run('tools/seed-sprout-done.mjs');
await wait(600);
w = run('tools/daily-where.mjs');
check('after the first picture the ball offers today', w.visible && w.bow && !!w.ball, JSON.stringify({ visible: w.visible, bow: w.bow }));
const cal = await calibrate();
await poke(cal, w.ball);
await wait(500);
w = run('tools/daily-where.mjs');
check("a poke starts today's picture", w.daily !== '' && w.level.startsWith('day-'), `${w.level} ${w.daily}`);
check('it says which picture', w.notice.startsWith('Today: '), w.notice);
check('the ball steps aside while it is on the loom', !w.visible);
const id = w.level;
run('tools/solve-nowait.mjs');
await wait(14000);
w = run('tools/daily-where.mjs');
check('woven: the day is counted', w.days.length === 1, JSON.stringify(w.days));
check('its plush lives on the desk', !!w.placed[id] && w.ids.indexOf(id) >= 5, JSON.stringify({ placed: w.placed[id], at: w.ids.indexOf(id) }));
check('back to the chapters afterwards', w.daily === '' && !w.level.startsWith('day-'), w.level);
check('the ball is unwrapped until tomorrow', w.visible && !w.bow);
await poke(cal, w.ball);
await wait(400);
w = run('tools/daily-where.mjs');
check('poking it again only says tomorrow', w.daily === '' && w.notice === 'A new picture tomorrow', w.notice);
done('daily picture');
