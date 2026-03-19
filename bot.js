require('dotenv').config();
const http = require('http');
http.createServer((req, res) => { res.end('Bot Active'); }).listen(process.env.PORT || 3000);

const TelegramBot = require('node-telegram-bot-api');
const ccxt = require('ccxt');
const { RSI, EMA } = require('technicalindicators');
const axios = require('axios');

// הגדרות בוס
const token = '8207677885:AAFxWZHismMi_pLgNlyV1CX8q_rwZF2l78k';
const chatId = '1153254394';
const bot = new TelegramBot(token, { polling: false });
const exchange = new ccxt.bybit(); 

const watchlist = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'DOGE/USDT', 'PEPE/USDT', 'WIF/USDT', 'BONK/USDT'];

bot.sendMessage(chatId, "🚀 בוס, הבוט המקצועי באוויר!\n✅ אחוזים וסנטימנט פעילים\n💓 עדכון דופק כל 15 דקות");

// פונקציה לבדיקת סנטימנט עולמי
async function getNewsSentiment() {
    try {
        const response = await axios.get('https://cryptopanic.com/api/v1/posts/?auth_token=wlkH1JdX7Rtn8BOklWBTZT3dWrLk29YS&public=true');
        let score = 50;
        response.data.results.slice(0, 10).forEach(post => {
            const t = post.title.toLowerCase();
            if(t.includes('bullish') || t.includes('pump') || t.includes('up')) score += 5;
            if(t.includes('bearish') || t.includes('drop') || t.includes('down')) score -= 5;
        });
        return score;
    } catch (e) { return 50; }
}

// פונקציית "דופק" - כל 15 דקות כדי שתראה שהכל עובד
async function sendHeartbeat() {
    try {
        const sentiment = await getNewsSentiment();
        let statusMsg = `💓 **עדכון דופק (15 דק')** 💓\n🌍 סנטימנט עולם: ${sentiment}/100\n\n`;
        
        for (const symbol of ['BTC/USDT', 'SOL/USDT', 'PEPE/USDT']) {
            const ticker = await exchange.fetchTicker(symbol);
            const ohlcv = await exchange.fetchOHLCV(symbol, '5m', undefined, 20);
            const closes = ohlcv.map(v => v[4]);
            const rsi = RSI.calculate({ values: closes, period: 14 }).pop();
            statusMsg += `🔹 **${symbol}**: $${ticker.last} | RSI: ${rsi.toFixed(0)}\n`;
        }
        await bot.sendMessage(chatId, statusMsg);
    } catch (e) { console.log("Heartbeat error: " + e.message); }
}

// סורק איתותים עם יחס 1:3 ואחוזים
async function masterTradingBot() {
    const sentiment = await getNewsSentiment();
    for (const symbol of watchlist) {
        try {
            const ohlcv = await exchange.fetchOHLCV(symbol, '5m', undefined, 200);
            const closes = ohlcv.map(val => val[4]);
            const currentPrice = closes[closes.length - 1];
            const rsi = RSI.calculate({ values: closes, period: 14 }).pop();
            const ema200 = EMA.calculate({ values: closes, period: 200 }).pop();

            let signal = "";
            if (currentPrice > ema200 && rsi <= 40) signal = "LONG 🟢";
            else if (currentPrice < ema200 && rsi >= 60) signal = "SHORT 🔴";

            if (signal !== "") {
                const tpPercent = 1.5; // 1.5% רווח
                const slPercent = 0.5; // 0.5% הפסד (יחס 1:3)
                
                const tpPrice = signal === "LONG 🟢" ? currentPrice * (1 + tpPercent/100) : currentPrice * (1 - tpPercent/100);
                const slPrice = signal === "LONG 🟢" ? currentPrice * (1 - slPercent/100) : currentPrice * (1 + slPercent/100);

                const msg = `🎲 **איתות 1:3 מצא הזדמנות!** 🎲\n\n` +
                            `🪙 מטבע: **${symbol}**\n` +
                            `📊 פעולה: **${signal}**\n` +
                            `🌍 סנטימנט: ${sentiment}/100\n\n` +
                            `💰 כניסה: $${currentPrice}\n` +
                            `🎯 יעד (TP): $${tpPrice.toFixed(4)} (**+${tpPercent}%**)\n` +
                            `🛑 סטופ (SL): $${slPrice.toFixed(4)} (**-${slPercent}%**)\n\n` +
                            `⚖️ יחס סיכון/סיכוי: **1:3**`;

                await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
            }
        } catch (e) { console.log(e.message); }
    }
}

// טיימרים
setInterval(masterTradingBot, 300000); // בדיקת איתותים כל 5 דקות
setInterval(sendHeartbeat, 900000);   // עדכון דופק למאיר כל 15 דקות

// הפעלה מיידית
masterTradingBot();
sendHeartbeat();
