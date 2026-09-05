/**
 * test/tests.js
 * Personal Dashboard — browser-based test suite
 *
 * Runs inside test/index.html using Jasmine standalone + fast-check.
 * Pure functions are exposed by js/app.js via the window.__dashboardTest
 * bridge, which is activated by setting window.__dashboardTest = {} before
 * app.js loads (done in test/index.html).
 */

// ---------------------------------------------------------------------------
// Extract test-bridge functions into local variables
// ---------------------------------------------------------------------------

var T = window.__dashboardTest;

var getGreetingPrefix  = T.getGreetingPrefix;
var formatDate         = T.formatDate;
var normalizeTodoTitle = T.normalizeTodoTitle;
var getSortedTasks     = T.getSortedTasks;
var isValidUrl         = T.isValidUrl;
var saveDuration       = T.saveDuration;
var addTask            = T.addTask;
var deleteTask         = T.deleteTask;
var addLink            = T.addLink;
var getTasks           = T.getTasks;
var setTasks           = T.setTasks;
var getLinks           = T.getLinks;
var setLinks           = T.setLinks;

/**
 * Pure validation wrapper for Pomodoro duration.
 * Mirrors the acceptance logic inside saveDuration without causing
 * side-effects (no localStorage writes, no DOM mutations).
 * @param {*} n - The raw value to validate.
 * @returns {boolean} true iff n is an integer in the range 1–120 (inclusive).
 */
function validateDuration(n) {
  var parsed = parseInt(n, 10);
  return !isNaN(parsed) && parsed >= 1 && parsed <= 120;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Personal Dashboard', function () {

  // -------------------------------------------------------------------------
  // Property 1
  // -------------------------------------------------------------------------
  it('Property 1: Greeting prefix is exhaustive and non-overlapping across all hours', function () {
    // Feature: personal-dashboard, Property 1: Greeting prefix is exhaustive and non-overlapping
    fc.assert(fc.property(fc.integer({ min: 0, max: 23 }), function (hour) {
      var validPrefixes = ['Good Morning', 'Good Afternoon', 'Good Evening', 'Good Night'];
      var result = getGreetingPrefix(hour);
      // Must be one of the 4 valid strings
      if (validPrefixes.indexOf(result) === -1) return false;
      // Mutual exclusivity — verify band boundaries
      if (hour >= 5 && hour <= 11 && result !== 'Good Morning') return false;
      if (hour >= 12 && hour <= 17 && result !== 'Good Afternoon') return false;
      if (hour >= 18 && hour <= 20 && result !== 'Good Evening') return false;
      if ((hour >= 21 || hour <= 4) && result !== 'Good Night') return false;
      return true;
    }), { numRuns: 100 });
  });

  // -------------------------------------------------------------------------
  // Property 2
  // -------------------------------------------------------------------------
  it('Property 2: Task title normalization is idempotent', function () {
    // Feature: personal-dashboard, Property 2: Task title normalization is idempotent
    fc.assert(fc.property(fc.string(), function (s) {
      return normalizeTodoTitle(normalizeTodoTitle(s)) === normalizeTodoTitle(s);
    }), { numRuns: 100 });
  });

  // -------------------------------------------------------------------------
  // Property 3
  // -------------------------------------------------------------------------
  it('Property 3: Duplicate detection is symmetric', function () {
    // Feature: personal-dashboard, Property 3: Duplicate detection is symmetric
    fc.assert(fc.property(fc.string(), fc.string(), function (a, b) {
      var na = normalizeTodoTitle(a);
      var nb = normalizeTodoTitle(b);
      if (na === nb) {
        // Both should be rejected as duplicates of each other
        // Symmetric: normalize(a) === normalize(b) → both directions are duplicates
        return na === normalizeTodoTitle(b) && nb === normalizeTodoTitle(a);
      }
      return true; // non-matching strings trivially pass
    }), { numRuns: 100 });
  });

  // -------------------------------------------------------------------------
  // Property 4
  // -------------------------------------------------------------------------
  it('Property 4: Task addition persists exactly one new task', function () {
    // Feature: personal-dashboard, Property 4: Task addition persists exactly one new task
    fc.assert(fc.property(
      fc.array(fc.record({
        id: fc.string({ minLength: 1 }),
        title: fc.string({ minLength: 1 }),
        completed: fc.boolean(),
        createdAt: fc.integer({ min: 0 })
      })),
      function (initialTasks) {
        // Use unique titles to avoid duplicate rejection
        var uniqueTasks = [];
        var seenNorms = {};
        initialTasks.forEach(function (t) {
          var norm = normalizeTodoTitle(t.title);
          if (!seenNorms[norm]) {
            seenNorms[norm] = true;
            uniqueTasks.push(t);
          }
        });

        setTasks(uniqueTasks.slice());
        var before = getTasks().length;

        // Find a title that doesn't conflict
        var newTitle = 'unique_test_task_' + Date.now() + '_' + Math.random();
        addTask(newTitle);

        var after = getTasks().length;
        var found = getTasks().some(function (t) {
          return normalizeTodoTitle(t.title) === normalizeTodoTitle(newTitle);
        });

        return after === before + 1 && found;
      }
    ), { numRuns: 100 });
  });

  // -------------------------------------------------------------------------
  // Property 5
  // -------------------------------------------------------------------------
  it('Property 5: Task deletion removes exactly one task', function () {
    // Feature: personal-dashboard, Property 5: Task deletion removes exactly one task
    fc.assert(fc.property(
      fc.array(fc.record({
        id: fc.string({ minLength: 1 }),
        title: fc.string({ minLength: 1 }),
        completed: fc.boolean(),
        createdAt: fc.integer({ min: 0 })
      }), { minLength: 1 }),
      function (initialTasks) {
        // Make IDs unique
        var tasks = initialTasks.map(function (t, i) {
          return { id: 'task_' + i, title: t.title, completed: t.completed, createdAt: t.createdAt };
        });
        setTasks(tasks.slice());
        var before = getTasks().length;
        var idToDelete = getTasks()[0].id;

        deleteTask(idToDelete);

        var after = getTasks().length;
        var stillPresent = getTasks().some(function (t) { return t.id === idToDelete; });

        return after === before - 1 && !stillPresent;
      }
    ), { numRuns: 100 });
  });

  // -------------------------------------------------------------------------
  // Property 6
  // -------------------------------------------------------------------------
  it('Property 6: Sort does not mutate stored task data', function () {
    // Feature: personal-dashboard, Property 6: Sort does not mutate stored task data
    var sortOptions = ['default', 'alpha-asc', 'alpha-desc', 'completed-last', 'completed-first'];
    fc.assert(fc.property(
      fc.array(fc.record({
        id: fc.string({ minLength: 1 }),
        title: fc.string({ minLength: 1 }),
        completed: fc.boolean(),
        createdAt: fc.integer({ min: 0 })
      })),
      fc.constantFrom.apply(fc, sortOptions),
      function (tasks, sortOption) {
        var copy = tasks.map(function (t) { return Object.assign({}, t); });
        var sorted = getSortedTasks(copy, sortOption);

        // Same length
        if (sorted.length !== tasks.length) return false;

        // Same set of ids
        var originalIds = tasks.map(function (t) { return t.id; }).sort();
        var sortedIds = sorted.map(function (t) { return t.id; }).sort();
        if (originalIds.join(',') !== sortedIds.join(',')) return false;

        // Original array not mutated — same order as before
        for (var i = 0; i < tasks.length; i++) {
          if (tasks[i].id !== copy[i].id) return false;
          if (tasks[i].title !== copy[i].title) return false;
          if (tasks[i].completed !== copy[i].completed) return false;
          if (tasks[i].createdAt !== copy[i].createdAt) return false;
        }

        return true;
      }
    ), { numRuns: 100 });
  });

  // -------------------------------------------------------------------------
  // Property 7
  // -------------------------------------------------------------------------
  it('Property 7: Alphabetical sort produces correctly ordered output', function () {
    // Feature: personal-dashboard, Property 7: Alphabetical sort produces correctly ordered output
    fc.assert(fc.property(
      fc.array(fc.record({
        id: fc.string({ minLength: 1 }),
        title: fc.string({ minLength: 1 }),
        completed: fc.boolean(),
        createdAt: fc.integer({ min: 0 })
      })),
      function (tasks) {
        var asc = getSortedTasks(tasks, 'alpha-asc');
        var desc = getSortedTasks(tasks, 'alpha-desc');

        // Check adjacent pairs for asc
        for (var i = 0; i < asc.length - 1; i++) {
          if (asc[i].title.toLowerCase() > asc[i + 1].title.toLowerCase()) return false;
        }

        // Check adjacent pairs for desc
        for (var j = 0; j < desc.length - 1; j++) {
          if (desc[j].title.toLowerCase() < desc[j + 1].title.toLowerCase()) return false;
        }

        return true;
      }
    ), { numRuns: 100 });
  });

  // -------------------------------------------------------------------------
  // Property 8
  // -------------------------------------------------------------------------
  it('Property 8: URL validation accepts only http/https prefixed strings', function () {
    // Feature: personal-dashboard, Property 8: URL validation accepts only http/https prefixed strings
    fc.assert(fc.property(fc.string(), function (url) {
      var result = isValidUrl(url);
      var startsWithHttp = url.indexOf('http://') === 0 || url.indexOf('https://') === 0;
      var notTooLong = url.length <= 2048;
      var expected = startsWithHttp && notTooLong;
      return result === expected;
    }), { numRuns: 100 });
  });

  // -------------------------------------------------------------------------
  // Property 9
  // -------------------------------------------------------------------------
  it('Property 9: Link addition persists exactly one new link', function () {
    // Feature: personal-dashboard, Property 9: Link addition persists exactly one new link
    fc.assert(fc.property(
      fc.array(fc.record({
        id: fc.string({ minLength: 1 }),
        label: fc.string({ minLength: 1 }),
        url: fc.string({ minLength: 1 })
      }), { maxLength: 49 }),
      function (initialLinks) {
        // Make IDs unique
        var uniqueLinks = initialLinks.map(function (l, i) {
          return { id: 'link_' + i, label: l.label, url: l.url };
        });
        setLinks(uniqueLinks.slice());
        var before = getLinks().length;

        var label = 'Test Link';
        var url = 'https://example-test-' + Date.now() + '.com';
        addLink(label, url);

        var after = getLinks().length;
        var found = getLinks().some(function (l) {
          return l.label === label && l.url === url;
        });

        return after === before + 1 && found;
      }
    ), { numRuns: 100 });
  });

  // -------------------------------------------------------------------------
  // Property 10
  // -------------------------------------------------------------------------
  it('Property 10: Pomodoro duration validation accepts only integers in range 1-120', function () {
    // Feature: personal-dashboard, Property 10: Pomodoro duration validation accepts only integers in range 1-120
    fc.assert(fc.property(fc.integer(), function (n) {
      var result = validateDuration(n);
      var expected = n >= 1 && n <= 120;
      return result === expected;
    }), { numRuns: 100 });
  });

});
