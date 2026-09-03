const SCANNER_VERSION = "8.0-rights-filter";

const SEARCHES = [
  "full movie",
  "full film",
  "feature film",
  "full feature film",
  "independent feature film",
  "free feature film",
  "watch full movie",
  "watch full film",
  "free full movie",
  "free full film",
  "documentary feature",
  "full documentary"
];

/*
 * Words that normally indicate this isn't a complete movie.
 */
const HARD_BLOCKED_WORDS = [
  "trailer",
  "official trailer",
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
  "reel",
  "showreel",
  "sizzle reel",
  "highlight",
  "highlights",
  "episode",
  "web series",
  "series episode",
  "music video",
  "concert",
  "live stream",
  "livestream",
  "podcast",
  "teaser trailer"
];

/*
 * Categories that are normally not movies for MoviePulse.
 */
const BLOCKED_CATEGORIES = [
  "Sports",
  "Music",
  "Gaming",
  "How-to & Style"
];

/*
 * Strong copyright/commercial warning signals.
 *
 * These don't automatically reject every video because some
 * legitimate independent films may mention festivals, distributors,
 * etc. They are used as negative signals.
 */
const COPYRIGHT_RISK_WORDS = [
  "netflix",
  "disney",
  "disney+",
  "warner bros",
  "warner brothers",
  "universal pictures",
  "universal",
  "paramount pictures",
  "paramount",
  "sony pictures",
  "sony",
  "lionsgate",
  "20th century studios",
  "20th century fox",
  "fox searchlight",
  "searchlight pictures",
  "hbo",
  "amazon studios",
  "prime video",
  "apple tv",
  "apple tv+",
  "mgm",
  "a24",
  "focus features",
  "miramax",
  "new line cinema",
  "columbia pictures",
  "dreamworks",
  "reel one",
  "hallmark",
  "bbc",
  "itv",
  "hulu"
];

/*
 * Phrases that are strong evidence that the uploader intends
 * the complete film to be available free on Vimeo.
 */
const STRONG_FREE_PHRASES = [
  "free to watch",
  "free to view",
  "watch for free",
  "watch it free",
  "watch the full movie free",
  "watch the full film free",
  "watch the complete film free",
  "watch the complete movie free",
  "full movie free",
  "full film free",
  "full feature free",
  "feature film free",
  "available for free",
  "available to watch for free",
  "available free online",
  "free online",
  "completely free",
  "completely free to watch",
  "watch free on vimeo",
  "free to watch on vimeo",
  "available free on vimeo"
];

/*
 * Evidence that the uploader may be the filmmaker, production
 * company, distributor, or rights holder.
 */
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
  "from the producers",
  "filmmaker",
  "filmmakers",
  "production company",
  "production",
  "official website",
  "official site"
];

/*
 * Creative Commons / licensing signals.
 */
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
  "licensed under",
  "released under",
  "public domain",
  "public-domain",
  "permission to share",
  "permission to distribute",
  "licensed to",
  "with permission"
];

/*
 * Minimum duration:
 *
 * 40 minutes catches documentaries and unusual feature films.
 * Very short videos are not useful for this catalog.
 */
const MIN_DURATION = 40 * 60;

/*
 * Maximum duration.
 *
 * This prevents extremely long livestreams/recordings from
 * becoming movies.
 */
const MAX_DURATION = 5 * 60 * 60;


/* ---------------------------------------------------------
   MAIN FUNCTION
--------------------------------------------------------- */

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
      searchResults: 0,
      duplicates: 0,
      tooShort: 0,
      tooLong: 0,
      blockedWords: 0,
      blockedCategories: 0,
      copyrightRisk: 0,
      noPoster: 0,
      noVimeoLink: 0,
      approved: 0,
      review: 0,
      rejected: 0
    };

    for (const search of SEARCHES) {
      const url =
        `https://api.vimeo.com/videos?query=${encodeURIComponent(search)}` +
        `&per_page=50&sort=relevant`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.vimeo.*+json;version=3.4"
        }
      });

      if (!response.ok) {
        throw new Error(
          `Vimeo API returned ${response.status} for "${search}"`
        );
      }

      const data = await response.json();

      for (const video of data.data || []) {
        stats.searchResults++;

        const videoId = video.uri?.split("/").pop();

        if (!videoId) {
          continue;
        }

        if (seen.has(videoId)) {
          stats.duplicates++;
          continue;
        }

        /*
         * Mark it seen now so the same video isn't processed
         * repeatedly by different searches.
         */
        seen.add(videoId);

        const title = cleanText(video.name || "");
        const description = cleanText(video.description || "");

        const searchableText =
          `${title} ${description}`.toLowerCase();

        const duration = Number(video.duration || 0);

        /*
         * Duration filter.
         */
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

        /*
         * Hard blocked words.
         */
        if (
          HARD_BLOCKED_WORDS.some(word =>
            searchableText.includes(word.toLowerCase())
          )
        ) {
          stats.blockedWords++;
          stats.rejected++;
          continue;
        }

        /*
         * Categories.
         */
        const categories =
          Array.isArray(video.categories)
            ? video.categories
                .map(category =>
                  cleanText(category?.name || "")
                )
                .filter(Boolean)
            : [];

        if (
          categories.some(category =>
            BLOCKED_CATEGORIES.some(blocked =>
              category.toLowerCase() === blocked.toLowerCase()
            )
          )
        ) {
          stats.blockedCategories++;
          stats.rejected++;
          continue;
        }

        /*
         * Real Vimeo poster.
         */
        const pictures = video.pictures?.sizes || [];

        let poster = "";

        if (pictures.length) {
          /*
           * Pick the largest Vimeo image available.
           */
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

        /*
         * Vimeo URL is required.
         */
        if (!video.link) {
          stats.noVimeoLink++;
          stats.rejected++;
          continue;
        }

        /*
         * Detect evidence.
         */
        const freeMatches = findMatches(
          searchableText,
          STRONG_FREE_PHRASES
        );

        const ownershipMatches = findMatches(
          searchableText,
          OWNERSHIP_PHRASES
        );

        const licenseMatches = findMatches(
          searchableText,
          LICENSE_PHRASES
        );

        const copyrightMatches = findMatches(
          searchableText,
          COPYRIGHT_RISK_WORDS
        );

        /*
         * Calculate confidence.
         */
        let score = 0;

        /*
         * Strong free availability.
         */
        if (freeMatches.length > 0) {
          score += 5;
        }

        /*
         * More than one free phrase = stronger evidence.
         */
        if (freeMatches.length >= 2) {
          score += 2;
        }

        /*
         * Ownership evidence.
         */
        if (ownershipMatches.length > 0) {
          score += 3;
        }

        if (ownershipMatches.length >= 2) {
          score += 1;
        }

        /*
         * Licensing evidence.
         */
        if (licenseMatches.length > 0) {
          score += 5;
        }

        /*
         * Explicit Creative Commons/public-domain evidence
         * is especially strong.
         */
        if (
          licenseMatches.some(match =>
            match.includes("creative commons") ||
            match.includes("public domain") ||
            match.includes("cc by")
          )
        ) {
          score += 2;
        }

        /*
         * Copyright risk reduces confidence.
         */
        if (copyrightMatches.length > 0) {
          score -= 7;
          stats.copyrightRisk++;
        }

        /*
         * Detect likely full-movie title.
         */
        const fullMovieTitleSignal =
          /\b(full movie|full film|feature film|full feature|full-length|complete film|complete movie)\b/i
            .test(title);

        if (fullMovieTitleSignal) {
          score += 2;
        }

        /*
         * Build status.
         *
         * APPROVED requires strong free/license evidence and
         * no major copyright-risk signal.
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

        /*
         * Very weak results stay REVIEW.
         */
        if (score < 4) {
          rightsStatus = "REVIEW";
        }

        /*
         * Strong copyright signal without strong ownership/license
         * evidence should never automatically publish.
         */
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

          /*
           * REAL VIMEO COVER
           */
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

          /*
           * This does NOT claim that embedding was tested.
           */
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
    }

    /*
     * Newest movies first.
     */
    movies.sort(sortMovies);

    reviewMovies.sort(sortMovies);

    return json({
      success: true,

      scannerVersion: SCANNER_VERSION,

      count: movies.length,

      /*
       * ONLY APPROVED movies are exposed here for MoviePulse.
       */
      movies,

      /*
       * REVIEW movies are returned separately so you can inspect
       * them without automatically publishing them.
       */
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


/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */

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
  if (!video.release_time) {
    return null;
  }

  const year =
    new Date(video.release_time).getFullYear();

  if (Number.isNaN(year)) {
    return null;
  }

  return year;
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

  if (!a.year) {
    return 1;
  }

  if (!b.year) {
    return -1;
  }

  return b.year - a.year;
}


function json(data, status = 200) {
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
