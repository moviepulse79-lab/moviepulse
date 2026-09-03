export default async (req) => {
  try {
    const token = process.env.VIMEO_ACCESS_TOKEN;

    if (!token) {
      return new Response(
        JSON.stringify({
          error: "VIMEO_ACCESS_TOKEN is not configured"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const searches = [
      "full movie",
      "feature film",
      "full feature film",
      "independent feature film",
      "free feature film"
    ];

    const rejectedWords = [
      "trailer",
      "teaser",
      "clip",
      "short film",
      "behind the scenes",
      "interview",
      "preview",
      "promo",
      "making of"
    ];

    const movies = [];
    const seen = new Set();

    for (const search of searches) {
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
        throw new Error(`Vimeo API error: ${response.status}`);
      }

      const data = await response.json();

      for (const video of data.data || []) {
        const title = video.name || "";
        const description = video.description || "";
        const text = `${title} ${description}`.toLowerCase();

        // Skip duplicates
        if (seen.has(video.uri)) continue;

        // Skip obvious non-movies
        if (rejectedWords.some(word => text.includes(word))) {
          continue;
        }

        // Require at least 40 minutes
        const duration = Number(video.duration || 0);

        if (duration < 2400) {
          continue;
        }

        const pictureSizes = video.pictures?.sizes || [];

        const thumbnail =
          pictureSizes.length > 0
            ? pictureSizes[pictureSizes.length - 1].link
            : "";

        const movieId = video.uri?.split("/").pop();

        if (!movieId) continue;

        seen.add(video.uri);

        movies.push({
          id: `vimeo-${movieId}`,
          title,
          year: video.release_time
            ? new Date(video.release_time).getFullYear()
            : null,
          duration,
          durationText: formatDuration(duration),
          description,
          poster: thumbnail,
          vimeoId: movieId,
          vimeoUrl: video.link || "",
          playerUrl:
            `https://player.vimeo.com/video/${movieId}`,
          categories:
            video.categories?.map(category => category.name) || []
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: movies.length,
        movies
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600"
        }
      }
    );

  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};


function formatDuration(seconds) {
  const totalMinutes = Math.floor(seconds / 60);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }

  return `${minutes}min`;
}
