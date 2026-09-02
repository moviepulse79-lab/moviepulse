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
// INTERNET ARCHIVE PLAYER
// =====================================================

async function loadInternetArchivePlayer(movie) {

  const container =
    document.getElementById("internetArchivePlayer");

  if (!container) return;


  // ---------------------------------------------------
  // No Internet Archive ID
  // ---------------------------------------------------

  if (!movie.archiveId) {

    container.innerHTML = `

      <div class="archive-unavailable">

        <h3>🎬 Watch Movie</h3>

        <p>
          Full movie streaming is not currently available
          for this title on MoviePulse.
        </p>

      </div>

    `;

    return;

  }


  // ---------------------------------------------------
  // Loading
  // ---------------------------------------------------

  container.innerHTML = `

    <div class="archive-loading">

      <div class="archive-spinner"></div>

      <p>
        Loading movie player...
      </p>

    </div>

  `;


  try {

    // Internet Archive Metadata API
    const response = await fetch(
      `https://archive.org/metadata/${encodeURIComponent(movie.archiveId)}`
    );


    if (!response.ok) {

      throw new Error(
        `Internet Archive returned ${response.status}`
      );

    }


    const data = await response.json();


    // -------------------------------------------------
    // Check API response
    // -------------------------------------------------

    if (!data || !Array.isArray(data.files)) {

      throw new Error(
        "No files were returned by Internet Archive."
      );

    }


    // -------------------------------------------------
    // Find playable video files
    // -------------------------------------------------

    const playableFiles = data.files.filter(file => {

      if (!file || !file.name) return false;


      const name =
        file.name.toLowerCase();


      // Ignore metadata / thumbnails / torrents
      if (
        name.includes("_meta") ||
        name.includes("_files") ||
        name.includes("thumb") ||
        name.endsWith(".torrent") ||
        name.endsWith(".xml") ||
        name.endsWith(".json") ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".png") ||
        name.endsWith(".gif")
      ) {

        return false;

      }


      // Supported browser video formats
      return (
        name.endsWith(".mp4") ||
        name.endsWith(".webm") ||
        name.endsWith(".ogv") ||
        name.endsWith(".ogg")
      );

    });


    // -------------------------------------------------
    // No playable file
    // -------------------------------------------------

    if (playableFiles.length === 0) {

      throw new Error(
        "No browser-compatible video file was found."
      );

    }


    // -------------------------------------------------
    // Choose best file
    // -------------------------------------------------

    const selectedFile =
      chooseBestVideoFile(playableFiles);


    // -------------------------------------------------
    // Build Internet Archive video URL
    // -------------------------------------------------

    const videoURL =
      `https://archive.org/download/` +
      `${encodeURIComponent(movie.archiveId)}/` +
      `${encodeURIComponent(selectedFile.name)}`;


    // -------------------------------------------------
    // Determine MIME type
    // -------------------------------------------------

    const mimeType =
      getVideoMimeType(selectedFile.name);


    // -------------------------------------------------
    // Render player
    // -------------------------------------------------

    container.innerHTML = `

      <div class="archive-player-box">

        <h2 class="section-title">
          🎬 Watch ${escapeHTML(movie.title)}
        </h2>

        <div class="archive-video-wrapper">

          <video
            class="archive-video"
            controls
            playsinline
            preload="metadata"
            poster="${escapeHTML(movie.poster || "")}"
          >

            <source
              src="${videoURL}"
              type="${mimeType}"
            >

            Your browser does not support HTML5 video.

          </video>

        </div>

        <div class="archive-info">

          <span>
            📚 Source: Internet Archive
          </span>

          <a
            href="https://archive.org/details/${encodeURIComponent(movie.archiveId)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Archive Item
          </a>

        </div>

      </div>

    `;


    // -------------------------------------------------
    // Handle video errors
    // -------------------------------------------------

    const video =
      container.querySelector(".archive-video");


    if (video) {

      video.addEventListener("error", () => {

        console.error(
          "Internet Archive video could not be played:",
          videoURL
        );


        container.insertAdjacentHTML(
          "beforeend",
          `

          <div class="archive-error">

            ⚠️ This video could not be played
            in your browser.

            <br>

            <a
              href="${videoURL}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open video file
            </a>

          </div>

          `
        );

      });

    }


  } catch (error) {

    console.error(
      "Internet Archive error:",
      error
    );


    container.innerHTML = `

      <div class="archive-unavailable">

        <h3>🎬 Watch Movie</h3>

        <p>
          The full movie could not be loaded right now.
        </p>

        <small>
          ${escapeHTML(error.message)}
        </small>

      </div>

    `;

  }

}


// =====================================================
// CHOOSE BEST VIDEO FILE
// =====================================================

function chooseBestVideoFile(files) {

  const mp4Files =
    files.filter(file =>
      file.name.toLowerCase().endsWith(".mp4")
    );


  const webmFiles =
    files.filter(file =>
      file.name.toLowerCase().endsWith(".webm")
    );


  const ogvFiles =
    files.filter(file =>
      file.name.toLowerCase().endsWith(".ogv") ||
      file.name.toLowerCase().endsWith(".ogg")
    );


  // Prefer MP4 because browser/device compatibility
  // is generally better.

  if (mp4Files.length > 0) {

    return chooseLargestReasonableFile(mp4Files);

  }


  if (webmFiles.length > 0) {

    return chooseLargestReasonableFile(webmFiles);

  }


  return chooseLargestReasonableFile(ogvFiles);

}


// =====================================================
// CHOOSE VIDEO QUALITY
// =====================================================

function chooseLargestReasonableFile(files) {

  return [...files].sort((a, b) => {

    const sizeA =
      Number(a.size || 0);

    const sizeB =
      Number(b.size || 0);

    return sizeB - sizeA;

  })[0];

}


// =====================================================
// MIME TYPE
// =====================================================

function getVideoMimeType(filename) {

  const name =
    filename.toLowerCase();


  if (name.endsWith(".mp4")) {

    return "video/mp4";

  }


  if (name.endsWith(".webm")) {

    return "video/webm";

  }


  if (
    name.endsWith(".ogv") ||
    name.endsWith(".ogg")
  ) {

    return "video/ogg";

  }


  return "video/mp4";

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
        ${movie.title}
      </h1>


      <div class="content-wrap">


        <div class="poster-column">


          <img
            class="hero-poster"
            src="${movie.poster}"
            alt="${movie.title}"
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
          ${movie.verdictTitle ||
            "Worth Keeping an Eye On?"}
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
      <!-- YOUTUBE TRAILER -->
      <!-- ================================================= -->

      <div class="video-container">

        <h2 class="section-title">

          ${movie.title}
          Official Trailer

        </h2>


        <iframe
          class="video-frame"
          src="${movie.trailer || ""}"
          title="${movie.title} Official Trailer"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen>
        </iframe>

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
              ? movie.starring.join(", ")
              : movie.starring || "N/A"
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
            onclick="location.href='trailer.html?id=${rec.id}'"
          >

            <img
              src="${rec.poster}"
              alt="${rec.title}"
            >

            <h4>
              ${rec.title}
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
            onclick="location.href='trailer.html?id=${rec.id}'"
          >

            <img
              src="${rec.poster}"
              alt="${rec.title}"
            >

            <h4>
              ${rec.title}
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
            onclick="location.href='trailer.html?id=${rec.id}'"
          >

            <img
              src="${rec.poster}"
              alt="${rec.title}"
            >

            <h4>
              ${rec.title}
            </h4>

            <small>
              ⭐ ${rec.rating || 0}
            </small>

          </div>

        `).join("")}

      </div>


    </div>

  `;


  // =====================================================
  // START INTERNET ARCHIVE PLAYER
  // =====================================================

  loadInternetArchivePlayer(movie);

}


// =====================================================
// BACK BUTTON
// =====================================================

const backBtn =
  document.getElementById("backBtn");


if (backBtn) {

  backBtn.href = id
    ? `movie.html?id=${id}`
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

      nav.classList.toggle("active");

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
        ? `movie.html?id=${id}`
        : "/";

    }

  }
);
