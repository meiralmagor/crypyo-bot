require('dotenv').config();
const http = require('http');
http.createServer((req, res) => { res.end('Bot Active'); }).listen(process.env.PORT || 3000);

const TelegramBot = require('node-telegram-bot-api');
const ccxt = require('ccxt');
const { RSI, EMA } = require('technicalindicators');

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.CHAT_ID;
const bot = new TelegramBot(token, { polling: false });
const exchange = new ccxt.bybit(); 

const watchlist = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'PEPE/USDT', 'DOGE/USDT'];

bot.sendMessage(chatId, "✅ מאיר, הבוט עודכן! תקבל עדכון סטטוס בכל 15 דקות.");

// פונקציה לשליחת עדכון "אני חי"
async function sendHeartbeat() {
    try {
        let statusMsg = "💓 **עדכון דופק (כל 15 דק')** 💓\n\n";
        for (const symbol of ['BTC/USDT', 'SOL/USDT', 'PEPE/USDT']) {
            const ohlcv = await exchange.fetchOHLCV(symbol, '5m', undefined, 20);
            const closes = ohlcv.map(v => v[4]);
            const rsi = RSI.calculate({ values: closes, period: 14 }).pop();
            statusMsg += `🔹 **${symbol}**: RSI הוא ${rsi.toFixed(0)}\n`;
        }
        statusMsg += "\n🔍 ממשיך לסרוק איתותים 1:3...";
        await bot.sendMessage(chatId, statusMsg);
    } catch (e) { console.log("Heartbeat error: " + e.message); }
}

async function masterTradingBot() {
    console.log(`--- סריקה ב-Bybit: ${new Date().toLocaleTimeString()} ---`);
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
                const targetProfit = 10; 
                const tpPercent = 0.015; 
                const slPercent = 0.005; 
                
                const amount = targetProfit / (currentPrice * tpPercent);
                const tpPrice = signal === "LONG 🟢" ? currentPrice * (1 + tpPercent) : currentPrice * (1 - tpPercent);
                const slPrice = signal === "LONG 🟢" ? currentPrice * (1 - slPercent) : currentPrice * (1 + slPercent);

                await bot.sendMessage(chatId, `🎲 **איתות 1:3** 🎲\n🪙 **${symbol}**\n📊 **${signal}**\n💰 מחיר: $${currentPrice}\n✅ יעד: $${tpPrice.toFixed(4)}\n🛑 סטופ: $${slPrice.toFixed(4)}`);
            }
        } catch (e) { console.log(e.message); }
    }
}

// סריקה רגילה כל 5 דקות
setInterval(masterTradingBot, 300000); 

// עדכון דופק למאיר כל 15 דקות
setInterval(sendHeartbeat, 900000); 

masterTradingBot();