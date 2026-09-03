
const SEARCHES = [
  "full movie",
  "feature film",
  "full feature film",
  "independent feature film",
  "free feature film"
];

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
  "reel",
  "showreel",
  "episode",
  "web series",
  "music video",
  "concert",
  "live stream"
];

const BLOCKED_CATEGORIES = [
  "Sports",
  "Music"
];

export default async () => {
  try {
    const token = process.env.VIMEO_ACCESS_TOKEN;

    if (!token) {
      return json({
        success: false,
        error: "VIMEO_ACCESS_TOKEN is missing"
      }, 500);
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
        throw new Error(`Vimeo API returned ${response.status}`);
      }

      const data = await response.json();

      for (const video of data.data || []) {
        const videoId = video.uri?.split("/").pop();

        if (!videoId || seen.has(videoId)) continue;

        const title = (video.name || "").trim();
        const description = (video.description || "").trim();

        const searchableText =
          `${title} ${description}`.toLowerCase();

        // Reject obvious non-movie content
        if (
          BLOCKED_WORDS.some(word =>
            searchableText.includes(word)
          )
        ) {
          continue;
        }

        // Minimum feature-film length: 40 minutes
        const duration = Number(video.duration || 0);

        if (duration < 2400) {
          continue;
        }

        // Reject sports/music categories
        const categories =
          (video.categories || []).map(c =>
            (c.name || "").trim()
          );

        if (
          categories.some(category =>
            BLOCKED_CATEGORIES.includes(category)
          )
        ) {
          continue;
        }

        // Get the best available real Vimeo thumbnail
        const pictures = video.pictures?.sizes || [];

        let poster = "";

        if (pictures.length) {
          poster = pictures[pictures.length - 1].link || "";
        }

        // Vimeo metadata must contain a usable player URL
        if (!video.link) {
          continue;
        }

        seen.add(videoId);

        movies.push({
          id: `vimeo-${videoId}`,
          title,
          year: getYear(video),
          duration,
          durationText: formatDuration(duration),
          poster,
          description,
          vimeoId: videoId,
          vimeoUrl: video.link,
          playerUrl:
            `https://player.vimeo.com/video/${videoId}`,
          categories
        });
      }
    }

    // Sort newest first
    movies.sort((a, b) => {
      if (!a.year) return 1;
      if (!b.year) return -1;
      return b.year - a.year;
    });

    return json({
      success: true,
      count: movies.length,
      movies
    });

  } catch (error) {
    console.error("Vimeo scanner error:", error);

    return json({
      success: false,
      error: error.message
    }, 500);
  }
};


function getYear(video) {
  if (!video.release_time) return null;

  const year = new Date(video.release_time).getFullYear();

  if (Number.isNaN(year)) {
    return null;
  }

  return year;
}


function formatDuration(seconds) {
  const totalMinutes = Math.floor(seconds / 60);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }

  return `${minutes}min`;
}


function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600"
      }
    }
  );
}
