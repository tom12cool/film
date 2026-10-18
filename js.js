
"use strict";

/* =========================================
   CriticGuide — Movie Reviews and Ratings
   File: js.js
   ========================================= */

const EBERT_FEEDS = [
  "https://www.rogerebert.com/reviews/feed",
  "https://www.rogerebert.com/feed"
];

const MOVIEFONE_FEEDS = [
  "https://www.moviefone.com/feeds/reviews.json",
  "https://www.moviefone.com/feeds/reviews.rss"
];

const PROXIES = [
  url =>
    "https://api.allorigins.win/raw?url=" +
    encodeURIComponent(url),

  url =>
    "https://corsproxy.io/?" +
    new URLSearchParams({ url }).toString()
];

const $ = id => document.getElementById(id);

let reviews = [];


/* =========================================
   GENERAL HELPERS
   ========================================= */

function status(id, message) {
  const element = $(id);

  if (element) {
    element.textContent = message;
  }
}

function text(value) {
  if (value == null) return "";

  if (typeof value === "object") {
    return text(
      value.name ??
      value._ ??
      value.text ??
      value.value ??
      value.content_text ??
      ""
    );
  }

  const doc = new DOMParser().parseFromString(
    String(value),
    "text/html"
  );

  return (doc.body.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value) {
  if (!value) return "";

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
}

function safeLink(value) {
  if (!value) return "";

  try {
    const url = new URL(
      String(value),
      window.location.href
    );

    return ["https:", "http:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
}


/* =========================================
   NORMALIZE REVIEW ENTRIES
   ========================================= */

function normalize(item, source) {
  const rawLink =
    item.link?.href ??
    item.link?.["@_href"] ??
    item.link ??
    item.url ??
    item.guid ??
    "";

  const description = text(
    item.description ??
    item.summary ??
    item.content_text ??
    item.content_html ??
    item.content ??
    item["content:encoded"] ??
    item.encoded ??
    ""
  );

  const excerpt = description
    ? description.length > 280
      ? description.slice(0, 277).trimEnd() + "..."
      : description
    : source === "RogerEbert.com"
      ? "Read the full review on RogerEbert.com."
      : "";

  return {
    title: text(item.title ?? item.name) ||
      "Untitled review",

    link: safeLink(rawLink),

    description,
    excerpt,

    date: text(
      item.pubDate ??
      item.published ??
      item.updated ??
      item.date ??
      item["dc:date"] ??
      ""
    ),

    author: text(
      item.author?.name ??
      item.author ??
      item.creator ??
      item["dc:creator"] ??
      ""
    ),

    source
  };
}


/* =========================================
   PARSE JSON, RSS AND ATOM FEEDS
   ========================================= */

function parseFeed(data, source) {
  // First, try JSON and JSON Feed formats.
  try {
    const json = JSON.parse(data);

    const items = Array.isArray(json)
      ? json
      : json.items ??
        json.results ??
        json.articles ??
        json.feed?.items ??
        json.data ??
        [];

    if (Array.isArray(items)) {
      return items
        .map(item => normalize(item, source))
        .filter(item =>
          item.title !== "Untitled review"
        );
    }
  } catch {
    // Not JSON; continue to XML parsing.
  }

  // Parse RSS or Atom XML.
  const xml = new DOMParser().parseFromString(
    data,
    "application/xml"
  );

  if (xml.querySelector("parsererror")) {
    throw new Error(
      "The response was not valid JSON or RSS/XML."
    );
  }

  const entries = [
    ...xml.getElementsByTagName("item"),
    ...xml.getElementsByTagName("entry")
  ];

  function getField(entry, names) {
    const nodes = [...entry.getElementsByTagName("*")];

    for (const name of names) {
      const found = nodes.find(node =>
        node.localName?.toLowerCase() ===
        name.toLowerCase()
      );

      if (found) {
        return found.textContent.trim();
      }
    }

    return "";
  }

  return entries
    .map(entry => {
      const nodes = [
        ...entry.getElementsByTagName("*")
      ];

      const linkNode = nodes.find(node =>
        node.localName?.toLowerCase() === "link" &&
        (
          node.getAttribute("rel") === "alternate" ||
          !node.getAttribute("rel")
        )
      );

      const link =
        linkNode?.getAttribute("href") ||
        linkNode?.textContent?.trim() ||
        getField(entry, ["guid", "id"]);

      return normalize({
        title: getField(entry, ["title"]),

        link,

        description: getField(entry, [
          "description",
          "summary",
          "content",
          "encoded",
          "content:encoded"
        ]),

        pubDate: getField(entry, [
          "pubDate",
          "published",
          "updated",
          "date"
        ]),

        author: getField(entry, [
          "creator",
          "author",
          "name"
        ])
      }, source);
    })
    .filter(item =>
      item.title !== "Untitled review"
    );
}


/* =========================================
   FETCH FEEDS WITH PROXY FALLBACK
   ========================================= */

async function fetchFeed(url) {
  let lastError;

  for (const makeProxyURL of PROXIES) {
    let timeout;

    try {
      const controller = new AbortController();

      timeout = setTimeout(
        () => controller.abort(),
        12000
      );

      const response = await fetch(
        makeProxyURL(url),
        {
          cache: "no-store",
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.text();

      if (!data.trim()) {
        throw new Error("Empty feed response.");
      }

      return data;
    } catch (error) {
      lastError = error;

      console.warn(
        "Feed request failed:",
        error.message
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ||
    new Error("All feed requests failed.");
}


/* =========================================
   RENDER REVIEW CARDS
   ========================================= */

function render(containerId, items, emptyMessage) {
  const container = $(containerId);

  if (!container) return;

  container.replaceChildren();

  if (!items.length) {
    const message = document.createElement("p");

    message.className = "muted";
    message.textContent = emptyMessage;

    container.appendChild(message);
    return;
  }

  items.forEach(review => {
    const article = document.createElement("article");

    article.className = "movie-card review-card";

    const heading = document.createElement("h3");

    if (review.link) {
      const titleLink = document.createElement("a");

      titleLink.href = review.link;
      titleLink.target = "_blank";
      titleLink.rel = "noopener noreferrer";
      titleLink.textContent = review.title;

      heading.appendChild(titleLink);
    } else {
      heading.textContent = review.title;
    }

    const metadata = document.createElement("p");

    metadata.className = "muted";

    metadata.textContent = [
      review.source,
      review.author,
      formatDate(review.date)
    ].filter(Boolean).join(" · ");

    article.append(heading, metadata);

    // RogerEbert shows a short excerpt.
    // Other sources show their available description.
    const description = document.createElement("p");

    description.textContent =
      review.source === "RogerEbert.com"
        ? review.excerpt
        : review.description;

    if (description.textContent) {
      article.appendChild(description);
    }

    // Give RogerEbert cards a separate full-review link.
    if (
      review.source === "RogerEbert.com" &&
      review.link
    ) {
      const fullLink = document.createElement("a");

      fullLink.href = review.link;
      fullLink.textContent = "Read full review →";
      fullLink.target = "_blank";
      fullLink.rel = "noopener noreferrer";

      article.appendChild(fullLink);
    }

    container.appendChild(article);
  });
}


/* =========================================
   SEARCH, FILTER AND SORT REVIEWS
   ========================================= */

function filterReviews() {
  const query = ($("search")?.value || "")
    .trim()
    .toLowerCase();

  const source = $("source")?.value || "all";
  const sort = $("sort")?.value || "newest";

  const filtered = reviews.filter(review => {
    const matchesSource =
      source === "all" ||
      review.source === source;

    const matchesSearch = [
      review.title,
      review.description,
      review.excerpt,
      review.author
    ].some(value =>
      String(value || "")
        .toLowerCase()
        .includes(query)
    );

    return matchesSource && matchesSearch;
  });

  filtered.sort((a, b) => {
    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }

    const dateA = Date.parse(a.date) || 0;
    const dateB = Date.parse(b.date) || 0;

    return sort === "oldest"
      ? dateA - dateB
      : dateB - dateA;
  });

  render(
    "movies",
    filtered,
    "No reviews match your search."
  );

  status(
    "status",
    `${filtered.length} reviews shown.`
  );
}


/* =========================================
   LOAD A REVIEW SOURCE
   ========================================= */

async function loadSource(
  urls,
  source,
  containerId,
  statusId
) {
  status(statusId, `Loading ${source} reviews...`);

  let lastError;

  for (const url of urls) {
    try {
      const data = await fetchFeed(url);
      const items = parseFeed(data, source);

      if (!items.length) {
        throw new Error("No review entries found.");
      }

      // Replace only the reviews from this source.
      reviews = [
        ...reviews.filter(
          review => review.source !== source
        ),
        ...items
      ];

      render(
        containerId,
        items,
        `No ${source} reviews found.`
      );

      status(
        statusId,
        `${items.length} ${source} reviews loaded.`
      );

      filterReviews();

      return items;
    } catch (error) {
      lastError = error;

      console.warn(
        `${source} feed failed:`,
        error.message
      );
    }
  }

  status(
    statusId,
    `${source} feed unavailable. ${
      lastError?.message || ""
    }`
  );

  render(
    containerId,
    [],
    `${source} reviews could not be loaded.`
  );

  return [];
}


/* =========================================
   REFRESH REVIEW FEEDS
   ========================================= */

function refreshReviews() {
  status("status", "Refreshing review feeds...");

  return Promise.allSettled([
    loadSource(
      EBERT_FEEDS,
      "RogerEbert.com",
      "ebert-feed",
      "ebert-status"
    ),

    loadSource(
      MOVIEFONE_FEEDS,
      "Moviefone",
      "moviefone-movies",
      "moviefone-status"
    )
  ]);
}


/* =========================================
   RATINGS SEARCH LINKS
   ========================================= */

function ratingLinks(title) {
  const links = {
    "imdb-link":
      "https://www.imdb.com/find/?q=" +
      encodeURIComponent(title),

    "rotten-link":
      "https://www.rottentomatoes.com/search?search=" +
      encodeURIComponent(title),

    "metacritic-link":
      "https://www.google.com/search?q=" +
      encodeURIComponent(
        "site:metacritic.com/movie " + title
      ),

    "rogerebert-link":
      "https://www.google.com/search?q=" +
      encodeURIComponent(
        "site:rogerebert.com/reviews " + title
      ),

    "moviefone-link":
      "https://www.google.com/search?q=" +
      encodeURIComponent(
        "site:moviefone.com " + title
      )
  };

  Object.entries(links).forEach(([id, url]) => {
    const link = $(id);

    if (link) {
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });
}


/* =========================================
   SEARCH SAVED MOVIE RATINGS
   ========================================= */

async function searchRatings() {
  const title = $("rating-search")?.value.trim();

  if (!title) {
    status("rating-status", "Enter a movie title.");
    return;
  }

  status("rating-status", "Searching saved ratings...");

  try {
    const response = await fetch("./json.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Could not load json.json.");
    }

    const data = await response.json();

    // Supports one movie object or an array of movies.
    const movies = Array.isArray(data)
      ? data
      : [data];

    const movie = movies.find(item =>
      typeof item.title === "string" &&
      item.title.trim().toLowerCase() ===
        title.toLowerCase()
    );

    if (!movie) {
      status(
        "rating-status",
        "Movie not found in json.json."
      );

      return;
    }

    const titleElement = $("rating-title");

    if (titleElement) {
      titleElement.textContent =
        movie.title +
        (movie.year ? ` (${movie.year})` : "");
    }

    const imdb = $("imdb");
    const rotten = $("rotten");
    const metacritic = $("metacritic");
    const rogerebert = $("rogerebert");
    const moviefone = $("moviefone");

    if (imdb) {
      imdb.textContent =
        movie.imdb != null
          ? `${movie.imdb}/10`
          : "N/A";
    }

    if (rotten) {
      rotten.textContent =
        movie.rt != null
          ? `${movie.rt}%`
          : "N/A";
    }

    if (metacritic) {
      metacritic.textContent =
        movie.mc != null
          ? `${movie.mc}/100`
          : "N/A";
    }

    if (rogerebert) {
      rogerebert.textContent =
        movie.rogerEbert ?? "N/A";
    }

    if (moviefone) {
      moviefone.textContent =
        movie.moviefone ?? "N/A";
    }

    ratingLinks(movie.title);

    status("rating-status", "Saved ratings loaded.");
  } catch (error) {
    console.error("Rating search failed:", error);

    status(
      "rating-status",
      "Could not load ratings. Check json.json."
    );
  }
}


/* =========================================
   EVENT LISTENERS
   ========================================= */

$("rating-form")?.addEventListener(
  "submit",
  event => {
    event.preventDefault();
    searchRatings();
  }
);

$("rating-search")?.addEventListener(
  "input",
  event => {
    const title = event.target.value.trim();

    if (title) {
      ratingLinks(title);
    }
  }
);

$("search")?.addEventListener(
  "input",
  filterReviews
);

$("source")?.addEventListener(
  "change",
  filterReviews
);

$("sort")?.addEventListener(
  "change",
  filterReviews
);

$("refresh")?.addEventListener(
  "click",
  refreshReviews
);

$("refresh-moviefone")?.addEventListener(
  "click",
  () => {
    loadSource(
      MOVIEFONE_FEEDS,
      "Moviefone",
      "moviefone-movies",
      "moviefone-status"
    );
  }
);


/* =========================================
   INITIALIZE
   ========================================= */

refreshReviews();
