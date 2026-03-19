require('dotenv').config();
const http = require('http');
http.createServer((req, res) => {
  res.write('Bot is Running!');
  res.end();
}).listen(process.env.PORT || 3000);

const TelegramBot = require('node-telegram-bot-api');
const ccxt = require('ccxt');
const { RSI, EMA } = require('technicalindicators');
const axios = require('axios');

const token = '8207677885:AAFxWZHismMi_pLgNlyV1CX8q_rwZF2l78k';
const chatId = '1153254394';
const bot = new TelegramBot(token, { polling: false });
const exchange = new ccxt.binance();

const watchlist = [
    'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 
    'DOGE/USDT', 'PEPE/USDT', 'WIF/USDT', 'BONK/USDT'
];

bot.sendMessage(chatId, "🛠️ מאיר, המערכת שודרגה לגרסת הדיוק המקסימלי כולל שיטת הבוקס!");

async function getNewsSentiment() {
    try {
        const response = await axios.get('https://cryptopanic.com/api/v1/posts/?auth_token=wlkH1JdX7Rtn8BOklWBTZT3dWrLk29YS&public=true');
        const news = response.data.results;
        let score = 50; 
        const positiveWords = ['bullish', 'launch', 'pump', 'adoption', 'etf', 'approved', 'moon'];
        const negativeWords = ['bearish', 'hack', 'dump', 'ban', 'crash', 'lawsuit', 'drop'];
        news.slice(0, 15).forEach(post => {
            const title = post.title.toLowerCase();
            positiveWords.forEach(word => { if(title.includes(word)) score += 4; });
            negativeWords.forEach(word => { if(title.includes(word)) score -= 4; });
        });
        return Math.min(Math.max(score, 10), 90); 
    } catch (e) { return 50; }
}

async function masterTradingBot() {
    console.log('--- סריקה מקצועית: ' + new Date().toLocaleTimeString() + ' ---');
    const sentiment = await getNewsSentiment();
    
    for (const symbol of watchlist) {
        try {
            // מושכים 200 נרות כדי לחשב EMA 200 למגמה
            const ohlcv = await exchange.fetchOHLCV(symbol, '5m', undefined, 200);
            const closes = ohlcv.map(val => val[4]);
            const volumes = ohlcv.map(val => val[5]);
            const highs = ohlcv.map(val => val[2]);
            const lows = ohlcv.map(val => val[3]);
            
            const currentPrice = closes[closes.length - 1];
            const currentVolume = volumes[volumes.length - 1];
            const avgVolume = volumes.slice(-20).reduce((a, b) => a + b) / 20;

            // חישוב אינדיקטורים
            const rsi = RSI.calculate({ values: closes, period: 14 }).pop();
            const ema200 = EMA.calculate({ values: closes, period: 200 }).pop();
            
            // לוגיקת דארוואס בוקס (20 נרות אחרונים)
            const boxHigh = Math.max(...highs.slice(-20, -1));
            const boxLow = Math.min(...lows.slice(-20, -1));

            // 1. איתות טכני משולב (הודעה ראשונה)
            let signal = "";
            let winChance = 55;

            // תנאי לונג: מחיר מעל EMA 200 + RSI נמוך + ווליום גבוה מהממוצע
            if (currentPrice > ema200 && rsi <= 35 && currentVolume > avgVolume * 1.2) {
                signal = "LONG 🟢";
                winChance = 70 + (sentiment > 60 ? 15 : 0);
            } 
            // תנאי שורט: מחיר מתחת ל-EMA 200 + RSI גבוה + ווליום גבוה
            else if (currentPrice < ema200 && rsi >= 65 && currentVolume > avgVolume * 1.2) {
                signal = "SHORT 🔴";
                winChance = 70 + (sentiment < 40 ? 15 : 0);
            }

            if (signal !== "" && winChance >= 75) {
                const msg = `💎 **איתות דיוק מקסימלי (Trend + Vol)** 💎\n\n` +
                            `🪙 מטבע: ${symbol}\n` +
                            `📊 פעולה: **${signal}**\n` +
                            `🎲 סיכויי הצלחה: **${winChance}%**\n` +
                            `💰 מחיר: $${currentPrice}\n` +
                            `📈 מגמה: ${currentPrice > ema200 ? "עולה (Bullish)" : "יורדת (Bearish)"}\n` +
                            `⛽ אישור ווליום: ✅ (פי ${ (currentVolume/avgVolume).toFixed(1) } מהממוצע)`;
                await bot.sendMessage(chatId, msg);
            }

            // 2. איתות שיטת הבוקס (הודעה נפרדת)
            if (currentPrice > boxHigh && currentVolume > avgVolume * 1.5) {
                const boxMsg = `📦 **פריצת שיטת הבוקס (BOX THEORY)** 📦\n\n` +
                               `🚀 מטבע **${symbol}** פרץ את תקרת הקופסה!\n` +
                               `🔥 פקודה: **קנייה (BUY) אגרסיבית**\n` +
                               `📌 מחיר פריצה: $${currentPrice}\n` +
                               `📏 גבול עליון: $${boxHigh.toFixed(6)}\n` +
                               `⚠️ ווליום פריצה חזק!`;
                await bot.sendMessage(chatId, boxMsg);
            } else if (currentPrice < boxLow && currentVolume > avgVolume * 1.5) {
                const boxMsg = `📦 **פריצת שיטת הבוקס (BOX THEORY)** 📦\n\n` +
                               `📉 מטבע **${symbol}** שבר את רצפת הקופסה!\n` +
                               `💀 פקודה: **מכירה (SELL) / שורט**\n` +
                               `📌 מחיר שבירה: $${currentPrice}\n` +
                               `📏 גבול תחתון: $${boxLow.toFixed(6)}\n` +
                               `⚠️ ווליום שבירה חזק!`;
                await bot.sendMessage(chatId, boxMsg);
            }

        } catch (e) { console.error("Error: " + e.message); }
    }
}

setInterval(masterTradingBot, 300000); 
masterTradingBot();