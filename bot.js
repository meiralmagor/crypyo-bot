require('dotenv').config();
const http = require('http');
http.createServer((req, res) => { res.end('Bot Active'); }).listen(process.env.PORT || 3000);

const TelegramBot = require('node-telegram-bot-api');
const ccxt = require('ccxt');
const { RSI, EMA } = require('technicalindicators');
const axios = require('axios');

const token = '8207677885:AAFxWZHismMi_pLgNlyV1CX8q_rwZF2l78k';
const chatId = '1153254394';
const bot = new TelegramBot(token, { polling: false });

// עובדים עם Bybit כדי לעקוף חסימות
const exchange = new ccxt.bybit(); 

const watchlist = [
    'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 
    'DOGE/USDT', 'PEPE/USDT', 'WIF/USDT', 'BONK/USDT'
];

bot.sendMessage(chatId, "✅ מאיר, המערכת עודכנה לנתוני Bybit!\n💰 יעד רווח: 10$\n📦 שיטת הבוקס פעילה!");

async function getNewsSentiment() {
    try {
        const response = await axios.get('https://cryptopanic.com/api/v1/posts/?auth_token=wlkH1JdX7Rtn8BOklWBTZT3dWrLk29YS&public=true');
        const news = response.data.results;
        let score = 50; 
        const positiveWords = ['bullish', 'pump', 'moon', 'buy'];
        const negativeWords = ['bearish', 'dump', 'crash', 'sell'];
        news.slice(0, 10).forEach(post => {
            const title = post.title.toLowerCase();
            positiveWords.forEach(w => { if(title.includes(w)) score += 5; });
            negativeWords.forEach(w => { if(title.includes(w)) score -= 5; });
        });
        return Math.min(Math.max(score, 10), 90);
    } catch (e) { return 50; }
}

async function masterTradingBot() {
    console.log('--- סריקה ב-Bybit: ' + new Date().toLocaleTimeString() + ' ---');
    const sentiment = await getNewsSentiment();
    for (const symbol of watchlist) {
        try {
            const ohlcv = await exchange.fetchOHLCV(symbol, '5m', undefined, 200);
            const closes = ohlcv.map(val => val[4]);
            const volumes = ohlcv.map(val => val[5]);
            const highs = ohlcv.map(val => val[2]);
            const lows = ohlcv.map(val => val[3]);
            
            const currentPrice = closes[closes.length - 1];
            const currentVolume = volumes[volumes.length - 1];
            const avgVolume = volumes.slice(-20).reduce((a, b) => a + b) / 20;

            const rsi = RSI.calculate({ values: closes, period: 14 }).pop();
            const ema200 = EMA.calculate({ values: closes, period: 200 }).pop();
            const boxHigh = Math.max(...highs.slice(-20, -1));
            const boxLow = Math.min(...lows.slice(-20, -1));

            let signal = "";
            let winChance = 58;

            // אסטרטגיית Scalping
            if (currentPrice > ema200 && rsi <= 40) {
                signal = "LONG 🟢";
                winChance = 60 + (rsi <= 30 ? 12 : 0) + (currentVolume > avgVolume ? 6 : 0);
            } else if (currentPrice < ema200 && rsi >= 60) {
                signal = "SHORT 🔴";
                winChance = 60 + (rsi >= 70 ? 12 : 0) + (currentVolume > avgVolume ? 6 : 0);
            }

            if (signal !== "" && winChance >= 60) {
                const targetProfit = 10; 
                const tpPercent = 0.015; 
                const amountToBuy = targetProfit / (currentPrice * tpPercent);
                const tpPrice = signal === "LONG 🟢" ? currentPrice * (1 + tpPercent) : currentPrice * (1 - tpPercent);

                const msg = `🎲 **איתות Scalping (${winChance.toFixed(0)}%)** 🎲\n\n` +
                            `🪙 מטבע: **${symbol} (Bybit)**\n` +
                            `📊 פעולה: **${signal}**\n` +
                            `💰 כניסה: $${currentPrice}\n\n` +
                            `🛒 **כמות לרווח 10$:**\n` +
                            `➡️ ${amountToBuy.toFixed(symbol.includes('PEPE') ? 0 : 3)} יחידות\n` +
                            `🎯 יעד: $${tpPrice.toFixed(symbol.includes('PEPE') ? 8 : 4)}`;
                await bot.sendMessage(chatId, msg);
            }

            // --- הוספתי כאן את הודעת הבוקס שהייתה חסרה לך ---
            if (currentPrice > boxHigh && currentVolume > avgVolume * 1.3) {
                await bot.sendMessage(chatId, `📦 **פריצת בוקס (Bybit)** 📦\n🚀 **${symbol}** יצא למעלה!\n📌 מחיר: $${currentPrice}`);
            } else if (currentPrice < boxLow && currentVolume > avgVolume * 1.3) {
                await bot.sendMessage(chatId, `📦 **שבירת בוקס (Bybit)** 📦\n📉 **${symbol}** נשבר למטה!\n📌 מחיר: $${currentPrice}`);
            }

        } catch (e) { console.log("Bybit Error: " + e.message); }
    }
}

setInterval(masterTradingBot, 300000); 
masterTradingBot();
