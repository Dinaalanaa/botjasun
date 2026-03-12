require("dotenv").config();

const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PRICE_CHANNEL = "1481283924909887579";
const AIRDROP_CHANNEL = "1462344839742881926";

const WEATHER_API = process.env.OPENWEATHER_API_KEY;
const TOKEN = process.env.DISCORD_TOKEN;


client.once("ready", () => {
  console.log(`✅ Bot online sebagai ${client.user.tag}`);
});


client.on("messageCreate", async (message) => {

  if (message.author.bot) return;


  if (msg.startsWith("gm")) {
  message.reply("GM 😊");
  }

  const msg = message.content.toLowerCase();

  if (message.channel.id === AIRDROP_CHANNEL) {

    if (msg.startsWith("#airdrop")) {

      const text = message.content.replace("#airdrop", "").trim();

      message.channel.send(
        `@everyone 🚨 **AIRDROP ALERT** 🚨\n\n${text}\n\nDYOR yaa 👀`
      );

      return;
    }
  }

  if (msg.startsWith("!suhu")) {

    const kota = message.content.split(" ").slice(1).join(" ");

    if (!kota) {
      return message.reply("Contoh: !suhu jakarta");
    }

    try {

      const url = `https://api.openweathermap.org/data/2.5/weather?q=${kota}&appid=${WEATHER_API}&units=metric&lang=id`;

      const res = await axios.get(url);
      const data = res.data;

      const embed = new EmbedBuilder()
        .setColor("#00bfff")
        .setTitle(`🌤 Cuaca di ${data.name}`)
        .setThumbnail("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeC1OJG1x9ZCDY8xKG-S5OLdPoZ-t1xfCxMg&s")
        .addFields(
          { name: "🌡 Suhu", value: `${data.main.temp}°C`, inline: true },
          { name: "☁️ Cuaca", value: `${data.weather[0].description}`, inline: true },
          { name: "💧 Kelembapan", value: `${data.main.humidity}%`, inline: true },
          { name: "💨 Angin", value: `${data.wind.speed} m/s`, inline: true }
        )
        .setFooter({ text: "Data dari OpenWeather" });

      message.reply({ embeds: [embed] });

    } catch (err) {
      message.reply("❌ Kota tidak ditemukan.");
      console.log(err);
    }
  }

  if (message.channel.id !== PRICE_CHANNEL) return;

  const match = msg.match(/(\d+(\.\d+)?)\s*([a-z]+)/);

  if (!match) return;

  const amount = parseFloat(match[1]);
  const symbol = match[3];

  try {

    const search = await axios.get(
      `https://api.coingecko.com/api/v3/search?query=${symbol}`
    );

    const coin = search.data.coins.find(
      c => c.symbol.toLowerCase() === symbol
    );

    if (!coin) {
      return message.reply("❌ Coin tidak ditemukan.");
    }

    const coinId = coin.id;

    const priceData = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );

    const usdPrice = priceData.data[coinId].usd;

    const rate = await axios.get(
      "https://api.frankfurter.app/latest?from=USD&to=IDR"
    );

    const usdToIdr = rate.data.rates.IDR;

    const totalUsd = amount * usdPrice;
    const totalIdr = totalUsd * usdToIdr;

    const embed = new EmbedBuilder()
      .setColor("#00ff9d")
      .setTitle(`💰 Konversi ${symbol.toUpperCase()}`)
      .setDescription(`Konversi **${amount} ${symbol.toUpperCase()} → IDR**`)
      .setThumbnail("https://play-lh.googleusercontent.com/2wCIQWu9gHP2vp2cvhJEcFw2ys7uuZV2wL0qZrENyE-iOEzYJHcdLHChr2lQ7R3YxYQ")
      .addFields(
        { name: "USD", value: `$${totalUsd.toFixed(2)}`, inline: true },
        { name: "IDR", value: `Rp ${Math.round(totalIdr).toLocaleString("id-ID")}`, inline: true }
      )
      .setFooter({ text: "Crypto Price Bot" })
      .setTimestamp();

    message.reply({ embeds: [embed] });

  } catch (err) {
    console.log(err);
  }

});


process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);


client.login(TOKEN);

process.on("unhandledRejection", console.error);

process.on("uncaughtException", console.error);

