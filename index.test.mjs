import { readFileSync } from 'node:fs';
import { jest } from '@jest/globals';

// Build the page first so the module's init code finds its elements.
document.body.innerHTML = readFileSync(
  new URL('./index.html', import.meta.url),
  'utf8'
).match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];

const { fetchUser, fetchUsers, normaliseUser, getAllLanguages, handleSubmit } =
  await import('./index.mjs');

function apiUser(username, overall, languages = {}, clan = null) {
  const ranks = { overall: { score: overall }, languages: {} };
  for (const [name, score] of Object.entries(languages)) {
    ranks.languages[name] = { score };
  }
  return { username, clan, ranks };
}

// Pretend the Codewars API: known users return data, anything else is a 404
function mockApi(users) {
  global.fetch = jest.fn(async (url) => {
    const name = decodeURIComponent(url.split('/').pop());
    const user = users.find((u) => u.username === name);
    return user
      ? { ok: true, status: 200, json: async () => user }
      : { ok: false, status: 404 };
  });
}

const alice = apiUser('alice', 100, { java: 50, javascript: 40 }, 'Team A');
const bob = apiUser('bob', 300, { javascript: 200 });

afterEach(() => {
  delete global.fetch;
});

test('fetches a Codewars user', async () => {
  mockApi([alice]);

  const user = await fetchUser('alice');

  expect(user.username).toBe('alice');
  expect(fetch).toHaveBeenCalledWith(
    'https://www.codewars.com/api/v1/users/alice'
  );
});

test('fetchUser throws an error with the status on a bad response', async () => {
  mockApi([]);

  await expect(fetchUser('unknown')).rejects.toMatchObject({ status: 404 });
});

test('fetchUsers separates valid and invalid usernames', async () => {
  mockApi([alice]);

  const { fetchedDetails } = await fetchUsers([
    'alice',
    'unknown',
    'bad??name',
  ]);

  expect(fetchedDetails).toEqual({
    fetchedUsers: [alice],
    invalidNames: ['unknown', 'bad??name'],
    failedNames: [],
    unprocessedNames: [],
  });
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch).toHaveBeenLastCalledWith(
    'https://www.codewars.com/api/v1/users/bad%3F%3Fname'
  );
});

test('normaliseUser keeps only the needed details', () => {
  expect(normaliseUser(alice)).toEqual({
    username: 'alice',
    clan: 'Team A',
    overallScore: 100,
    languages: [
      { language: 'java', score: 50 },
      { language: 'javascript', score: 40 },
    ],
  });
});

test('getAllLanguages returns a sorted list without duplicates', () => {
  const users = [alice, bob].map(normaliseUser);

  expect(getAllLanguages(users)).toEqual(['java', 'javascript']);
});

test('submitting the form shows the ranked users and a message', async () => {
  mockApi([alice, bob]);
  document.getElementById('list').value = 'alice, bob, unknown';

  await handleSubmit({ preventDefault() {} });

  const rows = [...document.querySelectorAll('#results-table tbody tr')];
  expect(rows.map((row) => row.cells[0].textContent)).toEqual(['bob', 'alice']);
  expect(document.getElementById('results').hidden).toBe(false);
  expect(document.getElementById('results-message').textContent).toBe(
    '2 users found.\nunknown is an invalid username'
  );
});

test('choosing a language lists only users with a score in it', async () => {
  mockApi([alice, bob]);
  document.getElementById('list').value = 'alice, bob';
  await handleSubmit({ preventDefault() {} });

  const dropDown = document.getElementById('result-dropdown');
  dropDown.value = 'java';
  dropDown.dispatchEvent(new Event('change'));

  const rows = [...document.querySelectorAll('#results-table tbody tr')];
  expect(rows.map((row) => row.cells[0].textContent)).toEqual(['alice']);
  expect(rows[0].cells[2].textContent).toBe('50');
});
