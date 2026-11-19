/* ===== Settings ===== */
document.addEventListener('DOMContentLoaded', function () {

  /* ----- Dark / light theme toggle ----- */
  var root = document.documentElement, btn = document.getElementById('tog');
  var sun = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  var moon = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    document.getElementById('ti').innerHTML = t === 'dark' ? sun : moon;
    btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = t === 'dark' ? '#0b0a12' : '#faf7ff';
  }
  applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  btn.addEventListener('click', function () {
    var t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(t);
    try { localStorage.setItem('theme', t); } catch (e) {}
  });

  /* ----- Footer year + seamless skills marquee ----- */
  document.getElementById('yr').textContent = new Date().getFullYear();
  var track = document.getElementById('track');
  track.innerHTML += track.innerHTML;

  /* ----- Product and project photos: fall back to the icon tile if a photo file is missing; click to enlarge ----- */
  var lb = document.getElementById('lightbox'), lbimg = document.getElementById('lbimg');
  document.querySelectorAll('.photo img, .thumb img').forEach(function (img) {
    var wrap = img.parentNode;
    function miss() { wrap.classList.add('missing'); }
    if (img.complete && img.naturalWidth === 0) miss();
    img.addEventListener('error', miss);
    img.addEventListener('click', function () {
      if (!lb.showModal) return;
      lbimg.src = img.src; lbimg.alt = img.alt; lb.showModal();
    });
  });
  document.getElementById('lbclose').addEventListener('click', function () { lb.close(); });
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });

  var bookingDate = document.getElementById('booking-date');
  var today = new Date();
  bookingDate.min = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');

  var bookingForm = document.getElementById('booking-form');
  var bookingStatus = document.getElementById('booking-status');
  bookingForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!bookingForm.reportValidity()) return;
    var details = new FormData(bookingForm);
    bookingStatus.textContent = 'Sending appointment request…';
    bookingStatus.className = 'status-msg';
    bookingForm.querySelector('button[type="submit"]').disabled = true;
    fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: details.get('name'),
        email: details.get('email'),
        service: details.get('service'),
        date: details.get('date'),
        time: details.get('time'),
        notes: details.get('notes')
      })
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) throw new Error(data.error || 'Could not submit the appointment request.');
        return data;
      });
    }).then(function (data) {
      bookingForm.reset();
      bookingStatus.textContent = data.message;
      bookingStatus.className = 'status-msg ok';
    }).catch(function (error) {
      bookingStatus.textContent = error.message || 'Could not submit the request. Please try again or contact Kajanan.';
      bookingStatus.className = 'status-msg bad';
    }).then(function () {
      bookingForm.querySelector('button[type="submit"]').disabled = false;
    });
  });

  /* ----- Filterable project grid ----- */
  var buttons = document.querySelectorAll('.chipbtn');
  var count = document.getElementById('count');
  var grid = document.getElementById('grid');
  var lb = document.getElementById('lightbox'), lbimg = document.getElementById('lbimg');
  var activeCategory = 'all';
  function filter(cat) {
    activeCategory = cat;
    var shown = 0;
    grid.querySelectorAll('.proj').forEach(function (c) {
      var show = cat === 'all' || c.getAttribute('data-cat') === cat;
      c.hidden = !show;
      if (show) shown++;
    });
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-filter') === cat ? 'true' : 'false');
    });
    count.textContent = 'Showing ' + shown + (shown === 1 ? ' project' : ' projects');
  }
  function renderProject(project) {
    var card = document.createElement('article');
    card.className = 'proj';
    card.setAttribute('data-cat', project.category);
    card.hidden = activeCategory !== 'all' && project.category !== activeCategory;

    var thumb = document.createElement('div');
    var categoryStyles = { builds: 't-a', repairs: 't-c', networking: 't-b', other: 't-a' };
    thumb.className = 'thumb ' + (categoryStyles[project.category] || 't-a');
    if (project.image) {
      var image = document.createElement('img');
      image.src = '/' + project.image.split('/').map(encodeURIComponent).join('/');
      image.alt = project.title;
      image.loading = 'lazy';
      image.addEventListener('error', function () { thumb.classList.add('missing'); });
      image.addEventListener('click', function () {
        if (!lb.showModal) return;
        lbimg.src = image.src;
        lbimg.alt = image.alt;
        lb.showModal();
      });
      thumb.appendChild(image);
    } else {
      var symbol = document.createElement('span');
      symbol.className = 'project-symbol';
      symbol.textContent = project.category === 'networking' ? 'NET' : project.category === 'repairs' ? 'FIX' : 'PC';
      thumb.appendChild(symbol);
    }

    var heading = document.createElement('h3');
    heading.textContent = project.title;
    if (project.link) {
      var link = document.createElement('a');
      link.href = project.link;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = project.title;
      heading.textContent = '';
      heading.appendChild(link);
    }
    var description = document.createElement('p');
    description.textContent = project.description;
    var tag = document.createElement('span');
    tag.className = 'tag';
    var labels = { builds: 'Build', repairs: 'Repair', networking: 'Networking', other: 'Other' };
    tag.textContent = labels[project.category] || 'Other';
    card.append(thumb, heading, description, tag);
    if (project.featured) {
      var featured = document.createElement('span');
      featured.className = 'tag';
      featured.textContent = 'Featured';
      card.appendChild(featured);
    }
    grid.appendChild(card);
  }
  fetch('/api/projects').then(function (response) {
    if (!response.ok) throw new Error('Could not load portfolio projects.');
    return response.json();
  }).then(function (data) {
    grid.replaceChildren();
    data.projects.forEach(renderProject);
    filter(activeCategory);
  }).catch(function (error) {
    count.textContent = 'Projects could not be loaded. Please refresh the page.';
    console.error(error);
  });
  buttons.forEach(function (b) {
    b.addEventListener('click', function () { filter(b.getAttribute('data-filter')); });
  });
  filter('all');

  /* ----- Contact form validation ----- */
  var form = document.getElementById('form');
  var status = document.getElementById('status');
  var sendBtn = document.getElementById('send');
  var rules = {
    name: function (v) { return v.trim().length >= 2 ? '' : 'Enter your name (at least 2 characters).'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email, like name@example.com.'; },
    message: function (v) { return v.trim().length >= 10 ? '' : 'Tell me a little more (at least 10 characters).'; }
  };
  function check(field) {
    var input = form.elements[field];
    var msg = rules[field](input.value);
    document.getElementById(field + '-err').textContent = msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  Object.keys(rules).forEach(function (f) {
    var input = form.elements[f];
    input.addEventListener('blur', function () { check(f); });
    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true') check(f);
    });
  });
  function say(text, cls) { status.textContent = text; status.className = 'status-msg ' + (cls || ''); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    say('');
    var firstBad = null;
    Object.keys(rules).forEach(function (f) {
      if (!check(f) && !firstBad) firstBad = form.elements[f];
    });
    if (firstBad) { firstBad.focus(); return; }
    if (form.elements.company.value) return;           // honeypot: bots fill this in
    sendBtn.disabled = true;
    say('Sending...');
    fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        message: form.elements.message.value.trim()
      })
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) throw new Error(data.error || 'Could not send your message.');
        return data;
      });
    }).then(function (data) {
      form.reset();
      say(data.message, 'ok');
    }).catch(function (error) {
      say(error.message || 'Could not send your message. Please try again or use Gmail.', 'bad');
    }).then(function () { sendBtn.disabled = false; });
  });

  /* ----- Portfolio chatbot ----- */
  var chatbotLauncher = document.getElementById('chatbot-launcher');
  var chatbotPanel = document.getElementById('chatbot-panel');
  var chatbotClose = document.getElementById('chatbot-close');
  var chatbotForm = document.getElementById('chatbot-form');
  var chatbotInput = document.getElementById('chatbot-input');
  var chatbotLog = document.getElementById('chatbot-log');
  var chatbotStatus = document.getElementById('chatbot-status');
  var chatbotSend = document.getElementById('chatbot-send');
  var chatHistory = [];
  var chatBusy = false;

  function setChatbotOpen(open) {
    chatbotPanel.hidden = !open;
    chatbotLauncher.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) chatbotInput.focus();
  }
  chatbotLauncher.addEventListener('click', function () {
    setChatbotOpen(chatbotPanel.hidden);
  });
  chatbotClose.addEventListener('click', function () {
    setChatbotOpen(false);
    chatbotLauncher.focus();
  });
  document.addEventListener('click', function (event) {
    if (!chatbotPanel.hidden && !event.target.closest('.chatbot-widget')) {
      setChatbotOpen(false);
    }
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !chatbotPanel.hidden) {
      setChatbotOpen(false);
      chatbotLauncher.focus();
    }
  });

  function addChatbotMessage(text, role) {
    var bubble = document.createElement('p');
    bubble.className = 'chatbot-message ' + (role === 'user' ? 'user-message' : 'bot-message');
    bubble.textContent = text;
    chatbotLog.appendChild(bubble);
    chatbotLog.scrollTop = chatbotLog.scrollHeight;
  }

  function showTypingIndicator() {
    var indicator = document.createElement('p');
    indicator.className = 'chatbot-message bot-message chatbot-typing';
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-label', 'Chatbot is typing');
    for (var i = 0; i < 3; i++) {
      var dot = document.createElement('span');
      dot.setAttribute('aria-hidden', 'true');
      indicator.appendChild(dot);
    }
    chatbotLog.appendChild(indicator);
    chatbotLog.scrollTop = chatbotLog.scrollHeight;
    return indicator;
  }

  function setChatbotBusy(busy) {
    chatBusy = busy;
    chatbotSend.disabled = busy;
    chatbotInput.disabled = busy;
    document.querySelectorAll('[data-chat-prompt]').forEach(function (button) {
      button.disabled = busy;
    });
  }

  function localChatReply(message) {
    var question = message.toLowerCase();
    if (/service|offer|do for/.test(question)) {
      return 'Kajanan provides PC building and upgrades, hardware troubleshooting and repairs, IT support, and networking help for homes and small offices.';
    }
    if (/training|qualification|study|cd world|nvq/.test(question)) {
      return 'Kajanan holds NVQ Level 4 in Computer Hardware/ICT and completed on-the-job training at CD World. He is also studying computer networking.';
    }
    if (/contact|email|linkedin|enquir/.test(question)) {
      return 'You can use the contact form on this website or reach Kajanan through his LinkedIn profile: https://www.linkedin.com/in/ramanan-kajanan-b9b8ab432';
    }
    if (/football|sport/.test(question)) {
      return 'Kajanan also creates football content. Ask him on LinkedIn or through the contact form for football-related enquiries.';
    }
    if (/network|wifi|router|switch|cabling/.test(question)) {
      return 'For networking, Kajanan can help with router and switch setup, cabling, Wi-Fi coverage issues, and connection faults for homes or small offices.';
    }
    if (/build|gaming pc|upgrade|ram|ssd/.test(question)) {
      return 'Kajanan can plan and assemble PCs for gaming, office work, or editing, then set up the BIOS, drivers, airflow, cooling, and basic storage or memory upgrades.';
    }
    if (/repair|broken|fault|power|no display|restart|overheat/.test(question)) {
      return 'Kajanan troubleshoots no-power, no-display, overheating, random-restart, software, and failed-component problems, testing the hardware to identify the fault.';
    }
    if (/hello|hi|hey/.test(question)) {
      return 'Hi! I’m Kajanan’s portfolio assistant. Ask me about his services, training, networking, PC repairs, or how to contact him.';
    }
    return 'I can help with Kajanan’s PC building, repair, IT support, networking, training, and contact information. Please ask a specific question, or use the contact form for an enquiry.';
  }

  function sendChatbotMessage(value) {
    var message = value.trim();
    if (!message || chatBusy) return;
    if (message.length > 2000) {
      chatbotStatus.textContent = 'Please keep your message under 2000 characters.';
      return;
    }

    chatbotStatus.textContent = '';
    chatbotInput.value = '';
    addChatbotMessage(message, 'user');
    chatHistory = chatHistory.slice(-8);
    chatHistory.push({ role: 'user', content: message });
    setChatbotBusy(true);
    var typing = showTypingIndicator();
    var minimumDelay = new Promise(function (resolve) { window.setTimeout(resolve, 450); });
    var chatRequest = fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory })
    }).then(function (response) {
      return response.text().then(function (text) {
        var data;
        try {
          data = JSON.parse(text);
        } catch (error) {
          if (response.ok) return { reply: localChatReply(message) };
          throw new Error('The chatbot service is temporarily unavailable. Please try again.');
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          if (response.ok) return { reply: localChatReply(message) };
          throw new Error('The chatbot service is temporarily unavailable. Please try again.');
        }
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'I couldn’t send a reply just now.');
        }
        if (typeof data.reply !== 'string' || !data.reply.trim()) {
          return { reply: localChatReply(message) };
        }
        return data;
      });
    });

    Promise.all([chatRequest, minimumDelay]).then(function (results) {
      typing.remove();
      addChatbotMessage(results[0].reply, 'assistant');
      chatHistory.push({ role: 'assistant', content: results[0].reply });
      chatHistory = chatHistory.slice(-10);
    }).catch(function (error) {
      typing.remove();
      if (chatHistory.length && chatHistory[chatHistory.length - 1].role === 'user') chatHistory.pop();
      chatbotStatus.textContent = error.name === 'TypeError'
        ? 'I can’t reach the chat service right now. Please try again in a moment.'
        : error.message || 'I couldn’t reply just now. Please try again.';
    }).then(function () {
      setChatbotBusy(false);
      if (!chatbotPanel.hidden) chatbotInput.focus();
    });
  }

  chatbotForm.addEventListener('submit', function (event) {
    event.preventDefault();
    sendChatbotMessage(chatbotInput.value);
  });
  chatbotInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      chatbotForm.requestSubmit();
    }
  });
  document.querySelectorAll('[data-chat-prompt]').forEach(function (button) {
    button.addEventListener('click', function () {
      sendChatbotMessage(button.dataset.chatPrompt);
    });
  });

});
