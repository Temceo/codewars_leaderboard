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

  console.log(fetchedDetails);
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
        fetchedDetails.invalidNames.push({ name, message: error.message });
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
