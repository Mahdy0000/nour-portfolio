/* Personalises the mirrored site for Nour Taha: only the WORDS change.
   The layout, 3D scene and interactions stay exactly as the site renders them.

   The scene rasterises its text panels (About, work detail, the number plate)
   the moment the runtime inserts them, so the swap has to happen at insert
   time - a later sweep would be too late for the visible 3D copy. */
(function () {
  'use strict';

  // Forged project slot -> Nour Taha's CV content
  var PROJECTS = {
    'The Collab Countdown': {
      title: 'Smart Vent — Mechanical Ventilator Prototype',
      type: 'Prototype',
      client: 'Badr University',
      desc: 'A sensor-driven mechanical ventilator built in C++ on Data Acquisition hardware. Real-time sensor data drives motor synchronization and dynamically adjusts ventilation parameters for stable performance, while a buzzer alert layer watches for unsafe conditions and signals faults immediately.'
    },
    'Nike&UT SXSW': {
      title: 'F1 Lap Time Prediction Model',
      type: 'Machine Learning',
      client: 'Personal Project',
      desc: 'A machine learning model that predicts lap times from motorsport dynamics. Features were engineered and preprocessed in Python with Pandas and NumPy, then trained with Scikit-learn; systematic hyperparameter tuning pushed the predictions closer to real lap data.'
    },
    'Collective Bloom': {
      title: 'Real-Time Air Quality Monitoring System',
      type: 'LabVIEW / DAQ',
      client: 'Badr University',
      desc: 'A real-time environmental monitoring system built around air quality sensors and a Data Acquisition interface. LabVIEW block diagrams handle signal processing and feed an interactive dashboard, giving reliable readings as conditions change through the day.'
    },
    'Color Explorer': {
      title: 'Robotics Competition — RC Car Fighting',
      type: 'Robotics',
      client: 'Competition Team',
      desc: 'Programming lead for a robotics competition team, responsible for software development and algorithm implementation. Real-time control algorithms in C++ on embedded systems kept the cars responsive and consistent, and the team took first place in the RC Car Fighting Competition.'
    },
    'Starbucks Coachella': {
      title: 'CubeSat Satellite',
      type: 'Aerospace',
      client: 'EGSA',
      desc: 'A collaborative aerospace project contributing to the design, development and integration of a CubeSat. Work covered satellite subsystem testing and validation, with the team preparing subsystems for mission readiness.'
    },
    'AI Color Changer': {
      title: 'IEEE — Data Science Track',
      type: 'Teaching',
      client: 'IEEE',
      desc: 'Instructor for the Data Science track, teaching foundational and intermediate Python, data analysis and machine learning to volunteers. The role also included mentoring on project development and technical growth, plus running technical workshops and code reviews.'
    },
    'AR Color Changer': {
      title: 'FUZETEK — Embedded Software Intern',
      type: 'Internship',
      client: 'FUZETEK',
      desc: 'An internship focused on embedded software: applying data structures and algorithms to improve efficiency and reliability, debugging and optimizing embedded components, and writing the technical documentation that supported system integration with other engineers.'
    }
  };

  // exact static strings -> Nour's wording
  var TEXT = {
    'Work Projects': 'Selected Projects',
    'Project Name': 'Project',
    'Project Type': 'Type',
    'Client': 'Role',
    'Description': 'Overview',
    "Let's make something amazing together": "Let's build something real together",
    'hey@forged.build': 'nourtaha053@gmail.com',
    "Sign up for our newsletter to get updates on new work, experiments, and what we're building at Forged.":
      "I'm open to internships, collaborations and mechatronics projects — the fastest way to reach me is email.",
    "This isn't just digital. It's built.": "This isn't just digital. It's built.",
    'LEANER, SHARPER, FORGED.': 'LEANER, SHARPER, ENGINEERED.',
    'WE ARE FORGED': 'WE ARE NOUR',
    "You're on the list — thanks for signing up.": "Thanks — I'll get back to you soon.",
    'Immersive experiences are forged from a mix of software and hardware but the best are driven by the unshakable drive to innovate. We leverage the latest in AI, XR, and digital-at-large to concept, design, and build best-in-class brand experiences.':
      "I'm Nour Taha, a mechatronics engineer at Badr University in Cairo — B.Sc. 2023–2028, GPA 3.48/4.0. I work where mechanics, electronics and software meet: sensor-driven machines, real-time control loops and data acquisition, plus machine learning when the data calls for it. Coursework in DAQ, electronics, control systems, modeling and simulation gave me the tools; projects like the Smart Vent prototype and my F1 lap-time model taught me how to use them.",
    "Michael Modena spent 13 years building a leading studio in immersive digital craft. Now, he's starting fresh; focused on creating the next generation of interactive experiences with unmatched efficiency and creative possibility.":
      "Nour Taha is a mechatronics engineer in Cairo, Egypt. I like hard problems with moving parts — real-time control, embedded systems, and the data that comes out of both."
  };

  var EMAIL = 'nourtaha053@gmail.com';

  var SOCIALS = [
    { from: 'youtube-icon.svg', icon: 'assets/images/mail-icon.svg', href: 'mailto:' + EMAIL, alt: 'Email', label: 'Email Nour Taha' },
    { from: 'instagram-icon.svg', icon: 'assets/images/cv-icon.svg', href: 'nour_taha_CV.pdf', alt: 'CV', label: "Download Nour Taha's CV" },
    { from: 'linkedin-icon.svg', icon: 'assets/images/linkedin-icon.svg', href: 'https://linkedin.com/in/nour-taha-058369', alt: 'LinkedIn', label: 'Nour Taha on LinkedIn' },
    { from: 'x-icon.svg', icon: 'assets/images/code-icon.svg', href: 'https://github.com/Mahdy0000', alt: 'GitHub', label: 'Nour Taha on GitHub' }
  ];

  /* ------------------------------------------------------------ translation */
  function translate(t) {
    if (Object.prototype.hasOwnProperty.call(TEXT, t)) return TEXT[t];
    if (PROJECTS[t]) return PROJECTS[t].title;
    var m = /^View (.+?) project for (.+)$/.exec(t);
    if (m && PROJECTS[m[1]]) {
      return 'View ' + PROJECTS[m[1]].title + ' for ' + PROJECTS[m[1]].client;
    }
    return null;
  }

  function rewriteTextNode(n) {
    if (!n || n.nodeType !== 3) return;
    var raw = n.nodeValue;
    if (!raw) return;
    var t = raw.trim();
    if (!t) return;
    var rep = translate(t);
    if (rep === null || raw === rep) return;
    var at = raw.indexOf(t);
    n.nodeValue = raw.slice(0, at) + rep + raw.slice(at + t.length);
  }

  function rewriteTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { rewriteTextNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = w.nextNode())) rewriteTextNode(n);
  }

  /* ------------------------------------------- creation-time hooks (3D copy) */
  function hookInsertion() {
    var proto = Node.prototype;
    var append = proto.appendChild;
    var insert = proto.insertBefore;
    proto.appendChild = function (node) {
      var res = append.call(this, node);
      try { rewriteTree(node); } catch (e) { }
      return res;
    };
    proto.insertBefore = function (node, ref) {
      var res = insert.call(this, node, ref);
      try { rewriteTree(node); } catch (e) { }
      return res;
    };

    // text assigned straight onto an element
    var elDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'textContent');
    if (elDesc && elDesc.set) {
      Object.defineProperty(Element.prototype, 'textContent', {
        get: elDesc.get,
        configurable: true,
        set: function (v) {
          var rep = translate(String(v).trim());
          elDesc.set.call(this, rep === null ? v : rep);
        }
      });
    }
    var cdDesc = Object.getOwnPropertyDescriptor(CharacterData.prototype, 'data');
    if (cdDesc && cdDesc.set) {
      Object.defineProperty(CharacterData.prototype, 'data', {
        get: cdDesc.get,
        configurable: true,
        set: function (v) {
          var rep = translate(String(v).trim());
          cdDesc.set.call(this, rep === null ? v : rep);
        }
      });
    }
  }

  /* ------------------------------------------------------ work detail panel */
  function patchDetail(root) {
    var panels = root.querySelectorAll('.WorkDetail');
    for (var i = 0; i < panels.length; i++) {
      var p = panels[i];
      var nameEl = p.querySelector('.project-name-value');
      if (!nameEl) continue;
      var key = nameEl.getAttribute('data-nour');
      if (!key) {
        var current = (nameEl.textContent || '').trim();
        if (!PROJECTS[current]) continue;
        key = current;
        nameEl.setAttribute('data-nour', key);
      }
      var d = PROJECTS[key];
      if (!d) continue;
      setText(nameEl, d.title);
      setText(p.querySelector('.badge-text'), d.type);
      setText(p.querySelector('.client-link'), d.client);
      setText(p.querySelector('.description-paragraph'), d.desc);
      var labels = p.querySelectorAll('.metadata-label');
      for (var j = 0; j < labels.length; j++) {
        var lbl = (labels[j].textContent || '').trim();
        if (Object.prototype.hasOwnProperty.call(TEXT, lbl)) setText(labels[j], TEXT[lbl]);
      }
    }
  }

  function setText(el, text) {
    if (!el) return;
    if (el.textContent !== text) el.textContent = text;
  }

  /* ------------------------------------------------------- contact / socials */
  function patchContacts() {
    var logo = document.querySelector('.logo');
    if (logo && logo.getAttribute('aria-label') !== 'Nour Taha logo') {
      logo.setAttribute('aria-label', 'Nour Taha logo');
    }

    var links = document.querySelectorAll('.email-link');
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      if (l.getAttribute('href') !== 'mailto:' + EMAIL) l.setAttribute('href', 'mailto:' + EMAIL);
      l.setAttribute('aria-label', 'Email us at ' + EMAIL);
    }

    var btns = document.querySelectorAll('.social-btn');
    for (var b = 0; b < btns.length; b++) {
      var btn = btns[b];
      var img = btn.querySelector('img.social-icon');
      if (!img) continue;
      var src = img.getAttribute('src') || '';
      for (var s = 0; s < SOCIALS.length; s++) {
        var def = SOCIALS[s];
        if (src.indexOf(def.from) === -1) continue;
        if (img.getAttribute('src') !== def.icon) img.setAttribute('src', def.icon);
        if (img.getAttribute('alt') !== def.alt) img.setAttribute('alt', def.alt);
        if (btn.getAttribute('href') !== def.href) btn.setAttribute('href', def.href);
        if (btn.getAttribute('aria-label') !== def.label) btn.setAttribute('aria-label', def.label);
        if (def.href.indexOf('mailto:') === 0) {
          btn.removeAttribute('target');
          btn.removeAttribute('rel');
        }
      }
    }

    var form = document.querySelector('form.email-form');
    if (form) {
      if (form.getAttribute('aria-label') !== 'Send Nour Taha a message') {
        form.setAttribute('aria-label', 'Send Nour Taha a message');
      }
      var sb = form.querySelector('.submit-btn');
      if (sb && sb.getAttribute('aria-label') !== 'Send message') {
        sb.setAttribute('aria-label', 'Send message');
      }
      if (!form.getAttribute('data-pf-bound')) {
        form.setAttribute('data-pf-bound', '1');
        // keep the visitor's address local: never post to the mirrored studio's list
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var input = form.querySelector('.email-input');
          var ok = input && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.value.trim());
          var err = form.querySelector('.error-message');
          var okMsg = form.querySelector('.success-message');
          if (err) err.classList.remove('show');
          if (okMsg) okMsg.classList.toggle('show', !!ok);
          if (err && !ok) err.classList.add('show');
        }, true);
      }
    }
  }

  function sweep() {
    if (!document.body) return;
    rewriteTree(document.body);
    patchDetail(document.body);
    patchContacts();
  }

  function start() {
    hookInsertion();
    sweep();
    setInterval(sweep, 250);
    document.addEventListener('DOMContentLoaded', sweep);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
