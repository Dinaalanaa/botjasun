require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PRICE_CHANNEL = "1481283924909887579";
const AIRDROP_CHANNEL = "1462344839742881926";
const WEATHER_API = process.env.OPENWEATHER_API_KEY;
const TOKEN = process.env.DISCORD_TOKEN;

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const msg = message.content.toLowerCase().trim();

  // ── Greetings (any channel) ──────────────────────────────────────────────
  if (msg.startsWith("gm")) return message.reply("GM, time to work 😊");
  if (msg.startsWith("gn")) return message.reply("GN, Jan lupa turu !!! ☠️");

  // ── !suhu command (any channel) ──────────────────────────────────────────
  if (msg.startsWith("!suhu")) {
    const kota = message.content.split(" ").slice(1).join(" ").trim();
    if (!kota) return message.reply("Contoh: !suhu jakarta");

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(kota)}&appid=${WEATHER_API}&units=metric&lang=id`;
      const res = await axios.get(url);
      const data = res.data;

      const embed = new EmbedBuilder()
        .setColor("#00bfff")
        .setTitle(`🌤 Cuaca di ${data.name}`)
        .setThumbnail(
          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeC1OJG1x9ZCDY8xKG-S5OLdPoZ-t1xfCxMg&s"
        )
        .addFields(
          { name: "🌡 Suhu",      value: `${data.main.temp}°C`,               inline: true },
          { name: "☁️ Cuaca",     value: data.weather[0].description,         inline: true },
          { name: "💧 Kelembapan",value: `${data.main.humidity}%`,            inline: true },
          { name: "💨 Angin",     value: `${data.wind.speed} m/s`,            inline: true }
        )
        .setFooter({ text: "Data dari OpenWeather" });

      return message.reply({ embeds: [embed] });
    } catch {
      return message.reply("❌ Kota tidak ditemukan.");
    }
  }

  // ── Crypto price (PRICE_CHANNEL only) ───────────────────────────────────
  if (message.channel.id !== PRICE_CHANNEL) return;

  // Must start with a number, e.g. "10 btc" or "0.5eth"
  const match = msg.match(/^(\d+(\.\d+)?)\s*([a-z]+)/);
  if (!match) return;

  const amount = parseFloat(match[1]);
  const symbol = match[3];

  try {
    const search = await axios.get(
      `https://api.coingecko.com/api/v3/search?query=${symbol}`
    );
    const coin = search.data.coins.find(
      (c) => c.symbol.toLowerCase() === symbol
    );
    if (!coin) return message.reply("❌ Coin tidak ditemukan.");

    const [priceRes, rateRes] = await Promise.all([
      axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd`
      ),
      axios.get("https://api.frankfurter.app/latest?from=USD&to=IDR"),
    ]);

    const usdPrice  = priceRes.data[coin.id].usd;
    const usdToIdr  = rateRes.data.rates.IDR;
    const totalUsd  = amount * usdPrice;
    const totalIdr  = totalUsd * usdToIdr;

    const embed = new EmbedBuilder()
      .setColor("#00ff9d")
      .setTitle(`💰 Konversi ${symbol.toUpperCase()}`)
      .setDescription(`Konversi **${amount} ${symbol.toUpperCase()} → IDR**`)
      .setThumbnail(coin.large || coin.thumb)
      .addFields(
        { name: "USD", value: `$${totalUsd.toFixed(2)}`,                                  inline: true },
        { name: "IDR", value: `Rp ${Math.round(totalIdr).toLocaleString("id-ID")}`,       inline: true }
      )
      .setFooter({ text: "Crypto Price Bot" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  } catch (err) {
    console.error("Crypto lookup error:", err.message);
    return message.reply("❌ Gagal mengambil data harga.");
  }
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
