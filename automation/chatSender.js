// automation/chatSender.js

const { getAIMessage } = require('../ai/gemini');

const CHAT_INPUT_SELECTORS = [
  'div[data-a-target="chat-input"]',
  '.chat-wysiwyg-input__editor',
  'div[contenteditable="true"][data-a-target]',
  'div[contenteditable="true"]',
  'textarea[data-a-target="chat-input"]'
];

const SEND_BUTTON_SELECTOR = 'button[data-a-target="chat-send-button"]';
const CHAT_MESSAGE_SELECTOR = '.chat-line__message';

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function randomDelay(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function detectChatbox(page) {
  for (const selector of CHAT_INPUT_SELECTORS) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      console.log('CHATBOX DETECTED:', selector);
      return selector;
    } catch(e) {}
  }
  console.log('CHATBOX NOT FOUND');
  return null;
}

async function getRecentMessages(page) {
  try {
    const messages = await page.evaluate((selector) => {
      const elements = document.querySelectorAll(selector);
      return Array.from(elements).slice(-10).map(el => el.innerText).filter(Boolean);
    }, CHAT_MESSAGE_SELECTOR);
    return messages;
  } catch(err) { return []; }
}

async function sendChatMessage(page, message) {
  try {
    const foundSelector = await detectChatbox(page);
    if (!foundSelector) return false;

    await page.click(foundSelector);
    await wait(800);

    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await wait(100);
    await page.keyboard.press('Backspace');
    await wait(200);

    await page.keyboard.type(message, { delay: randomDelay(40, 100) });
    await wait(randomDelay(600, 1500));

    try {
      const sendBtn = await page.$(SEND_BUTTON_SELECTOR);
      if (sendBtn) { await sendBtn.click(); }
      else { await page.keyboard.press('Enter'); }
    } catch(err) { await page.keyboard.press('Enter'); }

    console.log('CHAT MESSAGE SENT:', message);
    return true;
  } catch(err) {
    console.log('SEND CHAT ERROR:', err.message);
    return false;
  }
}

async function generateAIReply(page, streamer, chatConfig = {}) {
  try {
    const recentMessages = await getRecentMessages(page);
    const mood  = (chatConfig.moodTags  || ['casual']).join(', ');
    const langs = (chatConfig.langTags  || ['English']).join(', ');
    const games = (chatConfig.gameTags  || []).join(', ');
    const name  =  chatConfig.displayName || 'viewer';

    const prompt = `You are "${name}", a Twitch viewer watching ${streamer}'s stream.
Write ONE short Twitch chat message. Max 8 words. Natural and human, not spam.
Mood: ${mood}. Language: ${langs}.${games ? ` Game: ${games}.` : ''}
Sometimes use Twitch emotes (Kappa, PogChamp, LUL, OMEGALUL, Pog, EZ, KEKW, POGGERS, BibleThump, NotLikeThis, PauseChamp, FailFish, EleGiggle, 4Head, ResidentSleeper, <3, DansGame, SwiftRage, Kreygasm, FrankerZ).
${recentMessages.length > 0 ? `Recent chat:\n${recentMessages.slice(-5).join('\n')}` : ''}
Reply with ONLY the message text, no quotes, nothing else.`;

    const response = await getAIMessage(prompt);
    if (!response) return null;
    return response.trim().replace(/^["']|["']$/g, '');
  } catch(err) {
    console.log('AI GENERATION ERROR:', err.message);
    return null;
  }
}

async function startChatLoop(page, streamer, chatConfig = {}) {
  try {
    console.log('CHAT LOOP STARTED:', streamer);
    while (true) {
      const min = (chatConfig.minSeconds || 20) * 1000;
      const max = (chatConfig.maxSeconds || 70) * 1000;
      const delay = randomDelay(min, max);
      console.log(`[${streamer}] Next chat in ${Math.round(delay/1000)}s`);
      await wait(delay);
      const message = await generateAIReply(page, streamer, chatConfig);
      if (!message) continue;
      await sendChatMessage(page, message);
    }
  } catch(err) { console.log('CHAT LOOP ERROR:', err.message); }
}

module.exports = { detectChatbox, sendChatMessage, getRecentMessages, generateAIReply, startChatLoop };