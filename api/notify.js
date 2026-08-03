export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
      const { productName, stock, minStock, productCode, unit, updatedBy } = req.body;
    // For Vercel, LINE_NOTIFY_TOKEN must be set in Environment Variables
    const token = process.env.LINE_NOTIFY_TOKEN;

    if (!token) {
      console.error('LINE token is missing. Please set LINE_NOTIFY_TOKEN in Vercel Environment Variables.');
      return res.status(500).json({ error: 'LINE token is missing in Environment Variables' });
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const timestamp = `${dateStr} ${timeStr}`;

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
                    text: stock <= 0 ? "🚨 แจ้งเตือนสินค้าหมดสต็อก" : "⚠️ แจ้งเตือนสินค้าใกล้หมด",
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
                            text: "รหัสสินค้า",
                            color: "#aaaaaa",
                            size: "sm",
                            flex: 1
                          },
                          {
                            type: "text",
                            text: productCode || '-',
                            wrap: true,
                            color: "#666666",
                            size: "sm",
                            flex: 2
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
                            text: "คงเหลือ",
                            color: "#aaaaaa",
                            size: "sm",
                            flex: 1
                          },
                          {
                            type: "text",
                            text: `${stock} ${unit || 'pcs'}`,
                            wrap: true,
                            color: stock <= 0 ? "#EF4444" : "#F59E0B",
                            weight: "bold",
                            size: "sm",
                            flex: 2
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
                            text: "อัปเดตเมื่อ",
                            color: "#aaaaaa",
                            size: "sm",
                            flex: 1
                          },
                          {
                            type: "text",
                            text: timestamp,
                            wrap: true,
                            color: "#666666",
                            size: "sm",
                            flex: 2
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  {
                    type: "button",
                    style: "primary",
                    height: "sm",
                    action: {
                      type: "uri",
                      label: "เปิดระบบสินค้าคงคลัง",
                      uri: "https://rpm-restaurant-stock.vercel.app/"
                    },
                    color: "#1C345D"
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

    // Call Power Automate Webhook if configured
    const webhookUrl = process.env.POWER_AUTOMATE_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productName,
            productCode: productCode || '-',
            stock,
            minStock,
            unit: unit || 'pcs',
            updatedBy: updatedBy || 'Unknown User',
            timestamp
          })
        });
      } catch (err) {
        console.error('Failed to trigger Power Automate webhook:', err);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Serverless Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
