export default async (request) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Supabase environment variables are missing");
    }

    const url = new URL(request.url);

    const page = Math.max(
      parseInt(url.searchParams.get("page") || "1", 10),
      1
    );

    const limit = Math.min(
      Math.max(
        parseInt(url.searchParams.get("limit") || "12", 10),
        1
      ),
      50
    );

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabaseApiUrl =
      `${supabaseUrl}/rest/v1/oshakur_movies` +
      `?select=*` +
      `&watch_url=not.is.null` +
      `&order=updated_at.desc` +
      `&limit=${limit}` +
      `&offset=${from}`;

    const response = await fetch(supabaseApiUrl, {
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

    const contentRange = response.headers.get("content-range");

    let total = null;

    if (contentRange) {
      const match = contentRange.match(/\/(\d+)$/);

      if (match) {
        total = parseInt(match[1], 10);
      }
    }

    const hasNext =
      total !== null
        ? from + movies.length < total
        : movies.length === limit;

    return new Response(
      JSON.stringify({
        success: true,
        page,
        limit,
        count: movies.length,
        total,
        hasNext,
        movies
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300"
        }
      }
    );

  } catch (error) {
    console.error("OSHAkur movies API error:", error);

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
