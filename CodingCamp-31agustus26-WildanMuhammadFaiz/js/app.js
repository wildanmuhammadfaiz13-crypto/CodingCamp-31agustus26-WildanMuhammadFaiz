(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // localStorage helpers
  // ---------------------------------------------------------------------------

  /** Tracks whether the storage-unavailable banner has been shown already. */
  var _storageBannerShown = false;

  /**
   * Show a non-blocking inline banner at the top of the page warning the user
   * that localStorage is unavailable. Only shown once per session.
   */
  function _showStorageBanner() {
    if (_storageBannerShown) return;
    _storageBannerShown = true;

    var banner = document.getElementById('storage-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'storage-banner';
      banner.setAttribute('role', 'alert');
      banner.textContent = 'Local storage unavailable. Changes won\'t be saved.';
      // Insert as the very first child of <body> so it appears at the top
      var body = document.body;
      if (body.firstChild) {
        body.insertBefore(banner, body.firstChild);
      } else {
        body.appendChild(banner);
      }
    }
    banner.style.display = 'block';
  }

  /**
   * Read a value from localStorage.
   * @param {string} key - The storage key.
   * @param {*} fallback - Value returned when the key is absent or on error.
   * @returns {*} Parsed value, or `fallback` if absent/invalid.
   */
  function storageGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      // SecurityError (e.g. file:// in some browsers) or JSON.parse failure
      if (e instanceof SyntaxError) {
        console.warn('Personal Dashboard: failed to parse stored value for key "' + key + '". Resetting to default.');
      } else {
        _showStorageBanner();
      }
      return fallback;
    }
  }

  /**
   * Write a value to localStorage.
   * @param {string} key - The storage key.
   * @param {*} value - Any JSON-serialisable value.
   */
  function storageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // SecurityError or QuotaExceededError
      _showStorageBanner();
    }
  }

  // ---------------------------------------------------------------------------
  // Clock & Greeting helpers (task 3.1)
  // ---------------------------------------------------------------------------

  /**
   * Return the appropriate greeting prefix for a given hour of the day.
   * @param {number} hour - Local hour (0–23).
   * @returns {"Good Morning"|"Good Afternoon"|"Good Evening"|"Good Night"}
   */
  function getGreetingPrefix(hour) {
    if (hour >= 5 && hour <= 11) return 'Good Morning';
    if (hour >= 12 && hour <= 17) return 'Good Afternoon';
    if (hour >= 18 && hour <= 20) return 'Good Evening';
    return 'Good Night'; // 21–23 and 00–04
  }

  /**
   * Format a Date object into a human-readable string.
   * @param {Date} date - The date to format.
   * @returns {string} e.g. "Monday, 4 September 2026", or "---" if invalid.
   */
  function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '---';
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  // ---------------------------------------------------------------------------
  // Module-level state
  // ---------------------------------------------------------------------------

  /** The user's display name, loaded from localStorage on init. */
  var userName = '';

  /** In-memory task list, populated from localStorage on init. */
  var tasks = [];

  /** Active sort option for the to-do list, persisted to localStorage. */
  var sortOption = 'default';

  /** In-memory quick links array, populated from localStorage on init. */
  var links = [];

  // ---------------------------------------------------------------------------
  // Component stubs — each will be filled in by subsequent tasks
  // ---------------------------------------------------------------------------

  /** Theme component (task 2.1) */

  /**
   * Apply a theme to the document and persist it.
   * @param {string} t - Either "light" or "dark".
   */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    storageSet('theme', t);

    var btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.textContent = t === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
    }
  }

  /**
   * Wire up the theme toggle button and apply the saved (or default) theme.
   */
  function initTheme() {
    var saved = storageGet('theme', 'light');
    applyTheme(saved);

    var btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        var current = document.documentElement.dataset.theme;
        applyTheme(current === 'dark' ? 'light' : 'dark');
      });
    }
  }

  /** Clock & Greeting component (task 3.2) */

  /**
   * Pad a number to two digits with a leading zero if needed.
   * @param {number} n
   * @returns {string}
   */
  function _pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /**
   * Rebuild the greeting section DOM from the current time and stored userName.
   * Called once immediately on init and then every second by setInterval.
   */
  function renderGreeting() {
    var now = new Date();
    var isValid = !isNaN(now.getTime());

    // Time string
    var timeStr = isValid
      ? _pad2(now.getHours()) + ':' + _pad2(now.getMinutes()) + ':' + _pad2(now.getSeconds())
      : '--:--:--';

    // Date string
    var dateStr = isValid ? formatDate(now) : '---';

    // Greeting string
    var prefix = isValid ? getGreetingPrefix(now.getHours()) : 'Hello';
    var greetingStr = userName
      ? prefix + ', ' + userName + '!'
      : prefix;

    // Update DOM
    var timeEl = document.querySelector('#greeting-section .greeting-time');
    var dateEl = document.querySelector('#greeting-section .greeting-date');
    var msgEl  = document.querySelector('#greeting-section .greeting-message');

    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
    if (msgEl)  msgEl.textContent  = greetingStr;
  }

  /**
   * Start the 1-second clock interval and render the greeting immediately.
   */
  function initClock() {
    renderGreeting();
    setInterval(renderGreeting, 1000);
  }

  /** Name Settings component (task 4.1) */

  /**
   * Persist the user's display name and refresh the greeting.
   * @param {string} rawValue - The raw value from the name input field.
   */
  function saveName(rawValue) {
    var trimmed = rawValue.trim();
    if (trimmed) {
      storageSet('userName', trimmed);
      userName = trimmed;
    } else {
      try {
        localStorage.removeItem('userName');
      } catch (e) {
        _showStorageBanner();
      }
      userName = '';
    }
    renderGreeting();
  }

  /**
   * Read the saved user name, pre-populate the name input, and wire up the
   * name form's submit listener.
   */
  function initNameSettings() {
    userName = storageGet('userName', '');

    var input = document.getElementById('name-input');
    if (input) {
      input.value = userName;
    }

    var form = document.getElementById('name-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var nameInput = document.getElementById('name-input');
        saveName(nameInput ? nameInput.value : '');
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Focus Timer — state and render (task 5.1)
  // ---------------------------------------------------------------------------

  /**
   * Timer state object. Holds all mutable timer data in one place.
   * durationSeconds  — the full countdown length (mirrors saved pomodoroDuration).
   * remainingSeconds — seconds left on the current countdown.
   * isRunning        — true while the interval is active.
   * intervalId       — the handle returned by setInterval (null when idle).
   */
  var timerState = {
    durationSeconds: 1500,
    remainingSeconds: 1500,
    isRunning: false,
    intervalId: null
  };

  /**
   * Format a number of seconds into a "MM:SS" string.
   * @param {number} totalSeconds - Non-negative integer.
   * @returns {string} e.g. 1500 → "25:00", 65 → "01:05"
   */
  function _formatTime(totalSeconds) {
    var mins = Math.floor(totalSeconds / 60);
    var secs = totalSeconds % 60;
    return _pad2(mins) + ':' + _pad2(secs);
  }

  /**
   * Rebuild the timer display and button enabled/disabled states from
   * the current `timerState`.
   * Requirements: 3.3, 3.7, 3.8
   */
  function renderTimer() {
    // Update the MM:SS display
    var displayEl = document.getElementById('timer-display');
    if (displayEl) {
      displayEl.textContent = _formatTime(timerState.remainingSeconds);
    }

    // Button state: Start disabled while running; Stop disabled while paused/reset
    var startBtn = document.getElementById('timer-start');
    var stopBtn  = document.getElementById('timer-stop');
    var resetBtn = document.getElementById('timer-reset');

    if (startBtn) startBtn.disabled = timerState.isRunning;
    if (stopBtn)  stopBtn.disabled  = !timerState.isRunning;
    if (resetBtn) resetBtn.disabled = false; // always enabled
  }

  // ---------------------------------------------------------------------------
  // Focus Timer — controls (task 5.2)
  // ---------------------------------------------------------------------------

  /**
   * Start the countdown interval.
   * Sets isRunning, launches setInterval, and re-renders button states.
   * Requirements: 3.2, 3.7
   */
  function startTimer() {
    if (timerState.isRunning) return; // guard against double-start
    timerState.isRunning = true;
    timerState.intervalId = setInterval(tickTimer, 1000);
    renderTimer();
  }

  /**
   * Pause the countdown by clearing the active interval.
   * Requirements: 3.4, 3.8
   */
  function stopTimer() {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
    timerState.isRunning = false;
    renderTimer();
  }

  /**
   * Stop the countdown and restore remaining time to the full duration.
   * Requirements: 3.5
   */
  function resetTimer() {
    stopTimer();
    timerState.remainingSeconds = timerState.durationSeconds;
    renderTimer();
  }

  /**
   * Called every second by the interval started in startTimer().
   * Decrements remaining time; at zero, stops and fires the alert.
   * Requirements: 3.3, 3.6
   */
  function tickTimer() {
    timerState.remainingSeconds -= 1;
    if (timerState.remainingSeconds <= 0) {
      timerState.remainingSeconds = 0;
      stopTimer();
      playAlert();
    } else {
      renderTimer();
    }
  }

  /**
   * Play an audible beep using the Web Audio API when the timer reaches zero.
   * Falls back to (and always also shows) a visible notification in #timer-alert.
   * Requirements: 3.6
   */
  function playAlert() {
    // Always show the visible notification banner as a visual cue
    var alertEl = document.getElementById('timer-alert');
    if (alertEl) {
      alertEl.textContent = '⏰ Time\'s up!';
      alertEl.removeAttribute('hidden');
    }

    // Attempt to play an audible beep via Web Audio API
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        // Web Audio API not available — visual fallback already shown above
        return;
      }
      var ctx = new AudioCtx();
      var oscillator = ctx.createOscillator();
      var gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 440; // 440 Hz — concert A

      // Soft fade-out: ramp gain from 0.3 → 0 over 0.5 seconds
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);

      // Clean up AudioContext after the beep finishes
      oscillator.onended = function () {
        try { ctx.close(); } catch (e) { /* ignore */ }
      };
    } catch (e) {
      // Web Audio API threw — visual fallback already shown above
    }
  }

  // ---------------------------------------------------------------------------
  // Focus Timer — duration update (task 5.4)
  // ---------------------------------------------------------------------------

  /**
   * Apply a new timer duration (in minutes) when the timer is not running.
   * No-op if the timer is currently counting down.
   * Also hides the timer alert banner so the visual state is clean.
   * @param {number} min - New duration in minutes (already validated as 1–120).
   * Requirements: 4.4, 4.5
   */
  function applyNewDuration(min) {
    if (timerState.isRunning) return; // no-op while running

    timerState.durationSeconds  = min * 60;
    timerState.remainingSeconds = timerState.durationSeconds;

    // Hide any existing "Time's up!" banner when duration is changed
    var alertEl = document.getElementById('timer-alert');
    if (alertEl) alertEl.setAttribute('hidden', '');

    renderTimer();
  }

  /** Duration Settings component (task 6.1) */

  /**
   * Validate and persist a new Pomodoro duration value.
   * Accepts only integers in the range 1–120 (inclusive).
   * @param {string|number} rawValue - The raw value from the duration input.
   */
  function saveDuration(rawValue) {
    var parsed = parseInt(rawValue, 10);
    var errorEl = document.getElementById('duration-error');

    if (isNaN(parsed) || parsed < 1 || parsed > 120) {
      // Show inline error and bail out without mutation
      if (errorEl) {
        errorEl.textContent = 'Please enter a whole number between 1 and 120.';
        errorEl.removeAttribute('hidden');
      }
      return;
    }

    // Valid — persist and apply
    storageSet('pomodoroDuration', parsed);
    if (typeof applyNewDuration === 'function') {
      applyNewDuration(parsed);
    }

    // Clear error on success
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.setAttribute('hidden', '');
    }
  }

  /**
   * Read the saved Pomodoro duration, pre-populate the duration input, and
   * wire up the duration form's submit listener.
   */
  function initDurationSettings() {
    var saved = storageGet('pomodoroDuration', 25);

    var input = document.getElementById('duration-input');
    if (input) {
      input.value = saved;
    }

    var form = document.getElementById('duration-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var durationInput = document.getElementById('duration-input');
        saveDuration(durationInput ? durationInput.value : '');
      });
    }
  }

  /** Focus Timer component (task 5.4) */

  /**
   * Read the saved Pomodoro duration, initialize timer state, wire up
   * Start/Stop/Reset button click listeners, and call renderTimer().
   * Requirements: 3.1, 4.4, 4.5, 4.6
   */
  function initTimer() {
    var saved = storageGet('pomodoroDuration', 25);

    // Initialise state from persisted duration
    timerState.durationSeconds  = saved * 60;
    timerState.remainingSeconds = timerState.durationSeconds;

    // Wire Start button
    var startBtn = document.getElementById('timer-start');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        startTimer();
      });
    }

    // Wire Stop button
    var stopBtn = document.getElementById('timer-stop');
    if (stopBtn) {
      stopBtn.addEventListener('click', function () {
        stopTimer();
      });
    }

    // Wire Reset button — also hides the timer alert banner
    var resetBtn = document.getElementById('timer-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetTimer();
        var alertEl = document.getElementById('timer-alert');
        if (alertEl) alertEl.setAttribute('hidden', '');
      });
    }

    renderTimer();
  }

  // ---------------------------------------------------------------------------
  // To-Do List — pure helpers (task 7.1)
  // ---------------------------------------------------------------------------

  /**
   * Normalize a task title for duplicate comparison: trim whitespace and
   * convert to lower-case.
   * @param {string} s - Raw task title string.
   * @returns {string} Normalized title.
   */
  function normalizeTodoTitle(s) {
    return s.trim().toLowerCase();
  }

  /**
   * Return a sorted shallow copy of a task array according to `sortOption`.
   * The original array is never mutated.
   *
   * @param {Array<{id:string, title:string, completed:boolean, createdAt:number}>} tasks
   * @param {string} sortOption - One of: "default", "alpha-asc", "alpha-desc",
   *   "completed-last", "completed-first".
   * @returns {Array} Sorted copy of the tasks array.
   */
  function getSortedTasks(tasks, sortOption) {
    var copy = tasks.slice();

    switch (sortOption) {
      case 'alpha-asc':
        copy.sort(function (a, b) {
          var ta = a.title.toLowerCase();
          var tb = b.title.toLowerCase();
          if (ta < tb) return -1;
          if (ta > tb) return 1;
          return 0;
        });
        break;

      case 'alpha-desc':
        copy.sort(function (a, b) {
          var ta = a.title.toLowerCase();
          var tb = b.title.toLowerCase();
          if (ta > tb) return -1;
          if (ta < tb) return 1;
          return 0;
        });
        break;

      case 'completed-last':
        // incomplete (false) before complete (true)
        copy.sort(function (a, b) {
          if (a.completed === b.completed) return 0;
          return a.completed ? 1 : -1;
        });
        break;

      case 'completed-first':
        // complete (true) before incomplete (false)
        copy.sort(function (a, b) {
          if (a.completed === b.completed) return 0;
          return a.completed ? -1 : 1;
        });
        break;

      case 'default':
      default:
        // creation order ascending
        copy.sort(function (a, b) {
          return a.createdAt - b.createdAt;
        });
        break;
    }

    return copy;
  }

  // ---------------------------------------------------------------------------
  // To-Do List — CRUD (task 7.6)
  // ---------------------------------------------------------------------------

  /**
   * Persist the current in-memory tasks array to localStorage.
   */
  function saveTasks() {
    storageSet('tasks', tasks);
  }

  /**
   * Add a new task to the list after validation and duplicate checking.
   * @param {string} title - Raw title from the input field.
   */
  function addTask(title) {
    var errorEl = document.getElementById('todo-error');
    var warnEl  = document.getElementById('todo-warn');

    var trimmed = title.trim();

    // Empty title validation
    if (!trimmed) {
      if (errorEl) {
        errorEl.textContent = 'Task title cannot be empty.';
        errorEl.removeAttribute('hidden');
      }
      if (warnEl) warnEl.setAttribute('hidden', '');
      return;
    }

    // Duplicate detection (case-insensitive via normalizeTodoTitle)
    var normalized = normalizeTodoTitle(trimmed);
    var isDuplicate = tasks.some(function (t) {
      return normalizeTodoTitle(t.title) === normalized;
    });

    if (isDuplicate) {
      if (warnEl) {
        warnEl.textContent = 'A task with that title already exists.';
        warnEl.removeAttribute('hidden');
      }
      if (errorEl) errorEl.setAttribute('hidden', '');
      return;
    }

    // Create and append task
    var newTask = {
      id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      title: trimmed,
      completed: false,
      createdAt: Date.now()
    };

    tasks.push(newTask);
    saveTasks();
    renderTasks();

    // Clear input and hide messages on success
    var input = document.getElementById('todo-input');
    if (input) input.value = '';
    if (errorEl) errorEl.setAttribute('hidden', '');
    if (warnEl)  warnEl.setAttribute('hidden', '');
  }

  /**
   * Remove a task by its id, then persist and re-render.
   * @param {string} id - The id of the task to remove.
   */
  function deleteTask(id) {
    tasks = tasks.filter(function (t) { return t.id !== id; });
    saveTasks();
    renderTasks();
  }

  /**
   * Flip the completed status of a task, then persist and re-render.
   * @param {string} id - The id of the task to toggle.
   */
  function toggleTask(id) {
    var task = tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();
    renderTasks();
  }

  /**
   * Switch a task row into inline-edit mode.
   * Replaces the title <span> with a pre-filled <input> and shows
   * confirm/cancel controls. Does NOT call renderTasks().
   * @param {string} id - The id of the task to edit.
   */
  function startEditTask(id) {
    var row = document.querySelector('[data-task-id="' + id + '"]');
    if (!row) return;

    var task = tasks.find(function (t) { return t.id === id; });
    if (!task) return;

    // Swap title span → text input
    var titleSpan = row.querySelector('.task-title');
    if (!titleSpan) return;

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input';
    input.value = task.title;
    input.maxLength = 200;
    input.setAttribute('aria-label', 'Edit task title');

    titleSpan.parentNode.replaceChild(input, titleSpan);
    input.focus();
    input.select();

    // Hide the regular edit button
    var editBtn = row.querySelector('.task-edit-btn');
    if (editBtn) editBtn.setAttribute('hidden', '');

    // Show confirm and cancel controls
    var confirmBtn = row.querySelector('.task-confirm-edit');
    var cancelBtn  = row.querySelector('.task-cancel-edit');
    if (confirmBtn) confirmBtn.removeAttribute('hidden');
    if (cancelBtn)  cancelBtn.removeAttribute('hidden');

    // Allow pressing Enter to confirm and Escape to cancel
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmEditTask(id, input.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        renderTasks(); // cancels edit by re-rendering
      }
    });
  }

  /**
   * Validate and commit an inline title edit.
   * On empty or duplicate title: reject and restore via renderTasks(), show
   * an inline message in .task-edit-error.
   * On success: update title in memory, persist, re-render.
   * @param {string} id       - The id of the task being edited.
   * @param {string} newTitle - The raw value from the edit input.
   */
  function confirmEditTask(id, newTitle) {
    var trimmed = (newTitle || '').trim();

    // Helper: show an error in the task row without leaving a broken DOM
    function _showEditError(msg) {
      // Re-render to restore the normal row layout, then inject the error span
      renderTasks();
      var row = document.querySelector('[data-task-id="' + id + '"]');
      if (!row) return;
      var errorSpan = row.querySelector('.task-edit-error');
      if (!errorSpan) {
        errorSpan = document.createElement('span');
        errorSpan.className = 'task-edit-error error-msg';
        errorSpan.setAttribute('role', 'alert');
        row.appendChild(errorSpan);
      }
      errorSpan.textContent = msg;
      errorSpan.removeAttribute('hidden');
    }

    // Empty title validation
    if (!trimmed) {
      _showEditError('Task title cannot be empty.');
      return;
    }

    // Duplicate detection against all OTHER tasks (excluding self)
    var normalized = normalizeTodoTitle(trimmed);
    var isDuplicate = tasks.some(function (t) {
      return t.id !== id && normalizeTodoTitle(t.title) === normalized;
    });

    if (isDuplicate) {
      _showEditError('A task with that title already exists.');
      return;
    }

    // Success — update in memory, persist, re-render
    var task = tasks.find(function (t) { return t.id === id; });
    if (task) {
      task.title = trimmed;
    }
    saveTasks();
    renderTasks();
  }

  /** To-Do List component (task 7.10) */

  /**
   * Rebuild the #task-list UL from the current in-memory tasks array,
   * sorted by the active sortOption.
   * Requirements: 5.1, 5.4, 7.1, 7.2, 7.3, 7.4
   */
  function renderTasks() {
    var listEl = document.getElementById('task-list');
    if (!listEl) return;

    var sorted = getSortedTasks(tasks, sortOption);

    // Clear existing rows
    listEl.innerHTML = '';

    sorted.forEach(function (task) {
      var li = document.createElement('li');
      li.className = 'task-item' + (task.completed ? ' task--completed' : '');
      li.setAttribute('data-task-id', task.id);

      // Completion toggle checkbox
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-toggle';
      checkbox.checked = task.completed;
      checkbox.setAttribute('aria-label', 'Mark "' + task.title + '" as ' + (task.completed ? 'incomplete' : 'complete'));

      // Title span
      var titleSpan = document.createElement('span');
      titleSpan.className = 'task-title';
      titleSpan.textContent = task.title;

      // Edit button
      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'task-edit-btn';
      editBtn.textContent = 'Edit';
      editBtn.setAttribute('aria-label', 'Edit task');

      // Confirm edit button (hidden until edit mode)
      var confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'task-confirm-edit';
      confirmBtn.textContent = '✓';
      confirmBtn.setAttribute('aria-label', 'Confirm edit');
      confirmBtn.setAttribute('hidden', '');

      // Cancel edit button (hidden until edit mode)
      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'task-cancel-edit';
      cancelBtn.textContent = '✗';
      cancelBtn.setAttribute('aria-label', 'Cancel edit');
      cancelBtn.setAttribute('hidden', '');

      // Delete button
      var deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'task-delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.setAttribute('aria-label', 'Delete task');

      li.appendChild(checkbox);
      li.appendChild(titleSpan);
      li.appendChild(editBtn);
      li.appendChild(confirmBtn);
      li.appendChild(cancelBtn);
      li.appendChild(deleteBtn);

      listEl.appendChild(li);
    });
  }

  /**
   * Load tasks and sort preference from localStorage, wire up all event
   * listeners for the to-do list, and call renderTasks() for initial render.
   * Requirements: 5.1, 5.4, 5.10, 7.1, 7.2, 7.3, 7.4
   */
  function initTodoList() {
    // Restore persisted state
    tasks = storageGet('tasks', []);
    sortOption = storageGet('sortOption', 'default');

    // Reflect saved sort option in the select element
    var sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.value = sortOption;
    }

    // Delegated click listener on the task list container
    var listEl = document.getElementById('task-list');
    if (listEl) {
      listEl.addEventListener('click', function (e) {
        var target = e.target;

        // Walk up to find the task row
        var row = target.closest ? target.closest('[data-task-id]') : null;
        if (!row) {
          // Fallback for browsers without Element.closest
          var el = target;
          while (el && el !== listEl) {
            if (el.getAttribute('data-task-id')) { row = el; break; }
            el = el.parentNode;
          }
        }
        if (!row) return;

        var taskId = row.getAttribute('data-task-id');

        if (target.classList.contains('task-toggle')) {
          toggleTask(taskId);
        } else if (target.classList.contains('task-edit-btn')) {
          startEditTask(taskId);
        } else if (target.classList.contains('task-confirm-edit')) {
          var editInput = row.querySelector('.task-edit-input');
          confirmEditTask(taskId, editInput ? editInput.value : '');
        } else if (target.classList.contains('task-cancel-edit')) {
          renderTasks();
        } else if (target.classList.contains('task-delete-btn')) {
          deleteTask(taskId);
        }
      });
    }

    // Sort selector change listener
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        sortOption = sortSelect.value;
        storageSet('sortOption', sortOption);
        renderTasks();
      });
    }

    // Add-task form submit listener
    var todoForm = document.getElementById('todo-form');
    if (todoForm) {
      todoForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = document.getElementById('todo-input');
        addTask(input ? input.value : '');
      });
    }

    // Initial render
    renderTasks();
  }

  // ---------------------------------------------------------------------------
  // Quick Links — helpers and CRUD (task 8.1)
  // ---------------------------------------------------------------------------

  /**
   * Return true iff `url` begins with "http://" or "https://" and is at
   * most 2048 characters long.
   * @param {string} url
   * @returns {boolean}
   */
  function isValidUrl(url) {
    if (typeof url !== 'string') return false;
    if (url.length > 2048) return false;
    return url.indexOf('http://') === 0 || url.indexOf('https://') === 0;
  }

  /**
   * Persist the current in-memory links array to localStorage.
   */
  function saveLinks() {
    storageSet('links', links);
  }

  /**
   * Add a new link after validation and limit checking.
   * @param {string} label - Raw label from the label input.
   * @param {string} url   - Raw URL from the URL input.
   */
  function addLink(label, url) {
    var errorEl = document.getElementById('links-error');

    var trimmedLabel = (label || '').trim();
    var trimmedUrl   = (url   || '').trim();

    // Empty label or invalid URL
    if (!trimmedLabel || !isValidUrl(trimmedUrl)) {
      if (errorEl) {
        errorEl.textContent = 'Please enter a label and a valid URL (starting with http:// or https://).';
        errorEl.removeAttribute('hidden');
      }
      return;
    }

    // 50-link maximum
    if (links.length >= 50) {
      if (errorEl) {
        errorEl.textContent = 'Maximum 50 links allowed.';
        errorEl.removeAttribute('hidden');
      }
      return;
    }

    // Create and append link
    var newLink = {
      id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      label: trimmedLabel,
      url: trimmedUrl
    };

    links.push(newLink);
    saveLinks();
    renderLinks();

    // Clear inputs and hide error on success
    var labelInput = document.getElementById('link-label-input');
    var urlInput   = document.getElementById('link-url-input');
    if (labelInput) labelInput.value = '';
    if (urlInput)   urlInput.value   = '';
    if (errorEl)    errorEl.setAttribute('hidden', '');
  }

  /**
   * Remove a link by its id, then persist and re-render.
   * @param {string} id - The id of the link to remove.
   */
  function deleteLink(id) {
    links = links.filter(function (l) { return l.id !== id; });
    saveLinks();
    renderLinks();
  }

  /** Quick Links component (task 8.4) */

  /**
   * Rebuild the #links-list UL from the current in-memory links array.
   * Each row contains an open button and a delete button.
   * Requirements: 8.1, 8.4, 8.5
   */
  function renderLinks() {
    var listEl = document.getElementById('links-list');
    if (!listEl) return;

    // Clear existing rows
    listEl.innerHTML = '';

    links.forEach(function (link) {
      var li = document.createElement('li');
      li.className = 'link-item';
      li.setAttribute('data-link-id', link.id);

      // Open button — label text, opens URL in new tab
      var openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'link-open-btn';
      openBtn.textContent = link.label;
      openBtn.setAttribute('aria-label', 'Open ' + link.label);

      // Delete button
      var deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'link-delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.setAttribute('aria-label', 'Delete link ' + link.label);

      li.appendChild(openBtn);
      li.appendChild(deleteBtn);

      listEl.appendChild(li);
    });
  }

  /**
   * Load links from localStorage, wire up the add-link form and delegated
   * click listeners, and call renderLinks() for the initial render.
   * Requirements: 8.1, 8.4, 8.5, 8.7
   */
  function initQuickLinks() {
    // Restore persisted links
    links = storageGet('links', []);

    // Add-link form submit listener
    var linksForm = document.getElementById('links-form');
    if (linksForm) {
      linksForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var labelInput = document.getElementById('link-label-input');
        var urlInput   = document.getElementById('link-url-input');
        addLink(
          labelInput ? labelInput.value : '',
          urlInput   ? urlInput.value   : ''
        );
      });
    }

    // Delegated click listener on the links list container
    var listEl = document.getElementById('links-list');
    if (listEl) {
      listEl.addEventListener('click', function (e) {
        var target = e.target;

        // Walk up to find the <li> with data-link-id
        var li = target.closest ? target.closest('[data-link-id]') : null;
        if (!li) {
          var el = target;
          while (el && el !== listEl) {
            if (el.getAttribute('data-link-id')) { li = el; break; }
            el = el.parentNode;
          }
        }
        if (!li) return;

        var linkId = li.getAttribute('data-link-id');

        if (target.classList.contains('link-open-btn')) {
          // Find the link and open in new tab
          var link = links.find(function (l) { return l.id === linkId; });
          if (link) {
            window.open(link.url, '_blank', 'noopener,noreferrer');
          }
        } else if (target.classList.contains('link-delete-btn')) {
          deleteLink(linkId);
        }
      });
    }

    // Initial render
    renderLinks();
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initClock();
    initNameSettings();
    initDurationSettings();
    initTimer();
    initTodoList();
    initQuickLinks();
  });

  // ---------------------------------------------------------------------------
  // Test bridge — exposes pure functions for the browser-based test suite.
  // window.__dashboardTest is pre-defined by test/index.html before this
  // script loads; nothing is exposed in normal page usage.
  // ---------------------------------------------------------------------------

  if (typeof window !== 'undefined' && window.__dashboardTest) {
    window.__dashboardTest.storageGet = storageGet;
    window.__dashboardTest.storageSet = storageSet;
    window.__dashboardTest.applyTheme = applyTheme;
    window.__dashboardTest.getGreetingPrefix = getGreetingPrefix;
    window.__dashboardTest.formatDate = formatDate;
    window.__dashboardTest.renderGreeting = renderGreeting;
    window.__dashboardTest.normalizeTodoTitle = normalizeTodoTitle;
    window.__dashboardTest.getSortedTasks = getSortedTasks;
    window.__dashboardTest.saveName = saveName;
    window.__dashboardTest.saveDuration = saveDuration;
    window.__dashboardTest.applyNewDuration = applyNewDuration;
    window.__dashboardTest.timerState = timerState;
    window.__dashboardTest.renderTimer = renderTimer;
    window.__dashboardTest.startTimer = startTimer;
    window.__dashboardTest.stopTimer = stopTimer;
    window.__dashboardTest.resetTimer = resetTimer;
    window.__dashboardTest.tickTimer = tickTimer;
    window.__dashboardTest.playAlert = playAlert;
    window.__dashboardTest.saveTasks = saveTasks;
    window.__dashboardTest.addTask = addTask;
    window.__dashboardTest.deleteTask = deleteTask;
    window.__dashboardTest.toggleTask = toggleTask;
    window.__dashboardTest.confirmEditTask = confirmEditTask;
    window.__dashboardTest.renderTasks = renderTasks;
    // Expose tasks array getter/setter so tests can inspect and seed in-memory state
    window.__dashboardTest.getTasks = function () { return tasks; };
    window.__dashboardTest.setTasks = function (arr) { tasks = arr; };
    // Expose sortOption getter/setter
    window.__dashboardTest.getSortOption = function () { return sortOption; };
    window.__dashboardTest.setSortOption = function (v) { sortOption = v; };
    // Expose quick-links functions and getter/setter
    window.__dashboardTest.isValidUrl   = isValidUrl;
    window.__dashboardTest.saveLinks    = saveLinks;
    window.__dashboardTest.addLink      = addLink;
    window.__dashboardTest.deleteLink   = deleteLink;
    window.__dashboardTest.renderLinks  = renderLinks;
    window.__dashboardTest.getLinks     = function () { return links; };
    window.__dashboardTest.setLinks     = function (arr) { links = arr; };
  }

})();
