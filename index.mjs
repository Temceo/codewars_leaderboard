'use strict';

const form = document.getElementById('user-search');
const list = document.getElementById('list');
const results = document.getElementById('results');
const resultsMessage = document.getElementById('results-message');
const resultDropDown = document.getElementById('result-dropdown');
const tableBody = document.querySelector('#results-table tbody');
const toast = document.getElementById('toast');

let currentUsers = [];

export async function handleSubmit(e) {
  e.preventDefault();

  const userNames = list.value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  list.value = '';

  // remove duplicate values before fetching users from codewars
  const { fetchedDetails } = await fetchUsers([...new Set(userNames)]);

  currentUsers = fetchedDetails.fetchedUsers
    .map(normaliseUser)
    .sort((a, b) => b.overallScore - a.overallScore);

  renderUserDetails(currentUsers, fetchedDetails);
}

export async function fetchUser(name) {
  const response = await fetch(
    `https://www.codewars.com/api/v1/users/${encodeURIComponent(name)}`
  );

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function fetchUsers(names) {
  const fetchedDetails = {
    fetchedUsers: [],
    invalidNames: [],
    failedNames: [], // network, json errors etc
    unprocessedNames: [], // not processed due to too many request
  };

  for (const name of names) {
    try {
      fetchedDetails.fetchedUsers.push(await fetchUser(name));
    } catch (error) {
      if (error.status === 429) {
        showToast(`Too many requests.  Rate limited (${error.message})`);
        fetchedDetails.unprocessedNames.push({ name, message: error.message });
        continue;
      }

      if (error.status === 404) {
        fetchedDetails.invalidNames.push(name);
      } else {
        fetchedDetails.failedNames.push({ name, message: error.message });
      }
    }
    const failedNames = fetchedDetails.failedNames;
    if (failedNames.length > 0) {
      const details = failedNames
        .map(({ name, message }) => `${name} (${message})`)
        .join(',');
      showToast(`Failed to fetch: ${details}`);
    }
  }

  return { fetchedDetails };
}

export function normaliseUser(user) {
  const languages = Object.entries(user.ranks?.languages ?? {}).map(
    ([language, info]) => ({ language, score: info?.score ?? 0 })
  );

  return {
    username: user.username,
    clan: user.clan ?? null,
    overallScore: user.ranks?.overall?.score ?? 0,
    languages,
  };
}

export function getAllLanguages(users) {
  const languages = new Set();
  for (const user of users) {
    for (const entry of user.languages) {
      languages.add(entry.language);
    }
  }
  return [...languages].sort();
}

function createOption(language) {
  const option = document.createElement('option');
  option.value = language;
  option.textContent = language;
  return option;
}

function populateDropDown(languages) {
  resultDropDown.replaceChildren(createOption('overall'));
  for (const language of languages) {
    resultDropDown.append(createOption(language));
  }
}

function renderResultsMessage(users, fetchedDetails) {
  const { invalidNames, unprocessedNames, failedNames } = fetchedDetails;
  let messages = [];

  if (users.length === 0) {
    messages.push('No users found.');
  } else if (users.length === 1) {
    messages.push('1 user found.');
  } else {
    messages.push(`${users.length} users found.`);
  }
  if (invalidNames.length === 1) {
    messages.push(`${invalidNames[0]} is an invalid username`);
  } else if (invalidNames.length > 1) {
    const last = invalidNames.at(-1);
    const allButLast = invalidNames.slice(0, -1).join(', ');
    messages.push(`${allButLast} and ${last} are invalid usernames`);
  }

  if (unprocessedNames.length > 0) {
    messages.push(
      `Could not process due to too many calls: ${fetchedDetails.unprocessedNames.map(({ name, error }) => `${name}: ${error}`).join(', ')}`
    );
  }

  if (failedNames.length > 0) {
    messages.push(
      `Failed to process these names: ${fetchedDetails.failedNames.map(({ name, error }) => `${name}: ${error}`).join(', ')}`
    );
  }

  resultsMessage.textContent = messages.join('\n');
}

function renderUserDetails(users, fetchedDetails) {
  results.hidden = false;
  renderResultsMessage(users, fetchedDetails);
  populateDropDown(getAllLanguages(users));
  showRankings(resultDropDown.value);
}

function populateTable(rows) {}

function showRankings(option) {}

//event listeners
form.addEventListener('submit', handleSubmit);

// toast for error messages
let toastTimeout;

function showToast(message) {
  clearTimeout(toastTimeout);

  toast.textContent = message;
  toast.classList.add('is-visible');

  toastTimeout = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 5000);
}
