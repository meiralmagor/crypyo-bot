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

bot.sendMessage(chatId, "🚀 מאיר, הבוט חזר למצב עבודה מקצועי!\n💰 יעד: 10$ לעסקה\n⏱️ סריקה: כל 5 דקות");

async function masterTradingBot() {
    console.log('--- סריקה מקצועית ב-Bybit ---');
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
            let winChance = 60;

            if (currentPrice > ema200 && rsi <= 40) {
                signal = "LONG 🟢";
                winChance += (rsi <= 30 ? 15 : 5);
            } else if (currentPrice < ema200 && rsi >= 60) {
                signal = "SHORT 🔴";
                winChance += (rsi >= 70 ? 15 : 5);
            }

            if (signal !== "" && winChance >= 60) {
                const targetProfit = 10; 
                const tpPercent = 0.015; 
                const amount = targetProfit / (currentPrice * tpPercent);
                const tpPrice = signal === "LONG 🟢" ? currentPrice * (1 + tpPercent) : currentPrice * (1 - tpPercent);

                const msg = `🎲 **איתות Scalping (${winChance.toFixed(0)}%)** 🎲\n\n` +
                            `🪙 מטבע: **${symbol}**\n` +
                            `📊 פעולה: **${signal}**\n` +
                            `💰 כמות לרווח 10$: **${amount.toFixed(symbol.includes('PEPE') ? 0 : 3)}**\n` +
                            `🎯 יעד (TP): $${tpPrice.toFixed(symbol.includes('PEPE') ? 8 : 4)}`;
                await bot.sendMessage(chatId, msg);
            }

            // פריצת בוקס
            if (currentPrice > boxHigh && currentVolume > avgVolume * 1.3) {
                await bot.sendMessage(chatId, `📦 **פריצת בוקס** 📦\n🚀 **${symbol}** פרץ למעלה!\n📌 מחיר: $${currentPrice}`);
            }

        } catch (e) { console.log(e.message); }
    }
}

setInterval(masterTradingBot, 300000); 
masterTradingBot();