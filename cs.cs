

:root {
  --bg: #090b10;
  --panel: #121620;
  --panel-hover: #191f2b;
  --line: #262d3b;
  --text: #f4f6fc;
  --muted: #929caf;
  --blue: #2E8CFF;
  --blue-hover: #66ADFF;
  --green: #2ee59d;
  --yellow: #f2c65b;
  --red: #ff6b78;
  --radius: 16px;
  
  --highlight-bg: #2E8CFF;
  --highlight-text: #ffffff;
}

::selection {
  background-color: var(--highlight-bg);
  color: var(--highlight-text);
}

::-webkit-selection {
  background-color: var(--highlight-bg);
  color: var(--highlight-text);
}

* { 
  box-sizing: border-box; 
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: radial-gradient(ellipse at top, #151b29 0%, transparent 55%), var(--bg);
  color: var(--text);
  font: 15px/1.6 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  min-height: 100vh;
}

h1 {
  font-size: clamp(27px, 4vw, 38px);
  letter-spacing: -1.2px;
  line-height: 1.2;
  margin: 0 0 10px;
}

h2 { 
  font-size: 18px; 
  line-height: 1.35; 
  margin: 0 0 8px; 
  overflow-wrap: anywhere;
}

a, a:visited { 
  color: var(--blue); 
  text-decoration: none; 
}

a:hover, a:focus { 
  color: var(--blue-hover); 
  text-decoration: underline; 
}

header {
  padding: 25px max(20px, calc((100% - 1100px) / 2));
  background: rgba(12, 15, 22, 0.88);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(16px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.brand {
  font-size: 27px;
  font-weight: 850;
  letter-spacing: -1px;
}

.brand span {
  color: var(--blue);
}

.sub, .muted-text {
  color: var(--blue-hover);
  font-size: 14px;
}

main {
  max-width: 1140px;
  margin: auto;
  padding: 35px 20px;
}

footer { 
  padding: 25px 0; 
  color: var(--muted); 
  font-size: 12px; 
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 26px 0 18px;
}

input, select, button {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 11px;
  padding: 12px 15px;
  font: inherit;
  outline: none;
  transition: border-color .2s, background .2s, transform .2s;
}

input { 
  flex: 1; 
  min-width: 200px; 
}

input::placeholder { 
  color: #6f798c; 
}

input:focus, select:focus {
  border-color: var(--green);
  box-shadow: 0 0 0 3px rgba(46, 229, 157, .09);
}

select, button { 
  cursor: pointer; 
}

button { 
  font-weight: 650; 
}

button:hover {
  border-color: var(--blue);
  background: #19241f;
}

button:active { 
  transform: scale(.97); 
}

button:disabled { 
  opacity: .65; 
  cursor: wait; 
}

.status { 
  min-height: 24px;
  font-size: 12px; 
  color: var(--muted); 
  margin: 14px 0 20px; 
}

.grid, #movies, #ebert-feed {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  align-items: stretch;
}

.movie {
  background: linear-gradient(145deg, #151a25, #10141c);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease;
}

.movie:hover {
  transform: translateY(-5px);
  border-color: #3b485b;
  box-shadow: 0 15px 35px rgba(0, 0, 0, .22);
}

.movie img {
  display: block;
  width: 100%;
  height: 210px;
  object-fit: cover;
  background: #202633;
}

.content { 
  padding: 19px; 
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.year { 
  color: var(--muted); 
  font-size: 12px; 
}

.scores {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 18px 0;
}

.score {
  background: rgba(5, 8, 13, .55);
  border: 1px solid #202635;
  padding: 13px;
  border-radius: 11px;
  min-width: 0;
}

.score-label {
  font-size: 10px;
  color: var(--muted);
  font-weight: 750;
  letter-spacing: .5px;
}

.number {
  font-size: clamp(25px, 3vw, 31px);
  font-weight: 850;
  letter-spacing: -1px;
  line-height: 1.4;
}

.review-card {
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
  color: var(--text);
  display: flex;
  flex-direction: column;
  min-width: 0;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.review-card:hover {
  transform: translateY(-3px);
  background: var(--panel-hover);
  box-shadow: 0 7px 20px rgba(0, 0, 0, 0.2);
}

.review-card h3 {
  font-size: 1.2rem;
  line-height: 1.4;
  margin: 0 0 10px;
}

.review-card h3 a {
  color: var(--text);
}

.review-meta {
  color: var(--muted);
  font-size: 0.85rem;
  margin: 0 0 14px;
}

.review-excerpt {
  color: var(--muted);
  font-size: 0.96rem;
  line-height: 1.7;
  margin: 0 0 18px;
  overflow-wrap: anywhere;
}

.review-card .read-more {
  margin-top: auto;
  color: var(--blue);
  font-weight: 600;
}

.source { 
  color: var(--blue); 
  font-size: 12px; 
  margin-bottom: 8px; 
}

.description { 
  color: var(--muted); 
  font-size: 13px; 
  margin: 12px 0; 
}

.meta { 
  font-size: 12px; 
  color: var(--muted); 
}

.review-links, .rating-links { 
  margin-top: 14px; 
  font-size: 13px; 
}

.rating-links {
  display: flex; 
  flex-wrap: wrap; 
  gap: 16px;
}

.rating-links a {
  display: inline-block;
  color: var(--blue);
  padding: 8px 0;
  text-decoration: underline;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 18px;
  margin: 24px 0;
}

.panel h2 { 
  margin-bottom: 12px; 
}

.rating-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 14px 0;
}

.rating {
  flex: 1;
  min-width: 130px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
}

.rating strong { 
  display: block; 
  font-size: 20px; 
  color: var(--blue); 
}

.rating small { 
  color: var(--muted); 
}

.error { color: var(--red); }
.empty { color: var(--muted); padding: 20px 0; }

@media (max-width: 600px) {
  #movies, #ebert-feed, .grid {
    grid-template-columns: 1fr;
  }
  .review-card {
    padding: 18px;
  }
}

@media (max-width: 450px) {
  header { padding: 22px 16px; }
  main { padding: 20px 14px; }
}
