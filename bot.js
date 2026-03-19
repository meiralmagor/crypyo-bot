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
const exchange = new ccxt.bybit(); 

const watchlist = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'DOGE/USDT', 'PEPE/USDT', 'WIF/USDT', 'BONK/USDT'];

bot.sendMessage(chatId, "🚀 מאיר, הבוט המלא באוויר!\n📊 סיכום יומי פעיל\n🛡️ יחס סיכון/סיכוי 1:3 מוגדר");

async function getNewsSentiment() {
    try {
        const response = await axios.get('https://cryptopanic.com/api/v1/posts/?auth_token=wlkH1JdX7Rtn8BOklWBTZT3dWrLk29YS&public=true');
        let score = 50;
        response.data.results.slice(0, 10).forEach(post => {
            const t = post.title.toLowerCase();
            if(t.includes('bullish') || t.includes('pump')) score += 5;
            if(t.includes('bearish') || t.includes('drop')) score -= 5;
        });
        return score;
    } catch (e) { return 50; }
}

// פונקציית סיכום יומי
async function sendDailyReport() {
    let report = "📅 **סיכום שוק יומי למאיר** 📅\n\n";
    const sentiment = await getNewsSentiment();
    report += `🌍 סנטימנט חדשות: ${sentiment > 50 ? "חיובי ✅" : "שלילי ❌"} (${sentiment}/100)\n\n`;

    for (const symbol of watchlist) {
        try {
            const ticker = await exchange.fetchTicker(symbol);
            const change = ticker.percentage;
            const price = ticker.last;
            const ohlcv = await exchange.fetchOHLCV(symbol, '1h', undefined, 200);
            const closes = ohlcv.map(v => v[4]);
            const rsi = RSI.calculate({ values: closes, period: 14 }).pop();
            const ema200 = EMA.calculate({ values: closes, period: 200 }).pop();
            
            let reason = price > ema200 ? "מגמה עולה" : "מגמה יורדת";
            const emoji = change >= 0 ? "📈" : "📉";
            report += `${emoji} **${symbol}**: ${change.toFixed(2)}% | RSI: ${rsi.toFixed(0)}\n🧐 ${reason}\n\n`;
        } catch (e) { console.log(e.message); }
    }
    await bot.sendMessage(chatId, report);
}

// סורק איתותים עם יחס 1:3
async function masterTradingBot() {
    for (const symbol of watchlist) {
        try {
            const ohlcv = await exchange.fetchOHLCV(symbol, '5m', undefined, 200);
            const closes = ohlcv.map(val => val[4]);
            const highs = ohlcv.map(val => val[2]);
            const currentPrice = closes[closes.length - 1];
            const rsi = RSI.calculate({ values: closes, period: 14 }).pop();
            const ema200 = EMA.calculate({ values: closes, period: 200 }).pop();
            const boxHigh = Math.max(...highs.slice(-20, -1));

            let signal = "";
            if (currentPrice > ema200 && rsi <= 40) signal = "LONG 🟢";
            else if (currentPrice < ema200 && rsi >= 60) signal = "SHORT 🔴";

            if (signal !== "") {
                const targetProfit = 10; 
                const tpPercent = 0.015; // 1.5% רווח
                const slPercent = 0.005; // 0.5% הפסד (יחס 1:3)
                
                const amount = targetProfit / (currentPrice * tpPercent);
                const tpPrice = signal === "LONG 🟢" ? currentPrice * (1 + tpPercent) : currentPrice * (1 - tpPercent);
                const slPrice = signal === "LONG 🟢" ? currentPrice * (1 - slPercent) : currentPrice * (1 + slPercent);

                await bot.sendMessage(chatId, `🎲 **איתות 1:3 (Bybit)** 🎲\n🪙 **${symbol}**\n📊 **${signal}**\n💰 מחיר: $${currentPrice}\n\n✅ יעד (10$+): $${tpPrice.toFixed(4)}\n🛑 סטופ (3.3$-): $${slPrice.toFixed(4)}\n🛒 כמות: ${amount.toFixed(3)}`);
            }

            if (currentPrice > boxHigh) {
                await bot.sendMessage(chatId, `📦 **פריצת בוקס ב-${symbol}**!`);
            }
        } catch (e) { console.log(e.message); }
    }
}

setInterval(masterTradingBot, 300000); // איתותים כל 5 דקות
setInterval(sendDailyReport, 86400000); // דו"ח כל 24 שעות

sendDailyReport(); // שלח דו"ח מיד עם ההפעלה
masterTradingBot();