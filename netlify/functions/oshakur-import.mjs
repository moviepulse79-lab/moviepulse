export default async (req) => {
  try {
    const url = new URL(req.url);

    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") || "1", 10)
    );

    const limit = Math.min(
      48,
      Math.max(
        1,
        parseInt(url.searchParams.get("limit") || "24", 10)
      )
    );

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error(
        "Supabase environment variables are missing"
      );
    }

    const offset = (page - 1) * limit;

    /*
      Fetch one chunk only.
      Example:
      page=1 -> movies 1-24
      page=2 -> movies 25-48
      page=3 -> movies 49-72
    */

    const endpoint =
      `${supabaseUrl}/rest/v1/oshakur_movies` +
      `?select=*` +
      `&order=updated_at.desc` +
      `&limit=${limit}` +
      `&offset=${offset}`;

    const response = await fetch(endpoint, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json",
        Prefer: "count=exact"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Supabase returned ${response.status}: ${errorText}`
      );
    }

    const movies = await response.json();

    /*
      Supabase returns the total number of rows
      inside Content-Range when count=exact is used.

      Example:
      0-23/2933
    */

    const contentRange =
      response.headers.get("content-range");

    let total = null;

    if (contentRange) {
      const match =
        contentRange.match(/\/(\d+)$/);

      if (match) {
        total = Number(match[1]);
      }
    }

    /*
      If Content-Range isn't available,
      estimate whether another page exists.
    */

    const hasNext =
      total !== null
        ? offset + movies.length < total
        : movies.length === limit;

    return new Response(
      JSON.stringify({
        success: true,

        page,

        limit,

        offset,

        count: movies.length,

        total,

        hasNext,

        nextPage:
          hasNext
            ? page + 1
            : null,

        movies
      }),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json",

          "Cache-Control":
            "public, max-age=300"
        }
      }
    );

  } catch (error) {
    console.error(
      "OSHAkur movies API error:",
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,

        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  }
};
