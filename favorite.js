const favoritesContainer =
document.getElementById("favoritesContainer");


let favorites =
JSON.parse(localStorage.getItem("favorites")) || [];


let favoriteMovies = movies.filter(movie =>
    favorites.includes(movie.id)
);


if(favoriteMovies.length === 0){

    favoritesContainer.innerHTML = `
    <h2>No favorites yet ❤️</h2>
    <p>Open a movie and add it to your favorites.</p>
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
