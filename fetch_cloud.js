const https = require('https');
const fs = require('fs');

const data = JSON.stringify({ max_results: 500 });
const req = https.request({
  hostname: 'api.cloudinary.com',
  path: '/v1_1/rpnynosr/resources/search',
  method: 'POST',
  headers: {
    'Authorization': 'Basic ' + Buffer.from('773317189684956:xfDzjTzvollwunyBg735HM_hb_o').toString('base64'),
    'Content-Type': 'application/json'
  }
}, (res) => {
  let b = '';
  res.on('data', d => b += d);
  res.on('end', () => {
    const urls = JSON.parse(b).resources.map(r => r.secure_url);
    fs.writeFileSync('urls.json', JSON.stringify(urls, null, 2));
    console.log("Wrote " + urls.length + " URLs to urls.json");
  });
});
req.write(data);
req.end();
