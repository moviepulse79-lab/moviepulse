const container = document.getElementById("shorts-container");

shorts.forEach(short => {

container.innerHTML += `

<div class="short-card">

<blockquote class="tiktok-embed" cite="${short.tiktok}">
<section></section>
</blockquote>

<h3>${short.title}</h3>

<p>${short.description}</p>

</div>

`;

});
