export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/health") {
      return Response.json({ status: "ok", time: new Date().toISOString() });
    }
    return env.ASSETS.fetch(request);
  },
};
