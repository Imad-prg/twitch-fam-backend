async function simulateHumanBehavior(

page

){

try{

/* =========================
RANDOM SCROLL
========================= */

await page.evaluate(()=>{

window.scrollBy({

top:
Math.floor(
Math.random() * 800
),

behavior:
'smooth'

});

});

/* =========================
WAIT
========================= */

await delay(
random(2000,6000)
);

/* =========================
MOUSE MOVE
========================= */

await page.mouse.move(

random(100,900),
random(100,700),

{

steps:
random(10,40)

}

);

/* =========================
WAIT
========================= */

await delay(
random(1000,3000)
);

/* =========================
RANDOM CLICK
========================= */

const randomX =
random(100,1200);

const randomY =
random(100,700);

await page.mouse.click(

randomX,
randomY

);

/* =========================
WAIT
========================= */

await delay(
random(3000,8000)
);

/* =========================
SCROLL AGAIN
========================= */

await page.evaluate(()=>{

window.scrollBy({

top:
Math.floor(
Math.random() * 500
),

behavior:
'smooth'

});

});

console.log(
'HUMAN SIMULATION COMPLETE'
);

}catch(err){

console.log(
'HUMAN ERROR:',
err.message
);

}

}

/* =========================
UTILS
========================= */

function delay(ms){

return new Promise(

resolve=>

setTimeout(
resolve,
ms
)

);

}

function random(

min,
max

){

return Math.floor(

Math.random() *

(max - min + 1)

) + min;

}

module.exports = {

simulateHumanBehavior

};