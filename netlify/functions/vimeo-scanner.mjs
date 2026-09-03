const VERSION = "10.2-stable";

const SEARCHES = [
  "full movie",
  "full film",
  "feature film",
  "full feature film",
  "independent feature film",
  "free movie",
  "free film",
  "free feature film",
  "watch full movie",
  "watch full film",
  "full documentary",
  "feature documentary"
];

const MIN_DURATION = 40 * 60;
const MAX_DURATION = 5 * 60 * 60;

const BLOCKED = [
  "trailer",
  "teaser",
  "movie clip",
  "film clip",
  "scene from",
  "deleted scene",
  "behind the scenes",
  "behind-the-scenes",
  "interview",
  "preview",
  "promo",
  "promotional",
  "making of",
  "making-of",
  "showreel",
  "sizzle reel",
  "highlight reel",
  "music video",
  "concert",
  "podcast",
  "web series",
  "commercial",
  "advertisement"
];

const BLOCKED_CATEGORIES = [
  "Sports",
  "Music",
  "Gaming"
];

const MOVIE_SIGNALS = [
  "full movie",
  "full film",
  "feature film",
  "feature movie",
  "full feature",
  "full-length",
  "full length",
  "complete film",
  "complete movie",
  "feature documentary",
  "full documentary",
  "documentary film",
  "independent film",
  "independent feature"
];

const FREE_SIGNALS = [
  "free to watch",
  "free to view",
  "watch for free",
  "watch it free",
  "watch this for free",
  "full movie free",
  "full film free",
  "feature film free",
  "available for free",
  "available to watch for free",
  "available free online",
  "free online",
  "completely free",
  "entire movie free",
  "entire film free",
  "movie is free",
  "film is free",
  "this movie is free",
  "this film is free",
  "the movie is free",
  "the film is free",
  "free because",
  "free of charge",
  "no charge to watch",
  "watch at no cost",
  "free on vimeo",
  "free to watch on vimeo",
  "available free on vimeo",
  "available on vimeo for free",
  "share this for free",
  "sharing this for free",
  "made available for free",
  "made available to watch for free",
  "now available for free",
  "now available to watch for free"
];

const LICENSE_SIGNALS = [
  "creative commons",
  "creativecommons",
  "public domain",
  "public-domain",
  "cc by",
  "cc-by",
  "cc by-sa",
  "cc-by-sa",
  "cc by-nd",
  "cc-by-nd",
  "cc by-nc",
  "cc-by-nc",
  "cc by-nc-nd",
  "cc-by-nc-nd",
  "licensed under",
  "released under",
  "released with permission",
  "with permission",
  "permission to share",
  "permission to distribute",
  "permission granted",
  "licensed for distribution",
  "licensed for online viewing"
];

const OWNERSHIP_SIGNALS = [
  "produced by",
  "directed by",
  "written by",
  "written and directed by",
  "written & directed by",
  "created by",
  "our film",
  "our feature",
  "our documentary",
  "our movie",
  "my film",
  "my feature",
  "my documentary",
  "my movie",
  "official film",
  "official feature",
  "official documentary",
  "filmmaker",
  "filmmakers",
  "independent filmmaker",
  "independent filmmakers",
  "production company"
];

const COPYRIGHT_RISK = [
  "netflix",
  "disney+",
  "disney",
  "warner bros",
  "warner brothers",
  "universal pictures",
  "paramount pictures",
  "sony pictures",
  "lionsgate",
  "20th century studios",
  "20th century fox",
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
  "dreamworks",
  "hallmark",
  "hulu"
];

export default async function handler(req, context) {

  const token = process.env.VIMEO_ACCESS_TOKEN;

  if (!token) {
    return jsonResponse(
      {
        success: false,
        scannerVersion: VERSION,
        error: "VIMEO_ACCESS_TOKEN is missing"
      },
      500
    );
  }

  const approved = [];
  const review = [];
  const seen = new Set();

  const stats = {
    searches: 0,
    searchResults: 0,
    duplicates: 0,
    tooShort: 0,
    tooLong: 0,
    blockedWords: 0,
    blockedCategories: 0,
    notMovie: 0,
    noPoster: 0,
    noVimeoLink: 0,
    copyrightRisk: 0,
    approved: 0,
    review: 0,
    rejected: 0,
    rateLimited: 0,
    errors: 0
  };

  try {

    for (const search of SEARCHES) {

      stats.searches++;

      const url =
        "https://api.vimeo.com/videos" +
        "?query=" +
        encodeURIComponent(search) +
        "&per_page=25" +
        "&sort=relevant";

      const result = await requestVimeo(url, token);

      if (result.rateLimited) {

        stats.rateLimited++;

        await sleep(5000);

        continue;
      }

      if (!result.ok) {

        console.log(
          "Vimeo API error:",
          search,
          result.status
        );

        stats.errors++;

        continue;
      }

      const videos =
        Array.isArray(result.data?.data)
          ? result.data.data
          : [];

      for (const video of videos) {

        stats.searchResults++;

        const uri =
          typeof video.uri === "string"
            ? video.uri
            : "";

        const videoId =
          uri.split("/").pop();

        if (!videoId) {
          stats.rejected++;
          continue;
        }

        if (seen.has(videoId)) {
          stats.duplicates++;
          continue;
        }

        seen.add(videoId);

        const title =
          String(video.name || "").trim();

        const description =
          String(video.description || "").trim();

        const text =
          (
            title +
            " " +
            description
          ).toLowerCase();

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

        const blockedMatch =
          BLOCKED.find(word =>
            hasPhrase(text, word)
          );

        if (blockedMatch) {
          stats.blockedWords++;
          stats.rejected++;
          continue;
        }

        const categories =
          Array.isArray(video.categories)
            ? video.categories
                .map(category =>
                  String(category?.name || "").trim()
                )
                .filter(Boolean)
            : [];

        const blockedCategory =
          categories.find(category =>
            BLOCKED_CATEGORIES.some(
              blocked =>
                category.toLowerCase() ===
                blocked.toLowerCase()
            )
          );

        if (blockedCategory) {
          stats.blockedCategories++;
          stats.rejected++;
          continue;
        }

        let poster = "";

        const pictures =
          Array.isArray(video.pictures?.sizes)
            ? video.pictures.sizes
            : [];

        if (pictures.length > 0) {

          const sorted =
            [...pictures].sort(
              (a, b) =>
                Number(b.width || 0) -
                Number(a.width || 0)
            );

          poster =
            sorted[0]?.link || "";
        }

        if (!poster) {
          stats.noPoster++;
          stats.rejected++;
          continue;
        }

        const vimeoUrl =
          typeof video.link === "string"
            ? video.link
            : "";

        if (!vimeoUrl) {
          stats.noVimeoLink++;
          stats.rejected++;
          continue;
        }

        const movieMatches =
          findMatches(
            text,
            MOVIE_SIGNALS
          );

        const hasMovieSignal =
          movieMatches.length > 0 ||
          categories.some(category =>
            /film|movie|documentary/i.test(category)
          );

        if (!hasMovieSignal) {
          stats.notMovie++;
          stats.rejected++;
          continue;
        }

        const freeMatches =
          findMatches(
            text,
            FREE_SIGNALS
          );

        const licenseMatches =
          findMatches(
            text,
            LICENSE_SIGNALS
          );

        const ownershipMatches =
          findMatches(
            text,
            OWNERSHIP_SIGNALS
          );

        const copyrightMatches =
          findMatches(
            text,
            COPYRIGHT_RISK
          );

        if (copyrightMatches.length) {
          stats.copyrightRisk++;
        }

        let score = 0;

        if (movieMatches.length) {
          score += 3;
        }

        if (duration >= 60 * 60) {
          score += 1;
        }

        if (freeMatches.length >= 1) {
          score += 6;
        }

        if (freeMatches.length >= 2) {
          score += 2;
        }

        if (licenseMatches.length >= 1) {
          score += 7;
        }

        if (licenseMatches.length >= 2) {
          score += 2;
        }

        if (ownershipMatches.length >= 1) {
          score += 2;
        }

        if (ownershipMatches.length >= 2) {
          score += 1;
        }

        if (
          licenseMatches.some(match =>
            /creative commons|public domain|cc by/i.test(match)
          )
        ) {
          score += 3;
        }

        if (copyrightMatches.length) {
          score -= 10;
        }

        let rightsStatus = "REVIEW";

        const freeEvidence =
          freeMatches.length > 0;

        const licenseEvidence =
          licenseMatches.length > 0;

        const ownershipEvidence =
          ownershipMatches.length > 0;

        if (
          copyrightMatches.length === 0 &&
          (
            licenseEvidence ||
            (
              freeEvidence &&
              ownershipEvidence
            ) ||
            (
              freeEvidence &&
              score >= 9
            )
          )
        ) {
          rightsStatus = "APPROVED";
        }

        if (copyrightMatches.length > 0) {
          rightsStatus = "REVIEW";
        }

        let year = null;

        if (video.release_time) {

          const date =
            new Date(video.release_time);

          if (!Number.isNaN(date.getTime())) {
            year = date.getFullYear();
          }
        }

        const movie = {

          id: "vimeo-" + videoId,

          title,

          year,

          duration,

          durationText:
            formatDuration(duration),

          poster,

          description,

          vimeoId:
            videoId,

          vimeoUrl,

          playerUrl:
            "https://player.vimeo.com/video/" +
            videoId,

          categories,

          source: "Vimeo",

          rightsStatus,

          rightsScore: score,

          embedStatus:
            "NOT_TESTED",

          rightsEvidence: {

            free:
              freeMatches,

            license:
              licenseMatches,

            ownership:
              ownershipMatches,

            copyrightRisk:
              copyrightMatches

          }

        };

        if (rightsStatus === "APPROVED") {

          approved.push(movie);
          stats.approved++;

        } else {

          review.push(movie);
          stats.review++;

        }

      }

      await sleep(1800);
    }

    approved.sort(
      (a, b) =>
        b.rightsScore -
        a.rightsScore
    );

    review.sort(
      (a, b) =>
        b.rightsScore -
        a.rightsScore
    );

    return jsonResponse({

      success: true,

      scannerVersion:
        VERSION,

      count:
        approved.length,

      movies:
        approved,

      reviewCount:
        review.length,

      reviewMovies:
        review,

      stats

    });

  } catch (error) {

    console.error(
      "SCANNER CRASH:",
      error
    );

    return jsonResponse(
      {
        success: false,

        scannerVersion:
          VERSION,

        error:
          error?.message ||
          String(error)
      },
      500
    );
  }
}


/* =========================
   VIMEO REQUEST
========================= */

async function requestVimeo(url, token) {

  try {

    const res =
      await fetch(url, {

        method: "GET",

        headers: {
          Authorization:
            "Bearer " + token,

          Accept:
            "application/vnd.vimeo.*+json;version=3.4"
        }

      });

    if (res.status === 429) {

      return {
        ok: false,
        rateLimited: true,
        status: 429,
        data: null
      };
    }

    let data = null;

    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return {
      ok: res.ok,
      rateLimited: false,
      status: res.status,
      data
    };

  } catch (error) {

    console.error(
      "FETCH ERROR:",
      error
    );

    return {
      ok: false,
      rateLimited: false,
      status: 0,
      data: null
    };
  }
}


/* =========================
   PHRASE MATCHING
========================= */

function hasPhrase(text, phrase) {

  const escaped =
    phrase
      .replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )
      .replace(
        /\s+/g,
        "\\s+"
      );

  const regex =
    new RegExp(
      "(^|[^a-z0-9+])" +
      escaped +
      "([^a-z0-9+]|$)",
      "i"
    );

  return regex.test(text);
}


function findMatches(text, list) {

  return list.filter(
    phrase =>
      hasPhrase(
        text,
        phrase
      )
  );
}


/* =========================
   DURATION
========================= */

function formatDuration(seconds) {

  const minutes =
    Math.floor(seconds / 60);

  const hours =
    Math.floor(minutes / 60);

  const remaining =
    minutes % 60;

  if (hours > 0) {

    return (
      hours +
      "h " +
      remaining +
      "min"
    );

  }

  return remaining + "min";
}


/* =========================
   DELAY
========================= */

function sleep(ms) {

  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


/* =========================
   NETLIFY RESPONSE
========================= */

function jsonResponse(data, status = 200) {

  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status,

      headers: {
        "Content-Type":
          "application/json",

        "Cache-Control":
          "public, max-age=3600"
      }
    }
  );
}
