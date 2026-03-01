let ratesCache = { rates: {}, fetchedAt: null };

export async function getExchangeRates() {
  const now = Date.now();
  if (ratesCache.fetchedAt && now - ratesCache.fetchedAt < 60 * 60 * 1000) {
    return ratesCache.rates;
  }

  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    if (!apiKey || apiKey === 'your-exchangerate-api-key') {
      return getDefaultRates();
    }

    const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`);
    const data = await res.json();

    if (data.result === 'success') {
      ratesCache = { rates: data.conversion_rates, fetchedAt: now };
      return ratesCache.rates;
    }
    return getDefaultRates();
  } catch (err) {
    console.error('Currency fetch error:', err.message);
    return getDefaultRates();
  }
}

export async function getExchangeRate(currency) {
  if (currency === 'USD') return 1;
  const rates = await getExchangeRates();
  return rates[currency] || 1;
}

function getDefaultRates() {
  return {
    USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, CAD: 1.36,
    AUD: 1.53, CHF: 0.88, CNY: 7.24, INR: 83.1, MXN: 17.1,
    BRL: 4.97, KRW: 1325, SGD: 1.34, HKD: 7.82, SEK: 10.4,
    NOK: 10.5, DKK: 6.89, NZD: 1.63, ZAR: 18.6, RUB: 90.1,
    TRY: 30.5, AED: 3.67, SAR: 3.75, THB: 35.1, IDR: 15600,
  };
}
