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

const watchlist = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'PEPE/USDT'];

bot.sendMessage(chatId, "🛠️ מצב בדיקה הופעל: סריקה כל 30 שניות!");

async function getNewsSentiment() {
    try {
        const response = await axios.get('https://cryptopanic.com/api/v1/posts/?auth_token=wlkH1JdX7Rtn8BOklWBTZT3dWrLk29YS&public=true');
        return 50; // בבדיקה נחזיר ניטרלי כדי לרוץ מהר
    } catch (e) { return 50; }
}

async function masterTradingBot() {
    console.log('--- סריקת בדיקה מהירה ---');
    let signalsFound = 0;

    for (const symbol of watchlist) {
        try {
            const ohlcv = await exchange.fetchOHLCV(symbol, '5m', undefined, 100);
            const closes = ohlcv.map(val => val[4]);
            const rsi = RSI.calculate({ values: closes, period: 14 }).pop();
            const currentPrice = closes[closes.length - 1];

            // תנאים גמישים מאוד רק בשביל הבדיקה שתראה הודעה
            if (rsi < 45 || rsi > 55) { 
                signalsFound++;
                const side = rsi < 45 ? "LONG 🟢" : "SHORT 🔴";
                const msg = `⚡ **בדיקת מערכת תקינה** ⚡\n🪙 מטבע: ${symbol}\n📊 פעולה: ${side}\n📈 RSI: ${rsi.toFixed(2)}\n💰 מחיר: $${currentPrice}`;
                await bot.sendMessage(chatId, msg);
            }
        } catch (e) { console.log("Error: " + e.message); }
    }
    
    // אם לא מצא כלום, לפחות תדע שהוא סרק
    if (signalsFound === 0) {
        await bot.sendMessage(chatId, "🔍 הבוט סרק עכשיו את השוק ולא מצא הזדמנות, סורק שוב בעוד 30 שניות...");
    }
}

// הרצה כל 30 שניות לבדיקה
setInterval(masterTradingBot, 30000); 
masterTradingBot();