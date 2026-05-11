const puppeteer =
require('puppeteer');

async function launchBrowser(){

const browser =
await puppeteer.launch({

headless:false,

executablePath:

'C:/Program Files/Google/Chrome/Application/chrome.exe',

defaultViewport:null,

args:[

'--start-maximized'

]

});

const page =
await browser.newPage();

await page.goto(

'https://twitch.tv'

);

console.log(
'BROWSER STARTED'
);

}

module.exports = {

launchBrowser

};