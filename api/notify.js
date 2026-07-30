export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productName, stock, minStock } = req.body;
    // For Vercel, LINE_NOTIFY_TOKEN should be set in Environment Variables
    // But since the user gave it directly, we can use it or fall back
    const token = process.env.LINE_NOTIFY_TOKEN || 'QO5lKMUsFaM8V7431hUT8THnQcTqiGoSe+CcjuRo7m1hfOqXZ5iQLLWN4Ky5yBcNJ8eLdrSKWMX7rf/Hn7WzeRZoHOZyPevaRcH35RUbrPoXZjbkM3DK0Aoqd6OLbIFgEFgThHatRagko5EHNeJ9UAdB04t89/1O/w1cDnyilFU=';

    if (!token) {
      return res.status(500).json({ error: 'LINE token is missing' });
    }

    const message = `⚠️ สินค้าใกล้หมดสต็อก!\n\n📦 ${productName}\n📉 คงเหลือ: ${stock}\n⚠️ เกณฑ์แจ้งเตือน: ${minStock}`;

    // LINE Messaging API - Broadcast
    const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('LINE API Error:', errText);
      return res.status(response.status).json({ error: 'Failed to send LINE message', details: errText });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Serverless Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
