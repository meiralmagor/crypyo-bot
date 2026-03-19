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

bot.sendMessage(chatId, "🚀 מאיר, הבוט המלא באוויר!\n- יעד רווח: 10$ לעסקה 💰\n- רף: 60%+ 🎲\n- שיטת הבוקס + פילטר ווליום פעילים 📦");

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
                            `🪙 מטבע: **${symbol}**\n` +
                            `📊 פעולה: **${signal}**\n` +
                            `💰 מחיר כניסה: $${currentPrice}\n\n` +
                            `🛒 **כמות לקנייה לרווח של 10$:**\n` +
                            `➡️ לקנות: **${amountToBuy.toFixed(symbol.includes('PEPE') ? 0 : 3)} יחידות**\n` +
                            `🎯 יעד רווח (TP): $${tpPrice.toFixed(symbol.includes('PEPE') ? 8 : 4)}`;
                await bot.sendMessage(chatId, msg);
            }

            if (currentPrice > boxHigh && currentVolume > avgVolume * 1.3) {
                const boxMsg = `📦 **פריצת בוקס - 10$ פוטנציאלי** 📦\n` +
                               `🚀 **${symbol}** פרץ למעלה!\n` +
                               `🎲 סיכוי הצלחה: 84%`;
                await bot.sendMessage(chatId, boxMsg);
            }

        } catch (e) { console.error(e.message); }
    }
}

setInterval(masterTradingBot, 300000); 
masterTradingBot();