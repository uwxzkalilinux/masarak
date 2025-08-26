const express = require('express');
const cors = require('cors');
const axios = require('axios');
const btoa = require('btoa');

const app = express();
const port = 3001; // You can choose any available port

app.use(cors());

app.get('/api/trucks/:unique', async (req, res) => {
  const uniqueId = req.params.unique;

  if (!uniqueId) {
    return res.status(400).json({ error: 'يرجى إدخال الرقم الموحد' });
  }

  const apiUrl = `http://176.241.95.201:8092/id?unique=${uniqueId}`;
  const auth = 'admin:241067890';
  const encodedAuth = btoa(auth);

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Basic ${encodedAuth}`,
      },
    });

    let data = response.data;

    if (data.sonar_image_url) {
      delete data.sonar_image_url;
    }

    res.json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'حدث خطأ بالاتصال' });
  }
});

app.listen(port, () => {
  console.log(`Proxy server is running on port ${port}`);
});