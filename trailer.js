
  
import { db } from "./firebase.js";


import {

collection,
addDoc,
getDocs,
query,
where,
orderBy

} from 
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// GET ID FROM URL
/////////////////////////////

const params = new URLSearchParams(location.search);
const id = params.get("id");
  


const current = movies.find( m => String(m.id) === String(id));
// =====================
// VIDEO SEO SCHEMA
// =====================

if(current){

const videoSchema = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": `${current.title} Official Trailer`,
  "description": `Watch the official trailer for ${current.title} on MoviePulse.`,
  "thumbnailUrl": current.poster,
  "embedUrl": current.trailer,
  "contentUrl": current.trailer,
  "uploadDate": "2026-07-30T12:00:00+02:00"
};

const script = document.createElement("script");

script.type = "application/ld+json";

script.textContent = JSON.stringify(videoSchema);


document.head.appendChild(script);

}

// =====================
// DYNAMIC SEO METADATA
// =====================

if (!current) {
    document.title = "Movie Not Found | MoviePulse";
} else {

    document.title = `${current.title} - Trailer, Cast & Review | MoviePulse`;

    const metaDescription = document.querySelector(
        'meta[name="description"]'
    );

    if (metaDescription) {
        metaDescription.setAttribute(
            "content",
            `${current.title} on MoviePulse. Read the movie article, explore the cast, watch the official trailer, and discover the latest movie details.`
        );
    }

    let canonical = document.querySelector(
        'link[rel="canonical"]'
    );

    if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
    }

    canonical.href =
        `https://moviepulse247.netlify.app/trailer.html?id=${current.id}`;
}
/////////////////////////////
// GET RECOMMENDATIONS
/////////////////////////////

function getRecommendations(currentMovie){

  const pool = movies.filter(m => m.id !== currentMovie.id);

  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  return {
    related: shuffled.slice(0, 6),
    more: shuffled.slice(6, 12),
    others: shuffled.slice(12, 50)
  };
}

/////////////////////////////
// RENDER PAGE
/////////////////////////////
/////////////////////////////
// LOAD MAIN MOVIE PAGE
/////////////////////////////

function loadMain(movie){

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  const recommendations = getRecommendations(movie);

  document.getElementById("mainArea").innerHTML = `
  <div class="movie-page">

    <h1 class="title">${movie.title}</h1>

    <div class="content-wrap">

     <div class="poster-column">

  <img class="hero-poster" src="${movie.poster}" alt="${movie.title}">

  <div class="movie-rating">
    ${"⭐".repeat(Math.round(movie.rating || 0))}
  </div>

  <!-- LIKE BUTTON -->
  <div class="engagement-box">

  <div class="rating-box">

<h3>⭐ Rate This Movie</h3>

<div class="stars" id="stars">
    <span data-rate="1">☆</span>
    <span data-rate="2">☆</span>
    <span data-rate="3">☆</span>
    <span data-rate="4">☆</span>
    <span data-rate="5">☆</span>
</div>

<p>
User Rating:
<span id="averageRating">0</span>/5
</p>

<p>
<span id="voteCount">0</span> votes
</p>

</div>

  </div>
  </div>

      <div class="article-side">
        ${movie.article || ""}
      </div>

    </div>

    <div class="article-full"></div>
    
        <div class="verdict-box">

      <div class="verdict-label">🔥 MOVIEPULSE VERDICT</div>

      <h2>${movie.verdictTitle || "Worth Keeping an Eye On?"}</h2>

      <p class="verdict-text">
        ${movie.verdict || "This is one of those movies that deserves a spot on your watchlist. But the real question is... will it live up to the hype? 👀"}
      </p>

      <div class="hype-row">

        <span class="hype-label">🔥 Hype Level</span>

        <div class="hype-bar">
          <div 
            class="hype-fill" 
            style="width:${(movie.hype || movie.rating || 5) * 10}%">
          </div>
        </div>

        <span class="hype-score">
          ${movie.hype || movie.rating || 5}/10
        </span>

      </div>

    </div>

<div class="video-container">

  <h2 class="section-title">
    ${movie.title} Official Trailer
  </h2>

  <iframe
    class="video-frame"
    src="${movie.trailer || ""}"
    title="${movie.title} Official Trailer"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe>

</div>
    
<div class="comments-box">

<h2 class="section-title">💬 Comments</h2>

<textarea id="commentInput" placeholder="Write your comment..."></textarea>

<button id="commentBtn">
🚀 Share Your Thoughts
</button>

<div id="commentsList"></div>

</div>

    <div class="summary-box">
      <h2 class="section-title">Movie Summary</h2>
      <p>${movie.summary || "No summary available."}</p>
    </div>

    <div class="starring-section">
      <h2 class="section-title">Starring</h2>
      <p>
        ${
          Array.isArray(movie.starring)
            ? movie.starring.join(", ")
            : movie.starring || "N/A"
        }
      </p>
    </div>

    <h2 class="section-title">Featured picks</h2>

    <div class="recommend-grid">
      ${recommendations.related.map(rec => `
        <div class="recommend-card"
          onclick="location.href='trailer.html?id=${rec.id}'">

          <img src="${rec.poster}" alt="${rec.title}">
          <h4>${rec.title}</h4>
          <small>⭐ ${rec.rating || 0}</small>

        </div>
      `).join("")}
    </div>

    <h2 class="section-title">More You May Like</h2>

    <div class="recommend-grid">
      ${recommendations.more.map(rec => `
        <div class="recommend-card"
          onclick="location.href='trailer.html?id=${rec.id}'">

          <img src="${rec.poster}" alt="${rec.title}">
          <h4>${rec.title}</h4>
          <small>⭐ ${rec.rating || 0}</small>

        </div>
      `).join("")}
    </div>

    <h2 class="section-title">Other Movies</h2>

    <div class="recommend-grid">
      ${recommendations.others.map(rec => `
        <div class="recommend-card"
          onclick="location.href='trailer.html?id=${rec.id}'">

          <img src="${rec.poster}" alt="${rec.title}">
          <h4>${rec.title}</h4>
          <small>⭐ ${rec.rating || 0}</small>

        </div>
      `).join("")}
    </div>

  </div>
  `;
}
  

  
  
const backBtn=document.getElementById("backBtn");

if(backBtn){

backBtn.href=id?
`movie.html?id=${id}`:"/";

}
 

const menuBtn = document.querySelector(".menu-btn");
const nav = document.querySelector("nav");

if(menuBtn){

menuBtn.addEventListener("click", function(){
    nav.classList.toggle("active");
});

}



  // =====================
// USER RATING SYSTEM
// =====================


async function setupRating(){

const stars = document.querySelectorAll(".stars span");


stars.forEach(star=>{


star.addEventListener("click", async()=>{


let value = Number(star.dataset.rate);


await addDoc(
collection(db,"ratings"),
{
movieId: current.id,
rating: value,
createdAt: new Date()
}
);


showRating();


});


});


}



async function showRating(){

const average = document.getElementById("averageRating");
const votes = document.getElementById("voteCount");


if(!average || !votes) return;



const snapshot = await getDocs(
collection(db,"ratings")
);



let ratings=[];



snapshot.forEach(doc=>{

const data = doc.data();


if(data.movieId === current.id){

ratings.push(data.rating);

}


});



if(ratings.length===0){

average.innerText="0";
votes.innerText="0";

return;

}



let total = ratings.reduce(
(a,b)=>a+b,0
);



average.innerText =
(total / ratings.length).toFixed(1);



votes.innerText =
ratings.length;


}
// =====================
// COMMENTS SYSTEM
// =====================


async function addComment(){


const input = document.getElementById("commentInput");


if(!input.value.trim()) return;



await addDoc(
collection(db,"comments"),
{
movieId: current.id,
text: input.value,
createdAt:new Date()
}
);



input.value="";


loadComments();


}




async function loadComments(){


const box=document.getElementById("commentsList");


if(!box) return;



const q=query(
collection(db,"comments"),
where("movieId","==",current.id),
orderBy("createdAt","desc")
);



const snapshot=await getDocs(q);



box.innerHTML="";



snapshot.forEach(doc=>{


const data=doc.data();


box.innerHTML += `

<div class="comment-item">

<strong>${data.username}</strong><br>

💬 ${data.text}

</div>

`;

});


}

// PAGE LOAD
// PAGE LOAD

document.addEventListener("DOMContentLoaded", () => {

    if (!current) {
        document.getElementById("mainArea").innerHTML = `
            <h1>Movie Not Found</h1>
            <p>We couldn't find this movie.</p>
        `;
        return;
    }

    loadMain(current);

    setTimeout(() => {

        console.log("Comments box:");
        console.log(document.getElementById("commentsList"));

        setupRating();
        showRating();
        loadComments();

        const btn = document.getElementById("commentBtn");

        if (btn) {
            btn.addEventListener("click", addComment);
        }

    }, 1000);

    const backBtn = document.getElementById("backBtn");

    if (backBtn) {
        backBtn.href = id
            ? `movie.html?id=${id}`
            : "/";
    }

});
