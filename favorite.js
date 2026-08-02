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

<a href="trailer.html?id=${movie.id}">

<img src="${movie.poster}" alt="${movie.title}">

</a>

<h3>${movie.title}</h3>

<span>⭐ ${movie.rating}</span>

</div>

`;

});


}
