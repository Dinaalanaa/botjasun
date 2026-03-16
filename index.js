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
const BSB_MONITOR_CHANNEL = "1462330467083878430"; 

const WEATHER_API = process.env.OPENWEATHER_API_KEY;
const TOKEN = process.env.DISCORD_TOKEN;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY; 

const BSB_TOKEN = "0xdb6ba5d510f114f9b2ea08bea7d30e32eee33411";
const POLL_INTERVAL = 60_000;

const WATCH_ADDRESSES = [
  {
    address: "0xa2c7bb99d87845843a92b1b33e03b98f1f8d0247",
    label: "📦 Vesting Contract Community",
  },
  {
    address: "0x8b09599723428ee256b3f055ac85bc1adb9f28d1",
    label: "🏦 Gnosis Safe (Penerima Vesting)",
  },
  {
    address: "0xee7b429ea01f76102f053213463d4e95d5d24ae8",
    label: "🚀 Deployer BSB",
  },
];

// State simpan tx terakhir
const lastSeenTx = {};
const lastSeenTokenTx = {};
WATCH_ADDRESSES.forEach((a) => {
  lastSeenTx[a.address] = null;
  lastSeenTokenTx[a.address] = null;
});


function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatBSB(value, decimals = 18) {
  try {
    const num = BigInt(value);
    const divisor = BigInt(10 ** decimals);
    return (num / divisor).toLocaleString("id-ID") + " BSB";
  } catch {
    return value;
  }
}

async function sendBSBEmbed(embed) {
  try {
    const channel = await client.channels.fetch(BSB_MONITOR_CHANNEL);
    if (channel) await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error("❌ Gagal kirim notif BSB:", e.message);
  }
}

async function checkNormalTx(entry) {
  const addr = entry.address.toLowerCase();
  try {
    const res = await axios.get("https://api.etherscan.io/v2/api", {
      params: {
        chainid: 1,
        module: "account",
        action: "txlist",
        address: addr,
        sort: "desc",
        page: 1,
        offset: 5,
        apikey: ETHERSCAN_API_KEY,
      },
    });

    const data = res.data;
    if (data.status !== "1" || !data.result?.length) return;

    const txs = data.result;
    const latest = txs[0].hash;


    if (lastSeenTx[addr] === null) {
      lastSeenTx[addr] = latest;
      console.log(`[INIT] ${entry.label}`);
      return;
    }

    const newTxs = [];
    for (const tx of txs) {
      if (tx.hash === lastSeenTx[addr]) break;
      newTxs.push(tx);
    }
    if (!newTxs.length) return;
    lastSeenTx[addr] = txs[0].hash;

    for (const tx of newTxs.reverse()) {
      const isIn = tx.to?.toLowerCase() === addr;
      const isContractCreate = !tx.to || tx.to === "0x";
      const valueEth = (Number(tx.value) / 1e18).toFixed(4);
      const time = new Date(tx.timeStamp * 1000).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
      });

      const embed = new EmbedBuilder()
        .setColor(isContractCreate ? "#ff4444" : isIn ? "#00ff9d" : "#ffaa00")
        .setTitle(
          isContractCreate
            ? "🚨 CONTRACT BARU DI-DEPLOY!"
            : `🔔 TX Baru — ${entry.label}`
        )
        .addFields(
          { name: "📌 Address", value: entry.label, inline: false },
          {
            name: isContractCreate ? "🆕 Contract Baru" : isIn ? "📥 IN" : "📤 OUT",
            value: isContractCreate
              ? `[\`${shortAddr(tx.contractAddress)}\`](https://etherscan.io/address/${tx.contractAddress})`
              : `${valueEth} ETH`,
            inline: true,
          },
          {
            name: "👤 From",
            value: `[\`${shortAddr(tx.from)}\`](https://etherscan.io/address/${tx.from})`,
            inline: true,
          },
          {
            name: "🔗 TX",
            value: `[Lihat di Etherscan](https://etherscan.io/tx/${tx.hash})`,
            inline: false,
          },
          { name: "⏰ Waktu", value: time, inline: false }
        )
        .setFooter({ text: "BSB Monitor Bot" })
        .setTimestamp();

      if (isContractCreate) {
        embed.setDescription(
          "⚠️ Deployer BSB deploy contract baru!\nSegera cek — mungkin ini **contract distribusi community**!"
        );
      }

      await sendBSBEmbed(embed);
    }
  } catch (e) {
    console.error(`Error checkNormalTx ${entry.label}:`, e.message);
  }
}

async function checkTokenTx(entry) {
  const addr = entry.address.toLowerCase();
  try {
    const res = await axios.get("https://api.etherscan.io/v2/api", {
      params: {
        chainid: 1,
        module: "account",
        action: "tokentx",
        contractaddress: BSB_TOKEN,
        address: addr,
        sort: "desc",
        page: 1,
        offset: 5,
        apikey: ETHERSCAN_API_KEY,
      },
    });

    const data = res.data;
    if (data.status !== "1" || !data.result?.length) return;

    const txs = data.result;
    const latest = txs[0].hash;

    if (lastSeenTokenTx[addr] === null) {
      lastSeenTokenTx[addr] = latest;
      return;
    }

    const newTxs = [];
    for (const tx of txs) {
      if (tx.hash === lastSeenTokenTx[addr]) break;
      newTxs.push(tx);
    }
    if (!newTxs.length) return;
    lastSeenTokenTx[addr] = txs[0].hash;

    for (const tx of newTxs.reverse()) {
      const isIn = tx.to?.toLowerCase() === addr;
      const amount = formatBSB(tx.value, Number(tx.tokenDecimal));
      const time = new Date(tx.timeStamp * 1000).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
      });

      const embed = new EmbedBuilder()
        .setColor(isIn ? "#00ff9d" : "#ff9900")
        .setTitle(`💰 BSB Transfer — ${entry.label}`)
        .setDescription(
          isIn
            ? "📥 BSB masuk ke address ini"
            : "📤 BSB keluar dari address ini" +
              (entry.label.includes("Gnosis")
                ? "\n\n⚠️ **Kemungkinan distribusi ke community dimulai!**"
                : "")
        )
        .addFields(
          { name: isIn ? "📥 IN" : "📤 OUT", value: amount, inline: true },
          {
            name: "👤 From",
            value: `[\`${shortAddr(tx.from)}\`](https://etherscan.io/address/${tx.from})`,
            inline: true,
          },
          {
            name: "👤 To",
            value: `[\`${shortAddr(tx.to)}\`](https://etherscan.io/address/${tx.to})`,
            inline: true,
          },
          {
            name: "🔗 TX",
            value: `[Lihat di Etherscan](https://etherscan.io/tx/${tx.hash})`,
            inline: false,
          },
          { name: "⏰ Waktu", value: time, inline: false }
        )
        .setFooter({ text: "BSB Monitor Bot" })
        .setTimestamp();

      await sendBSBEmbed(embed);
    }
  } catch (e) {
    console.error(`Error checkTokenTx ${entry.label}:`, e.message);
  }
}

async function startBSBMonitor() {
  console.log("📡 BSB Monitor dimulai...");

  async function tick() {
    for (const entry of WATCH_ADDRESSES) {
      await checkNormalTx(entry);
      await checkTokenTx(entry);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  await tick();
  setInterval(tick, POLL_INTERVAL);
}
client.once("ready", async () => {
  console.log(`✅ Bot online sebagai ${client.user.tag}`);
  await startBSBMonitor();
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const msg = message.content.toLowerCase();


  if (msg.startsWith("gm")) {
  message.reply("GM, time to work 😊");
}

if (msg.startsWith("gn")) {
  message.reply("GN, Jan lupa turu !!! ☠️");
}


  if (message.channel.id === AIRDROP_CHANNEL) {
    if (msg.startsWith("#airdrop")) {
      const text = message.content.replace("#airdrop", "").trim();
      message.channel.send(
        `@everyone 🚨 **AIRDROP ALERT** 🚨\n\n${text}\n\nDYOR yaa 👀`
      );
      return;
    }
  }

  if (msg.startsWith("!cekvest")) {
    const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    const fields = WATCH_ADDRESSES.map((a) => {
      const lastTx = lastSeenTx[a.address] ?? "Belum ada tx";
      const lastToken = lastSeenTokenTx[a.address] ?? "Belum ada tx";
      return {
        name: a.label,
        value: [
          `📍 \`${a.address.slice(0, 6)}...${a.address.slice(-4)}\``,
          `🔁 Last TX: \`${lastTx !== "Belum ada tx" ? lastTx.slice(0, 10) + "..." : lastTx}\``,
          `💰 Last Token TX: \`${lastToken !== "Belum ada tx" ? lastToken.slice(0, 10) + "..." : lastToken}\``,
        ].join("\n"),
        inline: false,
      };
    });

    const embed = new EmbedBuilder()
      .setColor("#00ff9d")
      .setTitle("✅ BSB Monitor Aktif")
      .setDescription(
        `Monitor berjalan normal.\nInterval cek: **${POLL_INTERVAL / 1000} detik**\nNotif dikirim ke: <#${BSB_MONITOR_CHANNEL}>`
      )
      .addFields(fields)
      .setFooter({ text: `Dicek pada ${now}` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  
  if (msg.startsWith("!suhu")) {
    const kota = message.content.split(" ").slice(1).join(" ");
    if (!kota) return message.reply("Contoh: !suhu jakarta");
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${kota}&appid=${WEATHER_API}&units=metric&lang=id`;
      const res = await axios.get(url);
      const data = res.data;
      const embed = new EmbedBuilder()
        .setColor("#00bfff")
        .setTitle(`🌤 Cuaca di ${data.name}`)
        .setThumbnail(
          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeC1OJG1x9ZCDY8xKG-S5OLdPoZ-t1xfCxMg&s"
        )
        .addFields(
          { name: "🌡 Suhu", value: `${data.main.temp}°C`, inline: true },
          {
            name: "☁️ Cuaca",
            value: `${data.weather[0].description}`,
            inline: true,
          },
          {
            name: "💧 Kelembapan",
            value: `${data.main.humidity}%`,
            inline: true,
          },
          { name: "💨 Angin", value: `${data.wind.speed} m/s`, inline: true }
        )
        .setFooter({ text: "Data dari OpenWeather" });
      message.reply({ embeds: [embed] });
    } catch {
      message.reply("❌ Kota tidak ditemukan.");
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
      (c) => c.symbol.toLowerCase() === symbol
    );
    if (!coin) return message.reply("❌ Coin tidak ditemukan.");

    const priceData = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd`
    );
    const usdPrice = priceData.data[coin.id].usd;

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
      .setThumbnail(
        coin.large || coin.thumb
      )
      .addFields(
        { name: "USD", value: `$${totalUsd.toFixed(2)}`, inline: true },
        {
          name: "IDR",
          value: `Rp ${Math.round(totalIdr).toLocaleString("id-ID")}`,
          inline: true,
        }
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
