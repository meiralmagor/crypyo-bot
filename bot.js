require('dotenv').config();
const http = require('http');
http.createServer((req, res) => { res.end('Bot Active'); }).listen(process.env.PORT || 3000);

const TelegramBot = require('node-telegram-bot-api');
const ccxt = require('ccxt');
const axios = require('axios');
const { RSI, EMA } = require('technicalindicators');

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.CHAT_ID;
const bot = new TelegramBot(token, { polling: false });

// מעבר לביננס כדי לעקוף את החסימה של Bybit ב-Render
const exchange = new ccxt.binance({ 'enableRateLimit': true }); 

const watchlist = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'PEPE/USDT', 'DOGE/USDT'];

bot.sendMessage(chatId, "🚀 בוס, הבוט המאוחד באוויר (Binance)!\n📊 אחוזים, סנטימנט ודופק פעילים.");

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

async function sendHeartbeat() {
    try {
        const sentiment = await getNewsSentiment();
        let statusMsg = `💓 **עדכון דופק (15 דק')**\n🌍 סנטימנט עולם: ${sentiment}/100\n\n`;
        for (const symbol of ['BTC/USDT', 'SOL/USDT']) {
            const ohlcv = await exchange.fetchOHLCV(symbol, '5m', undefined, 20);
            const closes = ohlcv.map(v => v[4]);
            const rsi = RSI.calculate({ values: closes, period: 14 }).pop();
            statusMsg += `🔹 **${symbol}**: RSI הוא ${rsi.toFixed(0)}\n`;
        }
        await bot.sendMessage(chatId, statusMsg);
    } catch (e) { console.log("Heartbeat error: " + e.message); }
}

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
                const tpPercent = 1.5; 
                const slPercent = 0.5; 
                
                const tpPrice = signal === "LONG 🟢" ? currentPrice * (1 + tpPercent/100) : currentPrice * (1 - tpPercent/100);
                const slPrice = signal === "LONG 🟢" ? currentPrice * (1 - slPercent/100) : currentPrice * (1 + slPercent/100);

                const msg = `🎲 **איתות 1:3** 🎲\n\n` +
                            `🪙 **${symbol}** | **${signal}**\n` +
                            `🌍 סנטימנט: ${sentiment}/100\n` +
                            `💰 מחיר: $${currentPrice}\n` +
                            `✅ יעד: $${tpPrice.toFixed(4)} (+${tpPercent}%)\n` +
                            `🛑 סטופ: $${slPrice.toFixed(4)} (-${slPercent}%)\n\n` +
                            `⚖️ יחס סיכון/סיכוי: 1:3`;

                await bot.sendMessage(chatId, msg);
            }
        } catch (e) { console.log(e.message); }
    }
}

setInterval(masterTradingBot, 300000); 
setInterval(sendHeartbeat, 900000); 

masterTradingBot();
sendHeartbeat();
