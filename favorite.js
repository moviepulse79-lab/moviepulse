const favoritesContainer =
document.getElementById("favoritesContainer");


let favorites =
JSON.parse(localStorage.getItem("favorites")) || [];


let favoriteMovies = movies.filter(movie =>
    favorites.includes(movie.id)
);



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


}else{


favoriteMovies.forEach(movie => {


favoritesContainer.innerHTML += `

<div class="movie-card">

    <div class="poster-box">

        <button class="remove-favorite" onclick="removeFavorite(${movie.id})">
            ❤️
        </button>

        <a href="trailer.html?id=${movie.id}">
            <img src="${movie.poster}" alt="${movie.title}">
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


// ADD THIS AT THE VERY BOTTOM 👇

function removeFavorite(id){

    let favorites =
    JSON.parse(localStorage.getItem("favorites")) || [];


    favorites = favorites.filter(movieId => movieId !== id);


    localStorage.setItem(
        "favorites",
        JSON.stringify(favorites)
    );


    location.reload();

}
