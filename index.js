const axios = require('axios');
const { parse } = require('node-html-parser');

const PHONE = '917095083900';
const CALLMEBOT_KEY = process.env.CALLMEBOT_APIKEY;
const CHECK_INTERVAL_MS = 4 * 60 * 1000;
const STATUS_INTERVAL_MS = 30 * 60 * 1000;

const TARGETS = [
  {
    name: 'BookMyShow IPL',
    url: 'https://in.bookmyshow.com/explore/c/ipl',
    keywords: ['book tickets','buy now','get tickets','tickets available','sale live','register now','book now'],
    negativeKeywords: ['too early to the party']
  },
  {
    name: 'BookMyShow MI Pre-Reg',
    url: 'https://in.bookmyshow.com/sports/mumbai-indians-registration-ipl-2026/ET00489395',
    keywords: ['book tickets','buy now','get tickets','tickets available','sale live'],
    negativeKeywords: ['login to register','pre-sale registration for tickets open now']
  },
  {
    name: 'District by Zomato',
    url: 'https://www.district.in/events/ipl-ticket-booking',
    keywords: ['book tickets','buy now','get tickets','tickets available','sale live','book now'],
    negativeKeywords: []
  },
  {
    name: 'Paytm Insider',
    url: 'https://insider.in/search?q=IPL+2026',
    keywords: ['book now','buy now','get tickets','tickets available','sale live'],
    negativeKeywords: []
  },
  {
    name: 'IPL Official',
    url: 'https://www.iplt20.com/',
    keywords: ['book tickets','buy now','get tickets','tickets available','sale live','tickets on sale','buy tickets'],
    negativeKeywords: []
  },
  {
    name: 'Cricbuzz IPL 2026',
    url: 'https://www.cricbuzz.com/cricket-series/8676/indian-premier-league-2026/matches',
    keywords: ['tickets on sale','book tickets','buy tickets','get tickets'],
    negativeKeywords: []
  },
  {
    name: 'ESPNcricinfo IPL 2026',
    url: 'https://www.espncricinfo.com/series/indian-premier-league-2026-1449924',
    keywords: ['book tickets','buy now','get tickets','tickets available','tickets on sale'],
    negativeKeywords: []
  }
];

async function sendWhatsApp(message) {
  if (!CALLMEBOT_KEY || CALLMEBOT_KEY.startsWith('AWAITING') || CALLMEBOT_KEY.startsWith('PENDING')) {
    console.log('[WhatsApp] No valid API key yet. Message:', message.substring(0, 100));
    return;
  }
  try {
    const encoded = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${PHONE}&text=${encoded}&apikey=${CALLMEBOT_KEY}`;
    const res = await axios.get(url, { timeout: 15000 });
    console.log('[WhatsApp] Sent! Status:', res.status);
  } catch (err) {
    console.error('[WhatsApp] Failed:', err.message);
  }
}

async function checkTarget(target) {
  try {
    const { data } = await axios.get(target.url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    const root = parse(data);
    const bodyText = (root.querySelector('body') || root).text.toLowerCase();
    const hasNegative = target.negativeKeywords.some(kw => bodyText.includes(kw.toLowerCase()));
    if (hasNegative) return { live: false, source: target.name };
    const matchedKw = target.keywords.find(kw => bodyText.includes(kw.toLowerCase()));
    if (matchedKw) {
      console.log(`[ALERT] ${target.name} matched: "${matchedKw}"`);
      return { live: true, source: target.name, url: target.url, keyword: matchedKw };
    }
    return { live: false, source: target.name };
  } catch (err) {
    console.error(`[Error] ${target.name}: ${err.message}`);
    return { live: false, source: target.name };
  }
}

let alerted = {};
let checkCount = 0;

async function runChecks() {
  checkCount++;
  const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  console.log(`\n[${ts} IST] Check #${checkCount} starting...`);
  const liveResults = [];
  for (const target of TARGETS) {
    const result = await checkTarget(target);
    console.log(`  [${result.live ? 'LIVE!' : 'not live'}] ${result.source}`);
    if (result.live && !alerted[result.source]) {
      liveResults.push(result);
    }
  }
  if (liveResults.length > 0) {
    let msg = '\u{1F6A8} IPL TICKETS ARE LIVE RIGHT NOW! \u{1F6A8}\n\nBook instantly before they sell out:\n';
    for (const r of liveResults) {
      msg += `\n\u2192 ${r.source}: ${r.url}`;
      alerted[r.source] = true;
    }
    msg += '\n\nHurry! Click and book in seconds.\n(Agent will keep checking other platforms too)';
    console.log('[ALERT] Sending WhatsApp alert!');
    await sendWhatsApp(msg);
  }
  console.log(`[Check #${checkCount}] Complete.`);
}

async function sendStatusUpdate() {
  if (Object.keys(alerted).length === 0) {
    const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    await sendWhatsApp(`\u23F0 IPL Ticket Agent - Still monitoring all 7 platforms.\nNo tickets live yet as of ${ts} IST.\nWill alert you the second they drop! \u{1F3CF}`);
  }
}

(async () => {
  console.log('\u{1F3CF} IPL Ticket Monitor Agent STARTING...');
  console.log(`   Checking ${TARGETS.length} platforms every 4 minutes`);
  console.log(`   WhatsApp alerts to +${PHONE}`);
  console.log(`   CallMeBot key present: ${!!CALLMEBOT_KEY}`);
  await sendWhatsApp('\u2705 IPL Ticket Alert Agent is now ACTIVE - you will get direct booking links instantly when tickets drop \u{1F3CF}\n\nMonitoring every 4 minutes:\n- BookMyShow IPL\n- BookMyShow MI Pre-Reg\n- District by Zomato\n- Paytm Insider\n- IPL Official Site\n- Cricbuzz\n- ESPNcricinfo\n\nStatus updates every 30 min.');
  await runChecks();
  setInterval(runChecks, CHECK_INTERVAL_MS);
  setInterval(sendStatusUpdate, STATUS_INTERVAL_MS);
})();
