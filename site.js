const picture = document.getElementById("picture");
const snow = document.getElementById("static");
const slate = document.getElementById("slate");
const bug = document.getElementById("bug");
const banner = document.getElementById("banner");

const pad = (n) => String(n).padStart(2, "0");

const state = {
  channels: [],
  index: 0,
  last: 2,
  digits: "",
  digitTimer: 0,
  snowRaf: 0,
  hideBug: 0,
  hideBanner: 0,
  slateTimer: 0,
  guideCursor: 0,
  shows: [],
  philly: { videos: [], calendar: [] },
  queue: [],
  clipIndex: 0,
  clipArmed: false,
  tubeReady: false,
  yt: null,
  clipTimer: 0,
  muted: false,
};

function current() {
  return state.channels[state.index];
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function clipList(station = current()) {
  if (station?.kind === "philly") {
    return state.queue.length ? state.queue : state.philly.videos || [];
  }
  return Array.isArray(station?.videos) ? station.videos : [];
}

function shuffle(list) {
  const next = list.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function reshufflePhilly() {
  state.queue = shuffle(state.philly.videos || []);
  state.clipIndex = 0;
}

function peekNextClip() {
  const clips = clipList();
  if (clips.length < 2) return null;
  return clips[(state.clipIndex + 1) % clips.length];
}

function currentClip() {
  const clips = clipList();
  if (!clips.length) return null;
  return clips[state.clipIndex % clips.length];
}

function findIndex(ch) {
  const exact = state.channels.findIndex((c) => c.ch === ch);
  if (exact >= 0) return exact;
  let best = 0;
  let dist = Infinity;
  state.channels.forEach((c, i) => {
    const d = Math.abs(c.ch - ch);
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  return best;
}

function flashChrome() {
  bug.hidden = false;
  banner.hidden = false;
  window.clearTimeout(state.hideBug);
  window.clearTimeout(state.hideBanner);
  state.hideBug = window.setTimeout(() => {
    bug.hidden = true;
  }, 3800);
  state.hideBanner = window.setTimeout(() => {
    banner.hidden = true;
  }, 5000);
}

function setOsd(station, digitPreview) {
  const ch = digitPreview ?? pad(station.ch);
  document.getElementById("bug-ch").textContent = ch;
  document.getElementById("bug-net").textContent = station.net;
  document.getElementById("banner-ch").textContent = pad(station.ch);
  document.getElementById("banner-net").textContent = station.net;
  document.getElementById("banner-title").textContent =
    station.now || station.title || station.long;
  const nextLine = document.getElementById("banner-next");
  if (nextLine) nextLine.textContent = station.next || "";
  document.getElementById("banner-meta").textContent = station.duration || "LIVE";
}

function startSnow() {
  snow.hidden = false;
  const ctx = snow.getContext("2d");
  const paint = () => {
    const { width: w, height: h } = snow;
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 40 + Math.random() * 200;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    state.snowRaf = requestAnimationFrame(paint);
  };
  cancelAnimationFrame(state.snowRaf);
  paint();
}

function stopSnow() {
  cancelAnimationFrame(state.snowRaf);
  snow.hidden = true;
}

function showSlate(station) {
  document.getElementById("slate-ch").textContent = pad(station.ch);
  document.getElementById("slate-net").textContent = station.net;
  document.getElementById("slate-long").textContent = station.long;
  slate.hidden = false;
  slate.style.animation = "none";
  void slate.offsetWidth;
  slate.style.animation = "";
  window.clearTimeout(state.slateTimer);
  state.slateTimer = window.setTimeout(() => {
    slate.hidden = true;
  }, 2200);
}

function artStage(caption) {
  return `<div class="art-stage">
    <img src="assets/mud.jpg" alt="MUD EP cover" />
    <div class="art-wash"></div>
  </div>
  ${caption ?? ""}`;
}

function bandcampSrc(station) {
  const theme =
    "size=small/bgcol=0d1814/linkcol=4ec491/artwork=none/transparent=true/autoplay=true/";
  if (station.bandcampAlbum) {
    return `https://bandcamp.com/EmbeddedPlayer/album=${station.bandcampAlbum}/${theme}`;
  }
  return `https://bandcamp.com/EmbeddedPlayer/track=${station.bandcampTrack}/${theme}`;
}

function playerDock(station) {
  if (!station.bandcampAlbum && !station.bandcampTrack) return "";
  return `<div class="player-dock">
    <iframe title="${station.title || station.net}" src="${bandcampSrc(station)}" allow="autoplay"></iframe>
  </div>`;
}

function renderGuide(highlight) {
  const rows = state.channels
    .map((c, i) => {
      const on = i === state.index ? "is-on" : "";
      const hot = i === highlight ? "is-hot" : "";
      return `<tr class="guide-row ${hot}">
        <td>
          <button type="button" data-tune="${c.ch}" class="${on}">
            <span class="guide-ch">${pad(c.ch)}</span>
            <span class="guide-net">${c.net}</span>
            <span class="guide-now">${c.now || c.long}</span>
          </button>
        </td>
      </tr>`;
    })
    .join("");
  picture.innerHTML = `<div class="desk">
    <div class="guide-head">
      <div>
        <p class="guide-kicker">CRICKET JOE CABLE</p>
        <h1>Guide</h1>
      </div>
      <p class="guide-kicker">ENTER to tune</p>
    </div>
    <table class="guide-table"><tbody>${rows}</tbody></table>
  </div>`;
}

function renderShows() {
  const shows = state.shows;
  let body =
    '<p class="empty">Nothing posted yet. For booking, write <a href="mailto:hello@cricketjoe.com">hello@cricketjoe.com</a>.</p>';
  if (shows.length) {
    const rows = shows
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((show) => {
        const date = new Date(`${show.date}T12:00:00`).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const venue = show.url
          ? `<a href="${show.url}">${show.venue}</a>`
          : show.venue;
        return `<tr><td>${date}</td><td><strong>${venue}</strong><br />${show.city ?? ""}</td></tr>`;
      })
      .join("");
    body = `<table class="show-table"><tbody>${rows}</tbody></table>`;
  }
  picture.innerHTML = `<div class="desk">
    <p class="guide-kicker">ON THE BOOKS</p>
    <h1>Shows</h1>
    ${body}
  </div>`;
}

function renderAbout() {
  picture.innerHTML = `<div class="desk id-card">
    <p class="guide-kicker">STATION IDENTIFICATION</p>
    <h1>Cricket Joe</h1>
    <p>Philadelphia songwriter. Folk-pop songs with dirt still on them. Guitar, voice, and whoever shows up — lead guitar, bass, a rotating band, or just Shaun Carr in a room.</p>
    <p>The 2023 EP <strong>MUD</strong> is six songs, twenty-one minutes, on Mood Ring Records. Produced by Robin Carine of Special Candy.</p>
    <p>Influences that actually show up: Neutral Milk Hotel, the Mountain Goats, Animal Collective, Modest Mouse, Nick Drake, the Flaming Lips.</p>
  </div>`;
}

function renderMail() {
  picture.innerHTML = `<div class="desk mail-card">
    <p class="guide-kicker">VIEWER MAIL</p>
    <h1>Booking &amp; hello</h1>
    <p>Shows, songs, or just write.</p>
    <p><a href="mailto:hello@cricketjoe.com">hello@cricketjoe.com</a></p>
    <p><a href="https://cricketjoe.bandcamp.com/">cricketjoe.bandcamp.com</a></p>
    <p class="empty">Email on this domain still needs to be hooked up. Bandcamp is the surest line until then.</p>
  </div>`;
}

function youtubeSrc(id, autoplay) {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    controls: "0",
    enablejsapi: "1",
    origin: location.origin,
  });
  if (autoplay) params.set("autoplay", "1");
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

function loadYtApi() {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector("script[src*='youtube.com/iframe_api']")) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
}

function destroyYt() {
  try {
    state.yt?.destroy?.();
  } catch {
    /* player already gone */
  }
  state.yt = null;
}

function clearClipTimer() {
  window.clearTimeout(state.clipTimer);
  state.clipTimer = 0;
}

function teardownPhilly() {
  clearClipTimer();
  destroyYt();
}

function clipPoster(clip) {
  if (clip?.art) return clip.art;
  if (clip?.youtube) return `https://i.ytimg.com/vi/${clip.youtube}/hqdefault.jpg`;
  return "assets/mud.jpg";
}

function clipBandcampSrc(clip) {
  const theme =
    "size=small/bgcol=0d1814/linkcol=4ec491/artwork=none/transparent=true/autoplay=true/";
  if (clip.bandcampTrack) {
    return `https://bandcamp.com/EmbeddedPlayer/track=${clip.bandcampTrack}/${theme}`;
  }
  return `https://bandcamp.com/EmbeddedPlayer/album=${clip.bandcampAlbum}/${theme}`;
}

function armClipAdvance(clip) {
  clearClipTimer();
  if (!clip?.duration || clip.youtube) return;
  state.clipTimer = window.setTimeout(() => {
    if (!onPhillyChannel() || !state.clipArmed) return;
    skipClip(1, { auto: true });
  }, (Number(clip.duration) + 2) * 1000);
}

function attachYt() {
  const frame = picture.querySelector("iframe.yt-picture");
  if (!frame) return;
  frame.id = "yt-player";
  loadYtApi().then(() => {
    if (!onPhillyChannel() || !state.clipArmed) return;
    destroyYt();
    state.yt = new window.YT.Player("yt-player", {
      events: {
        onReady(event) {
          if (state.muted) event.target.mute();
          else event.target.unMute();
        },
        onStateChange(event) {
          if (event.data === window.YT.PlayerState.ENDED) {
            skipClip(1, { auto: true });
          }
        },
      },
    });
  });
}

function phillyOsd() {
  const clips = clipList();
  const clip = clips[state.clipIndex];
  const upcoming = peekNextClip();
  return {
    ...current(),
    now: clip ? `${clip.artist} — ${clip.title}` : "PHILLY",
    next: upcoming ? `NEXT  ${upcoming.artist} — ${upcoming.title}` : "",
    duration: clips.length ? `${state.clipIndex + 1}/${clips.length}` : "LIVE",
  };
}

function renderPhilly() {
  const clips = clipList();
  const clip = clips[state.clipIndex];
  if (!clip) {
    picture.innerHTML = `<div class="testcard">
      <div class="testcard-bars">${"<span></span>".repeat(7)}</div>
      <div class="testcard-copy"><strong>PHILLY</strong> No clips loaded.</div>
    </div>`;
    return;
  }

  const crawl = (state.philly.calendar || [])
    .map((gig) => {
      const date = new Date(`${gig.date}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      return `${date} · ${gig.bill} @ ${gig.venue}`;
    })
    .join("   ★   ");

  const poster = clipPoster(clip);
  let frame;
  if (!state.clipArmed) {
    frame = `<button type="button" class="tube-play" data-play="1">
        <img src="${esc(poster)}" alt="" />
        <span>PLAY</span>
      </button>`;
  } else if (clip.youtube) {
    frame = `<iframe
        class="yt-picture"
        title="${esc(clip.artist)} — ${esc(clip.title)}"
        src="${youtubeSrc(clip.youtube, true)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>`;
  } else if (clip.bandcampTrack || clip.bandcampAlbum) {
    frame = `<img class="philly-art" src="${esc(poster)}" alt="" />
      <div class="player-dock philly-dock">
        <iframe title="${esc(clip.artist)} — ${esc(clip.title)}" src="${clipBandcampSrc(clip)}" allow="autoplay"></iframe>
      </div>`;
  } else {
    frame = `<div class="testcard-copy"><strong>PHILLY</strong> No player for this clip.</div>`;
  }

  const docked = Boolean(state.clipArmed && !clip.youtube && (clip.bandcampTrack || clip.bandcampAlbum));
  picture.innerHTML = `<div class="video-frame${docked ? " video-frame--docked" : ""}">
      ${frame}
    </div>
    <p class="philly-crawl"><span>${esc(crawl)}</span><span>${esc(crawl)}</span></p>`;

  setOsd(phillyOsd());
  if (state.clipArmed && clip.youtube) attachYt();
  if (state.clipArmed && !clip.youtube) armClipAdvance(clip);
}

function renderVideo(station) {
  const clip = Array.isArray(station.videos) ? station.videos[0] : null;
  if (clip?.youtube) {
    picture.innerHTML = `${artStage()}
      <div class="video-frame">
        <iframe
          title="${esc(clip.title) || "Cricket Joe video"}"
        src="https://www.youtube.com/embed/${clip.youtube}?rel=0&modestbranding=1&playsinline=1"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
        ></iframe>
      </div>`;
    return;
  }
  picture.innerHTML = `<div class="testcard">
    <div class="testcard-bars">${"<span></span>".repeat(7)}</div>
    <div class="testcard-copy">
      <strong>CJ-TV</strong>
      Please stand by for pictures. Music videos land on this frequency when they're ready.
    </div>
  </div>`;
}

function renderStation(station) {
  teardownPhilly();
  if (station.kind === "guide") {
    state.guideCursor = state.index;
    renderGuide(state.guideCursor);
    return;
  }
  if (station.kind === "shows") {
    renderShows();
    return;
  }
  if (station.kind === "about") {
    renderAbout();
    return;
  }
  if (station.kind === "mail") {
    renderMail();
    return;
  }
  if (station.kind === "video") {
    renderVideo(station);
    return;
  }
  if (station.kind === "philly") {
    reshufflePhilly();
    state.clipArmed = state.tubeReady;
    renderPhilly();
    return;
  }
  picture.innerHTML = artStage(playerDock(station));
}

function doTune(ch, { silent } = {}) {
  const next = findIndex(ch);
  const station = state.channels[next];
  if (!station) return;
  if (station.ch !== current()?.ch) state.last = current().ch;
  state.index = next;
  state.digits = "";
  history.replaceState(null, "", `#${station.ch}`);
  setOsd(station);
  if (!silent) {
    startSnow();
    showSlate(station);
    flashChrome();
    window.setTimeout(() => {
      stopSnow();
      renderStation(station);
    }, 420);
  } else {
    renderStation(station);
    flashChrome();
  }
}

function skipClip(dir, { auto } = {}) {
  const clips = clipList();
  if (!clips.length) return;
  teardownPhilly();
  state.clipIndex = (state.clipIndex + dir + clips.length) % clips.length;
  renderPhilly();
  if (!auto) flashChrome();
}

function onPhillyChannel() {
  return current()?.kind === "philly";
}

function channelDelta(dir) {
  const len = state.channels.length;
  const next = (state.index + dir + len) % len;
  doTune(state.channels[next].ch);
}

function pushDigit(d) {
  state.digits = (state.digits + d).slice(-3);
  setOsd(current(), state.digits.padStart(2, "0"));
  bug.hidden = false;
  window.clearTimeout(state.digitTimer);
  state.digitTimer = window.setTimeout(() => {
    doTune(parseInt(state.digits, 10));
  }, 900);
}

function onGuideChannel() {
  return current()?.kind === "guide";
}

function moveGuide(dir) {
  const len = state.channels.length;
  state.guideCursor = (state.guideCursor + dir + len) % len;
  renderGuide(state.guideCursor);
}

document.querySelector(".desk-remote").addEventListener("click", (event) => {
  const act = event.target.closest("[data-act]")?.dataset.act;
  if (act === "up") channelDelta(1);
  if (act === "down") channelDelta(-1);
  if (act === "prev") {
    if (onPhillyChannel()) skipClip(-1);
  }
  if (act === "next") {
    if (onPhillyChannel()) skipClip(1);
    else channelDelta(1);
  }
  if (act === "last") doTune(state.last);
  if (act === "guide") doTune(1);
  if (act === "info") flashChrome();
});

picture.addEventListener("click", (event) => {
  if (event.target.closest("[data-play]")) {
    state.clipArmed = true;
    state.tubeReady = true;
    renderPhilly();
    flashChrome();
    return;
  }
  const clip = event.target.closest("[data-clip]")?.dataset.clip;
  if (clip) {
    skipClip(Number(clip));
    return;
  }
  const tune = event.target.closest("[data-tune]")?.dataset.tune;
  if (tune) doTune(Number(tune));
});

window.addEventListener("keydown", (event) => {
  if (event.altKey || event.metaKey || event.ctrlKey) return;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape"].includes(event.key)) {
    document.activeElement?.blur?.();
  }
  const key = event.key;
  if (key >= "0" && key <= "9") {
    event.preventDefault();
    pushDigit(key);
    return;
  }
  if (key === "ArrowUp") {
    event.preventDefault();
    if (onGuideChannel()) moveGuide(-1);
    else channelDelta(1);
    return;
  }
  if (key === "ArrowDown") {
    event.preventDefault();
    if (onGuideChannel()) moveGuide(1);
    else channelDelta(-1);
    return;
  }
  if (key === "ArrowLeft") {
    if (onPhillyChannel()) {
      event.preventDefault();
      skipClip(-1);
    }
    return;
  }
  if (key === "ArrowRight") {
    if (onPhillyChannel()) {
      event.preventDefault();
      skipClip(1);
    }
    return;
  }
  if (key === "Enter") {
    if (onPhillyChannel() && !state.clipArmed) {
      event.preventDefault();
      state.clipArmed = true;
      state.tubeReady = true;
      renderPhilly();
      flashChrome();
      return;
    }
    if (onGuideChannel()) {
      event.preventDefault();
      doTune(state.channels[state.guideCursor].ch);
      return;
    }
  }
  if (key === "g" || key === "G" || key === "Escape") {
    event.preventDefault();
    doTune(1);
    return;
  }
  if (key === "i" || key === "I") {
    event.preventDefault();
    flashChrome();
    return;
  }
  if (key === " " || key === "Spacebar") {
    if (onPhillyChannel() && state.yt) {
      event.preventDefault();
      const flag = state.yt.getPlayerState?.();
      if (flag === window.YT?.PlayerState?.PLAYING) state.yt.pauseVideo();
      else state.yt.playVideo();
      return;
    }
  }
  if (key === "m" || key === "M") {
    if (onPhillyChannel() && state.yt) {
      event.preventDefault();
      state.muted = !state.muted;
      if (state.muted) state.yt.mute();
      else state.yt.unMute();
      return;
    }
  }
  if (key === "n" || key === "N") {
    if (onPhillyChannel()) {
      event.preventDefault();
      skipClip(1);
      return;
    }
  }
  if (key === "l" || key === "L") {
    event.preventDefault();
    doTune(state.last);
  }
}, true);

let touchY = null;
let touchX = null;
window.addEventListener("touchstart", (event) => {
  touchY = event.changedTouches[0].clientY;
  touchX = event.changedTouches[0].clientX;
}, { passive: true });
window.addEventListener("touchend", (event) => {
  if (touchY == null) return;
  const dy = touchY - event.changedTouches[0].clientY;
  const dx = touchX - event.changedTouches[0].clientX;
  touchY = null;
  touchX = null;
  if (onPhillyChannel() && Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy)) {
    skipClip(dx > 0 ? 1 : -1);
    return;
  }
  if (Math.abs(dy) < 56) return;
  channelDelta(dy > 0 ? 1 : -1);
}, { passive: true });

async function boot() {
  const [chRes, showRes, phillyRes] = await Promise.all([
    fetch("channels.json"),
    fetch("shows.json"),
    fetch("philly.json"),
  ]);
  const chData = await chRes.json();
  state.channels = chData.channels;
  try {
    const showData = await showRes.json();
    state.shows = showData.shows || [];
  } catch {
    state.shows = [];
  }
  try {
    state.philly = await phillyRes.json();
    const phillyCh = state.channels.find((c) => c.kind === "philly");
    if (phillyCh && state.philly.videos?.[0]) {
      const first = state.philly.videos[0];
      phillyCh.now = `${first.artist} — ${first.title}`;
    }
  } catch {
    state.philly = { videos: [], calendar: [] };
  }
  const fromHash = parseInt(location.hash.replace("#", ""), 10);
  const start = Number.isFinite(fromHash) ? fromHash : 1;
  doTune(start, { silent: true });
}

boot();
