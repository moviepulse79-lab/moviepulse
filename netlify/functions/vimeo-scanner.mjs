const SEARCHES = [
  "full movie",
  "feature film",
  "full feature film",
  "independent feature film",
  "free feature film",
  "watch full film",
  "full length film"
];

// Words that strongly suggest this is NOT a full movie.
const BLOCKED_WORDS = [
  "trailer",
  "teaser",
  "clip",
  "short film",
  "short movie",
  "behind the scenes",
  "interview",
  "preview",
  "promo",
  "making of",
  "showreel",
  "reel",
  "episode",
  "web series",
  "music video",
  "concert",
  "live stream",
  "fan edit",
  "fan made",
  "reaction",
  "review",
  "recap"
];

// Categories we don't want in the movie catalog.
const BLOCKED_CATEGORIES = [
  "Sports",
  "Music",
  "Gaming"
];

// Words that can indicate commercial/re-uploaded copyrighted content.
const COPYRIGHT_RISK_WORDS = [
  "lionsgate",
  "warner bros",
  "warner brothers",
  "universal pictures",
  "universal studios",
  "paramount pictures",
  "sony pictures",
  "columbia pictures",
  "20th century",
  "disney",
  "marvel",
  "dc comics",
  "netflix",
  "hbo",
  "amazon prime",
  "prime video",
  "apple tv",
  "a24",
  "eone",
  "hopscotch",
  "arclight",
  "official trailer",
  "official clip",
  "download torrent",
  "torrent",
  "pirated",
  "bootleg",
  "camrip",
  "dvdrip"
];

// Phrases that indicate the uploader/filmmaker intentionally
// made the film available for free.
const RIGHTS_PHRASES = [
  "free to watch",
  "watch free",
  "watch for free",
  "free online",
  "available for free",
  "available to watch for free",
  "available free",
  "stream for free",
  "stream free",
  "full film free",
  "full movie free",
  "watch the full film",
  "watch the full movie",
  "watch full film",
  "watch full movie",
  "made available for free",
  "released for free",
  "released under",
  "creative commons",
  "creative commons license",
  "cc by",
  "cc by-nc",
  "cc by-nd",
  "cc by-nc-nd",
  "public domain",
  "official full movie",
  "official full film",
  "filmmakers made available",
  "filmmaker made available",
  "film made available",
  "free viewing",
  "free to view"
];

export default async () => {
  try {
    const token = process.env.VIMEO_ACCESS_TOKEN;

    if (!token) {
      return json(
        {
          success: false,
          error: "VIMEO_ACCESS_TOKEN is missing"
        },
        500
      );
    }

    const movies = [];
    const seen = new Set();

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
          `Vimeo API returned ${response.status}`
        );
      }

      const data = await response.json();

      for (const video of data.data || []) {
        const videoId = video.uri?.split("/").pop();

        if (!videoId || seen.has(videoId)) {
          continue;
        }

        const title = (video.name || "").trim();
        const description = (video.description || "").trim();

        const searchableText =
          `${title} ${description}`.toLowerCase();

        /*
         * --------------------------------------------------
         * 1. REMOVE OBVIOUS NON-MOVIES
         * --------------------------------------------------
         */

        if (
          BLOCKED_WORDS.some(word =>
            searchableText.includes(word)
          )
        ) {
          continue;
        }

        /*
         * --------------------------------------------------
         * 2. REQUIRE FEATURE-LENGTH VIDEO
         * --------------------------------------------------
         */

        const duration = Number(video.duration || 0);

        // Minimum 40 minutes.
        if (duration < 2400) {
          continue;
        }

        /*
         * --------------------------------------------------
         * 3. REMOVE BAD CATEGORIES
         * --------------------------------------------------
         */

        const categories =
          (video.categories || []).map(category =>
            (category.name || "").trim()
          );

        if (
          categories.some(category =>
            BLOCKED_CATEGORIES.includes(category)
          )
        ) {
          continue;
        }

        /*
         * --------------------------------------------------
         * 4. REMOVE OBVIOUS COMMERCIAL/RE-UPLOADED CONTENT
         * --------------------------------------------------
         */

        if (
          COPYRIGHT_RISK_WORDS.some(word =>
            searchableText.includes(word)
          )
        ) {
          continue;
        }

        /*
         * --------------------------------------------------
         * 5. RIGHTS / FREE-AVAILABILITY CHECK
         * --------------------------------------------------
         */

        const rightsPhraseFound =
          RIGHTS_PHRASES.some(phrase =>
            searchableText.includes(phrase)
          );

        /*
         * We require a rights/free phrase.
         *
         * This is intentionally strict.
         * A movie being publicly visible on Vimeo does NOT
         * automatically mean MoviePulse is allowed to list it.
         */

        if (!rightsPhraseFound) {
          continue;
        }

        /*
         * --------------------------------------------------
         * 6. GET REAL VIMEO COVER
         * --------------------------------------------------
         */

        const pictures = video.pictures?.sizes || [];

        let poster = "";

        if (pictures.length) {
          // Vimeo normally returns multiple sizes.
          // Use the largest available image.
          poster =
            pictures[pictures.length - 1]?.link || "";
        }

        if (!poster) {
          continue;
        }

        /*
         * --------------------------------------------------
         * 7. REQUIRE VIMEO VIDEO URL
         * --------------------------------------------------
         */

        if (!video.link) {
          continue;
        }

        /*
         * --------------------------------------------------
         * 8. ADD MOVIE
         * --------------------------------------------------
         */

        seen.add(videoId);

        movies.push({
          id: `vimeo-${videoId}`,

          title,

          year: getYear(video),

          duration,

          durationText: formatDuration(duration),

          // REAL VIMEO COVER
          poster,

          description,

          vimeoId: videoId,

          vimeoUrl: video.link,

          playerUrl:
            `https://player.vimeo.com/video/${videoId}`,

          categories,

          rightsVerified: true,

          rightsSource: "Vimeo metadata",

          source: "Vimeo"
        });
      }
    }

    /*
     * --------------------------------------------------
     * 9. REMOVE DUPLICATES
     * --------------------------------------------------
     */

    const uniqueMovies = Array.from(
      new Map(
        movies.map(movie => [
          movie.vimeoId,
          movie
        ])
      ).values()
    );

    /*
     * --------------------------------------------------
     * 10. SORT NEWEST FIRST
     * --------------------------------------------------
     */

    uniqueMovies.sort((a, b) => {
      if (!a.year) return 1;
      if (!b.year) return -1;

      return b.year - a.year;
    });

    return json({
      success: true,

      count: uniqueMovies.length,

      movies: uniqueMovies
    });

  } catch (error) {
    console.error(
      "Vimeo scanner error:",
      error
    );

    return json(
      {
        success: false,
        error: error.message
      },
      500
    );
  }
};


/*
 * --------------------------------------------------
 * GET YEAR
 * --------------------------------------------------
 */

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


/*
 * --------------------------------------------------
 * FORMAT DURATION
 * --------------------------------------------------
 */

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


/*
 * --------------------------------------------------
 * JSON RESPONSE
 * --------------------------------------------------
 */

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
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
