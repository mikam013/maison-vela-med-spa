/* Shared site engine: nav, popups, forms, booking, sliders, carousel, finder, cart, calculator.
   Each site loads site-data.js first (window.SITE). Forms post to SITE.formEndpoint when set
   (e.g. a GoHighLevel / Formspree webhook); they always also save locally so the demo works offline. */
(function () {
  const S = window.SITE || {};
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(S.key + ':' + k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(S.key + ':' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const shared = store;
  const money = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0 });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function send(type, data) {
    const log = store.get('submissions', []); log.push({ type, data, at: new Date().toISOString() }); store.set('submissions', log);
    if (S.formEndpoint) fetch(S.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ...data }) }).catch(() => {});
  }
  function toast(msg) {
    let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 3200);
  }
  function validate(form) {
    let ok = true;
    $$('[required]', form).forEach(f => {
      const v = f.type === 'checkbox' ? f.checked : f.value.trim();
      let bad = !v;
      if (!bad && f.type === 'email') bad = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.value.trim());
      if (!bad && f.type === 'tel') bad = f.value.replace(/\D/g, '').length < 10;
      f.closest('.field')?.classList.toggle('err', bad); if (bad) ok = false;
    });
    if (!ok) $('.err input, .err select, .err textarea', form)?.focus();
    return ok;
  }
  const formData = f => Object.fromEntries(new FormData(f).entries());

  /* ---------- header, nav, announcement ---------- */
  const hdr = $('.site-header');
  const onScroll = () => hdr && hdr.classList.toggle('scrolled', scrollY > 30);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  $('.burger')?.addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $$('.mobile-nav a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('nav-open')));
  const ann = $('.announce');
  if (ann) { if (store.get('annClosed')) ann.remove(); else $('.announce button')?.addEventListener('click', () => { ann.remove(); store.set('annClosed', 1); }); }
  const here = location.pathname.split('/').pop() || 'index.html';
  $$('.nav a').forEach(a => { if (a.getAttribute('href').split('/').pop() === here) a.classList.add('active'); });

  /* ---------- reveal on scroll ---------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 }) : null;
  $$('.reveal').forEach(el => io ? io.observe(el) : el.classList.add('in'));

  /* ---------- new-client offer popup ---------- */
  const pop = $('#offer-pop');
  if (pop) {
    const open = () => { pop.classList.add('on'); store.set('popSeen', 1); };
    const close = () => pop.classList.remove('on');
    if (!store.get('popSeen') && !/book|checkout/.test(here)) setTimeout(open, 7000);
    $$('[data-open-offer]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); open(); }));
    $$('.pop-close, .pop-bg', pop).forEach(b => b.addEventListener('click', close));
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    $('form', pop)?.addEventListener('submit', e => {
      e.preventDefault(); const f = e.target; if (!validate(f)) return;
      send('new-client-offer', formData(f)); $('.pop-form', pop).hidden = true; $('.pop-done', pop).hidden = false;
    });
  }

  /* ---------- generic forms (contact, newsletter, gift, waitlist) ---------- */
  $$('form[data-form]').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault(); if (!validate(f)) return;
    send(f.dataset.form, formData(f));
    const done = f.parentElement.querySelector('.form-done');
    if (done) { f.hidden = true; done.hidden = false; } else { f.reset(); toast(f.dataset.thanks || 'Thank you! We’ll be in touch shortly.'); }
  }));
  $$('.field input, .field select, .field textarea').forEach(i => i.addEventListener('input', () => i.closest('.field').classList.remove('err')));

  /* ---------- FAQ accordion (single open per group) ---------- */
  $$('.faq details').forEach(d => d.addEventListener('toggle', () => { if (d.open) $$('details', d.parentElement).forEach(o => o !== d && (o.open = false)); }));

  /* ---------- before / after sliders ---------- */
  $$('.ba').forEach(ba => {
    const r = $('input', ba); const set = () => ba.style.setProperty('--pos', r.value + '%');
    r.addEventListener('input', set); set();
  });
  /* results filter */
  $$('.filters').forEach(fl => {
    const target = $(fl.dataset.target);
    $$('button', fl).forEach(b => b.addEventListener('click', () => {
      $$('button', fl).forEach(x => x.classList.toggle('on', x === b));
      $$('[data-cat]', target).forEach(c => c.hidden = b.dataset.f !== 'all' && !c.dataset.cat.split(' ').includes(b.dataset.f));
    }));
  });

  /* ---------- reviews carousel ---------- */
  $$('.carousel').forEach(c => {
    const track = $('.track', c), slides = $$('.slide', c); let i = 0, timer;
    const per = () => (innerWidth < 760 ? 1 : innerWidth < 1100 ? 2 : 3);
    const go = n => { const max = Math.max(0, slides.length - per()); i = n < 0 ? max : n > max ? 0 : n; track.style.transform = `translateX(-${i * (100 / per())}%)`; };
    $('.prev', c)?.addEventListener('click', () => { go(i - 1); reset(); });
    $('.next', c)?.addEventListener('click', () => { go(i + 1); reset(); });
    const reset = () => { clearInterval(timer); timer = setInterval(() => go(i + 1), 6000); };
    addEventListener('resize', () => go(i)); reset();
  });

  /* ---------- concern finder ---------- */
  const finder = $('#finder');
  if (finder) {
    const out = $('.finder-out', finder);
    $$('.concern', finder).forEach(b => b.addEventListener('click', () => {
      $$('.concern', finder).forEach(x => x.classList.toggle('on', x === b));
      const c = S.concerns[b.dataset.c];
      out.innerHTML = `<p class="finder-note">${esc(c.note)}</p><div class="finder-cards">` + c.picks.map(slug => {
        const t = S.treatments.find(x => x.slug === slug);
        return `<a class="fcard" href="treatments/${t.slug}.html"><img src="img/${t.img}.jpg" alt="${esc(t.name)}"><div><b>${esc(t.name)}</b><span>${esc(t.priceLabel)}</span><em>View treatment →</em></div></a>`;
      }).join('') + '</div>';
      out.classList.add('on');
    }));
  }

  /* ---------- treatments filter on treatments page ---------- */
  const tSearch = $('#t-search');
  if (tSearch) tSearch.addEventListener('input', () => {
    const q = tSearch.value.toLowerCase();
    $$('#t-grid [data-cat]').forEach(c => c.hidden = !c.textContent.toLowerCase().includes(q));
  });

  /* ---------- membership toggle ---------- */
  const billing = $('#billing');
  if (billing) {
    const upd = () => $$('[data-monthly]').forEach(p => {
      const annual = billing.checked; const m = +p.dataset.monthly;
      p.innerHTML = annual ? `${money(Math.round(m * 10))}<small>/year · 2 months free</small>` : `${money(m)}<small>/month</small>`;
    });
    billing.addEventListener('change', upd); upd();
  }

  /* ---------- laser package calculator ---------- */
  const calc = $('#calc');
  if (calc) {
    const upd = () => {
      const areas = $$('input[name=area]:checked', calc).map(i => S.laserAreas.find(a => a.id === i.value));
      const pk = S.laserPackages.find(p => p.id === $('input[name=pkg]:checked', calc).value);
      const per = areas.reduce((s, a) => s + a.price, 0);
      const total = Math.round(per * pk.sessions * (1 - pk.off));
      const save = per * pk.sessions - total;
      $('#c-areas').textContent = areas.length ? areas.map(a => a.name).join(', ') : 'Pick at least one area';
      $('#c-total').textContent = money(total);
      $('#c-save').textContent = save > 0 ? `You save ${money(save)}` : 'Single session';
      $('#c-month').textContent = total ? `or about ${money(Math.ceil(total / 12))}/mo for 12 months with financing` : '';
      const book = $('#c-book'); book.classList.toggle('disabled', !areas.length);
      book.href = `book.html?t=laser-hair-removal&note=${encodeURIComponent(areas.map(a => a.name).join(', ') + ' · ' + pk.name + ' · ' + money(total))}`;
    };
    calc.addEventListener('change', upd); upd();
  }

  /* ---------- shop cart ---------- */
  const cart = { items: store.get('cart', []) };
  const saveCart = () => { store.set('cart', cart.items); renderCart(); };
  function renderCart() {
    const n = cart.items.reduce((s, i) => s + i.qty, 0);
    $$('.cart-count').forEach(c => { c.textContent = n; c.hidden = !n; });
    const box = $('#cart-items'); if (!box) return;
    const sub = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
    box.innerHTML = cart.items.length ? cart.items.map((i, k) => `<div class="ci"><img src="img/${i.img}.jpg" alt=""><div><b>${esc(i.name)}</b><span>${money(i.price)}</span></div>
      <div class="qty"><button data-k="${k}" data-d="-1" aria-label="Less">−</button><span>${i.qty}</span><button data-k="${k}" data-d="1" aria-label="More">+</button></div></div>`).join('')
      : '<p class="muted">Your bag is empty.</p>';
    $('#cart-sub').textContent = money(sub);
    $('#cart-ship').textContent = sub >= (S.freeShip || 75) || !sub ? 'Free' : money(8);
    $('#cart-total').textContent = money(sub + (sub && sub < (S.freeShip || 75) ? 8 : 0));
    $('#cart-checkout').classList.toggle('disabled', !cart.items.length);
    $$('.qty button', box).forEach(b => b.addEventListener('click', () => {
      const it = cart.items[b.dataset.k]; it.qty += +b.dataset.d; if (it.qty < 1) cart.items.splice(b.dataset.k, 1); saveCart();
    }));
  }
  $$('[data-add]').forEach(b => b.addEventListener('click', () => {
    const p = S.products.find(x => x.id === b.dataset.add);
    let price = p.price;
    if (p.gift) { price = +$('#gift-amt').value; }
    const id = p.gift ? p.id + '-' + price : p.id;
    const ex = cart.items.find(i => i.id === id);
    ex ? ex.qty++ : cart.items.push({ id, name: p.gift ? `${p.name} (${money(price)})` : p.name, price, img: p.img, qty: 1 });
    saveCart(); document.body.classList.add('cart-open');
  }));
  $$('.cart-toggle').forEach(b => b.addEventListener('click', () => document.body.classList.toggle('cart-open')));
  renderCart();
  const co = $('#checkout-form');
  if (co) {
    const sum = $('#co-summary'); const sub = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
    sum.innerHTML = cart.items.map(i => `<div class="row"><span>${i.qty} × ${esc(i.name)}</span><b>${money(i.price * i.qty)}</b></div>`).join('') +
      `<div class="row total"><span>Total</span><b>${money(sub + (sub && sub < (S.freeShip || 75) ? 8 : 0))}</b></div>`;
    if (!cart.items.length) co.innerHTML = '<p>Your bag is empty. <a href="shop.html">Back to the shop</a></p>';
    co.addEventListener('submit', e => {
      e.preventDefault(); if (!validate(co)) return;
      const ref = 'FC-' + Math.random().toString(36).slice(2, 7).toUpperCase();
      send('order', { ref, ...formData(co), items: cart.items });
      co.hidden = true; const d = $('#co-done'); d.hidden = false; $('.ref', d).textContent = ref;
      cart.items = []; saveCart();
    });
  }

  /* ---------- booking engine ---------- */
  const bk = $('#booking');
  if (bk) {
    const P = new URLSearchParams(location.search);
    const st = { t: P.get('t'), prov: null, date: null, time: null, note: P.get('note') || '' };
    const steps = $$('.step', bk), dots = $$('.steps li', bk);
    const show = n => { steps.forEach((s, i) => s.hidden = i !== n); dots.forEach((d, i) => { d.classList.toggle('on', i === n); d.classList.toggle('done', i < n); }); bk.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    const T = () => S.treatments.find(x => x.slug === st.t);
    // step 0 treatments
    const tl = $('#b-treat');
    tl.innerHTML = S.treatments.map(t => `<label class="opt"><input type="radio" name="t" value="${t.slug}"><span><b>${esc(t.name)}</b><small>${esc(t.duration)} · ${esc(t.priceLabel)}</small></span></label>`).join('')
      + `<label class="opt"><input type="radio" name="t" value="consult"><span><b>Free consultation</b><small>20 min · Complimentary</small></span></label>`;
    if (st.t) { const r = $(`input[value="${st.t}"]`, tl); if (r) r.checked = true; }
    tl.addEventListener('change', e => { st.t = e.target.value; });
    // providers
    const pl = $('#b-prov');
    pl.innerHTML = `<label class="opt prov"><input type="radio" name="p" value="any" checked><span><i class="anyp">★</i><b>First available</b><small>Fastest way to get in</small></span></label>` +
      S.team.map(m => `<label class="opt prov"><input type="radio" name="p" value="${esc(m.name)}"><span><img src="img/${m.img}.jpg" alt=""><b>${esc(m.name)}</b><small>${esc(m.role)}</small></span></label>`).join('');
    // calendar
    let month = new Date(); month.setDate(1);
    const taken = (d, t) => { const seed = [...(d + t)].reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7); return seed % 5 === 0 || store.get('bookings', []).some(b => b.date === d && b.time === t && b.status !== 'cancelled'); };
    const iso = d => d.toISOString().slice(0, 10);
    function cal() {
      const g = $('#b-cal'), today = new Date(); today.setHours(0, 0, 0, 0);
      const max = new Date(today); max.setDate(max.getDate() + 60);
      $('#b-month').textContent = month.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const first = new Date(month), days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      let h = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<span class="dow">${d}</span>`).join('') + '<span></span>'.repeat(first.getDay());
      for (let d = 1; d <= days; d++) {
        const dt = new Date(month.getFullYear(), month.getMonth(), d); const open = S.hoursByDay[dt.getDay()];
        const ok = open && dt > today && dt <= max; const v = iso(new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), d)));
        h += `<button type="button" class="day${st.date === v ? ' on' : ''}" ${ok ? `data-d="${v}"` : 'disabled'}>${d}</button>`;
      }
      g.innerHTML = h;
      $$('.day[data-d]', g).forEach(b => b.addEventListener('click', () => { st.date = b.dataset.d; st.time = null; cal(); slots(); }));
    }
    function slots() {
      const box = $('#b-times'); if (!st.date) { box.innerHTML = '<p class="muted">Pick a day to see open times.</p>'; return; }
      const dow = new Date(st.date + 'T12:00').getDay(); const [o, c] = S.hoursByDay[dow];
      let h = ''; for (let m = o * 60; m < c * 60; m += 30) {
        const hh = Math.floor(m / 60), mm = m % 60, lab = `${(hh + 11) % 12 + 1}:${mm ? '30' : '00'} ${hh < 12 ? 'AM' : 'PM'}`;
        const tk = taken(st.date, lab);
        h += `<button type="button" class="slot${st.time === lab ? ' on' : ''}" ${tk ? 'disabled title="Booked"' : `data-t="${lab}"`}>${lab}</button>`;
      }
      box.innerHTML = `<p class="muted">${new Date(st.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p><div class="slots">${h}</div>`;
      $$('.slot[data-t]', box).forEach(b => b.addEventListener('click', () => { st.time = b.dataset.t; slots(); }));
    }
    $('#b-prev').addEventListener('click', () => { const t = new Date(); t.setDate(1); if (month > t) { month.setMonth(month.getMonth() - 1); cal(); } });
    $('#b-next').addEventListener('click', () => { month.setMonth(month.getMonth() + 1); cal(); });
    cal(); slots();
    const lead = store.get('lead', null) || shared.get('lead');
    if (lead) ['first', 'last', 'email', 'phone'].forEach(k => { const f = $(`#b-form [name=${k}]`); if (f && lead[k]) f.value = lead[k]; });
    if (bk.dataset.start) { st.prov = 'any'; if (!st.t) st.t = S.treatments[0].slug; steps.forEach((s, i) => s.hidden = i !== +bk.dataset.start); dots.forEach((d, i) => { d.classList.toggle('on', i === +bk.dataset.start); d.classList.toggle('done', i < +bk.dataset.start); }); }
    const need = (cond, msg) => { if (!cond) toast(msg); return cond; };
    $$('[data-next]', bk).forEach(b => b.addEventListener('click', () => {
      const n = +b.dataset.next;
      if (n === 1 && !need(st.t, 'Please choose a treatment.')) return;
      if (n === 2) st.prov = $('input[name=p]:checked', pl).value;
      if (n === 3 && !need(st.date && st.time, 'Please pick a day and time.')) return;
      if (n === 3) {
        const t = T(); const nm = t ? t.name : 'Free consultation';
        $('#b-summary').innerHTML = `<div><span>Treatment</span><b>${esc(nm)}</b></div><div><span>With</span><b>${esc(st.prov === 'any' ? 'First available' : st.prov)}</b></div>
          <div><span>When</span><b>${new Date(st.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${st.time}</b></div>
          <div><span>Estimate</span><b>${esc(t ? t.priceLabel : 'Complimentary')}</b></div>${st.note ? `<div><span>Package</span><b>${esc(st.note)}</b></div>` : ''}`;
      }
      show(n);
    }));
    $$('[data-back]', bk).forEach(b => b.addEventListener('click', () => show(+b.dataset.back)));
    $('#b-form').addEventListener('submit', e => {
      e.preventDefault(); const f = e.target; if (!validate(f)) return;
      const d = formData(f); const t = T();
      const ref = S.refPrefix + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
      const b = { ref, treatment: t ? t.name : 'Free consultation', duration: t ? t.mins : 20, provider: st.prov === 'any' ? 'First available' : st.prov, date: st.date, time: st.time, note: st.note, ...d, status: 'confirmed' };
      const all = store.get('bookings', []); all.push(b); store.set('bookings', all); send('booking', b);
      $('#b-ref').textContent = ref; $('#b-done-when').textContent = `${b.treatment} · ${new Date(b.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${b.time}`;
      $('#b-ics').onclick = () => ics(b); store.set('lastBooking', b);
      if (bk.dataset.done) { location.href = bk.dataset.done; return; }
      show(4);
    });
  }
  function ics(b) {
    const [h, m] = b.time.match(/(\d+):(\d+) (AM|PM)/).slice(1, 4).reduce((a, v, i) => (i === 0 ? [+v % 12] : i === 1 ? [a[0], +v] : [a[0] + (v === 'PM' ? 12 : 0), a[1]]), []);
    const s = b.date.replace(/-/g, '') + 'T' + String(h).padStart(2, '0') + String(m).padStart(2, '0') + '00';
    const endD = new Date(2000, 0, 1, h, m + (+b.duration || 60)); const e = b.date.replace(/-/g, '') + 'T' + String(endD.getHours()).padStart(2, '0') + String(endD.getMinutes()).padStart(2, '0') + '00';
    const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//' + S.name + '//EN', 'BEGIN:VEVENT', 'UID:' + b.ref + '@' + S.key, 'DTSTART:' + s, 'DTEND:' + e,
      'SUMMARY:' + b.treatment + ' at ' + S.name, 'LOCATION:' + S.address.replace(/,/g, '\\,'), 'DESCRIPTION:Booking ' + b.ref + '. Need to change it? Call ' + S.phone + '.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar' })); a.download = b.ref + '.ics'; a.click();
  }
  /* manage booking */
  const mg = $('#manage-form');
  if (mg) mg.addEventListener('submit', e => {
    e.preventDefault(); if (!validate(mg)) return;
    const { ref, email } = formData(mg); const out = $('#manage-out');
    const all = store.get('bookings', []); const b = all.find(x => x.ref.toUpperCase() === ref.trim().toUpperCase() && x.email.toLowerCase() === email.trim().toLowerCase());
    if (!b) { out.innerHTML = '<p class="warn">We couldn’t find that booking. Check the code in your confirmation, or call us.</p>'; return; }
    const draw = () => {
      out.innerHTML = `<div class="mcard"><b>${esc(b.treatment)}</b><span>${new Date(b.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${b.time} · ${esc(b.provider)}</span>
      <span class="badge ${b.status}">${b.status}</span>${b.status === 'confirmed' ? `<div class="mrow"><a class="btn ghost" href="book.html">Reschedule</a><button class="btn" id="m-cancel">Cancel booking</button></div>` : ''}</div>`;
      $('#m-cancel')?.addEventListener('click', () => { b.status = 'cancelled'; store.set('bookings', all); send('booking-cancelled', { ref: b.ref }); draw(); toast('Your booking is cancelled.'); });
    };
    draw();
  });

  /* ---------- UTM capture (funnels) ---------- */
  const qp = new URLSearchParams(location.search);
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(k => { if (qp.get(k)) { const u = store.get('utm', {}); u[k] = qp.get(k); store.set('utm', u); } });

  /* ---------- tabs ---------- */
  $$('.tabs-ui').forEach(tu => {
    const btns = $$('[data-tab]', tu);
    btns.forEach(b => b.addEventListener('click', () => {
      btns.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      $$('[data-panel]', tu).forEach(p => p.hidden = p.dataset.panel !== b.dataset.tab);
    }));
  });

  /* ---------- horizontal rail ---------- */
  $$('.rail').forEach(r => {
    const w = r.closest('section') || document;
    $('.rprev', w)?.addEventListener('click', () => r.scrollBy({ left: -r.clientWidth * .8, behavior: 'smooth' }));
    $('.rnext', w)?.addEventListener('click', () => r.scrollBy({ left: r.clientWidth * .8, behavior: 'smooth' }));
  });

  /* ---------- modal drawers ---------- */
  $$('[data-modal]').forEach(b => b.addEventListener('click', e => {
    e.preventDefault(); const m = document.getElementById(b.dataset.modal); if (!m) return;
    m.classList.add('on'); document.body.classList.add('modal-open'); $('.m-close', m)?.focus();
  }));
  $$('.modal').forEach(m => {
    const close = () => { m.classList.remove('on'); document.body.classList.remove('modal-open'); };
    $$('.m-close, .m-bg', m).forEach(x => x.addEventListener('click', close));
    $$('a', m).forEach(a => a.addEventListener('click', close));
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  });

  /* ---------- one-page scroll spy ---------- */
  const spyLinks = $$('.side-nav a[href^="#"]');
  if (spyLinks.length && 'IntersectionObserver' in window) {
    const so = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) spyLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    spyLinks.forEach(a => { const s = $(a.getAttribute('href')); if (s) so.observe(s); });
  }

  /* ---------- countdown (evergreen per visitor) ---------- */
  $$('[data-countdown]').forEach(c => {
    let end = store.get('deadline'); if (!end || end < Date.now()) { end = Date.now() + (+c.dataset.countdown) * 3600e3; store.set('deadline', end); }
    const pad = n => String(n).padStart(2, '0');
    const tick = () => {
      const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      $$('[data-cd]', c).forEach(x => x.textContent = pad({ h: Math.floor(s / 3600), m: Math.floor(s / 60) % 60, s: s % 60 }[x.dataset.cd]));
    };
    tick(); setInterval(tick, 1000);
  });

  /* ---------- exit intent ---------- */
  const ex = $('#exit-pop');
  if (ex) {
    const open = () => { if (store.get('exitSeen') || store.get('lead')) return; ex.classList.add('on'); store.set('exitSeen', 1); };
    document.addEventListener('mouseout', e => { if (!e.relatedTarget && e.clientY < 10) open(); });
    setTimeout(() => { if (innerWidth < 760) open(); }, 40000);
    $$('.pop-close, .pop-bg, [data-close]', ex).forEach(b => b.addEventListener('click', () => ex.classList.remove('on')));
  }

  /* ---------- funnel lead forms ---------- */
  $$('form[data-lead]').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault(); if (!validate(f)) return;
    const lead = { ...store.get('lead', {}), ...formData(f), ...(store.get('quiz') ? { quiz: store.get('quiz') } : {}), utm: store.get('utm', {}), page: location.pathname.split('/').pop() };
    store.set('lead', lead); send('funnel-lead', lead);
    if (f.dataset.next) location.href = f.dataset.next; else { f.hidden = true; const d = f.parentElement.querySelector('.form-done'); if (d) d.hidden = false; }
  }));

  /* ---------- quiz engine ---------- */
  const qz = $('[data-quiz]');
  if (qz) {
    const qsteps = $$('.q-step', qz), bar = $('.q-bar i', qz), ans = {};
    let k = 0;
    const go = n => { k = n; qsteps.forEach((s, i) => s.hidden = i !== n); if (bar) bar.style.width = Math.round(n / (qsteps.length - 1) * 100) + '%'; const c = $('.q-count', qz); if (c) c.textContent = n < qsteps.length - 1 ? `Question ${n + 1} of ${qsteps.length - 1}` : 'Your result'; };
    const finish = () => { store.set('quiz', ans); send('quiz', ans); if (window.quizDone) window.quizDone(ans, qsteps[qsteps.length - 1], { money, esc, S }); go(qsteps.length - 1); };
    qsteps.forEach((st, i) => {
      $$('[data-val]', st).forEach(b => b.addEventListener('click', () => {
        ans[st.dataset.q] = b.dataset.val; $$('[data-val]', st).forEach(x => x.classList.toggle('on', x === b));
        setTimeout(() => (i + 1 >= qsteps.length - 1 ? finish() : go(i + 1)), 220);
      }));
      $('.q-next', st)?.addEventListener('click', () => {
        const checked = $$('input:checked', st).map(x => x.value); const nums = $$('input[type=number]', st);
        if (nums.length) { if (nums.some(x => !x.value)) return toast('Please fill in each box.'); nums.forEach(x => ans[x.name] = +x.value); }
        else { if (!checked.length) return toast('Pick at least one.'); ans[st.dataset.q] = checked; }
        i + 1 >= qsteps.length - 1 ? finish() : go(i + 1);
      });
      $('.q-back', st)?.addEventListener('click', () => go(Math.max(0, i - 1)));
    });
    go(0);
  }

  /* ---------- BMI calculator ---------- */
  const bmi = $('#bmi');
  if (bmi) bmi.addEventListener('input', () => {
    const ft = +$('[name=ft]', bmi).value, inch = +$('[name=in]', bmi).value || 0, lb = +$('[name=lb]', bmi).value, out = $('#bmi-out');
    if (!ft || !lb) { out.innerHTML = '<p class="muted">Enter your height and weight.</p>'; return; }
    const h = ft * 12 + inch, v = Math.round(lb / (h * h) * 703 * 10) / 10;
    const cat = v < 18.5 ? 'Underweight' : v < 25 ? 'Healthy range' : v < 30 ? 'Overweight' : 'Obesity range';
    const ok = v >= 27, maybe = v >= 25 && v < 27;
    out.innerHTML = `<div class="bmi-num">${v}</div><b>${cat}</b><p>${ok ? 'You may qualify for medical weight loss. A provider will confirm at your consult.' : maybe ? 'You may qualify if you have a weight-related condition such as high blood pressure. Let’s talk.' : 'Medical weight loss usually starts at a BMI of 27. Our wellness and aesthetics menu may be a better fit.'}</p>
      <a class="btn ${ok || maybe ? '' : 'ghost'}" href="${ok || maybe ? 'quiz.html' : 'aesthetics.html'}">${ok || maybe ? 'Take the 60-second quiz' : 'See aesthetics'}</a>`;
  });

  /* ---------- upsell + thank-you ---------- */
  $$('[data-upsell]').forEach(b => b.addEventListener('click', () => {
    const lb = store.get('lastBooking', null); const add = b.dataset.upsell;
    if (lb) { lb.addons = [...(lb.addons || []), add]; store.set('lastBooking', lb); const all = store.get('bookings', []); const x = all.find(y => y.ref === lb.ref); if (x) { x.addons = lb.addons; store.set('bookings', all); } send('upsell', { ref: lb.ref, add }); }
    b.closest('.upsell').classList.add('taken'); b.textContent = 'Added to your visit ✓'; b.disabled = true;
  }));
  const ty = $('#ty');
  if (ty) {
    const b = store.get('lastBooking', null);
    if (b) {
      $('#ty-ref').textContent = b.ref; $('#ty-name').textContent = b.first || 'there';
      $('#ty-when').textContent = `${b.treatment} · ${new Date(b.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${b.time}`;
      $('#ty-ics')?.addEventListener('click', () => ics(b));
    } else { $('#ty-when').textContent = 'We’ll text you to confirm a time.'; $('#ty-ics')?.remove(); }
  }

  /* ---------- portfolio note (Mika) ---------- */
  (function () {
    const n = document.createElement('div'); n.id = 'mika-note';
    n.innerHTML = '<span>Want a website like this? Email me at <a href="mailto:yourva.mika@gmail.com?subject=Website%20like%20your%20demo">yourva.mika@gmail.com</a></span><button aria-label="Minimize">×</button>';
    document.body.appendChild(n);
    let min = false; try { min = sessionStorage.getItem('mikaNoteMin') === '1'; } catch (e) {}
    if (min) n.classList.add('min');
    n.querySelector('button').addEventListener('click', e => { e.stopPropagation(); n.classList.add('min'); try { sessionStorage.setItem('mikaNoteMin', '1'); } catch (x) {} });
    n.addEventListener('click', () => { if (n.classList.contains('min')) { n.classList.remove('min'); try { sessionStorage.removeItem('mikaNoteMin'); } catch (x) {} } });
  })();
})();
