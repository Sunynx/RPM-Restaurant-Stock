export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productName, stock, minStock } = req.body;
    // For Vercel, LINE_NOTIFY_TOKEN must be set in Environment Variables
    const token = process.env.LINE_NOTIFY_TOKEN;

    if (!token) {
      console.error('LINE token is missing. Please set LINE_NOTIFY_TOKEN in Vercel Environment Variables.');
      return res.status(500).json({ error: 'LINE token is missing in Environment Variables' });
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
