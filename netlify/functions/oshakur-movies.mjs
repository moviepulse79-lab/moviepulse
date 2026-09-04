export default async () => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Supabase environment variables are missing");
    }

    const response = await fetch(
     `${supabaseUrl}/rest/v1/oshakur_movies?select=*&watch_url=not.is.null&order=updated_at.desc`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Supabase returned ${response.status}: ${errorText}`
      );
    }

    const movies = await response.json();

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
