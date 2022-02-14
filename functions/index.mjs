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

const opts = {
  area: "SE4", // See http://www.nordpoolspot.com/maps/
  currency: "SEK", // can also be 'DKK', 'EUR', 'NOK'
};

const sum = (values) => values.reduce((acc, value) => acc + value, 0);
const avg = (values) => sum(values) / values.length;

const formatPrice = (price) => `${Math.round(price / 10)} öre`;

const getPriceNow = async () => {
  let results;
  try {
    results = await prices.hourly(opts);
  } catch (error) {
    console.error(error);
    return "Det gick inte att hämta elpriset just nu, försök igen senare.";
  }

  const now = new Date();
  let current;
  for (const item of results) {
    if (!current || new Date(item.date) < now) {
      current = item;
    }
  }

  return `Elpriset är just nu ${formatPrice(current.value)}.`;
};

const getPriceTomorrow = async () => {
  let results;
  try {
    results = await prices.hourly({
      ...opts,
      date: dayjs().add(1, "day").format(),
    });
  } catch (error) {
    console.error(error);
    return "";
  }

  if (results.length === 0) {
    return "Elpriserna för imorgon har inte släppts ännu.";
  }

  const values = results.map((item) => item.value);

  return `Imorgon ligger elpriset i snitt på ${formatPrice(avg(values))} och toppar på ${formatPrice(Math.max(...values))}.`;
};

app.handle("price", async (conv) => {
  conv.add(await getPriceNow());
  conv.add(await getPriceTomorrow());
});

export const ActionsOnGoogleFulfillment = functions.https.onRequest(app);
