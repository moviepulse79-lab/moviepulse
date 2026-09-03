const SCANNER_VERSION = "9.0-rate-safe";

const SEARCHES = [
  "full movie",
  "full film",
  "feature film",
  "independent feature film",
  "free feature film",
  "full documentary"
];

const MIN_DURATION = 40 * 60;
const MAX_DURATION = 5 * 60 * 60;

// Things we definitely don't want.
const BLOCKED_WORDS = [
  "trailer",
  "teaser",
  "clip",
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
  "highlight",
  "highlights",
  "episode",
  "web series",
  "music video",
  "concert",
  "podcast"
];

const BLOCKED_CATEGORIES = [
  "Sports",
  "Music",
  "Gaming"
];

// Strong signals that the uploader is offering the movie legitimately.
const FREE_PHRASES = [
  "free to watch",
  "free to view",
  "watch for free",
  "watch it free",
  "full movie free",
  "full film free",
  "feature film free",
  "available for free",
  "available to watch for free",
  "available free online",
  "free online",
  "completely free",
  "free to watch on vimeo",
  "available free on vimeo"
];

const LICENSE_PHRASES = [
  "creative commons",
  "cc by",
  "cc-by",
  "cc by-sa",
  "cc-by-sa",
  "cc by-nd",
  "cc-by-nd",
  "cc by-nc",
  "cc-by-nc",
  "public domain",
  "public-domain",
  "licensed under",
  "released under",
  "with permission",
  "permission to share",
  "permission to distribute"
];

const OWNERSHIP_PHRASES = [
  "written and directed by",
  "written & directed by",
  "directed by",
  "produced by",
  "produced and directed by",
  "our film",
  "our feature",
  "our documentary",
  "my film",
  "my feature",
  "my documentary",
  "official film",
  "official feature",
  "official documentary",
  "from the filmmakers",
  "from the director",
  "filmmaker",
  "filmmakers",
  "production company"
];

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
      copyrightRisk: 0,
      approved: 0,
      review: 0,
      rejected: 0,
      rateLimited: 0
    };

    /*
     * IMPORTANT:
     * Only make one Vimeo API request at a time.
     * This greatly reduces 429 errors.
     */

    for (const search of SEARCHES) {
      stats.searches++;

      const url =
        `https://api.vimeo.com/videos?query=${encodeURIComponent(search)}` +
        `&per_page=25&sort=relevant`;

      const response = await vimeoFetch(url, token);

      if (response.status === 429) {
        stats.rateLimited++;

        // Don't destroy the entire result if Vimeo rate-limits one search.
        console.log(`Rate limited on search: ${search}`);
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

        const videoId = video.uri?.split("/").pop();

        if (!videoId || seen.has(videoId)) {
          if (videoId) stats.duplicates++;
          continue;
        }

        seen.add(videoId);

        const title = cleanText(video.name || "");
        const description = cleanText(video.description || "");

        const searchableText =
          `${title} ${description}`.toLowerCase();

        const duration = Number(video.duration || 0);

        // Duration filter
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

        // Block obvious non-movies
        if (
          BLOCKED_WORDS.some(word =>
            searchableText.includes(word.toLowerCase())
          )
        ) {
          stats.blockedWords++;
          stats.rejected++;
          continue;
        }

        // Categories
        const categories = Array.isArray(video.categories)
          ? video.categories
              .map(c => cleanText(c?.name || ""))
              .filter(Boolean)
          : [];

        if (
          categories.some(category =>
            BLOCKED_CATEGORIES.some(
              blocked =>
                category.toLowerCase() === blocked.toLowerCase()
            )
          )
        ) {
          stats.blockedCategories++;
          stats.rejected++;
          continue;
        }

        // Poster
        const pictures = video.pictures?.sizes || [];

        let poster = "";

        if (pictures.length) {
          const sortedPictures = [...pictures].sort(
            (a, b) =>
              Number(b.width || 0) -
              Number(a.width || 0)
          );

          poster = sortedPictures[0]?.link || "";
        }

        if (!poster) {
          stats.noPoster++;
          stats.rejected++;
          continue;
        }

        // Vimeo page
        if (!video.link) {
          stats.noVimeoLink++;
          stats.rejected++;
          continue;
        }

        // Rights signals
        const freeMatches = findMatches(
          searchableText,
          FREE_PHRASES
        );

        const licenseMatches = findMatches(
          searchableText,
          LICENSE_PHRASES
        );

        const ownershipMatches = findMatches(
          searchableText,
          OWNERSHIP_PHRASES
        );

        const copyrightMatches = findMatches(
          searchableText,
          COPYRIGHT_RISK_WORDS
        );

        let score = 0;

        if (freeMatches.length) score += 5;
        if (freeMatches.length >= 2) score += 2;

        if (licenseMatches.length) score += 5;
        if (ownershipMatches.length) score += 3;

        if (ownershipMatches.length >= 2) score += 1;

        if (
          licenseMatches.some(match =>
            match.includes("creative commons") ||
            match.includes("public domain") ||
            match.includes("cc by")
          )
        ) {
          score += 2;
        }

        if (copyrightMatches.length) {
          score -= 7;
          stats.copyrightRisk++;
        }

        // Title looks like a full movie.
        if (
          /\b(full movie|full film|feature film|full feature|full-length|complete film|complete movie)\b/i.test(
            title
          )
        ) {
          score += 2;
        }

        /*
         * We intentionally don't require perfect rights evidence.
         *
         * APPROVED = strong evidence.
         * REVIEW   = possible movie, but needs manual checking.
         */

        let rightsStatus = "REVIEW";

        if (
          score >= 8 &&
          copyrightMatches.length === 0 &&
          (
            freeMatches.length > 0 ||
            licenseMatches.length > 0
          )
        ) {
          rightsStatus = "APPROVED";
        }

        // Copyright risk without a license = manual review.
        if (
          copyrightMatches.length > 0 &&
          licenseMatches.length === 0
        ) {
          rightsStatus = "REVIEW";
        }

        const movie = {
          id: `vimeo-${videoId}`,
          title,
          year: getYear(video),
          duration,
          durationText: formatDuration(duration),

          // REAL Vimeo thumbnail
          poster,

          description,

          vimeoId: videoId,
          vimeoUrl: video.link,
          playerUrl:
            `https://player.vimeo.com/video/${videoId}`,

          categories,

          rightsStatus,
          rightsScore: score,

          rightsEvidence: {
            freeAvailability: freeMatches,
            ownership: ownershipMatches,
            licensing: licenseMatches,
            copyrightRisk: copyrightMatches
          },

          source: "Vimeo",

          // We will test this later.
          embedStatus: "NOT_TESTED"
        };

        if (rightsStatus === "APPROVED") {
          movies.push(movie);
          stats.approved++;
        } else {
          reviewMovies.push(movie);
          stats.review++;
        }
      }

      // Small delay between searches.
      await sleep(1200);
    }

    movies.sort(sortMovies);
    reviewMovies.sort(sortMovies);

    /*
     * If Vimeo gives us very few approved movies,
     * still return REVIEW candidates so we have
     * movies to inspect instead of an empty catalog.
     */

    return json({
      success: true,
      scannerVersion: SCANNER_VERSION,

      count: movies.length,
      movies,

      reviewCount: reviewMovies.length,
      reviewMovies,

      stats
    });

  } catch (error) {
    console.error("Vimeo scanner error:", error);

    return json(
      {
        success: false,
        scannerVersion: SCANNER_VERSION,
        error: error.message
      },
      500
    );
  }
};


/* ---------------- HELPERS ---------------- */

async function vimeoFetch(url, token, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept:
          "application/vnd.vimeo.*+json;version=3.4"
      }
    });

    if (response.status !== 429) {
      return response;
    }

    // Vimeo rate limit.
    // Wait progressively longer.
    const waitTime = attempt * 4000;

    console.log(
      `Vimeo 429. Waiting ${waitTime}ms before retry...`
    );

    await sleep(waitTime);
  }

  return new Response(
    JSON.stringify({
      error: "Vimeo rate limit"
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}


function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}


function cleanText(value) {
  return String(value)
    .replace(/\r/g, "")
    .trim();
}


function findMatches(text, phrases) {
  return phrases.filter(phrase =>
    text.includes(phrase.toLowerCase())
  );
}


function getYear(video) {
  if (!video.release_time) return null;

  const year =
    new Date(video.release_time).getFullYear();

  return Number.isNaN(year) ? null : year;
}


function formatDuration(seconds) {
  const totalMinutes =
    Math.floor(seconds / 60);

  const hours =
    Math.floor(totalMinutes / 60);

  const minutes =
    totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }

  return `${minutes}min`;
}


function sortMovies(a, b) {
  if (!a.year && !b.year) {
    return a.title.localeCompare(b.title);
  }

  if (!a.year) return 1;
  if (!b.year) return -1;

  return b.year - a.year;
}


function json(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,

      headers: {
        "Content-Type": "application/json",

        // Cache results for one hour.
        // This also prevents repeatedly hitting Vimeo
        // whenever someone opens the page.
        "Cache-Control":
          "public, max-age=3600"
      }
    }
  );
}
