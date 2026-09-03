const SCANNER_VERSION = "10.0-smart-movie-detector";

const SEARCHES = [
  "full movie",
  "full film",
  "feature film",
  "full feature film",
  "independent feature",
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

/* =========================
   DEFINITE NON-MOVIE SIGNALS
========================= */

const BLOCKED_WORDS = [
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
  "episode",
  "web series",
  "commercial",
  "advertisement",
  "advertising"
];

const BLOCKED_CATEGORIES = [
  "Sports",
  "Music",
  "Gaming"
];

/* =========================
   FREE / LEGAL SIGNALS

   These are evidence signals,
   not a legal guarantee.
========================= */

const FREE_PHRASES = [
  "free to watch",
  "free to view",
  "watch for free",
  "watch it free",
  "watch this for free",
  "watch the full movie free",
  "watch the full film free",
  "watch full movie free",
  "watch full film free",
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

const LICENSE_PHRASES = [
  "creative commons",
  "creativecommons",
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
  "public domain",
  "public-domain",
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

const OWNERSHIP_PHRASES = [
  "written and directed by",
  "written & directed by",
  "directed by",
  "produced by",
  "produced and directed by",
  "created by",
  "our film",
  "our feature",
  "our documentary",
  "my film",
  "my feature",
  "my documentary",
  "our movie",
  "my movie",
  "official film",
  "official feature",
  "official documentary",
  "from the filmmakers",
  "from the filmmaker",
  "from the director",
  "filmmaker",
  "filmmakers",
  "production company",
  "independent filmmaker",
  "independent filmmakers"
];

/* =========================
   STRONG COPYRIGHT RISK

   IMPORTANT:
   Use word boundaries so
   "both" doesn't trigger HBO.
========================= */

const COPYRIGHT_RISK_WORDS = [
  "netflix",
  "disney",
  "disney+",
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

/* =========================
   MOVIE SIGNALS
========================= */

const MOVIE_TITLE_SIGNALS = [
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
  "indie film"
];

const MOVIE_DESCRIPTION_SIGNALS = [
  "feature film",
  "feature-length",
  "feature length",
  "full-length film",
  "full length film",
  "full movie",
  "full film",
  "complete film",
  "complete movie",
  "independent feature",
  "independent film",
  "documentary film",
  "full documentary",
  "watch the film",
  "watch the movie"
];

/* =========================
   MAIN FUNCTION
========================= */

export default async () => {

  try {

    const token = process.env.VIMEO_ACCESS_TOKEN;

    if (!token) {

      return json(
        {
          success: false,
          scannerVersion: SCANNER_VERSION,
          error: "VIMEO_ACCESS_TOKEN is missing"
        },
        500
      );

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

      blockedWords: 0,
      blockedCategories: 0,

      noPoster: 0,
      noVimeoLink: 0,

      notMovie: 0,

      copyrightRisk: 0,

      likelyFree: 0,
      likelyLicensed: 0,
      likelyOwned: 0,

      approved: 0,
      review: 0,
      rejected: 0,

      rateLimited: 0

    };

    /* =========================
       SEARCH VIMEO
    ========================= */

    for (const search of SEARCHES) {

      stats.searches++;

      const url =
        `https://api.vimeo.com/videos?query=${encodeURIComponent(search)}` +
        `&per_page=25&sort=relevant`;

      const response = await vimeoFetch(url, token);

      if (response.status === 429) {

        stats.rateLimited++;

        console.log(
          `Rate limited on search: ${search}`
        );

        continue;

      }

      if (!response.ok) {

        console.log(
          `Vimeo search failed: ${search} (${response.status})`
        );

        continue;

      }

      const data = await response.json();

      for (const video of data.data || []) {

        stats.searchResults++;

        const videoId =
          video.uri?.split("/").pop();

        if (!videoId) {
          continue;
        }

        if (seen.has(videoId)) {

          stats.duplicates++;

          continue;

        }

        seen.add(videoId);

        /* =========================
           BASIC DATA
        ========================= */

        const title =
          cleanText(video.name || "");

        const description =
          cleanText(video.description || "");

        const searchableText =
          `${title} ${description}`.toLowerCase();

        const duration =
          Number(video.duration || 0);

        /* =========================
           DURATION
        ========================= */

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

        /* =========================
           BLOCK NON-MOVIE CONTENT
        ========================= */

        if (
          BLOCKED_WORDS.some(word =>
            containsPhrase(searchableText, word)
          )
        ) {

          stats.blockedWords++;
          stats.rejected++;

          continue;

        }

        /* =========================
           CATEGORIES
        ========================= */

        const categories =
          Array.isArray(video.categories)

            ? video.categories
                .map(c => cleanText(c?.name || ""))
                .filter(Boolean)

            : [];

        if (
          categories.some(category =>
            BLOCKED_CATEGORIES.some(
              blocked =>
                category.toLowerCase() ===
                blocked.toLowerCase()
            )
          )
        ) {

          stats.blockedCategories++;
          stats.rejected++;

          continue;

        }

        /* =========================
           POSTER
        ========================= */

        const pictures =
          video.pictures?.sizes || [];

        let poster = "";

        if (pictures.length) {

          const sortedPictures =
            [...pictures].sort(
              (a, b) =>
                Number(b.width || 0) -
                Number(a.width || 0)
            );

          poster =
            sortedPictures[0]?.link || "";

        }

        if (!poster) {

          stats.noPoster++;
          stats.rejected++;

          continue;

        }

        /* =========================
           VIMEO LINK
        ========================= */

        if (!video.link) {

          stats.noVimeoLink++;
          stats.rejected++;

          continue;

        }

        /* =========================
           MOVIE DETECTION
        ========================= */

        const titleMovieMatches =
          findMatches(
            title.toLowerCase(),
            MOVIE_TITLE_SIGNALS
          );

        const descriptionMovieMatches =
          findMatches(
            description.toLowerCase(),
            MOVIE_DESCRIPTION_SIGNALS
          );

        const hasMovieSignal =
          titleMovieMatches.length > 0 ||
          descriptionMovieMatches.length > 0 ||
          categories.some(category =>
            /film|movie|documentary/i.test(category)
          );

        /*
         * A long video alone is NOT enough.
         *
         * We require at least one movie signal.
         */

        if (!hasMovieSignal) {

          stats.notMovie++;
          stats.rejected++;

          continue;

        }

        /* =========================
           RIGHTS EVIDENCE
        ========================= */

        const freeMatches =
          findMatches(
            searchableText,
            FREE_PHRASES
          );

        const licenseMatches =
          findMatches(
            searchableText,
            LICENSE_PHRASES
          );

        const ownershipMatches =
          findMatches(
            searchableText,
            OWNERSHIP_PHRASES
          );

        const copyrightMatches =
          findMatches(
            searchableText,
            COPYRIGHT_RISK_WORDS
          );

        if (freeMatches.length) {
          stats.likelyFree++;
        }

        if (licenseMatches.length) {
          stats.likelyLicensed++;
        }

        if (ownershipMatches.length) {
          stats.likelyOwned++;
        }

        if (copyrightMatches.length) {
          stats.copyrightRisk++;
        }

        /* =========================
           SMART RIGHTS SCORE
        ========================= */

        let score = 0;

        /*
         * Movie confidence
         */

        if (titleMovieMatches.length) {
          score += 3;
        }

        if (descriptionMovieMatches.length) {
          score += 2;
        }

        if (duration >= 60 * 60) {
          score += 1;
        }

        /*
         * Free availability
         */

        if (freeMatches.length >= 1) {
          score += 6;
        }

        if (freeMatches.length >= 2) {
          score += 2;
        }

        /*
         * License
         */

        if (licenseMatches.length >= 1) {
          score += 7;
        }

        if (licenseMatches.length >= 2) {
          score += 2;
        }

        /*
         * Ownership
         */

        if (ownershipMatches.length >= 1) {
          score += 2;
        }

        if (ownershipMatches.length >= 2) {
          score += 1;
        }

        /*
         * Explicit CC / Public Domain
         */

        if (
          licenseMatches.some(match =>
            /creative commons|public domain|cc by/i.test(match)
          )
        ) {

          score += 3;

        }

        /*
         * Copyright risk
         */

        if (copyrightMatches.length) {

          score -= 10;

        }

        /* =========================
           RIGHTS STATUS
        ========================= */

        let rightsStatus = "REVIEW";

        /*
         * HIGH CONFIDENCE:
         *
         * Free + movie signal
         * OR
         * License + movie signal
         *
         * Copyright risk blocks auto approval.
         */

        const hasFreeEvidence =
          freeMatches.length > 0;

        const hasLicenseEvidence =
          licenseMatches.length > 0;

        const hasOwnershipEvidence =
          ownershipMatches.length > 0;

        if (
          copyrightMatches.length === 0 &&
          hasMovieSignal &&
          (
            hasLicenseEvidence ||
            (
              hasFreeEvidence &&
              hasOwnershipEvidence
            ) ||
            (
              hasFreeEvidence &&
              score >= 9
            )
          )
        ) {

          rightsStatus = "APPROVED";

        }

        /*
         * Copyright-risk videos remain REVIEW
         * even when they contain words like
         * "free".
         */

        if (
          copyrightMatches.length > 0
        ) {

          rightsStatus = "REVIEW";

        }

        /* =========================
           MOVIE OBJECT
        ========================= */

        const movie = {

          id: `vimeo-${videoId}`,

          title,

          year: getYear(video),

          duration,

          durationText:
            formatDuration(duration),

          poster,

          description,

          vimeoId: videoId,

          vimeoUrl: video.link,

          playerUrl:
            `https://player.vimeo.com/video/${videoId}`,

          categories,

          rightsStatus,

          rightsScore: score,

          movieConfidence: {

            titleSignals:
              titleMovieMatches,

            descriptionSignals:
              descriptionMovieMatches,

            isLongForm:
              duration >= 60 * 60

          },

          rightsEvidence: {

            freeAvailability:
              freeMatches,

            ownership:
              ownershipMatches,

            licensing:
              licenseMatches,

            copyrightRisk:
              copyrightMatches

          },

          source: "Vimeo",

          /*
           * IMPORTANT:
           *
           * Vimeo metadata cannot prove
           * that embedding is enabled.
           */

          embedStatus: "NOT_TESTED"

        };

        /* =========================
           STORE RESULT
        ========================= */

        if (
          rightsStatus === "APPROVED"
        ) {

          movies.push(movie);

          stats.approved++;

        } else {

          reviewMovies.push(movie);

          stats.review++;

        }

      }

      /*
       * Slow down searches to reduce
       * Vimeo 429 errors.
       */

      await sleep(1500);

    }

    /* =========================
       SORT
    ========================= */

    movies.sort(sortMovies);

    reviewMovies.sort(sortMovies);

    /* =========================
       RESPONSE
    ========================= */

    return json({

      success: true,

      scannerVersion:
        SCANNER_VERSION,

      count:
        movies.length,

      movies,

      reviewCount:
        reviewMovies.length,

      reviewMovies,

      stats

    });

  } catch (error) {

    console.error(
      "Vimeo scanner error:",
      error
    );

    return json(

      {
        success: false,
        scannerVersion:
          SCANNER_VERSION,
        error:
          error.message
      },

      500

    );

  }

};

/* =========================
   VIMEO REQUEST
========================= */

async function vimeoFetch(
  url,
  token,
  attempts = 3
) {

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt++
  ) {

    const response =
      await fetch(url, {

        headers: {

          Authorization:
            `Bearer ${token}`,

          Accept:
            "application/vnd.vimeo.*+json;version=3.4"

        }

      });

    if (
      response.status !== 429
    ) {

      return response;

    }

    const waitTime =
      attempt * 5000;

    console.log(
      `Vimeo 429. Waiting ${waitTime}ms...`
    );

    await sleep(waitTime);

  }

  return new Response(

    JSON.stringify({
      error:
        "Vimeo rate limit"
    }),

    {
      status: 429,

      headers: {
        "Content-Type":
          "application/json"
      }

    }

  );

}

/* =========================
   HELPERS
========================= */

function sleep(ms) {

  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );

}

function cleanText(value) {

  return String(value)

    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();

}

/*
 * Exact-ish phrase matching.
 *
 * Prevents "hbo" from accidentally
 * matching unrelated words.
 */

function containsPhrase(
  text,
  phrase
) {

  const escaped =
    phrase
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");

  const regex =
    new RegExp(
      `(^|[^a-z0-9+])${escaped}([^a-z0-9+]|$)`,
      "i"
    );

  return regex.test(text);

}

function findMatches(
  text,
  phrases
) {

  return phrases.filter(
    phrase =>
      containsPhrase(
        text,
        phrase.toLowerCase()
      )
  );

}

function getYear(video) {

  if (!video.release_time) {
    return null;
  }

  const year =
    new Date(
      video.release_time
    ).getFullYear();

  return Number.isNaN(year)
    ? null
    : year;

}

function formatDuration(
  seconds
) {

  const totalMinutes =
    Math.floor(
      seconds / 60
    );

  const hours =
    Math.floor(
      totalMinutes / 60
    );

  const minutes =
    totalMinutes % 60;

  if (hours > 0) {

    return `${hours}h ${minutes}min`;

  }

  return `${minutes}min`;

}

function sortMovies(a, b) {

  /*
   * Higher rights confidence first.
   */

  if (
    b.rightsScore !==
    a.rightsScore
  ) {

    return (
      b.rightsScore -
      a.rightsScore
    );

  }

  /*
   * Then newest first.
   */

  if (!a.year && !b.year) {

    return a.title.localeCompare(
      b.title
    );

  }

  if (!a.year) return 1;

  if (!b.year) return -1;

  return b.year - a.year;

}

function json(
  data,
  status = 200
) {

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

        /*
         * Cache for one hour.
         *
         * This prevents every visitor
         * from hitting Vimeo.
         */

        "Cache-Control":
          "public, max-age=3600"

      }

    }

  );

}
