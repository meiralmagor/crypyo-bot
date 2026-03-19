require('dotenv').config();
// שרת קטן כדי ש-Render לא יכבה את הבוט
const http = require('http');
http.createServer((req, res) => {
  res.write('Bot is Running!');
  res.end();
}).listen(process.env.PORT || 3000);

const TelegramBot = require('node-telegram-bot-api');
const ccxt = require('ccxt');
const { RSI } = require('technicalindicators');
const axios = require('axios');

// --- הגדרות חיבור ישירות (כדי למנוע תקלות בענן) ---
const token = '8207677885:AAFxWZHismMi_pLgNlyV1CX8q_rwZF2l78k';
const chatId = '1153254394';
// ------------------------------------------------

const bot = new TelegramBot(token, { polling: false });
const exchange = new ccxt.binance();

const watchlist = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];

// הודעת פתיחה כדי שנדע שהבוט עלה בהצלחה
bot.sendMessage(chatId, "🚀 מאיר, הבוט רץ עכשיו מהענן ומחובר לבורסה!");

// פונקציה לסריקת חדשות בזמן אמת
async function getNewsSentiment() {
    try {
        const response = await axios.get('https://cryptopanic.com/api/v1/posts/?auth_token=wlkH1JdX7Rtn8BOklWBTZT3dWrLk29YS&public=true');
        const news = response.data.results;
        
        const positiveWords = ['bullish', 'launch', 'buy', 'pump', 'adoption', 'ETF', 'approved', 'moon'];
        const negativeWords = ['bearish', 'hack', 'sell', 'dump', 'ban', 'scam', 'crash', 'lawsuit', 'drop'];
        
        let score = 50; 
        news.slice(0, 10).forEach(post => {
            const title = post.title.toLowerCase();
            positiveWords.forEach(word => { if(title.includes(word)) score += 5; });
            negativeWords.forEach(word => { if(title.includes(word)) score -= 5; });
        });
        return score;
    } catch (e) {
        return 50; 
    }
}

async function masterTradingBot() {
    console.log('--- סריקה משולבת: ' + new Date().toLocaleTimeString() + ' ---');
    const sentiment = await getNewsSentiment();
    
    for (const symbol of watchlist) {
        try {
            const ohlcv = await exchange.fetchOHLCV(symbol, '5m', undefined, 50);
            const closes = ohlcv.map(val => val[4]);
            const currentPrice = closes[closes.length - 1];
            const rsiValues = RSI.calculate({ values: closes, period: 14 });
            const rsi = rsiValues[rsiValues.length - 1];

            let signal = "";
            let strength = "";

            if (rsi <= 30 && sentiment > 55) {
                signal = "LONG 🟢";
                strength = "חזק (שילוב טכני + חדשות טובות)";
            } else if (rsi >= 70 && sentiment < 45) {
                signal = "SHORT 🔴";
                strength = "חזק (שילוב טכני + חדשות רעות)";
            } else if (rsi <= 25) {
                signal = "LONG 🟡";
                strength = "בינוני (טכני בלבד - מכירות יתר)";
            } else if (rsi >= 75) {
                signal = "SHORT 🟠";
                strength = "בינוני (טכני בלבד - קניות יתר)";
            }

            if (signal !== "") {
                const tp = signal.includes("LONG") ? currentPrice * 1.015 : currentPrice * 0.985;
                const sl = signal.includes("LONG") ? currentPrice * 0.99 : currentPrice * 1.01;

                const msg = `💎 **איתות VIP משולב** 💎\n\n` +
                            `🪙 מטבע: ${symbol}\n` +
                            `📊 פעולה: **${signal}**\n` +
                            `🔥 עוצמה: ${strength}\n` +
                            `💰 כניסה: $${currentPrice}\n` +
                            `🗞️ סנטימנט חדשות: ${sentiment}/100\n\n` +
                            `🎯 **ניהול עסקה:**\n` +
                            `✅ יעד רווח: $${tp.toFixed(2)}\n` +
                            `🛑 סטופ לוס: $${sl.toFixed(2)}`;
                
                await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
            }
        } catch (e) { console.error("Error on " + symbol + ": " + e.message); }
    }
}

// הפעלה ראשונית וקביעת מרווח זמן (כל 5 דקות)
setInterval(masterTradingBot, 300000); 
masterTradingBot();