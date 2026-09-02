import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// =====================================================
// GET MOVIE ID FROM URL
// =====================================================

const params = new URLSearchParams(location.search);
const id = params.get("id");

const current = movies.find(
  m => String(m.id) === String(id)
);


// =====================================================
// VIDEO SEO SCHEMA
// =====================================================

if (current) {

  const videoSchema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": `${current.title} Official Trailer`,
    "description": `Watch the official trailer for ${current.title} on MoviePulse.`,
    "thumbnailUrl": current.poster,
    "embedUrl": current.trailer || "",
    "contentUrl": current.trailer || "",
    "uploadDate": "2026-07-30T12:00:00+02:00"
  };

  const script = document.createElement("script");

  script.type = "application/ld+json";
  script.textContent = JSON.stringify(videoSchema);

  document.head.appendChild(script);
}


// =====================================================
// DYNAMIC SEO METADATA
// =====================================================

if (!current) {

  document.title = "Movie Not Found | MoviePulse";

} else {

  document.title =
    `${current.title} - Trailer, Cast & Review | MoviePulse`;

  const metaDescription =
    document.querySelector('meta[name="description"]');

  if (metaDescription) {

    metaDescription.setAttribute(
      "content",
      `${current.title} on MoviePulse. Read the movie article, explore the cast, watch the official trailer, and discover the latest movie details.`
    );

  }

  let canonical =
    document.querySelector('link[rel="canonical"]');

  if (!canonical) {

    canonical = document.createElement("link");

    canonical.rel = "canonical";

    document.head.appendChild(canonical);

  }

  canonical.href =
    `https://moviepulse247.netlify.app/trailer.html?id=${current.id}`;

}


// =====================================================
// GET RECOMMENDATIONS
// =====================================================

function getRecommendations(currentMovie) {

  const pool = movies.filter(
    m => m.id !== currentMovie.id
  );

  const shuffled = [...pool].sort(
    () => Math.random() - 0.5
  );

  return {

    related: shuffled.slice(0, 6),

    more: shuffled.slice(6, 12),

    others: shuffled.slice(12, 50)

  };

}


// =====================================================
// HTML ESCAPE
// =====================================================

function escapeHTML(value) {

  if (value === null || value === undefined) {

    return "";

  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


// =====================================================
// RENDER PAGE
// =====================================================

function loadMain(movie) {

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  const recommendations =
    getRecommendations(movie);


  document.getElementById("mainArea").innerHTML = `

    <div class="movie-page">


      <h1 class="title">
        ${escapeHTML(movie.title)}
      </h1>


      <div class="content-wrap">


        <div class="poster-column">


          <img
            class="hero-poster"
            src="${escapeHTML(movie.poster || "")}"
            alt="${escapeHTML(movie.title)}"
          >


          <div class="movie-rating">

            ${"⭐".repeat(
              Math.round(movie.rating || 0)
            )}

          </div>


          <!-- RATING -->

          <div class="engagement-box">

            <div class="rating-box">

              <h3>
                ⭐ Rate This Movie
              </h3>


              <div
                class="stars"
                id="stars"
              >

                <span data-rate="1">☆</span>

                <span data-rate="2">☆</span>

                <span data-rate="3">☆</span>

                <span data-rate="4">☆</span>

                <span data-rate="5">☆</span>

              </div>


              <p>
                User Rating:
                <span id="averageRating">
                  0
                </span>/5
              </p>


              <p>
                <span id="voteCount">
                  0
                </span>
                votes
              </p>

            </div>

          </div>


        </div>


        <div class="article-side">

          ${movie.article || ""}

        </div>


      </div>


      <div class="article-full"></div>


      <!-- VERDICT -->

      <div class="verdict-box">

        <div class="verdict-label">
          🔥 MOVIEPULSE VERDICT
        </div>


        <h2>
          ${escapeHTML(
            movie.verdictTitle ||
            "Worth Keeping an Eye On?"
          )}
        </h2>


        <p class="verdict-text">

          ${movie.verdict ||
            "This is one of those movies that deserves a spot on your watchlist. But the real question is... will it live up to the hype? 👀"}

        </p>


        <div class="hype-row">

          <span class="hype-label">
            🔥 Hype Level
          </span>


          <div class="hype-bar">

            <div
              class="hype-fill"
              style="width:${
                (movie.hype ||
                movie.rating ||
                5) * 10
              }%"
            >
            </div>

          </div>


          <span class="hype-score">

            ${movie.hype ||
              movie.rating ||
              5}/10

          </span>

        </div>

      </div>


      <!-- ================================================= -->
      <!-- WATCH FULL MOVIE -->
      <!-- ================================================= -->

      ${
        movie.archiveId
          ? `

      <div class="watch-full-section">

        <a
          href="watch.html?id=${encodeURIComponent(movie.id)}"
          class="watch-full-btn"
        >
          🎬 Watch Full Movie
        </a>

      </div>

      `
          : ""
      }


      <!-- ================================================= -->
      <!-- YOUTUBE TRAILER -->
      <!-- ================================================= -->

      <div class="video-container">

        <h2 class="section-title">

          ${escapeHTML(movie.title)}
          Official Trailer

        </h2>


        ${
          movie.trailer
            ? `

        <iframe
          class="video-frame"
          src="${escapeHTML(movie.trailer)}"
          title="${escapeHTML(movie.title)} Official Trailer"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen>
        </iframe>

        `
            : `

        <p>
          Official trailer is not available yet.
        </p>

        `
        }

      </div>


      <!-- COMMENTS -->

      <div class="comments-box">

        <h2 class="section-title">
          💬 Comments
        </h2>


        <textarea
          id="commentInput"
          placeholder="Write your comment..."
        ></textarea>


        <button id="commentBtn">

          🚀 Share Your Thoughts

        </button>


        <div id="commentsList"></div>

      </div>


      <!-- SUMMARY -->

      <div class="summary-box">

        <h2 class="section-title">
          Movie Summary
        </h2>


        <p>
          ${movie.summary ||
            "No summary available."}
        </p>

      </div>


      <!-- STARRING -->

      <div class="starring-section">

        <h2 class="section-title">
          Starring
        </h2>


        <p>

          ${
            Array.isArray(movie.starring)
              ? movie.starring
                  .map(actor => escapeHTML(actor))
                  .join(", ")
              : escapeHTML(
                  movie.starring || "N/A"
                )
          }

        </p>

      </div>


      <!-- FEATURED PICKS -->

      <h2 class="section-title">
        Featured picks
      </h2>


      <div class="recommend-grid">

        ${recommendations.related.map(rec => `

          <div
            class="recommend-card"
            onclick="location.href='trailer.html?id=${encodeURIComponent(rec.id)}'"
          >

            <img
              src="${escapeHTML(rec.poster || "")}"
              alt="${escapeHTML(rec.title)}"
            >

            <h4>
              ${escapeHTML(rec.title)}
            </h4>

            <small>
              ⭐ ${rec.rating || 0}
            </small>

          </div>

        `).join("")}

      </div>


      <!-- MORE -->

      <h2 class="section-title">
        More You May Like
      </h2>


      <div class="recommend-grid">

        ${recommendations.more.map(rec => `

          <div
            class="recommend-card"
            onclick="location.href='trailer.html?id=${encodeURIComponent(rec.id)}'"
          >

            <img
              src="${escapeHTML(rec.poster || "")}"
              alt="${escapeHTML(rec.title)}"
            >

            <h4>
              ${escapeHTML(rec.title)}
            </h4>

            <small>
              ⭐ ${rec.rating || 0}
            </small>

          </div>

        `).join("")}

      </div>


      <!-- OTHER MOVIES -->

      <h2 class="section-title">
        Other Movies
      </h2>


      <div class="recommend-grid">

        ${recommendations.others.map(rec => `

          <div
            class="recommend-card"
            onclick="location.href='trailer.html?id=${encodeURIComponent(rec.id)}'"
          >

            <img
              src="${escapeHTML(rec.poster || "")}"
              alt="${escapeHTML(rec.title)}"
            >

            <h4>
              ${escapeHTML(rec.title)}
            </h4>

            <small>
              ⭐ ${rec.rating || 0}
            </small>

          </div>

        `).join("")}

      </div>


    </div>

  `;

}


// =====================================================
// BACK BUTTON
// =====================================================

const backBtn =
  document.getElementById("backBtn");


if (backBtn) {

  backBtn.href = id
    ? `movie.html?id=${encodeURIComponent(id)}`
    : "/";

}


// =====================================================
// MOBILE MENU
// =====================================================

const menuBtn =
  document.querySelector(".menu-btn");

const nav =
  document.querySelector("nav");


if (menuBtn) {

  menuBtn.addEventListener(
    "click",
    function () {

      if (nav) {

        nav.classList.toggle("active");

      }

    }
  );

}


// =====================================================
// USER RATING SYSTEM
// =====================================================

async function setupRating() {

  const stars =
    document.querySelectorAll(
      ".stars span"
    );


  stars.forEach(star => {

    star.addEventListener(
      "click",
      async () => {

        const value =
          Number(star.dataset.rate);


        try {

          await addDoc(
            collection(db, "ratings"),
            {
              movieId: current.id,
              rating: value,
              createdAt: new Date()
            }
          );


          showRating();

        } catch (error) {

          console.error(
            "Rating error:",
            error
          );

        }

      }
    );

  });

}


// =====================================================
// SHOW RATING
// =====================================================

async function showRating() {

  const average =
    document.getElementById(
      "averageRating"
    );


  const votes =
    document.getElementById(
      "voteCount"
    );


  if (!average || !votes) return;


  try {

    const snapshot =
      await getDocs(
        collection(db, "ratings")
      );


    let ratings = [];


    snapshot.forEach(doc => {

      const data =
        doc.data();


      if (
        String(data.movieId) ===
        String(current.id)
      ) {

        ratings.push(
          Number(data.rating)
        );

      }

    });


    if (ratings.length === 0) {

      average.innerText = "0";

      votes.innerText = "0";

      return;

    }


    const total =
      ratings.reduce(
        (a, b) => a + b,
        0
      );


    average.innerText =
      (total / ratings.length)
        .toFixed(1);


    votes.innerText =
      ratings.length;


  } catch (error) {

    console.error(
      "Rating loading error:",
      error
    );

  }

}


// =====================================================
// COMMENTS SYSTEM
// =====================================================

async function addComment() {

  const input =
    document.getElementById(
      "commentInput"
    );


  if (!input) return;


  const text =
    input.value.trim();


  if (!text) return;


  try {

    await addDoc(
      collection(db, "comments"),
      {
        movieId: current.id,
        text: text,
        createdAt: new Date()
      }
    );


    input.value = "";


    loadComments();


  } catch (error) {

    console.error(
      "Comment error:",
      error
    );

  }

}


// =====================================================
// LOAD COMMENTS
// =====================================================

async function loadComments() {

  const box =
    document.getElementById(
      "commentsList"
    );


  if (!box) return;


  try {

    const q =
      query(
        collection(db, "comments"),
        where(
          "movieId",
          "==",
          current.id
        ),
        orderBy(
          "createdAt",
          "desc"
        )
      );


    const snapshot =
      await getDocs(q);


    box.innerHTML = "";


    if (snapshot.empty) {

      box.innerHTML = `

        <p class="no-comments">
          No comments yet. Be the first to share your thoughts! 🍿
        </p>

      `;

      return;

    }


    snapshot.forEach(doc => {

      const data =
        doc.data();


      box.innerHTML += `

        <div class="comment-item">

          <strong>
            ${escapeHTML(
              data.username ||
              "MoviePulse User"
            )}
          </strong>

          <br>

          💬
          ${escapeHTML(
            data.text || ""
          )}

        </div>

      `;

    });


  } catch (error) {

    console.error(
      "Comments loading error:",
      error
    );


    box.innerHTML = `

      <p>
        Unable to load comments right now.
      </p>

    `;

  }

}


// =====================================================
// PAGE LOAD
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    if (!current) {

      document.getElementById(
        "mainArea"
      ).innerHTML = `

        <h1>
          Movie Not Found
        </h1>

        <p>
          We couldn't find this movie.
        </p>

      `;

      return;

    }


    // Render page
    loadMain(current);


    // Wait for dynamically-created elements
    setTimeout(() => {

      setupRating();

      showRating();

      loadComments();


      const btn =
        document.getElementById(
          "commentBtn"
        );


      if (btn) {

        btn.addEventListener(
          "click",
          addComment
        );

      }

    }, 300);


    // Back button
    const backBtn =
      document.getElementById(
        "backBtn"
      );


    if (backBtn) {

      backBtn.href = id
        ? `movie.html?id=${encodeURIComponent(id)}`
        : "/";

    }

  }
);
