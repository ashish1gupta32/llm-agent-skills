// check-ip.js
async function checkIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Current Public IP: ${data.ip}`);
  } catch (error) {
    console.error('Failed to check public IP:', error.message);
  }
}

checkIP();
