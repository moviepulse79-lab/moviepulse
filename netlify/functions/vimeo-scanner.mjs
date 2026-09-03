```js
const SCANNER_VERSION = "10.1-stable";

const SEARCHES = [
  "full movie",
  "full film",
  "feature film",
  "full feature film",
  "free movie",
  "free film",
  "full documentary"
];

const MIN_DURATION = 40 * 60;
const MAX_DURATION = 5 * 60 * 60;

const BLOCKED = [
  "trailer",
  "teaser",
  "clip",
  "interview",
  "preview",
  "promo",
  "behind the scenes",
  "making of",
  "music video",
  "commercial",
  "showreel"
];

const FREE = [
  "free to watch",
  "free to view",
  "watch for free",
  "watch it free",
  "full movie free",
  "full film free",
  "feature film free",
  "free online",
  "available for free",
  "available to watch for free",
  "movie is free",
  "film is free",
  "this movie is free",
  "this film is free",
  "free because",
  "free on vimeo",
  "watch free on vimeo",
  "made available for free",
  "share this for free",
  "available on vimeo for free"
];

const LICENSE = [
  "creative commons",
  "creativecommons",
  "cc by",
  "cc-by",
  "cc by-sa",
  "cc-by-sa",
  "cc by-nc",
  "cc-by-nc",
  "cc by-nd",
  "cc-by-nd",
  "public domain",
  "licensed under",
  "released under",
  "with permission",
  "permission to share",
  "permission to distribute"
];

const OWNERSHIP = [
  "produced by",
  "directed by",
  "written by",
  "created by",
  "our film",
  "our movie",
  "our documentary",
  "my film",
  "my movie",
  "my documentary",
  "filmmaker",
  "filmmakers",
  "independent filmmaker",
  "independent filmmakers"
];

const COPYRIGHT = [
  "netflix",
  "disney+",
  "warner bros",
  "warner brothers",
  "universal pictures",
  "paramount pictures",
  "sony pictures",
  "lionsgate",
  "20th century fox",
  "20th century studios",
  "hbo",
  "amazon studios",
  "prime video",
  "apple tv+",
  "mgm",
  "a24",
  "focus features",
  "miramax",
  "new line cinema",
  "columbia pictures",
  "dreamworks"
];

export default async () => {

  try {

    const token = process.env.VIMEO_ACCESS_TOKEN;

    if (!token) {
      return response({
        success: false,
        error: "VIMEO_ACCESS_TOKEN is missing"
      }, 500);
    }

    const movies = [];
    const reviewMovies = [];
    const seen = new Set();

    const stats = {
      searches: 0,
      searchResults: 0,
      duplicates: 0,
      tooShort: 0,
      tooLong: 0,
      blocked: 0,
      noPoster: 0,
      approved: 0,
      review: 0,
      rejected: 0,
      rateLimited: 0
    };

    for (const search of SEARCHES) {

      stats.searches++;

      const url =
        "https://api.vimeo.com/videos" +
        "?query=" + encodeURIComponent(search) +
        "&per_page=25" +
        "&sort=relevant";

      const result = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.vimeo.*+json;version=3.4"
        }
      });

      if (result.status === 429) {
        stats.rateLimited++;
        continue;
      }

      if (!result.ok) {
        console.log(
          "Vimeo error:",
          search,
          result.status
        );
        continue;
      }

      const data = await result.json();

      for (const video of data.data || []) {

        stats.searchResults++;

        const id =
          video.uri?.split("/").pop();

        if (!id) continue;

        if (seen.has(id)) {
          stats.duplicates++;
          continue;
        }

        seen.add(id);

        const title =
          String(video.name || "").trim();

        const description =
          String(video.description || "").trim();

        const text =
          `${title} ${description}`.toLowerCase();

        const duration =
          Number(video.duration || 0);

        if (duration < MIN_DURATION) {
          stats.tooShort++;
          stats.rejected++;
          continue;
        }

        if (duration > MAX_DURATION) {
          stats.tooLong++;
          stats.rejected++;
          continue;
        }

        if (
          BLOCKED.some(word =>
            text.includes(word)
          )
        ) {
          stats.blocked++;
          stats.rejected++;
          continue;
        }

        const pictures =
          video.pictures?.sizes || [];

        const poster =
          pictures.length
            ? pictures[pictures.length - 1]?.link
            : "";

        if (!poster) {
          stats.noPoster++;
          stats.rejected++;
          continue;
        }

        const movieSignal =
          /full movie|full film|feature film|full feature|full-length|full length|complete film|complete movie|documentary/i
            .test(text);

        if (!movieSignal) {
          stats.rejected++;
          continue;
        }

        const freeMatches =
          FREE.filter(x =>
            text.includes(x)
          );

        const licenseMatches =
          LICENSE.filter(x =>
            text.includes(x)
          );

        const ownershipMatches =
          OWNERSHIP.filter(x =>
            text.includes(x)
          );

        const copyrightMatches =
          COPYRIGHT.filter(x =>
            text.includes(x)
          );

        let score = 0;

        if (freeMatches.length) {
          score += 6;
        }

        if (licenseMatches.length) {
          score += 7;
        }

        if (ownershipMatches.length) {
          score += 2;
        }

        if (duration >= 60 * 60) {
          score += 1;
        }

        if (copyrightMatches.length) {
          score -= 10;
        }

        const hasFree =
          freeMatches.length > 0;

        const hasLicense =
          licenseMatches.length > 0;

        const hasOwnership =
          ownershipMatches.length > 0;

        let rightsStatus = "REVIEW";

        if (
          copyrightMatches.length === 0 &&
          (
            hasLicense ||
            (hasFree && hasOwnership) ||
            (hasFree && score >= 7)
          )
        ) {
          rightsStatus = "APPROVED";
        }

        const movie = {
          id: `vimeo-${id}`,
          title,
          year: video.release_time
            ? new Date(video.release_time).getFullYear()
            : null,
          duration,
          durationText: formatDuration(duration),
          poster,
          description,
          vimeoId: id,
          vimeoUrl: video.link,
          playerUrl:
            `https://player.vimeo.com/video/${id}`,
          categories:
            (video.categories || [])
              .map(x => x.name)
              .filter(Boolean),
          source: "Vimeo",
          rightsStatus,
          rightsScore: score,
          embedStatus: "NOT_TESTED",
          rightsEvidence: {
            free: freeMatches,
            license: licenseMatches,
            ownership: ownershipMatches,
            copyrightRisk: copyrightMatches
          }
        };

        if (rightsStatus === "APPROVED") {
          movies.push(movie);
          stats.approved++;
        } else {
          reviewMovies.push(movie);
          stats.review++;
        }

      }

      // Small delay between searches
      await sleep(1200);
    }

    movies.sort((a, b) =>
      b.rightsScore - a.rightsScore
    );

    reviewMovies.sort((a, b) =>
      b.rightsScore - a.rightsScore
    );

    return response({
      success: true,
      scannerVersion: SCANNER_VERSION,
      count: movies.length,
      movies,
      reviewCount: reviewMovies.length,
      reviewMovies,
      stats
    });

  } catch (error) {

    console.error(
      "Vimeo scanner crashed:",
      error
    );

    return response({
      success: false,
      scannerVersion: SCANNER_VERSION,
      error: error?.message || String(error)
    }, 500);

  }

};

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

function formatDuration(seconds) {

  const minutes =
    Math.floor(seconds / 60);

  const hours =
    Math.floor(minutes / 60);

  const remaining =
    minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remaining}min`;
  }

  return `${minutes}min`;
}

function response(data, status = 200) {

  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600"
      }
    }
  );
}
```
