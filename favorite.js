const favoritesContainer =
    document.getElementById("favoritesContainer");


async function loadFavorites() {

    // Check logged-in user
    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();


    if (userError) {

        console.error("User error:", userError);
        return;

    }


    // User is not logged in
    if (!user) {

        favoritesContainer.innerHTML = `
            <div class="empty-favorites">

                <div class="favorite-sticker">
                    <div class="sticker-heart">♥</div>
                    <div class="sticker-film">🎬</div>

                    <span class="floating-heart heart-one">♥</span>
                    <span class="floating-heart heart-two">♥</span>

                    <span class="floating-star star-one">✦</span>
                    <span class="floating-star star-two">✦</span>
                </div>

                <h2>Sign in to view your favorites.</h2>

                <p>
                    Log in to keep your favorite movies synced
                    across your phone and computer.
                </p>

                <a href="auth.html" class="explore-favorites">
                    Sign In
                </a>

            </div>
        `;

        return;
    }


    // Get favorites from Supabase
    const {
        data: favorites,
        error
    } = await supabaseClient
        .from("favorites")
        .select("id, movie_id")
        .eq("user_id", user.id)
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "Favorites loading error:",
            error
        );

        favoritesContainer.innerHTML = `
            <p>Unable to load your favorites.</p>
        `;

        return;
    }


    // Find movies from movies.js
    const favoriteMovies = movies.filter(movie =>
        favorites.some(favorite =>
            Number(favorite.movie_id) === Number(movie.id)
        )
    );


    // No favorites
    if (favoriteMovies.length === 0) {

        favoritesContainer.innerHTML = `
            <div class="empty-favorites">

                <div class="favorite-sticker">
                    <div class="sticker-heart">♥</div>
                    <div class="sticker-film">🎬</div>

                    <span class="floating-heart heart-one">♥</span>
                    <span class="floating-heart heart-two">♥</span>

                    <span class="floating-star star-one">✦</span>
                    <span class="floating-star star-two">✦</span>
                </div>

                <h2>Your favorite movies will appear here when you save them.</h2>

                <p>
                    Save movies you love and they'll appear here.
                </p>

                <a href="poster.html" class="explore-favorites">
                    Explore Movies
                </a>

            </div>
        `;

        return;
    }


    // Display favorites
    favoritesContainer.innerHTML = "";


    favoriteMovies.forEach(movie => {

        const favoriteRecord = favorites.find(
            favorite =>
                Number(favorite.movie_id) === Number(movie.id)
        );


        favoritesContainer.innerHTML += `

            <div class="movie-card">

                <div class="poster-box">

                    <button
                        class="remove-favorite"
                        onclick="removeFavorite(${favoriteRecord.id})"
                    >
                        ❤️
                    </button>

                    <a href="trailer.html?id=${movie.id}">
                        <img
                            src="${movie.poster}"
                            alt="${movie.title}"
                        >
                    </a>

                </div>

                <h3>${movie.title}</h3>

                <div class="movie-rating">
                    ⭐ ${movie.rating}
                </div>

            </div>

        `;

    });

}


// Remove favorite
async function removeFavorite(favoriteId) {

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();


    if (!user) {

        window.location.href = "auth.html";
        return;

    }


    const { error } =
        await supabaseClient
            .from("favorites")
            .delete()
            .eq("id", favoriteId)
            .eq("user_id", user.id);


    if (error) {

        console.error(
            "Remove favorite error:",
            error
        );

        return;
    }


    loadFavorites();

}


loadFavorites();
