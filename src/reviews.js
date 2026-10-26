// Rider reviews for a station from Google Places, via the Maps JavaScript API
// (the client-side route Google supports with a referrer-restricted key).
// Reviews are opinions with no real-time guarantee; the UI labels them so.

import { googleMapsApiKey } from '../google-config.js';

export const reviewsEnabled = Boolean(googleMapsApiKey);

const FRESH_MS = 10 * 60 * 1000; // re-fetch a station's reviews after 10 minutes
const cache = new Map(); // station id → { at, data } (memory only, per Google's caching terms)
let placesLib = null;

// Words riders use when service is slow. Matched case-insensitively.
const DELAY_WORDS = /\b(delay(s|ed)?|late|wait(ed|ing)?|slow|stuck|never (came|comes|arrived)|took forever|signal problems?|no trains?|crowded|packed|skipp(ed|ing))\b/i;

function loadPlaces() {
  if (placesLib) return placesLib;
  placesLib = new Promise((resolve, reject) => {
    const cb = `__thMaps${Date.now()}`;
    window[cb] = () => {
      delete window[cb];
      google.maps.importLibrary('places').then(resolve, reject);
    };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&v=weekly&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.append(s);
  }).catch((err) => { placesLib = null; throw err; });
  return placesLib;
}

function mentionsDelay(text = '') {
  const m = text.match(DELAY_WORDS);
  return m ? m[0] : null;
}

export async function stationReviews(station) {
  const hit = cache.get(station.id);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.data;

  const { Place } = await loadPlaces();
  const { places } = await Place.searchByText({
    textQuery: `${station.name.split(' / ')[0]} subway station`,
    fields: ['id'],
    includedType: 'subway_station',
    locationBias: { center: { lat: station.lat, lng: station.lon }, radius: 400 },
    maxResultCount: 1,
  });
  if (!places?.length) {
    const data = { reviews: [], rating: null, count: 0, url: null };
    cache.set(station.id, { at: Date.now(), data });
    return data;
  }

  const place = places[0];
  await place.fetchFields({ fields: ['displayName', 'rating', 'userRatingCount', 'googleMapsURI', 'reviews'] });
  const reviews = (place.reviews || [])
    .map((r) => ({
      text: r.text || '',
      rating: r.rating,
      when: r.relativePublishTimeDescription,
      at: r.publishTime ? new Date(r.publishTime).getTime() : 0,
      author: r.authorAttribution?.displayName || 'Google user',
      authorUrl: r.authorAttribution?.uri || null,
      delayWord: mentionsDelay(r.text),
    }))
    .sort((a, b) => b.at - a.at);

  const data = {
    name: place.displayName,
    rating: place.rating ?? null,
    count: place.userRatingCount ?? 0,
    url: place.googleMapsURI || null,
    reviews,
    delayMentions: reviews.filter((r) => r.delayWord).length,
  };
  cache.set(station.id, { at: Date.now(), data });
  return data;
}
