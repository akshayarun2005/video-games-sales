(function () {
  document.documentElement.classList.add('js');

  var charts = {
    genre: {
      title: 'Global sales by genre',
      img: 'assets/genre.webp',
      alt: 'Horizontal bar chart of global sales by genre for the top 100 games',
      text: 'Combined global sales (in millions of units) for each genre among the top 100 games.',
      facts: [
        'Shooter ranks first, with Platform a close second.',
        'Role-Playing, Sports, Action, Racing and Misc follow.',
        'Adventure and Fighting have the lowest combined sales in the sample.'
      ]
    },
    platform: {
      title: 'Top platforms by combined global sales',
      img: 'assets/platform.webp',
      alt: 'Horizontal bar chart of the top ten platforms by combined global sales',
      text: 'The ten platforms with the highest combined global sales among the sampled titles.',
      facts: [
        'Wii leads by a wide margin, ahead of DS and X360.',
        'Handhelds (DS, GB, 3DS) and consoles (Wii, X360, PS3, NES, PS2) both appear in the top ten.',
        'PS4 and SNES close out the list.'
      ]
    },
    region: {
      title: 'Regional sales contribution',
      img: 'assets/region.webp',
      alt: 'Pie chart showing the share of sales from North America, Europe, Japan and other regions',
      text: 'Share of total sales in the sample contributed by each region.',
      facts: [
        'North America accounts for almost half of all sales.',
        'Europe contributes just under a third.'
      ],
      share: true
    },
    year: {
      title: 'Global sales by release year',
      img: 'assets/year.webp',
      alt: 'Line chart of global sales by release year for the top 100 games',
      text: 'Combined global sales of top-100 titles grouped by the year they were released.',
      facts: [
        'Sales stay modest through the 1980s and 1990s.',
        'A sharp rise in the mid-2000s peaks around 2006, at roughly 160 million units.',
        'Totals fall away after 2013, though recent years have fewer titles in the sample.'
      ]
    }
  };

  var tabs = document.querySelectorAll('.tabs [role="tab"]');
  var img = document.getElementById('chartImg');
  var title = document.getElementById('chartTitle');
  var text = document.getElementById('chartText');
  var facts = document.getElementById('chartFacts');
  var share = document.getElementById('regionShare');
  var panel = document.getElementById('panel');

  function show(key) {
    var c = charts[key];
    tabs.forEach(function (t) {
      var on = t.dataset.key === key;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on) panel.setAttribute('aria-labelledby', t.id);
    });
    img.src = c.img;
    img.alt = c.alt;
    title.textContent = c.title;
    text.textContent = c.text;
    facts.innerHTML = '';
    c.facts.forEach(function (f) {
      var li = document.createElement('li');
      li.textContent = f;
      facts.appendChild(li);
    });
    share.classList.remove('on');
    share.hidden = !c.share;
    if (c.share) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { share.classList.add('on'); });
      });
    }
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { show(t.dataset.key); });
    t.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      if (n !== null) { e.preventDefault(); tabs[n].focus(); show(tabs[n].dataset.key); }
    });
  });
  show('genre');

  // Lightbox
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lbImg');
  function openLb() { lbImg.src = img.src; lbImg.alt = img.alt; lb.hidden = false; document.getElementById('lbClose').focus(); }
  function closeLb() { lb.hidden = true; document.getElementById('figure').focus(); }
  document.getElementById('figure').addEventListener('click', openLb);
  lb.addEventListener('click', closeLb);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lb.hidden) closeLb(); });

  // Reveal on scroll + count-up
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function count(el) {
    var end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10);
    if (reduce) return;
    var start = performance.now(), dur = 1200;
    (function tick(now) {
      var p = Math.min((now - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (end * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        en.target.querySelectorAll('[data-count]').forEach(count);
        io.unobserve(en.target);
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
    document.querySelectorAll('.stats').forEach(function (el) {
      var o2 = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { el.querySelectorAll('[data-count]').forEach(count); o2.disconnect(); }
      }, { threshold: 0.3 });
      o2.observe(el);
    });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }
})();
