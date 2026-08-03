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

    // LINE Messaging API - Broadcast (Flex Message)
    const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        messages: [
          {
            type: "flex",
            altText: `🚨 แจ้งเตือนสินค้าสต็อกต่ำ: ${productName}`,
            contents: {
              type: "bubble",
              size: "mega",
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: stock <= 0 ? "#EF4444" : "#F59E0B",
                contents: [
                  {
                    type: "text",
                    text: stock <= 0 ? "🚨 สินค้าหมดสต็อก (Out of Stock)" : "⚠️ สินค้าใกล้หมดสต็อก (Low Stock)",
                    weight: "bold",
                    color: "#FFFFFF",
                    size: "md"
                  }
                ]
              },
              body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                  {
                    type: "text",
                    text: productName,
                    weight: "bold",
                    size: "xl",
                    wrap: true
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "lg",
                    spacing: "sm",
                    contents: [
                      {
                        type: "box",
                        layout: "baseline",
                        spacing: "sm",
                        contents: [
                          {
                            type: "text",
                            text: "คงเหลือ",
                            color: "#aaaaaa",
                            size: "sm",
                            flex: 2
                          },
                          {
                            type: "text",
                            text: `${stock}`,
                            wrap: true,
                            color: stock <= 0 ? "#EF4444" : "#F59E0B",
                            weight: "bold",
                            size: "md",
                            flex: 5
                          }
                        ]
                      },
                      {
                        type: "box",
                        layout: "baseline",
                        spacing: "sm",
                        contents: [
                          {
                            type: "text",
                            text: "เกณฑ์แจ้งเตือน",
                            color: "#aaaaaa",
                            size: "sm",
                            flex: 2
                          },
                          {
                            type: "text",
                            text: `${minStock}`,
                            wrap: true,
                            color: "#666666",
                            size: "sm",
                            flex: 5
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
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
