export default {
  async fetch(request) {
    // CORS Bypass
    if (request.method === "OPTIONS") {
      return new Response(null, { 
        headers: { 
          "Access-Control-Allow-Origin": "*", 
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS", 
          "Access-Control-Allow-Headers": "*" 
        } 
      });
    }
    
    // GET = Connection Test, POST = Send Notification
    let targetUrl = request.method === "GET" 
      ? "https://onesignal.com/api/v1/apps/eca3e9cf-b75c-4b7e-930a-0cc01359a2de" 
      : "https://onesignal.com/api/v1/notifications";

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Basic os_v2_app_5sr6tt5xlrfx5eykbtabgwnc3z4yx2eypbfupuuhr32y5vgkhvsjt53p5y4ftlbdxk3zj2htzk7d64benvbyzhrq5lwl43iabibswhy"
        },
        body: request.method === "POST" ? await request.text() : null
      });

      return new Response(await response.text(), {
        status: response.status,
        headers: { 
          "Access-Control-Allow-Origin": "*", 
          "Content-Type": "application/json" 
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500, 
        headers: { "Access-Control-Allow-Origin": "*" } 
      });
    }
  }
};





os_v2_app_5sr6tt5xlrfx5eykbtabgwnc3y5gqvotnp3uhm4p3ayfqexkjvh34fv5pjhguxhbqkjl5y2kj27fq45k5dodl5oa56fgbsvaxph353y
