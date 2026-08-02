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
