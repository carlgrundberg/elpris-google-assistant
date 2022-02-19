import {conversation} from "@assistant/conversation";
import functions from "firebase-functions";
import dayjs from "dayjs";
import dayjsPluginUtc from "dayjs/plugin/utc.js";
import dayjsPluginTimezone from "dayjs/plugin/timezone.js";
import {nordpool} from "nordpool";

dayjs.extend(dayjsPluginUtc); // Used by timezone
dayjs.extend(dayjsPluginTimezone); // Used to convert from one timezone to another

const prices = new nordpool.Prices();
const app = conversation();

const defaultOpts = {
  area: "SE4", // See http://www.nordpoolspot.com/maps/
  currency: "SEK", // can also be 'DKK', 'EUR', 'NOK'
};

const sum = (values) => values.reduce((acc, value) => acc + value, 0);
const avg = (values) => sum(values) / values.length;

const formatPrice = (price) => `${Math.round(price / 10)} öre`;

async function getPrices(opts = {}) {
  let results = [];
  try {
    results = await prices.hourly({
      ...defaultOpts,
      ...opts,
    });
  } catch (error) {
    console.error(error);
  }
  return results;
}

function getPriceNow(prices) {
  const now = new Date();
  let current;
  for (const item of prices) {
    if (!current || new Date(item.date) < now) {
      current = item;
    }
  }
  return current?.value;
}

app.handle("price", async (conv) => {
  const prices = await getPrices();

  const priceNow = getPriceNow(prices);

  if (priceNow) {
    conv.add(`Elpriset är just nu ${formatPrice(priceNow)}.`);
    const values = prices.map((item) => item.value);
    conv.add(`Snittet idag ligger på ${formatPrice(avg(values))} och toppar på ${formatPrice(Math.max(...values))}.`);
  } else {
    conv.add("Det gick inte att hämta elpriset just nu, försök igen senare.");
  }
});

app.handle("tomorrow", async (conv) => {
  const prices = await getPrices({
    date: dayjs().add(1, "day").format(),
  });

  if (prices.length === 0) {
    conv.add("Elpriserna för imorgon har inte släppts ännu.");
    return;
  }

  const values = prices.map((item) => item.value);

  conv.add(`Imorgon ligger elpriset i snitt på ${formatPrice(avg(values))} och toppar på ${formatPrice(Math.max(...values))}.`);
});

app.handle("laundry", async (conv) => {
  const todaysPrices = await getPrices();
  const tomorrowsPrices = await getPrices({
    date: dayjs().add(1, "day").format(),
  });

  const prices =[...todaysPrices, ...tomorrowsPrices];

  const values = prices.map((item) => item.value);

  const average = avg(values);
  const priceNow = getPriceNow(prices);

  if (priceNow < average) {
    conv.add("Ja det går bra att tvätta.");
  } else {
    conv.add("Nej tyvärr är det dyrt elpris just nu.");
  }
});

export const ActionsOnGoogleFulfillment = functions.https.onRequest(app);
