import { readFileSync } from 'node:fs';
import { jest } from '@jest/globals';

document.body.innerHTML = readFileSync(
  new URL('./index.html', import.meta.url),
  'utf-8'
).match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];

const { fetchUser, fetchUsers, handleSubmit } = await import('./index.mjs');

function validUser(username, overall, languages = {}, clan = null) {
  const ranks = { overall: { score: overall }, languages: {} };

  for (const [name, score] of Object.entries(languages)) {
    ranks.languages[name] = { score };
  }
  return { username, clan, ranks };
}

function mockApi(users, failedNames = []) {
  global.fetch = jest.fn(async (url) => {
    const name = decodeURIComponent(url.split('/').pop());
    if (failedNames.includes(name)) {
      throw new TypeError('Failed to fetch');
    }

    const user = users.find((u) => u.username === name);
    return user
      ? { ok: true, status: 200, json: async () => user }
      : { ok: false, status: 404 };
  });
}

const alice = validUser('alice', 100, { java: 50, javascript: 40 }, 'Team A');
const martin = validUser('martin', 200, { java: 40, javascript: 10 });
const bob = validUser('bob', 300, { javascript: 200 });

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
  expect(fetch).toHaveBeenCalledWith(
    'https://www.codewars.com/api/v1/users/bad%3F%3Fname'
  );
});

test('submitting the form reports names that fail to fetch', async () => {
  mockApi([alice], ['///', '???']);
  document.getElementById('list').value = 'alice, ///, ???';

  await handleSubmit({ preventDefault() {} });

  expect(document.getElementById('results-message').textContent).toBe(
    '1 user found.\nFailed to fetch these names: ///, ???'
  );
  expect(document.getElementById('toast').textContent).toBe(
    'Failed to fetch: ///, ???'
  );
  expect(fetch).toHaveBeenCalledTimes(3);
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

test('choosing a language lists users by highest score', async () => {
  mockApi([martin, alice]);
  document.getElementById('list').value = 'martin, alice';
  await handleSubmit({ preventDefault() {} });

  const dropDown = document.getElementById('result-dropdown');
  dropDown.value = 'javascript';
  dropDown.dispatchEvent(new Event('change'));

  const rows = [...document.querySelectorAll('#results-table tbody tr')];
  expect(rows.map((row) => row.cells[0].textContent)).toEqual([
    'alice',
    'martin',
  ]);
  expect(rows[0].cells[2].textContent).toBe('40');
  expect(rows[1].cells[2].textContent).toBe('10');
});
