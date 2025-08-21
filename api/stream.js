const axios = require('axios');

// The source JSON file from GitHub
const JSON_URL = 'https://raw.githubusercontent.com/abusaeeidx/Toffee-playlist/main/script_api/data.json';

// Simple in-memory cache to avoid fetching the JSON on every request
let channelCache = {
  timestamp: 0,
  data: [],
};

// Cache duration: 1 hour (in milliseconds)
const CACHE_DURATION = 3600 * 1000;

// The main handler for our serverless function
module.exports = async (req, res) => {
  try {
    // Get the channel ID from the query parameter (e.g., /api/stream?id=somoy-tv)
    const { id } = req.query;
    if (!id) {
      return res.status(400).send('Channel ID is required');
    }

    // --- Caching Logic ---
    const now = Date.now();
    if (now - channelCache.timestamp > CACHE_DURATION || channelCache.data.length === 0) {
      console.log('Fetching fresh channel data...');
      const response = await axios.get(JSON_URL);
      channelCache = {
        timestamp: now,
        data: response.data.channels,
      };
      console.log(`Cached ${channelCache.data.length} channels.`);
    }

    // --- Find the Channel ---
    const channel = channelCache.data.find(c => c.name.toLowerCase().replace(/\s+/g, '-') === id);

    if (!channel) {
      return res.status(404).send('Channel not found');
    }

    // --- Proxy the Stream ---
    console.log(`Proxying stream for: ${channel.name}`);
    const streamResponse = await axios({
      method: 'get',
      url: channel.link,
      headers: channel.headers,
      responseType: 'stream', // This is crucial for streaming
    });

    // Set the correct content type for an HLS playlist
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    // Pipe the stream from the source directly to the user
    streamResponse.data.pipe(res);

  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.status(500).send('Error fetching the stream.');
  }
};
