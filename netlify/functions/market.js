// netlify/functions/market.js
// Looks up current listings and returns a median "Estimated Market" price.
// Works even if you haven't added an API key yet (then it just returns ok:false).

exports.handler = async function(event) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  try {
    const p = event.queryStringParameters || {};
    const year = p.year, make = p.make, model = p.model, zip = p.zip || '32806', radius = p.radius || '250';

    if (!year || !make || !model) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:'Missing year/make/model' }) };
    }

    const API_KEY = process.env.MARKETCHECK_API_KEY;
    if (!API_KEY) {
      // No key set yet? Return ok:false. The page will simply skip the market line.
      return { statusCode: 200, headers, body: JSON.stringify({ ok:false, reason:'no_api_key' }) };
    }

    // Ask MarketCheck for active listings (up to 50 around the ZIP)
    const base = 'https://marketcheck-prod.apigee.net/v2/search/car/active';
    const url = new URL(base);
    url.searchParams.set('api_key', API_KEY);
    url.searchParams.set('year', String(year));
    url.searchParams.set('make', make);
    url.searchParams.set('model', model);
    url.searchParams.set('zip', zip);
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('rows', '50');

    const res = await fetch(url.toString());
    if (!res.ok) {
      return { statusCode: res.status, headers, body: JSON.stringify({ ok:false, error:'upstream_error' }) };
    }
    const data = await res.json();

    const prices = (data.listings || [])
      .map(x => (x && typeof x.price === 'number') ? x.price : null)
      .filter(n => typeof n === 'number' && n > 0)
      .sort((a,b)=>a-b);

    if (!prices.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok:true, median:null, samples:0 }) };
    }

    const mid = Math.floor(prices.length / 2);
    const median = prices.length % 2 ? prices[mid] : Math.round((prices[mid-1] + prices[mid]) / 2);

    return { statusCode: 200, headers, body: JSON.stringify({ ok:true, median, samples: prices.length }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok:false, error:'server_error' }) };
  }
};
