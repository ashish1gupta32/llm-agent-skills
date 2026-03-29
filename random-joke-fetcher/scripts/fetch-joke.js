// fetch-joke.js
async function fetchJoke() {
  try {
    const response = await fetch('https://official-joke-api.appspot.com/random_joke');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Setup: ${data.setup}`);
    console.log(`Punchline: ${data.punchline}`);
  } catch (error) {
    console.error('Failed to fetch joke:', error.message);
  }
}

fetchJoke();
